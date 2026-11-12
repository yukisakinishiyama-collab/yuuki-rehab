'use client'
// ──────────────────────────────────────────────
// バックアップをパソコンに保存する（院長のパソコンの Chrome・Edge）
//
// - 最初に「保存先のフォルダを選ぶ」で、パソコンのフォルダ（例：ドキュメント\ゆうき整骨院_バックアップ）を決める
//   （ブラウザがフォルダを覚える。次からは選ばなくてよい）
// - 「パソコンに保存する」で、そのフォルダに次の2つを書く
//     ゆうき整骨院_アプリのバックアップ_YYYY-MM-DD_HHmm.json … カルテ全部・契約書（署名入りの本文）・写真の一覧
//     写真/患者さんのID/写真のID.jpg                       … 患部の写真（まだ無いものだけ足す）
// - フォルダを選べないブラウザ（スマホ・Safari など）では、ファイルのダウンロードになる
// - 「今日」の画面を開いたとき、許可が残っていれば1日1回だまって保存する（BackupReminder）
// ──────────────────────────────────────────────

const DB_NAME = 'yuuki-backup'
const STORE = 'kv'
const DIR_KEY = 'dir'
export const LAST_PC_BACKUP_KEY = 'backupLastPcAt'

// File System Access API（Chrome・Edge）の型（TypeScript の標準の型に無いぶん）
interface FsWritable {
  write(data: Blob | string): Promise<void>
  close(): Promise<void>
}
interface FsFileHandle {
  kind: 'file'
  createWritable(): Promise<FsWritable>
}
export interface FsDirHandle {
  kind: 'directory'
  name: string
  getDirectoryHandle(name: string, opts?: { create?: boolean }): Promise<FsDirHandle>
  getFileHandle(name: string, opts?: { create?: boolean }): Promise<FsFileHandle>
  queryPermission(opts: { mode: 'readwrite' }): Promise<PermissionState>
  requestPermission(opts: { mode: 'readwrite' }): Promise<PermissionState>
}
type PickerWindow = Window & {
  showDirectoryPicker?: (opts?: { id?: string; mode?: 'readwrite'; startIn?: string }) => Promise<FsDirHandle>
}

export function supportsFolder(): boolean {
  return typeof window !== 'undefined' && typeof (window as PickerWindow).showDirectoryPicker === 'function'
}

// ── フォルダを覚える（IndexedDB。localStorage には入れられないため） ─────────

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function idbGet<T>(key: string): Promise<T | undefined> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE, 'readonly').objectStore(STORE).get(key)
    req.onsuccess = () => resolve(req.result as T | undefined)
    req.onerror = () => reject(req.error)
  })
}

async function idbSet(key: string, value: unknown): Promise<void> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).put(value, key)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function getSavedFolder(): Promise<FsDirHandle | null> {
  if (!supportsFolder()) return null
  try {
    return (await idbGet<FsDirHandle>(DIR_KEY)) ?? null
  } catch {
    return null
  }
}

/** 保存先のフォルダを選ぶ（ボタンを押したときだけ呼べる） */
export async function chooseFolder(): Promise<FsDirHandle | null> {
  const picker = (window as PickerWindow).showDirectoryPicker
  if (!picker) return null
  const dir = await picker({ id: 'yuuki-backup', mode: 'readwrite', startIn: 'documents' })
  await idbSet(DIR_KEY, dir)
  return dir
}

/** フォルダに書いてよいか。interactive=true（ボタンから）なら、必要なときに許可を聞く */
export async function folderPermission(dir: FsDirHandle, interactive: boolean): Promise<boolean> {
  try {
    if ((await dir.queryPermission({ mode: 'readwrite' })) === 'granted') return true
    if (!interactive) return false
    return (await dir.requestPermission({ mode: 'readwrite' })) === 'granted'
  } catch {
    return false
  }
}

export function lastPcBackupAt(): string | null {
  try {
    return localStorage.getItem(LAST_PC_BACKUP_KEY)
  } catch {
    return null
  }
}

// ── バックアップの中身を集める ─────────────────────────

export interface BackupProgress {
  step: string
  done?: number
  total?: number
}

interface CoreBackup {
  format: string
  version: number
  createdAt: string
  karte: { updatedAt: string | null; data: Record<string, string> }
  photosMeta: Record<string, Array<{ id: string; storagePath: string }>>
  contractIds: string[]
  counts: Record<string, number>
}

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: 'no-store' })
  const body = (await res.json().catch(() => ({}))) as T & { error?: string }
  if (!res.ok) {
    if (res.status === 403) throw new Error('バックアップは院長（管理者）のパスワードで入ったときだけ作れます')
    throw new Error((body as { error?: string }).error ?? `読み込めませんでした（${res.status}）`)
  }
  return body
}

