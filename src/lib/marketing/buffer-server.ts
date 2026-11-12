/**
 * Buffer との連携（サーバー専用）
 *
 * キー: Vercel の BUFFER_API_KEY があればそれ、無ければ院長が自動投稿の設定の「Bufferとつなぐ」に貼ったもの（KV の buffer:config）。
 *   キーは画面・ログ・返事に出さない（最後の4文字だけ目印に出す）。院長だけが貼る・外すことができる。
 * チャンネル: キーで見える組織のうち、YouTube・TikTok のチャンネルがある組織を使う。一覧は6時間ごと（か「確かめる」）に読み直す。
 * 投稿: createBufferVideoPost（すぐ出す）。出たかどうかは getBufferPost で後から確かめる（promo-video-server の checkBufferPromoPosts）。
 */
import { kvDelete, kvGet, kvSet } from './kv-store-server'
import {
  BUFFER_API_URL,
  BUFFER_SERVICE_OF,
  bufferChannelReady,
  bufferKeyHint,
  bufferPostInput,
  M_CREATE_POST,
  pickBufferChannels,
  Q_ACCOUNT,
  Q_CHANNELS,
  Q_POST,
  Q_RECENT_POSTS,
  readCreatePostResult,
  type BufferChannel,
  type BufferPostSummary,
  type BufferService,
  type BufferVideoPostInput,
  type PromoChannelName,
} from './buffer'

const CONFIG_KEY = 'buffer:config'
const RESULT_KEY = 'buffer:last'
/** チャンネルの一覧を読み直す間隔 */
const CHANNELS_TTL_MS = 6 * 60 * 60 * 1000

interface StoredBuffer {
  /** 院長が画面に貼ったキー（Vercel の BUFFER_API_KEY があればそちらを使う） */
  apiKey?: string
  savedAt?: string
  /** 最後に読んだ組織・チャンネル（どのキーで読んだかを keyHint で見分ける） */
  cache?: {
    keyHint: string
    organizationId: string
    organizationName: string
    channels: Partial<Record<BufferService, BufferChannel>>
    checkedAt: string
  }
}

export class BufferError extends Error {
  /** auth = キーが違う・取り消された / rate = 回数の上限 / network = 届いたか分からない / api = Buffer が断った */
  readonly kind: 'auth' | 'rate' | 'network' | 'api'
  constructor(message: string, kind: 'auth' | 'rate' | 'network' | 'api') {
    super(message)
    this.name = 'BufferError'
    this.kind = kind
  }
}

async function readStored(): Promise<StoredBuffer> {
  return (await kvGet<StoredBuffer>(CONFIG_KEY).catch(() => null)) ?? {}
}

function envKey(): string {
  return (process.env.BUFFER_API_KEY ?? '').trim()
}

async function currentKey(): Promise<{ key: string; source: 'env' | 'app' } | null> {
  if (process.env.MARKETING_MODE === 'mock') return null
  const env = envKey()
  if (env) return { key: env, source: 'env' }
  const stored = await readStored()
  return stored.apiKey ? { key: stored.apiKey, source: 'app' } : null
}

/** Buffer の GraphQL を呼ぶ（30秒まで） */
export async function bufferGraphql<T>(key: string, query: string, variables: Record<string, unknown> = {}): Promise<T> {
  let res: Response
  try {
    res = await fetch(BUFFER_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({ query, variables }),
      signal: AbortSignal.timeout(30_000),
      cache: 'no-store',
    })
  } catch (error) {
    throw new BufferError(`Buffer に届きませんでした（${error instanceof Error ? error.message : '通信'}）`, 'network')
  }
  if (res.status === 429) {
    const after = res.headers.get('retry-after')
    throw new BufferError(`Buffer の回数の上限に達しました${after ? `（${after}秒後にやり直せます）` : ''}`, 'rate')
  }
  const body = (await res.json().catch(() => null)) as { data?: T; errors?: Array<{ message?: string }> } | null
  if (res.status === 401 || res.status === 403) throw new BufferError('Bufferのキーが正しくないか、取り消されています。Bufferで新しいキーを作って貼り直してください', 'auth')
  if (!res.ok) {
    const msg = body?.errors?.map((e) => e.message).filter(Boolean).join('; ')
    // 5xx は Buffer の側の不調（届いたか分からない）
    throw new BufferError(`Buffer のエラー（HTTP ${res.status}${msg ? `：${msg.slice(0, 200)}` : ''}）`, res.status >= 500 ? 'network' : 'api')
  }
  if (body?.errors?.length) {
    const msg = body.errors.map((e) => e.message).filter(Boolean).join('; ')
    if (/unauth|forbidden|invalid.*(token|key)|not authenticated/i.test(msg)) throw new BufferError('Bufferのキーが正しくないか、取り消されています。Bufferで新しいキーを作って貼り直してください', 'auth')
    throw new BufferError(`Buffer のエラー：${msg.slice(0, 300)}`, 'api')
  }
  if (!body?.data) throw new BufferError('Buffer から返事がありませんでした', 'network')
  return body.data
}

