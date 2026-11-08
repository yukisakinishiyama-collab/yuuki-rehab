/**
 * 氏名から次の予約を探す（純粋な関数。画面は components/clinic/NextReservationCard.tsx）
 *
 * 予約システムのフィード（/api/yoyaku/feed）から、氏名・フリガナ・電話番号に
 * 入力した文字を含む今後の予約を、日付・時刻の順に返す。キャンセル済みは除く。
 */
import { digitsOnly, normalizeName, toDateKey, type YoyakuFeed, type YoyakuFeedRow } from '@/lib/yoyaku-cancel-sync'

export interface ReservationHit {
  date: string
  time: string
  name: string
  kana: string
  kubun: string
  status: string
  visitType: string
  staff: string
  memo: string
  reservationNo: string
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土']

/** 「11/12（木）」の形 */
export function dateLabelJa(date: string): string {
  if (!DATE_RE.test(date)) return date
  const d = new Date(`${date}T00:00:00`)
  return `${Number(date.slice(5, 7))}/${Number(date.slice(8, 10))}（${WEEKDAYS[d.getDay()]}）`
}

/** 今日から何日後か（今日=0） */
export function daysFromToday(date: string, today: string): number {
  return Math.round((Date.parse(`${date}T00:00:00`) - Date.parse(`${today}T00:00:00`)) / 86_400_000)
}

/** カタカナ→ひらがな（入力がひらがなでもフリガナに当たるように） */
function toHiragana(s: string): string {
  return s.replace(/[ァ-ヶ]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 0x60))
}

function rowMatches(row: YoyakuFeedRow, query: string): boolean {
  const q = normalizeName(query)
  if (!q) return false
  const qDigits = digitsOnly(q)
  if (qDigits.length >= 4 && qDigits === q) return digitsOnly(row.phone).includes(qDigits)
  const qKana = toHiragana(q)
  return normalizeName(row.name).includes(q) || toHiragana(normalizeName(row.kana)).includes(qKana)
}

export function findReservations(feed: YoyakuFeed | null | undefined, query: string, today: string): ReservationHit[] {
  if (!feed?.ok || !feed.days || !normalizeName(query)) return []
  const out: ReservationHit[] = []
  for (const day of feed.days) {
    const date = toDateKey(day.date)
    if (!DATE_RE.test(date) || date < today) continue
    for (const row of day.rows) {
      if (/キャンセル|取消/.test(String(row.status || ''))) continue
      if (!rowMatches(row, query)) continue
      const r = row as YoyakuFeedRow & { staff?: string }
      out.push({
        date,
        time: String(row.time || '').slice(0, 5),
        name: String(row.name || ''),
        kana: String(row.kana || ''),
        kubun: String(row.kubun || ''),
        status: String(row.status || ''),
        visitType: String(row.visitType || ''),
        staff: String(r.staff || ''),
        memo: String(row.memo || ''),
        reservationNo: String(row.reservationNo || ''),
      })
    }
  }
  return out.sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time))
}
