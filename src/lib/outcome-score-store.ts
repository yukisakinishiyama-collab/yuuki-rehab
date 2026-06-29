// ──────────────────────────────────────────────
// アウトカムスコア ストア（localStorage）
// ──────────────────────────────────────────────
import type { OutcomeScoreRecord, ScoreId } from '@/types/outcome-scores'
import { nanoid } from 'nanoid'

const KEY = 'outcomeScores_v1'

function load(): OutcomeScoreRecord[] {
  if (typeof window === 'undefined') return []
  try { return JSON.parse(localStorage.getItem(KEY) ?? '[]') } catch { return [] }
}
function persist(list: OutcomeScoreRecord[]) {
  localStorage.setItem(KEY, JSON.stringify(list))
}

export function getScores(patientId: string): OutcomeScoreRecord[] {
  return load()
    .filter(r => r.patientId === patientId)
    .sort((a, b) => b.scoreDate.localeCompare(a.scoreDate))
}

export function getScoresByType(patientId: string, scoreId: ScoreId): OutcomeScoreRecord[] {
  return getScores(patientId).filter(r => r.scoreId === scoreId)
}

export function saveScore(record: Omit<OutcomeScoreRecord, 'id' | 'createdAt'>): OutcomeScoreRecord {
  const list = load()
  const newRecord: OutcomeScoreRecord = {
    ...record,
    id: nanoid(),
    createdAt: new Date().toISOString(),
  }
  persist([...list, newRecord])
  return newRecord
}

export function deleteScore(id: string) {
  persist(load().filter(r => r.id !== id))
}
