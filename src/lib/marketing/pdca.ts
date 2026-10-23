/**
 * 経営・集客の PDCA（施策ごとに 計画→実行→評価→改善 を回す）の型と計算（純粋関数のみ）
 *
 * P 計画 … 施策名・ねらい・仮説・目標の数字（指標・目標値）・期間・やること
 * D 実行 … やることのチェック、やったことの記録（日付つき）
 * C 評価 … 目標の指標を、期間中と「始める前の同じ日数」で自動で集計して比べる
 * A 改善 … 続ける／直す／やめる、学んだこと、次にやること（→ 次の施策の計画へ）
 *
 * 数字のもと（どれも個人を特定しない集計だけ）
 *   NOAH（毎晩の集計）… 売上・来院・自費の売上・1回あたり
 *   予約システム       … ネット予約・初めての方の予約（受付日で数える。キャンセルは除く）
 *   計測リンク         … 予約ボタンのクリック
 *   LINE               … 友だち追加
 *   手入力             … 口コミの数など、アプリで数えられないもの
 *
 * 型の import だけにしてあるので、node（22.18+）で .ts のまま単体テストできる。
 */
import type { NoahMonth } from './noah-types'
import type { BookingStatRow } from './booking-stats'

// ── 指標 ─────────────────────────────────────────────

export type MetricKey =
  | 'sales'
  | 'visits'
  | 'selfSales'
  | 'perVisit'
  | 'bookings'
  | 'newBookings'
  | 'clicks'
  | 'lineFollows'
  | 'manual'

export interface MetricDef {
  key: MetricKey
  label: string
  unit: '円' | '回' | '件' | '人'
  source: 'NOAH' | '予約システム' | '計測リンク' | 'LINE' | '手入力'
  /** 期間の合計で数える（false は平均：1回あたり） */
  sum: boolean
  /** 流入元・計測名で絞れる */
  filterable: boolean
  /** 院長だけが見る経営の数字 */
  money: boolean
}

export const METRICS: MetricDef[] = [
  { key: 'sales', label: '売上', unit: '円', source: 'NOAH', sum: true, filterable: false, money: true },
  { key: 'visits', label: '来院数', unit: '回', source: 'NOAH', sum: true, filterable: false, money: false },
  { key: 'selfSales', label: '自費・商品の売上', unit: '円', source: 'NOAH', sum: true, filterable: false, money: true },
  { key: 'perVisit', label: '1回あたりの金額', unit: '円', source: 'NOAH', sum: false, filterable: false, money: true },
  { key: 'bookings', label: 'ネット予約の数', unit: '件', source: '予約システム', sum: true, filterable: true, money: false },
  { key: 'newBookings', label: '初めての方の予約', unit: '件', source: '予約システム', sum: true, filterable: true, money: false },
  { key: 'clicks', label: '予約ボタンのクリック', unit: '回', source: '計測リンク', sum: true, filterable: true, money: false },
  { key: 'lineFollows', label: 'LINEの友だち追加', unit: '人', source: 'LINE', sum: true, filterable: false, money: false },
  { key: 'manual', label: '手で数える（口コミの数など）', unit: '件', source: '手入力', sum: true, filterable: false, money: false },
]

export const metricDef = (key: MetricKey): MetricDef => METRICS.find((m) => m.key === key) ?? METRICS[0]
export const isMetricKey = (v: unknown): v is MetricKey => typeof v === 'string' && METRICS.some((m) => m.key === v)

// ── 施策 ─────────────────────────────────────────────

export type PdcaStatus = 'doing' | 'review' | 'done'
export type Decision = 'continue' | 'adjust' | 'stop'

export const DECISION_LABELS: Record<Decision, string> = {
  continue: '続ける',
  adjust: '直して続ける',
  stop: 'やめる',
}

export interface PdcaAction {
  id: string
  text: string
  done: boolean
  doneAt?: string
}

export interface PdcaLog {
  id: string
  /** 'YYYY-MM-DD' */
  at: string
  text: string
}