/** 組織とチャンネルを読む（YouTube・TikTok のある組織を選ぶ） */
async function loadChannels(key: string): Promise<NonNullable<StoredBuffer['cache']>> {
  const account = await bufferGraphql<{ account: { organizations: Array<{ id: string; name: string }> } }>(key, Q_ACCOUNT)
  const orgs = account.account?.organizations ?? []
  if (orgs.length === 0) throw new BufferError('Buffer のアカウントに組織がありません', 'api')
  let best: NonNullable<StoredBuffer['cache']> | null = null
  for (const org of orgs.slice(0, 5)) {
    const data = await bufferGraphql<{ channels: BufferChannel[] }>(key, Q_CHANNELS, { input: { organizationId: org.id } })
    const picked = pickBufferChannels(data.channels ?? [])
    const entry = { keyHint: bufferKeyHint(key), organizationId: org.id, organizationName: org.name, channels: picked, checkedAt: new Date().toISOString() }
    const score = (Object.values(picked) as BufferChannel[]).filter(bufferChannelReady).length
    const bestScore = best ? (Object.values(best.channels) as BufferChannel[]).filter(bufferChannelReady).length : -1
    if (score > bestScore) best = entry
  }
  return best as NonNullable<StoredBuffer['cache']>
}

async function recordResult(ok: boolean, message: string): Promise<void> {
  try {
    await kvSet(RESULT_KEY, { ok, message: message.slice(0, 300), at: new Date().toISOString() })
  } catch {
    /* 表示用なので保存失敗は無視 */
  }
}

export interface BufferStatus {
  connected: boolean
  /** env = Vercel の設定 / app = 院長が画面に貼ったキー */
  source: 'env' | 'app' | null
  keyHint: string | null
  organizationName: string | null
  youtube: { name: string; ready: boolean } | null
  tiktok: { name: string; ready: boolean } | null
  checkedAt: string | null
  /** 最後に「つなぐ」「確かめる」をしたときの結果 */
  last: { ok: boolean; message: string; at: string } | null
  error?: string
}

/** 画面に出す状態（キーそのものは入れない）。refresh で今すぐ読み直す */
export async function bufferStatus(opts: { refresh?: boolean } = {}): Promise<BufferStatus> {
  const last = await kvGet<BufferStatus['last']>(RESULT_KEY).catch(() => null)
  const k = await currentKey()
  const empty: BufferStatus = { connected: false, source: null, keyHint: null, organizationName: null, youtube: null, tiktok: null, checkedAt: null, last }
  if (!k) return empty
  const stored = await readStored()
  let cache = stored.cache
  const stale = !cache || cache.keyHint !== bufferKeyHint(k.key) || Date.now() - Date.parse(cache.checkedAt) > CHANNELS_TTL_MS
  let error: string | undefined
  if (opts.refresh || stale) {
    try {
      cache = await loadChannels(k.key)
      await kvSet(CONFIG_KEY, { ...stored, cache } satisfies StoredBuffer)
    } catch (e) {
      error = e instanceof Error ? e.message : 'Buffer を読めませんでした'
      // キーが違う・取り消されたときは、古い一覧を信じない（消しておく。次に読めるまで自動では出さない）
      if (e instanceof BufferError && e.kind === 'auth') {
        cache = undefined
        await kvSet(CONFIG_KEY, { ...stored, cache: undefined } satisfies StoredBuffer).catch(() => undefined)
      }
    }
  }
  const view = (ch?: BufferChannel) => (ch ? { name: ch.name, ready: bufferChannelReady(ch) } : null)
  return {
    connected: Boolean(cache),
    source: k.source,
    keyHint: bufferKeyHint(k.key),
    organizationName: cache?.organizationName ?? null,
    youtube: view(cache?.channels.youtube),
    tiktok: view(cache?.channels.tiktok),
    checkedAt: cache?.checkedAt ?? null,
    last,
    ...(error ? { error } : {}),
  }
}

