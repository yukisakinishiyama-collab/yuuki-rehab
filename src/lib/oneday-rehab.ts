// ──────────────────────────────────────────────
// 1dayリハ — その日の症状を緩和させる単回メニュー
//
// 通常のプロトコル（数週間〜数ヶ月の段階的リハ）とは別に、
// 「今日はここが痛い・張っている」という当日の訴えに対して、
// その場の1セッションで行う緩和メニューを組み立てる。
//
// このファイルは【AIなしでも動く】ルールベースの生成と、
// レッドフラッグ（医療機関を優先すべきサイン）の判定を持つ。
// AI（/api/oneday-rehab）が使えない・失敗した場合はこちらに必ず落ちるため、
// 患者対応が止まることはない。
// ──────────────────────────────────────────────
import type { Joint } from '@/types/protocol'

// ── 型 ──────────────────────────────────────────

export type SymptomKey =
  | 'pain'        // 痛み
  | 'stiffness'   // 張り・こわばり
  | 'swelling'    // 腫れ・熱感
  | 'rom_limit'   // 動かしにくい
  | 'heaviness'   // だるさ・疲労
  | 'instability' // 不安定感・力が入らない

export const SYMPTOM_LABELS: Record<SymptomKey, string> = {
  pain: '痛み',
  stiffness: '張り・こわばり',
  swelling: '腫れ・熱感',
  rom_limit: '動かしにくい',
  heaviness: 'だるさ・疲労',
  instability: '不安定感',
}

export type RedFlagKey = 'numbness' | 'night_pain' | 'fever' | 'fresh_trauma' | 'bladder_bowel'

export const RED_FLAG_OPTIONS: Array<{ key: RedFlagKey; label: string }> = [
  { key: 'numbness', label: 'しびれ・力が入らない' },
  { key: 'night_pain', label: '夜間もズキズキ痛む' },
  { key: 'fever', label: '発熱・患部が熱く赤い' },
  { key: 'fresh_trauma', label: '直近1〜2日の強いケガ（転倒・衝突など）' },
  { key: 'bladder_bowel', label: '排尿・排便の異常（急な失禁・出にくい）' },
]

/** 施術よりも医療機関の受診案内を優先すべきフラグ */
export function needsReferralFirst(flags: RedFlagKey[]): boolean {
  return flags.includes('fever') || flags.includes('bladder_bowel')
}

export interface OneDayInput {
  joint: Joint
  symptoms: SymptomKey[]
  nrs: number
  flags: RedFlagKey[]
  /** きっかけ・状況（自由記述） */
  trigger: string
  /** セッション時間（分） */
  minutes: number
}

export type OneDayItemKind = 'manual' | 'modality' | 'exercise' | 'stretch' | 'education'

export const ITEM_KIND_LABELS: Record<OneDayItemKind, string> = {
  manual: '手技',
  modality: '物理療法',
  exercise: '運動',
  stretch: 'ストレッチ',
  education: '指導',
}

export interface OneDayItem {
  name: string
  kind: OneDayItemKind
  minutes: number
  dose?: string
  /** 手順（\n区切り） */
  steps: string
  purpose: string
  caution?: string
  /**
   * スタッフ向けの項目（評価・受診案内の段取りなど）。
   * 画面には表示するが、患者へ渡す印刷物には載せない。
   */
  staffOnly?: boolean
}

export interface OneDayMenu {
  title: string
  summary: string
  /** レッドフラッグ時の警告（表示側で目立たせる） */
  redFlagWarning?: string
  items: OneDayItem[]
  homeAdvice: string[]
  avoidToday: string[]
  source: 'ai' | 'basic'
}

// ── レッドフラッグ判定（AI利用時も必ずこちらで判定して重ねる）──

