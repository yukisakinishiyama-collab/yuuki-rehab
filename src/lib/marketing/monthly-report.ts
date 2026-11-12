/**
 * 月次レポート（前月比・前年同月比）の計算（純粋関数。画面とテストから使う）
 *
 * NOAH の月ごとの集計（NoahMonth）と、NOAH以外の収入（keiei:extra）から、
 * 1つの月の数字と、比べる月（前月・前年同月）との差を出す。
 * 途中の月（asOf が月末より前）は「その日までの合計」で比べる（比べる月も同じ日数で切る）。
 */
import type { NoahMonth } from './noah-types'

// テスト（node で .ts を直接読む）から使えるよう、ここでは型だけを import し、小さな日付の関数は持つ
const pad = (n: number) => String(n).padStart(2, '0')

export function daysInMonth(month: string): number {
  const [y, m] = month.split('-').map(Number)
  return new Date(Date.UTC(y, m, 0)).getUTCDate()
}

export function prevMonthOf(month: string): string {
  const [y, m] = month.split('-').map(Number)
  return m === 1 ? `${y - 1}-12` : `${y}-${pad(m - 1)}`
}

interface DayPoint {
  day: number
  visits: number
  sales: number
  ins: [number, number]
  self: [number, number]
  nonIns: [number, number]
  acc: [number, number]
  work: [number, number]
}

function monthPoints(m: NoahMonth): DayPoint[] {
  return m.days.map((r) => ({ day: r[0], visits: r[1], sales: r[2], ins: [r[3], r[4]], self: [r[5], r[6]], nonIns: [r[7], r[8]], acc: [r[9], r[10]], work: [r[11], r[12]] }))
}

export interface MonthTotals {
  month: string
  /** 集計の最終日（途中の月はその日まで） */
  asOf: string
  /** この集計は月末までか */
  complete: boolean
  /** 比べるために切った日（1〜この日まで）。月末まで＝daysInMonth */
  throughDay: number
  visits: number
  sales: number
  openDays: number
  /** 保険など（保険＋労災＋保険外）・自費と商品・交通事故 */
  insV: number
  insS: number
  selfV: number
  selfS: number
  accV: number
  accS: number
  /** NOAH以外の収入（サブスクなど。月単位。途中の月は入っている分だけ） */
  outside: number
  /** 来院1回あたりの金額（NOAHのみ） */
  perVisit: number
  /** 1診療日あたりの来院 */
  perDay: number
  /** 自費・商品の割合（NOAHの金額のうち） */
  selfRatio: number
  newPt: number | null
  reinit: number | null
  /** 先月来られて今月まだの方（離反） */
  gone: number | null
}

export interface ExtraMonthLike {
  month: string
  subscription: number
  cashless: number
  overlap: number
}

export interface Delta {
  now: number
  before: number | null
  diff: number | null
  /** 変化率（before が 0 のときは null） */
  rate: number | null
}

export type MetricKey = 'visits' | 'sales' | 'total' | 'outside' | 'openDays' | 'perDay' | 'perVisit' | 'selfS' | 'selfRatio' | 'insS' | 'accS' | 'newPt' | 'reinit' | 'gone'

export interface MetricDef {
  key: MetricKey
  label: string
  unit: '人' | '円' | '日' | '%' | '回'
  /** 増えると良い（true）／減ると良い（false）／どちらでもない（null） */
  goodUp: boolean | null
  /** 小数で出す */
  decimals?: number
}

export const METRIC_DEFS: MetricDef[] = [
  { key: 'total', label: '売上（合計）', unit: '円', goodUp: true },
  { key: 'sales', label: '売上（NOAH）', unit: '円', goodUp: true },
  { key: 'outside', label: 'NOAH以外の収入', unit: '円', goodUp: true },
  { key: 'visits', label: '来院（延べ）', unit: '回', goodUp: true },
  { key: 'openDays', label: '診療日', unit: '日', goodUp: null },
  { key: 'perDay', label: '1日あたりの来院', unit: '人', goodUp: true, decimals: 1 },
  { key: 'perVisit', label: '来院1回あたりの金額', unit: '円', goodUp: true },
  { key: 'selfS', label: '自費・商品の売上', unit: '円', goodUp: true },
  { key: 'selfRatio', label: '自費の割合', unit: '%', goodUp: null, decimals: 1 },
  { key: 'insS', label: '保険などの売上', unit: '円', goodUp: true },
  { key: 'accS', label: '交通事故の売上', unit: '円', goodUp: null },
  { key: 'newPt', label: '新患', unit: '人', goodUp: true },
  { key: 'reinit', label: '再初検', unit: '人', goodUp: true },
  { key: 'gone', label: '先月来てまだの方', unit: '人', goodUp: false },
]

