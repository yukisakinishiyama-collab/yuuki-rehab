/**
 * カルテ連携の「結びつけました＋患者番号」のお知らせを、もう一度LINEで送る（院長のみ）
 *
 * - GET  : 送れたことが確かめられていない方の人数（送る前の確認用。個人の情報は返さない）
 * - POST : { keys?: string[] } 指定が無ければ「送れたことが確かめられていない方」全員に送る
 *          （notified が true の方には送らない。同じ方に二重に送らないため）
 * 送った結果は連携の記録（notified / notifyError）に残す。
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/marketing/auth'
import { unsealUserId } from '@/lib/liff-ticket'
import { getLineLink, listLineLinks, patientNoErrorText, saveLineLink } from '@/lib/line-link-server'
import { DEFAULT_CLINIC_PROFILE } from '@/lib/marketing/clinic'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

function noticeText(name: string, patientNo: string | undefined, patientNoError: string | undefined): string {
  const numberLine = patientNo
    ? `\n\n患者番号：${patientNo}\nネット予約の「患者番号をお持ちの方」に、この番号と、院にご登録の電話番号の下4桁の2つを入れると、お名前などが自動で入ります。`
    : `\n\n${patientNoErrorText(patientNoError)}`
  return `${name}さんのカルテとこのLINEの連携が済みました。\n誕生日のご挨拶など、院からのお知らせをこのLINEへお送りします。${numberLine}\n\n${DEFAULT_CLINIC_PROFILE.name}`
}

async function targets(keys: string[] | undefined) {
  const summaries = await listLineLinks()
  const wanted = keys && keys.length > 0 ? summaries.filter(s => keys.includes(s.key)) : summaries.filter(s => s.notified !== true)
  return wanted
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

  let body: { keys?: unknown } = {}
  try {
    body = (await request.json()) as typeof body
  } catch {
    body = {}
  }
  const keys = Array.isArray(body.keys) ? body.keys.map(String).slice(0, 500) : undefined

  let sent = 0
  let failed = 0
  const errors: string[] = []
  for (const summary of await targets(keys)) {
    const link = await getLineLink(summary.key)
    if (!link) continue
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
        body: JSON.stringify({ to: userId, messages: [{ type: 'text', text: noticeText(link.name, link.patientNo, link.patientNoError) }] }),
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
  return NextResponse.json({ ok: true, sent, failed, errors: [...new Set(errors)].slice(0, 5) })
}
