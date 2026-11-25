/**
 * 公式LINEの「予約確認」への返事（サーバー専用。決まりと文は lib/reservation-check.ts）
 *
 * LINE の Webhook（/api/marketing/line/webhook）から呼ぶ。
 * 1. その LINE と結びついた連携（カルテの QR・入力での連携）を探す
 * 2. 予約システム（v3.30〜）から、これからの確定の予約を署名つきで取る（?api=upcoming。読むだけ）
 * 3. その LINE に届く予約だけを選んで、返事の文を作る（ほかの方の予約は出さない）
 * お名前・予約の中身は記録に残さない（数だけ）。止めるときは LINE_RESERVATION_CHECK=off
 */
import { createHmac } from 'crypto'
import { kvGet, kvList } from './kv-store-server'
import { DEFAULT_CLINIC_PROFILE, LIFF_RESERVE_URL, RESERVE_URL } from './clinic'
import { listLineLinks } from '@/lib/line-link-server'
import type { LineLink } from '@/lib/line-link'
import type { MatchKarte } from '@/lib/line-link-match'
import { unsealUserId } from '@/lib/liff-ticket'
import { reservationChangeUrl } from '@/lib/reservation-change-link'
import { pickReservationsForLine, reservationCheckText, type CheckReply, type UpcomingRow } from '@/lib/reservation-check'

/** 何日先までの予約を返すか */
export const RESERVATION_CHECK_DAYS = 90

export const reservationCheckEnabled = (): boolean => process.env.LINE_RESERVATION_CHECK !== 'off'

interface Upcoming {
  today: string
  now: string
  rows: UpcomingRow[]
}

/** 予約システムから、これからの確定の予約を取る（署名は hubstats・patientno と同じ作り）。取れなければ null */
export async function fetchUpcomingReservations(now = new Date()): Promise<Upcoming | null> {
  const secret = process.env.RESERVATION_NOTIFY_SECRET
  if (!secret) return null
  const ts = String(now.getTime())
  const sig = createHmac('sha256', secret).update(`upcoming:${ts}`).digest('hex')
  try {
    const res = await fetch(`${RESERVE_URL}?api=upcoming&ts=${ts}&sig=${sig}&days=${RESERVATION_CHECK_DAYS}`, {
      redirect: 'follow',
      cache: 'no-store',
      signal: AbortSignal.timeout(20_000),
    })
    const data = (await res.json().catch(() => null)) as { ok?: boolean; today?: string; now?: string; rows?: unknown } | null
    if (!data?.ok || !Array.isArray(data.rows) || !/^\d{4}-\d{2}-\d{2}$/.test(String(data.today ?? ''))) return null
    const rows = (data.rows as Array<Record<string, unknown>>)
      .filter((r) => r && typeof r === 'object')
      .slice(0, 2000)
      .map((r) => ({
        no: String(r.no ?? ''),
        date: String(r.date ?? ''),
        time: String(r.time ?? ''),
        name: String(r.name ?? ''),
        phone: String(r.phone ?? ''),
        lineKey: String(r.lineKey ?? ''),
      }))
    return { today: String(data.today), now: /^\d{2}:\d{2}$/.test(String(data.now ?? '')) ? String(data.now) : '00:00', rows }
  } catch {
    return null
  }
}

/** クラウドのカルテ（お名前・電話・生年月日・ID だけを使う） */
async function cloudKartes(): Promise<MatchKarte[]> {
  try {
    const record = await kvGet<{ payload?: Record<string, string> }>('sync:clinic')
    const raw = record?.payload?.pt_patients
    return raw ? (JSON.parse(raw) as MatchKarte[]) : []
  } catch {
    return []
  }
}

/** 「予約確認」と送ってきた LINE への返事の中身（お名前・予約は、その LINE に届く分だけ） */
export async function resolveReservationCheck(userId: string, now = new Date()): Promise<CheckReply> {
  const secret = process.env.RESERVATION_NOTIFY_SECRET ?? ''
  if (!userId || !secret) return { kind: 'error' }
  // その LINE と結びついた連携（封印を開いて比べる）
  const mine = (await kvList<LineLink>('linelink:'))
    .map(({ value }) => value)
    .filter((v): v is LineLink => Boolean(v && v.key && v.sealed) && unsealUserId(v.sealed, secret) === userId)
  const upcoming = await fetchUpcomingReservations(now)
  if (!upcoming) return { kind: 'error' }
  const [kartes, links] = await Promise.all([cloudKartes(), listLineLinks()])
  const items = pickReservationsForLine(
    upcoming.rows,
    { today: upcoming.today, time: upcoming.now },
    kartes,
    links,
    new Set(mine.map((l) => l.key)),
    (lineKey) => unsealUserId(lineKey, secret) === userId,
  )
  if (items.length > 0) {
    const changeUrls: Record<string, string> = {}
    for (const item of items) changeUrls[item.reservationNo] = reservationChangeUrl(item.reservationNo)
    return { kind: 'found', items, changeUrls }
  }
  if (mine.length > 0) return { kind: 'none', names: [...new Set(mine.map((l) => l.name))] }
  return { kind: 'unknown' }
}

/** 返事の文（LINE へそのまま返す）。数だけを記録に残す */
export async function answerReservationCheck(userId: string, now = new Date()): Promise<string> {
  let reply: CheckReply
  try {
    reply = await resolveReservationCheck(userId, now)
  } catch {
    reply = { kind: 'error' }
  }
  console.log('[reservation-check]', reply.kind, reply.kind === 'found' ? `${reply.items.length}件` : '')
  return reservationCheckText(reply, {
    clinicName: DEFAULT_CLINIC_PROFILE.name,
    phone: DEFAULT_CLINIC_PROFILE.phone,
    reserveUrl: LIFF_RESERVE_URL,
  })
}
