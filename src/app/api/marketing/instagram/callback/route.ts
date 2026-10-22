/**
 * 「Instagramとつなぐ」の戻り先（Instagramから呼ばれるため認証の対象外。stateのCookie一致で保護）
 *
 * - stateが /connect（院長のみ）で発行したものと一致したときだけ処理する
 * - code を長期トークンに交換してKVに保存。トークンは画面にもログにも出さない
 * - 結果は接続状況の画面に表示し、そこへ戻す
 */
import { NextRequest, NextResponse } from 'next/server'
import { exchangeCode, IG_STATE_COOKIE, instagramOAuthConfig } from '@/lib/marketing/instagram-oauth-server'
import { saveOAuthToken } from '@/lib/marketing/instagram-token'
import { recordOAuthResult } from '@/lib/marketing/instagram-oauth-result'

export const dynamic = 'force-dynamic'

function back(request: NextRequest) {
  const response = NextResponse.redirect(new URL('/marketing/jobs', request.url))
  response.cookies.set(IG_STATE_COOKIE, '', { httpOnly: true, secure: true, sameSite: 'lax', path: '/api/marketing/instagram', maxAge: 0 })
  return response
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams
  const expected = request.cookies.get(IG_STATE_COOKIE)?.value
  const state = params.get('state')

  if (!expected || !state || state !== expected) {
    await recordOAuthResult(false, '確認の情報が一致しませんでした。もう一度「Instagramとつなぐ」から始めてください。')
    return back(request)
  }
  if (params.get('error')) {
    const reason = params.get('error_description') || params.get('error_reason') || params.get('error') || ''
    await recordOAuthResult(false, `Instagramで許可されませんでした（${reason.slice(0, 120)}）。`)
    return back(request)
  }
  const code = (params.get('code') ?? '').replace(/#_$/, '')
  if (!code) {
    await recordOAuthResult(false, 'Instagramから認可コードが届きませんでした。もう一度お試しください。')
    return back(request)
  }

  const config = instagramOAuthConfig(request.nextUrl.origin)
  if (!config.ready) {
    await recordOAuthResult(false, 'INSTAGRAM_APP_ID / INSTAGRAM_APP_SECRET が未設定です。')
    return back(request)
  }

  try {
    const result = await exchangeCode({ code, appId: config.appId, appSecret: config.appSecret, redirectUri: config.redirectUri })
    await saveOAuthToken(result)
    // つないだ日のフォロワー数をその場で記録（失敗しても接続は成功扱い）
    try {
      const { recordInstagramFollowers } = await import('@/lib/marketing/instagram-stats-server')
      const { jstParts } = await import('@/lib/marketing/autopilot-planner')
      await recordInstagramFollowers(jstParts(new Date()).date)
    } catch {
      /* 記録は翌日の定期実行でも行われる */
    }
    await recordOAuthResult(true, `Instagram${result.username ? `（@${result.username}）` : ''}とつながりました。承認した投稿は自動で公開されます。`)
  } catch (error) {
    await recordOAuthResult(false, error instanceof Error ? error.message : 'つなぐ処理に失敗しました。')
  }
  return back(request)
}
