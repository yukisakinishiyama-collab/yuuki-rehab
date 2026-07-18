/**
 * Instagramアクセストークンの管理（Instagramログイン方式）
 *
 * - 長期トークンは約60日で失効するため、KVに保持して定期的に延長する
 * - 初回は環境変数 INSTAGRAM_ACCESS_TOKEN をシードとして保存
 * - 環境変数が差し替えられた場合（トークン再発行時）は新しい値で再シード
 */
import { kvGet, kvSet } from './kv-store-server'

const KEY = 'ig:token'
const REFRESH_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000 // 7日ごとに延長（60日期限に対し十分な余裕）

/** Instagramログイン方式のAPIホスト（Facebookログイン方式に切り替える場合のみ上書き） */
export const INSTAGRAM_GRAPH_HOST = process.env.INSTAGRAM_API_HOST ?? 'https://graph.instagram.com'

type StoredToken = {
  token: string
  /** シード元の環境変数値。envが差し替えられたことの検出に使う */
  envSeed: string
  refreshedAt: string
  expiresAt?: string
}

/** 現在有効なアクセストークンを返す（未設定ならnull） */
export async function getInstagramToken(): Promise<string | null> {
  const envToken = process.env.INSTAGRAM_ACCESS_TOKEN
  if (!envToken) return null
  try {
    const stored = await kvGet<StoredToken>(KEY)
    if (!stored || stored.envSeed !== envToken) {
      await kvSet(KEY, {
        token: envToken,
        envSeed: envToken,
        refreshedAt: new Date().toISOString(),
      } satisfies StoredToken)
      return envToken
    }
    return stored.token
  } catch {
    return envToken
  }
}

/**
 * 60日期限対策: 前回延長から7日経過していたらトークンを延長する。
 * ジョブ実行時に呼ぶ。失敗してもジョブ本体は止めない（ログのみ）。
 * ※Metaの仕様で発行から24時間未満のトークンは延長できないが、
 *   7日間隔の判定によりその状況では呼ばれない。
 */
export async function refreshInstagramTokenIfNeeded(): Promise<void> {
  const envToken = process.env.INSTAGRAM_ACCESS_TOKEN
  if (!envToken) return
  try {
    const current = await getInstagramToken()
    if (!current) return
    const stored = await kvGet<StoredToken>(KEY)
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
      token: data.access_token,
      envSeed: envToken,
      refreshedAt: new Date().toISOString(),
      expiresAt: data.expires_in ? new Date(Date.now() + data.expires_in * 1000).toISOString() : undefined,
    } satisfies StoredToken)
    console.log('IGトークンを延長しました')
  } catch (error) {
    console.error('IGトークン延長でエラー:', error instanceof Error ? error.message : error)
  }
}
