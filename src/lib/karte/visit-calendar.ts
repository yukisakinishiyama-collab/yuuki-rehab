/**
 * 来院カレンダーの元になる「日ごとの出来事」を、カルテの記録から組み立てる（純粋な関数。画面は VisitCalendar.tsx）
 *
 * - 来院: SOAPカルテの日付（visitDate）と、来院記録（AttendanceRecord.status = visited）
 * - キャンセル: キャンセル記録（予約日前／当日／無断。除外した記録は薄く出す）
 * - 予約: 予約システムのフィードから、確実に本人と分かる予約だけ（matchPatient の確度 phone / name_kana）
 * - 評価・問診・写真の日も小さな印で出す
 */
import type { AttendanceRecord, CancellationRecord, Evaluation, Intake, KartePhoto, Patient, SOAPNote } from '@/types/patient'
import { CANCELLATION_SHORT_LABELS } from '@/types/patient'
import { canAutoAssign, matchPatient, toDateKey, type YoyakuFeed } from '@/lib/yoyaku-cancel-sync'
import { isCountedCancellation } from '@/lib/cancellation-utils'

export type VisitEventKind = 'visit' | 'cancel' | 'reservation' | 'evaluation' | 'intake' | 'photo'

export interface VisitEvent {
  kind: VisitEventKind
  date: string
  /** 一覧に出す短い説明（例: 「痛み 3/10・大腿四頭筋セッティング」「当日キャンセル」「10:30 予約」） */
  label: string
  /** キャンセル回数に数えない記録（院側の都合・入力ミス） */
  muted?: boolean
  /** その日の SOAP の id（開くときに使う） */
  soapId?: string
}

export interface VisitDay {
  date: string
  events: VisitEvent[]
  visited: boolean
  cancelled: boolean
  reserved: boolean
}

export interface CalendarSource {
  patient: Patient
  soapNotes: SOAPNote[]
  attendance?: AttendanceRecord[]
  cancellations?: CancellationRecord[]
  evaluations?: Evaluation[]
  intakes?: Intake[]
  photos?: KartePhoto[]
  feed?: YoyakuFeed | null
  /** 今日（yyyy-MM-dd）。予約は今日以降だけ出す */
  today: string
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

function soapLabel(n: SOAPNote): string {
  const parts: string[] = []
  if (Number.isFinite(n.painToday) && n.painToday >= 0) parts.push(`痛み ${n.painToday}/10`)
  if (n.treatmentToday) parts.push(n.treatmentToday.slice(0, 30))
  else if (n.priorityIssue) parts.push(n.priorityIssue.slice(0, 30))
  return parts.length ? `${n.visitNumber}回目 · ${parts.join('・')}` : `${n.visitNumber}回目`
}

/** 予約フィードから、この患者さんの今後の予約だけ取り出す（確実に本人と分かるものだけ） */
export function reservationsForPatient(feed: YoyakuFeed | null | undefined, patient: Patient, today: string): VisitEvent[] {
  if (!feed?.ok || !feed.days) return []
  const out: VisitEvent[] = []
  for (const day of feed.days) {
    const date = toDateKey(day.date)
    if (!DATE_RE.test(date) || date < today) continue
    for (const row of day.rows) {
      if (/キャンセル|取消/.test(row.status)) continue
      const m = matchPatient(row, [patient])
      if (!m.patient || !canAutoAssign(m.confidence)) continue
      out.push({ kind: 'reservation', date, label: `${String(row.time || '').slice(0, 5)} 予約${row.kubun ? `（${row.kubun}）` : ''}` })
    }
  }
  return out
}

export function buildVisitDays(src: CalendarSource): Map<string, VisitDay> {
  const days = new Map<string, VisitDay>()
  const dayOf = (date: string): VisitDay => {
    let d = days.get(date)
    if (!d) {
      d = { date, events: [], visited: false, cancelled: false, reserved: false }
      days.set(date, d)
    }
    return d
  }
  const push = (e: VisitEvent) => {
    if (!DATE_RE.test(e.date)) return
    const d = dayOf(e.date)
    d.events.push(e)
    if (e.kind === 'visit') d.visited = true
    if (e.kind === 'cancel' && !e.muted) d.cancelled = true
    if (e.kind === 'reservation') d.reserved = true
  }

  for (const n of src.soapNotes) push({ kind: 'visit', date: n.visitDate, label: soapLabel(n), soapId: n.id })
  for (const a of src.attendance ?? []) {
    if (a.status !== 'visited') continue
    // SOAP がある日は重ねて出さない
    if (src.soapNotes.some(n => n.visitDate === a.visitDate)) continue
    push({ kind: 'visit', date: a.visitDate, label: '来院' })
  }
  for (const c of src.cancellations ?? []) {
    const muted = !isCountedCancellation(c)
    push({
      kind: 'cancel',
      date: c.appointmentDate,
      label: `${CANCELLATION_SHORT_LABELS[c.kind]}キャンセル${c.appointmentTime ? `（${c.appointmentTime.slice(0, 5)}）` : ''}${muted ? '・数えない' : ''}`,
      muted,
    })
  }
  for (const e of src.evaluations ?? []) push({ kind: 'evaluation', date: e.evaluationDate, label: '評価' })
  for (const i of src.intakes ?? []) push({ kind: 'intake', date: i.intakeDate, label: '問診票' })
  for (const p of src.photos ?? []) push({ kind: 'photo', date: p.takenDate, label: '写真' })
  for (const r of reservationsForPatient(src.feed, src.patient, src.today)) push(r)

  for (const d of days.values()) {
    const order: Record<VisitEventKind, number> = { visit: 0, reservation: 1, cancel: 2, intake: 3, evaluation: 4, photo: 5 }
    d.events.sort((a, b) => order[a.kind] - order[b.kind])
  }
  return days
}

/** 月の表示用: その月の1日の曜日（0=日）と日数 */
export function monthShape(year: number, month1: number): { firstDow: number; daysInMonth: number } {
  const first = new Date(year, month1 - 1, 1)
  return { firstDow: first.getDay(), daysInMonth: new Date(year, month1, 0).getDate() }
}

export function ymd(year: number, month1: number, day: number): string {
  return `${year}-${String(month1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

/** 表示のまとめ（最後の来院・次の予約・通算） */
export function summarize(days: Map<string, VisitDay>, today: string) {
  const visitDates = [...days.values()].filter(d => d.visited).map(d => d.date).sort()
  const lastVisit = [...visitDates].reverse().find(d => d <= today) ?? null
  const nextReservation = [...days.values()].filter(d => d.reserved && d.date >= today).map(d => d.date).sort()[0] ?? null
  const monthKey = today.slice(0, 7)
  const thisMonth = visitDates.filter(d => d.startsWith(monthKey)).length
  const daysSince = lastVisit ? Math.round((Date.parse(today) - Date.parse(lastVisit)) / 86_400_000) : null
  return { total: visitDates.length, thisMonth, lastVisit, nextReservation, daysSince }
}
