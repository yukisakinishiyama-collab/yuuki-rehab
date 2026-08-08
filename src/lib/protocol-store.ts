import type { ProtocolPatient, Protocol, Phase, Assessment, Milestone, ProtocolAttachment, ProtocolChatMessage } from '@/types/protocol'
import { getTemplate, findBestTemplate } from '@/data/protocols/templates'
import { resolveMilestoneSet, LEGACY_DEFAULT_SET } from '@/data/milestones'
import { notifyCloudSync } from './store-sync'
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
  // クラウドへ自動送信。これが無いと、AI文章やマイルストーン達成などの
  // プロトコル系データが次回起動時のプル（全上書き）で巻き戻ってしまう
  notifyCloudSync()
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

// 添付ファイル追加（base64）
export function addAttachment(
  protocolId: string,
  file: Omit<ProtocolAttachment, 'id' | 'addedAt'>,
): void {
  const attachment: ProtocolAttachment = {
    ...file,
    id: nanoid(),
    addedAt: new Date().toISOString(),
  }
  const protocol = getProtocolById(protocolId)
  if (!protocol) return
  updateProtocol(protocolId, {
    attachments: [...(protocol.attachments ?? []), attachment],
  })
}

// 添付ファイル削除
export function removeAttachment(protocolId: string, attachmentId: string): void {
  const protocol = getProtocolById(protocolId)
  if (!protocol) return
  updateProtocol(protocolId, {
    attachments: (protocol.attachments ?? []).filter(a => a.id !== attachmentId),
  })
}

// 添付ファイルメモ更新
export function updateAttachmentNote(protocolId: string, attachmentId: string, note: string): void {
  const protocol = getProtocolById(protocolId)
  if (!protocol) return
  updateProtocol(protocolId, {
    attachments: (protocol.attachments ?? []).map(a =>
      a.id === attachmentId ? { ...a, note } : a
    ),
  })
}

// ─── AI相談チャット ──────────────────────────────────────────────────────────
export function appendChatMessage(
  protocolId: string,
  msg: Omit<ProtocolChatMessage, 'id' | 'createdAt'>,
): ProtocolChatMessage {
  const message: ProtocolChatMessage = {
    ...msg,
    id: nanoid(),
    createdAt: new Date().toISOString(),
  }
  const protocol = getProtocolById(protocolId)
  if (protocol) {
    updateProtocol(protocolId, { aiChat: [...(protocol.aiChat ?? []), message] })
  }
  return message
}

export function clearChat(protocolId: string): void {
  updateProtocol(protocolId, { aiChat: [] })
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

/** 患者の診断名・関節に合ったマイルストーンセットを返す */
export function resolvePatientMilestoneSet(patientId: string) {
  const patient = getPatientById(patientId)
  return resolveMilestoneSet(patient?.diagnosis, patient?.joint)
}

/** セット定義から患者のマイルストーン実体を作る（保存はしない） */
function buildMilestones(patientId: string, setKey: string, defs: { label: string; icon: string; hint?: string }[]): Milestone[] {
  return defs.map(def => ({
    id: nanoid(),
    patientId,
    label: def.label,
    icon: def.icon,
    hint: def.hint,
    setKey,
    achieved: false,
  }))
}

const LEGACY_LABELS = LEGACY_DEFAULT_SET.map(m => m.label).join('|')

// 旧セット→疾患別セットへ自動差し替えした患者の「未告知」印。
// initMilestones はページ側・レポート側・簡易表示など複数経路から呼ばれるため、
// どの経路で差し替えが起きても、次にマイルストーンパネルを開いたときに1回だけ告知できるよう
// localStorage に永続化しておく。
const SWAP_NOTICE_KEY = 'protocolMilestoneSwapNotices'

function markMilestoneSwapNotice(patientId: string): void {
  if (typeof window === 'undefined') return
  const list = get<string>(SWAP_NOTICE_KEY)
  if (!list.includes(patientId)) set(SWAP_NOTICE_KEY, [...list, patientId])
}

/** 未告知の差し替えがあれば true を返し、印を消す（告知は1回だけ） */
export function consumeMilestoneSwapNotice(patientId: string): boolean {
  const list = get<string>(SWAP_NOTICE_KEY)
  if (!list.includes(patientId)) return false
  set(SWAP_NOTICE_KEY, list.filter(id => id !== patientId))
  return true
}

/**
 * マイルストーンを初期化して返す。
 * - 未作成なら、診断名・関節に合った疾患別セットで作成する
 * - 旧・全疾患共通セットのまま【1つも達成していない】患者は、疾患別セットへ自動で差し替える
 *   （達成記録がある場合は、記録を守るため触らない）
 */
export function initMilestones(patientId: string): Milestone[] {
  const existing = getMilestones(patientId)
  const { key, defs } = resolvePatientMilestoneSet(patientId)

  if (existing.length > 0) {
    const isLegacyUntouched =
      existing.every(m => !m.achieved) &&
      existing.map(m => m.label).join('|') === LEGACY_LABELS
    const targetLabels = defs.map(d => d.label).join('|')
    if (!isLegacyUntouched || targetLabels === LEGACY_LABELS) return existing
    // 旧共通セット（未達成）→ 疾患別セットへ差し替え
    const others = get<Milestone>(KEYS.milestones).filter(m => m.patientId !== patientId)
    const milestones = buildMilestones(patientId, key, defs)
    set(KEYS.milestones, [...others, ...milestones])
    // どの呼び出し経路で差し替わっても、次回パネル表示時に告知できるよう印を残す
    markMilestoneSwapNotice(patientId)
    return milestones
  }

  const milestones = buildMilestones(patientId, key, defs)
  const all = get<Milestone>(KEYS.milestones)
  set(KEYS.milestones, [...all, ...milestones])
  return milestones
}

/**
 * マイルストーンを疾患別セットで作り直す（達成記録は消える）。
 * 診断名を後から変えた場合や、旧セットで達成済みの患者を切り替えたい場合に使う。
 * 同名のマイルストーンの達成記録は引き継ぐ。
 */
export function resetMilestonesToDisease(patientId: string): Milestone[] {
  const previous = getMilestones(patientId)
  const achievedByLabel = new Map(
    previous.filter(m => m.achieved).map(m => [m.label, m] as const),
  )
  const { key, defs } = resolvePatientMilestoneSet(patientId)
  const milestones = buildMilestones(patientId, key, defs).map(m => {
    const prev = achievedByLabel.get(m.label)
    return prev ? { ...m, achieved: true, date: prev.date } : m
  })
  const others = get<Milestone>(KEYS.milestones).filter(m => m.patientId !== patientId)
  set(KEYS.milestones, [...others, ...milestones])
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