/** 院長が貼ったキーで「つなぐ」。読めたら保存する（読めなければ保存しない） */
export async function connectBuffer(apiKey: string): Promise<BufferStatus> {
  const key = apiKey.trim()
  try {
    const cache = await loadChannels(key)
    await kvSet(CONFIG_KEY, { apiKey: key, savedAt: new Date().toISOString(), cache } satisfies StoredBuffer)
    const names = [cache.channels.youtube ? `YouTube（${cache.channels.youtube.name}）` : null, cache.channels.tiktok ? `TikTok（${cache.channels.tiktok.name}）` : null].filter(Boolean)
    await recordResult(true, names.length ? `Bufferとつながりました：${names.join('・')}` : 'Bufferとつながりましたが、YouTube・TikTok のチャンネルが見つかりません。Buffer の画面でチャンネルを追加してください')
  } catch (e) {
    await recordResult(false, e instanceof Error ? e.message : 'Bufferとつなげませんでした')
    throw e
  }
  return bufferStatus()
}

/** 画面に貼ったキーを消す（Vercel の BUFFER_API_KEY は消せない） */
export async function disconnectBuffer(): Promise<void> {
  await kvDelete(CONFIG_KEY)
  await recordResult(true, 'Bufferとの連携を外しました（画面に貼ったキーを消しました）')
}

/** その媒体を Buffer で出せるなら、チャンネルとキー（出せなければ null） */
export async function bufferTargetFor(channel: PromoChannelName): Promise<{ key: string; channelId: string; name: string } | null> {
  const status = await bufferStatus()
  if (!status.connected) return null
  const k = await currentKey()
  const stored = await readStored()
  const ch = stored.cache?.channels[BUFFER_SERVICE_OF[channel]]
  if (!k || !ch || !bufferChannelReady(ch)) return null
  return { key: k.key, channelId: ch.id, name: ch.name }
}

/** 動画をすぐ出す投稿を Buffer に作る */
export async function createBufferVideoPost(key: string, input: BufferVideoPostInput): Promise<BufferPostSummary> {
  const data = await bufferGraphql<unknown>(key, M_CREATE_POST, { input: bufferPostInput(input) })
  const result = readCreatePostResult(data)
  if (!result.ok) throw new BufferError(`Buffer が受け付けませんでした（${result.message.slice(0, 300)}）`, result.kind === 'UnauthorizedError' ? 'auth' : 'api')
  return result.post
}

/** Buffer の投稿の状態を読む */
export async function getBufferPost(id: string): Promise<BufferPostSummary | null> {
  const k = await currentKey()
  if (!k) return null
  const data = await bufferGraphql<{ post: { id: string; status: string; externalLink?: string | null; error?: { message?: string } | null } | null }>(k.key, Q_POST, { input: { id } })
  const p = data.post
  return p ? { id: p.id, status: p.status, externalLink: p.externalLink ?? null, error: p.error?.message ?? null } : null
}

/**
 * 届いたか分からないとき：そのチャンネルに since 以降に作られた投稿があるか（同じ文のもの）。
 * 見つかればその投稿、無ければ null。確かめられなければ例外
 */
export async function findRecentBufferPost(key: string, channelId: string, sinceIso: string, text: string): Promise<BufferPostSummary | null> {
  const stored = await readStored()
  const orgId = stored.cache?.organizationId
  if (!orgId) throw new BufferError('Buffer の組織が分かりません', 'api')
  const data = await bufferGraphql<{ posts: { edges: Array<{ node: { id: string; status: string; text?: string; createdAt?: string; externalLink?: string | null } }> } }>(
    key,
    Q_RECENT_POSTS,
    { first: 10, input: { organizationId: orgId, filter: { channelIds: [channelId], createdAt: { start: sinceIso } }, sort: [{ field: 'createdAt', direction: 'desc' }] } },
  )
  const head = text.slice(0, 40)
  const hit = (data.posts?.edges ?? []).map((e) => e.node).find((n) => (n.text ?? '').startsWith(head))
  return hit ? { id: hit.id, status: hit.status, externalLink: hit.externalLink ?? null, error: null } : null
}
