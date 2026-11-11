/**
 * 「YouTubeとつなぐ」の戻り（/api/marketing/google/callback から、state の頭が "yt." のときに呼ばれる）
 *
 * - state が /api/marketing/youtube/connect（院長のみ）で発行したものと一致したときだけ処理する
 * - code をリフレッシュトークンに交換し、チャンネル名を確かめて KV に保存。トークンは画面にもログにも出さない
 * - 結果は自動投稿の設定の画面に出し、そこへ戻す
 */
import { NextRequest, NextResponse } from 'next/server'
import { exchangeGbpCode, gbpOAuthConfig } from './gbp-oauth-server'
import { fetchMyChannel, recordYoutubeOAuthResult, saveYoutubeConnection, YOUTUBE_STATE_COOKIE } from './youtube-server'

const BACK = '/marketing/autopilot?open=settings#promo-video'

function back(request: NextRequest) {
  const response = NextResponse.redirect(new URL(BACK, request.url))
  response.cookies.set(YOUTUBE_STATE_COOKIE, '', { httpOnly: true, secure: true, sameSite: 'lax', path: '/api/marketing/google', maxAge: 0 })
  return response
}

export async function handleYoutubeCallback(request: NextRequest): Promise<NextResponse> {
  const params = request.nextUrl.searchParams
  const expected = request.cookies.get(YOUTUBE_STATE_COOKIE)?.value
  const state = params.get('state')
  if (!expected || !state || state !== expected) {
    await recordYoutubeOAuthResult(false, '確認の情報が一致しませんでした。もう一度「YouTubeとつなぐ」から始めてください。')
    return back(request)
  }
  if (params.get('error')) {
    await recordYoutubeOAuthResult(false, `Googleで許可されませんでした（${(params.get('error') ?? '').slice(0, 80)}）。`)
    return back(request)
  }
  const code = params.get('code') ?? ''
  const config = gbpOAuthConfig(request.nextUrl.origin)
  if (!code || !config.ready) {
    await recordYoutubeOAuthResult(false, code ? 'GBP_CLIENT_ID / GBP_CLIENT_SECRET が未設定です。' : 'Googleから認可コードが届きませんでした。もう一度お試しください。')
    return back(request)
  }
  try {
    const { accessToken, refreshToken } = await exchangeGbpCode({ code, clientId: config.clientId, clientSecret: config.clientSecret, redirectUri: config.redirectUri })
    let channel: Awaited<ReturnType<typeof fetchMyChannel>> = null
    let lookupError = ''
    try {
      channel = await fetchMyChannel(accessToken)
    } catch (error) {
      lookupError = error instanceof Error ? error.message : 'チャンネルを確かめられませんでした'
    }
    if (!channel) {
      // チャンネルが無い・確かめられないときは保存しない（どこへ出すのか分からないまま自動で送らない）
      await recordYoutubeOAuthResult(
        false,
        lookupError
          ? `Googleの許可は受け取りましたが、YouTubeのチャンネルを確かめられませんでした（${lookupError}）。`
          : 'この Google アカウントには YouTube のチャンネルがありません。院のチャンネルを持つアカウントを選んで、つなぎ直してください。',
      )
      return back(request)
    }
    await saveYoutubeConnection({ refreshToken, channelId: channel.id, channelTitle: channel.title })
    await recordYoutubeOAuthResult(true, `YouTubeのチャンネル「${channel.title || channel.id}」とつながりました。`)
  } catch (error) {
    await recordYoutubeOAuthResult(false, error instanceof Error ? error.message : 'つなぐ処理に失敗しました。')
  }
  return back(request)
}
