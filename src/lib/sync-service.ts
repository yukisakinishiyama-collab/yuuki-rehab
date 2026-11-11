'use client'
// ──────────────────────────────────────────────
// クラウド同期サービス（端末の localStorage ↔ クラウド）
//
// - 保存すると1.5秒後に、変わったところだけをクラウドへ送る（sync-merge の差分）
// - カルテの画面を開いている間は、15秒ごとにクラウドが変わっていないか確かめ、変わっていれば取り込む
//   （受付のPCで書いた記録が、施術室のタブレットに15秒ほどで出る）
// - 「すぐに反映する」ボタンは syncNow() をすぐ呼ぶ
// - 取り込んだときは window に 'karte-synced' を知らせる。画面はそれを聞いて読み直す
//
// 前回そろえたときの形（base）とクラウドの版（cloudAt）は、端末だけの印 sync_meta に持つ（同期しない）。
// ──────────────────────────────────────────────
import { applyOps, baseMapOf, diffKey, type BaseMap, type KeyOp } from './sync-merge'

const SYNC_SECRET = process.env.NEXT_PUBLIC_SYNC_SECRET ?? ''
const SYNC_ENDPOINT = '/api/sync'
const META_KEY = 'sync_meta'

// 同期から除外するキー（一時データ・認証情報・同期の印）
// featureFlags は「この端末だけ機能を止める」ための避難ハッチなので同期しない
// （同期すると起動時プルでOFFが巻き戻る／1端末のOFFが全端末へ波及してしまう）
const EXCLUDE_KEYS = ['rehabStore_session', 'pt_initialized', 'featureFlags', META_KEY]

export const LIVE_SYNC_INTERVAL_MS = 15_000
export const SYNCED_EVENT = 'karte-synced'

interface SyncMeta {
  cloudAt: string | null
  base: BaseMap
}

export type SyncState = 'idle' | 'syncing' | 'error' | 'off'
export interface SyncStatus {
  state: SyncState
  /** 最後にクラウドとそろった時刻（ISO） */
  lastSyncedAt: string | null
  message: string
}

let status: SyncStatus = { state: SYNC_SECRET ? 'idle' : 'off', lastSyncedAt: null, message: '' }
const listeners = new Set<(s: SyncStatus) => void>()

function setStatus(next: Partial<SyncStatus>) {
  status = { ...status, ...next }
  for (const fn of listeners) fn(status)
}

export function getSyncStatus(): SyncStatus {
  return status
}

export function subscribeSyncStatus(fn: (s: SyncStatus) => void): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

// ── 端末の中身 ─────────────────────────────────

function readLocal(): Record<string, string> {
  const out: Record<string, string> = {}
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (!key || EXCLUDE_KEYS.includes(key)) continue
    const val = localStorage.getItem(key)
    if (val != null) out[key] = val
  }
  return out
}

function loadMeta(): SyncMeta | null {
  try {
    const raw = localStorage.getItem(META_KEY)
    if (!raw) return null
    const meta = JSON.parse(raw) as SyncMeta
    return meta && typeof meta === 'object' && meta.base && typeof meta.base === 'object' ? meta : null
  } catch {
    return null
  }
}

function saveMeta(meta: SyncMeta) {
  try {
    localStorage.setItem(META_KEY, JSON.stringify(meta))
  } catch {
    // 端末の容量がいっぱいでも、同期の印が残らないだけ（次回は取り込みからやり直す）
  }
}

/**
 * クラウドの中身（data）に、まだ送っていない端末の変更（pending）を重ねて端末へ書く。
 * 変わったキーの一覧を返す
 */
function writeMerged(data: Record<string, string>, pending: KeyOp[], prevBase: BaseMap | null): string[] {
  const merged = applyOps(data, pending)
  const local = readLocal()
  const changed: string[] = []
  for (const [key, value] of Object.entries(merged)) {
    if (local[key] !== value) {
      localStorage.setItem(key, value)
      changed.push(key)
    }
  }
  // 前にそろえたことがあり、クラウドから消えたキーは端末からも消す（端末で変えていたものは pending で残る）
  if (prevBase) {
    for (const key of Object.keys(local)) {
      if (!(key in merged) && key in prevBase) {
        localStorage.removeItem(key)
        changed.push(key)
      }
    }
  }
  return changed
}

// 前回そろえたときの文字列（このページを開いている間だけ）。同じ文字列のキーは比べずに飛ばす（15秒ごとの確認を軽く）
const lastRaw = new Map<string, string>()

function rememberBase(data: Record<string, string>) {
  lastRaw.clear()
  for (const [k, v] of Object.entries(data)) lastRaw.set(k, v)
}

