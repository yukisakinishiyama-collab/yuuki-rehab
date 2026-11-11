/**
 * Google検索向けの投稿（Googleビジネスプロフィール）の予定の決め方（純粋な関数）
 *
 * - 週に1〜2本、決まった曜日・時刻（既定は月12:00・金18:00。Instagramと同じテーマの投稿の火・木・土と重ねない）
 * - 投稿は src/data/gbp-seo-posts.ts の決まった文を、上から順にくり返す（前回の続きから）
 * - 予約ボタンは計測リンク（どの投稿から予約が入ったかが予約システムに残る）
 * 型の import だけにしてあるので、node で単体テストできる（tools/test-gbp-seo.mjs）。
 */
import { GBP_SEO_POSTS, gbpSeoText, type GbpSeoPost } from '../../data/gbp-seo-posts'
import { addDays, trackingUrl } from './autopilot-planner'
import type { AutopilotSlot } from './autopilot-types'
import type { GeneratedContent } from './types'

/** 院内アプリ（計測リンク・画像の置き場所） */
export const APP_URL = 'https://yuuki-rehab.vercel.app'

/** 投稿する曜日と時刻（日本時間。0=日 … 6=土）。2本目は perWeek が 2 のときだけ */
export const GBP_SEO_SLOTS: AutopilotSlot[] = [
  { weekday: 1, time: '12:00' }, // 月 昼
  { weekday: 5, time: '18:00' }, // 金 夕方（週末の部活・試合の前）
]

/** その週（月曜 YYYY-MM-DD）の投稿の時刻 'YYYY-MM-DDTHH:MM'（日本時間） */
export function seoSlotsForWeek(weekStart: string, perWeek: number): string[] {
  const n = Math.min(Math.max(Math.floor(perWeek), 1), GBP_SEO_SLOTS.length)
  return GBP_SEO_SLOTS.slice(0, n).map((s) => `${addDays(weekStart, (s.weekday + 6) % 7)}T${s.time}`)
}

/**
 * 次に出す投稿を count 本。前回出した投稿（history の最後）の次から、一覧の順にくり返す。
 * history に無い id（一覧から消した投稿）は飛ばして、さかのぼって探す
 */
export function pickSeoPosts(history: string[], count: number, posts: GbpSeoPost[] = GBP_SEO_POSTS): GbpSeoPost[] {
  if (posts.length === 0 || count <= 0) return []
  let last = -1
  for (let i = history.length - 1; i >= 0; i--) {
    const idx = posts.findIndex((p) => p.id === history[i])
    if (idx !== -1) {
      last = idx
      break
    }
  }
  return Array.from({ length: count }, (_, k) => posts[(last + 1 + k) % posts.length])
}

/** 計測名（例: seo20261116-1）。予約システムの「流入元」に残る */
export function seoCampaign(weekStart: string, index: number): string {
  return `seo${weekStart.replace(/-/g, '')}-${index}`
}

/** 投稿ジョブに入れる中身（本文・予約ボタン・画像の見出し） */
export function seoContent(post: GbpSeoPost, campaign: string): GeneratedContent {
  return {
    title: post.title,
    hook: post.subtitle,
    body: gbpSeoText(post),
    cta: { label: '予約', url: trackingUrl(APP_URL, 'google_post', campaign) },
    hashtags: [],
    imageText: post.title,
    altText: `${post.title}。${post.subtitle}（下関市彦島 ゆうき整骨院）`,
    warnings: [],
    seoPostId: post.id,
  }
}

/** 院内アプリで画像を見る・保存するためのURL（投稿で使うのと同じ描き方） */
export function seoImageUrl(postId: string, base = APP_URL): string {
  return `${base}/api/marketing/image?kind=gbp-seo&id=${encodeURIComponent(postId)}`
}
