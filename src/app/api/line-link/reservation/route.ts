/**
 * LINEで連携した患者さんへ、予約の日時をLINEで送る（院内のみ。proxy.ts の Basic 認証の内側。院長・スタッフとも使える）
 * 2026-11-02 院長の依頼「LINE連携した人に予約した際、LINEに予約日・時間を送るボタン」
 *
 * - GET  ?nos=R1,R2 … 予約ごとに、このアプリから送ったか（送った日時・そのときの予約日時）
 * - POST { key, reservationNo, date, time } … その予約の日時を、結びついたLINEへ送る
 *   宛先は連携の記録（linelink:<key>）の封印から、サーバーの中でだけ開く（画面から LINE の宛先は受け取らない）
 *   本文のお名前も連携の記録のもの（画面から来たお名前は使わない）。文面は予約確定のお知らせと同じ
 * 送ったことは linesent:<予約番号> に残す（二重に送らないよう画面で「送信済み」と出す。日時が変わったら送り直せる）
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { unsealUserId } from '@/lib/liff-ticket'
import { getLineLink } from '@/lib/line-link-server'
import { kvGet, kvSet } from '@/lib/marketing/kv-store-server'
import { patientConfirmText } from '@/lib/reservation-message'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

const SENT_PREFIX = 'linesent:'
// LINE_API_BASE_URL は動作確認用（ふだんは設定しない）
const LINE_PUSH_URL = `${(process.env.LINE_API_BASE_URL ?? 'https://api.line.me').replace(/\/$/, '')}/v2/bot/message/push`

interface ReservationSent {
  reservationNo: string
  key: string
  date: string
  time: string
  sentAt: string
}

const NO = /^[A-Za-z0-9-]{1,20}$/

export async function GET(request: NextRequest) {
  const nos = (request.nextUrl.searchParams.get('nos') ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter((s) => NO.test(s))
    .slice(0, 200)
  const entries = await Promise.all(nos.map(async (no) => [no, await kvGet<ReservationSent>(`${SENT_PREFIX}${no}`)] as const))
  const sent: Record<string, Pick<ReservationSent, 'date' | 'time' | 'sentAt'>> = {}
  for (const [no, record] of entries) {
    if (record) sent[no] = { date: record.date, time: record.time, sentAt: record.sentAt }
  }
  return NextResponse.json({ ok: true, sent }, { headers: { 'Cache-Control': 'no-store' } })
}

const bodySchema = z.object({
  key: z.string().regex(/^\d{10,11}\|.{1,60}$/),
  reservationNo: z.string().regex(NO),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().regex(/^\d{1,2}:\d{2}$/),
})

export async function POST(request: NextRequest) {
  const secret = process.env.RESERVATION_NOTIFY_SECRET
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN
  if (!secret || !token) return NextResponse.json({ ok: false, error: 'LINEの設定がありません' }, { status: 503 })

  const parsed = bodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ ok: false, error: '予約の情報が正しくありません' }, { status: 400 })
  const { key, reservationNo, date, time } = parsed.data

  const link = await getLineLink(key)
  if (!link) return NextResponse.json({ ok: false, error: 'この方のLINE連携が見つかりません' }, { status: 404 })
  const userId = unsealUserId(link.sealed, secret)
  if (!userId) return NextResponse.json({ ok: false, error: 'LINEの宛先を開けませんでした' }, { status: 500 })

  const text = patientConfirmText({ name: link.name, date, time, reservationNo })
  try {
    const res = await fetch(LINE_PUSH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ to: userId, messages: [{ type: 'text', text }] }),
      signal: AbortSignal.timeout(20_000),
    })
    if (!res.ok) {
      const detail = `HTTP ${res.status} ${await res.text().catch(() => '')}`.slice(0, 200)
      console.error('[line-link/reservation] 送信に失敗', detail)
      return NextResponse.json({ ok: false, error: `LINEへ送れませんでした（${detail}）` }, { status: 502 })
    }
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ ok: false, error: `LINEへ送れませんでした（${detail}）` }, { status: 502 })
  }

  const record: ReservationSent = { reservationNo, key, date, time, sentAt: new Date().toISOString() }
  await kvSet(`${SENT_PREFIX}${reservationNo}`, record)
  return NextResponse.json({ ok: true, sentAt: record.sentAt })
}
