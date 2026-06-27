import type {
  ReturnCriteriaAssessment,
  LysholmData,
  AclRsiItems,
  HopTestsData,
  Verdict,
  AssessmentType,
} from '@/types/return-criteria'
import { nanoid } from 'nanoid'

const KEY = 'returnCriteria'

function load(): ReturnCriteriaAssessment[] {
  if (typeof window === 'undefined') return []
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]')
  } catch { return [] }
}

function save(list: ReturnCriteriaAssessment[]) {
  localStorage.setItem(KEY, JSON.stringify(list))
}

// ── スコア計算 ────────────────────────────────────────────────────

export function calcLysholm(d: LysholmData): number {
  return d.limp + d.support + d.locking + d.instability +
         d.pain + d.swelling + d.stairs + d.squat
}

// Webster et al. (2008): 陰性項目を反転して平均×10 = 0-100
export function calcAclRsi(items: AclRsiItems): number {
  const NEGATIVE = new Set([0,1,2,3,4,5,9,10,11])
  const total = items.reduce((sum, val, i) =>
    sum + (NEGATIVE.has(i) ? (10 - val) : val), 0)
  return Math.round((total / 120) * 100)
}

// LSI = 患肢 / 健肢 × 100 (タイムドホップは逆転)
function lsi(involved: number, uninvolved: number, invert = false): number {
  if (!uninvolved || !involved) return 0
  const raw = invert ? (uninvolved / involved) * 100 : (involved / uninvolved) * 100
  return Math.min(100, Math.round(raw))
}

export function calcHopLsi(d: HopTestsData): number {
  const vals = [
    lsi(d.single.involved,    d.single.uninvolved),
    lsi(d.triple.involved,    d.triple.uninvolved),
    lsi(d.crossover.involved, d.crossover.uninvolved),
    lsi(d.timed.involved,     d.timed.uninvolved, true), // 時間は逆転
  ].filter(v => v > 0)
  if (!vals.length) return 0
  return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length)
}

export function calcLefs(items: number[]): number {
  const raw = items.reduce((s, v) => s + (v ?? 0), 0)
  return Math.round((raw / 80) * 100)
}

// 重み付き合計スコア
// 競技復帰: 症状25% + 心理30% + 機能35% + 日常10%
// 日常復帰: 症状30% + 心理20% + 機能20% + 日常30%
export function calcComposite(
  symptom: number, psych: number, functional: number, daily: number,
  type: AssessmentType,
): number {
  const w = type === 'sport'
    ? [0.25, 0.30, 0.35, 0.10]
    : [0.30, 0.20, 0.20, 0.30]
  return Math.round(symptom * w[0] + psych * w[1] + functional * w[2] + daily * w[3])
}

export function getVerdict(score: number): Verdict {
  if (score >= 80) return 'cleared'
  if (score >= 65) return 'conditional'
  return 'not_ready'
}

// ── CRUD ─────────────────────────────────────────────────────────

export function getAssessments(patientId: string): ReturnCriteriaAssessment[] {
  return load()
    .filter(a => a.patientId === patientId)
    .sort((a, b) => b.assessmentDate.localeCompare(a.assessmentDate))
}

export function saveAssessment(
  patientId: string,
  assessmentDate: string,
  type: AssessmentType,
  lysholm: LysholmData,
  aclRsi: AclRsiItems,
  hopTests: HopTestsData,
  lefs: number[],
  notes: string,
): ReturnCriteriaAssessment {
  const symptom     = calcLysholm(lysholm)
  const psychological = calcAclRsi(aclRsi)
  const functional  = calcHopLsi(hopTests)
  const daily       = calcLefs(lefs)
  const composite   = calcComposite(symptom, psychological, functional, daily, type)
  const verdict     = getVerdict(composite)

  const record: ReturnCriteriaAssessment = {
    id: nanoid(),
    patientId,
    assessmentDate,
    type,
    lysholm,
    aclRsi,
    hopTests,
    lefs,
    scores: { symptom, psychological, functional, daily, composite },
    verdict,
    notes,
    createdAt: new Date().toISOString(),
  }

  const list = load()
  list.push(record)
  save(list)
  return record
}

export function deleteAssessment(id: string) {
  save(load().filter(a => a.id !== id))
}
