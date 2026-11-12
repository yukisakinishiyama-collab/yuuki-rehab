/**
 * カルテ連携（患者さんがLINEから自分の名前・電話番号・生年月日を入れて、カルテとLINEを結びつける）
 *
 * 流れ: LIFF で IDトークン → /api/liff/verify で短命チケット → ここへ {ticket, name, phone, birthDate}
 * - チケットから userId を取り出し（本人がLINEでログインした証明）、封印してKVに保存する。
 *   生の userId はこのサーバーの外に出さない（lib/liff-ticket.ts の方針）。
 * - クラウドに控えたカルテに同じ人がいて生年月日が違えば、結びつけない（なりすまし・入力違いの防止）
 * - 予約システムに患者番号をもらう（無ければ発行）。ネット予約の「患者番号をお持ちの方」で使える
 * - 結びついたら、本人のLINEへ番号つきで1通送る（送れなくても結びつけは成功）
 *
 * 公開の入口（/api/liff は Basic 認証の外）。チケットが無いと何も保存できない。
 */
import { NextRequest, NextResponse } from 'next/server'
import { readTicket, sealUserId } from '@/lib/liff-ticket'
import { nameNoSpace, patientLinkKey, phoneDigits, type LineLink } from '@/lib/line-link'
import { fetchPatientNo, findKartePatient, getLineLink, patientNoErrorText, saveLineLink } from '@/lib/line-link-server'
import { DEFAULT_CLINIC_PROFILE } from '@/lib/marketing/clinic'

const CLINIC = DEFAULT_CLINIC_PROFILE

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/** 本文に載せる氏名から改行・制御文字を除き、長さを抑える（メッセージ偽装の防止） */
function cleanName(value: unknown): string {
  return String(value ?? '')
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .trim()
    .slice(0, 40)
}

/** 'YYYY-MM-DD' / 'YYYY/MM/DD' / 'YYYYMMDD' を 'YYYY-MM-DD' に。読めなければ '' */
function normalizeBirth(value: unknown): string {
  const t = String(value ?? '')
    .replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .trim()
  const m = /^(\d{4})[-/]?(\d{1,2})[-/]?(\d{1,2})$/.exec(t)
  if (!m) return ''
  const y = Number(m[1])
  const mo = Number(m[2])
  const d = Number(m[3])
  if (y < 1900 || y > new Date().getFullYear() || mo < 1 || mo > 12 || d < 1 || d > 31) return ''
  return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

export async function POST(request: NextRequest) {
  const secret = process.env.RESERVATION_NOTIFY_SECRET
  if (!secret) return NextResponse.json({ ok: false, error: 'not configured' }, { status: 503 })

  let body: { ticket?: string; name?: string; phone?: string; birthDate?: string }
  try {
    body = (await request.json()) as typeof body
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid json' }, { status: 400 })
  }

  const userId = readTicket(String(body.ticket ?? ''), secret)
  if (!userId) return NextResponse.json({ ok: false, error: 'LINEの確認が切れました。もう一度開いてください' }, { status: 401 })

  const name = cleanName(body.name)
  const phone = phoneDigits(String(body.phone ?? ''))
  const birthDate = normalizeBirth(body.birthDate)
  if (!nameNoSpace(name)) return NextResponse.json({ ok: false, error: 'お名前を入れてください' }, { status: 400 })
  if (phone.length < 10 || phone.length > 11) {
    return NextResponse.json({ ok: false, error: '電話番号は10〜11桁の数字で入れてください' }, { status: 400 })
  }
  if (!birthDate) return NextResponse.json({ ok: false, error: '生年月日を入れてください（例 1990-01-23）' }, { status: 400 })
  const key = patientLinkKey(name, phone)
  if (!key) return NextResponse.json({ ok: false, error: 'お名前と電話番号を確かめてください' }, { status: 400 })

  // カルテに同じ人がいて生年月日が違うときは結びつけない（存在の有無は言わない）
  const karte = await findKartePatient(key)
  if (karte?.birthDate && karte.birthDate !== birthDate) {
    return NextResponse.json({ ok: false, error: 'お名前・電話番号・生年月日の組み合わせを確かめてください（院の記録と合いません）' }, { status: 400 })
  }

  const existing = await getLineLink(key)
  // 患者番号：前に発行できていればそれを使う。無ければ予約システムにもらう
  let patientNo = existing?.patientNo
  let patientNoError: string | undefined
  if (!patientNo) {
    const r = await fetchPatientNo(name, phone)
    patientNo = r.patientNo
    patientNoError = r.error
  }

  const link: LineLink = {
    key,
    name,
    phone,
    sealed: sealUserId(userId, secret),
    linkedAt: new Date().toISOString(),
    via: 'liff-link',
    birthDate,
    patientNo,
    patientNoError: patientNo ? undefined : patientNoError,
  }
  // 本人へ1通（送れなくても結びつけは成功あつかい）。送れなかった理由は控えておく
  let notified = false
  let notifyError = ''
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN
  if (!token) notifyError = 'LINE_CHANNEL_ACCESS_TOKEN 未設定'
  if (token) {
    const numberLine = patientNo
      ? `\n\n患者番号：${patientNo}\nネット予約の「患者番号をお持ちの方」に、この番号と電話番号の下4桁を入れると、お名前などが自動で入ります。`
      : `\n\n${patientNoErrorText(patientNoError)}`
    const text = `${name}さんのカルテとこのLINEを${existing ? 'あらためて' : ''}結びつけました。\n誕生日のご挨拶など、院からのお知らせをこのLINEへお送りします。${numberLine}\n\n${CLINIC.name}`
    try {
      const res = await fetch('https://api.line.me/v2/bot/message/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ to: userId, messages: [{ type: 'text', text }] }),
      })
      notified = res.ok
      if (!res.ok) {
        const detail = await res.text().catch(() => '')
        notifyError = `HTTP ${res.status} ${detail}`.slice(0, 300)
      }
    } catch (error) {
      notified = false
      notifyError = (error instanceof Error ? error.message : String(error)).slice(0, 300)
    }
  }
  await saveLineLink({ ...link, notified, notifyError: notified ? undefined : notifyError || undefined })

  return NextResponse.json({
    ok: true,
    name,
    notified,
    again: Boolean(existing),
    patientNo: patientNo ?? null,
    patientNoMessage: patientNo ? '' : patientNoErrorText(patientNoError),
  })
}
