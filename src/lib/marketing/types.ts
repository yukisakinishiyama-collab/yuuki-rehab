/**
 * 統合マーケティングハブ ドメイン型定義
 *
 * Phase 1: localStorage永続化。Phase 3でDB移行するため
 * IDと型のインターフェースは互換を維持したまま拡張する。
 */

/** 配信媒体 */
export type Channel =
  | 'instagram_feed'
  | 'instagram_carousel'
  | 'instagram_reel'
  | 'google_business'
  | 'line_broadcast'
  | 'note'

export const CHANNEL_LABELS: Record<Channel, string> = {
  instagram_feed: 'Instagramフィード',
  instagram_carousel: 'Instagramカルーセル',
  instagram_reel: 'Instagramリール',
  google_business: 'Google投稿',
  line_broadcast: '公式LINE配信',
  note: 'note記事',
}

/** 投稿の目的 */
export const OBJECTIVES = [
  '新規来院',
  '認知拡大',
  '専門性の説明',
  '既存患者への案内',
  '営業時間変更・休診案内',
  '料金案内',
  '症例・リハビリ解説',
  '論文解説',
  'スポーツ障害予防',
  '予約枠案内',
  'イベント案内',
  '採用',
  'その他',
] as const
export type Objective = (typeof OBJECTIVES)[number]

/** 投稿ステータス（指示書12章の遷移を簡約。前方互換） */
export type PostStatus =
  | 'draft' // 下書き（AI生成済み含む）
  | 'review' // 管理者確認待ち
  | 'approved' // 承認済み
  | 'scheduled' // 予約済み
  | 'published' // 公開済み（Phase 1では手動公開の記録）
  | 'failed' // 公開失敗
  | 'cancelled' // 取消済み

export const STATUS_LABELS: Record<PostStatus, string> = {
  draft: '下書き',
  review: '確認待ち',
  approved: '承認済み',
  scheduled: '予約済み',
  published: '公開済み',
  failed: '公開失敗',
  cancelled: '取消済み',
}

/** 表現チェック結果 */
export type ComplianceStatus = 'pass' | 'review' | 'blocked'

export interface ComplianceFinding {
  level: 'NG' | '注意'
  match: string
  reason: string
  suggestion: string
}

export interface ComplianceResult {
  status: ComplianceStatus
  findings: ComplianceFinding[]
  checkedAt: string
  /** blocked を管理者が解除した場合の理由（監査ログにも記録） */
  overrideReason?: string
}

/** カルーセルの1枚 */
export interface CarouselSlide {
  order: number
  heading: string
  body: string
  imagePrompt?: string
}

/** AI生成された媒体別コンテンツ（指示書23章 GeneratedContent 互換） */
export interface GeneratedContent {
  title: string
  hook: string
  body: string
  cta: { label: string; url: string }
  hashtags: string[]
  slides?: CarouselSlide[]
  imageText?: string
  altText?: string
  warnings: string[]
}

/** 媒体別バリアント（1プロジェクトから媒体ごとに生成） */
export interface ContentVariant {
  id: string
  channel: Channel
  content: GeneratedContent
  compliance: ComplianceResult
  /** 手動編集後の本文（編集されたら再チェック必須） */
  editedAt?: string
  scheduledAt?: string // ISO。予約日時
  publishedAt?: string
  publishedUrl?: string
  status: PostStatus
}

/** 投稿プロジェクト（1つの入力 → 複数媒体） */
export interface ContentProject {
  id: string
  createdAt: string
  updatedAt: string
  objective: Objective
  theme: string
  audience?: string
  keyMessage?: string
  evidence?: string
  cta?: string
  tone?: string
  notes?: string
  channels: Channel[]
  variants: ContentVariant[]
}

/** 院の基本情報（全生成に注入する一元管理データ・指示書18章） */
export interface ClinicProfile {
  name: string
  address: string
  phone: string
  hours: string
  closedDays: string
  reserveUrl: string
  lineUrl: string
  googleMapUrl: string
  instagramUrl: string
  parking: string
  services: string
  notServices: string
  priceSummary: string
  firstVisitFlow: string
  strengths: string
  bannedPhrases: string
  defaultTone: string
}

/** 監査ログ */
export interface AuditLogEntry {
  id: string
  at: string
  actor: string
  action: string
  target: string
  detail?: string
}