export function buildRedFlagWarning(flags: RedFlagKey[], nrs: number): string | undefined {
  const messages: string[] = []
  if (flags.includes('bladder_bowel')) {
    messages.push('排尿・排便の異常は馬尾症候群など緊急性の高いサインの可能性があります。本日の施術は行わず、速やかに医療機関（必要なら救急外来）の受診をご案内ください。')
  }
  if (flags.includes('fever')) {
    messages.push('発熱・熱感・発赤は感染などの可能性があります。施術より先に医療機関の受診をご案内ください。温めることは避けてください。')
  }
  if (flags.includes('fresh_trauma')) {
    messages.push('受傷直後は骨折・靱帯損傷の見極めが優先です。評価と応急処置（RICE）にとどめ、必要なら医療機関の受診を。温熱・強い手技・ストレッチは行わないでください。')
  }
  if (flags.includes('numbness')) {
    messages.push('しびれ・脱力は神経症状の可能性があります。増悪させる手技・ストレッチは避け、医師への相談をご検討ください。')
  }
  if (flags.includes('night_pain')) {
    messages.push('夜間痛が続く場合は炎症が強いか、他疾患の可能性もあります。強い刺激は避けてください。')
  }
  if (nrs >= 9) {
    messages.push('痛みが非常に強い状態です。本日は緩和と安静指導にとどめ、無理な運動は行わないでください。')
  }
  return messages.length > 0 ? messages.join('\n') : undefined
}

/**
 * 患者に渡す印刷物用の注意文。
 * buildRedFlagWarning はスタッフ向けの指示文（「〜をご案内ください」）のため、
 * そのまま患者向けの紙に載せると誰への指示か分からなくなる。印刷時はこちらを使う。
 */
export function buildPatientNotice(flags: RedFlagKey[], nrs: number): string | undefined {
  if (flags.includes('bladder_bowel')) {
    return '本日の症状には、急いで医療機関での確認が必要な所見があります。できるだけ早く（我慢せず今日中に）医療機関を受診してください。'
  }
  if (flags.length > 0 || nrs >= 9) {
    return '本日の症状には、医療機関での確認をおすすめする所見がありました。症状が続く・強まる場合は、早めに医療機関を受診してください。'
  }
  return undefined
}

// ── ルールベース生成（基本メニュー）─────────────

interface CatalogItem extends OneDayItem {
  /** 選択の優先度（小さいほど先に採用） */
  priority: number
  /** この症状のときに優先度を上げる */
  boostFor?: SymptomKey[]
  /** NRSがこの値以上のときは外す（強い痛みに不向きな項目） */
  skipIfNrsAtLeast?: number
}

const COMMON_START: CatalogItem = {
  name: '深呼吸と全身リラクゼーション',
  kind: 'education',
  minutes: 2,
  priority: 1,
  steps: '楽な姿勢で座る/仰向けになる\n鼻から4秒吸って口から8秒吐く×5回\n肩の力が抜けるのを確認',
  purpose: '痛みで高ぶった緊張を落ち着かせ、施術の効果を高める',
}

const ICING: CatalogItem = {
  name: 'アイシング',
  kind: 'modality',
  minutes: 5,
  priority: 9,
  boostFor: ['swelling'],
  dose: '10〜15分（帰宅後も1日2〜3回）',
  steps: '氷のうをタオル1枚越しに患部へ\n感覚が鈍くなるまで（10〜15分）を目安に\n凍傷防止のため直接当てない',
  purpose: '炎症・腫れをしずめ、痛みを和らげる',
  caution: '感覚障害がある部位には行わない',
}

const HEAT: CatalogItem = {
  name: '温熱（ホットパック）',
  kind: 'modality',
  minutes: 5,
  priority: 2,
  boostFor: ['stiffness', 'rom_limit', 'heaviness'],
  skipIfNrsAtLeast: 11, // 温熱自体は原則可。腫れがある場合は生成側で除外する
  steps: 'ホットパックをタオル越しに患部へ10分\n心地よい温かさであることを確認\n終了後に軽く動かす',
  purpose: '血流を促し、筋肉のこわばりをゆるめて動きやすくする',
  caution: '腫れ・熱感がある部位には行わない',
}

