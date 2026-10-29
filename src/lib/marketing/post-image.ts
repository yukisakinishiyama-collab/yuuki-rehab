/**
 * 投稿画像の共通ルール（画面・サーバーの両方から使う。サーバー専用の部品は読み込まない）
 *
 * - どの媒体に画像を付けるか（AI画像を使う媒体）
 * - 画像に重ねる見出しの文字（表現チェック済みの文言だけを使う）
 * - 院内アプリで見るための画像のURL（/api/marketing/image。投稿で使うのと同じ描き方）
 */
import type { Channel, ContentVariant, GeneratedContent } from './types'

/** AI画像（写真＋見出し）を使う媒体。LINE・リール・ストーリーは対象外 */
export const AI_IMAGE_CHANNELS: Channel[] = ['instagram_feed', 'instagram_carousel', 'google_business', 'note']

export function usesAiImage(channel: Channel): boolean {
  return AI_IMAGE_CHANNELS.includes(channel)
}

/** 媒体ごとの画像の大きさ（image-template.tsx の IMAGE_SIZES のキー） */
export function imageSizeFor(channel: Channel): 'instagram' | 'google' | 'note' {
  if (channel === 'google_business') return 'google'
  if (channel === 'note') return 'note'
  return 'instagram'
}

/**
 * 画像に重ねる見出し。カルーセルは1枚目（表紙）の見出し、それ以外は画像用の文言→タイトル→フックの順。
 * どれも生成後の表現チェック（checkGenerated）の対象になっている文言だけを使う
 */
export function imageTextFor(content: GeneratedContent, channel: Channel, theme = ''): { title: string; subtitle: string } {
  // カルーセルはスライドが2枚以上のときだけカルーセルで出す（publishers.ts）。1枚以下はフィードと同じ見出し
  if (channel === 'instagram_carousel' && (content.slides?.length ?? 0) >= 2 && content.slides?.[0]) {
    const cover = content.slides[0]
    return { title: cover.heading || content.imageText || content.title || theme, subtitle: cover.body.slice(0, 40) }
  }
  return { title: content.imageText || content.title || content.hook || theme, subtitle: content.hook.slice(0, 40) }
}

/** 院内アプリで画像を見る・保存するためのURL（AI画像があれば写真＋見出し、無ければテンプレ画像） */
export function postImageUrl(content: GeneratedContent, channel: Channel, theme = '', base = ''): string {
  const { title, subtitle } = imageTextFor(content, channel, theme)
  const params = new URLSearchParams({ title, subtitle, size: imageSizeFor(channel) })
  if (content.image?.photoUrl) params.set('photo', content.image.photoUrl)
  return `${base}/api/marketing/image?${params.toString()}`
}

/** 投稿のなかで、画像の場面の説明に使う指示（Instagram → Google → note の順で、AIが書いたもの） */
export function sceneFromVariants(variants: ContentVariant[]): { scene?: string; content?: GeneratedContent } {
  const order: Channel[] = ['instagram_feed', 'instagram_carousel', 'google_business', 'note']
  const sorted = [...variants].sort((a, b) => order.indexOf(a.channel) - order.indexOf(b.channel))
  const withScene = sorted.find((v) => usesAiImage(v.channel) && v.content.imagePrompt?.trim())
  const first = withScene ?? sorted.find((v) => usesAiImage(v.channel)) ?? variants[0]
  return { scene: withScene?.content.imagePrompt, content: first?.content }
}
