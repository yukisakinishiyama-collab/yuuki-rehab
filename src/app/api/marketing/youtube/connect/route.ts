/**
 * 「YouTubeとつなぐ」の入口・解除（院長のみ）
 *
 * GET    … ランダムな state（頭に "yt." を付ける）を Cookie に入れて、Google の許可画面へ移動する。
 *          戻り先は Googleビジネスプロフィールと同じ /api/marketing/google/callback（state の頭で見分ける）
 * DELETE … 連携を外す（この院内アプリに保存したトークンを消す）
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/marketing/auth'
import { gbpOAuthConfig } from '@/lib/marketing/gbp-oauth-server'
import { disconnectYoutube, recordYoutubeOAuthResult, YOUTUBE_STATE_COOKIE, YOUTUBE_STATE_PREFIX, youtubeAuthorizeUrl } from '@/lib/marketing/youtube-server'

export const dynamic = 'force-dynamic'

const BACK = '/marketing/autopilot?open=settings#promo-video'

export async function GET(request: NextRequest) {
  const denied = requireAdmin(request)
  if (denied) return denied

  const config = gbpOAuthConfig(request.nextUrl.origin)
  if (!config.ready) {
    await recordYoutubeOAuthResult(false, 'GBP_CLIENT_ID と GBP_CLIENT_SECRET を Vercel に設定してから押してください。')
    return NextResponse.redirect(new URL(BACK, request.url))
  }
  const state = `${YOUTUBE_STATE_PREFIX}${crypto.randomUUID()}`
  const response = NextResponse.redirect(youtubeAuthorizeUrl(config.clientId, config.redirectUri, state))
  response.cookies.set(YOUTUBE_STATE_COOKIE, state, { httpOnly: true, secure: true, sameSite: 'lax', path: '/api/marketing/google', maxAge: 600 })
  return response
}

export async function DELETE(request: NextRequest) {
  const denied = requireAdmin(request)
  if (denied) return denied
  await disconnectYoutube()
  await recordYoutubeOAuthResult(true, 'YouTubeとの連携を外しました。')
  return NextResponse.json({ ok: true })
}
