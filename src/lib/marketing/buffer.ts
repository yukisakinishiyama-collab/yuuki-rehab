/**
 * Buffer（YouTube・TikTok へ動画を出す投稿サービス）との受け渡しの形（純粋な関数。node で単体テストできる）
 *
 * なぜ Buffer をはさむか（2026-11-12 院長の判断）:
 *   YouTube も TikTok も、審査に通っていないアプリから送った動画は「非公開」「自分だけ」に固定される。
 *   TikTok は自分の院だけで使うアプリを審査で認めない。Buffer は審査済みなので、Buffer を通すと公開で出せる。
 * API: https://api.buffer.com/graphql（GraphQL）。キーは院長が Buffer の「設定 → API」で作る（無料プランは1本）。
 *   形は Buffer 公式の CLI（@bufferapp/cli 2.3.1）の定義と、developers.buffer.com の例で確かめた。
 *   - 動画は公開URL（Vercel Blob）で渡す。Buffer が投稿するときに取りに来る（期限つきのURLは不可）
 *   - YouTube は title と categoryId が必須。TikTok は動画だけでよい。AIで作った絵を含む動画は isAiGenerated で申告する
 *   - createPost はやり直すと二重に出る（同じ投稿を見分ける仕組みが無い）。結果が分からないときは一覧で確かめてから
 */
import type { GeneratedContent } from './types'

export const BUFFER_API_URL = 'https://api.buffer.com/graphql'
/** Buffer の「設定 → API」（キーを作るページ） */
export const BUFFER_API_SETTINGS_URL = 'https://publish.buffer.com/settings/api'

export type BufferService = 'youtube' | 'tiktok'
export type PromoChannelName = 'youtube_short' | 'tiktok'

export const BUFFER_SERVICE_OF: Record<PromoChannelName, BufferService> = { youtube_short: 'youtube', tiktok: 'tiktok' }

export interface BufferChannel {
  id: string
  name: string
  service: string
  isDisconnected?: boolean
  isLocked?: boolean
}

/** 投稿に使えるチャンネルか（つながりが切れている・ロックされているものは使わない） */
export function bufferChannelReady(ch: BufferChannel | null | undefined): boolean {
  return Boolean(ch && ch.id && !ch.isDisconnected && !ch.isLocked)
}

/** チャンネルの一覧から、YouTube と TikTok を1つずつ選ぶ（使えるものを先に） */
export function pickBufferChannels(channels: BufferChannel[]): Partial<Record<BufferService, BufferChannel>> {
  const out: Partial<Record<BufferService, BufferChannel>> = {}
  for (const service of ['youtube', 'tiktok'] as const) {
    const list = channels.filter((c) => c.service === service)
    const best = list.find(bufferChannelReady) ?? list[0]
    if (best) out[service] = { id: best.id, name: best.name, service: best.service, isDisconnected: Boolean(best.isDisconnected), isLocked: Boolean(best.isLocked) }
  }
  return out
}

// ── GraphQL の文 ─────────────────────────────────

export const Q_ACCOUNT = `query BufferAccount {
  account {
    id
    timezone
    organizations { id name }
  }
}`

export const Q_CHANNELS = `query BufferChannels($input: ChannelsInput!) {
  channels(input: $input) { id name displayName service isDisconnected isLocked }
}`

export const M_CREATE_POST = `mutation CreatePost($input: CreatePostInput!) {
  createPost(input: $input) {
    __typename
    ... on PostActionSuccess { post { id status externalLink error { message } } }
    ... on MutationError { message }
  }
}`

export const Q_POST = `query BufferPost($input: PostInput!) {
  post(input: $input) { id status externalLink sentAt error { message } }
}`

export const Q_RECENT_POSTS = `query BufferRecentPosts($first: Int, $input: PostsInput!) {
  posts(first: $first, input: $input) { edges { node { id status text createdAt externalLink } } }
}`

// ── 投稿の中身 ─────────────────────────────────

/** YouTube のカテゴリ（26 = ハウツーとスタイル。直接アップロードしていたときと同じ） */
export const BUFFER_YOUTUBE_CATEGORY = '26'
/** TikTok の表紙にする位置（ミリ秒。1場面めの見出しが出ているところ） */
export const BUFFER_TIKTOK_COVER_MS = 1500

export interface BufferVideoPostInput {
  channelId: string
  channel: PromoChannelName
  content: Pick<GeneratedContent, 'title' | 'body'>
  videoUrl: string
  /** AIで作った絵を含む（YouTube・TikTok に「AIで作成」と申告する） */
  aiGenerated: boolean
}

/** createPost に渡す input（すぐ出す・自動で公開） */
export function bufferPostInput(input: BufferVideoPostInput): Record<string, unknown> {
  if (!/^https:\/\//.test(input.videoUrl)) throw new Error('Buffer に渡す動画は https の公開URLにしてください')
  const youtube = input.channel === 'youtube_short'
  return {
    channelId: input.channelId,
    text: input.content.body,
    schedulingType: 'automatic',
    mode: 'shareNow',
    assets: [{ video: youtube ? { url: input.videoUrl } : { url: input.videoUrl, metadata: { thumbnailOffset: BUFFER_TIKTOK_COVER_MS } } }],
    metadata: youtube
      ? {
          youtube: {
            title: input.content.title.slice(0, 100),
            categoryId: BUFFER_YOUTUBE_CATEGORY,
            privacy: 'public',
            madeForKids: false,
            notifySubscribers: true,
            embeddable: true,
            license: 'youtube',
            isAiGenerated: input.aiGenerated,
          },
        }
      : { tiktok: { isAiGenerated: input.aiGenerated } },
  }
}

export interface BufferPostSummary {
  id: string
  status: string
  externalLink: string | null
  error: string | null
}

/** createPost の返事を読む。成功なら投稿、失敗なら理由（Buffer の言葉のまま） */
export function readCreatePostResult(data: unknown): { ok: true; post: BufferPostSummary } | { ok: false; kind: string; message: string } {
  const r = (data as { createPost?: Record<string, unknown> } | null)?.createPost
  if (!r) return { ok: false, kind: 'Unknown', message: 'Buffer から返事がありませんでした' }
  const post = r.post as { id?: string; status?: string; externalLink?: string | null; error?: { message?: string } | null } | undefined
  if (r.__typename === 'PostActionSuccess' && post?.id) {
    return { ok: true, post: { id: post.id, status: post.status ?? '', externalLink: post.externalLink ?? null, error: post.error?.message ?? null } }
  }
  return { ok: false, kind: String(r.__typename ?? 'Unknown'), message: String((r as { message?: string }).message ?? 'Buffer が投稿を受け付けませんでした') }
}

/** Buffer の投稿の状態（sent = 出た／error = 出せなかった／それ以外 = まだ） */
export function bufferPostPhase(status: string): 'sent' | 'error' | 'waiting' {
  if (status === 'sent') return 'sent'
  if (status === 'error') return 'error'
  return 'waiting'
}

/** キーの見た目の確かめ（空白・日本語・改行が混ざっていないか。長さ） */
export function looksLikeBufferKey(key: string): boolean {
  return /^[\x21-\x7E]{16,400}$/.test(key)
}

/** 画面に出すキーの目印（最後の4文字だけ） */
export function bufferKeyHint(key: string): string {
  return key.length >= 4 ? `…${key.slice(-4)}` : '…'
}
