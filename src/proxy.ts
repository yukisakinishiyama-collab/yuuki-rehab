/**
 * マーケティングハブのアクセス保護（Basic認証）
 *
 * MARKETING_ADMIN_PASSWORD を設定した環境（本番）でのみ有効。
 * 未設定のローカル開発環境では何もしない。
 *
 * 保護対象: /marketing と /api/marketing 一式
 * 除外（外部から呼ばれる必要があるもの）:
 * - /api/marketing/line/webhook       … LINEサーバーからの通知（署名検証で保護）
 * - /api/marketing/go                 … 患者がタップする計測リンク
 * - /api/marketing/jobs/run           … Vercel Cron（CRON_SECRETで保護）
 * - /api/marketing/reservation-notify … GAS予約システムからの通知（RESERVATION_NOTIFY_SECRETで保護）
 */
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const PUBLIC_PATHS = [
  '/api/marketing/line/webhook',
  '/api/marketing/go',
  '/api/marketing/jobs/run',
  '/api/marketing/reservation-notify',
]

export function proxy(request: NextRequest) {
  const password = process.env.MARKETING_ADMIN_PASSWORD
  if (!password) {
    return NextResponse.next()
  }

  const { pathname } = request.nextUrl
  if (PUBLIC_PATHS.some((path) => pathname.startsWith(path))) {
    return NextResponse.next()
  }

  const header = request.headers.get('authorization') ?? ''
  if (header.startsWith('Basic ')) {
    try {
      const [, pass] = atob(header.slice(6)).split(':')
      if (pass === password) {
        return NextResponse.next()
      }
    } catch {
      // 不正なヘッダーは未認証として扱う
    }
  }

  return new NextResponse('認証が必要です', {
    status: 401,
    headers: { 'WWW-Authenticate': 'Basic realm="marketing-hub", charset="UTF-8"' },
  })
}

export const config = {
  matcher: ['/marketing/:path*', '/api/marketing/:path*'],
}
