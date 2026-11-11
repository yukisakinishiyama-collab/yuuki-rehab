/**
 * 宣伝の短い動画（YouTubeショート・TikTok）：動画の作りおきと、毎週の予約（サーバー専用）
 *
 * 動画: ensurePromoVideo(id) … 文面・描き方が変わっていなければ作りおき（Vercel Blob）を使い、無ければ組み立てて置く。
 *       どの動画を置いたかは KV の promo:video:<id>（文面の指紋つき）。Blob が使えない手元の環境では .data/promo-videos に置く
 * 予約: schedulePromoVideos() … runAutopilot（15分ごと）から。今週（まだ来ていない時刻）と来週の分を、
 *       週ごとに1回だけ決める（promo:week:<月曜>。出した順は promo:history）。
 *       投稿ジョブは媒体ごと（idempotencyKey = promo:<週>:<番号>:<媒体>）。設定でオンの媒体だけ作る
 */
import { getPromoVideo, promoScenes } from '@/data/promo-videos'
import { fingerprint } from '@/lib/sync-merge'
import { kvDelete, kvGet, kvSet } from './kv-store-server'
import { createJob, listJobs, updateJob } from './jobs-store-server'
import { getAutopilotSettings } from './autopilot-store-server'
import type { AutopilotSettings } from './autopilot-types'
import { addDays, jstParts, mondayOf } from './autopilot-planner'
import { APP_URL } from './gbp-seo'
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

export async function promoVideoHash(id: string): Promise<string | null> {
  const video = getPromoVideo(id)
  if (!video) return null
  return fingerprint(JSON.stringify({ v: PROMO_RENDER_VERSION, scenes: promoScenes(video) }))
}

/** 作りおきがあれば返す（作らない） */
export async function getStoredPromoVideo(id: string): Promise<StoredPromoVideo | null> {
  const [stored, hash] = await Promise.all([kvGet<StoredPromoVideo>(VIDEO_KEY(id)).catch(() => null), promoVideoHash(id)])
  if (!stored || !hash || stored.hash !== hash) return null
  if (stored.local && !(await readLocalPromoFile(id, 'mp4'))) return null
  return stored
}

/** 作りおきを使う。無ければ組み立てて置く（20〜60秒ほど） */
export async function ensurePromoVideo(id: string): Promise<StoredPromoVideo> {
  const video = getPromoVideo(id)
  if (!video) throw new Error('動画が見つかりません')
  const existing = await getStoredPromoVideo(id)
  if (existing) return existing

  const hash = (await promoVideoHash(id)) ?? ''
  const { renderPromoVideo } = await import('./promo-video-render')
  const { toJpeg } = await import('./image-template')
  const rendered = await renderPromoVideo(video)
  const poster = await toJpeg(rendered.poster)
  const stored: StoredPromoVideo = { id, hash, url: '', posterUrl: '', seconds: rendered.seconds, bytes: rendered.mp4.length, createdAt: new Date().toISOString() }

  if (process.env.BLOB_READ_WRITE_TOKEN?.trim()) {
    const { put } = await import('@vercel/blob')
    // 名前に指紋を入れる（文面を直したら別の名前になる。古いURLを見ている人に新しい動画が出ないように）
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
