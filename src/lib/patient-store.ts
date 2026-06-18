// ──────────────────────────────────────────────
// リハビリ患者管理システム - localStorageストア
// ──────────────────────────────────────────────
import type {
  Patient, Evaluation, ROMRecord, StrengthRecord,
  SpecialTestRecord, SOAPNote, RehabPlan, Exercise,
  PatientExercise, ProgressRecord, AttendanceRecord, RetentionRisk
} from '@/types/patient'
import { SAMPLE_PATIENTS, SAMPLE_EVALUATIONS, SAMPLE_EXERCISES, SAMPLE_SOAP_NOTES } from './patient-data'

const STORE_VERSION = '1'

const KEYS = {
  patients: 'pt_patients',
  evaluations: 'pt_evaluations',
  romRecords: 'pt_rom_records',
  strengthRecords: 'pt_strength_records',
  specialTests: 'pt_special_tests',
  soapNotes: 'pt_soap_notes',
  rehabPlans: 'pt_rehab_plans',
  exercises: 'pt_exercises',
  patientExercises: 'pt_patient_exercises',
  progressRecords: 'pt_progress_records',
  attendanceRecords: 'pt_attendance_records',
  retentionRisks: 'pt_retention_risks',
  initialized: 'pt_initialized',
  version: 'pt_version',
} as const

function get<T>(key: string): T[] {
  if (typeof window === 'undefined') return []
  try {
    return JSON.parse(localStorage.getItem(key) ?? '[]') as T[]
  } catch {
    return []
  }
}

function set<T>(key: string, data: T[]): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(key, JSON.stringify(data))
  // 保存後にクラウドへ自動同期（設定済みの場合のみ）
  import('./sync-service').then(({ scheduleSync }) => scheduleSync())
}

export function initPatientStore(): void {
  if (typeof window === 'undefined') return
  const initialized = localStorage.getItem(KEYS.initialized)
  const version = localStorage.getItem(KEYS.version)
  if (initialized && version === STORE_VERSION) return

  localStorage.setItem(KEYS.patients, JSON.stringify(SAMPLE_PATIENTS))
  localStorage.setItem(KEYS.evaluations, JSON.stringify(SAMPLE_EVALUATIONS))
  localStorage.setItem(KEYS.exercises, JSON.stringify(SAMPLE_EXERCISES))
  localStorage.setItem(KEYS.soapNotes, JSON.stringify(SAMPLE_SOAP_NOTES))
  localStorage.setItem(KEYS.initialized, 'true')
  localStorage.setItem(KEYS.version, STORE_VERSION)
}

// ── 患者 ──
export function getPatients(): Patient[] {
  return get<Patient>(KEYS.patients)
}

export function getPatient(id: string): Patient | undefined {
  return getPatients().find(p => p.id === id)
}

export function savePatient(patient: Patient): void {
  const list = getPatients()
  const idx = list.findIndex(p => p.id === patient.id)
  if (idx >= 0) list[idx] = patient
  else list.push(patient)
  set(KEYS.patients, list)
}

export function deletePatient(id: string): void {
  set(KEYS.patients, getPatients().filter(p => p.id !== id))
}

// ── 評価 ──
export function getEvaluations(patientId?: string): Evaluation[] {
  const all = get<Evaluation>(KEYS.evaluations)
  return patientId ? all.filter(e => e.patientId === patientId) : all
}

export function saveEvaluation(evaluation: Evaluation): void {
  const list = getEvaluations()
  const idx = list.findIndex(e => e.id === evaluation.id)
  if (idx >= 0) list[idx] = evaluation
  else list.push(evaluation)
  set(KEYS.evaluations, list)
}

// ── ROM記録 ──
export function getROMRecords(patientId?: string): ROMRecord[] {
  const all = get<ROMRecord>(KEYS.romRecords)
  return patientId ? all.filter(r => r.patientId === patientId) : all
}

export function saveROMRecord(record: ROMRecord): void {
  const list = getROMRecords()
  const idx = list.findIndex(r => r.id === record.id)
  if (idx >= 0) list[idx] = record
  else list.push(record)
  set(KEYS.romRecords, list)
}

export function deleteROMRecord(id: string): void {
  set(KEYS.romRecords, getROMRecords().filter(r => r.id !== id))
}

// ── 筋力記録 ──
export function getStrengthRecords(patientId?: string): StrengthRecord[] {
  const all = get<StrengthRecord>(KEYS.strengthRecords)
  return patientId ? all.filter(r => r.patientId === patientId) : all
}

export function saveStrengthRecord(record: StrengthRecord): void {
  const list = getStrengthRecords()
  const idx = list.findIndex(r => r.id === record.id)
  if (idx >= 0) list[idx] = record
  else list.push(record)
  set(KEYS.strengthRecords, list)
}

