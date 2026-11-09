/**
 * ホームページの閲覧数・電話タップ（日別の件数だけを KV に保存する）
 *
 * キー: hpstat:YYYY-MM-DD（日本時間の日付）。値: HpDayStats（ページごとの件数）
 * 計測イベント（analytics:日付）とは分けて保存する。外から送られる数字なので、
 * いたずらで大量に送られても、予約ボタンや LINE の記録が押し出されないようにするため。
 */
import { kvGet, kvList, kvSet } from './kv-store-server'
import { addHpEvent, sumHpDays, type HpDayStats, type HpEventKind } from './hp-measure'

const KEY = (day: string) => `hpstat:${day}`

/** 日本時間の日付（YYYY-MM-DD） */
export function jstDay(now: Date = new Date()): string {
  return new Date(now.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10)
}

export async function recordHpEvent(kind: HpEventKind, page: string, place?: string, now: Date = new Date()) {
  try {
    const day = jstDay(now)
    const current = await kvGet<HpDayStats>(KEY(day))
    await kvSet(KEY(day), addHpEvent(current, kind, page, place))
  } catch (error) {
    console.error('ホームページの計測の記録に失敗:', error instanceof Error ? error.message : error)
  }
}

/** sinceDay（日本時間の日付）から今日までの合計。読めなかったら null */
export async function sumHpStats(sinceDay: string): Promise<{ total: HpDayStats; days: number; firstDay: string | null } | null> {
  try {
    const rows = await kvList<HpDayStats>('hpstat:')
    const picked = rows.filter((r) => r.key.slice('hpstat:'.length) >= sinceDay)
    const firstDay = rows.map((r) => r.key.slice('hpstat:'.length)).sort()[0] ?? null
    return { total: sumHpDays(picked.map((r) => r.value)), days: picked.length, firstDay }
  } catch {
    return null
  }
}
