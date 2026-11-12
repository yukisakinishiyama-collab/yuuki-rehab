/**
 * 宣伝の短い動画（YouTubeショート・TikTok）：動画の作りおきと、毎週の予約（サーバー専用）
 *
 * 動画: ensurePromoVideo(id) … 文面・絵・描き方が変わっていなければ作りおき（Vercel Blob）を使い、無ければ組み立てて置く。
 *       どの動画を置いたかは KV の promo:video:<id>（文面と絵の指紋つき）。Blob が使えない手元の環境では .data/promo-videos に置く
 * AIの絵: 前半の場面の絵は OpenAI の画像生成で作り（投稿のAI画像と同じ部品・同じ置き場 marketing/ai-photos/）、
 *       KV の promo:ai:<id>:<a|b> に覚えて使い回す（場面の説明を変えたら作り直す）。作れないときは院の写真で代え、6時間おいてから作り直す。
 *       resetPromoAi(id) で絵を作り直せる（気に入らない絵・手や足が不自然な絵が出たとき）
 * 予約: schedulePromoVideos() … runAutopilot（15分ごと）から。今週（まだ来ていない時刻）と来週の分を、
 *       週ごとに1回だけ決める（promo:week:<月曜>。出した順は promo:history）。
 *       投稿ジョブは媒体ごと（idempotencyKey = promo:<週>:<番号>:<媒体>）。設定でオンの媒体だけ作る
 * 承認: 自動で出せる媒体（Buffer につないだ・YouTube の審査済み）は、院長の承認が要る（promo-approval.ts）。
 *       requestPromoApprovals() … 前日に見本をLINEへ（jobs/run から）。applyPromoAction() … 承認・見送り・別の動画（LINEのボタン・画面）。
 *       promoGate() … 投稿の時刻に、承認済みか・どう出すかを決める（publishers.ts）。
 *       checkBufferPromoPosts() … Buffer に渡した投稿が出たか確かめる（出せなかったら、手で投稿できるようLINEへ）
 */
import { getPromoVideo, PROMO_VIDEOS, promoAiPrompt, promoScenes, type PromoAiVisual, type PromoVideo } from '@/data/promo-videos'
import { fingerprint } from '@/lib/sync-merge'
import { kvDelete, kvGet, kvSet } from './kv-store-server'
import { createJob, listJobs, updateJob, type PublishJob } from './jobs-store-server'
import { getAutopilotSettings } from './autopilot-store-server'
import type { AutopilotSettings } from './autopilot-types'
import { addDays, jstParts, mondayOf } from './autopilot-planner'
import { APP_URL } from './gbp-seo'
import { generateOpenAiImage, openAiImageConfigured } from './openai-image-server'
import type { PromoSceneImage } from './promo-video-render'
import { isPromoJobKey, pickPromoVideos, PROMO_RENDER_VERSION, promoCampaign, promoContent, promoJobKey, promoSlotsForWeek, promoVideoUrl, type PromoChannel } from './promo-video'
import {
  addHoursLocal,
  approvalReminderMessages,
  approvalRequestMessages,
  isDaytime,
  needsApprovalReminder,
  needsApprovalRequest,
  pickSwapVideo,
  PROMO_APPROVAL_RULES,
  promoApprovalStatus,
  promoVideoToken,
  slotText,
  type PromoApprovalStatus,
  type PromoPlanEntry,
  type PromoRouteName,
  type PromoVideoSnapshot,
} from './promo-approval'

// ── 動画の作りおき ────────────────────────────────

const VIDEO_KEY = (id: string) => `promo:video:${id}`

export interface StoredPromoVideo {
  id: string
  /** 文面・場面・描き方の指紋（変わったら作り直す） */
  hash: string
  /** 動画の場所（Blob の公開URL。手元の環境では院内アプリのURL） */
  url: string
  /** 1場面めの絵（JPEG） */
  posterUrl: string
  seconds: number
  bytes: number
  createdAt: string
  /** 使ったAIの絵の枚数（1枚でもあれば、YouTube に「AIで作成したものを含む」と申告する） */
  aiImages?: number
  /** AIの絵を使いたかったが作れず、院の写真で代えた（しばらくしたら作り直す） */
  aiPending?: boolean
  /** 手元の環境（.data/promo-videos に置いたもの） */
  local?: boolean
}

async function localDir(): Promise<string> {
  const [path, fs] = await Promise.all([import('node:path'), import('node:fs/promises')])
  const dir = path.join(process.cwd(), '.data', 'promo-videos')
  await fs.mkdir(dir, { recursive: true })
  return dir
}

/** 手元の環境に置いた動画・絵を読む（無ければ null） */
export async function readLocalPromoFile(id: string, ext: 'mp4' | 'jpg'): Promise<Buffer | null> {
  if (!/^[a-z0-9-]+$/.test(id)) return null
  try {
    const [path, fs] = await Promise.all([import('node:path'), import('node:fs/promises')])
    return await fs.readFile(path.join(await localDir(), `${id}.${ext}`))
  } catch {
    return null
  }
}

// ── AIの絵 ───────────────────────────────────

const AI_KEY = (id: string, slot: string) => `promo:ai:${id}:${slot}`
/** AIの絵が作れなかったとき、次に作り直すまでの時間 */
const AI_RETRY_MS = 6 * 60 * 60 * 1000

