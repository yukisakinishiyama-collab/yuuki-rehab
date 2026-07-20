/**
 * LINE初回導線シナリオエンジン（指示書4章）
 *
 * 純粋関数として実装し、Webhook・シミュレーターの両方から同じロジックを使う。
 * - 診断の断定はしない／取得情報は最小限
 * - 緊急性はルールベース判定を優先（4-3）
 * - 怒り・診断要求などは人へ引き継ぐ（4-7）
 */
import { DEFAULT_CLINIC_PROFILE } from './clinic'
import { INTENT_LABELS, type BotReply, type IntentKey, type LineContact } from './line-types'

const P = DEFAULT_CLINIC_PROFILE

/**
 * 予約URLに流入元パラメータを付与（指示書4-5）。
 * APP_URL設定時はクリック計測エンドポイント経由（/api/marketing/go）にする。
 */
export function reserveUrlWith(intent?: string): string {
  const qs = `source=line&campaign=first_visit${intent ? `&intent=${intent}` : ''}`
  const app = process.env.APP_URL
  if (app) {
    return `${app.replace(/\/$/, '')}/api/marketing/go?d=reserve&${qs}`
  }
  const base = P.reserveUrl
  const sep = base.includes('?') ? '&' : '?'
  return `${base}${sep}${qs}`
}

// ── 緊急性判定（ルールベース・指示書4-3） ───────────────────────
const URGENT_PATTERNS: RegExp[] = [
  /胸(が|の)?(痛|苦し)/,
  /呼吸(が)?(苦し|でき|困難)/,
  /意識(が)?(ない|もうろう|とんだ|失)/,
  /(急に|突然).{0,6}(麻痺|動かな|しびれ)/,
  /頭を(強く)?(打っ|ぶつけ).{0,8}(吐|意識|ぼんやり)/,
  /大量(の)?出血|血が止まらない/,
  /骨が(見え|飛び出)/,
  /(明らかに|あきらかに)?変形/,
  /高熱.{0,6}(続|下がらない)/,
]

export function isUrgent(text: string): boolean {
  return URGENT_PATTERNS.some((p) => p.test(text))
}

// ── 人への引き継ぎ判定（指示書4-7） ─────────────────────────────
const HANDOFF_RULES: Array<{ pattern: RegExp; reason: string }> = [
  { pattern: /(ふざけ|最悪|訴え|許さな|クレーム|怒)/, reason: '強い不満の可能性' },
  { pattern: /(返金|料金.{0,8}(違う|おかしい|トラブル))/, reason: '料金に関する相談' },
  { pattern: /(医療事故|後遺症.{0,6}(残った|された))/, reason: '医療安全に関する相談' },
  { pattern: /(病名|診断して|何の病気|骨折してますか|折れてますか)/, reason: '診断を求める質問' },
  { pattern: /(スタッフ|人と話|直接話|電話して(ほしい|ください))/, reason: 'スタッフ対応の希望' },
]

export function checkHandoff(text: string): string | null {
  for (const rule of HANDOFF_RULES) {
    if (rule.pattern.test(text)) return rule.reason
  }
  return null
}

// ── 定型メッセージ ──────────────────────────────────────────────

export function intentMenu(): BotReply {
  return {
    type: 'buttons',
    text: '友だち追加ありがとうございます😊\nゆうき整骨院です。\n\nご相談内容に近いものを選択してください。',
    buttons: (Object.keys(INTENT_LABELS) as IntentKey[]).map((key) => ({
      label: INTENT_LABELS[key],
      data: `intent:${key}`,
    })),
  }
}

const URGENT_REPLY: BotReply = {
  type: 'text',
  text: [
    'お送りいただいた内容から、早めの医療機関の受診をおすすめする状態の可能性があります。',
    '',
    '・我慢せず、お近くの医療機関（整形外科・救急外来）へのご相談を優先してください',
    '・迷う場合は救急安心センター「#7119」に電話でご相談できます',
    '・命に関わる可能性を感じる場合は迷わず119番へ',
    // 院の直通連絡先（設定時のみ案内）。119等の緊急案内より後に置き、あくまで当院への連絡手段として提示する
    ...(P.emergencyPhone ? ['', `当院に急ぎご相談されたい場合は、直通（${P.emergencyPhone}）へお電話ください。`] : []),
    '',
    '医療機関受診後のリハビリ等は、あらためてお手伝いできます。お大事になさってください。',
  ].join('\n'),
}

function handoffReply(): BotReply {
  // 診療時間外・急ぎの場合の直通連絡先を1行添える（設定時のみ）
  const urgentLine = P.emergencyPhone ? `\nお急ぎ・診療時間外は直通（${P.emergencyPhone}）へお電話ください。` : ''
  return {
    type: 'text',
    text: `スタッフが直接確認して、こちらのLINEでお返事いたします。少しお時間をください。\nお急ぎの場合はお電話（${P.phone}）へお願いします。診療時間: ${P.hours}${urgentLine}`,
  }
}

