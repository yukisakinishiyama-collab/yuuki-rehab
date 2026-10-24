/**
 * カルテ連携（患者さんがLINEから自分の名前・電話番号を入れて、カルテとLINEを結びつける）
 *
 * 流れ: LIFF で IDトークン → /api/liff/verify で短命チケット → ここへ {ticket, name, phone}
 * - チケットから userId を取り出し（本人がLINEでログインした証明）、封印してKVに保存する。
 *   生の userId はこのサーバーの外に出さない（lib/liff-ticket.ts の方針）。
 * - 結びついたら、本人のLINEへ「結びつきました」と1通送る（送れなくても結びつけは成功）。
 *
 * 公開の入口（/api/liff は Basic 認証の外）。チケットが無いと何も保存できない。
 */
import { NextRequest, NextResponse } from 'next/server'
import { readTicket, sealUserId } from '@/lib/liff-ticket'
import { nameNoSpace, patientLinkKey, phoneDigits, type LineLink } from '@/lib/line-link'
import { getLineLink, saveLineLink } from '@/lib/line-link-server'
import { DEFAULT_CLINIC_PROFILE } from '@/lib/marketing/clinic'

const CLINIC = DEFAULT_CLINIC_PROFILE

export const dynamic = 'force-dynamic'

/** 本文に載せる氏名から改行・制御文字を除き、長さを抑える（メッセージ偽装の防止） */
function cleanName(value: unknown): string {
  return String(value ?? '')
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .trim()
    .slice(0, 40)
}

export async function POST(request: NextRequest) {
  const secret = process.env.RESERVATION_NOTIFY_SECRET
  if (!secret) return NextResponse.json({ ok: false, error: 'not configured' }, { status: 503 })

  let body: { ticket?: string; name?: string; phone?: string }
  try {
    body = (await request.json()) as typeof body
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid json' }, { status: 400 })
  }

  const userId = readTicket(String(body.ticket ?? ''), secret)
  if (!userId) return NextResponse.json({ ok: false, error: 'LINEの確認が切れました。もう一度開いてください' }, { status: 401 })

  const name = cleanName(body.name)
  const phone = phoneDigits(String(body.phone ?? ''))
  if (!nameNoSpace(name)) return NextResponse.json({ ok: false, error: 'お名前を入れてください' }, { status: 400 })
  if (phone.length < 10 || phone.length > 11) {
    return NextResponse.json({ ok: false, error: '電話番号は10〜11桁の数字で入れてください' }, { status: 400 })
  }
  const key = patientLinkKey(name, phone)
  if (!key) return NextResponse.json({ ok: false, error: 'お名前と電話番号を確かめてください' }, { status: 400 })

  const existing = await getLineLink(key)
  const link: LineLink = {
    key,
    name,
    phone,
    sealed: sealUserId(userId, secret),
    linkedAt: new Date().toISOString(),
    via: 'liff-link',
  }
  await saveLineLink(link)

  // 本人へ1通（送れなくても結びつけは成功あつかい）
  let notified = false
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN
  if (token) {
    const text = existing
      ? `${name}さんのカルテとこのLINEを、あらためて結びつけました。\n\n${CLINIC.name}`
      : `${name}さんのカルテとこのLINEを結びつけました。\n誕生日のご挨拶など、院からのお知らせをこのLINEへお送りします。\n\n${CLINIC.name}`
    try {
      const res = await fetch('https://api.line.me/v2/bot/message/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ to: userId, messages: [{ type: 'text', text }] }),
      })
      notified = res.ok
    } catch {
      notified = false
    }
  }

  return NextResponse.json({ ok: true, name, notified, again: Boolean(existing) })
}