/** 関節別の施術・運動カタログ（安全側の内容で構成） */
const JOINT_CATALOG: Record<Joint, CatalogItem[]> = {
  knee: [
    { name: '大腿四頭筋・内転筋のほぐし', kind: 'manual', minutes: 4, priority: 3,
      steps: '大腿前面〜内側を軽擦・揉捏\n膝蓋骨上方のつまりを丁寧に\n痛気持ちいい強さまで',
      purpose: '膝まわりの筋緊張を落として膝への負担を減らす' },
    { name: '膝蓋骨モビライゼーション', kind: 'manual', minutes: 2, priority: 4, boostFor: ['rom_limit', 'stiffness'],
      steps: '膝を伸ばしてリラックス\n膝蓋骨を上下・左右へゆっくり滑らせる\n痛みのない範囲で各方向10回',
      purpose: '膝のお皿の動きを出して曲げ伸ばしを楽にする' },
    { name: 'ヒールスライド（膝の曲げ伸ばし）', kind: 'exercise', minutes: 3, priority: 5, boostFor: ['rom_limit'],
      dose: '10回×2セット',
      steps: '仰向けでかかとを床につけたまま\nゆっくり膝を曲げてかかとをお尻へ近づける\n痛みの出る手前で止めて戻す',
      purpose: '痛みのない範囲で可動域を維持・改善する' },
    { name: 'クアドセッティング', kind: 'exercise', minutes: 3, priority: 6, boostFor: ['instability'],
      dose: '5秒キープ×10回',
      steps: '膝を伸ばして座り、膝裏にタオルを敷く\nタオルを床へ押しつぶすように力を入れる\n太もも前面に力が入るのを確認',
      purpose: '膝に負担をかけずに大腿四頭筋を活性化する', skipIfNrsAtLeast: 9 },
    { name: 'ハムストリングスストレッチ', kind: 'stretch', minutes: 2, priority: 7, boostFor: ['stiffness'],
      dose: '20〜30秒×2回',
      steps: '浅く腰かけ、片脚を前に伸ばす\n背すじを保ったまま股関節から前へ\n太もも裏の伸びを感じる位置で止める',
      purpose: '膝の裏側の張りをゆるめる', caution: '反動をつけない' },
  ],
  shoulder: [
    { name: '肩甲骨まわり・首肩のほぐし', kind: 'manual', minutes: 4, priority: 3,
      steps: '僧帽筋上部〜肩甲骨内側縁を揉捏\n肩甲骨を軽く動かしながら緊張を確認\n痛気持ちいい強さまで',
      purpose: '肩甲骨の動きを妨げる筋緊張を落とす' },
    { name: '振り子運動（コッドマン体操）', kind: 'exercise', minutes: 3, priority: 4, boostFor: ['pain', 'rom_limit'],
      dose: '各方向10回',
      steps: '机に片手をつき、痛い側の腕を垂らす\n体を揺らして腕を前後・左右・円に振る\n腕の力は抜いたまま',
      purpose: '肩に負担をかけずに動きを引き出し、痛みを和らげる' },
    { name: 'テーブルスライド', kind: 'exercise', minutes: 3, priority: 5, boostFor: ['rom_limit'],
      dose: '10回×2セット',
      steps: '椅子に座り、机の上に手を置く\nタオルを敷いた手を前方へ滑らせる\n体を倒しながら腕を伸ばし、痛みの手前で戻る',
      purpose: '重力の負担を減らした状態で挙上の動きを出す' },
    { name: '肩甲骨セッティング', kind: 'exercise', minutes: 2, priority: 6, boostFor: ['instability'],
      dose: '5秒キープ×10回',
      steps: '背すじを伸ばして座る\n肩甲骨を軽く後ろへ寄せて下げる\n肩をすくめないように注意',
      purpose: '肩の土台となる肩甲骨の安定性を高める' },
    { name: '胸のストレッチ', kind: 'stretch', minutes: 2, priority: 7, boostFor: ['stiffness'],
      dose: '20〜30秒×2回',
      steps: '壁に前腕をつけて肘を肩の高さに\n体を反対側へゆっくりひねる\n胸の前の伸びを感じる位置で止める',
      purpose: '巻き肩ぎみの姿勢をゆるめ、肩の通り道を広げる' },
  ],
  hip: [
    { name: '殿筋・腰まわりのほぐし', kind: 'manual', minutes: 4, priority: 3,
      steps: '大殿筋・中殿筋を中心に揉捏\n股関節外側の張りも確認\n痛気持ちいい強さまで',
      purpose: '股関節の動きを妨げる殿筋の緊張を落とす' },
    { name: '股関節の振り子運動', kind: 'exercise', minutes: 3, priority: 4, boostFor: ['pain', 'rom_limit'],
      dose: '前後・左右各10回',
      steps: '壁や椅子につかまり片脚立ち\n反対の脚を前後・左右に軽く振る\n振り幅は痛みのない範囲で',
      purpose: '股関節に負担をかけずに動きを引き出す' },
    { name: 'ヒップリフト', kind: 'exercise', minutes: 3, priority: 5, boostFor: ['instability'],
      dose: '10回×2セット',
      steps: '仰向けで両膝を立てる\nお尻を持ち上げ、体を一直線に\n腰を反らせすぎない',
      purpose: '殿筋を活性化し股関節を支える力を高める', skipIfNrsAtLeast: 8 },
    { name: '腸腰筋ストレッチ', kind: 'stretch', minutes: 2, priority: 6, boostFor: ['stiffness'],
      dose: '20〜30秒×左右2回',
      steps: '片膝立ちになり、骨盤を前へ押し出す\n後ろ脚の付け根前面の伸びを感じる\n腰を反らせない',
      purpose: '股関節前面のつまり感・張りをゆるめる' },
    { name: 'クラムシェル', kind: 'exercise', minutes: 3, priority: 7, boostFor: ['instability'],
      dose: '10回×2セット',
      steps: '横向きで両膝を軽く曲げる\nかかとを付けたまま上の膝を開く\n骨盤が後ろへ倒れないように',
      purpose: '中殿筋を活性化し歩行時のふらつきを減らす', skipIfNrsAtLeast: 8 },
  ],
  ankle: [
    { name: 'ふくらはぎ・すねのほぐし', kind: 'manual', minutes: 4, priority: 3,
      steps: '腓腹筋・ヒラメ筋を中心に揉捏\n前脛骨筋・足底も確認\n痛気持ちいい強さまで',
      purpose: '足首の動きを妨げる下腿の緊張を落とす' },
    { name: '足首のポンプ運動', kind: 'exercise', minutes: 2, priority: 4, boostFor: ['swelling', 'rom_limit'],
      dose: '20回×2セット',
      steps: '座って脚を伸ばす\n足首をゆっくり反らす→伸ばすを繰り返す\n痛みのない範囲で大きく',
      purpose: '血流・リンパの流れを促し、腫れと痛みを和らげる' },
    { name: 'タオルギャザー', kind: 'exercise', minutes: 3, priority: 6, boostFor: ['instability'],
      dose: 'タオル1枚×2回',
      steps: '床にタオルを敷き、足指でたぐり寄せる\nかかとは床につけたまま\n足裏の疲労を感じたら休憩',
      purpose: '足裏の筋を働かせ、足首の安定性を支える', skipIfNrsAtLeast: 8 },
    { name: 'カーフストレッチ', kind: 'stretch', minutes: 2, priority: 5, boostFor: ['stiffness'],
      dose: '20〜30秒×2回',
      steps: '壁に手をつき、患側を後ろへ引く\nかかとを床につけたまま体重を前へ\nふくらはぎの伸びを感じる位置で止める',
      purpose: 'ふくらはぎの張りをゆるめ、足首を動かしやすくする', caution: '腫れが強い日は無理に伸ばさない' },
    { name: '片脚立ちバランス', kind: 'exercise', minutes: 3, priority: 7, boostFor: ['instability'],
      dose: '30秒×左右2回',
      steps: '壁の近くで片脚立ち\nぐらつきを足裏で感じて立て直す\n慣れたら目線を動かす',
      purpose: '足首の位置感覚を取り戻し、再発を予防する', skipIfNrsAtLeast: 7 },
  ],
  elbow: [
    { name: '前腕のほぐし', kind: 'manual', minutes: 4, priority: 3,
      steps: '前腕伸筋群・屈筋群を軽擦・揉捏\n肘外側・内側の付着部周囲を丁寧に\n痛気持ちいい強さまで',
      purpose: '肘に付く筋肉の緊張を落とし、負担を減らす' },
    { name: '肘の曲げ伸ばし・回内外運動', kind: 'exercise', minutes: 3, priority: 4, boostFor: ['rom_limit'],
      dose: '各10回×2セット',
      steps: '肘を体につけて曲げ伸ばし\n手のひらを上下に返す（回内外）\n痛みのない範囲でゆっくり',
      purpose: '痛みのない範囲で肘の動きを維持する' },
    { name: '手首伸筋ストレッチ', kind: 'stretch', minutes: 2, priority: 5, boostFor: ['stiffness', 'pain'],
      dose: '20〜30秒×2回',
      steps: '肘を伸ばし、手の甲側から反対の手で曲げる\n前腕外側の伸びを感じる位置で止める\n反動をつけない',
      purpose: '肘外側への引っぱりストレスをゆるめる' },
    { name: 'グリップ運動', kind: 'exercise', minutes: 2, priority: 6,
      dose: '10回×2セット',
      steps: 'タオルやボールを軽く握る→ゆるめる\n強く握りすぎない\n痛みが出る場合は中止',
      purpose: '前腕の血流を促し、握る力の回復を助ける', skipIfNrsAtLeast: 8 },
  ],
  hand: [
    { name: '前腕・手のひらのほぐし', kind: 'manual', minutes: 4, priority: 3,
      steps: '前腕から手のひらへ向かって軽擦・揉捏\n母指球・小指球も丁寧に\n痛気持ちいい強さまで',
      purpose: '手指の動きを妨げる緊張を落とす' },
    { name: 'グーパー運動', kind: 'exercise', minutes: 2, priority: 4, boostFor: ['swelling', 'rom_limit'],
      dose: '20回×2セット',
      steps: '手を心臓より高く上げて行うとより効果的\nしっかり握って大きく開く\n痛みのない範囲で',
      purpose: '血流を促して腫れ・こわばりを和らげる' },
    { name: '腱グライディング運動', kind: 'exercise', minutes: 3, priority: 5, boostFor: ['stiffness', 'rom_limit'],
      dose: '各形5回×2セット',
      steps: 'まっすぐ→カギ爪→握りこぶし→机の形\n順番に指の形を変えていく\nゆっくり最終域まで',
      purpose: '指を動かす腱の滑りを保ち、こわばりを防ぐ' },
    { name: '手首ストレッチ', kind: 'stretch', minutes: 2, priority: 6,
      dose: '20〜30秒×2回',
      steps: '手のひら側・甲側それぞれへゆっくり\n反対の手で軽く補助\n反動をつけない',
      purpose: '手首まわりの張りをゆるめる' },
  ],
  spine: [
    { name: '腰背部・殿部のほぐし', kind: 'manual', minutes: 5, priority: 3,
      steps: '脊柱起立筋・腰方形筋・殿筋を揉捏\n呼吸に合わせてゆっくり圧をかける\n痛気持ちいい強さまで',
      purpose: '腰を守ろうとして固まった筋肉の緊張を落とす' },
    { name: 'キャットバック（四つ這い体操）', kind: 'exercise', minutes: 3, priority: 4, boostFor: ['stiffness', 'rom_limit'],
      dose: '10回×2セット',
      steps: '四つ這いで背中を丸める→そらすを繰り返す\n痛みのない範囲でゆっくり\n呼吸を止めない',
      purpose: '背骨を少しずつ動かして、こわばりをほどく' },
    { name: '膝抱えストレッチ', kind: 'stretch', minutes: 2, priority: 5, boostFor: ['pain'],
      dose: '20〜30秒×2回',
      steps: '仰向けで両膝をゆっくり胸へ引き寄せる\n腰が心地よく伸びる位置で止める\n反動をつけない',
      purpose: '腰部の筋緊張をゆるめ、圧迫感を減らす', caution: '脚のしびれが強まる場合は中止' },
    { name: 'ドローイン', kind: 'exercise', minutes: 3, priority: 6, boostFor: ['instability'],
      dose: '5秒キープ×10回',
      steps: '仰向けで膝を立てる\n息を吐きながらお腹を薄くへこませる\n腰と床の隙間を保ったまま呼吸を続ける',
      purpose: '腰を支えるインナーマッスルを働かせる' },
    { name: '歩行・日常動作の指導', kind: 'education', minutes: 2, priority: 7,
      steps: '長時間の同一姿勢を避ける（30分に1回立つ）\n物を持つときは膝を使ってしゃがむ\n痛みの範囲で普段どおり動いてよいことを伝える',
      purpose: '安静にしすぎず、悪化させない動き方を身につける' },
  ],
  other: [
    { name: '患部周囲のほぐし', kind: 'manual', minutes: 4, priority: 3,
      steps: '患部そのものではなく周囲の筋肉から\n緊張の強い部位を探しながら揉捏\n痛気持ちいい強さまで',
      purpose: '患部を守ろうとして固まった周囲の緊張を落とす' },
    { name: '痛みのない範囲での自動運動', kind: 'exercise', minutes: 3, priority: 4,
      dose: '10回×2セット',
      steps: '患部の関節をゆっくり動かす\n痛みの出る手前で止めて戻す\n呼吸を止めない',
      purpose: '動かせる範囲を保ち、回復を助ける' },
    { name: '周辺部位のストレッチ', kind: 'stretch', minutes: 2, priority: 5,
      dose: '20〜30秒×2回',
      steps: '患部の上下の関節まわりをゆっくり伸ばす\n心地よい範囲で止める\n反動をつけない',
      purpose: '周囲の張りを取り、患部への負担を減らす' },
  ],
}

