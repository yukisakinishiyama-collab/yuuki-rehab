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
  | 'instagram_story'
  | 'google_business'
  | 'line_broadcast'
  | 'note'

export const CHANNEL_LABELS: Record<Channel, string> = {
  instagram_feed: 'Instagramフィード',
  instagram_carousel: 'Instagramカルーセル',
  instagram_reel: 'Instagramリール',
  instagram_story: 'Instagramストーリー',
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
  /**
   * 画像の場面の説明（英語）。下書きを書いたAI（Claude）が本文の内容に合わせて書き、
   * ChatGPT（OpenAIの画像生成）にそのまま渡す。文字・医療行為・顔などを入れない決まりは post-image-server.ts で足す
   */
  imagePrompt?: string
  /** AIで作った投稿画像（文字なしの写真）。投稿するときに見出しの文字を重ねる。無ければテンプレ画像 */
  image?: PostImage
  warnings: string[]
  /**
   * Instagramストーリーの空き状況（instagram_story のときだけ）。
   * 投稿する時刻に予約システムから空きを取り直して画像を作る（下書きのときの空きは snapshot）
   */
  story?: StoryContent
}

/**
 * AIで作った投稿画像（ChatGPT＝OpenAIの画像生成）。
 * 写真には文字を入れず、見出し（表現チェック済みの文言）は投稿するときに院のデザインで重ねる。
 * Instagramフィード・カルーセルの1枚目・Google投稿・noteの見出し画像で同じ写真を使う（媒体ごとに切り抜く）
 */
export interface PostImage {
  kind: 'ai'
  /** 文字の入っていない写真（Vercel Blob の公開URL） */
  photoUrl: string
  /** OpenAIに渡した指示（場面の説明＋共通の決まり） */
  prompt: string
  /** 使えたモデル（例: gpt-image-2） */
  model: string
  createdAt: string
}

export interface StoryContent {
  /** day＝その日（本日）の空き / week＝今週の空き */
  scope: 'day' | 'week'
  /** 載せる日 'YYYY-MM-DD' */
  dates: string[]
  /** 下書きを作ったときの空き（取り直せなかったときに使う） */
  snapshot: Array<{ date: string; closed: boolean; am: number; pm: number }>
  /** 見出し（例「明日のご予約の空き」）。無ければ scope から決める（本日／今週） */
  title?: string
  /** 院長が画面で直したところ（見出し・ひとこと・出さない時間・残り枠の数を出すか） */
  edits?: StoryEdits
}

/** ストーリー画像を出す前に院長が直せるところ */
export interface StoryEdits {
  /** 見出し（最大24文字） */
  title?: string
  /** ひとこと（最大40文字。例「夕方は空きがあります」） */
  note?: string
  /** 出さない時間（'YYYY-MM-DD HH:MM'） */
  hiddenSlots?: string[]
  /** 残り枠の数を出すか（出さないときは「空きあり」だけ） */
  showRemaining?: boolean
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
  /** 診療時間外・急ぎの連絡用の直通番号（LINE緊急応答で案内）。空なら案内しない */
  emergencyPhone?: string
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

/** 参考資料（論文・ガイドライン等）ライブラリ（指示書9章） */
export interface Reference {
  id: string
  title: string
  authors: string
  year: string
  journal: string
  doi: string
  pubmedId: string
  url: string
  design: string // 研究デザイン（RCT・システマティックレビュー・症例報告など）
  subjects: string // 対象者
  findings: string // 主な結果
  limitations: string // 限界
  approved: boolean // 管理者確認済み（承認済みのみ生成に使用）
  createdAt: string
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
