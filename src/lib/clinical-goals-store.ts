// ──────────────────────────────────────────────
// 目標二層＋問題リストのストア（NextGen v2.0）
// 既存ストアと同じ「1キー=1配列」構造。保存時は必ずクラウドへ通知する。
// ──────────────────────────────────────────────
import { nanoid } from 'nanoid'
import type { PatientGoals, ClinicalProblem, ProblemStatus } from '@/types/patient'
import { notifyCloudSync } from './store-sync'

const GOALS_KEY = 'pt_goals'
const PROBLEMS_KEY = 'pt_problems'

function get<T>(key: string): T[] {
  if (typeof window === 'undefined') return []
  try {
    const parsed = JSON.parse(localStorage.getItem(key) ?? '[]') as unknown
    return Array.isArray(parsed) ? (parsed as T[]) : []
  } catch {
    return []
  }
}

function set<T>(key: string, data: T[]): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(key, JSON.stringify(data))
  notifyCloudSync()
}

// ── 目標（患者1人につき1レコード）──

export function getPatientGoals(patientId: string): PatientGoals | undefined {
  return get<PatientGoals>(GOALS_KEY).find(g => g.patientId === patientId)
}

export function savePatientGoals(goals: Omit<PatientGoals, 'updatedAt'>): PatientGoals {
  const record: PatientGoals = { ...goals, updatedAt: new Date().toISOString() }
  const rest = get<PatientGoals>(GOALS_KEY).filter(g => g.patientId !== goals.patientId)
  set(GOALS_KEY, [...rest, record])
  return record
}

// ── 問題リスト ──

export function getProblems(patientId: string): ClinicalProblem[] {
  return get<ClinicalProblem>(PROBLEMS_KEY)
    .filter(p => p.patientId === patientId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
}

export function addProblem(patientId: string, label: string): ClinicalProblem {
  const now = new Date().toISOString()
  const problem: ClinicalProblem = {
    id: nanoid(), patientId, label: label.trim(), status: 'active', note: '',
    createdAt: now, updatedAt: now,
  }
  set(PROBLEMS_KEY, [...get<ClinicalProblem>(PROBLEMS_KEY), problem])
  return problem
}

export function updateProblem(id: string, updates: Partial<Pick<ClinicalProblem, 'label' | 'status' | 'note'>>): void {
  set(PROBLEMS_KEY, get<ClinicalProblem>(PROBLEMS_KEY).map(p =>
    p.id === id ? { ...p, ...updates, updatedAt: new Date().toISOString() } : p,
  ))
}

export function deleteProblem(id: string): void {
  set(PROBLEMS_KEY, get<ClinicalProblem>(PROBLEMS_KEY).filter(p => p.id !== id))
}

/** ステータスの表示順（説明モード・カードでの並び）*/
export const PROBLEM_STATUS_ORDER: ProblemStatus[] = ['active', 'improving', 'monitor', 'resolved']
