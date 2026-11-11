/**
 * Googleビジネスプロフィール（投稿）の接続情報
 *
 * 入手方法は2つ:
 * 1. 投稿ジョブ画面の「Googleとつなぐ」ボタン（OAuth）… 院長が許可すると、リフレッシュトークンと投稿先の店舗をKVに保存
 * 2. 環境変数 GBP_REFRESH_TOKEN / GBP_LOCATION_NAME … 手で設定した場合はこちらを優先
 *
 * どちらの場合も GBP_CLIENT_ID / GBP_CLIENT_SECRET（Vercelの環境変数）が必要。
 * トークンは画面・ログ・APIの返り値に出さない。
 */
import { kvGet, kvSet } from './kv-store-server'

const KEY = 'gbp:oauth'
const RESULT_KEY = 'gbp:oauth:last'
const LOCATION_RE = /^accounts\/\d+\/locations\/\d+$/

type StoredGbp = {
  refreshToken: string
  locationName?: string
  locationTitle?: string
  /** Googleで許可された権限（ビジネスプロフィール・Search Console など）。古い接続には無い */
  scopes?: string[]
  connectedAt: string
}

async function readStored(): Promise<StoredGbp | null> {
  try {
    return (await kvGet<StoredGbp>(KEY)) ?? null
  } catch {
    return null
  }
}

export async function saveGbpConnection(input: { refreshToken: string; locationName?: string; locationTitle?: string; scopes?: string[] }) {
  await kvSet(KEY, { ...input, connectedAt: new Date().toISOString() } satisfies StoredGbp)
}

export type GbpCredentials = { clientId: string; clientSecret: string; refreshToken: string; location: string }

/** 投稿に必要な値がそろっていれば返す（環境変数が優先、なければ「つなぐ」で保存した値） */
export async function getGbpCredentials(): Promise<GbpCredentials | null> {
  const clientId = process.env.GBP_CLIENT_ID ?? ''
  const clientSecret = process.env.GBP_CLIENT_SECRET ?? ''
  if (!clientId || !clientSecret) return null
  const stored = process.env.GBP_REFRESH_TOKEN && process.env.GBP_LOCATION_NAME ? null : await readStored()
  const refreshToken = process.env.GBP_REFRESH_TOKEN || stored?.refreshToken || ''
  const location = process.env.GBP_LOCATION_NAME || stored?.locationName || ''
  if (!refreshToken || !LOCATION_RE.test(location)) return null
  return { clientId, clientSecret, refreshToken, location }
}

export async function isGbpConnected(): Promise<boolean> {
  return (await getGbpCredentials()) !== null
}

/** 接続状況の画面に出す店舗名（秘密ではない） */
export async function gbpLocationTitle(): Promise<string | null> {
  if (process.env.GBP_LOCATION_NAME) return null
  return (await readStored())?.locationTitle ?? null
}

export type GbpOAuthResult = { ok: boolean; message: string; at: string }

/** 「Googleとつなぐ」の直近の結果（1日だけ表示する。秘密の値は入れない） */
export async function recordGbpOAuthResult(ok: boolean, message: string): Promise<void> {
  try {
    await kvSet(RESULT_KEY, { ok, message: message.slice(0, 300), at: new Date().toISOString() } satisfies GbpOAuthResult)
  } catch {
    /* 表示用なので保存失敗は無視 */
  }
}

export async function lastGbpOAuthResult(): Promise<GbpOAuthResult | null> {
  try {
    const r = await kvGet<GbpOAuthResult>(RESULT_KEY)
    if (!r) return null
    return Date.now() - new Date(r.at).getTime() < 24 * 60 * 60 * 1000 ? r : null
  } catch {
    return null
  }
}

/** 接続情報からアクセストークンを取る（失敗したら院長に見せる言葉で投げる） */
export async function gbpAccessToken(credentials: GbpCredentials): Promise<string> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: credentials.clientId,
      client_secret: credentials.clientSecret,
      refresh_token: credentials.refreshToken,
      grant_type: 'refresh_token',
    }),
    cache: 'no-store',
    signal: AbortSignal.timeout(10000),
  })
  const data = (await res.json().catch(() => ({}))) as { access_token?: string; error_description?: string; error?: string }
  if (!res.ok || !data.access_token) {
    throw new Error(`Googleの接続が切れています（${data.error_description ?? data.error ?? res.status}）。「Googleとつなぐ」からつなぎ直してください。`)
  }
  return data.access_token
}

/** 「Googleとつなぐ」で、その権限（例：Search Console を読む）も許可されているか */
export async function hasGoogleScope(scope: string): Promise<boolean> {
  if (process.env.GBP_REFRESH_TOKEN) return false
  const stored = await readStored()
  return Boolean(stored?.refreshToken && stored.scopes?.includes(scope))
}

/** Search Console などを読むためのアクセストークン（「Googleとつなぐ」で保存したリフレッシュトークンを使う） */
export async function googleAccessTokenFor(scope: string): Promise<string | null> {
  const clientId = process.env.GBP_CLIENT_ID ?? ''
  const clientSecret = process.env.GBP_CLIENT_SECRET ?? ''
  if (!clientId || !clientSecret || !(await hasGoogleScope(scope))) return null
  const stored = await readStored()
  if (!stored) return null
  return gbpAccessToken({ clientId, clientSecret, refreshToken: stored.refreshToken, location: stored.locationName ?? '' })
}
