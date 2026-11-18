// ──────────────────────────────────────────────
// 再評価の予定の保存（端末の localStorage の pt_reeval_plans。ほかのカルテと同じようにクラウドと同期する）
// 1人に1件（id＝患者さんの ID）。新しいキーを足しただけで、今までのカルテの記録は変えない。
// ──────────────────────────────────────────────
import { nanoid } from 'nanoid'
import type { ReevalPlan } from '@/types/reeval'
import { notifyCloudSync } from '@/lib/store-sync'
import { REEVAL_KEY, jstToday, reevalFromSoap } from './schedule'

export function getReevalPlans(): ReevalPlan[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(REEVAL_KEY)
    const v = raw ? JSON.parse(raw) : []
    return Array.isArray(v) ? (v as ReevalPlan[]).filter((p) => p && typeof p.id === 'string' && p.id) : []
  } catch {
    return []
  }
}

export function getReevalPlan(patientId: string): ReevalPlan | null {
  return getReevalPlans().find((p) => p.id === patientId) ?? null
}

export function saveReevalPlan(plan: ReevalPlan): void {
  const list = getReevalPlans().filter((p) => p.id !== plan.id)
  list.push(plan)
  localStorage.setItem(REEVAL_KEY, JSON.stringify(list))
  notifyCloudSync()
}

/** 患者さんごとの予定（一覧の画面で一度だけ読む） */
export function reevalPlansById(): Map<string, ReevalPlan> {
  return new Map(getReevalPlans().map((p) => [p.id, p]))
}

/**
 * SOAP を保存したときに呼ぶ：「再評価予定」に日付があれば、その日を予定日にする。
 * ふつうの施術の記録なので、再評価の完了にはしない。変えたら true
 */
export function applySoapReassessment(patientId: string, note: { nextReassessment?: string; visitDate: string }): boolean {
  const now = new Date()
  const next = reevalFromSoap(getReevalPlan(patientId), {
    patientId,
    nextReassessment: note.nextReassessment,
    visitDate: note.visitDate,
    today: jstToday(now),
    now: now.toISOString(),
    eventId: nanoid(10),
  })
  if (!next) return false
  saveReevalPlan(next)
  return true
}