/** 症状に応じた自宅ケアの助言 */
function buildHomeAdvice(input: OneDayInput): string[] {
  const advice: string[] = []
  const noHeat = input.symptoms.includes('swelling') || input.flags.includes('fresh_trauma') || input.flags.includes('fever')
  if (input.symptoms.includes('swelling') || input.flags.includes('fresh_trauma')) {
    advice.push('帰宅後もアイシングを1日2〜3回（1回10〜15分・タオル越し）。今日は長風呂と飲酒を控えめに。')
    advice.push('できるときは患部を心臓より高くして休む。')
  } else if (!noHeat && (input.symptoms.includes('stiffness') || input.symptoms.includes('heaviness'))) {
    advice.push('今夜は湯船で温めて、今日行った運動を1セットだけ復習する。')
  }
  if (input.nrs >= 7) {
    advice.push('今日は「痛みを増やさない」が最優先。痛みを我慢して動かさない。')
  } else {
    advice.push('痛みのない範囲なら、普段どおり動いて大丈夫。動かなすぎも回復を遅らせます。')
  }
  advice.push('明日になっても症状が強い・悪化している場合は、我慢せずご連絡ください。')
  return advice
}

/** 今日避けてほしいこと */
function buildAvoidToday(input: OneDayInput): string[] {
  const avoid: string[] = []
  if (input.symptoms.includes('swelling') || input.flags.includes('fresh_trauma') || input.flags.includes('fever')) {
    avoid.push('患部を温めること（入浴はシャワー程度に）・飲酒')
  }
  if (input.symptoms.includes('pain')) avoid.push('痛みを我慢してのマッサージ・ストレッチのしすぎ')
  if (input.symptoms.includes('stiffness') || input.symptoms.includes('rom_limit')) avoid.push('反動をつけたストレッチ')
  if (input.symptoms.includes('instability')) avoid.push('不安定な足場・急な方向転換')
  if (input.nrs >= 7) avoid.push('痛みが出る動作の反復・長時間の同一姿勢')
  if (avoid.length === 0) avoid.push('疲れを残すほどの運動のしすぎ')
  return avoid
}

