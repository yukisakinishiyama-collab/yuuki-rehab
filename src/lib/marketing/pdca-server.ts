/**
 * PDCA（施策）の保存・数字の集め方・AIへの相談（サーバー専用・院長のみのAPIから使う）
 *
 * 保存先：KV の keiei:pdca（施策の一覧。金額・件数などの数字と、院長が書いた文だけ）
 * AIに渡すのは院全体の集計の数字と、院長が書いた相談の文だけ。患者さんのお名前などは渡さない。
 * AIのキーが無い・失敗したときは、ひな形（pdca.ts の TEMPLATES）で計画を作る。
 */
import Anthropic from '@anthropic-ai/sdk'
import { z } from 'zod'
import { kvGet, kvSet } from './kv-store-server'
import { getNoahStore } from './noah-server'
import { fetchHubStatsFast } from './booking-stats-fast'
import { listEvents } from './analytics-store-server'
import { jstParts } from './autopilot-planner'
import { GENERATION_MODEL } from './generate-server'
import { findViolations } from './compliance'
import { SOURCE_LABELS } from './booking-stats'
import { baseline } from './goal-plan'
import {
  DECISION_LABELS,
  METRICS,
  PDCA_KV_KEY,
  TEMPLATES,
  addDays,
  check,
  earliestNeeded,
  isMetricKey,
  measure,
  metricDef,
  ruleReview,
  type CheckResult,
  type ConsultReviewResult,
  type PdcaData,
  type PdcaItem,
  type PlanDraft,
  type TemplateBase,
} from './pdca'

const KEY = PDCA_KV_KEY
const MAX_ITEMS = 100

interface Store {
  items: PdcaItem[]
}

export const todayJst = () => jstParts(new Date()).date

export async function listItems(): Promise<PdcaItem[]> {
  const store = (await kvGet<Store>(KEY)) ?? { items: [] }
  return Array.isArray(store.items) ? store.items : []
}

export async function saveItems(items: PdcaItem[]): Promise<void> {
  // 新しいものを先に、上限まで
  const sorted = [...items].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, MAX_ITEMS)
  await kvSet(KEY, { items: sorted } satisfies Store)
}

/** 集計に要る数字を集める（from より後の分） */
export async function loadData(from: string | null, today: string): Promise<PdcaData> {
  const start = from && from < today ? from : addDays(today, -30)
  // 予約システムは最大120日前まで。控えが効くよう 30日単位に切り上げる
  const back = Math.min(120, Math.ceil((Date.parse(today) - Date.parse(start)) / 86_400_000 / 30 + 0.0001) * 30)
  const [noah, stats, events] = await Promise.all([
    getNoahStore().catch(() => null),
    fetchHubStatsFast(back).catch(() => null),
    // 日本時間の0時（＝前の日の15時 UTC）から
    listEvents(new Date(Date.parse(`${start}T00:00:00+09:00`)).toISOString()).catch(() => []),
  ])
  return {
    noahMonths: noah?.months ?? [],
    bookings: stats?.bookings ?? null,
    bookingsSince: addDays(today, -back),
    events: events.map((e) => ({ at: e.at, kind: e.kind, meta: e.meta ?? {} })),
  }
}

export async function listWithChecks(): Promise<{ items: PdcaItem[]; checks: Record<string, CheckResult>; today: string }> {
  const today = todayJst()
  const items = await listItems()
  const data = await loadData(earliestNeeded(items), today)
  const checks: Record<string, CheckResult> = {}
  for (const it of items) checks[it.id] = check(it, data, today)
  return { items, checks, today }
}

// ── 入力の確認 ───────────────────────────────────────

const text = (max: number) => z.string().trim().max(max)
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
const filterSchema = z
  .object({ source: text(40).optional(), campaign: text(60).optional() })
  .optional()
  .transform((f) => (f && (f.source || f.campaign) ? { source: f.source || undefined, campaign: f.campaign || undefined } : undefined))

export const DraftSchema = z.object({
  title: text(60).min(1),
  purpose: text(400).default(''),
  hypothesis: text(400).default(''),
  metric: z.string().refine(isMetricKey, '指標が正しくありません'),
  filter: filterSchema,
  target: z.coerce.number().finite().min(0).max(1e9),
  start: date,
  end: date,
  actions: z.array(text(200)).max(12).default([]),
  origin: z.object({ concern: text(600), ai: z.boolean() }).optional(),
})

