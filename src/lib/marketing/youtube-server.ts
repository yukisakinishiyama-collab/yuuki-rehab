/**
 * YouTube（ショート動画のアップロード）の連携（サーバー専用）
 *
 * つなぎ方: 自動投稿の設定の「YouTubeとつなぐ」（院長のみ）→ Google の許可画面 → 戻り先は
 *   Googleビジネスプロフィールと同じ /api/marketing/google/callback（state の頭が "yt." のときだけ、こちらで受ける。
 *   Google Cloud に登録済みの戻り先をそのまま使うので、設定の追加は要らない）。
 *   OAuth クライアントも同じ（GBP_CLIENT_ID / GBP_CLIENT_SECRET）。Google Cloud で「YouTube Data API v3」を有効にしておくこと。
 * 許可をもらう範囲: 動画のアップロード（youtube.upload）と、チャンネル名の表示（youtube.readonly）だけ。
 * トークンは Googleビジネスプロフィールとは別に持つ（KV の yt:oauth）。YouTube のチャンネルは、
 *   Googleビジネスプロフィールとは別のアカウント（ブランドアカウント）のことがあるため。画面・ログには出さない。
 *
 * 大事な決まり（YouTube）: 審査（YouTube API サービスの利用確認）に通っていないアプリから送った動画は
 *   「非公開」に固定され、あとから公開に直せない。そのため、設定の「審査に通った」がオンになるまで、アプリからは送らない
 *   （publishers.ts。それまでは動画と文を院長のLINEへ届けて、手で投稿してもらう）。
 */
import { kvDelete, kvGet, kvSet } from './kv-store-server'

export const YOUTUBE_SCOPES = ['https://www.googleapis.com/auth/youtube.upload', 'https://www.googleapis.com/auth/youtube.readonly']
export const YOUTUBE_STATE_COOKIE = 'yt_oauth_state'
export const YOUTUBE_STATE_PREFIX = 'yt.'

const KEY = 'yt:oauth'
const RESULT_KEY = 'yt:oauth:last'

type StoredYoutube = { refreshToken: string; channelId?: string; channelTitle?: string; connectedAt: string }

export function youtubeAuthorizeUrl(clientId: string, redirectUri: string, state: string): string {
  const qs = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: YOUTUBE_SCOPES.join(' '),
    access_type: 'offline',
    prompt: 'consent',
    state,
  })
  return `https://accounts.google.com/o/oauth2/v2/auth?${qs.toString()}`
}

export async function saveYoutubeConnection(input: { refreshToken: string; channelId?: string; channelTitle?: string }): Promise<void> {
  await kvSet(KEY, { ...input, connectedAt: new Date().toISOString() } satisfies StoredYoutube)
}

export async function disconnectYoutube(): Promise<void> {
  await kvDelete(KEY)
}

export type YoutubeCredentials = { clientId: string; clientSecret: string; refreshToken: string; channelId?: string; channelTitle?: string }

export async function getYoutubeCredentials(): Promise<YoutubeCredentials | null> {
  const clientId = process.env.GBP_CLIENT_ID ?? ''
  const clientSecret = process.env.GBP_CLIENT_SECRET ?? ''
  if (!clientId || !clientSecret) return null
  const stored = await kvGet<StoredYoutube>(KEY).catch(() => null)
  if (!stored?.refreshToken) return null
  return { clientId, clientSecret, refreshToken: stored.refreshToken, channelId: stored.channelId, channelTitle: stored.channelTitle }
}

/** 画面に出す接続の状態（秘密の値は入れない） */
export async function youtubeStatus(): Promise<{ connected: boolean; channelTitle: string | null; clientReady: boolean; last: YoutubeOAuthResult | null }> {
  const creds = await getYoutubeCredentials()
  return {
    connected: Boolean(creds),
    channelTitle: creds?.channelTitle ?? null,
    clientReady: Boolean(process.env.GBP_CLIENT_ID && process.env.GBP_CLIENT_SECRET),
    last: await lastYoutubeOAuthResult(),
  }
}

export type YoutubeOAuthResult = { ok: boolean; message: string; at: string }

export async function recordYoutubeOAuthResult(ok: boolean, message: string): Promise<void> {
  try {
    await kvSet(RESULT_KEY, { ok, message: message.slice(0, 300), at: new Date().toISOString() } satisfies YoutubeOAuthResult)
  } catch {
    /* 表示用なので保存失敗は無視 */
  }
}

export async function lastYoutubeOAuthResult(): Promise<YoutubeOAuthResult | null> {
  try {
    const r = await kvGet<YoutubeOAuthResult>(RESULT_KEY)
    if (!r) return null
    return Date.now() - new Date(r.at).getTime() < 24 * 60 * 60 * 1000 ? r : null
  } catch {
    return null
  }
}

