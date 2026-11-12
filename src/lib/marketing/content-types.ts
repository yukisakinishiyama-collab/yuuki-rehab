/**
 * コンテンツ（集客 → コンテンツ）の一覧の型と、今までの状態からの読みかえ。画面とサーバーの両方から読む
 *
 * 指示書6章の4つの状態にそろえる
 *   下書き   … 作りかけ（投稿を作る の下書き）
 *   確認待ち … 院長の確認・承認を待っているもの（自動投稿の案・確認待ちの下書き）
 *   承認済み … 承認して、予定の時刻を待っているもの（投稿ジョブの予約中・手動対応待ち・失敗）
 *   公開済み … 出したもの
 * どの媒体も、承認されるまで公開されない（自動投稿は院長の承認、投稿ジョブは院長だけが作れる）。
 */
import type { Channel, PostStatus } from './types'

export type ContentStage = 'draft' | 'review' | 'approved' | 'published'

export const CONTENT_STAGE_LABELS: Record<ContentStage, string> = {
  draft: '下書き',
  review: '確認待ち',
  approved: '承認済み',
  published: '公開済み',
}

export type ContentMedium = 'instagram' | 'google' | 'homepage' | 'other'

export const CONTENT_MEDIUM_LABELS: Record<ContentMedium, string> = {
  instagram: 'Instagram',
  google: 'Google',
  homepage: 'ホームページ',
  other: 'そのほか',
}

export interface ContentItem {
  id: string
  /** どこで作ったか（自動投稿の案・投稿ジョブ・この端末の下書き） */
  origin: 'autopilot' | 'job' | 'compose'
  medium: ContentMedium
  channelLabel: string
  theme: string
  stage: ContentStage
  /** 気をつけること（期限切れ・手動対応待ち・公開失敗・NG表現あり） */
  flag?: { label: string; tone: 'amber' | 'red' }
  /** 投稿ジョブのとき、もとの下書きの id（端末の下書きと2回数えないため） */
  variantId?: string
  /** 予定・公開の日時（日本時間 'YYYY-MM-DDTHH:MM'） */
  when?: string
  href: string
}

export function mediumOf(channel: Channel): ContentMedium {
  if (channel.startsWith('instagram')) return 'instagram'
  if (channel === 'google_business') return 'google'
  return 'other'
}

/** 投稿を作る（端末の下書き）の状態 → 4つの状態。取消は出さない */
export function stageOfPost(status: PostStatus): ContentStage | null {
  if (status === 'draft') return 'draft'
  if (status === 'review') return 'review'
  if (status === 'approved' || status === 'scheduled' || status === 'failed') return 'approved'
  if (status === 'published') return 'published'
  return null
}

/** ISO の日時 → 日本時間 'YYYY-MM-DDTHH:MM' */
export function toJstLocal(iso: string | undefined): string | undefined {
  if (!iso) return undefined
  // すでに日本時間の 'YYYY-MM-DDTHH:MM'（タイムゾーンの印なし）ならそのまま
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(iso)) return iso
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return undefined
  return new Date(t + 9 * 60 * 60 * 1000).toISOString().slice(0, 16)
}
