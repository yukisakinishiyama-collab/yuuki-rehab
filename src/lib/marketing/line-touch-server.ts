/**
 * 患者さんの LINE へ「いつ・何を」送ったかの記録と、ブロックの数え方（サーバー専用）
 *
 * 2026-11-26 院長「次に公式lineをブロックしにくい設計に」。決まりは lib/line-block-guard.ts。
 * - 送った記録は KV の `mkt:touch:<印>`（印＝LINE の ID のハッシュ。生の ID・お名前・本文は残さない）。TOUCH_KEEP_DAYS 日・TOUCH_KEEP_MAX 件まで
 * - 一斉配信の記録は `mkt:line-broadcasts`（日時だけ）
 * - ブロックされたとき（Webhook の unfollow）に、直前に届いていたものの種類と「どのくらい前か」だけを計測に残す
 * - 友だちの数・ブロックの数は、LINE の集計（Insight API。前の日までの数）から
 * 記録に失敗しても、送ること自体は止めない
 */
import { kvGet, kvSet } from './kv-store-server'
import { lineMark } from './consent-store-server'
import { listEvents } from './analytics-store-server'
import {
  BROADCAST_MAX_PER_30_DAYS,
  BROADCAST_MIN_GAP_DAYS,
  TOUCH_KEEP_DAYS,
  TOUCH_KEEP_MAX,
  attributeBlock,
  broadcastProblem,
  summarizeBlocks,
  type Touch,
  type TouchKind,
} from '@/lib/line-block-guard'

const touchKey = (userId: string) => `mkt:touch:${lineMark(userId)}`
const BROADCAST_KEY = 'mkt:line-broadcasts'

/** その LINE へ送った記録を足す（送れたあとに呼ぶ） */
export async function noteLinePush(userId: string, kind: TouchKind, now = new Date()): Promise<void> {
  try {
    const since = now.getTime() - TOUCH_KEEP_DAYS * 86_400_000
    const list = ((await kvGet<Touch[]>(touchKey(userId))) ?? []).filter((t) => t && Date.parse(t.at) >= since)
    list.push({ at: now.toISOString(), kind })
    await kvSet(touchKey(userId), list.slice(-TOUCH_KEEP_MAX))
  } catch (error) {
    console.error('LINE を送った記録に失敗:', error instanceof Error ? error.message : error)
  }
}

export async function listTouches(userId: string): Promise<Touch[]> {
  return (await kvGet<Touch[]>(touchKey(userId)).catch(() => null)) ?? []
}

/** 一斉配信した日時（新しい順・50件まで） */
export async function broadcastLog(): Promise<string[]> {
  return (await kvGet<string[]>(BROADCAST_KEY).catch(() => null)) ?? []
}

export async function noteBroadcast(now = new Date()): Promise<void> {
  try {
    await kvSet(BROADCAST_KEY, [now.toISOString(), ...(await broadcastLog())].slice(0, 50))
  } catch (error) {
    console.error('一斉配信の記録に失敗:', error instanceof Error ? error.message : error)
  }
}

/** いま一斉配信してよいか（だめなら理由。記録を読めないときは通す＝今までどおり） */
export async function checkBroadcastAllowed(now = new Date()): Promise<string | null> {
  return broadcastProblem(await broadcastLog(), now)
}

/** ブロックされたとき：直前に届いていたものの種類と、どのくらい前か（お名前・ID は入らない） */
export async function blockAttribution(userId: string, now = new Date()): Promise<{ last: string; within: string }> {
  try {
    const [touches, broadcasts] = await Promise.all([listTouches(userId), broadcastLog()])
    return attributeBlock(touches, broadcasts[0], now)
  } catch {
    return { last: 'none', within: 'none' }
  }
}

export interface FollowerInsight {
  /** 集計の日（YYYYMMDD） */
  date: string
  followers: number
  blocks: number
  /** いま届く友だち（ブロックしていない方） */
  reach: number
}

/** LINE の集計（友だちの数・ブロックの数。前の日までの数。まだ出ていない日は、もう1日前を見る） */
export async function fetchFollowerInsight(now = new Date()): Promise<FollowerInsight | null> {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN
  if (!token) return null
  const base = (process.env.LINE_API_BASE_URL ?? 'https://api.line.me').replace(/\/$/, '')
  for (const back of [1, 2, 3]) {
    const date = new Date(now.getTime() + 9 * 3_600_000 - back * 86_400_000).toISOString().slice(0, 10).replace(/-/g, '')
    try {
      const res = await fetch(`${base}/v2/bot/insight/followers?date=${date}`, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store', signal: AbortSignal.timeout(10_000) })
      if (!res.ok) return null
      const d = (await res.json()) as { status?: string; followers?: number; blocks?: number; targetedReaches?: number }
      if (d.status === 'ready' && typeof d.followers === 'number' && typeof d.blocks === 'number') {
        return { date, followers: d.followers, blocks: d.blocks, reach: Math.max(0, d.followers - d.blocks) }
      }
      if (d.status === 'out_of_service') return null
    } catch {
      return null
    }
  }
  return null
}

/** 自動化設定の画面に出す、ブロックの状況（数だけ） */
export async function blockStats(now = new Date()) {
  const since = new Date(now.getTime() - 30 * 86_400_000).toISOString()
  const [insight, events, broadcasts] = await Promise.all([
    fetchFollowerInsight(now),
    listEvents(since).catch(() => []),
    broadcastLog(),
  ])
  const blocks = events.filter((e) => e.kind === 'line_unfollow')
  const recentBroadcasts = broadcasts.filter((at) => now.getTime() - Date.parse(at) < 30 * 86_400_000)
  return {
    insight,
    last30: summarizeBlocks(blocks),
    broadcasts: {
      last30: recentBroadcasts.length,
      lastAt: broadcasts[0] ?? null,
      limit: BROADCAST_MAX_PER_30_DAYS,
      gapDays: BROADCAST_MIN_GAP_DAYS,
      blockedNow: broadcastProblem(broadcasts, now),
    },
  }
}
