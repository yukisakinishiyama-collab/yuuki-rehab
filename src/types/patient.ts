// ──────────────────────────────────────────────
// リハビリ患者管理システム - 型定義
// ──────────────────────────────────────────────

export type Gender = 'male' | 'female' | 'other'
export type PatientStatus = 'active' | 'inactive' | 'discharged' | 'referral'
export type RehabPhase = 1 | 2 | 3 | 4 | 5 | 6
export type RiskLevel = 'low' | 'medium' | 'high'
export type BodyRegion =
  | 'hip' | 'knee' | 'ankle' | 'shoulder' | 'elbow' | 'wrist'
  | 'cervical' | 'lumbar' | 'thoracic' | 'other' | 'functional'
export type Side = 'right' | 'left' | 'bilateral' | 'na'
export type MMTGrade = 0 | 1 | 2 | 3 | '4-' | 4 | '4+' | '5-' | 5
export type StrengthUnit = 'kg' | 'N' | 'Nm' | 'bw_ratio' | 'contra_ratio'
export type SpecialTestResult = 'positive' | 'negative' | 'suspicious' | 'unable'
export type EndFeel = 'bony' | 'soft' | 'firm' | 'springy' | 'empty' | 'spasm'
export type SOAPVisitStatus = 'completed' | 'cancelled' | 'no_show'

// SOAPカルテ内のスペシャルテスト記録
export interface SOAPSpecialTest {
  joint: string
  testName: string
  result: SpecialTestResult
}

// ──────────────────────────────────────────────
// 複数疾患・部位ごとの愁訴エントリ
// ──────────────────────────────────────────────
export const COMPLAINT_SYMPTOMS = [
  '腫脹', '熱感', 'しびれ', '脱力', '夜間痛', '安静時痛', '動作時痛', '可動域制限',
] as const
export type ComplaintSymptom = typeof COMPLAINT_SYMPTOMS[number]

export interface ComplaintEntry {
  id: string
  bodyRegion: BodyRegion
  side: Side
  diagnosisLabel: string
  nrs: number
  symptoms: ComplaintSymptom[]
}

// ──────────────────────────────────────────────
// 患者
// ──────────────────────────────────────────────
export interface Patient {
  id: string
  name: string
  kana: string
  birthDate: string
  gender: Gender
  phone: string
  emergencyContact: string
  mainComplaint: string
  bodyRegion: BodyRegion
  diagnosisLabel: string
  onsetDate: string
  firstVisitDate: string
  status: PatientStatus
  therapistNotes: string
  createdAt: string
  updatedAt: string
}

// ──────────────────────────────────────────────
// 初回評価
// ──────────────────────────────────────────────
export interface RedFlag {
  cauda_equina: boolean
  fracture_risk: boolean
  cancer: boolean
  infection: boolean
  vascular: boolean
  severe_neuro: boolean
  other: string
}

export type PainDuration = 'acute' | 'subacute' | 'chronic'

export const PAIN_DURATION_LABELS: Record<PainDuration, string> = {
  acute: '急性（4週以内）',
  subacute: '亜急性（1〜3ヶ月）',
  chronic: '慢性（3ヶ月以上）',
}

export interface Evaluation {
  id: string
  patientId: string
  evaluationDate: string
  // 痛み部位（人体図）
  painLocations?: string[]
  // 関節別詳細部位
  jointDetailLocations?: Record<string, string[]>
  // 痛みの経過
  painDuration?: PainDuration
  // 痛み
  painNrs: number
  restPain: boolean
  nightPain: boolean
  weightBearingPain: boolean
  movementPain: boolean
  // 慢性痛スクリーニング
  spreadingPain?: boolean
  centralSensitization?: boolean
  sleepDisturbance?: boolean
  fatigueNrs?: number
  catastrophizing?: boolean
  kinesophobia?: boolean
  // 症状
  swelling: boolean
  heat: boolean
  numbness: boolean
  weakness: boolean
  // 詳細
  injuryMechanism: string
  functionalLimitations: string
  adlDifficulties: string
  sportType: string
  returnToSportDate: string
  physicianConsult: boolean
  imaging: boolean
  contraindications: string
  // レッドフラッグ
  redFlags: RedFlag
  // メモ
  therapistNotes: string
  createdAt: string
}

