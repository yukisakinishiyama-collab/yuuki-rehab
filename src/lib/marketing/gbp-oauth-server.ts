/**
 * 「Googleとつなぐ」ボタン（Googleビジネスプロフィールへの投稿連携 / OAuth）
 *
 * 流れ:
 * 1. /api/marketing/google/connect（院長のみ）… stateをCookieに入れてGoogleの許可画面へ
 * 2. 院長がGoogleで「許可」→ /api/marketing/google/callback?code=…&state=…
 * 3. サーバーで code → リフレッシュトークンに交換し、投稿先の店舗（accounts/…/locations/…）も自動で探してKVに保存
 *    （人はトークンや店舗IDを見ない・コピーしない）
 *
 * 必要な環境変数: GBP_CLIENT_ID / GBP_CLIENT_SECRET（Google Cloud「yuuki-marketing」のOAuthクライアント）
 * Google Cloud のOAuthクライアントに、コールバックURLを「承認済みのリダイレクトURI」として登録しておくこと。
 * 登録済み（2026-10-29）: クライアント「ゆうき整骨院 投稿連携」
 *   - https://yuuki-rehab.vercel.app/api/marketing/google/callback（このボタン用）
 *   - https://developers.google.com/oauthplayground（手で確かめるとき用の予備）
 * Vercelの環境変数を変えたら、再デプロイして初めて反映される。
 */
export const GBP_SCOPE = 'https://www.googleapis.com/auth/business.manage'
export const GBP_STATE_COOKIE = 'gbp_oauth_state'
export const GBP_CALLBACK_PATH = '/api/marketing/google/callback'

export function gbpOAuthConfig(origin: string) {
  const clientId = process.env.GBP_CLIENT_ID ?? ''
  const clientSecret = process.env.GBP_CLIENT_SECRET ?? ''
  // 本番はGoogleに登録したURLと完全一致させる（別のURLで開いた場合に備えて上書きできる）
  const base = process.env.GBP_OAUTH_REDIRECT_BASE ?? origin
  return { clientId, clientSecret, redirectUri: `${base}${GBP_CALLBACK_PATH}`, ready: Boolean(clientId && clientSecret) }
}

export function gbpAuthorizeUrl(clientId: string, redirectUri: string, state: string): string {
  const qs = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: GBP_SCOPE,
    // リフレッシュトークンを必ず受け取るため（つなぎ直しでも毎回発行される）
    access_type: 'offline',
    prompt: 'consent',
    state,
  })
  return `https://accounts.google.com/o/oauth2/v2/auth?${qs.toString()}`
}

type TokenResponse = { access_token?: string; refresh_token?: string; error?: string; error_description?: string }

/** 認可コード → リフレッシュトークン＋アクセストークン */
export async function exchangeGbpCode(input: { code: string; clientId: string; clientSecret: string; redirectUri: string }) {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code: input.code,
      client_id: input.clientId,
      client_secret: input.clientSecret,
      redirect_uri: input.redirectUri,
      grant_type: 'authorization_code',
    }).toString(),
    cache: 'no-store',
    signal: AbortSignal.timeout(10000),
  })
  const data = (await res.json().catch(() => ({}))) as TokenResponse
  if (!res.ok || !data.access_token) {
    throw new Error(`Googleの許可を受け取れませんでした（${data.error_description ?? data.error ?? `HTTP ${res.status}`}）`)
  }
  if (!data.refresh_token) {
    throw new Error('Googleからリフレッシュトークンが届きませんでした。もう一度「Googleとつなぐ」から始めてください。')
  }
  return { accessToken: data.access_token, refreshToken: data.refresh_token }
}

export type GbpLocation = { name: string; title: string }

/**
 * 院長のアカウントで管理している店舗を探す。
 * 返す name は投稿API（v4 localPosts）で使う 'accounts/{accountId}/locations/{locationId}' の形。
 */
export async function findGbpLocations(accessToken: string): Promise<GbpLocation[]> {
  const headers = { Authorization: `Bearer ${accessToken}` }
  const accRes = await fetch('https://mybusinessaccountmanagement.googleapis.com/v1/accounts?pageSize=20', {
    headers,
    cache: 'no-store',
    signal: AbortSignal.timeout(10000),
  })
  const accData = (await accRes.json().catch(() => ({}))) as { accounts?: Array<{ name?: string }>; error?: { message?: string } }
  if (!accRes.ok) throw new Error(`ビジネスプロフィールのアカウントを読めませんでした（${accData.error?.message ?? `HTTP ${accRes.status}`}）`)

  const found: GbpLocation[] = []
  for (const account of accData.accounts ?? []) {
    if (!account.name || !/^accounts\/\d+$/.test(account.name)) continue
    const locRes = await fetch(
      `https://mybusinessbusinessinformation.googleapis.com/v1/${account.name}/locations?readMask=name,title&pageSize=100`,
      { headers, cache: 'no-store', signal: AbortSignal.timeout(10000) },
    )
    const locData = (await locRes.json().catch(() => ({}))) as { locations?: Array<{ name?: string; title?: string }> }
    if (!locRes.ok) continue
    for (const loc of locData.locations ?? []) {
      const id = loc.name?.match(/^locations\/(\d+)$/)?.[1]
      if (id) found.push({ name: `${account.name}/locations/${id}`, title: loc.title ?? '' })
    }
  }
  return found
}

/** 店舗が複数あるときは院名を含むものを選ぶ（なければ最初の1件） */
export function pickClinicLocation(locations: GbpLocation[]): GbpLocation | null {
  if (locations.length === 0) return null
  return locations.find((l) => /ゆうき/.test(l.title)) ?? locations[0]
}
