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
/** Search Console（ホームページの検索キーワード・掲載順位）を読む権限。2026-11-11 から一緒にもらう */
export const GSC_SCOPE = 'https://www.googleapis.com/auth/webmasters.readonly'
export const GOOGLE_SCOPES = [GBP_SCOPE, GSC_SCOPE]
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
    scope: GOOGLE_SCOPES.join(' '),
    // 前にもらった権限も引きつぐ
    include_granted_scopes: 'true',
    // リフレッシュトークンを必ず受け取るため（つなぎ直しでも毎回発行される）
    access_type: 'offline',
    prompt: 'consent',
    state,
  })
  return `https://accounts.google.com/o/oauth2/v2/auth?${qs.toString()}`
}

type TokenResponse = { access_token?: string; refresh_token?: string; scope?: string; error?: string; error_description?: string }

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
  return { accessToken: data.access_token, refreshToken: data.refresh_token, scopes: (data.scope ?? '').split(/\s+/).filter(Boolean) }
}

export type GbpLocation = {
  name: string
  title: string
  /** 投稿できる（Googleの metadata.canOperateLocalPost） */
  canPost?: boolean
  /** オーナー確認済み（metadata.hasVoiceOfMerchant） */
  verified?: boolean
  /** ほかの店舗の重複として扱われている（metadata.duplicateLocation がある） */
  duplicate?: boolean
}

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
      `https://mybusinessbusinessinformation.googleapis.com/v1/${account.name}/locations?readMask=name,title,metadata&pageSize=100`,
      { headers, cache: 'no-store', signal: AbortSignal.timeout(10000) },
    )
    const locData = (await locRes.json().catch(() => ({}))) as {
      locations?: Array<{
        name?: string
        title?: string
        metadata?: { canOperateLocalPost?: boolean; hasVoiceOfMerchant?: boolean; duplicateLocation?: string }
      }>
    }
    if (!locRes.ok) continue
    for (const loc of locData.locations ?? []) {
      const id = loc.name?.match(/^locations\/(\d+)$/)?.[1]
      if (id)
        found.push({
          name: `${account.name}/locations/${id}`,
          title: loc.title ?? '',
          canPost: loc.metadata?.canOperateLocalPost,
          verified: loc.metadata?.hasVoiceOfMerchant,
          duplicate: Boolean(loc.metadata?.duplicateLocation),
        })
    }
  }
  return found
}

/**
 * 店舗が複数あるときは、院名を含み・投稿できて・オーナー確認済みで・重複ではないものを選ぶ。
 * （同じ名前の「ゆうき整骨院」が重複で2件あっても、投稿できる本物の方を選ぶ。2026-11-11）
 */
export function pickClinicLocation(locations: GbpLocation[]): GbpLocation | null {
  if (locations.length === 0) return null
  const score = (l: GbpLocation) =>
    (/ゆうき/.test(l.title) ? 8 : 0) + (l.canPost ? 4 : 0) + (l.verified ? 2 : 0) + (l.duplicate ? 0 : 1)
  return [...locations].sort((a, b) => score(b) - score(a))[0]
}
