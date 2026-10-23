/**
 * 院内アプリ（予約管理・カルテ・経営・集客）のアクセス保護（Basic認証＋権限分け）
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
 * 保護対象: 院内アプリの画面（/dashboard・/patients・/yoyaku・/marketing・/login）と、
 *           院内アプリだけが使うAPI（/api/marketing・/api/sync・/api/yoyaku・/api/intake-analysis・
 *           /api/referral-generate）。カルテ（患者さんの記録）を外から見られないようにする。
 *           動画の保存（/api/upload）も保護する。ただし Vercel Blob からの保存完了の通知
 *           （x-vercel-signature 付き。中身は handleUpload が署名で確かめる）だけは通す。
 * 保護しないもの: 公開ホームページ、患者さんが使う LIFF（/liff・/api/liff）
 * 除外（外部から呼ばれる必要があるもの）:
 * - /api/marketing/line/webhook       … LINEサーバーからの通知（署名検証で保護）
 * - /api/marketing/go                 … 患者がタップする計測リンク
 * - /api/marketing/jobs/run           … Vercel Cron（CRON_SECRETで保護）
 * - /api/marketing/autopilot/run      … 自動下書きの定期実行（CRON_SECRETで保護）
 * - /api/marketing/noah/nightly       … NOAH集計の毎晩のまとめ（CRON_SECRETで保護）
 * - /api/marketing/reservation-notify … GAS予約システムからの通知（RESERVATION_NOTIFY_SECRETで保護）
 * - /api/marketing/instagram/callback … Instagramの許可画面からの戻り（/connectで発行したstateのCookie一致で保護）
 */
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { ROLE_COOKIE, ROLE_HEADER, roleFromPassword, type MarketingRole } from '@/lib/marketing/auth'

const PUBLIC_PATHS = [
  '/api/marketing/line/webhook',
  '/api/marketing/go',
  '/api/marketing/jobs/run',
  '/api/marketing/autopilot/run',
  '/api/marketing/noah/nightly',
  '/api/marketing/reservation-notify',
  '/api/marketing/instagram/callback',
]

/** 認証済みの役割を権威的にヘッダー注入し、UI表示用Cookieを添えて通過させる */
function pass(request: NextRequest, role: MarketingRole) {
  // クライアントが偽装した役割ヘッダーを破棄し、判定結果で上書きする
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set(ROLE_HEADER, role)

  const response = NextResponse.next({ request: { headers: requestHeaders } })
  // 読み取り可能CookieでクライアントUIのボタン表示を制御（認可の本体はサーバー側）
  response.cookies.set(ROLE_COOKIE, role, { path: '/', sameSite: 'lax' })
  // 以前の path=/marketing の Cookie が残っていると古い役割が先に読まれるため、消しておく
  response.headers.append('Set-Cookie', `${ROLE_COOKIE}=; Path=/marketing; Max-Age=0; SameSite=Lax`)
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
  // 動画の保存完了の通知（Vercel Blob のサーバーから。署名は /api/upload 側の handleUpload が確かめる）
  if (pathname.startsWith('/api/upload') && request.headers.get('x-vercel-signature')) {
    const requestHeaders = new Headers(request.headers)
    requestHeaders.delete(ROLE_HEADER)
    return NextResponse.next({ request: { headers: requestHeaders } })
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
    headers: { 'WWW-Authenticate': 'Basic realm="marketing-hub", charset="UTF-8"' }, // 名前は従来のまま（保存済みのログインを使い続けられるように）
  })
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/patients/:path*',
    '/yoyaku/:path*',
    '/marketing/:path*',
    '/login',
    '/api/marketing/:path*',
    '/api/sync/:path*',
    '/api/yoyaku/:path*',
    '/api/intake-analysis/:path*',
    '/api/referral-generate/:path*',
    '/api/upload/:path*',
  ],
}