interface StoredPromoAi {
  url: string
  /** 場面の説明＋決まりの指紋（変えたら作り直す） */
  promptHash: string
  model: string
  createdAt: string
  local?: boolean
}

/** AIの絵を作れる設定か（モックモードでは外に送らない） */
export function promoAiConfigured(): boolean {
  return openAiImageConfigured() && process.env.MARKETING_MODE !== 'mock'
}

async function getPromoAi(id: string, ai: PromoAiVisual): Promise<StoredPromoAi | null> {
  const stored = await kvGet<StoredPromoAi>(AI_KEY(id, ai.slot)).catch(() => null)
  return stored && stored.promptHash === fingerprint(promoAiPrompt(ai)) ? stored : null
}

/** AIの絵を1枚作って置く（30秒〜1分ほど） */
async function createPromoAi(id: string, ai: PromoAiVisual): Promise<StoredPromoAi> {
  const prompt = promoAiPrompt(ai)
  const { bytes, model } = await generateOpenAiImage(prompt, { size: '1024x1024', quality: 'medium', signal: AbortSignal.timeout(150_000) })
  const stored: StoredPromoAi = { url: '', promptHash: fingerprint(prompt), model, createdAt: new Date().toISOString() }
  if (process.env.BLOB_READ_WRITE_TOKEN?.trim()) {
    const { put } = await import('@vercel/blob')
    // 投稿のAI画像と同じ置き場（image-template.ts の isAllowedPhotoUrl が読んでよいのはここだけ）
    const name = `marketing/ai-photos/promo-${id}-${ai.slot}-${crypto.randomUUID().slice(0, 8)}.png`
    stored.url = (await put(name, bytes, { access: 'public', contentType: 'image/png' })).url
  } else {
    const [path, fs] = await Promise.all([import('node:path'), import('node:fs/promises')])
    await fs.writeFile(path.join(await localDir(), `${id}-${ai.slot}.png`), bytes)
    stored.url = `local:${id}-${ai.slot}.png`
    stored.local = true
  }
  await kvSet(AI_KEY(id, ai.slot), stored)
  return stored
}

/** 置いてあるAIの絵の中身を読む */
async function loadPromoAi(stored: StoredPromoAi): Promise<PromoSceneImage> {
  if (stored.local) {
    const name = stored.url.replace(/^local:/, '')
    if (!/^[a-z0-9-]+\.(png|jpg)$/.test(name)) throw new Error('AIの絵の置き場所が正しくありません')
    const [path, fs] = await Promise.all([import('node:path'), import('node:fs/promises')])
    return { bytes: await fs.readFile(path.join(await localDir(), name)), type: name.endsWith('.jpg') ? 'image/jpeg' : 'image/png' }
  }
  const { loadPhotoDataUrl } = await import('./image-template')
  const m = /^data:(image\/(?:png|jpeg));base64,(.+)$/.exec(await loadPhotoDataUrl(stored.url))
  if (!m) throw new Error('AIの絵の形式が正しくありません')
  return { bytes: Buffer.from(m[2], 'base64'), type: m[1] as PromoSceneImage['type'] }
}

interface ResolvedVisuals {
  /** 場面ごとの絵の目印（'ai:<URL>' か 'photo:<名前>'）。指紋に入れる */
  identities: string[]
  /** 場面ごとのAIの絵（無ければ null＝院の写真） */
  ai: Array<StoredPromoAi | null>
  /** AIの絵を使いたいのに、まだ無い場面がある */
  pending: boolean
}

/** 場面ごとに、どの絵を使うかを決める。generate なら、まだ無いAIの絵をここで作る（2枚同時に） */
async function resolveVisuals(video: PromoVideo, generate: boolean): Promise<ResolvedVisuals> {
  const scenes = promoScenes(video)
  const ai = await Promise.all(
    scenes.map(async (scene) => {
      if (!scene.ai) return null
      const stored = await getPromoAi(video.id, scene.ai)
      if (stored || !generate || !promoAiConfigured()) return stored
      try {
        return await createPromoAi(video.id, scene.ai)
      } catch (error) {
        // 作れなくても動画は止めない（院の写真で代える）
        console.warn(`[promo-video] AIの絵を作れませんでした（${video.id}・${scene.ai.slot}）`, error)
        return null
      }
    }),
  )
  return {
    identities: scenes.map((scene, i) => (ai[i] ? `ai:${ai[i]?.url}` : `photo:${scene.photo}`)),
    ai,
    pending: scenes.some((scene, i) => Boolean(scene.ai) && !ai[i]),
  }
}

function hashOf(video: PromoVideo, identities: string[]): string {
  return fingerprint(JSON.stringify({ v: PROMO_RENDER_VERSION, scenes: promoScenes(video), identities }))
}

/** いまの文面・いまある絵での指紋（AIの絵は作らない） */
export async function promoVideoHash(id: string): Promise<string | null> {
  const video = getPromoVideo(id)
  if (!video) return null
  return hashOf(video, (await resolveVisuals(video, false)).identities)
}