export interface PdcaItem {
  id: string
  createdAt: string
  updatedAt: string
  status: PdcaStatus
  // P
  title: string
  /** ねらい（なぜやるか） */
  purpose: string
  /** 仮説（これをすると、こうなるはず） */
  hypothesis: string
  metric: MetricKey
  /** 予約・クリックを流入元・計測名で絞る（空なら全部） */
  filter?: { source?: string; campaign?: string }
  /** 目標値（合計の指標は期間中の合計。1回あたりは平均） */
  target: number
  /** 'YYYY-MM-DD'（両端を含む） */
  start: string
  end: string
  // D
  actions: PdcaAction[]
  logs: PdcaLog[]
  /** 手入力の指標の記録 */
  manual: Array<{ at: string; value: number }>
  // A
  review?: {
    decision: Decision
    learned: string
    next: string
    at: string
    /** 振り返ったときの数字（あとで数字が変わっても、そのときの判断が分かるように） */
    actual?: number
    baseline?: number | null
  }
  /** 相談の入口（AIで作ったか） */
  origin?: { concern: string; ai: boolean }
}

// ── 日付 ─────────────────────────────────────────────

const pad = (n: number) => String(n).padStart(2, '0')
const DAY_MS = 86_400_000

function toUtc(date: string): number {
  const [y, m, d] = date.split('-').map(Number)
  return Date.UTC(y, m - 1, d)
}

export function addDays(date: string, n: number): string {
  const t = new Date(toUtc(date) + n * DAY_MS)
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`
}

/** a から b までの日数（両端を含む）。b が a より前なら 0 */
export function daysBetween(a: string, b: string): number {
  return Math.max(0, Math.round((toUtc(b) - toUtc(a)) / DAY_MS) + 1)
}

export const isDate = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(toUtc(v))

/** ISO の日時を日本時間の日付に */
export function jstDate(iso: string): string {
  const t = new Date(new Date(iso).getTime() + 9 * 3_600_000)
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`
}

// ── 集計 ─────────────────────────────────────────────

export interface PdcaEvent {
  at: string
  kind: string
  meta: Record<string, string>
}

export interface PdcaData {
  noahMonths: NoahMonth[]
  bookings: BookingStatRow[] | null
  /** 予約システムから受け取れた最も古い受付日（これより前は数えられない） */
  bookingsSince?: string
  events: PdcaEvent[]
}

export interface Measure {
  value: number
  /** 数えられた日（NOAHの記録がある日など） */
  coveredDays: number
  /** 数字のもとが無い・期間の一部しか無いときの説明 */
  note?: string
}

/** NOAH の日別の行を、期間 [from, to] だけ足す */
function noahSum(months: NoahMonth[], from: string, to: string) {
  const t = { sales: 0, visits: 0, selfSales: 0, days: 0, lastDate: '' }
  for (const m of months) {
    for (const r of m.days) {
      const date = `${m.month}-${pad(r[0])}`
      if (date < from || date > to || date > m.asOf) continue
      t.days += 1
      t.sales += r[2] ?? 0
      t.visits += r[1] ?? 0
      t.selfSales += r[6] ?? 0
      if (date > t.lastDate) t.lastDate = date
    }
  }
  return t
}

const matches = (filter: PdcaItem['filter'], source?: string, campaign?: string) =>
  (!filter?.source || (source || 'direct') === filter.source) && (!filter?.campaign || (campaign ?? '') === filter.campaign)

