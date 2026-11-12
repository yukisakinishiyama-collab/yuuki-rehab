/**
 * カルテ連携の「結びつけました＋患者番号」のお知らせを、もう一度LINEで送る（院長のみ）
 *
 * - GET  : 送れたことが確かめられていない方の人数（送る前の確認用。個人の情報は返さない）
 * - POST : { keys?: string[], all?: boolean } all なら連携した全員、keys ならその方、
 *          どちらも無ければ「送れたことが確かめられていない方」全員に送る
 *          （notified が true の方には送らない。同じ方に二重に送らないため）
 *          控えの患者番号が数字でない方は、送る前に予約システムから番号をもらい直す。
 *          前に文字（「院側手動登録」）を番号としてお知らせしていた方には「誤りがありました」から書き出す
 * 送った結果は連携の記録（notified / notifyError）に残す。
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/marketing/auth'
import { unsealUserId } from '@/lib/liff-ticket'
import { getLineLink, listLineLinks, patientNoErrorText, refreshPatientNo, saveLineLink } from '@/lib/line-link-server'
import { linkNoticeText } from '@/lib/line-link'
import { DEFAULT_CLINIC_PROFILE } from '@/lib/marketing/clinic'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

function noticeText(name: string, patientNo: string | undefined, patientNoError: string | undefined, corrected = false): string {
  return linkNoticeText({ name, patientNo, fallback: patientNoErrorText(patientNoError), sign: DEFAULT_CLINIC_PROFILE.name, corrected })
}

async function targets(keys: string[] | undefined, all = false) {
  const summaries = await listLineLinks()
  if (all) return summaries
  return keys && keys.length > 0 ? summaries.filter(s => keys.includes(s.key)) : summaries.filter(s => s.notified !== true)
}

export async function GET(request: NextRequest) {
  const denied = requireAdmin(request)
  if (denied) return denied
  const list = await targets(undefined)
  return NextResponse.json({ ok: true, pending: list.length })
}

export async function POST(request: NextRequest) {
  const denied = requireAdmin(request)
  if (denied) return denied
  const secret = process.env.RESERVATION_NOTIFY_SECRET
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN
  if (!secret || !token) return NextResponse.json({ ok: false, error: 'LINEの設定がありません' }, { status: 503 })

  let body: { keys?: unknown; all?: unknown } = {}
  try {
    body = (await request.json()) as typeof body
  } catch {
    body = {}
  }
  const keys = Array.isArray(body.keys) ? body.keys.map(String).slice(0, 500) : undefined

  let sent = 0
  let failed = 0
  const errors: string[] = []
  let corrected = 0
  for (const summary of await targets(keys, body.all === true)) {
    const stored = await getLineLink(summary.key)
    if (!stored) continue
    // 控えの患者番号が数字でないとき（「院側手動登録」など）は、送る前に予約システムからもらい直す
    const fresh = await refreshPatientNo(stored)
    const link = fresh.link
    if (fresh.refreshed) await saveLineLink(link)
    if (fresh.corrected) corrected += 1
    const userId = unsealUserId(link.sealed, secret)
    if (!userId) {
      failed += 1
      await saveLineLink({ ...link, notified: false, notifyError: '封印を開けませんでした' })
      continue
    }
    try {
      const res = await fetch('https://api.line.me/v2/bot/message/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ to: userId, messages: [{ type: 'text', text: noticeText(link.name, link.patientNo, link.patientNoError, fresh.corrected) }] }),
      })
      if (res.ok) {
        sent += 1
        await saveLineLink({ ...link, notified: true, notifyError: undefined })
      } else {
        failed += 1
        const detail = `HTTP ${res.status} ${await res.text().catch(() => '')}`.slice(0, 300)
        errors.push(detail)
        await saveLineLink({ ...link, notified: false, notifyError: detail })
      }
    } catch (error) {
      failed += 1
      const detail = (error instanceof Error ? error.message : String(error)).slice(0, 300)
      errors.push(detail)
      await saveLineLink({ ...link, notified: false, notifyError: detail })
    }
  }
  return NextResponse.json({ ok: true, sent, failed, corrected, errors: [...new Set(errors)].slice(0, 5) })
}
