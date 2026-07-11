import type {
  ReturnCriteriaAssessment,
  LysholmData,
  AclRsiItems,
  HopTestsData,
  HipSymptomData,
  HipFunctionData,
  ShoulderSymptomData,
  ShoulderFunctionData,
  AnkleSymptomData,
  AnkleFunctionData,
  LumbarSymptomData,
  LumbarFunctionData,
  Verdict,
  AssessmentType,
  AssessmentRegion,
} from '@/types/return-criteria'
import { nanoid } from 'nanoid'

const KEY = 'returnCriteria'

function load(): ReturnCriteriaAssessment[] {
  if (typeof window === 'undefined') return []
  try {
    const list: ReturnCriteriaAssessment[] = JSON.parse(localStorage.getItem(KEY) ?? '[]')
    // region追加前に保存された記録は膝として扱う
    return list.map(a => ({ ...a, region: a.region ?? ('knee' as AssessmentRegion) }))
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

// Harris Hip Score（症状評価、10項目合計100点）
export function calcHipSymptom(d: HipSymptomData): number {
  return d.pain + d.limp + d.support + d.distance + d.stairs +
         d.shoes + d.sitting + d.transport + d.deformity + d.rom
}

// 片脚立位保持時間・シングルレッグステップダウンのLSI平均。
// Trendelenburg徴候陽性（殿筋機能低下）の場合は減点する
export function calcHipFunction(d: HipFunctionData): number {
  const vals = [
    lsi(d.singleLegStance.involved, d.singleLegStance.uninvolved),
    lsi(d.stepDown.involved,        d.stepDown.uninvolved),
  ].filter(v => v > 0)
  if (!vals.length) return 0
  const base = Math.round(vals.reduce((a, b) => a + b, 0) / vals.length)
  return d.trendelenburg === 'positive' ? Math.max(0, base - 15) : base
}

// ASES肩スコア（痛みVAS由来50点 + 機能10項目[0-30]を50点換算）
export function calcShoulderSymptom(d: ShoulderSymptomData): number {
  const funcSum = d.f1 + d.f2 + d.f3 + d.f4 + d.f5 + d.f6 + d.f7 + d.f8 + d.f9 + d.f10
  return Math.round(d.pain + (funcSum / 30) * 50)
}

// 座位シングルアーム・ショットパット＋上肢版Y-BalanceのLSI平均。
// 肩甲骨ディスキネジス陽性の場合は減点する
export function calcShoulderFunction(d: ShoulderFunctionData): number {
  const vals = [
    lsi(d.seatedShotPut.involved, d.seatedShotPut.uninvolved),
    lsi(d.yBalanceReach.involved, d.yBalanceReach.uninvolved),
  ].filter(v => v > 0)
  if (!vals.length) return 0
  const base = Math.round(vals.reduce((a, b) => a + b, 0) / vals.length)
  return d.scapularDyskinesis === 'positive' ? Math.max(0, base - 15) : base
}

// 上肢日常生活機能（QuickDASH参考の11項目、1-5尺度）→ 0-100点（高いほど良い方向に反転）
export function calcShoulderDaily(items: number[]): number {
  if (!items.length) return 0
  const sum = items.reduce((s, v) => s + (v || 0), 0)
  const raw = ((sum / items.length) - 1) * 25
  return Math.round(100 - Math.max(0, Math.min(100, raw)))
}

// CAIT（9項目・30点満点）を100点換算
export function calcAnkleSymptom(d: AnkleSymptomData): number {
  const raw = d.q1 + d.q2 + d.q3 + d.q4 + d.q5 + d.q6 + d.q7 + d.q8 + d.q9
  return Math.round((raw / 30) * 100)
}

// Y-Balance前方リーチ・Figure-8ホップテストのLSI平均
export function calcAnkleFunction(d: AnkleFunctionData): number {
  const vals = [
    lsi(d.yBalanceAnterior.involved, d.yBalanceAnterior.uninvolved),
    lsi(d.figure8Hop.involved,       d.figure8Hop.uninvolved, true), // 時間は逆転
  ].filter(v => v > 0)
  if (!vals.length) return 0
  return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length)
}

// ODI（9項目・45点満点、性生活項目は除外）→ 障害度%を100点換算後に反転（高いほど良い）
export function calcLumbarSymptom(d: LumbarSymptomData): number {
  const raw = d.s1 + d.s2 + d.s3 + d.s4 + d.s5 + d.s6 + d.s7 + d.s8 + d.s9
  const disabilityPercent = Math.round((raw / 45) * 100)
  return 100 - disabilityPercent
}

// サイドブリッジ保持時間の左右差（LSI）
export function calcLumbarFunction(d: LumbarFunctionData): number {
  return lsi(d.sideBridge.involved, d.sideBridge.uninvolved)
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

interface SaveKneeInput {
  region: 'knee'
  patientId: string
  assessmentDate: string
  type: AssessmentType
  lysholm: LysholmData
  hopTests: HopTestsData
  aclRsi: AclRsiItems
  lefs: number[]
  notes: string
}

interface SaveHipInput {
  region: 'hip'
  patientId: string
  assessmentDate: string
  type: AssessmentType
  hipSymptom: HipSymptomData
  hipFunction: HipFunctionData
  aclRsi: AclRsiItems
  lefs: number[]
  notes: string
}

interface SaveShoulderInput {
  region: 'shoulder'
  patientId: string
  assessmentDate: string
  type: AssessmentType
  shoulderSymptom: ShoulderSymptomData
  shoulderFunction: ShoulderFunctionData
  aclRsi: AclRsiItems
  shoulderDaily: number[]
  notes: string
}

interface SaveAnkleInput {
  region: 'ankle'
  patientId: string
  assessmentDate: string
  type: AssessmentType
  ankleSymptom: AnkleSymptomData
  ankleFunction: AnkleFunctionData
  aclRsi: AclRsiItems
  lefs: number[]
  notes: string
}

interface SaveLumbarInput {
  region: 'lumbar'
  patientId: string
  assessmentDate: string
  type: AssessmentType
  lumbarSymptom: LumbarSymptomData
  lumbarFunction: LumbarFunctionData
  aclRsi: AclRsiItems
  lefs: number[]
  notes: string
}

type SaveInput = SaveKneeInput | SaveHipInput | SaveShoulderInput | SaveAnkleInput | SaveLumbarInput

export function saveAssessment(input: SaveInput): ReturnCriteriaAssessment {
  let symptom: number, functional: number, daily: number
  let regionData: Partial<ReturnCriteriaAssessment>

  switch (input.region) {
    case 'knee':
      symptom = calcLysholm(input.lysholm)
      functional = calcHopLsi(input.hopTests)
      daily = calcLefs(input.lefs)
      regionData = { lysholm: input.lysholm, hopTests: input.hopTests, lefs: input.lefs }
      break
    case 'hip':
      symptom = calcHipSymptom(input.hipSymptom)
      functional = calcHipFunction(input.hipFunction)
      daily = calcLefs(input.lefs)
      regionData = { hipSymptom: input.hipSymptom, hipFunction: input.hipFunction, lefs: input.lefs }
      break
    case 'shoulder':
      symptom = calcShoulderSymptom(input.shoulderSymptom)
      functional = calcShoulderFunction(input.shoulderFunction)
      daily = calcShoulderDaily(input.shoulderDaily)
      regionData = { shoulderSymptom: input.shoulderSymptom, shoulderFunction: input.shoulderFunction, shoulderDaily: input.shoulderDaily }
      break
    case 'ankle':
      symptom = calcAnkleSymptom(input.ankleSymptom)
      functional = calcAnkleFunction(input.ankleFunction)
      daily = calcLefs(input.lefs)
      regionData = { ankleSymptom: input.ankleSymptom, ankleFunction: input.ankleFunction, lefs: input.lefs }
      break
    case 'lumbar':
      symptom = calcLumbarSymptom(input.lumbarSymptom)
      functional = calcLumbarFunction(input.lumbarFunction)
      daily = calcLefs(input.lefs)
      regionData = { lumbarSymptom: input.lumbarSymptom, lumbarFunction: input.lumbarFunction, lefs: input.lefs }
      break
  }

  const psychological = calcAclRsi(input.aclRsi)
  const composite = calcComposite(symptom, psychological, functional, daily, input.type)
  const verdict = getVerdict(composite)

  const record: ReturnCriteriaAssessment = {
    id: nanoid(),
    patientId: input.patientId,
    assessmentDate: input.assessmentDate,
    type: input.type,
    region: input.region,
    ...regionData,
    aclRsi: input.aclRsi,
    scores: { symptom, psychological, functional, daily, composite },
    verdict,
    notes: input.notes,
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
