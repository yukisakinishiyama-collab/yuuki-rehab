// ──────────────────────────────────────────────
// 復帰プログラムの進み具合の保存（端末の localStorage の pt_return_programs。ほかのカルテと同じようにクラウドと同期する）
// 新しいキーを足しただけで、今までのカルテの記録は変えない
// ──────────────────────────────────────────────
import type { ReturnProgramRecord } from '@/types/return-programs'
import { notifyCloudSync } from '@/lib/store-sync'
import { RETURN_PROGRAMS_KEY, activeSoapPhrases, sortRecords } from './progress'

export function getAllReturnPrograms(): ReturnProgramRecord[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(RETURN_PROGRAMS_KEY)
    const v = raw ? JSON.parse(raw) : []
    return Array.isArray(v)
      ? (v as ReturnProgramRecord[]).filter((r) => r && typeof r.id === 'string' && r.id && typeof r.patientId === 'string' && Array.isArray(r.events))
      : []
  } catch {
    return []
  }
}

export function getReturnPrograms(patientId: string): ReturnProgramRecord[] {
  return sortRecords(getAllReturnPrograms().filter((r) => r.patientId === patientId))
}

export function saveReturnProgram(rec: ReturnProgramRecord): void {
  const list = getAllReturnPrograms().filter((r) => r.id !== rec.id)
  list.push(rec)
  localStorage.setItem(RETURN_PROGRAMS_KEY, JSON.stringify(list))
  notifyCloudSync()
}

/** SOAP の「文を選ぶ」に出す、進行中のプログラムの文 */
export function returnProgramPhrases(patientId: string): string[] {
  return activeSoapPhrases(getAllReturnPrograms(), patientId)
}
