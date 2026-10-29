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
  connectedAt: string
}

async function readStored(): Promise<StoredGbp | null> {
  try {
    return (await kvGet<StoredGbp>(KEY)) ?? null
  } catch {
    return null
  }
}

export async function saveGbpConnection(input: { refreshToken: string; locationName?: string; locationTitle?: string }) {
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