function reserveButtons(intent?: IntentKey): BotReply {
  // 連絡先ボタン: 固定電話に加え、設定があれば携帯（時間外・急ぎ用）も併記する
  const phoneButtons: Array<{ label: string; data?: string; url?: string }> = [
    { label: `電話（固定 ${P.phone}）`, url: `tel:${P.phone.replace(/-/g, '')}` },
  ]
  if (P.emergencyPhone) {
    phoneButtons.push({
      label: `電話（携帯 ${P.emergencyPhone}）`,
      url: `tel:${P.emergencyPhone.replace(/-/g, '')}`,
    })
  }
  return {
    type: 'buttons',
    text: 'ご案内は以上です。ご都合のよい方法をお選びください😊（お急ぎのときはお電話が確実です）',
    buttons: [
      { label: 'Web予約へ進む（24時間・即確定）', url: reserveUrlWith(intent) },
      ...phoneButtons,
      { label: '料金を確認する', data: 'intent:price' },
      { label: 'スタッフに相談する', data: 'handoff' },
    ],
  }
}

/** 意図別の来院案内（指示書4-4。誇大表現なし・来院を強要しない） */
function guidance(intent: IntentKey, contact: LineContact): BotReply[] {
  const flow = `初回の流れ: ${P.firstVisitFlow}（所要45〜60分ほど）`
  const bring = '持ち物: 保険証（急性のケガの場合）／動きやすい服装がおすすめです'
  const access = `場所: ${P.address}（${P.parking}）`

  const bodyByIntent: Record<IntentKey, string> = {
    injury: [
      `${contact.bodyPart || 'ケガ'}の状態、おつらいですね。`,
      '捻挫・打撲などの急性のケガは、健康保険が使える場合があります（症状により異なります）。',
      '当院では状態の評価から始めて、必要な処置とセルフケアをご提案します。',
      '※骨折の疑いや強い腫れがある場合は、整形外科の受診を優先してください。当院からのご案内も可能です。',
    ].join('\n'),
    sports: [
      `${contact.bodyPart || '競技中の痛み'}のご相談ですね。`,
      '当院はスポーツ外傷・競技復帰のサポートを専門にしています。',
      '「いつまでに・どのレベルで復帰したいか」を伺い、段階的な復帰プランを一緒に立てます。',
    ].join('\n'),
    postop: [
      '手術後のリハビリのご相談ですね。',
      '医師の診断・術式を尊重しながら、退院後の機能回復・競技復帰をサポートします。',
      '経過や医師からの指示が分かるもの（診療情報・リハビリ指示書など）があると、初回がスムーズです。',
    ].join('\n'),
    chronic: [
      `${contact.bodyPart || '慢性的な痛み'}、長く付き合ってこられたのですね。`,
      '当院では「なぜ痛むのか」の評価から始めて、状態に合わせた施術と運動をご提案します。',
      '※症状が強い場合や気になる病気がある場合は、医療機関の受診をおすすめすることがあります。',
    ].join('\n'),
    price: [
      '料金のご案内です💰',
      '',
      `【保険施術】捻挫・打撲などの急性のケガは、健康保険が使える場合があります。`,
      `【自費】${P.priceSummary}`,
      '',
      '症状と目標を伺ったうえで、必要な施術だけをご提案します。費用は施術前に必ずご説明しますので、ご安心ください。',
    ].join('\n'),
    reserve: `ご予約はこちらからどうぞ。空いている時間だけが表示され、その場で確定します😊`,
    lost: [
      '大丈夫です、一緒に整理しましょう😊',
      '「どこが・いつから・何をすると」つらいかを送っていただければ、当院でお手伝いできるか、医療機関が先かをご案内します。',
      `もちろん、直接お電話（${P.phone}）でもご相談いただけます。`,
    ].join('\n'),
  }

  const replies: BotReply[] = [{ type: 'text', text: bodyByIntent[intent] }]
  if (intent !== 'price' && intent !== 'lost') {
    replies.push({ type: 'text', text: [flow, bring, access].join('\n\n') })
  }
  replies.push(reserveButtons(intent))
  return replies
}

// ── 意図ごとのタグ付け（指示書6章） ─────────────────────────────
const INTENT_TAGS: Record<IntentKey, string[]> = {
  injury: ['初めての方', '急性外傷'],
  sports: ['初めての方', 'スポーツ'],
  postop: ['初めての方', '術後リハ'],
  chronic: ['初めての方', '慢性痛'],
  price: ['初めての方', '予約検討中'],
  reserve: ['初めての方', '予約検討中'],
  lost: ['初めての方'],
}

// ── エンジン本体 ────────────────────────────────────────────────

export interface EngineInput {
  kind: 'follow' | 'text' | 'postback'
  text?: string
  data?: string // postback data（intent:xxx / handoff）
}

