/**
 * NOAH の来院者日報の、1日の合計の保存（サーバー専用。院長だけの API から使う）
 *
 * KV の `keiei:noah-daily`＝{ days: { 'YYYY-MM-DD': NoahDailySheet } }。新しい日から 400 日分まで。
 * 同じ日を入れ直したら置きかえる。保存するのは数字だけ（lib/marketing/noah-daily.ts の cleanSheet）。
 */
import { kvGet, kvSet } from './kv-store-server'
import { cleanSheet, type NoahDailySheet } from './noah-daily'

const KEY = 'keiei:noah-daily'
export const NOAH_DAILY_KEEP_DAYS = 400

interface Store {
  days: Record<string, NoahDailySheet>
}

async function load(): Promise<Store> {
  const s = await kvGet<Store>(KEY)
  return s && typeof s === 'object' && s.days && typeof s.days === 'object' ? s : { days: {} }
}

export async function getNoahDaily(date: string): Promise<NoahDailySheet | null> {
  return (await load()).days[date] ?? null
}

/** その月に入っている日（日付の順） */
export async function listNoahDailyMonth(month: string): Promise<NoahDailySheet[]> {
  const { days } = await load()
  return Object.keys(days)
    .filter((d) => d.startsWith(`${month}-`))
    .sort()
    .map((d) => days[d])
}

export async function saveNoahDaily(sheets: NoahDailySheet[], now = new Date()): Promise<string[]> {
  const store = await load()
  const at = now.toISOString()
  for (const s of sheets) store.days[s.date] = cleanSheet(s, at)
  const keep = Object.keys(store.days).sort().reverse().slice(0, NOAH_DAILY_KEEP_DAYS)
  const days: Record<string, NoahDailySheet> = {}
  for (const d of keep) days[d] = store.days[d]
  await kvSet(KEY, { days })
  return sheets.map((s) => s.date)
}
