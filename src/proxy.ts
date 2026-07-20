/**
 * マーケティングハブのアクセス保護（Basic認証＋権限分け）
 *
 * MARKETING_ADMIN_PASSWORD を設定した環境（本番）でのみ有効。
 * 未設定のローカル開発環境では何もしない。
 *
 * 権限（院長=管理者 / スタッフ=編集）:
 * - MARKETING_ADMIN_PASSWORD で入ると admin（全操作）
 * - MARKETING_STAFF_PASSWORD で入ると staff（閲覧・下書き・登録まで。公開/承認/削除は不可）
 * - 判定した役割は権威的にヘッダー `x-marketing-role` へ注入する。クライアントが
 *   偽装して送ってきた同名ヘッダーは必ず破棄する。UI表示用に読み取り可能な
 *   Cookie `mk_role` も付与する。各ルートは auth.ts の requireAdmin で再検証する。
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
import { ROLE_COOKIE, ROLE_HEADER, roleFromPassword, type MarketingRole } from '@/lib/marketing/auth'

const PUBLIC_PATHS = [
  '/api/marketing/line/webhook',
  '/api/marketing/go',
  '/api/marketing/jobs/run',
  '/api/marketing/reservation-notify',
]

/** 認証済みの役割を権威的にヘッダー注入し、UI表示用Cookieを添えて通過させる */
function pass(request: NextRequest, role: MarketingRole) {
  // クライアントが偽装した役割ヘッダーを破棄し、判定結果で上書きする
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set(ROLE_HEADER, role)

  const response = NextResponse.next({ request: { headers: requestHeaders } })
  // 読み取り可能CookieでクライアントUIのボタン表示を制御（認可の本体はサーバー側）
  response.cookies.set(ROLE_COOKIE, role, { path: '/marketing', sameSite: 'lax' })
  return response
}

export function proxy(request: NextRequest) {
  const adminPassword = process.env.MARKETING_ADMIN_PASSWORD
  if (!adminPassword) {
    return NextResponse.next()
  }

  const { pathname } = request.nextUrl
  if (PUBLIC_PATHS.some((path) => pathname.startsWith(path))) {
    return NextResponse.next()
  }

  const header = request.headers.get('authorization') ?? ''
  if (header.startsWith('Basic ')) {
    try {
      const [, pwd] = atob(header.slice(6)).split(':')
      const role = roleFromPassword(pwd)
      if (role) {
        return pass(request, role)
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
