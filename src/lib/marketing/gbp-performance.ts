/**
 * Googleビジネスプロフィールの成果（Business Profile Performance API）の読み方（純粋な関数）
 *
 * - 日ごとの数字：検索・マップでの表示、電話、ルート、ウェブサイト、予約（2〜3日遅れで入る）
 * - 月ごとの「検索された言葉」と表示回数（少ない言葉は「15未満」のように幅でしか返らない）
 * - Google検索向けの投稿（gbp-seo-posts.ts）で狙っている言葉に当たっているかの印
 * 画面・サーバーの両方から使う。node で単体テストできる（tools/test-gbp-seo.mjs）。
 */
import { GBP_SEO_POSTS, type GbpSeoPost } from '../../data/gbp-seo-posts'

export const GBP_DAILY_METRICS = [
  'BUSINESS_IMPRESSIONS_MOBILE_SEARCH',
  'BUSINESS_IMPRESSIONS_DESKTOP_SEARCH',
  'BUSINESS_IMPRESSIONS_MOBILE_MAPS',
  'BUSINESS_IMPRESSIONS_DESKTOP_MAPS',
  'CALL_CLICKS',
  'BUSINESS_DIRECTION_REQUESTS',
  'WEBSITE_CLICKS',
  'BUSINESS_BOOKINGS',
] as const
export type GbpDailyMetric = (typeof GBP_DAILY_METRICS)[number]
export type GbpTotals = Record<GbpDailyMetric, number>

export const GBP_METRIC_LABELS: Record<GbpDailyMetric, string> = {
  BUSINESS_IMPRESSIONS_MOBILE_SEARCH: 'スマホの検索で表示',
  BUSINESS_IMPRESSIONS_DESKTOP_SEARCH: 'パソコンの検索で表示',
  BUSINESS_IMPRESSIONS_MOBILE_MAPS: 'スマホのマップで表示',
  BUSINESS_IMPRESSIONS_DESKTOP_MAPS: 'パソコンのマップで表示',
  CALL_CLICKS: '電話のタップ',
  BUSINESS_DIRECTION_REQUESTS: 'ルートの検索',
  WEBSITE_CLICKS: 'ウェブサイトへ',
  BUSINESS_BOOKINGS: 'Googleからの予約',
}

export function emptyTotals(): GbpTotals {
  return Object.fromEntries(GBP_DAILY_METRICS.map((m) => [m, 0])) as GbpTotals
}

/** 表示回数の合計（検索・マップ × スマホ・パソコン） */
export function impressionsOf(t: GbpTotals): number {
  return (
    t.BUSINESS_IMPRESSIONS_MOBILE_SEARCH +
    t.BUSINESS_IMPRESSIONS_DESKTOP_SEARCH +
    t.BUSINESS_IMPRESSIONS_MOBILE_MAPS +
    t.BUSINESS_IMPRESSIONS_DESKTOP_MAPS
  )
}

const pad = (n: number) => String(n).padStart(2, '0')

