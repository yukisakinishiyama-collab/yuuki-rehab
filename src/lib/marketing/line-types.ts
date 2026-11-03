/** LINE導線 ドメイン型（Phase 2） */

/** 相談の入口（友だち追加時に提示する選択肢・指示書4-1） */
export type IntentKey =
  | 'injury' // ケガをした
  | 'sports' // スポーツ復帰について相談したい
  | 'postop' // 手術後のリハビリを相談したい
  | 'chronic' // 慢性的な痛みを相談したい
  | 'price' // 料金を知りたい
  | 'reserve' // 予約を取りたい
  | 'lost' // どこに相談すればよいか分からない

export const INTENT_LABELS: Record<IntentKey, string> = {
  injury: 'ケガをした',
  sports: 'スポーツ復帰について相談したい',
  postop: '手術後のリハビリを相談したい',
  chronic: '慢性的な痛みを相談したい',
  price: '料金を知りたい',
  reserve: '予約を取りたい',
  lost: 'どこに相談すればよいか分からない',
}

/** シナリオの進行位置 */
export type ScenarioStep =
  | 'idle' // 未開始（意図選択待ち）
  | 'ask_part' // 部位を質問中
  | 'ask_when' // 時期・きっかけを質問中
  | 'guide' // 案内済み（予約導線提示済み）
  | 'human' // 人対応中（自動応答停止）
  | 'urgent' // 緊急案内済み（自動フォロー停止）

/** ボットが返すメッセージ（シミュレーター描画とLINE API送信の共通形式） */
export type BotReply =
  | { type: 'text'; text: string }
  | { type: 'buttons'; text: string; buttons: Array<{ label: string; data?: string; url?: string }> }

/** 会話ログ1件 */
export interface LineChatMessage {
  at: string
  from: 'user' | 'bot' | 'staff'
  text: string
}

/** LINE顧客（指示書6章） */
export interface LineContact {
  userId: string
  displayName: string
  followedAt: string
  lastActiveAt: string
  intent?: IntentKey
  bodyPart?: string
  timing?: string
  step: ScenarioStep
  tags: string[]
  handoff: boolean // 人対応中（自動応答停止）
  needsAttention?: string // 要対応の理由（管理画面に通知）
  reserved: boolean
  optedOut: boolean // 配信停止
  memo: string
  campaign: string
  messages: LineChatMessage[]
  /**
   * 問い合わせの対応状況（集客 → 問い合わせ）。スタッフが変えたときだけ入る。
   * 入っていないときは、ほかの印（予約済み・要対応など）から決める（inquiry.ts の inquiryStatusOf）
   */
  inquiryStatus?: InquiryStatus
  inquiryUpdatedAt?: string
  /** 公式LINE をブロックされた日時（友だち追加し直すと消える） */
  blockedAt?: string
}

/** 問い合わせの対応状況（指示書6章の4つ） */
export type InquiryStatus = 'new' | 'in_progress' | 'reserved' | 'done'

export const INQUIRY_STATUS_LABELS: Record<InquiryStatus, string> = {
  new: '未対応',
  in_progress: '対応中',
  reserved: '予約済み',
  done: '完了',
}

export const CONTACT_TAGS = [
  '初めての方',
  '急性外傷',
  'スポーツ',
  '術後リハ',
  '慢性痛',
  '学生',
  '予約検討中',
  '予約済み',
  '来院済み',
  '要スタッフ対応',
  '配信停止',
] as const