export async function collectBackup(onProgress?: (p: BackupProgress) => void): Promise<{ json: string; core: CoreBackup }> {
  onProgress?.({ step: 'カルテを集めています' })
  const core = await getJson<CoreBackup>('/api/backup?part=core')
  const contracts: unknown[] = []
  for (let i = 0; i < core.contractIds.length; i += 20) {
    onProgress?.({ step: '契約書を集めています', done: i, total: core.contractIds.length })
    const ids = core.contractIds.slice(i, i + 20).join(',')
    const res = await getJson<{ contracts: unknown[] }>(`/api/backup?part=contracts&ids=${encodeURIComponent(ids)}`)
    contracts.push(...res.contracts)
  }
  const full = {
    format: core.format,
    version: core.version,
    kind: 'full',
    createdAt: core.createdAt,
    note: 'ゆうき整骨院 院内アプリのバックアップ。karte.data は各端末の localStorage と同じ形（キー → JSON の文字列）。contracts は署名入りの契約書の本文。写真の画像は同じフォルダの「写真」にある',
    counts: core.counts,
    karte: core.karte,
    photosMeta: core.photosMeta,
    contracts,
  }
  return { json: JSON.stringify(full), core }
}

function stamp(d: Date): string {
  const j = new Date(d.getTime() + 9 * 3600 * 1000).toISOString()
  return `${j.slice(0, 10)}_${j.slice(11, 13)}${j.slice(14, 16)}`
}

export function backupFileName(d: Date = new Date()): string {
  return `ゆうき整骨院_アプリのバックアップ_${stamp(d)}.json`
}

async function writeFile(dir: FsDirHandle, name: string, data: Blob | string) {
  const fh = await dir.getFileHandle(name, { create: true })
  const w = await fh.createWritable()
  await w.write(data)
  await w.close()
}

async function exists(dir: FsDirHandle, name: string): Promise<boolean> {
  try {
    await dir.getFileHandle(name)
    return true
  } catch {
    return false
  }
}

/** 写真をフォルダの「写真/患者さんのID/」に足す（すでにあるものはそのまま）。足した枚数を返す */
async function savePhotos(dir: FsDirHandle, core: CoreBackup, onProgress?: (p: BackupProgress) => void): Promise<number> {
  const photos = Object.entries(core.photosMeta).flatMap(([pid, list]) => list.map((p) => ({ pid, ...p })))
  if (photos.length === 0) return 0
  const root = await dir.getDirectoryHandle('写真', { create: true })
  let added = 0
  for (let i = 0; i < photos.length; i++) {
    const p = photos[i]
    onProgress?.({ step: '写真を保存しています', done: i, total: photos.length })
    if (!/^[A-Za-z0-9_-]{1,64}\/[A-Za-z0-9_-]{1,64}\.jpg$/.test(p.storagePath)) continue
    const sub = await root.getDirectoryHandle(p.pid, { create: true })
    const file = p.storagePath.split('/')[1]
    if (await exists(sub, file)) continue
    const res = await fetch(`/api/karte/photos?path=${encodeURIComponent(p.storagePath)}`)
    if (!res.ok) continue
    await writeFile(sub, file, await res.blob())
    added += 1
  }
  return added
}

export interface SaveResult {
  ok: boolean
  where: 'folder' | 'download' | 'none'
  fileName?: string
  folderName?: string
  photosAdded?: number
  counts?: Record<string, number>
  error?: string
}

/**
 * バックアップを作ってパソコンに保存する。
 * interactive=true … ボタンから（フォルダの許可を聞ける・フォルダが無ければダウンロード）
 * interactive=false … 自動（許可が残っているフォルダがあるときだけ保存。無ければ何もしない）
 */
export async function saveBackupToPc(interactive: boolean, onProgress?: (p: BackupProgress) => void): Promise<SaveResult> {
  try {
    const dir = await getSavedFolder()
    const canFolder = dir ? await folderPermission(dir, interactive) : false
    if (!canFolder && !interactive) return { ok: false, where: 'none' }

    const { json, core } = await collectBackup(onProgress)
    const name = backupFileName()
    if (dir && canFolder) {
      onProgress?.({ step: 'パソコンのフォルダに書いています' })
      await writeFile(dir, name, new Blob([json], { type: 'application/json' }))
      const photosAdded = await savePhotos(dir, core, onProgress)
      localStorage.setItem(LAST_PC_BACKUP_KEY, new Date().toISOString())
      return { ok: true, where: 'folder', fileName: name, folderName: dir.name, photosAdded, counts: core.counts }
    }
    // フォルダを使えないとき：ふつうのダウンロード（写真の画像は入らない）
    const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }))
    const a = document.createElement('a')
    a.href = url
    a.download = name
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 10_000)
    localStorage.setItem(LAST_PC_BACKUP_KEY, new Date().toISOString())
    return { ok: true, where: 'download', fileName: name, counts: core.counts }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    if (/AbortError|aborted/i.test(msg)) return { ok: false, where: 'none', error: '取りやめました' }
    return { ok: false, where: 'none', error: msg }
  }
}