// ── AI生成メニューの安全フィルタ ────────────────

const HEAT_PATTERN = /温熱|ホットパック|温め|蒸しタオル|ホットタオル|入浴で/

/**
 * AIが生成したメニューに対しても、レッドフラッグの禁忌を機械的に除外する。
 * （プロンプトで指示はするが、AI任せにしない）
 */
export function sanitizeMenuForFlags(menu: OneDayMenu, flags: RedFlagKey[]): OneDayMenu {
  let items = menu.items
  if (flags.includes('fever') || flags.includes('fresh_trauma')) {
    items = items.filter(i => !HEAT_PATTERN.test(`${i.name} ${i.steps}`))
  }
  if (flags.includes('fresh_trauma')) {
    items = items.filter(i => i.kind !== 'stretch')
  }
  if (flags.includes('numbness')) {
    items = items.filter(i => i.kind !== 'stretch')
  }
  return items === menu.items ? menu : { ...menu, items }
}

// ── レッドフラッグ時の専用メニュー ──────────────

/** 発熱・排尿排便異常：施術は行わず、受診案内を最優先にする（段取りはスタッフ向け＝印刷しない） */
const REFERRAL_FIRST_ITEMS: OneDayItem[] = [
  {
    name: '状態の確認と受診のご案内',
    kind: 'education',
    minutes: 5,
    staffOnly: true,
    steps: '発熱・熱感・発赤の範囲、症状の経過を確認\n本日は積極的な施術を行わないことを説明\n医療機関（整形外科など）の受診を案内し、紹介状・連絡の要否を確認',
    purpose: '感染や重い疾患の見逃しを防ぎ、必要な医療へ最短でつなぐ',
  },
  {
    name: '安静と生活指導',
    kind: 'education',
    minutes: 5,
    staffOnly: true,
    steps: '患部を温めない・揉まない・無理に動かさないことを説明\n水分をとり、無理をせず休む\n症状が急に強まる場合は救急受診も検討するよう伝える',
    purpose: '受診までの間に悪化させないようにする',
  },
]