/** 作りおきがあれば返す（作らない） */
export async function getStoredPromoVideo(id: string): Promise<StoredPromoVideo | null> {
  const [stored, hash] = await Promise.all([kvGet<StoredPromoVideo>(VIDEO_KEY(id)).catch(() => null), promoVideoHash(id)])
  if (!stored || !hash || stored.hash !== hash) return null
  // AIの絵が作れず院の写真で代えた動画は、しばらくしたら作り直す（AIの絵をもう一度試す）
  if (stored.aiPending && promoAiConfigured() && Date.now() - Date.parse(stored.createdAt) > AI_RETRY_MS) return null
  if (stored.local && !(await readLocalPromoFile(id, 'mp4'))) return null
  return stored
}

/** 作りおきを使う。無ければ（AIの絵も要れば作って）組み立てて置く（1〜2分ほど） */
export async function ensurePromoVideo(id: string): Promise<StoredPromoVideo> {
  const video = getPromoVideo(id)
  if (!video) throw new Error('動画が見つかりません')
  const existing = await getStoredPromoVideo(id)
  if (existing) return existing

  const visuals = await resolveVisuals(video, true)
  const images = await Promise.all(
    visuals.ai.map(async (stored) => {
      if (!stored) return null
      try {
        return await loadPromoAi(stored)
      } catch (error) {
        console.warn(`[promo-video] AIの絵を読めませんでした（${id}）`, error)
        return null
      }
    }),
  )
  // 読めなかった絵は院の写真で代える（目印もそれに合わせる）
  const scenes = promoScenes(video)
  const identities = visuals.identities.map((x, i) => (visuals.ai[i] && !images[i] ? `photo:${scenes[i].photo}` : x))
  const pending = visuals.pending || identities.some((x, i) => x !== visuals.identities[i])
  const hash = hashOf(video, identities)
  const { renderPromoVideo } = await import('./promo-video-render')
  const { toJpeg } = await import('./image-template')
  const rendered = await renderPromoVideo(video, images)
  const poster = await toJpeg(rendered.poster)
  const stored: StoredPromoVideo = {
    id,
    hash,
    url: '',
    posterUrl: '',
    seconds: rendered.seconds,
    bytes: rendered.mp4.length,
    createdAt: new Date().toISOString(),
    aiImages: images.filter(Boolean).length,
    aiPending: pending || undefined,
  }

  if (process.env.BLOB_READ_WRITE_TOKEN?.trim()) {
    const { put } = await import('@vercel/blob')
    // 名前に指紋を入れる（文面・絵を直したら別の名前になる。古いURLを見ている人に新しい動画が出ないように）
    const opts = { access: 'public' as const, addRandomSuffix: false, allowOverwrite: true }
    stored.url = (await put(`marketing/promo/${id}-${hash}.mp4`, rendered.mp4, { ...opts, contentType: 'video/mp4' })).url
    stored.posterUrl = (await put(`marketing/promo/${id}-${hash}.jpg`, poster, { ...opts, contentType: 'image/jpeg' })).url
  } else {
    const [path, fs] = await Promise.all([import('node:path'), import('node:fs/promises')])
    const dir = await localDir()
    await fs.writeFile(path.join(dir, `${id}.mp4`), rendered.mp4)
    await fs.writeFile(path.join(dir, `${id}.jpg`), poster)
    stored.url = promoVideoUrl(id, 'video', '')
    stored.posterUrl = promoVideoUrl(id, 'poster', '')
    stored.local = true
  }
  await kvSet(VIDEO_KEY(id), stored)
  return stored
}

/** その場面のAIの絵（置いてあれば。作らない）。院内アプリで場面の絵を見るとき用 */
export async function promoSceneAiImage(id: string, sceneIndex: number): Promise<PromoSceneImage | null> {
  const video = getPromoVideo(id)
  const scene = video ? promoScenes(video)[sceneIndex] : undefined
  if (!video || !scene?.ai) return null
  try {
    const stored = await getPromoAi(id, scene.ai)
    return stored ? await loadPromoAi(stored) : null
  } catch {
    return null
  }
}

/** AIの絵を作り直す（覚えている絵と作りおきの動画を忘れる。次に要るときに新しく作る） */
export async function resetPromoAi(id: string): Promise<void> {
  if (!getPromoVideo(id)) throw new Error('動画が見つかりません')
  await Promise.all([kvDelete(AI_KEY(id, 'a')), kvDelete(AI_KEY(id, 'b')), kvDelete(VIDEO_KEY(id))])
}

/** 外（LINE・YouTube）に渡せる https のURLか */
export function isPublicUrl(url: string): boolean {
  return /^https:\/\//.test(url)
}

/** 外のサービス（Buffer・LINE）が自分で取りに来られるURLか（院内アプリのURLはパスワードの内側なので不可） */
export function isFetchableFromOutside(url: string): boolean {
  return isPublicUrl(url) && !url.startsWith(APP_URL)
}

// ── 毎週の予約 ─────────────────────────────────

const WEEK_KEY = (week: string) => `promo:week:${week}`
const HISTORY_KEY = 'promo:history'

export interface PromoWeekPlan {
  weekStart: string
  createdAt: string
  items: PromoPlanEntry[]
}

export async function getPromoWeekPlan(week: string): Promise<PromoWeekPlan | null> {
  return kvGet<PromoWeekPlan>(WEEK_KEY(week))
}

