/**
 * 宣伝の短い動画（YouTubeショート・TikTok）の予定の決め方（純粋な関数）
 *
 * - 週に1〜2本、決まった曜日・時刻（既定は水13:30。2本めは土16:00）。同じ動画を YouTube と TikTok の両方へ
 *   （Google検索向けの投稿＝月12:00・金18:00、Instagram＝火・木・土 と重ねない。
 *    手で投稿する間は、院長が手の空く昼休み・土曜の受付のあとに LINE が届くようにしている）
 * - 動画は src/data/promo-videos.ts の18本を、上から順にくり返す（前回の続きから）
 * - YouTube は、連携と審査（APIの利用確認）が済むと自動で公開。それまでは動画と文を院長のLINEへ届ける
 * - TikTok は、動画と文を院長のLINEへ届ける（アプリの中で音楽を足して投稿する）
 * 型の import だけにしてあるので、node で単体テストできる（tools/test-promo-video.mjs）。
 */
import { PROMO_VIDEOS, tiktokCaption, youtubeDescription, youtubeTitle, type PromoVideo } from '../../data/promo-videos'
import { addDays, trackingUrl } from './autopilot-planner'
import type { AutopilotSlot } from './autopilot-types'
import { APP_URL, isYearEndBreak } from './gbp-seo'
import type { GeneratedContent } from './types'

/** 動画の描き方（promo-video-render.tsx）を変えたら上げる。作りおきの動画を作り直す目印になる */
export const PROMO_RENDER_VERSION = 2

export type PromoChannel = 'youtube_short' | 'tiktok'
export const PROMO_CHANNELS: PromoChannel[] = ['youtube_short', 'tiktok']

/** 投稿する曜日と時刻（日本時間。0=日 … 6=土）。2本目は perWeek が 2 のときだけ */
export const PROMO_SLOTS: AutopilotSlot[] = [
  { weekday: 3, time: '13:30' }, // 水 昼休み
  { weekday: 6, time: '16:00' }, // 土 受付のあと
]

/** その週（月曜 YYYY-MM-DD）の投稿の時刻 'YYYY-MM-DDTHH:MM'（日本時間）。年末年始（12/29〜1/3）は除く */
export function promoSlotsForWeek(weekStart: string, perWeek: number): string[] {
  const n = Math.min(Math.max(Math.floor(perWeek), 1), PROMO_SLOTS.length)
  return PROMO_SLOTS.slice(0, n)
    .map((s) => `${addDays(weekStart, (s.weekday + 6) % 7)}T${s.time}`)
    .filter((slot) => !isYearEndBreak(slot.slice(0, 10)))
}

/** 次に出す動画を count 本。前回出した動画（history の最後）の次から、一覧の順にくり返す */
export function pickPromoVideos(history: string[], count: number, videos: PromoVideo[] = PROMO_VIDEOS): PromoVideo[] {
  if (videos.length === 0 || count <= 0) return []
  let last = -1
  for (let i = history.length - 1; i >= 0; i--) {
    const idx = videos.findIndex((v) => v.id === history[i])
    if (idx !== -1) {
      last = idx
      break
    }
  }
  return Array.from({ length: count }, (_, k) => videos[(last + 1 + k) % videos.length])
}

/** 計測名（例: pv20261116-1）。説明のリンクから予約に進むと、予約システムの「流入元」に残る */
export function promoCampaign(weekStart: string, index: number): string {
  return `pv${weekStart.replace(/-/g, '')}-${index}`
}

/** 投稿ジョブの目印（idempotencyKey = promo:<週>:<番号>:<媒体>） */
export function promoJobKey(weekStart: string, index: number, channel: PromoChannel): string {
  return `promo:${weekStart}:${index}:${channel}`
}

export function isPromoJobKey(key: string): boolean {
  return key.startsWith('promo:')
}

/** 同じ動画の YouTube・TikTok のジョブをまとめる目印（promo:<週>:<番号>） */
export function promoGroupKey(key: string): string | null {
  const parts = key.split(':')
  return parts[0] === 'promo' && parts.length >= 4 ? `${parts[1]}:${parts[2]}` : null
}

/** 投稿ジョブに入れる中身（題名・説明。動画そのものは投稿するときに作る／作りおきを使う） */
export function promoContent(video: PromoVideo, channel: PromoChannel, campaign: string): GeneratedContent {
  const source = channel === 'youtube_short' ? 'youtube' : 'tiktok'
  const url = trackingUrl(APP_URL, source, campaign)
  return {
    title: channel === 'youtube_short' ? youtubeTitle(video) : video.post.title,
    hook: video.post.subtitle,
    // そのまま貼れる形（ハッシュタグも中に入れてある）
    body: channel === 'youtube_short' ? youtubeDescription(video, url) : tiktokCaption(video),
    cta: { label: '予約', url },
    hashtags: [],
    imageText: video.post.title,
    altText: `${video.post.title}（下関市彦島 ゆうき整骨院の紹介動画）`,
    warnings: [],
    promoVideoId: video.id,
  }
}

/** 院内アプリで動画・見本の絵を見るためのURL */
export function promoVideoUrl(id: string, kind: 'video' | 'poster' = 'video', base = APP_URL): string {
  return `${base}/api/marketing/promo-video?id=${encodeURIComponent(id)}&kind=${kind}`
}