/**
 * 受傷直後：評価と応急処置（RICE）にとどめる。
 * セッション時間に合わせて分数を割り付ける（固定19分だと10分枠を超えるため）。
 */
function buildAcuteTraumaItems(budget: number): OneDayItem[] {
  const evalMin = budget >= 15 ? 5 : 4
  const fixMin = budget >= 15 ? 4 : 3
  const icingMin = Math.max(3, Math.min(10, budget - evalMin - fixMin))
  return [
    {
      name: '外傷の評価',
      kind: 'education',
      minutes: evalMin,
      staffOnly: true,
      steps: '腫脹・変形・皮下出血の有無を確認\n圧痛の部位と動かせる範囲を確認\n骨折疑い（変形・叩打痛・軸圧痛・荷重不能）があれば医療機関へ案内',
      purpose: '骨折・重度損傷の見極めを最優先にする',
    },
    {
      name: 'アイシング',
      kind: 'modality',
      minutes: icingMin,
      dose: '10〜15分（帰宅後も1日2〜3回）',
      steps: '氷のうをタオル1枚越しに患部へ\n感覚が鈍くなるまで（10〜15分）を目安に\n凍傷防止のため直接当てない',
      purpose: '急性炎症をしずめ、腫れと痛みの広がりを抑える',
      caution: '感覚障害がある部位には行わない',
    },
    {
      name: '固定・安静の指導',
      kind: 'education',
      minutes: fixMin,
      steps: '必要に応じて包帯・テーピングで固定\nできるだけ患部を心臓より高く保つ\n今日は温めない・飲酒しない・無理に動かさない',
      purpose: '炎症の拡大を防ぎ、回復の土台を作る',
    },
  ]
}

