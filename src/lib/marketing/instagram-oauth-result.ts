/** 「Instagramとつなぐ」の直近の結果（接続状況の画面に1日だけ表示する。トークン等の秘密は入れない） */
import { kvGet, kvSet } from './kv-store-server'

const KEY = 'ig:oauth:last'

export type OAuthResult = { ok: boolean; message: string; at: string }

export async function recordOAuthResult(ok: boolean, message: string): Promise<void> {
  try {
    await kvSet(KEY, { ok, message: message.slice(0, 300), at: new Date().toISOString() } satisfies OAuthResult)
  } catch {
    /* 表示用なので保存失敗は無視 */
  }
}

export async function lastOAuthResult(): Promise<OAuthResult | null> {
  try {
    const r = await kvGet<OAuthResult>(KEY)
    if (!r) return null
    return Date.now() - new Date(r.at).getTime() < 24 * 60 * 60 * 1000 ? r : null
  } catch {
    return null
  }
}
