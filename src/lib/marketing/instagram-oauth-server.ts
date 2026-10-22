/**
 * 「Instagramとつなぐ」ボタン（Instagramビジネスログイン / OAuth）
 *
 * 流れ:
 * 1. /api/marketing/instagram/connect（管理者のみ）… stateをCookieに入れてInstagramの許可画面へ
 * 2. 院長がInstagramで「許可」→ /api/marketing/instagram/callback?code=…&state=…
 * 3. サーバーで code → 短期トークン → 長期トークン（約60日）に交換し、KVに保存（人はトークンを見ない・コピーしない）
 *
 * 必要な環境変数: INSTAGRAM_APP_ID（Metaの「InstagramアプリID」）/ INSTAGRAM_APP_SECRET（「Instagram app secret」）
 * Metaのアプリ側に、コールバックURLを「OAuthリダイレクトURI」として登録しておくこと。
 */
export const IG_OAUTH_SCOPES = ['instagram_business_basic', 'instagram_business_content_publish'] as const
export const IG_STATE_COOKIE = 'ig_oauth_state'
export const IG_CALLBACK_PATH = '/api/marketing/instagram/callback'

export function instagramOAuthConfig(origin: string) {
  const appId = process.env.INSTAGRAM_APP_ID ?? ''
  const appSecret = process.env.INSTAGRAM_APP_SECRET ?? ''
  // 本番は固定のURL（Metaに登録したものと完全一致させる）。プレビュー等では今のオリジン
  const base = process.env.INSTAGRAM_OAUTH_REDIRECT_BASE ?? origin
  return { appId, appSecret, redirectUri: `${base}${IG_CALLBACK_PATH}`, ready: Boolean(appId && appSecret) }
}

export function authorizeUrl(appId: string, redirectUri: string, state: string): string {
  const qs = new URLSearchParams({
    client_id: appId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: IG_OAUTH_SCOPES.join(','),
    state,
  })
  return `https://www.instagram.com/oauth/authorize?${qs.toString()}`
}

type ShortTokenResponse = {
  access_token?: string
  user_id?: string | number
  data?: Array<{ access_token?: string; user_id?: string | number }>
  error_message?: string
  error?: { message?: string } | string
}

function errorText(data: { error_message?: string; error?: { message?: string } | string }, status: number): string {
  if (data.error_message) return data.error_message
  if (typeof data.error === 'string') return data.error
  return data.error?.message ?? `HTTP ${status}`
}

/** code → 長期トークン → 投稿先のユーザーID・ユーザー名まで取得する */
export async function exchangeCode(input: { code: string; appId: string; appSecret: string; redirectUri: string }) {
  // 1) 認可コード → 短期トークン（1時間）
  const form = new URLSearchParams({
    client_id: input.appId,
    client_secret: input.appSecret,
    grant_type: 'authorization_code',
    redirect_uri: input.redirectUri,
    code: input.code,
  })
  const shortRes = await fetch('https://api.instagram.com/oauth/access_token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form.toString(),
    cache: 'no-store',
    signal: AbortSignal.timeout(10000),
  })
  const shortData = (await shortRes.json().catch(() => ({}))) as ShortTokenResponse
  const short = shortData.access_token ?? shortData.data?.[0]?.access_token
  if (!shortRes.ok || !short) throw new Error(`短期トークンの取得に失敗: ${errorText(shortData, shortRes.status)}`)

  // 2) 短期 → 長期トークン（約60日。以後は定期実行が7日ごとに延長）
  const longRes = await fetch(
    `https://graph.instagram.com/access_token?grant_type=ig_exchange_token&client_secret=${encodeURIComponent(input.appSecret)}&access_token=${encodeURIComponent(short)}`,
    { cache: 'no-store', signal: AbortSignal.timeout(10000) },
  )
  const longData = (await longRes.json().catch(() => ({}))) as { access_token?: string; expires_in?: number; error?: { message?: string } }
  if (!longRes.ok || !longData.access_token) throw new Error(`長期トークンへの交換に失敗: ${errorText(longData, longRes.status)}`)

  // 3) 投稿に使うプロアカウントのIDとユーザー名
  const meRes = await fetch(
    `https://graph.instagram.com/v21.0/me?fields=user_id,username&access_token=${encodeURIComponent(longData.access_token)}`,
    { cache: 'no-store', signal: AbortSignal.timeout(8000) },
  )
  const me = (await meRes.json().catch(() => ({}))) as { user_id?: string | number; id?: string; username?: string; error?: { message?: string } }
  if (!meRes.ok) throw new Error(`アカウント情報の取得に失敗: ${errorText(me, meRes.status)}`)

  return {
    token: longData.access_token,
    expiresIn: longData.expires_in,
    userId: me.user_id !== undefined ? String(me.user_id) : me.id,
    username: me.username,
  }
}
