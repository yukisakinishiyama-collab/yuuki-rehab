/**
 * 画面用の「予約システムの数字」（すぐ返す版。サーバー専用）
 *
 * 予約システム（GAS）は起動に毎回3〜5秒かかるため、画面を開くたびに取りに行くと遅い。
 * そこで、取ってきた数字の控えを KV に置き、画面ではまず控えを返す。
 *   - 控えが5分以内 … そのまま返す
 *   - 控えが6時間以内 … 控えを返し、画面に返したあとで取り直して控えを新しくする（次に開いたときは新しい数字）
 *   - 控えが無い・古すぎる … いままでどおり、その場で取りに行く
 * 毎晩のまとめ・自動投稿など、正確さが要る処理は fetchHubStats（いつもその場で取る）を使う。
 * 控えは個人を特定できない集計の数字だけ（booking-stats.ts のとおり）。
 */
import { after } from 'next/server'
import { fetchHubStats, type HubStats } from './booking-stats'
import { kvGet, kvSet } from './kv-store-server'

const FRESH_MS = 5 * 60 * 1000
const STALE_MS = 6 * 60 * 60 * 1000

interface Saved {
  at: number
  data: HubStats
}

// KV のキーは決まった頭（noah:）で始める（LINEの友だちの一覧と同じ表を使っているため）
const keyOf = (span: number) => `noah:hubstats-cache:${span}`

async function refresh(span: number): Promise<HubStats | null> {
  const data = await fetchHubStats(span)
  if (data) await kvSet(keyOf(span), { at: Date.now(), data } satisfies Saved)
  return data
}

/** force … 「最新にする」ボタンのときは控えを使わず、その場で取り直す */
export async function fetchHubStatsFast(days = 1, opts: { force?: boolean } = {}): Promise<HubStats | null> {
  const span = Math.min(Math.max(Math.floor(days), 1), 120)
  if (opts.force) return refresh(span)
  const saved = await kvGet<Saved>(keyOf(span)).catch(() => null)
  const age = saved && typeof saved.at === 'number' ? Date.now() - saved.at : Infinity
  if (saved && age < FRESH_MS) return saved.data
  if (saved && age < STALE_MS) {
    // 画面には控えをすぐ返し、取り直しは返したあとで
    after(async () => {
      await refresh(span).catch(() => null)
    })
    return saved.data
  }
  return refresh(span)
}
