/**
 * 自動化設定（集客 → 自動化設定）の型と既定値。画面とサーバーの両方から読む
 *
 * ここで ON/OFF するのは、このアプリの中で実際に止められるものだけ（止めても動いて見える、を作らない）。
 * - reservation_confirm … 予約確認の LINE（LINE予約の方の本人の LINE へ。予約システムからの通知で送る）
 * - line_auto_reply     … 公式LINE の自動案内（友だち追加のときの選択肢・相談の案内）
 *
 * mode
 * - on   … 動かす
 * - test … テスト。患者さんには送らない（予約確認は院長の LINE にだけ見本が届く。LINE案内は院長の LINE にだけ返す）
 * - off  … 止める
 * 今まで動いていたものは、既定を on（今までどおり）にしてある。新しく足すものは test から始める。
 */

export type AutomationKey = 'reservation_confirm' | 'line_auto_reply'
export type AutomationMode = 'on' | 'test' | 'off'

/** LINE の友だち追加のときの案内の形 */
export type LineMenuVariant = 'classic' | 'three'

export interface AutomationRule {
  mode: AutomationMode
  /** 1日に送る上限（予約確認だけ。日本時間の0時で数え直す） */
  dailyLimit?: number
  /** LINE案内の選択肢の形（classic=従来の7つ／three=指示書の3つ） */
  lineMenu?: LineMenuVariant
  updatedAt?: string
  updatedBy?: string
}

export type AutomationRules = Record<AutomationKey, AutomationRule>

export const DEFAULT_AUTOMATION_RULES: AutomationRules = {
  reservation_confirm: { mode: 'on', dailyLimit: 60 },
  line_auto_reply: { mode: 'on', lineMenu: 'classic' },
}

export const MODE_LABELS: Record<AutomationMode, string> = {
  on: '動かす',
  test: 'テスト',
  off: '止める',
}

export const LINE_MENU_LABELS: Record<LineMenuVariant, string> = {
  classic: '従来の7つの選択肢',
  three: '3つの選択肢（急なケガ・リハビリの予約・料金と通院方法）',
}

/** 動いた記録の結果 */
export type RunResult = 'sent' | 'test' | 'skipped' | 'limited' | 'error'

export const RUN_RESULT_LABELS: Record<RunResult, string> = {
  sent: '送った',
  test: 'テスト（患者さんには送らない）',
  skipped: '止めているので送らない',
  limited: '1日の上限で止めた',
  error: '失敗',
}

/** 動いた記録1件（お名前・LINEのIDなど個人を特定できるものは入れない） */
export interface AutomationRun {
  at: string
  automation: AutomationKey | 'autopilot' | 'cancel_story' | 'birthday'
  result: RunResult
  /** 何のときに動いたか（「予約の確定」「友だち追加」など） */
  note: string
}

/** 監査ログ1件（だれが・いつ・何を変えたか。値に個人の情報は入れない） */
export interface AuditEntry {
  at: string
  role: string
  action: string
  target: string
  detail?: string
}
