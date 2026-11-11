/**
 * 院内アプリのバックアップ（サーバー専用）
 *
 * 1. クラウドの毎月の控え … 毎日夜中に確かめ、その月（日本時間）の控えが無ければ作る（backup:YYYY-MM）。12か月分を残す
 *    中身＝カルテ（端末と同期している全部：患者さん・SOAP・評価・アウトカム・契約の一覧など）と、患部の写真の一覧
 *    署名入りの契約書の本文（kcdoc:）は、あとから書きかえない作りなので、毎月の控えには重ねて入れない
 * 2. パソコンに保存 … 画面から core（カルテ＋写真の一覧＋契約の番号）と、契約書の本文を20件ずつ受け取り、
 *    端末で1つのファイルにまとめてパソコンのフォルダへ書く（lib/backup/client.ts）
 */
import { kvGet, kvList, kvSet, kvDelete } from '@/lib/marketing/kv-store-server'
import type { KartePhoto } from '@/types/patient'
import type { ContractSnapshot } from '@/types/contracts'

export const BACKUP_FORMAT = 'yuuki-app-backup'
export const KEEP_MONTHS = 12

type SyncRecord = { payload: Record<string, string>; updatedAt: string }

export interface CoreBackup {
  format: typeof BACKUP_FORMAT
  version: 1
  createdAt: string
  /** カルテ（端末の localStorage と同じ形。キー → JSON の文字列） */
  karte: { updatedAt: string | null; data: Record<string, string> }
  /** 患部の写真の一覧（患者さんの ID → 写真の情報。画像そのものはクラウドの保存場所にある） */
  photosMeta: Record<string, KartePhoto[]>
  /** 署名入りの契約書の番号（本文は別に受け取る） */
  contractIds: string[]
  counts: Record<string, number>
}

export interface BackupIndexEntry {
  ym: string
  createdAt: string
  chars: number
  counts: Record<string, number>
}

const INDEX_KEY = 'backupidx:monthly'

function lengthOf(raw: string | undefined): number {
  if (!raw) return 0
  try {
    const v = JSON.parse(raw)
    return Array.isArray(v) ? v.length : 0
  } catch {
    return 0
  }
}

/** 日本時間の年月 */
export function jstYm(now: Date = new Date()): string {
  return new Date(now.getTime() + 9 * 3600 * 1000).toISOString().slice(0, 7)
}

export async function buildCoreBackup(now: Date = new Date()): Promise<CoreBackup> {
  const sync = await kvGet<SyncRecord>('sync:clinic')
  const data = sync?.payload ?? {}
  const photoRows = await kvList<KartePhoto[]>('kphoto:')
  const photosMeta: Record<string, KartePhoto[]> = {}
  for (const row of photoRows) photosMeta[row.key.slice('kphoto:'.length)] = Array.isArray(row.value) ? row.value : []

  let contractIds: string[] = []
  try {
    const list = JSON.parse(data.pt_contracts ?? '[]') as Array<{ id?: unknown }>
    contractIds = list.map((c) => String(c.id ?? '')).filter((id) => /^[A-Za-z0-9_-]{6,64}$/.test(id))
  } catch {
    contractIds = []
  }

  return {
    format: BACKUP_FORMAT,
    version: 1,
    createdAt: now.toISOString(),
    karte: { updatedAt: sync?.updatedAt ?? null, data },
    photosMeta,
    contractIds,
    counts: {
      患者さん: lengthOf(data.pt_patients),
      SOAP: lengthOf(data.pt_soap_notes),
      評価: lengthOf(data.pt_evaluations),
      簡易メモ: lengthOf(data.pt_quick_memos),
      問診: lengthOf(data.pt_intakes),
      アウトカム: lengthOf(data.pt_outcomes),
      契約書: contractIds.length,
      写真: Object.values(photosMeta).reduce((s, l) => s + l.length, 0),
    },
  }
}

export async function getContractSnapshots(ids: string[]): Promise<ContractSnapshot[]> {
  const out: ContractSnapshot[] = []
  for (const id of ids.slice(0, 20)) {
    if (!/^[A-Za-z0-9_-]{6,64}$/.test(id)) continue
    const snap = await kvGet<ContractSnapshot>(`kcdoc:${id}`)
    if (snap) out.push(snap)
  }
  return out
}

export async function listMonthlyBackups(): Promise<BackupIndexEntry[]> {
  const index = (await kvGet<BackupIndexEntry[]>(INDEX_KEY)) ?? []
  return [...index].sort((a, b) => b.ym.localeCompare(a.ym))
}

export async function getMonthlyBackup(ym: string): Promise<CoreBackup | null> {
  if (!/^\d{4}-\d{2}$/.test(ym)) return null
  return kvGet<CoreBackup>(`backup:${ym}`)
}

/**
 * その月の控えを作る。force=false なら、すでにあれば作らない（毎日の確認から）。
 * force=true（院長の「今すぐクラウドに控える」）なら、その月の控えを今の中身で作りなおす
 */
export async function saveMonthlyBackup(
  now: Date = new Date(),
  force = false,
): Promise<{ ym: string; status: 'saved' | 'exists'; counts?: Record<string, number> }> {
  const ym = jstYm(now)
  const index = (await kvGet<BackupIndexEntry[]>(INDEX_KEY)) ?? []
  if (!force && index.some((e) => e.ym === ym)) return { ym, status: 'exists' }

  const core = await buildCoreBackup(now)
  const chars = JSON.stringify(core).length
  await kvSet(`backup:${ym}`, core)

  const next = [...index.filter((e) => e.ym !== ym), { ym, createdAt: core.createdAt, chars, counts: core.counts }].sort((a, b) =>
    b.ym.localeCompare(a.ym),
  )
  const keep = next.slice(0, KEEP_MONTHS)
  for (const old of next.slice(KEEP_MONTHS)) {
    try {
      await kvDelete(`backup:${old.ym}`)
    } catch {
      // 古い控えが消せなくても、新しい控えは残す
    }
  }
  await kvSet(INDEX_KEY, keep)
  return { ym, status: 'saved', counts: core.counts }
}