export function enabledPromoChannels(settings: Pick<AutopilotSettings, 'youtubeShorts' | 'tiktokVideo'> & { instagramReels?: boolean }): PromoChannel[] {
  return [
    ...(settings.youtubeShorts ? (['youtube_short'] as const) : []),
    ...(settings.tiktokVideo ? (['tiktok'] as const) : []),
    ...(settings.instagramReels ? (['instagram_reel'] as const) : []),
  ]
}

/**
 * 今週（まだ来ていない時刻だけ）と来週の分を予約する。どの媒体もオフなら何もしない。
 * どの動画をいつ出すかは週ごとに1回だけ決め、投稿ジョブはオンの媒体の分だけ作る（あとからオンにした媒体も、次の回で足す）
 */
export async function schedulePromoVideos(now = new Date()): Promise<{ scheduled: number; weeks: string[]; skipped?: string }> {
  const settings = await getAutopilotSettings()
  const channels = enabledPromoChannels(settings)
  if (channels.length === 0) return { scheduled: 0, weeks: [], skipped: 'YouTube・TikTok・Instagramの動画はオフです' }
  const jst = jstParts(now)
  const thisMonday = mondayOf(jst.date)
  let scheduled = 0
  const weeks: string[] = []
  for (const week of [thisMonday, addDays(thisMonday, 7)]) {
    let plan = await getPromoWeekPlan(week)
    if (!plan) {
      const slots = promoSlotsForWeek(week, settings.promoVideoPerWeek).filter((s) => s > jst.local)
      const history = (await kvGet<string[]>(HISTORY_KEY)) ?? []
      const videos = pickPromoVideos(history, slots.length)
      plan = {
        weekStart: week,
        createdAt: new Date().toISOString(),
        items: slots.map((scheduledAt, i) => ({ scheduledAt, videoId: videos[i].id, campaign: promoCampaign(week, i + 1) })),
      }
      await kvSet(WEEK_KEY(week), plan)
      if (plan.items.length > 0) await kvSet(HISTORY_KEY, [...history, ...plan.items.map((x) => x.videoId)].slice(-60))
      weeks.push(week)
    }
    for (const [i, item] of plan.items.entries()) {
      if (item.scheduledAt <= jst.local) continue
      // 院長が見送った回は、ジョブを作り直さない
      if (item.approval?.status === 'skipped' || item.approval?.status === 'expired') continue
      const video = getPromoVideo(item.videoId)
      if (!video) continue
      for (const channel of channels) {
        const { duplicated } = await createJob({
          idempotencyKey: promoJobKey(week, i + 1, channel),
          projectId: `promo:${week}`,
          variantId: `promo-${video.id}-${channel}`,
          channel,
          theme: `動画：${video.post.title}`,
          content: promoContent(video, channel, item.campaign),
          scheduledAt: item.scheduledAt,
        })
        if (!duplicated) scheduled += 1
      }
    }
  }
  return { scheduled, weeks }
}

/** 設定でオフにした媒体の、予約済みでまだ出していない動画の投稿を取り消す。どちらもオフなら週の予定も消す */
export async function cancelPendingPromoJobs(keep: PromoChannel[]): Promise<number> {
  let n = 0
  const weeks = new Set<string>()
  for (const job of await listJobs()) {
    if (!isPromoJobKey(job.idempotencyKey) || job.status !== 'pending') continue
    if (keep.includes(job.channel as PromoChannel)) continue
    await updateJob(job.id, (j) => {
      j.status = 'cancelled'
      j.actionReason = '動画の投稿をオフにしたため取り消し'
    })
    weeks.add(job.idempotencyKey.split(':')[1])
    n += 1
  }
  // どちらもオフにしたら、決めた週の予定も消す（またオンにしたら、その週の残りの時刻で決め直す）
  if (keep.length === 0) for (const week of weeks) await kvDelete(WEEK_KEY(week))
  return n
}

/** 外に渡すURL（手元の環境の相対URLは、院内アプリのURLを頭に付ける） */
export function absolutePromoUrl(url: string): string {
  return isPublicUrl(url) ? url : `${APP_URL}${url}`
}

// ── 承認してから自動で投稿 ─────────────────────────

/** 作りおきの動画から、承認に使う写し（このURLの動画を出す） */
export function promoSnapshot(stored: StoredPromoVideo): PromoVideoSnapshot {
  return { url: absolutePromoUrl(stored.url), posterUrl: absolutePromoUrl(stored.posterUrl), hash: stored.hash, aiImages: stored.aiImages ?? 0 }
}