/** 指標を期間 [from, to] で数える */
export function measure(item: Pick<PdcaItem, 'metric' | 'filter' | 'manual'>, from: string, to: string, data: PdcaData): Measure {
  const len = daysBetween(from, to)
  switch (item.metric) {
    case 'sales':
    case 'visits':
    case 'selfSales':
    case 'perVisit': {
      const t = noahSum(data.noahMonths, from, to)
      const value =
        item.metric === 'perVisit' ? (t.visits > 0 ? t.sales / t.visits : 0) : item.metric === 'visits' ? t.visits : item.metric === 'sales' ? t.sales : t.selfSales
      const note = t.days === 0 ? 'NOAHの集計がまだありません（毎晩届きます）' : undefined
      // NOAH は1日1行（休みの日も0の行がある）ので、行の数＝数えられた日
      return { value, coveredDays: Math.min(len, t.days), note }
    }
    case 'bookings':
    case 'newBookings': {
      if (!data.bookings) return { value: 0, coveredDays: 0, note: '予約システムの数字を受け取れませんでした' }
      const rows = data.bookings.filter(
        (b) =>
          b.received >= from &&
          b.received <= to &&
          b.status !== 'キャンセル' &&
          (item.metric === 'bookings' || b.visitType.startsWith('初')) &&
          matches(item.filter, b.source, b.campaign),
      )
      const partial = data.bookingsSince && data.bookingsSince > from
      return {
        value: rows.length,
        coveredDays: len,
        note: partial ? `予約システムの数字は ${data.bookingsSince} からの分だけです` : undefined,
      }
    }
    case 'clicks':
    case 'lineFollows': {
      const kind = item.metric === 'clicks' ? 'link_click' : 'line_follow'
      const n = data.events.filter((e) => {
        if (e.kind !== kind) return false
        const d = jstDate(e.at)
        if (d < from || d > to) return false
        return kind === 'line_follow' || ((e.meta.dest ?? '') === 'reserve' && matches(item.filter, e.meta.source, e.meta.campaign))
      }).length
      return { value: n, coveredDays: len }
    }
    case 'manual': {
      const v = (item.manual ?? []).filter((x) => x.at >= from && x.at <= to).reduce((s, x) => s + x.value, 0)
      return { value: v, coveredDays: len }
    }
  }
}

export interface CheckResult {
  /** 期間中（今日まで）の数字 */
  actual: number
  /** 始める前の同じ日数の数字（比べられないときは null） */
  baseline: number | null
  baselineRange: { from: string; to: string }
  /** 期間の全日数・経過した日数 */
  totalDays: number
  elapsedDays: number
  /** このままのペースだと期間の終わりに（合計の指標だけ。まだ始まっていない・終わっていれば actual） */
  projected: number
  /** 目標に対して（projected ÷ target） */
  progress: number
  /** 前の同じ日数と比べた増え方（projected ÷ baseline − 1）。比べられないときは null */
  change: number | null
  phase: 'before' | 'running' | 'ended'
  /** 期間中の数字がまだ1日分も無い（NOAHが届く前など）。このときは進み・比べを出さない */
  noData: boolean
  notes: string[]
}

/** C 評価：施策の数字を集計する（today は日本時間の 'YYYY-MM-DD'） */
export function check(item: PdcaItem, data: PdcaData, today: string): CheckResult {
  const def = metricDef(item.metric)
  const totalDays = daysBetween(item.start, item.end)
  const phase: CheckResult['phase'] = today < item.start ? 'before' : today > item.end ? 'ended' : 'running'
  const to = phase === 'ended' ? item.end : today
  const elapsedDays = phase === 'before' ? 0 : daysBetween(item.start, to)
  const cur: Measure = phase === 'before' ? { value: 0, coveredDays: 0 } : measure(item, item.start, to, data)
  const baselineRange = { from: addDays(item.start, -totalDays), to: addDays(item.start, -1) }
  const notes: string[] = []
  if (cur.note) notes.push(cur.note)

  // 前の同じ日数（手入力は前の記録が無いので比べない）
  let baseline: number | null = null
  if (item.metric !== 'manual') {
    const b = measure(item, baselineRange.from, baselineRange.to, data)
    const bookingsShort = (item.metric === 'bookings' || item.metric === 'newBookings') && data.bookingsSince && data.bookingsSince > baselineRange.from
    const noahShort = def.source === 'NOAH' && b.coveredDays < totalDays * 0.8
    if (bookingsShort || noahShort || b.note) {
      notes.push('始める前の数字がそろっていないので、前との比べは目安です')
    }
    baseline = b.note && b.coveredDays === 0 ? null : b.value
  }

  // NOAH は前の晩までの集計なので、数えられた日でペースを出す
  const counted = def.source === 'NOAH' ? cur.coveredDays : elapsedDays
  const noData = phase !== 'before' && def.source === 'NOAH' && cur.coveredDays === 0
  const projected =
    !def.sum || phase !== 'running' || counted <= 0 ? cur.value : (cur.value / counted) * totalDays
  const progress = noData || item.target <= 0 ? 0 : projected / item.target
  const change = !noData && baseline !== null && baseline > 0 ? projected / baseline - 1 : null
  if (!noData && def.source === 'NOAH' && phase === 'running' && counted < elapsedDays) {
    notes.push('NOAHの数字は前の晩までの分です')
  }
  return { actual: cur.value, baseline, baselineRange, totalDays, elapsedDays, projected, progress, change, phase, noData, notes }
}

