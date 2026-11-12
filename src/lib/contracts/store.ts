// ──────────────────────────────────────────────
// 署名済みの書類の一覧（pt_contracts）とアウトカム（pt_outcomes）
// 端末の localStorage に持ち、ほかのカルテと同じようにクラウドと同期する（15秒ごと・「すぐに反映する」）。
// 署名入りの本文そのものは、クラウドの kcdoc:<id> に保存する（/api/karte/contracts）。
// ──────────────────────────────────────────────
import type { ContractRecord, OutcomeRecord, OutcomeSetting, SportKey } from '@/types/contracts'
import { notifyCloudSync } from '@/lib/store-sync'

export const CONTRACTS_KEY = 'pt_contracts'
export const OUTCOMES_KEY = 'pt_outcomes'
/** 患者さんごとのアウトカムの設定（競技の評価セット）。id は患者さんの ID */
export const OUTCOME_SETTINGS_KEY = 'pt_outcome_settings'

function read<T>(key: string): T[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(key)
    const v = raw ? JSON.parse(raw) : []
    return Array.isArray(v) ? (v as T[]) : []
  } catch {
    return []
  }
}

function write<T>(key: string, list: T[]) {
  localStorage.setItem(key, JSON.stringify(list))
  notifyCloudSync()
}

// ── 契約書 ─────────────────────────────────────

export function getAllContracts(): ContractRecord[] {
  return read<ContractRecord>(CONTRACTS_KEY)
}

export function getContracts(patientId: string): ContractRecord[] {
  return getAllContracts()
    .filter((c) => c.patientId === patientId)
    .sort((a, b) => b.signedAt.localeCompare(a.signedAt))
}

export function addContract(record: ContractRecord): void {
  const list = getAllContracts().filter((c) => c.id !== record.id)
  list.push(record)
  write(CONTRACTS_KEY, list)
}

/** 取り消し（記録は消さずに、取り消した日と理由を残す） */
export function voidContract(id: string, reason: string): void {
  const list = getAllContracts().map((c) =>
    c.id === id ? { ...c, voided: { at: new Date().toISOString(), reason: reason.slice(0, 200) } } : c,
  )
  write(CONTRACTS_KEY, list)
}

// ── アウトカム ───────────────────────────────────

export function getOutcomes(patientId: string): OutcomeRecord[] {
  return read<OutcomeRecord>(OUTCOMES_KEY)
    .filter((o) => o.patientId === patientId)
    .sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt))
}

export function addOutcome(record: OutcomeRecord): void {
  const list = read<OutcomeRecord>(OUTCOMES_KEY)
  list.push(record)
  write(OUTCOMES_KEY, list)
}

export function deleteOutcome(id: string): void {
  write(
    OUTCOMES_KEY,
    read<OutcomeRecord>(OUTCOMES_KEY).filter((o) => o.id !== id),
  )
}

// ── 競技の評価セット（患者さんごと） ───────────────────

export function getOutcomeSport(patientId: string): SportKey | null {
  const hit = read<OutcomeSetting>(OUTCOME_SETTINGS_KEY).find((s) => s.id === patientId)
  return hit?.sport ?? null
}

export function setOutcomeSport(patientId: string, sport: SportKey): void {
  const list = read<OutcomeSetting>(OUTCOME_SETTINGS_KEY).filter((s) => s.id !== patientId)
  list.push({ id: patientId, sport, updatedAt: new Date().toISOString() })
  write(OUTCOME_SETTINGS_KEY, list)
}