/** その媒体を自動で出せるか（Buffer につないだ → Buffer／YouTube の連携と審査が済んだ → YouTube に直接）。出せなければ manual */
export async function promoRouteFor(channel: PromoChannel, settings?: AutopilotSettings): Promise<PromoRouteName> {
  if (process.env.MARKETING_MODE === 'mock') return 'manual'
  // Instagram のリールは、院内アプリの Instagram の連携（ふだんの投稿と同じ）で直接出す。Buffer は通さない
  if (channel === 'instagram_reel') {
    try {
      const { getInstagramToken, getInstagramUserId } = await import('./instagram-token')
      return (await getInstagramToken()) && (await getInstagramUserId()) ? 'instagram_api' : 'manual'
    } catch (error) {
      console.warn('[promo-video] Instagram の連携を読めませんでした', error)
      return 'manual'
    }
  }
  try {
    const { bufferTargetFor } = await import('./buffer-server')
    if (await bufferTargetFor(channel)) return 'buffer'
  } catch (error) {
    console.warn('[promo-video] Buffer の状態を読めませんでした', error)
  }
  if (channel === 'youtube_short') {
    const [{ getYoutubeCredentials }, s] = await Promise.all([import('./youtube-server'), settings ? Promise.resolve(settings) : getAutopilotSettings()])
    if (s.youtubeAudited && (await getYoutubeCredentials())) return 'youtube_api'
  }
  return 'manual'
}

function parsePromoJobKey(key: string): { week: string; n: number; channel: PromoChannel } | null {
  const m = /^promo:(\d{4}-\d{2}-\d{2}):(\d+):(youtube_short|tiktok|instagram_reel)$/.exec(key)
  return m ? { week: m[1], n: Number(m[2]), channel: m[3] as PromoChannel } : null
}

/** 週の予定の1本を読み直して書きかえる（mutate が false を返したら保存しない） */
async function updatePlanEntry(week: string, n: number, mutate: (entry: PromoPlanEntry) => boolean | void): Promise<PromoPlanEntry | null> {
  const plan = await getPromoWeekPlan(week)
  const entry = plan?.items[n - 1]
  if (!plan || !entry) return null
  if (mutate(entry) === false) return null
  await kvSet(WEEK_KEY(week), plan)
  return entry
}

function jobsOfEntry(jobs: PublishJob[], week: string, n: number): PublishJob[] {
  return jobs.filter((j) => j.idempotencyKey.startsWith(`promo:${week}:${n}:`))
}

export type PromoGate =
  | { kind: 'manual' }
  | { kind: 'auto'; route: 'buffer' | 'youtube_api' | 'instagram_api'; video: PromoVideoSnapshot }
  | { kind: 'wait'; retryAt: string; message: string }
  | { kind: 'skip'; message: string }

/**
 * 投稿の時刻に、どう出すかを決める。自動で出せる媒体は、院長の承認が要る：
 * 承認済み → 承認した動画を自動で／承認待ち → 10分おきに待つ／見送り・期限切れ → 出さない。自動で出せない媒体は手で（これまでどおり）
 */
export async function promoGate(channel: PromoChannel, jobKey: string | undefined, now = new Date()): Promise<PromoGate> {
  const route = await promoRouteFor(channel)
  if (route === 'manual') return { kind: 'manual' }
  const key = jobKey ? parsePromoJobKey(jobKey) : null
  const entry = key ? (await getPromoWeekPlan(key.week))?.items[key.n - 1] : undefined
  // 予定が見つからない（承認のしようがない）ときは、自動では出さない（手で投稿）
  if (!key || !entry) return { kind: 'manual' }
  const nowLocal = jstParts(now).local
  const status = promoApprovalStatus(entry, nowLocal)
  if (status === 'approved' && entry.approval?.video) return { kind: 'auto', route, video: entry.approval.video }
  if (status === 'skipped') return { kind: 'skip', message: '院長が「今回は見送る」にしたため、出しませんでした' }
  if (status === 'expired') {
    if (entry.approval?.status !== 'expired') {
      await updatePlanEntry(key.week, key.n, (e) => {
        e.approval = { status: 'expired', at: now.toISOString(), by: '自動' }
      })
    }
    return { kind: 'skip', message: `承認がないまま${PROMO_APPROVAL_RULES.expireAfterHours}時間たったため、今回は出しませんでした` }
  }
  return {
    kind: 'wait',
    retryAt: new Date(now.getTime() + 10 * 60 * 1000).toISOString(),
    message: '院長の承認待ちです（LINEの「承認して投稿」か、自動投稿の設定の「次の予定」から承認できます）',
  }
}

export type PromoAction = 'approve' | 'unapprove' | 'skip' | 'restore' | 'swap'