// ──────────────────────────────────────────────
// ROM記録
// ──────────────────────────────────────────────
export interface ROMRecord {
  id: string
  patientId: string
  evaluationId?: string
  measuredDate: string
  bodyRegion: BodyRegion
  joint: string
  movement: string
  side: Side
  activeRom: number | null
  passiveRom: number | null
  normalValue: number
  unit: 'deg' | 'cm'
  pain: boolean
  painLocation: string
  endFeel: EndFeel | ''
  limitationFactor: string
  memo: string
  createdAt: string
}

// ──────────────────────────────────────────────
// 筋力記録
// ──────────────────────────────────────────────
export interface StrengthRecord {
  id: string
  patientId: string
  evaluationId?: string
  measuredDate: string
  bodyRegion: BodyRegion
  muscleGroup: string
  movement: string
  side: Side
  mmt: MMTGrade | null
  hhdValue: number | null
  unit: StrengthUnit
  bodyWeightRatio: number | null
  contralateralRatio: number | null
  pain: boolean
  compensation: string
  testPosition: string
  memo: string
  createdAt: string
}

// ──────────────────────────────────────────────
// スペシャルテスト記録
// ──────────────────────────────────────────────
export interface SpecialTestRecord {
  id: string
  patientId: string
  evaluationId?: string
  measuredDate: string
  bodyRegion: BodyRegion
  testName: string
  rightResult: SpecialTestResult
  leftResult: SpecialTestResult
  result: SpecialTestResult
  painLocation: string
  apprehension: boolean
  clickSound: boolean
  limitation: boolean
  memo: string
  patientFriendlyExplanation: string
  createdAt: string
}

// ──────────────────────────────────────────────
// SOAPカルテ
// ──────────────────────────────────────────────
export interface SOAPNote {
  id: string
  patientId: string
  visitDate: string
  visitNumber: number
  // S: Subjective
  complaints?: ComplaintEntry[]           // 部位別NRS・症状（複数対応）
  painLocations?: string[]   // この日の痛み部位（人体図）
  jointDetailLocations?: Record<string, string[]>  // 関節別詳細部位
  painToday: number
  changeFromLast: string
  adlDifficulty: string
  homeExerciseAdherence: 'done' | 'partial' | 'not_done'
  patientConcern: string
  patientGoalToday: string
  // O: Objective
  treatmentAreas?: string[]  // 施術部位（人体図）
  soapSpecialTests?: SOAPSpecialTest[]  // 関節別スペシャルテスト
  romFindings: string
  strengthFindings: string
  specialTestFindings: string
  tenderness: string
  swelling: boolean
  heat: boolean
  gait: string
  singleLegStance: string
  squat: string
  therapistObservation: string
  // A: Assessment
  improvements: string
  remainingIssues: string
  priorityIssue: string
  currentPhase: RehabPhase
  visitFrequencyAppropriate: boolean
  exerciseLoadAppropriate: boolean
  physicianReferralNeeded: boolean
  // P: Plan
  treatmentToday: string
  nextGoal: string
  homeExercise: string
  forbiddenMovements: string
  recommendedFrequency: string
  nextReassessment: string
  createdAt: string
}

// ──────────────────────────────────────────────
// リハビリプラン
// ──────────────────────────────────────────────
export interface RehabPlan {
  id: string
  patientId: string
  phase: RehabPhase
  mainProblem: string
  shortTermGoal: string
  midTermGoal: string
  longTermGoal: string
  recommendedFrequency: string
  precautions: string
  createdAt: string
  updatedAt: string
}

// ──────────────────────────────────────────────
// 運動メニュー
// ──────────────────────────────────────────────
export type ExerciseDifficulty = 'easy' | 'medium' | 'hard'

export interface Exercise {
  id: string
  name: string
  bodyRegion: BodyRegion
  purpose: string
  phase: RehabPhase[]
  difficulty: ExerciseDifficulty
  contraindications: string
  reps: string
  sets: number
  frequency: string
  patientInstruction: string
  therapistNote: string
  progressionCriteria: string
  regressionCriteria: string
  svgIllustration: string
  createdAt: string
}

export interface PatientExercise {
  id: string
  patientId: string
  exerciseId: string
  assignedDate: string
  status: 'active' | 'paused' | 'completed'
  adherenceRate: number
  painAfterExercise: number | null
  memo: string
}

// ──────────────────────────────────────────────
// 進捗記録
// ──────────────────────────────────────────────
export interface ProgressRecord {
  id: string
  patientId: string
  recordDate: string
  painNrs: number
  functionScore: number
  patientReportedImprovement: number
  homeExerciseAdherence: number
  romImprovementScore: number
  strengthImprovementScore: number
  specialTestScore: number
  improvementScore: number
  phase: RehabPhase
  createdAt: string
}

