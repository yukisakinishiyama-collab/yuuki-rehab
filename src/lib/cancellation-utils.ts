// ──────────────────────────────────────────────
// キャンセル記録の集計ユーティリティ（純関数）
// ──────────────────────────────────────────────
import type { CancellationKind, CancellationRecord, CancellationSummary } from '@/types/patient'

/** ローカル日付を yyyy-MM-dd で返す（UTCずれを避けるため toISOString は使わない） */
export function todayString(): string {
  const d = new Date()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

/** 2つの yyyy-MM-dd の日数差（a - b）。不正な形式は 0 を返す */
function diffDays(a: string, b: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(a) || !/^\d{4}-\d{2}-\d{2}$/.test(b)) return 0
  const [ay, am, ad] = a.split('-').map(Number)
  const [by, bm, bd] = b.split('-').map(Number)
  const ms = Date.UTC(ay, am - 1, ad) - Date.UTC(by, bm - 1, bd)
  return Math.round(ms / 86400000)
}

/**
 * 予約日と連絡日から区分を推定する（入力の初期値用）。
 * 連絡日が空＝連絡なし → 無断。予約日と同日 → 当日。それ以外 → 予約日前。
 */
export function inferCancellationKind(appointmentDate: string, contactedDate: string): CancellationKind {
  if (!contactedDate) return 'no_show'
  const d = diffDays(contactedDate, appointmentDate)
  return d >= 0 ? 'same_day' : 'advance'
}

/** 患者1人分のキャンセル記録を集計する */
export function summarizeCancellations(
  records: CancellationRecord[],
  today: string = todayString(),
): CancellationSummary {
  const summary: CancellationSummary = {
    total: records.length,
    advance: 0,
    same_day: 0,
    no_show: 0,
    recent90: 0,
    lastDate: '',
  }
  for (const r of records) {
    summary[r.kind] += 1
    if (diffDays(today, r.appointmentDate) <= 90) summary.recent90 += 1
    if (r.appointmentDate > summary.lastDate) summary.lastDate = r.appointmentDate
  }
  return summary
}

/**
 * キャンセル率（キャンセル ÷（来院 + キャンセル））。
 * 離脱リスク算出と同じ考え方で、来院実績が無いときは 0 とする。
 */
export function cancellationRate(cancelCount: number, visitCount: number): number {
  const denom = cancelCount + visitCount
  return denom > 0 ? cancelCount / denom : 0
}

/** 記録を患者IDごとにまとめる（一覧・ダッシュボードでの一括集計用） */
export function groupByPatient(records: CancellationRecord[]): Map<string, CancellationRecord[]> {
  const map = new Map<string, CancellationRecord[]>()
  for (const r of records) {
    const arr = map.get(r.patientId)
    if (arr) arr.push(r)
    else map.set(r.patientId, [r])
  }
  return map
}