/** 端末の今の中身と base を比べて、送る変更を作る */
function pendingOps(local: Record<string, string>, base: BaseMap): KeyOp[] {
  const ops: KeyOp[] = []
  const keys = new Set([...Object.keys(local), ...Object.keys(base)])
  for (const key of keys) {
    const value = key in local ? local[key] : null
    if (value != null && key in base && lastRaw.get(key) === value) continue
    const op = diffKey(key, value, base[key])
    if (op) ops.push(op)
  }
  return ops
}

function announce(keys: string[]) {
  if (keys.length === 0) return
  window.dispatchEvent(new CustomEvent(SYNCED_EVENT, { detail: { keys } }))
}

// ── クラウドとのやりとり ─────────────────────────

async function fetchCloud(since: string | null): Promise<
  { unchanged: true; updatedAt: string | null } | { unchanged: false; data: Record<string, string>; updatedAt: string | null } | null
> {
  try {
    const url = since ? `${SYNC_ENDPOINT}?since=${encodeURIComponent(since)}` : SYNC_ENDPOINT
    const res = await fetch(url, { headers: { 'x-sync-secret': SYNC_SECRET }, cache: 'no-store' })
    if (!res.ok) return null
    const body = (await res.json()) as { unchanged?: boolean; data?: unknown; updated_at?: string | null }
    if (body.unchanged) return { unchanged: true, updatedAt: body.updated_at ?? null }
    if (!body.data || typeof body.data !== 'object') return null
    const data: Record<string, string> = {}
    for (const [k, v] of Object.entries(body.data as Record<string, unknown>)) {
      if (typeof v === 'string' && !EXCLUDE_KEYS.includes(k)) data[k] = v
    }
    return { unchanged: false, data, updatedAt: body.updated_at ?? null }
  } catch {
    return null
  }
}

async function sendOps(ops: KeyOp[], baseAt: string | null): Promise<{ updatedAt: string; prevAt: string | null } | null> {
  try {
    const res = await fetch(SYNC_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-sync-secret': SYNC_SECRET },
      body: JSON.stringify({ v: 2, ops, baseAt }),
    })
    if (!res.ok) return null
    const body = (await res.json()) as { updatedAt?: string; prevAt?: string | null }
    return body.updatedAt ? { updatedAt: body.updatedAt, prevAt: body.prevAt ?? null } : null
  } catch {
    return null
  }
}

// ── 1回の同期 ──────────────────────────────────

export interface SyncResult {
  ok: boolean
  /** 端末の中身が変わったキー（クラウドから取り込んだもの） */
  changedKeys: string[]
  /** 送った変更の数 */
  sent: number
}

let running: Promise<SyncResult> | null = null
let again = false

async function runOnce(): Promise<SyncResult> {
  if (!SYNC_SECRET) return { ok: false, changedKeys: [], sent: 0 }
  setStatus({ state: 'syncing', message: '' })
  let meta = loadMeta()

  // 初めて（またはそろえた印が無い端末）：今までどおりクラウドの中身を取り込んでから始める
  if (!meta) {
    const cloud = await fetchCloud(null)
    if (!cloud || cloud.unchanged) {
      setStatus({ state: 'error', message: 'クラウドに届きませんでした' })
      return { ok: false, changedKeys: [], sent: 0 }
    }
    const changed = writeMerged(cloud.data, [], null)
    meta = { cloudAt: cloud.updatedAt, base: baseMapOf(cloud.data) }
    saveMeta(meta)
    rememberBase(cloud.data)
    announce(changed)
    // 端末にしか無いキー（クラウドに無いもの）は、続けて送る
    const rest = await runSteady(meta)
    return { ok: rest.ok, changedKeys: [...changed, ...rest.changedKeys], sent: rest.sent }
  }
  return runSteady(meta)
}

