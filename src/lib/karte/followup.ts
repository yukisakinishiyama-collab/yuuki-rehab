/**
 * 経過（2回目以降）のカルテの助け（純粋な関数。画面は SOAPForm / ComplaintTimeline）
 *
 * - carryForward: 前回のカルテから、部位（経過中のものだけ・同じ id）・痛みの場所・施術部位・フェーズ・自宅運動・
 *   禁忌・次の目標を引き継ぐ。院長は変わったところだけ直して保存する
 * - complaintEpisodes: 部位ごとの「いつ始まり、いつ終わったか」を SOAP の履歴から組み立てる（部位の移り変わり）
 * - coverSuggestion: 主な部位・傷病名が変わっていたら、カルテの表紙（Patient）を合わせる提案を返す
 */
import type { AnatomyMarks } from '@/lib/anatomy/types'
import type { ComplaintEntry, Patient, SOAPNote, BodyRegion, Side } from '@/types/patient'
import { BODY_REGION_LABELS } from '@/types/patient'

export const SIDE_LABELS: Record<Side, string> = { right: '右', left: '左', bilateral: '両側', na: '' }

export function isActiveComplaint(c: ComplaintEntry): boolean {
  return c.status !== 'resolved'
}

export interface CarriedForward {
  from: SOAPNote
  complaints: ComplaintEntry[]
  painLocations: string[]
  jointDetailLocations: Record<string, string[]>
  anatomyMarks: Record<string, AnatomyMarks>
  bodyMarks: NonNullable<SOAPNote['bodyMarks']>
  treatmentAreas: string[]
  currentPhase: SOAPNote['currentPhase']
  homeExercise: string
  forbiddenMovements: string
  recommendedFrequency: string
  /** 前回の「次の目標」→ 今日の目標の初期値 */
  patientGoalToday: string
  nextGoal: string
  treatmentToday: string
  /** 部位ごとの前回の NRS（画面で「前回 6 → 今日」と出す） */
  previousNrs: Record<string, number>
}

/** 前回のカルテ（日付が最新のもの）。無ければ null */
export function latestNote(notes: SOAPNote[]): SOAPNote | null {
  return [...notes].sort((a, b) => b.visitDate.localeCompare(a.visitDate) || b.createdAt.localeCompare(a.createdAt))[0] ?? null
}

export function carryForward(last: SOAPNote): CarriedForward {
  const active = (last.complaints ?? []).filter(isActiveComplaint)
  const previousNrs: Record<string, number> = {}
  for (const c of active) previousNrs[c.id] = c.nrs
  return {
    from: last,
    // 同じ id のまま持ち越す（部位の移り変わりを id でつなぐため）。開始日は最初の記録のまま
    complaints: active.map(c => ({ ...c, status: 'active', startedAt: c.startedAt ?? last.visitDate, resolvedAt: undefined })),
    painLocations: [...(last.painLocations ?? [])],
    jointDetailLocations: Object.fromEntries(Object.entries(last.jointDetailLocations ?? {}).map(([k, v]) => [k, [...v]])),
    anatomyMarks: JSON.parse(JSON.stringify(last.anatomyMarks ?? {})) as Record<string, AnatomyMarks>,
    bodyMarks: JSON.parse(JSON.stringify(last.bodyMarks ?? {})) as NonNullable<SOAPNote['bodyMarks']>,
    treatmentAreas: [...(last.treatmentAreas ?? [])],
    currentPhase: last.currentPhase,
    homeExercise: last.homeExercise ?? '',
    forbiddenMovements: last.forbiddenMovements ?? '',
    recommendedFrequency: last.recommendedFrequency ?? '',
    patientGoalToday: last.nextGoal ?? '',
    nextGoal: last.nextGoal ?? '',
    treatmentToday: last.treatmentToday ?? '',
    previousNrs,
  }
}

export interface ComplaintEpisode {
  id: string
  bodyRegion: BodyRegion
  side: Side
  diagnosisLabel: string
  label: string
  startedAt: string
  /** 終了した日（経過中なら undefined） */
  endedAt?: string
  /** 'resolved' = 軽快・終了と記録した / 'dropped' = 記録から外れた（終了の記録なし） / 'active' = 経過中 */
  state: 'active' | 'resolved' | 'dropped'
  firstNrs: number
  lastNrs: number
  visits: number
}