export const PatchSchema = z.object({
  title: text(60).min(1).optional(),
  purpose: text(400).optional(),
  hypothesis: text(400).optional(),
  metric: z.string().refine(isMetricKey).optional(),
  filter: filterSchema,
  target: z.coerce.number().finite().min(0).max(1e9).optional(),
  start: date.optional(),
  end: date.optional(),
  status: z.enum(['doing', 'review', 'done']).optional(),
  actions: z
    .array(z.object({ id: text(40).min(1), text: text(200), done: z.boolean(), doneAt: text(30).optional() }))
    .max(20)
    .optional(),
  logs: z.array(z.object({ id: text(40).min(1), at: date, text: text(400) })).max(200).optional(),
  manual: z.array(z.object({ at: date, value: z.coerce.number().finite().min(0).max(1e7) })).max(200).optional(),
  review: z
    .object({
      decision: z.enum(['continue', 'adjust', 'stop']),
      learned: text(800),
      next: text(800),
      at: text(30),
      actual: z.number().finite().optional(),
      baseline: z.number().finite().nullable().optional(),
    })
    .optional(),
})

export const newId = () => crypto.randomUUID().replace(/-/g, '').slice(0, 12)

// ── 相談のための数字（30日あたり） ─────────────────────────

export async function templateBase(today: string): Promise<{ base: TemplateBase; data: PdcaData }> {
  const from = addDays(today, -60)
  const data = await loadData(from, today)
  const last30 = { from: addDays(today, -30), to: addDays(today, -1) }
  const m = (metric: PdcaItem['metric']) => measure({ metric, manual: [] }, last30.from, last30.to, data)
  // NOAH は前の晩までなので、数えられた日で30日分にならす
  const scaled = (metric: PdcaItem['metric']) => {
    const r = m(metric)
    return r.coveredDays > 0 ? Math.round((r.value / r.coveredDays) * 30) : 0
  }
  const b = baseline(data.noahMonths)
  return {
    data,
    base: {
      visits30: scaled('visits'),
      sales30: scaled('sales'),
      selfSales30: scaled('selfSales'),
      bookings30: m('bookings').value,
      newBookings30: m('newBookings').value,
      clicks30: m('clicks').value,
      follows30: m('lineFollows').value,
      gone: b?.repeat && typeof b.repeat.gone === 'number' ? b.repeat.gone : null,
    },
  }
}

/** 相談の文から、近いひな形を選ぶ（AIを使わないとき） */
export function pickTemplate(concern: string): (typeof TEMPLATES)[number] {
  const s = concern
  const rules: Array<[RegExp, string]> = [
    [/口コミ|レビュー/, 'reviews'],
    [/LINE|ライン|友だち|友達/, 'line'],
    [/自費|単価|インソール|リハビリ.*自費|商品/, 'self'],
    [/ネット予約|予約.*(増|ふや)|電話.*予約/, 'booking'],
    [/新患|新規|初めて|はじめて|集客|Instagram|インスタ|Google|グーグル|投稿/, 'newcomers'],
    [/離脱|来なく|間があ|再来|継続|続け|戻/, 'comeback'],
  ]
  for (const [re, id] of rules) if (re.test(s)) return TEMPLATES.find((t) => t.id === id)!
  return TEMPLATES[0]
}

// ── AI ─────────────────────────────────────────────

const AiPlanSchema = z.object({
  title: z.string().min(1).max(80),
  purpose: z.string().max(600).default(''),
  hypothesis: z.string().max(600).default(''),
  metric: z.string(),
  filter: z.object({ source: z.string().optional(), campaign: z.string().optional() }).nullish(),
  target: z.coerce.number().finite().min(0),
  days: z.coerce.number().int().min(7).max(90),
  actions: z.array(z.string().max(300)).min(1).max(8),
  cautions: z.array(z.string().max(300)).default([]),
  reason: z.string().max(600).default(''),
})

const AiReviewSchema = z.object({
  decision: z.enum(['continue', 'adjust', 'stop']),
  learned: z.string().max(800),
  next: z.string().max(800),
  nextConcern: z.string().max(400).default(''),
})

export const aiAvailable = () => Boolean(process.env.ANTHROPIC_API_KEY) && process.env.MARKETING_MODE !== 'mock'