export interface EngineResult {
  replies: BotReply[]
  patch: Partial<LineContact>
  /** 管理画面へ通知が必要な場合の理由 */
  notify?: string
}

export function advanceScenario(contact: LineContact, input: EngineInput): EngineResult {
  // 明示的な「スタッフに相談する」ボタンは、人対応中でも毎回確認を返す（無反応を防ぐ）。
  // 自由入力への沈黙（スタッフの手動対応を邪魔しない）は下の handoff 判定で維持する。
  if (input.kind === 'postback' && input.data === 'handoff') {
    return {
      replies: [handoffReply()],
      patch: {
        step: 'human',
        handoff: true,
        needsAttention: 'スタッフ対応の希望',
        tags: mergeTags(contact.tags, ['要スタッフ対応']),
      },
      notify: 'LINE要対応: スタッフ対応の希望',
    }
  }

  // 人対応中は自由入力に自動応答しない（指示書4-7）
  if (contact.handoff) {
    return { replies: [], patch: {} }
  }

  // 友だち追加 → 選択メニュー（4-1）
  if (input.kind === 'follow') {
    return { replies: [intentMenu()], patch: { step: 'idle', tags: ['初めての方'] } }
  }

  const text = input.text ?? ''

  // 緊急判定は常に最優先（4-3）
  if (text && isUrgent(text)) {
    return {
      replies: [URGENT_REPLY],
      patch: { step: 'urgent', needsAttention: '緊急の可能性がある相談（本文確認）' },
      notify: '緊急性が疑われるLINE相談',
    }
  }

  // 引き継ぎ判定（テキストからの検知・4-7）
  const handoffReason = text ? checkHandoff(text) : null
  if (handoffReason) {
    return {
      replies: [handoffReply()],
      patch: {
        step: 'human',
        handoff: true,
        needsAttention: handoffReason,
        tags: mergeTags(contact.tags, ['要スタッフ対応']),
      },
      notify: `LINE要対応: ${handoffReason}`,
    }
  }

  // 意図選択（ボタン or テキスト一致）
  const intent = parseIntent(input)
  if (intent) {
    if (intent === 'price' || intent === 'reserve' || intent === 'lost') {
      // 質問を挟まず即案内
      return {
        replies: guidance(intent, contact),
        patch: { intent, step: 'guide', tags: mergeTags(contact.tags, INTENT_TAGS[intent]) },
      }
    }
    return {
      replies: [
        {
          type: 'buttons',
          text: 'ありがとうございます。どのあたりがおつらいですか？（近いものでOKです）',
          buttons: ['足首', '膝', '股関節', '腰', '肩', 'その他'].map((part) => ({ label: part, data: `part:${part}` })),
        },
      ],
      patch: { intent, step: 'ask_part', tags: mergeTags(contact.tags, INTENT_TAGS[intent]) },
    }
  }

  // 部位の回答
  if (contact.step === 'ask_part' && contact.intent) {
    const part = input.data?.startsWith('part:') ? input.data.slice(5) : text
    if (part) {
      return {
        replies: [
          {
            type: 'buttons',
            text: `${part}ですね。いつごろからですか？`,
            buttons: ['今日・昨日', '1週間以内', '1ヶ月以内', 'もっと前から'].map((t) => ({ label: t, data: `when:${t}` })),
          },
        ],
        patch: { bodyPart: part, step: 'ask_when' },
      }
    }
  }

  // 時期の回答 → 案内（4-4）
  if (contact.step === 'ask_when' && contact.intent) {
    const timing = input.data?.startsWith('when:') ? input.data.slice(5) : text
    return {
      replies: guidance(contact.intent, contact),
      patch: { timing, step: 'guide' },
    }
  }

  // どのステップにも該当しない自由入力 → メニュー再提示
  // LINE_TEXT_FALLBACK=off の場合は何も返さない（LINE公式アカウント側の
  // 応答メッセージ（キーワード自動応答）と併用するための二重返信対策。
  // 緊急判定・引き継ぎ判定は上で処理済みなので安全系は常に有効）
  if (input.kind === 'text' && process.env.LINE_TEXT_FALLBACK === 'off') {
    return { replies: [], patch: {} }
  }
  return {
    replies: [
      {
        type: 'text',
        text: 'メッセージありがとうございます。内容はスタッフも確認できます。お急ぎの場合は下のメニューからどうぞ😊',
      },
      intentMenu(),
    ],
    patch: {},
  }
}

function parseIntent(input: EngineInput): IntentKey | null {
  if (input.data?.startsWith('intent:')) {
    const key = input.data.slice(7) as IntentKey
    return key in INTENT_LABELS ? key : null
  }
  const text = input.text ?? ''
  const found = (Object.entries(INTENT_LABELS) as Array<[IntentKey, string]>).find(([, label]) => text === label)
  return found ? found[0] : null
}

function mergeTags(current: string[], add: string[]): string[] {
  return Array.from(new Set([...(current ?? []), ...add]))
}
