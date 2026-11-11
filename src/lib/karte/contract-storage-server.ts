/**
 * 署名入りの書類の本文（サーバー専用）
 *
 * - KV の kcdoc:<記録ID> に、署名したときの本文（チェック・記入・署名の画像まで入れた HTML）を1件ずつ保存する
 * - 一度保存したら書きかえない（同じ ID への2回目の保存は断る）。取り消しは一覧（pt_contracts）の印で行う
 * - 院内アプリの API（Basic 認証の内側）だけが読む。ログに患者さんの情報は出さない
 */
import { kvGet, kvSet } from '@/lib/marketing/kv-store-server'
import type { ContractSnapshot } from '@/types/contracts'

const ID_RE = /^[A-Za-z0-9_-]{6,64}$/
export const MAX_SNAPSHOT_CHARS = 1_500_000

export function isValidContractId(id: string): boolean {
  return ID_RE.test(id)
}

export async function getContractSnapshot(id: string): Promise<ContractSnapshot | null> {
  if (!isValidContractId(id)) return null
  return kvGet<ContractSnapshot>(`kcdoc:${id}`)
}

export async function saveContractSnapshot(snapshot: ContractSnapshot): Promise<'saved' | 'exists'> {
  const id = snapshot.record.id
  if (!isValidContractId(id)) throw new Error('記録の番号が正しくありません')
  const existing = await kvGet<ContractSnapshot>(`kcdoc:${id}`)
  if (existing) return 'exists'
  await kvSet(`kcdoc:${id}`, snapshot)
  return 'saved'
}