/**
 * ルールベースの基本メニュー生成。
 * AIが使えない場合のフォールバックであり、安全側（低刺激）の内容で構成する。
 * レッドフラッグ（発熱・排尿排便異常・受傷直後）は項目選定にも反映する。
 */
export function buildBasicMenu(input: OneDayInput): OneDayMenu {
  const budget = Math.max(10, Math.min(30, input.minutes))
  const warning = buildRedFlagWarning(input.flags, input.nrs)
  const jointLabel: Record<Joint, string> = {
    knee: '膝', shoulder: '肩', hip: '股関節', ankle: '足首',
    elbow: '肘', hand: '手・手首', spine: '腰・背中', other: '患部',
  }

  // ① 発熱・排尿排便異常：施術メニューは組まず、受診案内を優先する
  if (needsReferralFirst(input.flags)) {
    return {
      title: '本日は医療機関の受診案内を優先',
      summary: '受診を優先すべきサインがあるため、本日は施術を行わず、状態確認と受診のご案内を中心にした内容です。',
      redFlagWarning: warning,
      items: REFERRAL_FIRST_ITEMS,
      homeAdvice: [
        'できるだけ早く医療機関を受診してください。',
        '患部を温めない・揉まない・無理に動かさない。',
        '症状が急に強まる場合は、夜間でも救急受診を検討してください。',
      ],
      avoidToday: ['患部を温めること・飲酒・マッサージ', '痛みや症状を我慢しての運動'],
      source: 'basic',
    }
  }

  // ② 受傷直後：温熱・揉捏・ストレッチは行わず、評価と応急処置（RICE）にとどめる
  if (input.flags.includes('fresh_trauma')) {
    return {
      title: `${jointLabel[input.joint]}のケガ直後の応急対応`,
      summary: '受傷直後のため、状態の見極めとアイシング・固定を中心にした応急対応です。温熱・強い手技・ストレッチは行いません。',
      redFlagWarning: warning,
      items: buildAcuteTraumaItems(budget),
      homeAdvice: buildHomeAdvice(input),
      avoidToday: buildAvoidToday(input),
      source: 'basic',
    }
  }

  // ③ 通常経路
  const hasSwelling = input.symptoms.includes('swelling')
  // 夜間痛があるときは刺激に敏感な状態として扱い、負荷の高い運動（skip閾値8）を外す。
  // 等尺性運動（クアドセッティング等・閾値9）は低刺激のため残る
  const effectiveNrs = Math.max(input.nrs, input.flags.includes('night_pain') ? 8 : 0)

  // 候補を集める：共通導入 → （温熱 or アイシング）→ 関節別
  const candidates: CatalogItem[] = [COMMON_START]
  if (hasSwelling) {
    candidates.push(ICING)
  } else if (
    input.symptoms.includes('stiffness') ||
    input.symptoms.includes('rom_limit') ||
    input.symptoms.includes('heaviness')
  ) {
    candidates.push(HEAT)
  }
  candidates.push(...(JOINT_CATALOG[input.joint] ?? JOINT_CATALOG.other))

  // 症状に合う項目の優先度を上げ、状態に不向きな項目を外す
  const scored = candidates
    .filter(c => !(c.skipIfNrsAtLeast != null && effectiveNrs >= c.skipIfNrsAtLeast))
    // しびれがあるときは神経への負担を避けるためストレッチ系を外す
    .filter(c => !(input.flags.includes('numbness') && c.kind === 'stretch'))
    .map(c => ({
      ...c,
      score: c.priority - (c.boostFor?.some(s => input.symptoms.includes(s)) ? 2 : 0),
    }))
    .sort((a, b) => a.score - b.score)

  // 時間予算内で選ぶ（アイシングは締めに回すため、いったん別枠にして時間だけ確保する）
  const icingSelected = scored.find(c => c.name === ICING.name)
  const rest = scored.filter(c => c.name !== ICING.name)
  const picked: CatalogItem[] = []
  let used = icingSelected ? icingSelected.minutes : 0
  for (const item of rest) {
    if (used + item.minutes > budget) continue
    picked.push(item)
    used += item.minutes
  }
  // アイシングで締める（腫れがある場合）
  if (icingSelected) picked.push(icingSelected)

  const items: OneDayItem[] = picked.map(c => ({
    name: c.name,
    kind: c.kind,
    minutes: c.minutes,
    dose: c.dose,
    steps: c.steps,
    purpose: c.purpose,
    caution: c.caution,
  }))

  const symptomText = input.symptoms.map(s => SYMPTOM_LABELS[s]).join('・') || '症状'

  return {
    title: `${jointLabel[input.joint]}の${symptomText}をやわらげる本日のメニュー`,
    summary:
      effectiveNrs >= 7
        ? '痛みが強い日のため、刺激の少ない緩和中心の内容です。痛みを増やさないことを最優先にしてください。'
        : '本日の症状の緩和を目的とした単回メニューです。翌日に痛みや疲れが残らない範囲で行ってください。',
    redFlagWarning: warning,
    items,
    homeAdvice: buildHomeAdvice(input),
    avoidToday: buildAvoidToday(input),
    source: 'basic',
  }
}
