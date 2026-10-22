/**
 * Instagramアクセストークンの管理（Instagramログイン方式）
 *
 * トークンの入手方法は2つ:
 * 1. ハブの「Instagramとつなぐ」ボタン（OAuth）… 院長が許可するとサーバーが長期トークンに交換してKVに保存
 *    （INSTAGRAM_APP_ID / INSTAGRAM_APP_SECRET が必要。トークンを人がコピーしなくてよい）
 * 2. 環境変数 INSTAGRAM_ACCESS_TOKEN（Metaの画面で生成したもの）… 初回にKVへシード
 *
 * - 長期トークンは約60日で失効するため、KVに保持して7日ごとに延長する
 * - 環境変数が差し替えられた場合（トークン再発行時）は新しい値を優先して再シード
 * - InstagramユーザーIDは INSTAGRAM_USER_ID、なければOAuth時に保存した値
 */
import { kvGet, kvSet } from './kv-store-server'

const KEY = 'ig:token'
const REFRESH_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000 // 7日ごとに延長（60日期限に対し十分な余裕）

/** Instagramログイン方式のAPIホスト（Facebookログイン方式に切り替える場合のみ上書き） */
export const INSTAGRAM_GRAPH_HOST = process.env.INSTAGRAM_API_HOST ?? 'https://graph.instagram.com'

export type StoredToken = {
  token: string
  /** 保存時点の環境変数値（なければ空文字）。envが差し替えられたことの検出に使う */
  envSeed: string
  refreshedAt: string
  expiresAt?: string
  /** 'oauth' = ハブの「Instagramとつなぐ」で取得 / 'env' = 環境変数から */
  source?: 'env' | 'oauth'
  userId?: string
  username?: string
}

export async function readStoredToken(): Promise<StoredToken | null> {
  try {
    return (await kvGet<StoredToken>(KEY)) ?? null
  } catch {
    return null
  }
}

/** 「Instagramとつなぐ」で取得したトークンを保存する */
export async function saveOAuthToken(input: { token: string; expiresIn?: number; userId?: string; username?: string }) {
  await kvSet(KEY, {
    token: input.token,
    envSeed: process.env.INSTAGRAM_ACCESS_TOKEN ?? '',
    refreshedAt: new Date().toISOString(),
    expiresAt: input.expiresIn ? new Date(Date.now() + input.expiresIn * 1000).toISOString() : undefined,
    source: 'oauth',
    userId: input.userId,
    username: input.username,
  } satisfies StoredToken)
}

/** 現在有効なアクセストークンを返す（未設定ならnull） */
export async function getInstagramToken(): Promise<string | null> {
  const envToken = process.env.INSTAGRAM_ACCESS_TOKEN ?? ''
  const stored = await readStoredToken()

  // 「つなぐ」ボタンで取得済み（その後に環境変数が差し替えられていなければ、こちらを使う）
  if (stored?.source === 'oauth' && stored.envSeed === envToken) return stored.token
  if (!envToken) return stored?.source === 'oauth' ? stored.token : null

  try {
    if (!stored || stored.envSeed !== envToken) {
      await kvSet(KEY, {
        token: envToken,
        envSeed: envToken,
        refreshedAt: new Date().toISOString(),
        source: 'env',
      } satisfies StoredToken)
      return envToken
    }
    return stored.token
  } catch {
    return envToken
  }
}

/** 投稿先のInstagramユーザーID（環境変数が優先、なければ「つなぐ」で保存した値） */
export async function getInstagramUserId(): Promise<string | null> {
  if (process.env.INSTAGRAM_USER_ID) return process.env.INSTAGRAM_USER_ID
  const stored = await readStoredToken()
  return stored?.userId ?? null
}

/** 投稿に必要なトークンとユーザーIDがそろっているか */
export async function isInstagramConnected(): Promise<boolean> {
  const [token, userId] = await Promise.all([getInstagramToken(), getInstagramUserId()])
  return Boolean(token && userId)
}

/**
 * 60日期限対策: 前回延長から7日経過していたらトークンを延長する。
 * ジョブ実行時に呼ぶ。失敗してもジョブ本体は止めない（ログのみ）。
 * ※Metaの仕様で発行から24時間未満のトークンは延長できないが、
 *   7日間隔の判定によりその状況では呼ばれない。
 */
export async function refreshInstagramTokenIfNeeded(): Promise<void> {
  try {
    const current = await getInstagramToken()
    if (!current) return
    const stored = await readStoredToken()
    if (stored && Date.now() - new Date(stored.refreshedAt).getTime() < REFRESH_INTERVAL_MS) return

    const res = await fetch(
      `${INSTAGRAM_GRAPH_HOST}/refresh_access_token?grant_type=ig_refresh_token&access_token=${encodeURIComponent(current)}`
    )
    const data = (await res.json()) as { access_token?: string; expires_in?: number; error?: { message?: string } }
    if (!res.ok || !data.access_token) {
      console.error('IGトークン延長に失敗:', data.error?.message ?? `HTTP ${res.status}`)
      return
    }
    await kvSet(KEY, {
      ...(stored ?? {}),
      token: data.access_token,
      envSeed: stored?.envSeed ?? process.env.INSTAGRAM_ACCESS_TOKEN ?? '',
      refreshedAt: new Date().toISOString(),
      expiresAt: data.expires_in ? new Date(Date.now() + data.expires_in * 1000).toISOString() : undefined,
    } satisfies StoredToken)
    console.log('IGトークンを延長しました')
  } catch (error) {
    console.error('IGトークン延長でエラー:', error instanceof Error ? error.message : error)
  }
}
