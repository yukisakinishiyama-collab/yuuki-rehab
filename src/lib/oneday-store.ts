// ──────────────────────────────────────────────
// 1dayリハ セッションの保存（localStorage）
// 実施したメニューと、実施後の変化（NRS・メモ）を患者ごとに残す。
// ──────────────────────────────────────────────
import { nanoid } from 'nanoid'
import type { OneDayInput, OneDayMenu } from './oneday-rehab'
import { notifyCloudSync } from './store-sync'

const KEY = 'onedaySessions'

export interface OneDaySession {
  id: string
  protocolId: string
  patientId: string
  /** 実施日 yyyy-MM-dd */
  date: string
  input: OneDayInput
  menu: OneDayMenu
  /** 実施後のNRS（未入力は null） */
  afterNrs: number | null
  afterNote: string
  createdAt: string
}

function getAll(): OneDaySession[] {
  if (typeof window === 'undefined') return []
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) ?? '[]') as unknown
    return Array.isArray(parsed) ? (parsed as OneDaySession[]) : []
  } catch {
    return []
  }
}

function setAll(list: OneDaySession[]): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(KEY, JSON.stringify(list))
  notifyCloudSync()
}

export function getOneDaySessions(patientId: string): OneDaySession[] {
  return getAll()
    .filter(s => s.patientId === patientId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export function saveOneDaySession(
  session: Omit<OneDaySession, 'id' | 'createdAt'>,
): OneDaySession {
  const record: OneDaySession = {
    ...session,
    id: nanoid(),
    createdAt: new Date().toISOString(),
  }
  setAll([...getAll(), record])
  return record
}

export function updateOneDaySession(id: string, updates: Partial<OneDaySession>): void {
  setAll(getAll().map(s => (s.id === id ? { ...s, ...updates } : s)))
}

export function deleteOneDaySession(id: string): void {
  setAll(getAll().filter(s => s.id !== id))
}
