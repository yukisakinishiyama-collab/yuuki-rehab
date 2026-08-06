/**
 * LIFF IDトークン検証エンドポイント
 *
 * LIFFで取得したIDトークンをLINEの公式検証APIへ渡し、正当だと確認できた場合のみ
 * 短命（15分）の署名付きチケットを発行する。予約サイト（GAS）へはこのチケットだけを
 * 渡し、userId 自体はこのサーバーの外に出さない。
 *
 * これにより「他人のuserIdをURLに付けて予約し、公式アカウント名義で通知を送る」
 * なりすましを防ぐ（userId は本人がLINEでログインした証明がないと得られない）。
 */
import { NextRequest, NextResponse } from 'next/server'
import { issueTicket } from '@/lib/liff-ticket'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  // 署名鍵は既存の共有シークレットを流用（環境変数を増やさない）
  const key = process.env.RESERVATION_NOTIFY_SECRET
  if (!key) {
    return NextResponse.json({ ok: false, error: 'not configured' }, { status: 503 })
  }

  let body: { idToken?: string; liffId?: string }
  try {
    body = (await request.json()) as { idToken?: string; liffId?: string }
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid json' }, { status: 400 })
  }

  const idToken = String(body.idToken ?? '')
  // LIFF ID は「LINEログインチャネルID-サフィックス」形式。前半が検証APIのclient_id
  const clientId = String(body.liffId ?? '').split('-')[0]
  if (!idToken || !/^\d{5,}$/.test(clientId)) {
    return NextResponse.json({ ok: false, error: 'missing params' }, { status: 400 })
  }

  try {
    // 署名・有効期限・発行先(aud)はLINE側が検証する
    const res = await fetch('https://api.line.me/oauth2/v2.1/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ id_token: idToken, client_id: clientId }),
      cache: 'no-store',
    })
    if (!res.ok) {
      return NextResponse.json({ ok: false, error: 'invalid token' }, { status: 401 })
    }
    const claims = (await res.json()) as { sub?: string }
    const userId = String(claims.sub ?? '')
    if (!/^U[0-9a-f]{32}$/.test(userId)) {
      return NextResponse.json({ ok: false, error: 'invalid subject' }, { status: 401 })
    }
    return NextResponse.json({ ok: true, ticket: issueTicket(userId, key) })
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'verify failed' },
      { status: 502 },
    )
  }
}