export function deleteStrengthRecord(id: string): void {
  set(KEYS.strengthRecords, getStrengthRecords().filter(r => r.id !== id))
}

// ── スペシャルテスト ──
export function getSpecialTests(patientId?: string): SpecialTestRecord[] {
  const all = get<SpecialTestRecord>(KEYS.specialTests)
  return patientId ? all.filter(r => r.patientId === patientId) : all
}

export function saveSpecialTest(record: SpecialTestRecord): void {
  const list = getSpecialTests()
  const idx = list.findIndex(r => r.id === record.id)
  if (idx >= 0) list[idx] = record
  else list.push(record)
  set(KEYS.specialTests, list)
}

export function deleteSpecialTest(id: string): void {
  set(KEYS.specialTests, getSpecialTests().filter(r => r.id !== id))
}

// ── SOAPカルテ ──
export function getSOAPNotes(patientId?: string): SOAPNote[] {
  const all = get<SOAPNote>(KEYS.soapNotes)
  return patientId ? all.filter(n => n.patientId === patientId) : all
}

export function saveSOAPNote(note: SOAPNote): void {
  const list = getSOAPNotes()
  const idx = list.findIndex(n => n.id === note.id)
  if (idx >= 0) list[idx] = note
  else list.push(note)
  set(KEYS.soapNotes, list)
}

export function deleteSOAPNote(id: string): void {
  set(KEYS.soapNotes, getSOAPNotes().filter(n => n.id !== id))
}

// ── リハビリプラン ──
export function getRehabPlans(patientId?: string): RehabPlan[] {
  const all = get<RehabPlan>(KEYS.rehabPlans)
  return patientId ? all.filter(p => p.patientId === patientId) : all
}

export function saveRehabPlan(plan: RehabPlan): void {
  const list = getRehabPlans()
  const idx = list.findIndex(p => p.id === plan.id)
  if (idx >= 0) list[idx] = plan
  else list.push(plan)
  set(KEYS.rehabPlans, list)
}

// ── 運動マスタ ──
export function getExercises(): Exercise[] {
  return get<Exercise>(KEYS.exercises)
}

export function saveExercise(exercise: Exercise): void {
  const list = getExercises()
  const idx = list.findIndex(e => e.id === exercise.id)
  if (idx >= 0) list[idx] = exercise
  else list.push(exercise)
  set(KEYS.exercises, list)
}

// ── 患者運動割り当て ──
export function getPatientExercises(patientId?: string): PatientExercise[] {
  const all = get<PatientExercise>(KEYS.patientExercises)
  return patientId ? all.filter(e => e.patientId === patientId) : all
}

export function savePatientExercise(pe: PatientExercise): void {
  const list = getPatientExercises()
  const idx = list.findIndex(e => e.id === pe.id)
  if (idx >= 0) list[idx] = pe
  else list.push(pe)
  set(KEYS.patientExercises, list)
}

export function deletePatientExercise(id: string): void {
  set(KEYS.patientExercises, getPatientExercises().filter(e => e.id !== id))
}

// ── 進捗記録 ──
export function getProgressRecords(patientId?: string): ProgressRecord[] {
  const all = get<ProgressRecord>(KEYS.progressRecords)
  return patientId ? all.filter(r => r.patientId === patientId) : all
}

export function saveProgressRecord(record: ProgressRecord): void {
  const list = getProgressRecords()
  const idx = list.findIndex(r => r.id === record.id)
  if (idx >= 0) list[idx] = record
  else list.push(record)
  set(KEYS.progressRecords, list)
}

// ── 来院記録 ──
export function getAttendanceRecords(patientId?: string): AttendanceRecord[] {
  const all = get<AttendanceRecord>(KEYS.attendanceRecords)
  return patientId ? all.filter(r => r.patientId === patientId) : all
}

export function saveAttendanceRecord(record: AttendanceRecord): void {
  const list = getAttendanceRecords()
  const idx = list.findIndex(r => r.id === record.id)
  if (idx >= 0) list[idx] = record
  else list.push(record)
  set(KEYS.attendanceRecords, list)
}

// ── 離脱リスク ──
export function getRetentionRisks(patientId?: string): RetentionRisk[] {
  const all = get<RetentionRisk>(KEYS.retentionRisks)
  return patientId ? all.filter(r => r.patientId === patientId) : all
}

export function saveRetentionRisk(risk: RetentionRisk): void {
  const list = getRetentionRisks()
  const idx = list.findIndex(r => r.id === risk.id)
  if (idx >= 0) list[idx] = risk
  else list.push(risk)
  set(KEYS.retentionRisks, list)
}