/** 一覧での表示の段階（期間が終わったのに振り返っていなければ「振り返り」） */
export function effectiveStatus(item: PdcaItem, today: string): PdcaStatus {
  if (item.status === 'done') return 'done'
  if (item.status === 'review' || today > item.end) return 'review'
  return 'doing'
}

/** 集計に要る期間の最も古い日（前の同じ日数の始まり） */
export function earliestNeeded(items: PdcaItem[]): string | null {
  let min: string | null = null
  for (const it of items) {
    const from = addDays(it.start, -daysBetween(it.start, it.end))
    if (!min || from < min) min = from
  }
  return min
}

// ── ひな形（AIを使わずに計画を作るとき） ───────────────────

export interface PlanDraft {
  title: string
  purpose: string
  hypothesis: string
  metric: MetricKey
  filter?: { source?: string; campaign?: string }
  target: number
  days: number
  actions: string[]
  cautions: string[]
}

export interface Template {
  id: string
  label: string
  draft: (base: TemplateBase) => PlanDraft
}

/** ひな形で目標の数字を決めるための、いまの数字（30日あたり） */
export interface TemplateBase {
  visits30: number
  sales30: number
  selfSales30: number
  bookings30: number
  newBookings30: number
  clicks30: number
  follows30: number
  /** 先月来られて今月まだの方（NOAH） */
  gone: number | null
}

const up = (n: number, rate: number, min: number) => Math.max(min, Math.ceil(n * rate))

