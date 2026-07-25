// ──────────────────────────────────────────────
// 疾患・症例説明ページ（専門職向け臨床リファレンス）の型定義
// 方針:
//  - 事実・仮説・推奨・不明を区別できる構造（確実性ラベル＋確認状態）
//  - AI生成/未確認の内容を「確認済み」と区別する
//  - 表示レベル（基本/専門/研究）で情報の深さを切替可能
// ──────────────────────────────────────────────

export type DiseaseCategory =
  | 'hip' | 'knee' | 'ankle_foot' | 'shoulder' | 'elbow_hand' | 'spine'

export const DISEASE_CATEGORY_LABELS: Record<DiseaseCategory, string> = {
  hip: '股関節',
  knee: '膝関節',
  ankle_foot: '足関節・足部',
  shoulder: '肩関節',
  elbow_hand: '肘・前腕・手関節',
  spine: '脊椎',
}

/** エビデンスの確実性 */
export type EvidenceCertainty =
  | 'high' | 'moderate' | 'low' | 'very_low'
  | 'expert' | 'insufficient' | 'divided'

export const CERTAINTY_LABELS: Record<EvidenceCertainty, string> = {
  high: '高い確実性',
  moderate: '中等度の確実性',
  low: '低い確実性',
  very_low: '非常に低い確実性',
  expert: '専門家意見',
  insufficient: '根拠不十分',
  divided: '見解が一致していない',
}

/** 記載内容の確認状態（品質管理） */
export type ReviewStatus =
  | 'verified'          // 確認済み
  | 'needs_literature'  // 文献確認が必要
  | 'needs_pro_review'  // 専門職監修が必要
  | 'needs_md_review'   // 医師監修が必要
  | 'needs_update'      // 更新が必要
  | 'insufficient'      // 根拠不十分

export const REVIEW_STATUS_LABELS: Record<ReviewStatus, string> = {
  verified: '確認済み',
  needs_literature: '文献確認が必要',
  needs_pro_review: '専門職監修が必要',
  needs_md_review: '医師監修が必要',
  needs_update: '更新が必要',
  insufficient: '根拠不十分',
}

/** 表示レベル */
export type DisplayLevel = 'basic' | 'pro' | 'research'

/** 緊急度 */
export type Urgency = 'emergency' | 'same_day' | 'early_visit' | 'observe' | 'confirm_md'

export const URGENCY_LABELS: Record<Urgency, string> = {
  emergency: '緊急',
  same_day: '当日中の医療相談',
  early_visit: '早期の医療機関受診',
  observe: '経過観察可能',
  confirm_md: '担当医への確認が必要',
}

/** 本文ブロック: 1つの記載単位（文または短い段落） */
export interface ContentBlock {
  text: string
  /** 表示レベル（未指定は basic） */
  level?: DisplayLevel
  certainty?: EvidenceCertainty
  status?: ReviewStatus
  /** references 配列のインデックス参照 */
  refs?: number[]
}

export interface SpecialTestInfo {
  name: string
  target: string          // 対象組織・病態
  method: string          // 実施方法
  positive: string        // 陽性所見
  /** 感度・特異度等（範囲表記可）。集団・基準により変動する旨は共通注意で表示 */
  sensitivity?: string
  specificity?: string
  likelihoodRatio?: string
  caution?: string
  status?: ReviewStatus
  refs?: number[]
}

export type DifferentialGroup = 'likely' | 'must_not_miss' | 'similar'

export interface DifferentialDx {
  group: DifferentialGroup
  name: string
  /** 鑑別のポイント（疼痛部位・機序・特徴所見など） */
  distinguishing: string
  urgency?: Urgency
}

export interface RedFlagItem {
  finding: string
  action: string
  urgency: Urgency
}

export interface RehabPhaseInfo {
  name: string
  period: string          // 目安期間（時間だけで進行しない旨は共通注意）
  goals: string[]
  allowed: string[]       // 実施可能な運動・許可される動作
  avoid: string[]         // 避けるべき負荷
  criteria: string[]      // 次段階への移行基準（機能基準）
  mdCheck?: string        // 医師への確認事項
}

export interface OutcomeMeasure {
  name: string
  target: string          // 評価対象
  range: string           // スコア範囲と意味
  note?: string           // MCID・日本語版・ライセンス注意等
}

export interface MotionEval {
  movement: string
  purpose: string
  setup: string           // 撮影方向・距離・注意
  watchFor: string[]      // 評価項目・代償動作
}

export interface Reference {
  authors: string
  title: string
  source: string          // 雑誌名・発行団体
  year: number
  doi?: string
  pmid?: string
  note?: string           // エビデンスレベル・限界など
  /** 原文確認の状態。false の場合は「未確認」表示 */
  verified: boolean
}

export interface DiseasePage {
  id: string              // slug (例: 'acl-injury')
  category: DiseaseCategory
  names: {
    ja: string
    en: string
    abbreviations: string[]
    synonyms: string[]
    note?: string
  }
  /** 検索用キーワード（症状・部位・競技など） */
  keywords: string[]

  overview: ContentBlock[]
  anatomy: ContentBlock[]
  epidemiology: ContentBlock[]
  mechanism: ContentBlock[]
  symptoms: ContentBlock[]
  interviewItems: string[]
  physicalExam: ContentBlock[]
  specialTests: SpecialTestInfo[]
  differentials: DifferentialDx[]
  redFlags: RedFlagItem[]
  imaging: ContentBlock[]
  classification: ContentBlock[]
  conservative: ContentBlock[]
  surgical: ContentBlock[]
  rehabPhases: RehabPhaseInfo[]
  returnCriteria: ContentBlock[]
  prognosis: ContentBlock[]
  outcomes: OutcomeMeasure[]

  /** 患者説明モード用（専門職向けの短縮ではなく言い換え） */
  patientExplanation: {
    whatIs: string
    dos: string[]
    donts: string[]
    seekCare: string[]
    goal: string
  }

  motionCapture: MotionEval[]
  references: Reference[]

  /** 既存プロトコルテンプレートとの連携キー（下書き作成用） */
  protocolTemplateKey?: string
  /** プロトコル下書き用の関節 */
  protocolJoint?: string

  meta: {
    createdAt: string
    updatedAt: string
    nextReviewDue: string
    author: string
    supervisor?: string      // 医療監修者（未設定=未監修）
    guidelineVersions: string[]
    searchDate?: string      // 文献検索日
    changeLog: string[]
  }
}

/** カテゴリ別の収載予定疾患（未作成のものは「準備中」として表示） */
export interface PlannedDisease {
  name: string
  synonyms?: string[]
}
