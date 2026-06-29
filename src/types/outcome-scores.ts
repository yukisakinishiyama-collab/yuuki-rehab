// ──────────────────────────────────────────────
// アウトカムスコア 型定義
// ──────────────────────────────────────────────

export type ScoreId =
  // 膝関節
  | 'lysholm' | 'ikdc' | 'tegner'
  // 肩関節
  | 'ases' | 'constant'
  // 足関節
  | 'cait' | 'atrs' | 'faam_adl'
  // 股関節
  | 'hhs' | 'hoos_jr'
  // 脊椎
  | 'odi' | 'ndi' | 'joa_l'
  // 腕・肘・手
  | 'dash'

export interface OutcomeScoreRecord {
  id: string
  patientId: string
  scoreId: ScoreId
  scoreDate: string
  answers: Record<string, number>
  totalScore: number
  subscores?: Record<string, number>
  interpretation: string
  interpretationColor: 'green' | 'yellow' | 'orange' | 'red'
  notes: string
  createdAt: string
}
