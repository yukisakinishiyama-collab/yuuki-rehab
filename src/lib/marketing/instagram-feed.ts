/**
 * ホームページに出す Instagram の最新投稿（純粋関数。サーバー専用モジュールを読み込まない）
 *
 * - 「勉強会・研修で学んだこと」などの投稿を優先して選ぶ（mode=learning）。
 *   該当が1件もないときは最新の投稿を返し、matched=false で知らせる（見出しを切り替えるため）
 * - 患者さんの感想・口コミに当たる投稿は、ホームページには出さない
 *   （あはき・柔整広告ガイドライン：施術所に都合の良い感想だけを選んで載せることは不適切）
 * - 画像は Instagram の配信元へ直接リンクせず、院内アプリの中継（/api/public/instagram-feed/image/<id>）を通す
 */

export type RawMedia = {
  id: string
  caption?: string
  media_type?: string // IMAGE / VIDEO / CAROUSEL_ALBUM
  media_product_type?: string // FEED / REELS / STORY
  media_url?: string
  thumbnail_url?: string
  permalink?: string
  timestamp?: string
}

export type FeedItem = {
  id: string
  permalink: string
  image: string
  text: string
  date: string // YYYY-MM-DD（日本時間）
  reel: boolean
}

export type FeedMode = 'learning' | 'latest'

/** 勉強会・研修などで学んだことの投稿とみなす言葉 */
export const LEARNING_WORDS = ['勉強会', 'セミナー', '研修', '学会', '講習', '講演', '受講', '学んで', '学び', '文献', '論文']

/** ホームページに出さない投稿（患者さんの感想・口コミ・体験談など） */
export const EXCLUDE_WORDS = ['ご感想', '感想をいただ', '患者様の声', '患者さんの声', 'お客様の声', '口コミ', 'クチコミ', '体験談', 'ビフォー', 'アフター']

export function isExcluded(caption = ''): boolean {
  return EXCLUDE_WORDS.some((w) => caption.includes(w))
}

export function isLearning(caption = ''): boolean {
  return LEARNING_WORDS.some((w) => caption.includes(w))
}

/** キャプションの1行目から、ハッシュタグ・メンション・URL・絵文字の連続を除いた短い文 */
export function summarizeCaption(caption = '', max = 48): string {
  const firstMeaningful =
    caption
      .split(/\r?\n/)
      .map((line) =>
        line
          .replace(/https?:\/\/\S+/g, '')
          .replace(/[#＃][^\s#＃]+/g, '')
          .replace(/@[\w.]+/g, '')
          .replace(/[【】]/g, ' ')
          .replace(/\s+/g, ' ')
          .trim(),
      )
      .find((line) => line.length >= 4) ?? ''
  const chars = Array.from(firstMeaningful)
  return chars.length > max ? `${chars.slice(0, max - 1).join('')}…` : firstMeaningful
}

/** ISO の日時を日本時間の日付（YYYY-MM-DD）に */
export function jstDate(iso = ''): string {
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return ''
  return new Date(t + 9 * 60 * 60 * 1000).toISOString().slice(0, 10)
}

function isUsable(m: RawMedia): boolean {
  if (!m || !/^\d{5,25}$/.test(m.id ?? '')) return false
  if (!m.permalink || !/^https:\/\/www\.instagram\.com\//.test(m.permalink)) return false
  if (m.media_product_type === 'STORY') return false
  return Boolean(m.media_type === 'VIDEO' ? m.thumbnail_url : m.media_url)
}

export function toFeedItems(
  media: RawMedia[],
  opts: { mode: FeedMode; limit: number; imageBase: string },
): { items: FeedItem[]; matched: boolean } {
  const limit = Math.min(Math.max(Math.trunc(opts.limit) || 3, 1), 6)
  const usable = (Array.isArray(media) ? media : [])
    .filter(isUsable)
    .filter((m) => !isExcluded(m.caption))
    .sort((a, b) => (Date.parse(b.timestamp ?? '') || 0) - (Date.parse(a.timestamp ?? '') || 0))

  let picked = usable
  let matched = opts.mode === 'latest'
  if (opts.mode === 'learning') {
    const learning = usable.filter((m) => isLearning(m.caption))
    matched = learning.length > 0
    picked = matched ? learning : usable
  }

  const base = opts.imageBase.replace(/\/$/, '')
  const items = picked.slice(0, limit).map((m) => ({
    id: m.id,
    permalink: m.permalink as string,
    image: `${base}/${m.id}`,
    text: summarizeCaption(m.caption),
    date: jstDate(m.timestamp),
    reel: m.media_product_type === 'REELS' || m.media_type === 'VIDEO',
  }))
  return { items, matched }
}

/** 画像の中継で取りに行く URL（動画はサムネイル） */
export function pickImageUrl(m: Pick<RawMedia, 'media_type' | 'media_url' | 'thumbnail_url'>): string | null {
  const url = m.media_type === 'VIDEO' ? m.thumbnail_url : m.media_url ?? m.thumbnail_url
  return url && isAllowedImageHost(url) ? url : null
}

/** Instagram の画像配信元だけを許す（中継で任意の URL を取りに行かないように） */
export function isAllowedImageHost(url: string): boolean {
  try {
    const u = new URL(url)
    if (u.protocol !== 'https:') return false
    return /(^|\.)cdninstagram\.com$/.test(u.hostname) || /(^|\.)fbcdn\.net$/.test(u.hostname)
  } catch {
    return false
  }
}
