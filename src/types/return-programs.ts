// ──────────────────────────────────────────────
// 復帰プログラムの進み具合（患者さんごと。pt_return_programs）
// プログラムそのもの（段階・文献）は src/data/return-programs.ts。ここは「だれが・どのプログラムの・どの段階か」と履歴だけ
// ──────────────────────────────────────────────
import type { Side } from '@/types/patient'

export type ReturnProgramStatus = 'active' | 'finished' | 'stopped'

export type ReturnProgramEventKind = 'start' | 'advance' | 'back' | 'finish' | 'stop' | 'resume'

export interface ReturnProgramEvent {
  id: string
  kind: ReturnProgramEventKind
  /** 記録した時刻（ISO） */
  at: string
  /** その日（YYYY-MM-DD。日本時間） */
  date: string
  /** 動く前の段階・動いたあとの段階（段階の id） */
  from?: string
  to?: string
  /** ひとこと（戻した理由・中止の理由など） */
  note?: string
}

export interface ReturnProgramRecord {
  id: string
  patientId: string
  /** src/data/return-programs.ts のプログラムの id */
  programId: string
  side?: Side
  status: ReturnProgramStatus
  /** いまの段階（段階の id） */
  stageId: string
  /** 始めた日・いまの段階になった日（YYYY-MM-DD） */
  startedOn: string
  stageSince: string
  events: ReturnProgramEvent[]
  createdAt: string
  updatedAt: string
}