const SYSTEM = [
  'あなたは、山口県下関市の整骨院「ゆうき整骨院」（柔道整復の保険の施術と、スポーツのケガ・術後リハビリなどの自費の運動療法）の経営と集客の相談役です。',
  '院長と一緒に、1つの施策のPDCA（計画→実行→評価→改善）を考えます。院長は忙しいので、短く、具体的に、すぐ動ける形で答えます。',
  '守ること：',
  '- 医療広告ガイドライン・柔道整復師法の広告の決まりを守る。効果の保証・体験談・ビフォーアフター・割引の強調・他院との比較はしない。',
  '- 療養費（保険）の決まりを守る。窓口負担の割引、金品や紹介のお礼で患者さんをさそうことはしない。請求は施術のとおりに。',
  '- 自費は、必要な理由と料金を説明して同意をいただいてから。強くすすめない。',
  '- 患者さんの個人情報は扱わない（名前などは出さない）。',
  '- 数字は渡された院の集計だけを根拠にする。分からないことは分からないと書く。',
  '答えは指定のJSONだけを出す（前後に文を書かない）。',
].join('\n')

function numbersText(base: TemplateBase, extra: string[]): string {
  return [
    '院のいまの数字（直近30日。NOAHは前の晩までの集計を30日分にならしたもの）：',
    `- 来院 約${base.visits30}回／売上 約${base.sales30.toLocaleString('ja-JP')}円／自費・商品の売上 約${base.selfSales30.toLocaleString('ja-JP')}円`,
    `- ネット予約 ${base.bookings30}件（初めての方 ${base.newBookings30}件）／予約ボタンのクリック ${base.clicks30}回／LINEの友だち追加 ${base.follows30}人`,
    base.gone !== null ? `- 先月来られた方のうち、今月まだ来られていない方 ${base.gone}人` : '',
    ...extra,
  ]
    .filter(Boolean)
    .join('\n')
}

function metricsText(): string {
  return METRICS.map((m) => `${m.key}=${m.label}（${m.unit}・${m.source}${m.sum ? '・期間の合計' : '・期間の平均'}）`).join(' / ')
}

async function callAi(system: string, user: string): Promise<string> {
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const message = await anthropic.messages.create({
    model: GENERATION_MODEL,
    max_tokens: 1800,
    system,
    messages: [{ role: 'user', content: user }],
  })
  return message.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('')
}

const jsonOf = (t: string) => JSON.parse(t.slice(t.indexOf('{'), t.lastIndexOf('}') + 1))

/** 表現の注意（広告ガイドラインの言葉づかい）を cautions に足す */
function withCompliance(draft: PlanDraft): PlanDraft {
  const found = findViolations([draft.title, draft.purpose, draft.hypothesis, ...draft.actions].join('\n'))
  const notes = found.map((f) => `表現の注意：「${f.match}」は${f.reason}。${f.suggestion}`)
  return { ...draft, cautions: [...draft.cautions, ...notes] }
}

export interface ConsultPlanResult {
  draft: PlanDraft
  ai: boolean
  reason: string
  /** AIを使えなかった理由（ひな形で作ったとき） */
  fallback?: string
}

