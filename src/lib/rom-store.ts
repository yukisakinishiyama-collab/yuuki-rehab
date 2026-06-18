import type { ROMPatient, ROMSession } from '@/types/rom'

const KEYS = {
  patients: 'romPatients',
  sessions: 'romSessions',
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

export function getPatients(): ROMPatient[] {
  return get<ROMPatient>(KEYS.patients)
}

export function getPatient(id: string): ROMPatient | undefined {
  return getPatients().find((p) => p.id === id)
}

export function savePatient(patient: ROMPatient): void {
  const patients = getPatients()
  const idx = patients.findIndex((p) => p.id === patient.id)
  if (idx >= 0) {
    patients[idx] = { ...patient, updatedAt: new Date().toISOString() }
  } else {
    patients.push(patient)
  }
  set(KEYS.patients, patients)
}

export function deletePatient(id: string): void {
  set(KEYS.patients, getPatients().filter((p) => p.id !== id))
  set(KEYS.sessions, getSessions().filter((s) => s.patientId !== id))
}

export function getSessions(): ROMSession[] {
  return get<ROMSession>(KEYS.sessions)
}

export function getSessionsByPatient(patientId: string): ROMSession[] {
  return getSessions()
    .filter((s) => s.patientId === patientId)
    .sort((a, b) => new Date(b.measuredAt).getTime() - new Date(a.measuredAt).getTime())
}

export function getSession(id: string): ROMSession | undefined {
  return getSessions().find((s) => s.id === id)
}

export function saveSession(session: ROMSession): void {
  const sessions = getSessions()
  const idx = sessions.findIndex((s) => s.id === session.id)
  if (idx >= 0) {
    sessions[idx] = session
  } else {
    sessions.push(session)
  }
  set(KEYS.sessions, sessions)
}

export function deleteSession(id: string): void {
  set(KEYS.sessions, getSessions().filter((s) => s.id !== id))
}

export function getNextSessionNumber(patientId: string): number {
  const sessions = getSessionsByPatient(patientId)
  if (sessions.length === 0) return 1
  return Math.max(...sessions.map((s) => s.sessionNumber)) + 1
}
