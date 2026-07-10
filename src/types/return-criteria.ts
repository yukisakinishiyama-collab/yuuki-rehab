// ─────────────────────────────────────────────────────────────────
// 復帰基準テスト型定義
//   Lysholm Knee Score / ACL-RSI / 4-Hop Tests (LSI) / LEFS
// ─────────────────────────────────────────────────────────────────

export type AssessmentType = 'sport' | 'daily'
export type Verdict = 'cleared' | 'conditional' | 'not_ready'
// 対象部位。既存データ（region未設定）は膝として扱う
export type AssessmentRegion = 'knee' | 'hip'

// ── Lysholm Knee Score (Lysholm 1982; Tegner & Lysholm 1985) ──────
// 各項目のスコア値を直接格納（0-100合計）
export interface LysholmData {
  limp: 0 | 3 | 5                          // 跛行
  support: 0 | 3 | 5                       // 補助具
  locking: 0 | 2 | 6 | 10 | 15            // ロッキング
  instability: 0 | 5 | 10 | 15 | 20 | 25  // 不安定性
  pain: 0 | 5 | 10 | 15 | 20 | 25         // 疼痛
  swelling: 0 | 2 | 6 | 10                 // 腫脹
  stairs: 0 | 2 | 6 | 10                   // 階段昇降
  squat: 0 | 2 | 4 | 5                     // しゃがみ
}

export const LYSHOLM_DEFAULT: LysholmData = {
  limp: 5, support: 5, locking: 15, instability: 25,
  pain: 25, swelling: 10, stairs: 10, squat: 5,
}

// ── ACL-RSI (Webster et al. 2008, Br J Sports Med) ───────────────
// 12項目、各 0–10 の NRS
// 陰性項目（0-5, 9-11): 低いほど準備OK → スコア計算時に反転
// 陽性項目（6-8):       高いほど準備OK → そのまま使用
export type AclRsiItems = [
  number, number, number, number,   // q0-q3  (恐怖・心配・緊張・フラスト)
  number, number,                   // q4-q5  (悲しみ・落胆)
  number, number, number,           // q6-q8  (自信×3)
  number, number, number,           // q9-q11 (リスク認識×3)
]

// ── 4-Hop Test Battery (Grindem et al. 2016, BJSM) ───────────────
export interface HopLimb {
  involved: number    // 患肢 (cm or sec)
  uninvolved: number  // 健肢
}

export interface HopTestsData {
  single: HopLimb     // シングルホップ (cm, 大きい方が良い)
  triple: HopLimb     // トリプルホップ (cm)
  crossover: HopLimb  // クロスオーバーホップ (cm)
  timed: HopLimb      // 6m タイムドホップ (sec, 小さい方が良い)
}

// ── LEFS – Lower Extremity Functional Scale (Binkley et al. 1999) ─
// 20項目, 各 0–4 (0=極めて困難/不可, 4=問題なし)
// 合計0-80点 → 100点換算
export type LefsItems = number[] & { length: 20 }

// ── Harris Hip Score (Harris 1969, J Bone Joint Surg Am) ─────────
// 股関節用の症状評価。膝のLysholmに相当する位置づけ（10項目・合計100点）
export interface HipSymptomData {
  pain: 0 | 10 | 20 | 30 | 40 | 44
  limp: 0 | 5 | 8 | 11
  support: 0 | 2 | 3 | 5 | 7 | 11
  distance: 0 | 2 | 5 | 8 | 11
  stairs: 0 | 1 | 2 | 4
  shoes: 0 | 2 | 4
  sitting: 0 | 3 | 5
  transport: 0 | 1
  deformity: 0 | 4
  rom: 0 | 1 | 3 | 4 | 5
}

export const HIP_SYMPTOM_DEFAULT: HipSymptomData = {
  pain: 44, limp: 11, support: 11, distance: 11, stairs: 4,
  shoes: 4, sitting: 5, transport: 1, deformity: 4, rom: 5,
}

// ── 股関節機能テスト（片脚立位・シングルレッグステップダウン・Trendelenburg徴候）
// 膝の4-Hop Test Batteryに相当する位置づけ
export interface HipFunctionData {
  singleLegStance: HopLimb   // 片脚立位保持時間（秒）
  stepDown: HopLimb          // 30秒間のシングルレッグ・ステップダウン回数
  trendelenburg: 'negative' | 'positive'  // Trendelenburg徴候（陽性=殿筋機能低下の指標）
}

export const HIP_FUNCTION_DEFAULT: HipFunctionData = {
  singleLegStance: { involved: 0, uninvolved: 0 },
  stepDown: { involved: 0, uninvolved: 0 },
  trendelenburg: 'negative',
}

// ── 統合アセスメント ─────────────────────────────────────────────
export interface ReturnCriteriaAssessment {
  id: string
  patientId: string
  assessmentDate: string
  type: AssessmentType
  region: AssessmentRegion

  // 膝用（region === 'knee'）
  lysholm?: LysholmData
  hopTests?: HopTestsData

  // 股関節用（region === 'hip'）
  hipSymptom?: HipSymptomData
  hipFunction?: HipFunctionData

  // 部位共通
  aclRsi: AclRsiItems
  lefs: number[]   // 20 items

  // 計算済みスコア (0-100)
  scores: {
    symptom: number       // Lysholm
    psychological: number // ACL-RSI
    functional: number    // Hop LSI 平均
    daily: number         // LEFS
    composite: number     // 重み付き合計
  }

  verdict: Verdict
  notes: string
  createdAt: string
}
