/**
 * 動画ストック管理の型（指示書5-2）
 *
 * 患者が写る動画は permission が 'none' の間は公開工程に進めない運用のため、
 * patientPresent / permission を明示的に持つ。
 */

/** 掲載許可の状態 */
export type MediaPermission = 'granted' | 'none' | 'limited'

export const PERMISSION_LABELS: Record<MediaPermission, string> = {
  granted: '掲載許可あり',
  none: '許可なし',
  limited: '条件付き（期限・範囲あり）',
}

/** 公開状況 */
export type VideoPublishState = 'unused' | 'in_use' | 'published' | 'retired'

export const PUBLISH_STATE_LABELS: Record<VideoPublishState, string> = {
  unused: '未使用',
  in_use: '編集・利用中',
  published: '公開済み',
  retired: '使用停止',
}

export interface StockVideo {
  id: string
  title: string
  /** 動画本体のURL（Vercel Blob等）。未登録なら空 */
  url: string
  /** サムネイル画像URL（任意） */
  thumbUrl?: string
  shotDate?: string // 撮影日 YYYY-MM-DD
  place?: string // 撮影場所
  performer?: string // 出演者
  patientPresent: boolean // 患者が写っているか
  permission: MediaPermission // 掲載許可
  durationSec?: number // 動画時間（秒）
  format?: string // 形式（mp4等）
  resolution?: string // 解像度
  orientation?: 'portrait' | 'landscape' | 'square'
  disease?: string // 対象疾患
  bodyPart?: string // 対象部位
  theme?: string // 投稿テーマ
  channels?: string[] // 使用媒体
  publishState: VideoPublishState
  caption?: string
  hashtags?: string[]
  memo?: string
  createdAt: string
  updatedAt: string
}

/** 公開工程に進めてよいか（掲載許可の担保） */
export function canPublishVideo(v: Pick<StockVideo, 'patientPresent' | 'permission'>): boolean {
  // 患者が写る動画は明示的な掲載許可（granted / limited）が必須
  if (v.patientPresent) return v.permission === 'granted' || v.permission === 'limited'
  // 患者が写らない動画は許可なしでも可（院内風景・図解など）
  return true
}
