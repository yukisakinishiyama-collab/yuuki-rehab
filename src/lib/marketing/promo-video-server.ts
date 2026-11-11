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
 */
import { getPromoVideo, promoAiPrompt, promoScenes, type PromoAiVisual, type PromoVideo } from '@/data/promo-videos'
import { fingerprint } from '@/lib/sync-merge'
import { kvDelete, kvGet, kvSet } from './kv-store-server'
import { createJob, listJobs, updateJob } from './jobs-store-server'
import { getAutopilotSettings } from './autopilot-store-server'
import type { AutopilotSettings } from './autopilot-types'
import { addDays, jstParts, mondayOf } from './autopilot-planner'
import { APP_URL } from './gbp-seo'
import { generateOpenAiImage, openAiImageConfigured } from './openai-image-server'
import type { PromoSceneImage } from './promo-video-render'
import { isPromoJobKey, pickPromoVideos, PROMO_RENDER_VERSION, promoCampaign, promoContent, promoJobKey, promoSlotsForWeek, promoVideoUrl, type PromoChannel } from './promo-video'

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

// ── 毎週の予約 ─────────────────────────────────

const WEEK_KEY = (week: string) => `promo:week:${week}`
const HISTORY_KEY = 'promo:history'

export interface PromoWeekPlan {
  weekStart: string
  createdAt: string
  items: Array<{ scheduledAt: string; videoId: string; campaign: string }>
}

export async function getPromoWeekPlan(week: string): Promise<PromoWeekPlan | null> {
  return kvGet<PromoWeekPlan>(WEEK_KEY(week))
}

export function enabledPromoChannels(settings: Pick<AutopilotSettings, 'youtubeShorts' | 'tiktokVideo'>): PromoChannel[] {
  return [...(settings.youtubeShorts ? (['youtube_short'] as const) : []), ...(settings.tiktokVideo ? (['tiktok'] as const) : [])]
}

/**
 * 今週（まだ来ていない時刻だけ）と来週の分を予約する。どの媒体もオフなら何もしない。
 * どの動画をいつ出すかは週ごとに1回だけ決め、投稿ジョブはオンの媒体の分だけ作る（あとからオンにした媒体も、次の回で足す）
 */
export async function schedulePromoVideos(now = new Date()): Promise<{ scheduled: number; weeks: string[]; skipped?: string }> {
  const settings = await getAutopilotSettings()
  const channels = enabledPromoChannels(settings)
  if (channels.length === 0) return { scheduled: 0, weeks: [], skipped: 'YouTube・TikTokの動画はオフです' }
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