/** 承認・承認の取り消し・見送り・元に戻す・別の動画にする（LINEのボタン＝token あり、画面＝token なし） */
export async function applyPromoAction(
  week: string,
  n: number,
  action: PromoAction,
  actor: string,
  opts: { token?: string; now?: Date } = {},
): Promise<{ ok: boolean; message: string }> {
  const now = opts.now ?? new Date()
  const nowLocal = jstParts(now).local
  const plan = await getPromoWeekPlan(week)
  const entry = plan?.items[n - 1]
  if (!plan || !entry) return { ok: false, message: 'この動画の予定が見つかりませんでした' }
  const title = getPromoVideo(entry.videoId)?.post.title ?? entry.videoId
  const jobs = jobsOfEntry(await listJobs(), week, n)
  const posted = jobs.some((j) => j.status === 'published' || j.status === 'processing')
  // 別の動画に変えたあと・見本を作り直したあとの、古い見本のボタン
  if (opts.token && (!entry.request || promoVideoToken(entry.request.video.hash) !== opts.token)) {
    return { ok: false, message: 'このボタンの見本は古くなっています。新しく届いた見本のボタンか、アプリの「次の予定」から操作してください' }
  }
  const status = promoApprovalStatus(entry, nowLocal)
  const when = entry.scheduledAt > nowLocal ? `${slotText(entry.scheduledAt)} に` : 'すぐに（15分ほどで）'

  if (action === 'approve') {
    if (status === 'approved') return { ok: true, message: `すでに承認済みです。${when}投稿します` }
    if (status === 'skipped') return { ok: false, message: '「今回は見送る」にした動画です。出す場合は、アプリの「次の予定」で「元に戻す」を押してから承認してください' }
    if (status === 'expired') return { ok: false, message: `承認の期限（時刻から${PROMO_APPROVAL_RULES.expireAfterHours}時間）を過ぎたため、今回は出しません` }
    // 見て承認したものを出す：LINEのボタンなら届けた見本、画面からなら今の動画（無ければ作る）
    const snap = opts.token && entry.request ? entry.request.video : promoSnapshot(await ensurePromoVideo(entry.videoId))
    if (!isFetchableFromOutside(snap.url)) return { ok: false, message: '動画の置き場（Vercel Blob）が使えないため、自動では出せません' }
    await updatePlanEntry(week, n, (e) => {
      e.approval = { status: 'approved', at: now.toISOString(), by: actor, video: snap }
    })
    for (const j of jobs.filter((x) => x.status === 'pending')) {
      await updateJob(j.id, (x) => {
        x.nextAttemptAt = undefined
        x.actionReason = `承認済み（${actor}）。${when}投稿します`
      })
    }
    return { ok: true, message: `✅ 承認しました。「${title}」を${when}投稿します。` }
  }

  if (action === 'unapprove') {
    if (posted) return { ok: false, message: 'すでに投稿したため、取り消せません' }
    if (status !== 'approved') return { ok: false, message: '承認されていません' }
    await updatePlanEntry(week, n, (e) => {
      e.approval = undefined
    })
    for (const j of jobs.filter((x) => x.status === 'pending')) {
      await updateJob(j.id, (x) => {
        x.actionReason = '承認を取り消しました（承認待ち）'
      })
    }
    return { ok: true, message: '承認を取り消しました。もう一度承認するまで投稿しません' }
  }

  if (action === 'skip') {
    if (posted) return { ok: false, message: 'すでに投稿したため、見送れません' }
    if (status === 'skipped') return { ok: true, message: 'すでに見送りにしています' }
    await updatePlanEntry(week, n, (e) => {
      e.approval = { status: 'skipped', at: now.toISOString(), by: actor }
    })
    for (const j of jobs.filter((x) => x.status === 'pending')) {
      await updateJob(j.id, (x) => {
        x.status = 'cancelled'
        x.actionReason = `院長が見送りました（${actor}）`
      })
    }
    return { ok: true, message: `今回は見送りました。「${title}」は投稿しません。` }
  }

  if (action === 'restore') {
    if (status !== 'skipped') return { ok: false, message: '見送りにした動画ではありません' }
    if (entry.scheduledAt <= nowLocal) return { ok: false, message: '時刻を過ぎたため、元に戻せません' }
    await updatePlanEntry(week, n, (e) => {
      e.approval = undefined
    })
    // 取り消したジョブを作り直す（同じ目印で、取り消し済みでないものが無ければ新しく作る）
    await schedulePromoVideos(now)
    return { ok: true, message: '元に戻しました（承認待ち）' }
  }

  // swap: 別の動画にする
  if (posted) return { ok: false, message: 'すでに投稿したため、変えられません' }
  if (status === 'approved') return { ok: false, message: '承認済みです。変える場合は、先に承認を取り消してください' }
  if (status !== 'waiting') return { ok: false, message: 'この回は出さないことになっています' }
  const monday = mondayOf(jstParts(now).date)
  const plans = await Promise.all([getPromoWeekPlan(monday), getPromoWeekPlan(addDays(monday, 7))])
  const avoid = plans.flatMap((p) => p?.items.map((x) => x.videoId) ?? [])
  const next = pickSwapVideo(entry.videoId, avoid, PROMO_VIDEOS)
  if (!next) return { ok: false, message: 'ほかに出せる動画がありません' }
  await updatePlanEntry(week, n, (e) => {
    e.videoId = next.id
    e.request = undefined
    e.requesting = undefined
    e.remindedAt = undefined
    e.approval = undefined
  })
  for (const j of jobs.filter((x) => x.status === 'pending')) {
    const channel = j.channel as PromoChannel
    await updateJob(j.id, (x) => {
      x.content = promoContent(next, channel, entry.campaign)
      x.theme = `動画：${next.post.title}`
      x.variantId = `promo-${next.id}-${channel}`
      x.actionReason = '別の動画に変えました（承認待ち）'
    })
  }
  const history = (await kvGet<string[]>(HISTORY_KEY)) ?? []
  await kvSet(HISTORY_KEY, [...history, next.id].slice(-60))
  const soon = nowLocal >= addHoursLocal(entry.scheduledAt, -PROMO_APPROVAL_RULES.requestLeadHours)
  return {
    ok: true,
    message: `別の動画「${next.post.title}」に変えました。${soon ? '見本ができしだい（15分ほどで）LINEでお送りします。' : '前日に見本をLINEでお送りします。'}`,
  }
}