export function lastYearOf(month: string): string {
  return `${Number(month.slice(0, 4)) - 1}${month.slice(4)}`
}

function sumPoints(points: DayPoint[]) {
  const t = { visits: 0, sales: 0, openDays: 0, insV: 0, insS: 0, selfV: 0, selfS: 0, accV: 0, accS: 0 }
  for (const p of points) {
    t.visits += p.visits
    t.sales += p.sales
    t.insV += p.ins[0] + p.work[0] + p.nonIns[0]
    t.insS += p.ins[1] + p.work[1] + p.nonIns[1]
    t.selfV += p.self[0]
    t.selfS += p.self[1]
    t.accV += p.acc[0]
    t.accS += p.acc[1]
    if (p.visits > 0) t.openDays += 1
  }
  return t
}

const outsideOf = (e: ExtraMonthLike | undefined): number => (e ? Math.max(0, e.subscription + e.cashless - e.overlap) : 0)

/** 1つの月の数字。throughDay を渡すと、その日までで切る（比べる月に使う） */
export function monthTotals(m: NoahMonth, extra: ExtraMonthLike | undefined, throughDay?: number): MonthTotals {
  const dim = daysInMonth(m.month)
  const asOfDay = Number(m.asOf.slice(8, 10))
  const complete = asOfDay >= dim
  const cut = Math.min(throughDay ?? (complete ? dim : asOfDay), dim)
  const points = monthPoints(m).filter((p) => p.day <= cut)
  const t = sumPoints(points)
  const outside = cut >= dim ? outsideOf(extra) : outsideOf(extra) // 月単位の値しか無いので、途中でもそのまま
  return {
    month: m.month,
    asOf: m.asOf,
    complete,
    throughDay: cut,
    ...t,
    outside,
    perVisit: t.visits > 0 ? t.sales / t.visits : 0,
    perDay: t.openDays > 0 ? t.visits / t.openDays : 0,
    selfRatio: t.sales > 0 ? (t.selfS / t.sales) * 100 : 0,
    newPt: m.repeat?.newPt ?? null,
    reinit: m.repeat?.reinit ?? null,
    gone: m.repeat?.gone ?? null,
  }
}

export function metricValue(t: MonthTotals, key: MetricKey): number | null {
  if (key === 'total') return t.sales + t.outside
  return t[key]
}

export function delta(now: number | null, before: number | null): Delta {
  const n = now ?? 0
  if (before === null || now === null) return { now: n, before, diff: null, rate: null }
  return { now: n, before, diff: n - before, rate: before !== 0 ? (n - before) / before : null }
}

export interface ReportRow {
  def: MetricDef
  now: number | null
  prev: Delta
  lastYear: Delta
}

export interface MonthlyReport {
  current: MonthTotals
  prevMonth: MonthTotals | null
  lastYear: MonthTotals | null
  rows: ReportRow[]
  /** 直近13か月の並び（新しい月が先） */
  trend: MonthTotals[]
  /** ひとことのまとめ（規則で作る） */
  summary: string[]
}

export function findMonth(months: NoahMonth[], month: string): NoahMonth | undefined {
  return months.find((m) => m.month === month)
}

/** 月次レポートを作る。month を省くと、いちばん新しい月 */
export function buildReport(months: NoahMonth[], extras: Record<string, ExtraMonthLike>, month?: string): MonthlyReport | null {
  const sorted = [...months].sort((a, b) => b.month.localeCompare(a.month))
  const target = month ? findMonth(sorted, month) : sorted[0]
  if (!target) return null
  const current = monthTotals(target, extras[target.month])
  // 途中の月は、比べる月も同じ日までで切る
  const cut = current.complete ? undefined : current.throughDay
  const pm = findMonth(sorted, prevMonthOf(target.month))
  const ly = findMonth(sorted, lastYearOf(target.month))
  const prevMonth = pm ? monthTotals(pm, extras[pm.month], cut) : null
  const lastYear = ly ? monthTotals(ly, extras[ly.month], cut) : null
  const rows: ReportRow[] = METRIC_DEFS.map((def) => {
    const now = metricValue(current, def.key)
    return {
      def,
      now,
      prev: delta(now, prevMonth ? metricValue(prevMonth, def.key) : null),
      lastYear: delta(now, lastYear ? metricValue(lastYear, def.key) : null),
    }
  })
  const trend = sorted.filter((m) => m.month <= target.month).slice(0, 13).map((m) => monthTotals(m, extras[m.month]))
  return { current, prevMonth, lastYear, rows, trend, summary: summaryLines(current, rows) }
}

