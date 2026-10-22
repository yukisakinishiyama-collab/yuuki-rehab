/**
 * 「Instagramとつなぐ」の入口（院長のみ）
 *
 * ランダムなstateをCookieに入れて、Instagramの許可画面へ移動する。
 * 戻り先は /api/marketing/instagram/callback（stateが一致したときだけトークンを保存）
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/marketing/auth'
import { authorizeUrl, IG_STATE_COOKIE, instagramOAuthConfig } from '@/lib/marketing/instagram-oauth-server'
import { recordOAuthResult } from '@/lib/marketing/instagram-oauth-result'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const denied = requireAdmin(request)
  if (denied) return denied

  const config = instagramOAuthConfig(request.nextUrl.origin)
  if (!config.ready) {
    await recordOAuthResult(false, 'INSTAGRAM_APP_ID と INSTAGRAM_APP_SECRET をVercelに設定してから押してください。')
    return NextResponse.redirect(new URL('/marketing/jobs', request.url))
  }

  const state = crypto.randomUUID()
  const response = NextResponse.redirect(authorizeUrl(config.appId, config.redirectUri, state))
  response.cookies.set(IG_STATE_COOKIE, state, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/api/marketing/instagram',
    maxAge: 600,
  })
  return response
}