/** 接続が切れている（許可の取り消し・期限切れ）。やり直しても直らないので、手で投稿してもらう */
export class YoutubeAuthError extends Error {}

type GoogleError = { error?: { message?: string; errors?: Array<{ reason?: string }> } | string; error_description?: string }

function googleMessage(data: GoogleError, status: number): string {
  if (typeof data.error === 'string') return data.error_description ?? data.error
  const reason = data.error?.errors?.[0]?.reason
  if (reason === 'accessNotConfigured') return 'Google Cloud で「YouTube Data API v3」が有効になっていません'
  if (reason === 'youtubeSignupRequired') return 'この Google アカウントに YouTube のチャンネルがありません'
  if (reason === 'quotaExceeded' || reason === 'uploadLimitExceeded') return '今日アップロードできる本数の上限に達しました'
  return data.error?.message ?? `HTTP ${status}`
}

export async function youtubeAccessToken(creds: Pick<YoutubeCredentials, 'clientId' | 'clientSecret' | 'refreshToken'>): Promise<string> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: creds.clientId, client_secret: creds.clientSecret, refresh_token: creds.refreshToken, grant_type: 'refresh_token' }),
    cache: 'no-store',
    signal: AbortSignal.timeout(15_000),
  })
  const data = (await res.json().catch(() => ({}))) as { access_token?: string } & GoogleError
  if (!res.ok || !data.access_token) throw new YoutubeAuthError(`YouTubeの接続が切れています（${googleMessage(data, res.status)}）`)
  return data.access_token
}

/** つないだアカウントのチャンネル（無ければ null） */
export async function fetchMyChannel(accessToken: string): Promise<{ id: string; title: string } | null> {
  const res = await fetch('https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true', {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: 'no-store',
    signal: AbortSignal.timeout(15_000),
  })
  const data = (await res.json().catch(() => ({}))) as { items?: Array<{ id?: string; snippet?: { title?: string } }> } & GoogleError
  if (!res.ok) throw new Error(googleMessage(data, res.status))
  const item = data.items?.[0]
  return item?.id ? { id: item.id, title: item.snippet?.title ?? '' } : null
}

export interface YoutubeUpload {
  title: string
  description: string
  tags: string[]
  /** mp4 の中身 */
  bytes: Uint8Array
}

/** YouTube に送る動画の情報（公開・子ども向けではない・AIで作った映像ではない＝院の本物の写真） */
export function youtubeVideoResource(input: Pick<YoutubeUpload, 'title' | 'description' | 'tags'>) {
  return {
    snippet: {
      title: input.title.replace(/[<>]/g, '').slice(0, 100),
      description: input.description.replace(/[<>]/g, '').slice(0, 4900),
      tags: input.tags.slice(0, 15),
      // 26 = ハウツーとスタイル
      categoryId: '26',
      defaultLanguage: 'ja',
      defaultAudioLanguage: 'ja',
    },
    status: { privacyStatus: 'public', selfDeclaredMadeForKids: false, containsSyntheticMedia: false, embeddable: true },
  }
}

/**
 * 動画を1本アップロードする（再開できるアップロードの手順：受付 → 本体を送る）。
 * 縦で3分までの動画は、YouTube が自動でショートとして扱う。返すのはショートのURL
 */
export async function uploadYoutubeVideo(accessToken: string, input: YoutubeUpload): Promise<{ id: string; url: string; privacyStatus?: string }> {
  const start = await fetch('https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json; charset=UTF-8',
      'X-Upload-Content-Type': 'video/mp4',
      'X-Upload-Content-Length': String(input.bytes.length),
    },
    body: JSON.stringify(youtubeVideoResource(input)),
    cache: 'no-store',
    signal: AbortSignal.timeout(30_000),
  })
  if (start.status === 401) throw new YoutubeAuthError('YouTubeの接続が切れています（許可の期限切れ）')
  const session = start.headers.get('location')
  if (!start.ok || !session) {
    const data = (await start.json().catch(() => ({}))) as GoogleError
    throw new Error(`YouTubeがアップロードを受け付けませんでした（${googleMessage(data, start.status)}）`)
  }
  const put = await fetch(session, {
    method: 'PUT',
    headers: { 'Content-Type': 'video/mp4', 'Content-Length': String(input.bytes.length) },
    body: input.bytes as unknown as BodyInit,
    cache: 'no-store',
    signal: AbortSignal.timeout(180_000),
  })
  const data = (await put.json().catch(() => ({}))) as { id?: string; status?: { privacyStatus?: string } } & GoogleError
  if (!put.ok || !data.id) throw new Error(`YouTubeへのアップロードに失敗しました（${googleMessage(data, put.status)}）`)
  return { id: data.id, url: `https://www.youtube.com/shorts/${data.id}`, privacyStatus: data.status?.privacyStatus }
}
