/**
 * 「Googleとつなぐ」の戻り先（Googleから呼ばれるため認証の対象外。stateのCookie一致で保護）
 *
 * - stateが /connect（院長のみ）で発行したものと一致したときだけ処理する
 * - code をリフレッシュトークンに交換し、投稿先の店舗を自動で探してKVに保存。トークンは画面にもログにも出さない
 * - 結果は投稿ジョブ画面の接続状況に表示し、そこへ戻す
 */
import { NextRequest, NextResponse } from 'next/server'
import { exchangeGbpCode, findGbpLocations, GBP_STATE_COOKIE, gbpOAuthConfig, pickClinicLocation } from '@/lib/marketing/gbp-oauth-server'
import { recordGbpOAuthResult, saveGbpConnection } from '@/lib/marketing/gbp-token'

export const dynamic = 'force-dynamic'

function back(request: NextRequest) {
  const response = NextResponse.redirect(new URL('/marketing/jobs', request.url))
  response.cookies.set(GBP_STATE_COOKIE, '', { httpOnly: true, secure: true, sameSite: 'lax', path: '/api/marketing/google', maxAge: 0 })
  return response
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams
  const expected = request.cookies.get(GBP_STATE_COOKIE)?.value
  const state = params.get('state')

  if (!expected || !state || state !== expected) {
    await recordGbpOAuthResult(false, '確認の情報が一致しませんでした。もう一度「Googleとつなぐ」から始めてください。')
    return back(request)
  }
  if (params.get('error')) {
    await recordGbpOAuthResult(false, `Googleで許可されませんでした（${(params.get('error') ?? '').slice(0, 80)}）。`)
    return back(request)
  }
  const code = params.get('code') ?? ''
  if (!code) {
    await recordGbpOAuthResult(false, 'Googleから認可コードが届きませんでした。もう一度お試しください。')
    return back(request)
  }

  const config = gbpOAuthConfig(request.nextUrl.origin)
  if (!config.ready) {
    await recordGbpOAuthResult(false, 'GBP_CLIENT_ID / GBP_CLIENT_SECRET が未設定です。')
    return back(request)
  }

  try {
    const { accessToken, refreshToken } = await exchangeGbpCode({
      code,
      clientId: config.clientId,
      clientSecret: config.clientSecret,
      redirectUri: config.redirectUri,
    })
    let locations: Awaited<ReturnType<typeof findGbpLocations>> = []
    let lookupError = ''
    try {
      locations = await findGbpLocations(accessToken)
    } catch (error) {
      lookupError = error instanceof Error ? error.message : '店舗を探せませんでした'
    }
    const picked = pickClinicLocation(locations)
    await saveGbpConnection({ refreshToken, locationName: picked?.name, locationTitle: picked?.title })
    if (!picked) {
      await recordGbpOAuthResult(
        false,
        `Googleの許可は受け取りましたが、投稿先の店舗が見つかりませんでした${lookupError ? `（${lookupError}）` : ''}。ビジネスプロフィールのオーナーのアカウントでつなぎ直してください。`,
      )
    } else {
      const more = locations.length > 1 ? `（${locations.length}件のうち「${picked.title}」を選びました）` : ''
      await recordGbpOAuthResult(true, `Googleビジネスプロフィール「${picked.title || '店舗'}」とつながりました${more}。承認した投稿は予定の時刻に自動で公開されます。`)
    }
  } catch (error) {
    await recordGbpOAuthResult(false, error instanceof Error ? error.message : 'つなぐ処理に失敗しました。')
  }
  return back(request)
}
