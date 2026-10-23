/**
 * 自動投稿パイプライン（AI下書き → 院長が1タップ承認 → 予定時刻に自動投稿）の型
 *
 * クライアント・サーバー両方から読む（サーバー専用の処理は autopilot-server.ts）。
 *
 * 流れ:
 *   毎週日曜の夕方 … 翌週分の投稿案（テーマ選定→AI下書き→表現チェック）を作り、院長のLINEへ通知
 *   院長          … 承認画面で内容を見て「承認」をタップ（修正・作り直し・見送りも可）
 *   予定時刻      … 既存の投稿ジョブ（jobs/run）が媒体へ投稿。API未接続の媒体は
 *                   「手動対応待ち」にして院長のLINEへ本文を送る（コピーして貼るだけ）
 * 承認されなかった案は予定時刻を過ぎると「期限切れ」になり、勝手に投稿されることはない。
 */
import type { Channel, ContentVariant, Objective } from './types'

/** 投稿枠（曜日と時刻。日本時間） */
export interface AutopilotSlot {
  /** 0=日 … 6=土 */
  weekday: number
  /** 'HH:MM' */
  time: string
}

export type InstagramMode = 'instagram_feed' | 'instagram_carousel' | 'off'

export interface AutopilotSettings {
  /** 毎週の自動下書きを作るか */
  enabled: boolean
  /** 1週間の投稿本数（1〜5） */
  postsPerWeek: number
  /** 投稿枠（postsPerWeek 本ぶんを先頭から使う） */
  slots: AutopilotSlot[]
  /** Instagramの投稿形式（off=Instagramには出さない） */
  instagram: InstagramMode
  /** Googleビジネスプロフィールにも同じテーマで投稿する */
  google: boolean
  /** 週のはじめにGoogle投稿で「今週の予約の空き状況」を出す（予約システムから自動集計） */
  availabilityPost: boolean
  /**
   * 空き状況を Instagram のストーリーにも出す（週のはじめ＝今週の空き・空きが多い日の朝＝本日の空き）。
   * 画像は投稿する時刻の空きで作り直し、空きが無くなっていたら出さない。承認されるまで出さない
   */
  availabilityStory: boolean
  /** 下書きを作る時刻（日曜・日本時間の時。既定18時） */
  generateHour: number
  /** 来週の投稿で触れてほしいこと（院長メモ）。次の下書きで1本目のテーマになり、使ったら空に戻る */
  ownerNote: string
  /** 基本設定画面の院情報（端末に保存されたもの）をサーバー側の下書きにも反映するための写し */
  clinicProfile?: Record<string, string>
  updatedAt?: string
}

export const DEFAULT_SLOTS: AutopilotSlot[] = [
  { weekday: 2, time: '12:00' }, // 火 昼休み
  { weekday: 4, time: '19:00' }, // 木 夜（部活・仕事終わり）
  { weekday: 6, time: '09:00' }, // 土 朝
  { weekday: 1, time: '19:00' }, // 月 夜
  { weekday: 3, time: '12:00' }, // 水 昼
]

export const DEFAULT_AUTOPILOT_SETTINGS: AutopilotSettings = {
  enabled: true,
  postsPerWeek: 3,
  slots: DEFAULT_SLOTS,
  instagram: 'instagram_carousel',
  google: true,
  availabilityPost: true,
  availabilityStory: true,
  generateHour: 18,
  ownerNote: '',
}

export const WEEKDAY_LABELS = ['日', '月', '火', '水', '木', '金', '土']

/** テーマの系統（毎週この順で組み合わせ、内容が偏らないようにする） */
export type ThemeCategory = 'expertise' | 'prevention' | 'clinic' | 'availability' | 'owner'

export const CATEGORY_LABELS: Record<ThemeCategory, string> = {
  expertise: '症状・ケガの解説',
  prevention: '予防・セルフケア',
  clinic: '院のご案内',
  availability: '空き状況のご案内',
  owner: '院長メモから',
}

export type ProposalItemStatus = 'proposed' | 'approved' | 'skipped' | 'expired'

export const ITEM_STATUS_LABELS: Record<ProposalItemStatus, string> = {
  proposed: '承認待ち',
  approved: '承認済み（予約投稿）',
  skipped: '見送り',
  expired: '期限切れ（投稿しない）',
}

/** 投稿案1本（1テーマ × 複数媒体） */
export interface ProposalItem {
  id: string
  /** 'YYYY-MM-DDTHH:MM'（日本時間） */
  scheduledAt: string
  category: ThemeCategory
  /** テーマ集のID（同じテーマを続けて出さないための記録） */
  themeId: string
  objective: Objective
  theme: string
  /** 公開サイトの関連ページ（例: /symptoms/acl） */
  sitePath?: string
  /** 計測名（例: ap20261026-1）。予約システムの「流入元」に残り、投稿ごとの予約数がわかる */
  campaign?: string
  variants: ContentVariant[]
  /** 媒体ごとに「今回は出さない」を選んだもの */
  excludedChannels?: Channel[]
  status: ProposalItemStatus
  approvedAt?: string
  approvedBy?: string
  jobIds?: string[]
  /** 生成に失敗した媒体の記録 */
  errors?: string[]
}

export interface WeeklyProposal {
  /** 対象週の月曜 'YYYY-MM-DD'（日本時間）。KVキーにも使う */
  weekStart: string
  createdAt: string
  status: 'generating' | 'ready'
  mode?: 'mock' | 'live'
  items: ProposalItem[]
  /** 院長へ「下書きができました」を送った日時 */
  notifiedAt?: string
  notifyResult?: string
  /** 「明日の投稿がまだ承認されていません」を送った日時 */
  remindedAt?: string
  updatedAt?: string
}

/** 投稿案のうち、実際に投稿する媒体（見送り指定と表現チェックNGを除く前の一覧） */
export function activeVariants(item: ProposalItem): ContentVariant[] {
  const excluded = new Set(item.excludedChannels ?? [])
  return item.variants.filter((v) => !excluded.has(v.channel))
}

/** 承認できるか（NG表現の残る媒体がある・投稿する媒体がゼロ なら不可） */
export function approvalBlocker(item: ProposalItem): string | null {
  // 期限切れの案も、あとから承認すれば次の実行（15分以内）で投稿できる
  if (item.status !== 'proposed' && item.status !== 'expired') return 'この投稿案は承認待ちではありません'
  const active = activeVariants(item)
  if (active.length === 0) return '投稿する媒体がありません（すべて「出さない」になっています）'
  const blocked = active.filter((v) => v.compliance.status === 'blocked')
  if (blocked.length > 0) return '公開できない表現（NG）が残っています。本文を直してから承認してください'
  return null
}
