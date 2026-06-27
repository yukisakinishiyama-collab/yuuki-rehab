// ─────────────────────────────────────────────────────────────────
// 復帰基準テスト型定義
//   Lysholm Knee Score / ACL-RSI / 4-Hop Tests (LSI) / LEFS
// ─────────────────────────────────────────────────────────────────

export type AssessmentType = 'sport' | 'daily'
export type Verdict = 'cleared' | 'conditional' | 'not_ready'

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

// ── 統合アセスメント ─────────────────────────────────────────────
export interface ReturnCriteriaAssessment {
  id: string
  patientId: string
  assessmentDate: string
  type: AssessmentType

  lysholm: LysholmData
  aclRsi: AclRsiItems
  hopTests: HopTestsData
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
