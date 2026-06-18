import type { ProtocolPatient, Protocol, Phase, Assessment, Milestone } from '@/types/protocol'
import { DEFAULT_MILESTONES } from '@/types/protocol'
import { getTemplate, findBestTemplate } from '@/data/protocols/templates'
import { nanoid } from 'nanoid'

const KEYS = {
  patients:    'protocolPatients',
  protocols:   'protocolList',
  assessments: 'protocolAssessments',
  milestones:  'protocolMilestones',
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
}

// ─── 患者 ────────────────────────────────────────────────────────────────────
export function getPatients(): ProtocolPatient[] {
  return get<ProtocolPatient>(KEYS.patients)
}

export function savePatient(patient: Omit<ProtocolPatient, 'id' | 'createdAt' | 'updatedAt'>): ProtocolPatient {
  const patients = getPatients()
  const now = new Date().toISOString()
  const newPatient: ProtocolPatient = { ...patient, id: nanoid(), createdAt: now, updatedAt: now }
  set(KEYS.patients, [...patients, newPatient])
  return newPatient
}

export function updatePatient(id: string, updates: Partial<ProtocolPatient>): void {
  const patients = getPatients()
  set(KEYS.patients, patients.map(p => p.id === id ? { ...p, ...updates, updatedAt: new Date().toISOString() } : p))
}

export function deletePatient(id: string): void {
  set(KEYS.patients, getPatients().filter(p => p.id !== id))
}

export function getPatientById(id: string): ProtocolPatient | null {
  return getPatients().find(p => p.id === id) ?? null
}

// ─── プロトコル ──────────────────────────────────────────────────────────────
export function getProtocols(): Protocol[] {
  return get<Protocol>(KEYS.protocols)
}

export function getProtocolsByPatient(patientId: string): Protocol[] {
  return getProtocols().filter(p => p.patientId === patientId)
}

export function getProtocolById(id: string): Protocol | null {
  return getProtocols().find(p => p.id === id) ?? null
}

export function saveProtocol(protocol: Omit<Protocol, 'id' | 'createdAt' | 'updatedAt'>): Protocol {
  const protocols = getProtocols()
  const now = new Date().toISOString()
  const newProtocol: Protocol = { ...protocol, id: nanoid(), createdAt: now, updatedAt: now }
  set(KEYS.protocols, [...protocols, newProtocol])
  return newProtocol
}

export function updateProtocol(id: string, updates: Partial<Protocol>): void {
  const protocols = getProtocols()
  set(KEYS.protocols, protocols.map(p => p.id === id ? { ...p, ...updates, updatedAt: new Date().toISOString() } : p))
}

export function deleteProtocol(id: string): void {
  set(KEYS.protocols, getProtocols().filter(p => p.id !== id))
}

// フェーズを更新
export function updatePhase(protocolId: string, phaseId: string, updates: Partial<Phase>): void {
  const protocol = getProtocolById(protocolId)
  if (!protocol) return
  const phases = protocol.phases.map(ph => ph.id === phaseId ? { ...ph, ...updates } : ph)
  updateProtocol(protocolId, { phases })
}

// フェーズを進める
export function advancePhase(protocolId: string): void {
  const protocol = getProtocolById(protocolId)
  if (!protocol) return
  const next = Math.min(protocol.currentPhaseIndex + 1, protocol.phases.length - 1)
  updateProtocol(protocolId, { currentPhaseIndex: next })
}

// ─── テンプレートからプロトコルを生成 ────────────────────────────────────────
export function generateProtocolFromTemplate(
  patientId: string,
  diagnosisKey: string,
  diagnosis?: string,
  joint?: string,
): Protocol | null {
  const template = getTemplate(diagnosisKey) ?? findBestTemplate(diagnosis ?? '', joint)
  if (!template) return null

  const phases: Phase[] = template.phases.map((ph, i) => ({
    ...ph,
    id: nanoid(),
    order: i + 1,
  }))

  return saveProtocol({
    patientId,
    title: template.title,
    phases,
    discussion: template.discussion,
    consensusNotes: template.consensusNotes,
    generatedBy: 'template',
    currentPhaseIndex: 0,
  })
}

// ─── 評価記録 ─────────────────────────────────────────────────────────────────
export function getAssessments(patientId?: string): Assessment[] {
  const all = get<Assessment>(KEYS.assessments)
  if (!patientId) return all
  return all.filter(a => a.patientId === patientId)
}

export function getAssessmentsByProtocol(protocolId: string): Assessment[] {
  return get<Assessment>(KEYS.assessments).filter(a => a.protocolId === protocolId)
}

export function saveAssessment(assessment: Omit<Assessment, 'id'>): Assessment {
  const assessments = get<Assessment>(KEYS.assessments)
  const newAssessment: Assessment = { ...assessment, id: nanoid() }
  set(KEYS.assessments, [...assessments, newAssessment])
  return newAssessment
}

export function deleteAssessment(id: string): void {
  set(KEYS.assessments, get<Assessment>(KEYS.assessments).filter(a => a.id !== id))
}

// ─── マイルストーン ──────────────────────────────────────────────────────────
export function getMilestones(patientId: string): Milestone[] {
  return get<Milestone>(KEYS.milestones).filter(m => m.patientId === patientId)
}

export function initMilestones(patientId: string): Milestone[] {
  const existing = getMilestones(patientId)
  if (existing.length > 0) return existing

  const milestones: Milestone[] = DEFAULT_MILESTONES.map(m => ({
    ...m,
    id: nanoid(),
    patientId,
  }))

  const all = get<Milestone>(KEYS.milestones)
  set(KEYS.milestones, [...all, ...milestones])
  return milestones
}

export function achieveMilestone(id: string): void {
  const all = get<Milestone>(KEYS.milestones)
  set(KEYS.milestones, all.map(m =>
    m.id === id ? { ...m, achieved: true, date: new Date().toISOString() } : m
  ))
}

export function updateMilestone(id: string, updates: Partial<Milestone>): void {
  const all = get<Milestone>(KEYS.milestones)
  set(KEYS.milestones, all.map(m => m.id === id ? { ...m, ...updates } : m))
}

// フェーズ達成率を計算
export function calcPhaseProgress(phase: Phase): number {
  const total = phase.advanceCriteria.length
  if (total === 0) return 0
  const met = phase.advanceCriteria.filter(c => c.met).length
  return Math.round((met / total) * 100)
}
