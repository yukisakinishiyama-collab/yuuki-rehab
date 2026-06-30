export type Joint = 'knee' | 'shoulder' | 'hip' | 'ankle' | 'elbow' | 'hand' | 'spine' | 'other'

export type EvidenceLevel = 'guideline' | 'consensus' | 'expert_opinion' | 'needs_review'

// EBM エビデンスグレード（Oxford CEBM 準拠）
export type EvidenceGrade = 'Ia' | 'Ib' | 'IIa' | 'IIb' | 'III' | 'IV' | 'V'

export const EVIDENCE_GRADE_LABELS: Record<EvidenceGrade, string> = {
  Ia: 'SR/メタ解析',
  Ib: 'RCT',
  IIa: 'コホートSR',
  IIb: 'コホート研究',
  III: 'ケースコントロール',
  IV: '症例集積・専門家意見',
  V: 'ガイドライン（合意）',
}

export const EVIDENCE_GRADE_COLORS: Record<EvidenceGrade, string> = {
  Ia:  'bg-emerald-100 text-emerald-800 border-emerald-200',
  Ib:  'bg-green-100 text-green-800 border-green-200',
  IIa: 'bg-teal-100 text-teal-800 border-teal-200',
  IIb: 'bg-blue-100 text-blue-800 border-blue-200',
  III: 'bg-indigo-100 text-indigo-800 border-indigo-200',
  IV:  'bg-slate-100 text-slate-700 border-slate-200',
  V:   'bg-purple-100 text-purple-800 border-purple-200',
}

export interface Reference {
  title: string       // 文献・ガイドライン名
  source: string      // ジャーナル名 / 学会・発行元
  year?: string       // 発行年
  evidenceGrade: EvidenceGrade
  note?: string       // 「要確認」等の注記
}

export const JOINT_LABELS: Record<Joint, string> = {
  knee: '膝関節',
  shoulder: '肩関節',
  hip: '股関節',
  ankle: '足関節',
  elbow: '肘関節',
  hand: '手関節',
  spine: '脊椎',
  other: 'その他',
}

export const EVIDENCE_LABELS: Record<EvidenceLevel, string> = {
  guideline: '診療ガイドライン準拠',
  consensus: '一般的合意',
  expert_opinion: '専門家意見',
  needs_review: '要・臨床医確認',
}

export const EVIDENCE_COLORS: Record<EvidenceLevel, string> = {
  guideline: 'bg-green-100 text-green-800',
  consensus: 'bg-blue-100 text-blue-800',
  expert_opinion: 'bg-yellow-100 text-yellow-800',
  needs_review: 'bg-red-100 text-red-800',
}

export interface ProtocolPatient {
  id: string
  name?: string
  age?: number
  diagnosis?: string
  joint?: Joint
  sport?: string
  eventDate?: string // ISO date
  concerns?: string  // 患者の悩み・現在の症状（自由記述）
  notes?: string
  createdAt: string
  updatedAt: string
}

export interface Criterion {
  label: string
  target?: string
  met?: boolean
}

export interface Exercise {
  name: string
  dose?: string
  notes?: string
  videoUrl?: string
}

export interface Phase {
  id: string
  order: number
  title: string
  goals: string[]
  exercises: Exercise[]
  advanceCriteria: Criterion[]
  precautions: string[]
  redFlags: string[]
  outcomes: string[]
  evidence: EvidenceLevel
  durationWeeks?: string
  references?: Reference[]
}

export interface ExpertOpinion {
  role: string
  emoji: string
  focus: string
  recommendations: string[]
  cautions: string[]
}

export interface ProtocolAttachment {
  id: string
  fileName: string
  fileType: string   // 'application/pdf' | 'image/jpeg' etc.
  data: string       // base64 encoded
  fileSize: number   // bytes
  note: string       // 例: '○○病院 術後プロトコル'
  addedAt: string
}

export interface Protocol {
  id: string
  patientId: string
  title: string
  phases: Phase[]
  discussion: ExpertOpinion[]
  consensusNotes: string
  generatedBy: 'ai' | 'template'
  currentPhaseIndex: number
  attachments?: ProtocolAttachment[]
  createdAt: string
  updatedAt: string
}

export interface Assessment {
  id: string
  patientId: string
  protocolId: string
  phaseId?: string
  date: string
  metrics: Record<string, number>
  notes?: string
}

export interface Milestone {
  id: string
  patientId: string
  label: string
  achieved: boolean
  date?: string
  icon?: string
}

export const PRESET_DIAGNOSES: Array<{ label: string; joint: Joint; key: string }> = [
  { label: 'ACL再建後', joint: 'knee', key: 'acl_reconstruction' },
  { label: '半月板縫合後', joint: 'knee', key: 'meniscus_repair' },
  { label: '半月板切除後', joint: 'knee', key: 'meniscus_resection' },
  { label: '人工膝関節（TKA）術後', joint: 'knee', key: 'tka' },
  { label: '膝蓋大腿痛（PFP）', joint: 'knee', key: 'pfp' },
  { label: '腱板修復後', joint: 'shoulder', key: 'rotator_cuff_repair' },
  { label: '反復性肩関節脱臼・関節唇損傷', joint: 'shoulder', key: 'shoulder_instability' },
  { label: '凍結肩（肩関節周囲炎）', joint: 'shoulder', key: 'frozen_shoulder' },
  { label: '足関節外側靱帯捻挫', joint: 'ankle', key: 'ankle_sprain' },
  { label: 'アキレス腱断裂（保存療法）', joint: 'ankle', key: 'achilles_conservative' },
  { label: 'アキレス腱断裂（術後）', joint: 'ankle', key: 'achilles_surgical' },
  { label: 'FAI / 股関節鏡術後', joint: 'hip', key: 'fai_arthroscopy' },
  { label: '人工股関節（THA）術後', joint: 'hip', key: 'tha' },
  { label: '腰椎椎間板ヘルニア（保存療法）', joint: 'spine', key: 'lumbar_disc_conservative' },
]

export const DEFAULT_MILESTONES: Array<Omit<Milestone, 'id' | 'patientId'>> = [
  { label: '初回荷重', achieved: false, icon: '🦶' },
  { label: 'フルウェイトベアリング', achieved: false, icon: '🏋️' },
  { label: '平地歩行自立', achieved: false, icon: '🚶' },
  { label: '階段昇降', achieved: false, icon: '🪜' },
  { label: 'ジョグ開始', achieved: false, icon: '🏃' },
  { label: 'ランニング', achieved: false, icon: '⚡' },
  { label: 'ジャンプ解禁', achieved: false, icon: '🦘' },
  { label: '競技復帰', achieved: false, icon: '🏆' },
]