// ──────────────────────────────────────────────
// 簡易メモ
// ──────────────────────────────────────────────
export interface QuickMemo {
  id: string
  patientId: string
  memoDate: string
  content: string
  createdAt: string
}

// ──────────────────────────────────────────────
// 来院記録
// ──────────────────────────────────────────────
export interface AttendanceRecord {
  id: string
  patientId: string
  visitDate: string
  status: 'visited' | 'cancelled' | 'no_show'
  cancelReason: string
  nextAppointmentDate: string
}

// ──────────────────────────────────────────────
// 離脱リスク
// ──────────────────────────────────────────────
export interface RetentionRisk {
  id: string
  patientId: string
  riskLevel: RiskLevel
  riskReasons: string[]
  recommendedAction: string
  createdAt: string
}

// ──────────────────────────────────────────────
// アルゴリズム結果型
// ──────────────────────────────────────────────
export interface ImprovementScoreResult {
  total: number
  painScore: number
  romScore: number
  strengthScore: number
  specialTestScore: number
  functionalScore: number
  adherenceScore: number
  label: string
}

export interface RehabRecommendation {
  phase: RehabPhase
  priorityIssues: string[]
  recommendedExercises: string[]
  purpose: string[]
  reps: string
  frequency: string
  precautions: string[]
  stopCriteria: string[]
  nextROMAssessment: string[]
  nextStrengthAssessment: string[]
  nextSpecialTests: string[]
  therapistNote: string
  confidence: 'high' | 'medium' | 'low'
}

// フェーズラベル
export const PHASE_LABELS: Record<RehabPhase, string> = {
  1: 'Phase 1：痛みを落ち着かせる',
  2: 'Phase 2：動きを取り戻す',
  3: 'Phase 3：筋力を戻す',
  4: 'Phase 4：日常動作を安定させる',
  5: 'Phase 5：スポーツ・仕事復帰',
  6: 'Phase 6：再発予防・メンテナンス',
}

export const PHASE_SHORT_LABELS: Record<RehabPhase, string> = {
  1: '痛みを落ち着かせる',
  2: '動きを取り戻す',
  3: '筋力を戻す',
  4: '日常動作を安定させる',
  5: 'スポーツ・仕事復帰',
  6: '再発予防',
}

export const BODY_REGION_LABELS: Record<BodyRegion, string> = {
  hip: '股関節',
  knee: '膝関節',
  ankle: '足関節',
  shoulder: '肩関節',
  elbow: '肘関節',
  wrist: '手関節',
  cervical: '頚部',
  lumbar: '腰部',
  thoracic: '胸部',
  other: 'その他',
  functional: '機能評価・復帰テスト',
}

export const RISK_LABELS: Record<RiskLevel, string> = {
  low: '低',
  medium: '中',
  high: '高',
}

// ──────────────────────────────────────────────
// 問診票
// ──────────────────────────────────────────────
export interface Intake {
  id: string
  patientId: string
  intakeDate: string
  isNewInjury: boolean        // 既存患者の新しいけが

  // 主訴・経緯
  chiefComplaint: string
  injuryDate: string
  injuryMechanism: string
  firstTimeSymptoм: boolean
  previousSameInjury: boolean
  previousTreatment: string

  // 痛み（複数部位対応）
  complaints?: ComplaintEntry[]                  // 部位別NRS・症状
  painLocations: string[]                       // 全体人体図
  jointDetailLocations: Record<string, string[]> // 関節別詳細部位
  painNrs: number
  painCharacter: string[]     // 鈍痛・鋭痛・burning・しびれ・重だるい
  painTiming: string[]        // 安静時・動作時・夜間・朝方
  worseFactor: string
  betterFactor: string

  // 生活・活動
  adlDifficulty: string[]     // 歩行・階段・正座・しゃがみ・挙上 etc
  occupation: string
  sportsActivity: string
  importantGoal: string       // 患者が最も取り戻したい動作

  // 既往歴
  pastMedicalHistory: string
  currentMedications: string
  imagingResults: string

  // AI分析結果（API呼び出し後に格納）
  aiSuggestedTests?: string[]
  aiDifferentials?: string[]
  aiProtocol?: string
  aiReasoning?: string

  // 施術者入力
  suspectedDiagnosis: string
  therapistNotes: string

  createdAt: string
}
