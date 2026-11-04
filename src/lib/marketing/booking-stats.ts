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

/** 初めての方の次回予約（予約システムの中で数えた件数だけ。だれの予約かは受け取らない） */
export interface FollowupStats {
  /** 数え始めの日 'YYYY-MM-DD'（この日以降に来院した、初めての方の予約） */
  since: string
  /** 初めての来院から何日以内の次の予約を数えるか */
  windowDays: number
  /** 初めての方の予約（来院済み）の数 */
  firstVisits: number
  /** そのうち、次の予約が入ったものの数 */
  withNext: number
}

export interface HubStats {
  generatedAt: string
  bookings: BookingStatRow[]
  openings: OpeningDay[]
  /** 予約システムで選べる状態（「無断キャンセル」を記録できるか見る）。古い予約システムは返さない */
  statuses?: string[]
  followup?: FollowupStats
}

function readFollowup(value: unknown): FollowupStats | undefined {
  if (!value || typeof value !== 'object') return undefined
  const v = value as Record<string, unknown>
  const n = (x: unknown) => (typeof x === 'number' && Number.isFinite(x) && x >= 0 ? Math.floor(x) : null)
  const firstVisits = n(v.firstVisits)
  const withNext = n(v.withNext)
  const windowDays = n(v.windowDays)
  const since = typeof v.since === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v.since) ? v.since : null
  if (firstVisits === null || withNext === null || windowDays === null || !since || withNext > firstVisits) return undefined
  return { since, windowDays, firstVisits, withNext }
}

// 流入元の表示名は画面（ブラウザ）からも使うので、別のファイルに置く
export { SOURCE_LABELS, sourceLabel } from './booking-stats-labels'

/** 同じ日数の問い合わせは5分間使い回す（予約システムの起動待ちで画面が遅くならないように） */
const CACHE_MS = 5 * 60 * 1000
const cache = new Map<number, { at: number; data: HubStats }>()

/** fresh … 控え（5分）を使わず、その場で取り直す（キャンセルの直後・ストーリーを出す直前など、いまの空きが要るとき） */
export async function fetchHubStats(days = 30, opts: { fresh?: boolean } = {}): Promise<HubStats | null> {
  const secret = process.env.RESERVATION_NOTIFY_SECRET
  if (!secret || process.env.MARKETING_MODE === 'mock') return null
  const span = Math.min(Math.max(Math.floor(days), 1), 120)
  const hit = cache.get(span)
  if (!opts.fresh && hit && Date.now() - hit.at < CACHE_MS) return hit.data
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
      statuses: Array.isArray(data.statuses) ? data.statuses.map(String).slice(0, 20) : undefined,
      followup: readFollowup(data.followup),
    }
    cache.set(span, { at: Date.now(), data: result })
    return result
  } catch {
    return null
  }
}
