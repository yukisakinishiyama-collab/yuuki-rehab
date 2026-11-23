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
   * Google検索向けの投稿（「下関市彦島＋症状」の検索ワードと院の強みを入れた決まった文＋院の写真の画像）を、
   * 毎週決まった曜日に自動で出す（src/data/gbp-seo-posts.ts を順にくり返す）。
   * 文面は院長が確認した決まった文なので、この設定をオンにしたことを毎回の承認の代わりにする（2026-11-11 院長の依頼）
   */
  googleSeo: boolean
  /** Google検索向けの投稿の本数（週1＝月曜、週2＝月曜と金曜） */
  googleSeoPerWeek: number
  /**
   * 宣伝の短い動画（院の写真＋文字・約16秒。src/data/promo-videos.ts を順にくり返す）を、毎週 YouTube ショートに出す。
   * 連携と審査（youtubeAudited）が済むと自動で公開。それまでは、時間になると動画と文を院長のLINEへ届ける（2026-11-11 院長の依頼）
   */
  youtubeShorts: boolean
  /** 同じ動画を TikTok にも出す（時間になると動画と文を院長のLINEへ届ける。アプリの中で音楽を足して投稿する） */
  tiktokVideo: boolean
  /**
   * 同じ動画を Instagram のリールにも出す（Instagram とつながっていれば、院長の承認のあと自動で。
   * つながっていなければ、時間になると動画と文を院長のLINEへ届ける。2026-11-12 院長の依頼）
   */
  instagramReels: boolean
  /** 動画の本数（週1＝水曜、週2＝水曜と土曜） */
  promoVideoPerWeek: number
  /**
   * YouTube の審査（YouTube API サービスの利用確認）に通った。
   * 通る前にアプリから送った動画は「非公開」に固定され、あとから公開に直せない（YouTube の決まり）。
   * そのため、ここをオンにするまではアプリからは送らず、手で投稿してもらう
   */
  youtubeAudited: boolean
  /**
   * 空き状況を Instagram のストーリーにも出す（週のはじめ＝今週の空き・空きが多い日の朝＝本日の空き）。
   * 画像は投稿する時刻の空きで作り直し、空きが無くなっていたら出さない。承認されるまで出さない
   */
  availabilityStory: boolean
  /**
   * キャンセルが出たら、空いた枠を Instagram のストーリーですぐ知らせる（予約システムのキャンセルの通知をきっかけに）。
   * 院長がこの設定をオンにしたことを「毎回の承認」の代わりにする（出すのは空き状況の定型の画像だけ。患者さんの情報は載せない）
   */
  cancelStory: boolean
  /** どの日のキャンセルを知らせるか（today=当日だけ／tomorrow=当日と翌日） */
  cancelStoryDays: 'today' | 'tomorrow'
  /** 空いた枠の何分前までなら知らせるか（それより近い枠は、見てから来るのが間に合わないので出さない） */
  cancelStoryLeadMinutes: number
  /** ストーリーを出してよい時間帯（日本時間の時。from 時から to 時まで）。外のキャンセルは from 時に出す（枠に間に合うときだけ） */
  cancelStoryFromHour: number
  cancelStoryToHour: number
  /** 1日に出すキャンセルのストーリーの上限 */
  cancelStoryMaxPerDay: number
  /**
   * 今日の空き（毎日）：決まった時刻（既定 8:00・13:00）に、その時刻の「本日の空き」を出す（2026-11-19 院長の依頼）。
   * 出す時刻に予約システムから空きを取り直して作る。休みの日・空きが無いときは出さない。
   * 院長がこの設定をオンにしたことを「毎回の承認」の代わりにする（出すのは空き状況の定型の画像・文だけ。患者さんの情報は載せない）
   */
  dailyOpenings: boolean
  /** 出す時刻（'HH:MM'・日本時間。1〜3個） */
  dailyOpeningsTimes: string[]
  /** Instagram のストーリーに出す（24時間で消える） */
  dailyOpeningsStory: boolean
  /** Google（ビジネスプロフィール）の投稿に出す。新しく出したら、前の「今日の空き」の投稿は消して最新の1本だけ残す */
  dailyOpeningsGoogle: boolean
  /**
   * 求人ストーリー（毎日）：院長が登録した募集の動画を、決まった時刻（既定 9:00・14:00・19:00）に
   * Instagram のストーリーへ出す（2026-11-23 院長の依頼）。中身は毎回同じなので作り直さない。
   * 院長がこの設定をオンにしたことを「毎回の承認」の代わりにする（出すのは院長が確認した動画だけ）。
   * 採用が決まったらオフにする（または recruitStoryUntil に終わりの日を入れる）
   */
  recruitStory: boolean
  /** 出す時刻（'HH:MM'・日本時間。1〜4個） */
  recruitStoryTimes: string[]
  /** 出す動画のアドレス（Vercel Blob。設定画面から動画を選ぶと入る。Instagram が外から取りに来る） */
  recruitStoryVideoUrl: string
  /** 掲載の終わりの日 'YYYY-MM-DD'（空なら、オフにするまで続ける） */
  recruitStoryUntil: string
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
  googleSeo: true,
  googleSeoPerWeek: 2,
  youtubeShorts: true,
  tiktokVideo: true,
  instagramReels: true,
  promoVideoPerWeek: 1,
  youtubeAudited: false,
  availabilityStory: true,
  // キャンセルのストーリーは院長がオンにするまで出さない
  cancelStory: false,
  cancelStoryDays: 'tomorrow',
  cancelStoryLeadMinutes: 60,
  cancelStoryFromHour: 7,
  cancelStoryToHour: 21,
  cancelStoryMaxPerDay: 3,
  // 今日の空き（毎日）：院長が 2026-11-19 に「本番に入れてオンにする」を選んだので、最初からオン（設定画面でオフにできる）
  dailyOpenings: true,
  dailyOpeningsTimes: ['08:00', '13:00'],
  dailyOpeningsStory: true,
  dailyOpeningsGoogle: true,
  // 求人ストーリー：動画を登録して院長がオンにするまで出さない
  recruitStory: false,
  recruitStoryTimes: ['09:00', '14:00', '19:00'],
  recruitStoryVideoUrl: '',
  recruitStoryUntil: '',
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
