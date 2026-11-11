/**
 * Googleビジネスプロフィールの成果を読む（サーバー専用。Business Profile Performance API）
 *
 * 「Googleとつなぐ」で保存した接続（投稿と同じ。権限は business.manage）を使う。
 * 読んだ結果は KV の gbp:perf に6時間とっておく（画面を開くたびに Google へ問い合わせない）。
 * Google Cloud で「Business Profile Performance API」が有効になっていないと 403 になるので、その旨を返す。
 */
import { kvGet, kvSet } from './kv-store-server'
import { gbpAccessToken, getGbpCredentials } from './gbp-token'
import { jstParts } from './autopilot-planner'
import { GBP_DAILY_METRICS, parseKeywords, performanceRanges, sumDaily, type GbpPerformance } from './gbp-performance'

const CACHE_KEY = 'gbp:perf'
const FRESH_MS = 6 * 60 * 60 * 1000
const BASE = 'https://businessprofileperformance.googleapis.com/v1'

function ymdQuery(prefix: string, ymd: string): string[] {
  const [y, m, d] = ymd.split('-').map(Number)
  return [`${prefix}.year=${y}`, `${prefix}.month=${m}`, `${prefix}.day=${d}`]
}

async function getJson(url: string, token: string): Promise<unknown> {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store', signal: AbortSignal.timeout(15000) })
  const data = (await res.json().catch(() => ({}))) as { error?: { message?: string; status?: string } }
  if (!res.ok) {
    const msg = data.error?.message ?? `HTTP ${res.status}`
    if (res.status === 403 && /has not been used|is disabled|SERVICE_DISABLED/i.test(msg + (data.error?.status ?? ''))) {
      throw new Error('Google Cloud（yuuki-marketing）で「Business Profile Performance API」を有効にすると、ここに数字が出ます。')
    }
    throw new Error(`Googleの数字を読めませんでした（${msg.slice(0, 160)}）`)
  }
  return data
}

async function keywordsFor(location: string, month: string, token: string) {
  const [y, m] = month.split('-').map(Number)
  const qs = [
    `monthlyRange.startMonth.year=${y}`,
    `monthlyRange.startMonth.month=${m}`,
    `monthlyRange.endMonth.year=${y}`,
    `monthlyRange.endMonth.month=${m}`,
    'pageSize=100',
  ].join('&')
  const json = await getJson(`${BASE}/${location}/searchkeywords/impressions/monthly?${qs}`, token)
  return { month, items: parseKeywords(json as Parameters<typeof parseKeywords>[0]) }
}

export async function getGbpPerformance(force = false, now = new Date()): Promise<GbpPerformance> {
  if (!force) {
    const cached = await kvGet<GbpPerformance>(CACHE_KEY).catch(() => null)
    if (cached?.fetchedAt && Date.now() - new Date(cached.fetchedAt).getTime() < FRESH_MS) return cached
  }
  const credentials = await getGbpCredentials()
  if (!credentials) return { connected: false }
  // 'accounts/1/locations/2' → 'locations/2'
  const location = credentials.location.replace(/^accounts\/\d+\//, '')
  const ranges = performanceRanges(jstParts(now).date)
  let result: GbpPerformance
  try {
    const token = await gbpAccessToken(credentials)
    const qs = [
      ...GBP_DAILY_METRICS.map((m) => `dailyMetrics=${m}`),
      ...ymdQuery('dailyRange.startDate', ranges.previous.start),
      ...ymdQuery('dailyRange.endDate', ranges.current.end),
    ].join('&')
    const daily = (await getJson(`${BASE}/${location}:fetchMultiDailyMetricsTimeSeries?${qs}`, token)) as Parameters<typeof sumDaily>[0]
    result = {
      connected: true,
      current: { ...ranges.current, totals: sumDaily(daily, ranges.current) },
      previous: { ...ranges.previous, totals: sumDaily(daily, ranges.previous) },
      keywords: await keywordsFor(location, ranges.lastMonth, token).catch(() => null),
      keywordsBefore: await keywordsFor(location, ranges.monthBefore, token).catch(() => null),
      fetchedAt: new Date().toISOString(),
    }
  } catch (error) {
    // 失敗は30分だけとっておく（すぐにやり直せるように）
    result = { connected: true, error: error instanceof Error ? error.message : '不明', fetchedAt: new Date(Date.now() - FRESH_MS + 30 * 60 * 1000).toISOString() }
  }
  await kvSet(CACHE_KEY, result).catch(() => undefined)
  return result
}