export async function consultPlan(input: {
  concern: string
  templateId?: string
  goal?: number
}): Promise<ConsultPlanResult> {
  const today = todayJst()
  const { base } = await templateBase(today)
  const template = input.templateId ? TEMPLATES.find((t) => t.id === input.templateId) : undefined
  if (template || !input.concern.trim()) {
    const t = template ?? pickTemplate(input.concern)
    return { draft: withCompliance(t.draft(base)), ai: false, reason: `ひな形「${t.label}」から作りました。数字はいまの30日分をもとにしています。` }
  }
  const fallback = (why: string): ConsultPlanResult => {
    const t = pickTemplate(input.concern)
    return {
      draft: withCompliance(t.draft(base)),
      ai: false,
      reason: `相談の内容に近いひな形「${t.label}」から作りました。`,
      fallback: why,
    }
  }
  if (!aiAvailable()) return fallback('AIの設定が無いため、ひな形で作りました')

  const items = await listItems()
  const running = items.filter((i) => i.status !== 'done').map((i) => `- ${i.title}（${metricDef(i.metric).label} 目標${i.target}）`)
  const learned = items
    .filter((i) => i.review)
    .slice(0, 5)
    .map((i) => `- ${i.title}：${DECISION_LABELS[i.review!.decision]}。学んだこと「${i.review!.learned.slice(0, 120)}」`)
  const user = [
    numbersText(base, [input.goal ? `- 月の売上の目標 ${input.goal.toLocaleString('ja-JP')}円` : '']),
    running.length ? `進行中の施策：\n${running.join('\n')}` : '進行中の施策：なし',
    learned.length ? `これまでの振り返り：\n${learned.join('\n')}` : '',
    `今日は ${today}。`,
    '',
    `院長の相談：「${input.concern.trim().slice(0, 600)}」`,
    '',
    'この相談に合う施策を1つ、PDCAの計画として作ってください。',
    `metric は次のどれか1つ（数字のもとがある指標を選ぶ）：${metricsText()}`,
    `filter.source を使うときは次の値：${Object.keys(SOURCE_LABELS).join(' / ')}`,
    'target は期間中の目標（合計の指標は期間の合計）。いまの数字から現実的に届く値にする（30日ならふつう＋5〜30%）。',
    'days は 14〜60。actions は3〜6個、だれが・いつ・何をするかが分かる短い文。院のアプリにある機能を使えるときは名前を出す（「今日」の「気にかけたい方」と「声かけ文」、Google投稿の予約ボタン（/yoyaku-net の計測つきリンク）、Instagramの自動下書き、口コミ返信、LINE導線、院内のQRカード）。',
    'JSON：{"title":string(30字以内),"purpose":string,"hypothesis":string,"metric":string,"filter"?:{"source"?:string,"campaign"?:string},"target":number,"days":number,"actions":string[],"cautions":string[],"reason":string(この指標と目標にした理由を2文で)}',
  ]
    .filter(Boolean)
    .join('\n')
  try {
    const parsed = AiPlanSchema.parse(jsonOf(await callAi(SYSTEM, user)))
    if (!isMetricKey(parsed.metric)) return fallback('AIの答えの指標が使えない値だったため、ひな形で作りました')
    const draft: PlanDraft = {
      title: parsed.title.slice(0, 60),
      purpose: parsed.purpose,
      hypothesis: parsed.hypothesis,
      metric: parsed.metric,
      filter: parsed.filter && metricDef(parsed.metric).filterable ? { source: parsed.filter.source, campaign: parsed.filter.campaign } : undefined,
      target: Math.max(1, Math.round(parsed.target)),
      days: parsed.days,
      actions: parsed.actions.map((a) => a.slice(0, 200)),
      cautions: parsed.cautions,
    }
    return { draft: withCompliance(draft), ai: true, reason: parsed.reason }
  } catch (error) {
    return fallback(`AIに相談できなかったため、ひな形で作りました（${error instanceof Error ? error.message.slice(0, 80) : '不明'}）`)
  }
}


export async function consultReview(item: PdcaItem, c: CheckResult): Promise<ConsultReviewResult> {
  if (!aiAvailable()) return { ...ruleReview(item, c), fallback: 'AIの設定が無いため、数字から下書きしました' }
  const def = metricDef(item.metric)
  const user = [
    `施策「${item.title}」の振り返りを手伝ってください。今日は ${todayJst()}。`,
    `ねらい：${item.purpose}`,
    `仮説：${item.hypothesis}`,
    `指標：${def.label}（${def.unit}）／目標 ${item.target}／期間 ${item.start}〜${item.end}（${c.totalDays}日、うち${c.elapsedDays}日たった）`,
    `結果：いま ${Math.round(c.actual)}、このペースだと ${Math.round(c.projected)}（目標の${Math.round(c.progress * 100)}%）`,
    c.baseline !== null ? `始める前の同じ日数：${Math.round(c.baseline)}` : '始める前の数字：なし',
    c.notes.length ? `数字の注意：${c.notes.join('／')}` : '',
    `やること：\n${item.actions.map((a) => `- [${a.done ? 'できた' : 'まだ'}] ${a.text}`).join('\n')}`,
    item.logs.length ? `やったことの記録（新しい順・最大10件）：\n${item.logs.slice(0, 10).map((l) => `- ${l.at} ${l.text.slice(0, 120)}`).join('\n')}` : 'やったことの記録：なし',
    '',
    'decision は continue（続ける）/ adjust（直して続ける）/ stop（やめる）のどれか。learned は数字から言えることと、うまくいった・いかなかった理由の見立て（3文以内）。next は次にやること（2文以内）。nextConcern は次の施策を相談するときの一文。',
    'JSON：{"decision":string,"learned":string,"next":string,"nextConcern":string}',
  ]
    .filter(Boolean)
    .join('\n')
  try {
    const parsed = AiReviewSchema.parse(jsonOf(await callAi(SYSTEM, user)))
    return { ...parsed, ai: true }
  } catch (error) {
    return { ...ruleReview(item, c), fallback: `AIに相談できなかったため、数字から下書きしました（${error instanceof Error ? error.message.slice(0, 80) : '不明'}）` }
  }
}
