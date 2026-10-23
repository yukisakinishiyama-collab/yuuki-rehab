/**
 * 予約システム（GAS）から集計用の数字だけを受け取る（サーバー専用）
 *
 *   ?api=hubstats&ts=<ミリ秒>&sig=<HMAC-SHA256>&days=<日数>
 *
 * - 氏名・電話番号など個人を特定できる項目は受け取らない（流入元・日付・初診/再診・状態・空き枠数のみ）
 * - 署名は予約通知と同じ共有シークレット（Vercel: RESERVATION_NOTIFY_SECRET ＝ GAS: PATIENT_NOTIFY_SECRET）で
 *   「hubstats:<ts>」に付ける。シークレット自体はURLに載せない。GAS側は5分以内の署名だけ受け付ける
 * - 予約システムが未更新（このAPIが無い）・未設定のときは null を返し、呼び出し側は表示を省く
 */
import { createHmac } from 'node:crypto'
import { RESERVE_URL } from './clinic'
import type { OpeningDay } from './autopilot-planner'

export interface BookingStatRow {
  /** 受付日 'YYYY-MM-DD' */
  received: string
  /** 予約日 'YYYY-MM-DD' */
  date: string
  /** 流入元（instagram / google_post / google_profile / line / website / direct / staff など） */
  source: string
  campaign: string
  /** 初めて / 2回目以降 / ''（院側の登録） */
  visitType: string
  status: string
}

export interface HubStats {
  generatedAt: string
  bookings: BookingStatRow[]
  openings: OpeningDay[]
}

// 流入元の表示名は画面（ブラウザ）からも使うので、別のファイルに置く
export { SOURCE_LABELS, sourceLabel } from './booking-stats-labels'

/** 同じ日数の問い合わせは5分間使い回す（予約システムの起動待ちで画面が遅くならないように） */
const CACHE_MS = 5 * 60 * 1000
const cache = new Map<number, { at: number; data: HubStats }>()

export async function fetchHubStats(days = 30): Promise<HubStats | null> {
  const secret = process.env.RESERVATION_NOTIFY_SECRET
  if (!secret || process.env.MARKETING_MODE === 'mock') return null
  const span = Math.min(Math.max(Math.floor(days), 1), 120)
  const hit = cache.get(span)
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.data
  const ts = String(Date.now())
  const sig = createHmac('sha256', secret).update(`hubstats:${ts}`).digest('hex')
  try {
    const res = await fetch(`${RESERVE_URL}?api=hubstats&ts=${ts}&sig=${sig}&days=${span}`, {
      redirect: 'follow',
      cache: 'no-store',
      signal: AbortSignal.timeout(20_000),
    })
    const data = (await res.json().catch(() => null)) as (HubStats & { ok?: boolean }) | null
    if (!data || data.ok !== true || !Array.isArray(data.bookings)) return null
    const result: HubStats = {
      generatedAt: String(data.generatedAt ?? ''),
      bookings: data.bookings,
      openings: Array.isArray(data.openings) ? data.openings : [],
    }
    cache.set(span, { at: Date.now(), data: result })
    return result
  } catch {
    return null
  }
}