export const TEMPLATES: Template[] = [
  {
    id: 'comeback',
    label: '間があいた方に戻っていただく',
    draft: (b) => ({
      title: '間があいた方への声かけ',
      purpose: '治療の途中で間があいた方に、続けて通っていただく',
      hypothesis: '施術の途中で来なくなった方に、ていねいに様子をうかがう連絡をすると、来院が戻る',
      metric: 'visits',
      target: up(b.visits30, 1.05, 1),
      days: 30,
      actions: [
        '「今日」の「気にかけたい方」を毎朝見る',
        '「声かけ文」を使って、間があいた方へ連絡する（1日2〜3人）',
        '施術の終わりに、次回の予約をその場で一緒に決める',
      ],
      cautions: ['金品や割引で来院をさそわない', '連絡はていねいに。しつこくしない'],
    }),
  },
  {
    id: 'newcomers',
    label: '初めての方を増やす',
    draft: (b) => ({
      title: '初めての方の予約を増やす',
      purpose: '新しい方に院を知っていただき、ネット予約につなげる',
      hypothesis: 'Googleの投稿とInstagramを週2回ずつ続け、予約ボタンを分かりやすくすると、初めての方の予約が増える',
      metric: 'newBookings',
      target: up(b.newBookings30, 1.2, 3),
      days: 30,
      actions: [
        'Googleの投稿を週2回（予約ボタンは /yoyaku-net の計測つきリンク）',
        '毎週日曜に届くInstagramの下書きを確認して承認する',
        'Googleの口コミにお礼の返信をする（症状や来院の事実は書かない）',
      ],
      cautions: ['効果の保証・体験談・割引の強調はしない（広告ガイドライン）'],
    }),
  },
  {
    id: 'booking',
    label: 'ネット予約を増やす',
    draft: (b) => ({
      title: 'ネット予約に切り替えていただく',
      purpose: '電話の予約を減らし、24時間のネット予約を使っていただく',
      hypothesis: '院内のQRカードと会計時のひと声で、次回からネット予約を使う方が増える',
      metric: 'bookings',
      target: up(b.bookings30, 1.2, 5),
      days: 30,
      actions: ['受付と施術室にネット予約のQRカードを置く', '会計のときに「次回はネットでも予約できます」と伝える', 'LINEのメニューに予約ボタンを置く'],
      cautions: [],
    }),
  },
  {
    id: 'self',
    label: '自費メニューを知っていただく',
    draft: (b) => ({
      title: '自費メニューの説明を整える',
      purpose: '必要な方に、自費メニューの内容と料金をきちんと知っていただく',
      hypothesis: '内容と料金が分かる案内を用意し、必要な理由を説明すると、納得して選ぶ方が増える',
      metric: 'selfSales',
      target: up(b.selfSales30, 1.1, 10_000),
      days: 30,
      actions: ['自費メニューの内容と料金を1枚の案内にまとめる', '必要な方に、理由と料金を説明して同意をいただく（強くすすめない）', '説明した方の数を「やったこと」に記録する'],
      cautions: ['強くすすめない・同意をいただいてから', '保険の窓口負担を割り引かない'],
    }),
  },
  {
    id: 'line',
    label: 'LINEの友だちを増やす',
    draft: (b) => ({
      title: 'LINEの友だち追加を増やす',
      purpose: '来院された方とLINEでつながり、予約・相談をしやすくする',
      hypothesis: '会計時にQRを見せて案内すると、友だち追加が増える',
      metric: 'lineFollows',
      target: up(b.follows30, 1.3, 5),
      days: 30,
      actions: ['受付にLINEのQRを置く', '初めての方の会計時に、LINEで予約・相談ができることを伝える'],
      cautions: ['友だち追加のお礼に金品や割引をつけない'],
    }),
  },
  {
    id: 'reviews',
    label: 'Googleの口コミを増やす',
    draft: () => ({
      title: 'Googleの口コミをお願いする',
      purpose: '院の様子を知っていただく手がかりを増やす',
      hypothesis: '卒業のときに口コミのお願いカードを渡すと、口コミが増える',
      metric: 'manual',
      target: 5,
      days: 30,
      actions: ['口コミのお願いカード（QR）を用意する', '卒業の方にお願いする（無理にお願いしない）', '週に1回、口コミの数を数えて記録する'],
      cautions: ['口コミのお礼に金品や割引をつけない', '口コミを広告に使わない'],
    }),
  },
]

// ── 振り返りの下書き（AIを使わないとき。数字だけで決める） ────────────

export interface ConsultReviewResult {
  decision: Decision
  learned: string
  next: string
  nextConcern: string
  ai: boolean
  fallback?: string
}

/** 数字だけで決める振り返りの下書き（AIを使わないとき） */
export function ruleReview(item: PdcaItem, c: CheckResult): ConsultReviewResult {
  const def = metricDef(item.metric)
  if (c.noData) {
    return {
      decision: 'continue',
      learned: `${def.label}の数字がまだ集まっていないので、評価はこれから。`,
      next: 'やることを続け、数字が届いてからもう一度振り返る',
      nextConcern: `${item.title}の次の一手`,
      ai: false,
    }
  }
  const pct = Math.round(c.progress * 100)
  const change = c.change === null ? '' : `始める前の同じ日数より${c.change >= 0 ? '＋' : '−'}${Math.abs(Math.round(c.change * 100))}%`
  const done = item.actions.filter((a) => a.done).length
  const decision: Decision = c.progress >= 1 ? 'continue' : c.progress >= 0.6 || (c.change ?? 0) > 0 ? 'adjust' : 'stop'
  const learned = `${def.label}は目標の${pct}%${change ? `（${change}）` : ''}。やることは${item.actions.length}個のうち${done}個できた。`
  const next =
    decision === 'continue'
      ? '同じやり方を続け、目標を少し上げる'
      : decision === 'adjust'
        ? done < item.actions.length
          ? 'できなかったやることを、時間と担当を決めてやりきる'
          : 'やり方を1つ変えて、もう一度ためす'
        : '別の施策に切り替える'
  return { decision, learned, next, nextConcern: `${item.title}の次の一手`, ai: false }
}