async function runSteady(meta: SyncMeta): Promise<SyncResult> {
  let sent = 0
  let needFull = false
  const localAtDiff = readLocal()
  const ops = pendingOps(localAtDiff, meta.base)

  if (ops.length > 0) {
    const res = await sendOps(ops, meta.cloudAt)
    if (!res) {
      // 送れなかったときは取り込まない（取り込むと、まだ送っていない変更を上書きしてしまう）
      setStatus({ state: 'error', message: 'クラウドに保存できませんでした（通信を確かめてください）' })
      return { ok: false, changedKeys: [], sent: 0 }
    }
    sent = ops.length
    if (res.prevAt === meta.cloudAt) {
      // ほかの端末の変更は無かった：クラウド＝送ったときの端末の中身
      meta = { cloudAt: res.updatedAt, base: baseMapOf(localAtDiff) }
      saveMeta(meta)
      rememberBase(localAtDiff)
      setStatus({ state: 'idle', lastSyncedAt: new Date().toISOString(), message: '' })
      return { ok: true, changedKeys: [], sent }
    }
    // ほかの端末も書いていた：クラウドの全体を取り込みなおす
    needFull = true
  }

  const cloud = await fetchCloud(needFull ? null : meta.cloudAt)
  if (!cloud) {
    setStatus({ state: 'error', message: 'クラウドに届きませんでした' })
    return { ok: false, changedKeys: [], sent }
  }
  if (cloud.unchanged) {
    setStatus({ state: 'idle', lastSyncedAt: new Date().toISOString(), message: '' })
    return { ok: true, changedKeys: [], sent }
  }
  // 取り込むあいだに端末で書いた分（まだ送っていない変更）は、クラウドの上に重ねて残す
  const pending = pendingOps(readLocal(), meta.base)
  const changed = writeMerged(cloud.data, pending, meta.base)
  saveMeta({ cloudAt: cloud.updatedAt, base: baseMapOf(cloud.data) })
  rememberBase(cloud.data)
  setStatus({ state: 'idle', lastSyncedAt: new Date().toISOString(), message: '' })
  announce(changed)
  if (pending.length > 0) scheduleSync(300)
  return { ok: true, changedKeys: changed, sent }
}

/** いますぐクラウドとそろえる（送る→取り込む）。同時に呼ばれたら、今の分が終わってからもう1回だけ */
export function syncNow(): Promise<SyncResult> {
  if (running) {
    again = true
    return running
  }
  running = (async () => {
    try {
      let result = await runOnce()
      while (again) {
        again = false
        const next = await runOnce()
        result = { ok: next.ok, changedKeys: [...result.changedKeys, ...next.changedKeys], sent: result.sent + next.sent }
      }
      return result
    } finally {
      running = null
    }
  })()
  return running
}

// ── 今までの呼び方（ほかのファイルから使っている） ─────────────

/** クラウドへ送る（いまは差分を送って、ほかの端末の変更も取り込む） */
export async function pushToCloud(): Promise<boolean> {
  return (await syncNow()).ok
}

/** クラウドから取り込む（いまは送っていない変更を残したまま取り込む） */
export async function pullFromCloud(): Promise<boolean> {
  return (await syncNow()).ok
}

// 起動時の取り込み（このページを開いてから1回だけ。何か所から呼んでも同じ1回を待つ）
// カルテを自動で作る前に、これが終わるのを待つ（終わる前に作ると、取り込みで消えたり二重に作ったりするため）
let startupPull: Promise<{ ok: boolean; changed: boolean }> | null = null

export function pullAtStartup(): Promise<{ ok: boolean; changed: boolean }> {
  if (!startupPull) {
    startupPull = (async () => {
      if (!SYNC_SECRET) return { ok: false, changed: false }
      const before = localStorage.getItem('pt_patients')
      const result = await syncNow()
      return { ok: result.ok, changed: result.ok && before !== localStorage.getItem('pt_patients') }
    })()
  }
  return startupPull
}

// 保存後に呼ぶ（デバウンス付き）
let debounceTimer: ReturnType<typeof setTimeout> | null = null

export function scheduleSync(delayMs = 1500): void {
  if (!SYNC_SECRET) return
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    debounceTimer = null
    void syncNow()
  }, delayMs)
}

/**
 * カルテの画面を開いている間、15秒ごとにクラウドとそろえる。
 * 画面が隠れている（別のアプリ・別のタブ）ときは止め、戻ってきたらすぐそろえる。止める関数を返す
 */
export function startLiveSync(intervalMs = LIVE_SYNC_INTERVAL_MS): () => void {
  if (!SYNC_SECRET || typeof window === 'undefined') return () => {}
  const tick = () => {
    if (document.visibilityState === 'visible' && !debounceTimer) void syncNow()
  }
  const timer = setInterval(tick, intervalMs)
  const onVisible = () => {
    if (document.visibilityState === 'visible') void syncNow()
  }
  document.addEventListener('visibilitychange', onVisible)
  window.addEventListener('online', onVisible)
  return () => {
    clearInterval(timer)
    document.removeEventListener('visibilitychange', onVisible)
    window.removeEventListener('online', onVisible)
  }
}

// 同期が設定済みか確認
export function isSyncEnabled(): boolean {
  return Boolean(SYNC_SECRET)
}
