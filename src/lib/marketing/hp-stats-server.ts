/**
 * ホームページの閲覧数・電話タップ（日別の件数だけを KV に保存する）
 *
 * キー: hpstat:YYYY-MM-DD（日本時間の日付）。値: HpDayStats（ページごとの件数）
 * 計測イベント（analytics:日付）とは分けて保存する。外から送られる数字なので、
 * いたずらで大量に送られても、予約ボタンや LINE の記録が押し出されないようにするため。
 */
import { kvGet, kvList, kvSet } from './kv-store-server'
import { addHpEvent, sumHpDays, type HpDayStats, type HpEventKind, type HpSource } from './hp-measure'

const KEY = (day: string) => `hpstat:${day}`

/** 日本時間の日付（YYYY-MM-DD） */
export function jstDay(now: Date = new Date()): string {
  return new Date(now.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10)
}

/** place=電話の置き場所（電話タップのとき）、source=来たところ（外から入ってきた最初のページの閲覧のとき） */
export async function recordHpEvent(
  kind: HpEventKind,
  page: string,
  opts: { place?: string; source?: HpSource | null } = {},
  now: Date = new Date(),
) {
  try {
    const day = jstDay(now)
    const current = await kvGet<HpDayStats>(KEY(day))
    await kvSet(KEY(day), addHpEvent(current, kind, page, opts.place, opts.source))
  } catch (error) {
    console.error('ホームページの計測の記録に失敗:', error instanceof Error ? error.message : error)
  }
}

/**
 * sinceDay（日本時間の日付）から今日までの合計。読めなかったら null。
 * firstDay=記録の最初の日、firstSourceDay=入口（どこから来たか）の記録の最初の日（まだ無ければ null）
 */
export async function sumHpStats(sinceDay: string): Promise<{
  total: Required<HpDayStats>
  days: number
  firstDay: string | null
  firstSourceDay: string | null
} | null> {
  try {
    const rows = await kvList<HpDayStats>('hpstat:')
    const dayOf = (key: string) => key.slice('hpstat:'.length)
    const picked = rows.filter((r) => dayOf(r.key) >= sinceDay)
    const firstDay = rows.map((r) => dayOf(r.key)).sort()[0] ?? null
    const firstSourceDay =
      rows
        .filter((r) => Object.keys(r.value?.s ?? {}).length > 0)
        .map((r) => dayOf(r.key))
        .sort()[0] ?? null
    return { total: sumHpDays(picked.map((r) => r.value)), days: picked.length, firstDay, firstSourceDay }
  } catch {
    return null
  }
}
