/**
 * カルテ連携（患者さんの LINE とカルテを結びつける）
 *
 * 流れ: LIFF で IDトークン → /api/liff/verify で短命チケット → ここへ
 *   A. {ticket, name, phone, birthDate} … 患者さんが自分で入れる（今までどおり）
 *   B. {ticket, code, peek: true}       … カルテの画面に出したQRコードの番号で、お名前の一部を見る（2026-11-19）
 *      {ticket, code, phone?}           … その番号で結びつける（お名前・電話・生年月日はカルテのもの。電話が無い方だけ入れてもらう）
 * - チケットから userId を取り出し（本人がLINEでログインした証明）、封印してKVに保存する。
 *   生の userId はこのサーバーの外に出さない（lib/liff-ticket.ts の方針）。
 * - A では、クラウドに控えたカルテに同じ人がいて生年月日が違えば、結びつけない（なりすまし・入力違いの防止）
 * - 予約システムに患者番号をもらう（無ければ発行）。ネット予約の「患者番号をお持ちの方」で使える
 * - 結びついたら、本人のLINEへ番号つきで1通送る（送れなくても結びつけは成功）
 *
 * 公開の入口（/api/liff は Basic 認証の外）。チケットが無いと何も見られない・保存できない。
 */
import { NextRequest, NextResponse } from 'next/server'
import { readTicket } from '@/lib/liff-ticket'
import { nameNoSpace, patientLinkKey, phoneDigits } from '@/lib/line-link'
import { findKartePatient, linkLineUser } from '@/lib/line-link-server'
import { linkQrProblemText } from '@/lib/line-link-qr'
import { linkedByOf, previewLinkQr, redeemLinkQr } from '@/lib/line-link-qr-server'

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

  let body: { ticket?: string; name?: string; phone?: string; birthDate?: string; code?: string; peek?: boolean }
  try {
    body = (await request.json()) as typeof body
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid json' }, { status: 400 })
  }

  const userId = readTicket(String(body.ticket ?? ''), secret)
  if (!userId) return NextResponse.json({ ok: false, error: 'LINEの確認が切れました。もう一度開いてください' }, { status: 401 })

  // B. カルテの画面に出したQRコードの番号で（お名前などを入れなくてよい）
  if (body.code !== undefined) {
    const code = String(body.code ?? '')
    if (body.peek) {
      const preview = await previewLinkQr(code, new Date(), linkedByOf(userId, secret))
      // この LINE でもう結びついている（LINE が画面を読み直した・2回読み取った）：「結びついています」を出す
      if (!preview.ok && preview.already) return NextResponse.json({ ok: false, reason: 'used', already: preview.already }, { status: 410 })
      if (!preview.ok) return NextResponse.json({ ok: false, reason: preview.reason, error: linkQrProblemText(preview.reason) }, { status: 410 })
      return NextResponse.json({ ok: true, maskedName: preview.maskedName, needPhone: preview.needPhone })
    }
    try {
      const used = await redeemLinkQr({ code, userId, phone: body.phone }, secret)
      if (!used.ok) {
        if (used.reason === 'phone') return NextResponse.json({ ok: false, reason: 'phone', error: '電話番号は10〜11桁の数字で入れてください' }, { status: 400 })
        if (used.already) return NextResponse.json({ ok: false, reason: 'used', already: used.already }, { status: 410 })
        return NextResponse.json({ ok: false, reason: used.reason, error: linkQrProblemText(used.reason) }, { status: 410 })
      }
      const r = used.result
      return NextResponse.json({ ok: true, name: r.name, notified: r.notified, again: r.again, patientNo: r.patientNo, patientNoMessage: r.patientNoMessage })
    } catch (error) {
      return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'うまくいきませんでした' }, { status: 500 })
    }
  }

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

  const r = await linkLineUser({ userId, name, phone, birthDate, via: 'liff-link' }, secret)
  return NextResponse.json({
    ok: true,
    name,
    notified: r.notified,
    again: r.again,
    patientNo: r.patientNo,
    patientNoMessage: r.patientNoMessage,
  })
}

