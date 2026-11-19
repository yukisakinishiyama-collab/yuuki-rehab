/**
 * カルテのクラウドの控え（KV の sync:clinic）を、サーバーの中から読む・重ねる（サーバー専用）
 *
 * 端末からの同期（/api/sync）と同じ入れ物・同じ重ね方（lib/sync-merge.ts の applyOps）を使う。
 * サーバーが自分でカルテを足すとき（予約が入ったときの自動登録など）も、ここを通す。
 * 重ねたあとは版（updatedAt）が進むので、開いている端末は15秒以内に取り込む。
 */
import { kvGet, kvSet } from '@/lib/marketing/kv-store-server'
import { applyOps, type KeyOp } from '@/lib/sync-merge'

export const SYNC_KEY = 'sync:clinic'

export type SyncRecord = {
  payload: Record<string, string>
  updatedAt: string
}

/** 同じ時刻の書き込みでも版が重ならないように、前の版より必ず後の時刻にする */
export function nextVersion(prev: string | null | undefined, now: Date = new Date()): string {
  if (prev && now.toISOString() <= prev) return new Date(new Date(prev).getTime() + 1).toISOString()
  return now.toISOString()
}

export async function readSyncRecord(): Promise<SyncRecord | null> {
  const record = await kvGet<SyncRecord>(SYNC_KEY)
  if (!record || typeof record !== 'object' || !record.payload || typeof record.payload !== 'object') return null
  return record
}

/** クラウドの今の中身に、変更を重ねて保存する。返すのは新しい版と、重ねる前の版 */
export async function applySyncOps(ops: KeyOp[]): Promise<{ updatedAt: string; prevAt: string | null }> {
  const record = await readSyncRecord()
  const prevAt = record?.updatedAt ?? null
  const payload = applyOps(record?.payload ?? {}, ops)
  const updatedAt = nextVersion(prevAt)
  await kvSet(SYNC_KEY, { payload, updatedAt } satisfies SyncRecord)
  return { updatedAt, prevAt }
}
