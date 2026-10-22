/**
 * Instagramのフォロワー数の記録（サーバー専用）
 *
 * - Instagram連携（INSTAGRAM_ACCESS_TOKEN）後は、定期実行が1日1回 followers_count を自動で記録する
 * - 連携前でも、効果測定画面から院長が数字を手で記録できる（週1回など）
 * 保存先: KV 'ig:followers'（日付ごとに1件・新しい日付で上書き）
 */
import { kvGet, kvSet } from './kv-store-server'

export interface FollowerPoint {
  /** 'YYYY-MM-DD'（日本時間） */
  date: string
  followers: number
  source: 'api' | 'manual'
}

const KEY = 'ig:followers'
const KEEP = 800

export async function listFollowerPoints(): Promise<FollowerPoint[]> {
  const rows = (await kvGet<FollowerPoint[]>(KEY)) ?? []
  return [...rows].sort((a, b) => a.date.localeCompare(b.date))
}

export async function addFollowerPoint(point: FollowerPoint): Promise<FollowerPoint[]> {
  const rows = (await listFollowerPoints()).filter((p) => p.date !== point.date)
  rows.push(point)
  rows.sort((a, b) => a.date.localeCompare(b.date))
  const kept = rows.slice(-KEEP)
  await kvSet(KEY, kept)
  return kept
}

/** 連携済みなら、その日の分を1回だけAPIから記録する */
export async function recordInstagramFollowers(today: string): Promise<FollowerPoint | null> {
  if (process.env.MARKETING_MODE === 'mock' || !process.env.INSTAGRAM_ACCESS_TOKEN) return null
  const rows = await listFollowerPoints()
  if (rows.some((p) => p.date === today && p.source === 'api')) return null

  const { getInstagramToken, INSTAGRAM_GRAPH_HOST } = await import('./instagram-token')
  const token = await getInstagramToken()
  if (!token) return null
  const res = await fetch(`${INSTAGRAM_GRAPH_HOST}/v21.0/me?fields=followers_count&access_token=${encodeURIComponent(token)}`, {
    cache: 'no-store',
    signal: AbortSignal.timeout(8000),
  })
  const data = (await res.json().catch(() => ({}))) as { followers_count?: number }
  if (!res.ok || typeof data.followers_count !== 'number') return null
  const point: FollowerPoint = { date: today, followers: data.followers_count, source: 'api' }
  await addFollowerPoint(point)
  return point
}

/** 最新の数字と、7日前・30日前（に近い記録）からの増減 */
export function summarize(points: FollowerPoint[]) {
  if (points.length === 0) return null
  const latest = points[points.length - 1]
  const before = (days: number) => {
    const [y, m, d] = latest.date.split('-').map(Number)
    const t = new Date(Date.UTC(y, m - 1, d - days)).toISOString().slice(0, 10)
    const older = points.filter((p) => p.date <= t)
    return older.length ? older[older.length - 1] : null
  }
  const w = before(7)
  const mth = before(30)
  return {
    latest,
    change7: w ? latest.followers - w.followers : null,
    change30: mth ? latest.followers - mth.followers : null,
  }
}

/** 院長への週1のお知らせに添える1行（記録がなければ null） */
export async function followerSummary(): Promise<string | null> {
  const s = summarize(await listFollowerPoints())
  if (!s) return null
  const sign = (n: number) => (n > 0 ? `+${n}` : `${n}`)
  const change = s.change7 !== null ? `（7日前より ${sign(s.change7)}）` : ''
  return `📈 Instagramフォロワー ${s.latest.followers.toLocaleString('ja-JP')}人${change}`
}