/** LINEに送る文の材料 */
function approvalInput(week: string, n: number, entry: PromoPlanEntry, video: PromoVideo, snap: PromoVideoSnapshot, routes: Partial<Record<PromoChannel, PromoRouteName>>, nowLocal: string) {
  return {
    week,
    n,
    entry,
    title: video.post.title,
    video: snap,
    routes,
    youtubeTitle: routes.youtube_short ? promoContent(video, 'youtube_short', entry.campaign).title : undefined,
    tiktokCaption: routes.tiktok ? promoContent(video, 'tiktok', entry.campaign).body : undefined,
    instagramCaption: routes.instagram_reel ? promoContent(video, 'instagram_reel', entry.campaign).body : undefined,
    appUrl: APP_URL,
    nowLocal,
  }
}

/**
 * 承認のお願い（見本の動画つき）と念押しを、院長のLINEへ送る（jobs/run から15分ごと）。
 * 自動で出せる媒体があるときだけ。夜（21時〜8時）は送らない。見本の動画は1回に1本まで作る（1〜2分かかるため）
 */
export async function requestPromoApprovals(opts: { now?: Date; deadlineMs?: number } = {}): Promise<{ requested: number; reminded: number; skipped?: string }> {
  const now = opts.now ?? new Date()
  const deadline = opts.deadlineMs ?? Date.now() + 120_000
  const settings = await getAutopilotSettings()
  const channels = enabledPromoChannels(settings)
  if (channels.length === 0) return { requested: 0, reminded: 0, skipped: '動画はオフです' }
  const jst = jstParts(now)
  if (!isDaytime(jst.local)) return { requested: 0, reminded: 0, skipped: '夜はLINEを送りません' }
  const routes: Partial<Record<PromoChannel, PromoRouteName>> = {}
  for (const c of channels) routes[c] = await promoRouteFor(c, settings)
  if (!Object.values(routes).some((r) => r !== 'manual')) return { requested: 0, reminded: 0, skipped: '自動で出せる媒体がありません（時間になったら手で投稿）' }
  const { notifyOwner } = await import('./owner-notify')
  const monday = mondayOf(jst.date)
  let requested = 0
  let reminded = 0
  for (const week of [monday, addDays(monday, 7)]) {
    const plan = await getPromoWeekPlan(week)
    for (const [i, entry] of (plan?.items ?? []).entries()) {
      const n = i + 1
      const video = getPromoVideo(entry.videoId)
      if (!video) continue
      if (needsApprovalRequest(entry, jst.local, now.toISOString())) {
        if (requested > 0 || Date.now() > deadline) continue
        // 見本を作っている途中の目印（重なって2通送らないように）。読み直して、ほかが先に送っていたらやめる
        const startedAt = now.toISOString()
        const claimed = await updatePlanEntry(week, n, (e) => {
          if (e.videoId !== entry.videoId || !needsApprovalRequest(e, jst.local, now.toISOString())) return false
          e.requesting = startedAt
        })
        if (!claimed) continue
        let snap: PromoVideoSnapshot
        try {
          snap = promoSnapshot(await ensurePromoVideo(entry.videoId))
        } catch (error) {
          console.error('[promo-video] 承認の見本を作れませんでした', error)
          await updatePlanEntry(week, n, (e) => {
            e.requesting = undefined
          })
          continue
        }
        const result = await notifyOwner(approvalRequestMessages(approvalInput(week, n, entry, video, snap, routes, jst.local)))
        await updatePlanEntry(week, n, (e) => {
          if (e.videoId !== entry.videoId) return false
          e.requesting = undefined
          e.request = { at: now.toISOString(), delivered: result.delivered, video: snap, ...(result.reason ? { reason: result.reason } : {}) }
        })
        requested += 1
        continue
      }
      if (entry.request && needsApprovalReminder(entry, jst.local)) {
        const result = await notifyOwner(approvalReminderMessages(approvalInput(week, n, entry, video, entry.request.video, routes, jst.local)))
        await updatePlanEntry(week, n, (e) => {
          e.remindedAt = now.toISOString()
        })
        if (result.delivered) reminded += 1
      }
    }
  }
  return { requested, reminded }
}

const CHANNEL_NAME: Record<PromoChannel, string> = { youtube_short: 'YouTube', tiktok: 'TikTok', instagram_reel: 'Instagramリール' }
/** Buffer に渡してから、出たかを確かめ続ける長さ */
const BUFFER_CHECK_MS = 2 * 24 * 60 * 60 * 1000

/**
 * Buffer に渡した動画の投稿が、実際に YouTube・TikTok に出たかを確かめる（jobs/run から）。
 * 出た → 公開先のURLを記録。出せなかった → 「手動対応」にして返す（呼び出し元が、動画と文を院長のLINEへ届ける）
 */