function addDaysYmd(ymd: string, days: number): string {
  const d = new Date(`${ymd}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

/**
 * 集計する期間。Google の数字は2〜3日遅れて入るので、終わりは今日の3日前。
 * 直近28日と、その前の28日（くらべる用）。検索された言葉は、終わった月（先月と先々月）
 */
export function performanceRanges(today: string) {
  const end = addDaysYmd(today, -3)
  const start = addDaysYmd(end, -27)
  const prevEnd = addDaysYmd(start, -1)
  const prevStart = addDaysYmd(prevEnd, -27)
  const [y, m] = today.split('-').map(Number)
  const lastMonth = m === 1 ? `${y - 1}-12` : `${y}-${pad(m - 1)}`
  const [ly, lm] = lastMonth.split('-').map(Number)
  const monthBefore = lm === 1 ? `${ly - 1}-12` : `${ly}-${pad(lm - 1)}`
  return { current: { start, end }, previous: { start: prevStart, end: prevEnd }, lastMonth, monthBefore }
}

type DatedValue = { date?: { year?: number; month?: number; day?: number }; value?: string }
type DailyResponse = {
  multiDailyMetricTimeSeries?: Array<{
    dailyMetricTimeSeries?: Array<{ dailyMetric?: string; timeSeries?: { datedValues?: DatedValue[] } }>
  }>
}

/** fetchMultiDailyMetricsTimeSeries の答えを、期間ごとの合計にする（値の無い日は 0） */
export function sumDaily(json: DailyResponse, range: { start: string; end: string }): GbpTotals {
  const totals = emptyTotals()
  for (const group of json.multiDailyMetricTimeSeries ?? []) {
    for (const series of group.dailyMetricTimeSeries ?? []) {
      const metric = series.dailyMetric as GbpDailyMetric
      if (!(GBP_DAILY_METRICS as readonly string[]).includes(metric)) continue
      for (const dv of series.timeSeries?.datedValues ?? []) {
        const d = dv.date
        if (!d?.year || !d.month || !d.day) continue
        const ymd = `${d.year}-${pad(d.month)}-${pad(d.day)}`
        if (ymd < range.start || ymd > range.end) continue
        const v = Number(dv.value ?? 0)
        if (Number.isFinite(v)) totals[metric] += v
      }
    }
  }
  return totals
}

export interface GbpKeyword {
  keyword: string
  /** 表示回数（少ないときは null で、threshold 未満） */
  value: number | null
  threshold: number | null
  /** Google検索向けの投稿で狙っている言葉なら、その投稿の見出し */
  target: string | null
}

type KeywordResponse = {
  searchKeywordsCounts?: Array<{ searchKeyword?: string; insightsValue?: { value?: string; threshold?: string } }>
}

/** 狙っている言葉（投稿の検索ワードから、地域・一般的な言葉を除いたもの） */
const GENERIC = new Set(['下関', '下関市', '彦島', '整骨院', '接骨院', 'リハビリ', '相談', '痛み', '術後', '平日20時', '駐車場'])

/** 検索でよく使われる別の書き方（投稿の id ごと） */
const VARIANTS: Record<string, string[]> = {
  'ankle-sprain': ['ねんざ'],
  acl: ['前十字'],
  osgood: ['オスグット'],
  severs: ['シーバー', 'セーバー', 'かかと'],
  baseball: ['野球ひじ', '投球'],
  strain: ['肉ばなれ'],
  jiko: ['むち打ち', '鞭打ち', '事故'],
  gikkuri: ['ぎっくり', '腰痛'],
  plantar: ['足底腱膜', '足の裏'],
  achilles: ['アキレス'],
  hip: ['股関節'],
  groin: ['グロイン', '鼠径'],
  shin: ['すねの痛み'],
}

export function targetTerms(posts: GbpSeoPost[] = GBP_SEO_POSTS): Array<{ term: string; title: string }> {
  const out: Array<{ term: string; title: string }> = []
  const add = (term: string, title: string) => {
    if (term && !GENERIC.has(term) && !out.some((t) => t.term === term)) out.push({ term, title })
  }
  for (const p of posts) {
    for (const term of p.keyword.split(/\s+/)) add(term, p.title)
    for (const term of VARIANTS[p.id] ?? []) add(term, p.title)
  }
  return out
}

export function matchTarget(keyword: string, terms = targetTerms()): string | null {
  const k = keyword.normalize('NFKC').toLowerCase()
  const hit = terms.find((t) => k.includes(t.term.normalize('NFKC').toLowerCase()))
  return hit?.title ?? null
}

/** 月ごとの「検索された言葉」を、多い順に（幅でしか返らない言葉は後ろ） */
export function parseKeywords(json: KeywordResponse, terms = targetTerms()): GbpKeyword[] {
  const rows: GbpKeyword[] = []
  for (const row of json.searchKeywordsCounts ?? []) {
    const keyword = (row.searchKeyword ?? '').trim()
    if (!keyword) continue
    const value = row.insightsValue?.value !== undefined ? Number(row.insightsValue.value) : null
    const threshold = row.insightsValue?.threshold !== undefined ? Number(row.insightsValue.threshold) : null
    rows.push({ keyword, value: Number.isFinite(value) ? value : null, threshold: Number.isFinite(threshold) ? threshold : null, target: matchTarget(keyword, terms) })
  }
  return rows.sort((a, b) => (b.value ?? -1) - (a.value ?? -1) || (b.threshold ?? 0) - (a.threshold ?? 0) || a.keyword.localeCompare(b.keyword, 'ja'))
}

export interface GbpPerformance {
  connected: boolean
  /** 読めなかった理由（院長に見せる言葉） */
  error?: string
  current?: { start: string; end: string; totals: GbpTotals }
  previous?: { start: string; end: string; totals: GbpTotals }
  keywords?: { month: string; items: GbpKeyword[] } | null
  keywordsBefore?: { month: string; items: GbpKeyword[] } | null
  fetchedAt?: string
}