const yen = (n: number) => `${Math.round(n).toLocaleString('ja-JP')}円`

export function formatValue(def: MetricDef, v: number | null): string {
  if (v === null) return '—'
  if (def.unit === '円') return yen(v)
  if (def.unit === '%') return `${v.toFixed(def.decimals ?? 0)}%`
  const s = def.decimals ? v.toFixed(def.decimals) : String(Math.round(v))
  return `${s}${def.unit}`
}

export function formatRate(d: Delta): string {
  if (d.rate === null) return d.diff === null ? '—' : d.diff > 0 ? '+（前は0）' : '±0'
  const p = Math.round(d.rate * 100)
  return `${p > 0 ? '+' : ''}${p}%`
}

/** 変化の表示。割合（%）の指標は率ではなく差（ポイント）で出す */
export function formatChange(def: MetricDef, d: Delta): string {
  if (def.unit === '%') {
    if (d.diff === null) return '—'
    return `${d.diff > 0 ? '+' : ''}${d.diff.toFixed(1)}pt`
  }
  return formatRate(d)
}

/** 良い変化か（色づけ用）。null＝色なし */
export function tone(def: MetricDef, d: Delta): 'good' | 'bad' | null {
  if (d.diff === null || d.diff === 0 || def.goodUp === null) return null
  const up = d.diff > 0
  return up === def.goodUp ? 'good' : 'bad'
}

function summaryLines(t: MonthTotals, rows: ReportRow[]): string[] {
  const out: string[] = []
  const get = (k: MetricKey) => rows.find((r) => r.def.key === k)!
  const total = get('total')
  const scope = t.complete ? '' : `（${t.throughDay}日まで。比べる月も同じ日までで）`
  if (total.prev.rate !== null) {
    out.push(`売上（合計）は前月比 ${formatRate(total.prev)}${total.lastYear.rate !== null ? `、前年同月比 ${formatRate(total.lastYear)}` : ''}${scope}`)
  }
  const v = get('visits')
  const pv = get('perVisit')
  if (v.prev.rate !== null && pv.prev.rate !== null) {
    const which = Math.abs(v.prev.rate) >= Math.abs(pv.prev.rate) ? '来院の数' : '来院1回あたりの金額'
    out.push(`売上の変化は、おもに「${which}」の変化によるもの（来院 ${formatRate(v.prev)}、1回あたり ${formatRate(pv.prev)}）`)
  }
  const sr = get('selfRatio')
  if (sr.now !== null) out.push(`自費・商品の割合は ${sr.now.toFixed(1)}%${sr.prev.diff !== null ? `（前月 ${sr.prev.before!.toFixed(1)}%）` : ''}`)
  const np = get('newPt')
  if (np.now !== null) out.push(`新患 ${np.now}人・再初検 ${get('reinit').now ?? '—'}人${np.prev.diff !== null ? `（前月 新患 ${np.prev.before}人）` : ''}`)
  const g = get('gone')
  if (g.now !== null) out.push(`先月来られて今月まだの方 ${g.now}人${g.prev.diff !== null ? `（前月 ${g.prev.before}人）` : ''}`)
  return out
}

/** LINEやメモに貼れる文（数字だけ。個人情報なし） */
export function reportText(r: MonthlyReport): string {
  const ym = (m: string) => `${Number(m.slice(0, 4))}年${Number(m.slice(5, 7))}月`
  const lines = [`【${ym(r.current.month)} 月次レポート${r.current.complete ? '' : `（${r.current.throughDay}日まで）`}】`]
  for (const row of r.rows) {
    if (row.now === null) continue
    lines.push(`${row.def.label}: ${formatValue(row.def, row.now)}（前月 ${formatChange(row.def, row.prev)}／前年 ${formatChange(row.def, row.lastYear)}）`)
  }
  lines.push('', ...r.summary.map((s) => `・${s}`))
  return lines.join('\n')
}
