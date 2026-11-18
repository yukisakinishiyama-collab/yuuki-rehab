// ──────────────────────────────────────────────
// 再評価の予定（患者さんごと。pt_reeval_plans。id は患者さんの ID）
//
// 予定日・前回の正式な再評価日・延期や完了の履歴を持つ。ほかのカルテと同じようにクラウドと同期する。
// 医学的な危険の知らせ（レッドフラッグ・受診のすすめ）とは別に持つ。これは「評価の時期」の目安だけ。
// 2026-11-18 院長の指示書（既存リハビリカルテの品質維持・機能改善）。DECISIONS.md
// ──────────────────────────────────────────────

/** 次回までの間隔のえらび（個別＝日付を直接えらぶ） */
export type ReevalInterval = 7 | 14 | 28 | 'custom'

export type ReevalEventKind = 'set' | 'postpone' | 'complete' | 'stop'

export interface ReevalEvent {
  id: string
  kind: ReevalEventKind
  /** 記録した時刻（ISO） */
  at: string
  /** その出来事の日（日本時間 YYYY-MM-DD）。set・postpone・stop＝記録した日、complete＝再評価をした日 */
  date: string
  /** 変える前の予定日 */
  prevDue?: string | null
  /** 変えたあとの予定日（決めなかったときは null） */
  nextDue?: string | null
  interval?: ReevalInterval
  /** 延期・やめた理由 */
  reason?: string
  /** どこで決めたか（manual＝再評価の欄、soap＝SOAP の「再評価予定」） */
  source?: 'manual' | 'soap'
  /** 完了したときの、前回との比べ（1行ずつの文。あとから見返す用） */
  summary?: string[]
  note?: string
}

export interface ReevalPlan {
  /** 患者さんの ID（1人に1件） */
  id: string
  patientId: string
  /** 次回の間隔（完了したときの、次の予定日の初期値に使う） */
  interval: ReevalInterval | null
  /** 次回評価予定日（YYYY-MM-DD。決めていなければ null） */
  dueDate: string | null
  /** 前回の正式な再評価日（YYYY-MM-DD） */
  lastDate: string | null
  /** false＝再評価の予定をやめた（終了・中止など。マークは出さない） */
  active: boolean
  events: ReevalEvent[]
  updatedAt: string
}

/** マークの状態 */
export type ReevalState = 'none' | 'scheduled' | 'soon' | 'due' | 'overdue'
