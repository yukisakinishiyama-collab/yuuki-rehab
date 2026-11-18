/**
 * 画像レポート（ブラウザ側）
 *
 * - 院のパソコンで動く「読影プログラム」（tools/dicom-reader。http://127.0.0.1:8791）と話す。
 *   CDの読み込み・読影・PDF作りはすべてそのパソコンの中で行い、氏名などはAIに渡さない
 * - できたPDFを院内アプリの API（/api/karte/imaging。クラウドの非公開バケット）に送る
 *
 * 読影プログラムはそのパソコンでしか動かないので、スマホやほかのパソコンでは「読み取り」は出せない
 * （提出済みのレポートを見るのは、どの端末でもできる）。
 */
import type { CdPatient, ReaderResult } from './imaging'

export const READER_URL = 'http://127.0.0.1:8791'

export interface ReaderHealth {
  ok: boolean
  version: string
  /** Claude Code が入っているか・ログインしているか（null は確かめられなかった） */
  claude: boolean
  loggedIn: boolean | null
  /** PDFを作れるか（Chrome／Edge があるか） */
  pdf: boolean
  /** 動いている読影（無ければ null） */
  running: string | null
}

export interface ReaderSource {
  path: string
  label: string
  kind: 'cd' | 'usb' | 'folder'
}

export interface ReaderSeries {
  uid: string
  number: number
  modality: string
  description: string
  n: number
  /** 見本の画像（data:image/jpeg…）。氏名などの文字が写っていないかを見るため */
  thumbs: string[]
}

export interface ReaderStudy {
  uid: string
  date: string
  time: string
  description: string
  institution: string
  modalities: string[]
  modalities_ja: string[]
  n_images: number
  series: ReaderSeries[]
}

export interface ReaderScan {
  path: string
  patient: CdPatient
  several_patients: boolean
  studies: ReaderStudy[]
  n_files: number
}

export type ReaderJobStatus = 'queued' | 'running' | 'done' | 'error' | 'cancelled'

export interface ReaderJob {
  id: string
  status: ReaderJobStatus
  stage?: string
  created: string
  patientId: string
  /** 読影のときに伝えた主訴 */
  complaint?: string
  error?: string | null
  result?: ReaderResult | null
  log?: string[]
  warnings?: string[]
}

/**
 * 読影プログラム（このパソコンの 127.0.0.1）を呼ぶ。
 * Chrome・Edge は、https のページからパソコンの中（http://127.0.0.1）を呼ぶときに
 * 「このページがパソコンの中のアプリにつなぐこと」の許可をたずね、要求に targetAddressSpace: 'loopback' の指定を求める
 * （Local Network Access）。この指定を知らないブラウザ・古い版では、付けずにやり直す。
 */
async function readerFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const base: RequestInit = { ...init, mode: 'cors', cache: 'no-store' }
  try {
    return await fetch(`${READER_URL}${path}`, { ...base, targetAddressSpace: 'loopback' } as RequestInit)
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') throw e
    return fetch(`${READER_URL}${path}`, base)
  }
}

async function reader<T>(path: string, init?: RequestInit, timeoutMs = 20_000): Promise<T> {
  const ctl = new AbortController()
  const timer = setTimeout(() => ctl.abort(), timeoutMs)
  try {
    const res = await readerFetch(path, {
      ...init,
      headers: init?.body ? { 'Content-Type': 'application/json' } : undefined,
      signal: ctl.signal,
    })
    const data = (await res.json().catch(() => ({}))) as T & { error?: string }
    if (!res.ok) throw new Error(data.error ?? `読影プログラムがエラーを返しました（${res.status}）`)
    return data
  } finally {
    clearTimeout(timer)
  }
}

/** 読影プログラムが動いているか（動いていない・このパソコンに無いときは null） */
export async function readerHealth(): Promise<ReaderHealth | null> {
  try {
    return await reader<ReaderHealth>('/health', undefined, 4000)
  } catch {
    return null
  }
}

export async function readerSources(): Promise<ReaderSource[]> {
  return (await reader<{ sources: ReaderSource[] }>('/sources')).sources
}

/** CD（フォルダ）の中の検査と、入っている方を読む。画像が多いと数十秒かかる */
export function readerScan(path: string): Promise<ReaderScan> {
  return reader<ReaderScan>('/scan', { method: 'POST', body: JSON.stringify({ path }) }, 180_000)
}

export function readerStart(input: {
  path: string
  studies: string[]
  patient: { id: string; name: string; birthDate: string; gender: string }
  complaint: string
  question: string
  confirmedNoText: boolean
}): Promise<ReaderJob> {
  return reader<ReaderJob>('/jobs', { method: 'POST', body: JSON.stringify(input) })
}

export async function readerJobs(patientId: string): Promise<ReaderJob[]> {
  return (await reader<{ jobs: ReaderJob[] }>(`/jobs?patientId=${encodeURIComponent(patientId)}`)).jobs
}

export function readerJob(id: string): Promise<ReaderJob> {
  return reader<ReaderJob>(`/jobs/${encodeURIComponent(id)}`)
}

export async function readerCancel(id: string): Promise<void> {
  await reader(`/jobs/${encodeURIComponent(id)}/cancel`, { method: 'POST', body: '{}' })
}

export async function readerRemove(id: string): Promise<void> {
  await reader(`/jobs/${encodeURIComponent(id)}`, { method: 'DELETE' })
}

/** 下書きのPDF（このパソコンの中だけにある） */
export async function readerPdf(id: string): Promise<Blob> {
  const res = await readerFetch(`/jobs/${encodeURIComponent(id)}/pdf`)
  if (!res.ok) throw new Error('下書きのPDFを読めませんでした')
  const blob = await res.blob()
  return blob.type === 'application/pdf' ? blob : new Blob([blob], { type: 'application/pdf' })
}

// ── クラウド（院内アプリの API） ──

export async function uploadReportPdf(input: { patientId: string; reportId: string; blob: Blob }): Promise<{ storagePath: string; bytes: number }> {
  const form = new FormData()
  form.append('file', input.blob, `${input.reportId}.pdf`)
  form.append('patientId', input.patientId)
  form.append('reportId', input.reportId)
  const res = await fetch('/api/karte/imaging', { method: 'POST', body: form })
  const data = (await res.json().catch(() => ({}))) as { storagePath?: string; bytes?: number; error?: string }
  if (!res.ok || !data.storagePath) throw new Error(data.error ?? `HTTP ${res.status}`)
  return { storagePath: data.storagePath, bytes: data.bytes ?? input.blob.size }
}

export function reportUrl(storagePath: string, fileName?: string, download = false): string {
  const q = new URLSearchParams({ path: storagePath })
  if (fileName) q.set('name', fileName)
  if (download) q.set('download', '1')
  return `/api/karte/imaging?${q.toString()}`
}

export async function deleteReportFile(storagePath: string): Promise<void> {
  const res = await fetch(reportUrl(storagePath), { method: 'DELETE' })
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(data.error ?? `HTTP ${res.status}`)
  }
}
