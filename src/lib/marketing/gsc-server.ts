/**
 * Search Console を読む（サーバー専用）。「Googleとつなぐ」で webmasters.readonly も許可されているときだけ。
 * 読んだ結果は KV の gbp:gsc に6時間とっておく。
 */
import { kvGet, kvSet } from './kv-store-server'
import { googleAccessTokenFor } from './gbp-token'
import { GSC_SCOPE } from './gbp-oauth-server'
import { jstParts } from './autopilot-planner'
import { gscRanges, gscTotals, parseGscRows, pickGscSite, withPrevious, type GscReport } from './gsc'

const CACHE_KEY = 'gbp:gsc'
const FRESH_MS = 6 * 60 * 60 * 1000
const BASE = 'https://searchconsole.googleapis.com/webmasters/v3'

async function call(url: string, token: string, body?: unknown): Promise<unknown> {
  const res = await fetch(url, {
    method: body ? 'POST' : 'GET',
    headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
    cache: 'no-store',
    signal: AbortSignal.timeout(15000),
  })
  const data = (await res.json().catch(() => ({}))) as { error?: { message?: string; status?: string } }
  if (!res.ok) {
    const msg = data.error?.message ?? `HTTP ${res.status}`
    if (res.status === 403 && /has not been used|is disabled|SERVICE_DISABLED/i.test(msg)) {
      throw new Error('Google Cloud（yuuki-marketing）で「Google Search Console API」を有効にしてください。')
    }
    if (res.status === 403 || res.status === 401) {
      throw new Error('Search Console を読む許可がありません。「Googleとつなぐ」をもう一度押し、Search Console の項目にもチェックを入れてください。')
    }
    throw new Error(`Search Console を読めませんでした（${msg.slice(0, 160)}）`)
  }
  return data
}

export async function getSearchConsole(force = false, now = new Date()): Promise<GscReport> {
  if (!force) {
    const cached = await kvGet<GscReport>(CACHE_KEY).catch(() => null)
    if (cached?.fetchedAt && Date.now() - new Date(cached.fetchedAt).getTime() < FRESH_MS) return cached
  }
  let result: GscReport
  try {
    const token = await googleAccessTokenFor(GSC_SCOPE)
    if (!token) return { connected: false }
    const sites = (await call(`${BASE}/sites`, token)) as { siteEntry?: Array<{ siteUrl?: string; permissionLevel?: string }> }
    const siteUrl = pickGscSite(sites.siteEntry ?? [])
    if (!siteUrl) {
      result = { connected: true, error: 'Search Console に shimonoseki-yuuki.com のプロパティが見つかりませんでした（つないだGoogleアカウントで確認済みのものだけ読めます）。', fetchedAt: new Date().toISOString() }
    } else {
      const r = gscRanges(jstParts(now).date)
      const q = (range: { start: string; end: string }, dimensions: string[], rowLimit: number) =>
        call(`${BASE}/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`, token, {
          startDate: range.start,
          endDate: range.end,
          dimensions,
          rowLimit,
          dataState: 'final',
        }) as Promise<Parameters<typeof parseGscRows>[0]>
      const [curTotal, prevTotal, curQ, prevQ, pages] = await Promise.all([
        q(r.current, [], 1),
        q(r.previous, [], 1),
        q(r.current, ['query'], 100),
        q(r.previous, ['query'], 250),
        q(r.current, ['page'], 10),
      ])
      result = {
        connected: true,
        siteUrl,
        current: { ...r.current, totals: gscTotals(curTotal) },
        previous: { ...r.previous, totals: gscTotals(prevTotal) },
        queries: withPrevious(parseGscRows(curQ), parseGscRows(prevQ)),
        pages: parseGscRows(pages),
        fetchedAt: new Date().toISOString(),
      }
    }
  } catch (error) {
    result = { connected: true, error: error instanceof Error ? error.message : '不明', fetchedAt: new Date(Date.now() - FRESH_MS + 30 * 60 * 1000).toISOString() }
  }
  await kvSet(CACHE_KEY, result).catch(() => undefined)
  return result
}