export async function checkBufferPromoPosts(now = new Date()): Promise<{ checked: number; sent: number; failed: PublishJob[] }> {
  const targets = (await listJobs()).filter((j) => isPromoJobKey(j.idempotencyKey) && j.status === 'published' && j.external?.service === 'buffer' && !j.external.done)
  const failed: PublishJob[] = []
  let sent = 0
  let checked = 0
  if (targets.length === 0) return { checked, sent, failed }
  const [{ getBufferPost }, { bufferPostPhase }] = await Promise.all([import('./buffer-server'), import('./buffer')])
  for (const job of targets.slice(0, 6)) {
    const ext = job.external
    if (!ext) continue
    const old = now.getTime() - Date.parse(ext.createdAt) > BUFFER_CHECK_MS
    const name = CHANNEL_NAME[job.channel as PromoChannel] ?? job.channel
    let post: Awaited<ReturnType<typeof getBufferPost>> = null
    try {
      post = await getBufferPost(ext.postId)
      checked += 1
    } catch (error) {
      console.warn('[promo-video] Buffer の投稿の状態を読めませんでした', error)
    }
    const phase = post ? bufferPostPhase(post.status) : 'waiting'
    if (post && phase === 'sent') {
      await updateJob(job.id, (j) => {
        if (post.externalLink) j.publishedUrl = post.externalLink
        j.external = { ...ext, status: post.status, done: true, checkedAt: now.toISOString() }
        j.attempts.push({ at: now.toISOString(), ok: true, message: `${name}に公開されました（Buffer）` })
      })
      sent += 1
    } else if (post && phase === 'error') {
      const updated = await updateJob(job.id, (j) => {
        j.status = 'action_required'
        j.actionReason = `Bufferから${name}へ投稿できませんでした（${(post.error ?? '理由は不明').slice(0, 200)}）。今回は手で投稿してください。`
        j.manualUrl = ext.videoUrl ?? j.manualUrl
        j.external = { ...ext, status: post.status, done: true, checkedAt: now.toISOString() }
        j.attempts.push({ at: now.toISOString(), ok: false, message: `Buffer：${post.error ?? '投稿できませんでした'}` })
      })
      if (updated) failed.push(updated)
    } else {
      await updateJob(job.id, (j) => {
        j.external = { ...ext, status: post?.status ?? ext.status, checkedAt: now.toISOString(), ...(old ? { done: true } : {}) }
        if (old) j.attempts.push({ at: now.toISOString(), ok: true, message: `${name}：Buffer の画面で公開を確かめてください（2日たっても確認できませんでした）` })
      })
    }
  }
  return { checked, sent, failed }
}

export interface PromoPlanView {
  week: string
  n: number
  scheduledAt: string
  videoId: string
  title: string
  /** manual = 自動で出せる媒体が無い（時間になったらLINEで動画をお送りして、手で投稿） */
  status: PromoApprovalStatus | 'manual'
  channels: Array<{ channel: PromoChannel; route: PromoRouteName; jobStatus: string | null; url: string | null }>
  requestedAt: string | null
  requestDelivered: boolean
  approvedAt: string | null
  approvedBy: string | null
  /** 承認した（か、見本として送った）動画のURL */
  videoUrl: string | null
  /** 時刻がまだ来ていない */
  upcoming: boolean
  /** 2日以内（画面の上に「承認待ち」を出す） */
  soon: boolean
}

/** 自動投稿の設定の「次の予定」に出す一覧（今週・来週。時刻から24時間たつまで） */
export async function promoPlanView(now = new Date()): Promise<PromoPlanView[]> {
  const settings = await getAutopilotSettings()
  const channels = enabledPromoChannels(settings)
  const jst = jstParts(now)
  const monday = mondayOf(jst.date)
  const routes: Partial<Record<PromoChannel, PromoRouteName>> = {}
  for (const c of channels) routes[c] = await promoRouteFor(c, settings)
  const anyAuto = Object.values(routes).some((r) => r !== 'manual')
  const jobs = await listJobs()
  const from = addHoursLocal(jst.local, -PROMO_APPROVAL_RULES.expireAfterHours)
  const out: PromoPlanView[] = []
  for (const week of [monday, addDays(monday, 7)]) {
    const plan = await getPromoWeekPlan(week)
    for (const [i, entry] of (plan?.items ?? []).entries()) {
      if (entry.scheduledAt < from) continue
      const n = i + 1
      const mine = jobsOfEntry(jobs, week, n)
      const status = promoApprovalStatus(entry, jst.local)
      out.push({
        week,
        n,
        scheduledAt: entry.scheduledAt,
        videoId: entry.videoId,
        title: getPromoVideo(entry.videoId)?.post.title ?? entry.videoId,
        status: anyAuto || status !== 'waiting' ? status : 'manual',
        channels: channels.map((c) => {
          const job = mine.filter((j) => j.channel === c).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0]
          return { channel: c, route: routes[c] ?? 'manual', jobStatus: job?.status ?? null, url: job?.publishedUrl ?? null }
        }),
        requestedAt: entry.request?.at ?? null,
        requestDelivered: Boolean(entry.request?.delivered),
        approvedAt: entry.approval?.status === 'approved' ? entry.approval.at : null,
        approvedBy: entry.approval?.status === 'approved' ? entry.approval.by : null,
        videoUrl: entry.approval?.video?.url ?? entry.request?.video.url ?? null,
        upcoming: entry.scheduledAt > jst.local,
        soon: entry.scheduledAt <= addHoursLocal(jst.local, 48),
      })
    }
  }
  return out
}
