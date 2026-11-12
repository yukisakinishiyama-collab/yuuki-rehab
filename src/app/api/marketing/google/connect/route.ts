/**
 * 「Googleとつなぐ」の入口（院長のみ）
 *
 * ランダムなstateをCookieに入れて、Googleの許可画面へ移動する。
 * 戻り先は /api/marketing/google/callback（stateが一致したときだけ保存する）
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/marketing/auth'
import { GBP_STATE_COOKIE, gbpAuthorizeUrl, gbpOAuthConfig } from '@/lib/marketing/gbp-oauth-server'
import { recordGbpOAuthResult } from '@/lib/marketing/gbp-token'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const denied = requireAdmin(request)
  if (denied) return denied

  const config = gbpOAuthConfig(request.nextUrl.origin)
  if (!config.ready) {
    await recordGbpOAuthResult(false, 'GBP_CLIENT_ID と GBP_CLIENT_SECRET をVercelに設定してから押してください。')
    return NextResponse.redirect(new URL('/marketing/jobs', request.url))
  }

  const state = crypto.randomUUID()
  const response = NextResponse.redirect(gbpAuthorizeUrl(config.clientId, config.redirectUri, state))
  response.cookies.set(GBP_STATE_COOKIE, state, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/api/marketing/google',
    maxAge: 600,
  })
  return response
}
