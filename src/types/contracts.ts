// ──────────────────────────────────────────────
// 契約書・同意書・会員の状態・アウトカム（カルテの「契約・同意書」「アウトカム」）
// ──────────────────────────────────────────────

export type MemberPlan = '一般会員' | '学生会員' | '兄弟・親子プラン'

/** 兄弟・親子プラン（2名まで）の、もう1名の利用者 */
export interface MemberPartner {
  name: string
  /** 契約者との関係（弟・姉・母 など） */
  relation?: string
  birthDate?: string // YYYY-MM-DD
  /** カルテがある方なら、その方の患者 ID（その方のカルテにも会員の状態が出る） */
  patientId?: string
}

/** 会員プランの書類に署名したときの手続きの内容 */
export interface MemberEvent {
  kind: 'join' | 'pause' | 'cancel'
  /** 入会：プランと利用開始日（最初の決済日） */
  plan?: MemberPlan
  start?: string // YYYY-MM-DD
  /** 兄弟・親子プランのもう1名 */
  partner?: MemberPartner
  /** 休会：開始月と月数 */
  pauseFrom?: string // YYYY-MM
  pauseMonths?: number
  /** 解約：提出日と契約終了日（15日までは当月末、16日以降は翌月末） */
  submitted?: string // YYYY-MM-DD
  end?: string // YYYY-MM-DD
  /** 最低利用期間の途中で、特別な事情により解約する */
  special?: boolean
  specialReason?: string
}

/** 署名済みの書類1件（一覧の情報。署名入りの本文はクラウドの kcdoc:<id> に保存） */
export interface ContractRecord {
  id: string
  patientId: string
  docId: string
  title: string
  /** 署名したときの文面の版と指紋 */
  version: string
  bodyHash: string
  signedAt: string // ISO
  signedDate: string // YYYY-MM-DD（日本時間）
  patientName: string
  guardianName?: string
  relation?: string
  staffLabel: string
  staffName: string
  /** チェックした数・書き込んだ数（一覧の目安） */
  checked: number
  written: number
  member?: MemberEvent
  /** 取り消し（記録は消さずに残す） */
  voided?: { at: string; reason: string }
}

/** クラウドに保存する署名入りの本文（あとから変えない） */
export interface ContractSnapshot {
  record: ContractRecord
  /** 文面（チェック・記入を入れたもの）と会員の手続き・署名欄まで入れた HTML */
  html: string
  savedAt: string
}

export type MemberState = 'none' | 'upcoming' | 'active' | 'paused' | 'ending' | 'ended'

export interface MemberStatus {
  state: MemberState
  label: string
  plan?: MemberPlan
  start?: string
  /** 最低利用期間（3か月）の満了日。休会した月数だけ後ろにずれる */
  minEnd?: string
  /** 契約終了日（解約届のあと） */
  end?: string
  /** 休会中なら再開予定月（YYYY-MM） */
  resumeMonth?: string
  pausedMonths: number
  /** 兄弟・親子プランのもう1名 */
  partner?: MemberPartner
  /** この方が兄弟・親子プランの「もう1名」のとき、契約者（代表）の方 */
  via?: { patientId: string; name: string }
}

// ── アウトカム（痛み・可動域・機能スコア・筋力 LSI の経過） ───────────

export type OutcomeMetricKey =
  | 'nrs'
  | 'throw_nrs'
  | 'run_nrs'
  | 'rom_knee_flex'
  | 'rom_knee_ext'
  | 'rom_other'
  | 'gird'
  | 'koos'
  | 'lysholm'
  | 'ikdc'
  | 'kjoc'
  | 'hagos_sport'
  | 'hagos_pain'
  | 'visa_a'
  | 'visa_p'
  | 'acl_rsi'
  | 'lsi_quad'
  | 'lsi_ham'
  | 'lsi_hop'
  | 'lsi_hop_triple'
  | 'lsi_hop_cross'
  | 'lsi_hop_timed'
  | 'lsi_hip_add'
  | 'lsi_hip_abd'
  | 'lsi_calf'
  | 'add_squeeze'
  | 'ybal_ant'
  | 'run_minutes'
  | 'throw_distance'

/** 競技ごとの評価セット（患者さんごとに1つ選ぶ） */
export type SportKey = 'none' | 'baseball' | 'soccer' | 'running' | 'jump' | 'acl'

/** 患者さんごとのアウトカムの設定（pt_outcome_settings。id は患者さんの ID） */
export interface OutcomeSetting {
  id: string
  sport: SportKey
  updatedAt: string
}

export interface OutcomeRecord {
  id: string
  patientId: string
  date: string // YYYY-MM-DD
  metric: OutcomeMetricKey
  /** グラフに出す値（左右を入れた指標は、LSI・左右差などの計算した値） */
  value: number
  /** 左右を入れた指標：患側（投球側）と健側（非投球側）の値 */
  involved?: number
  uninvolved?: number
  /** 肩の回旋（内旋・外旋を左右で4つ）の元の値と、計算した TRM 差（trm） */
  detail?: Record<string, number>
  /** 部位・左右（例「右膝」「左」） */
  side?: string
  note?: string
  createdAt: string
}