/** 部位ごとの移り変わり（新しい順）。id が同じものを1つの経過として扱う */
export function complaintEpisodes(notes: SOAPNote[]): ComplaintEpisode[] {
  const ordered = [...notes].sort((a, b) => a.visitDate.localeCompare(b.visitDate) || a.createdAt.localeCompare(b.createdAt))
  const map = new Map<string, ComplaintEpisode>()
  let lastWithComplaints: SOAPNote | null = null
  for (const n of ordered) {
    const list = n.complaints ?? []
    if (list.length > 0) lastWithComplaints = n
    for (const c of list) {
      const existing = map.get(c.id)
      const label = `${SIDE_LABELS[c.side] ? `${SIDE_LABELS[c.side]} ` : ''}${BODY_REGION_LABELS[c.bodyRegion] ?? c.bodyRegion}${c.diagnosisLabel ? `（${c.diagnosisLabel}）` : ''}`
      if (!existing) {
        map.set(c.id, {
          id: c.id, bodyRegion: c.bodyRegion, side: c.side, diagnosisLabel: c.diagnosisLabel, label,
          startedAt: c.startedAt ?? n.visitDate, state: 'active', firstNrs: c.nrs, lastNrs: c.nrs, visits: 1,
        })
      } else {
        existing.lastNrs = c.nrs
        existing.visits += 1
        existing.label = label
        existing.diagnosisLabel = c.diagnosisLabel
        existing.state = 'active'
        existing.endedAt = undefined
      }
      const ep = map.get(c.id)!
      if (c.status === 'resolved') {
        ep.state = 'resolved'
        ep.endedAt = c.resolvedAt ?? n.visitDate
      }
    }
  }
  // 最新の（部位のある）カルテに出てこない経過中のものは「記録から外れた」
  if (lastWithComplaints) {
    const present = new Set((lastWithComplaints.complaints ?? []).map(c => c.id))
    for (const ep of map.values()) {
      if (ep.state === 'active' && !present.has(ep.id)) {
        ep.state = 'dropped'
        // 最後に出てきた日
        const lastSeen = [...ordered].reverse().find(n => (n.complaints ?? []).some(c => c.id === ep.id))
        ep.endedAt = lastSeen?.visitDate
      }
    }
  }
  return [...map.values()].sort((a, b) => {
    const rank = (e: ComplaintEpisode) => (e.state === 'active' ? 0 : 1)
    return rank(a) - rank(b) || b.startedAt.localeCompare(a.startedAt)
  })
}

export interface CoverSuggestion {
  bodyRegion: BodyRegion
  diagnosisLabel: string
  reason: string
}

/** 主な部位（経過中の最初の部位）がカルテの表紙と違うときの提案。同じなら null */
export function coverSuggestion(patient: Pick<Patient, 'bodyRegion' | 'diagnosisLabel'>, complaints: ComplaintEntry[]): CoverSuggestion | null {
  const primary = complaints.find(isActiveComplaint)
  if (!primary) return null
  const regionChanged = primary.bodyRegion !== patient.bodyRegion
  const diagnosis = primary.diagnosisLabel.trim()
  const diagnosisChanged = diagnosis !== '' && diagnosis !== (patient.diagnosisLabel ?? '').trim()
  if (!regionChanged && !diagnosisChanged) return null
  const parts: string[] = []
  if (regionChanged) parts.push(`部位: ${BODY_REGION_LABELS[patient.bodyRegion] ?? patient.bodyRegion} → ${BODY_REGION_LABELS[primary.bodyRegion]}`)
  if (diagnosisChanged) parts.push(`傷病名: ${patient.diagnosisLabel || '（なし）'} → ${diagnosis}`)
  return { bodyRegion: primary.bodyRegion, diagnosisLabel: diagnosis || patient.diagnosisLabel, reason: parts.join('、') }
}

export const TREND_LABELS = { better: '改善', same: '不変', worse: '悪化' } as const
