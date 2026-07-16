/**
 * 予約投稿ジョブのサーバー側ストア（指示書13章）
 *
 * - idempotency key による重複投稿防止
 * - リトライ（exponential backoff・最大5回）
 * - 全試行履歴の保存
 * Phase 3ではJSONファイル保存（.data/）。Supabase移行時も本モジュールの関数契約を維持する。
 */
import fs from 'node:fs'
import path from 'node:path'
import type { Channel, GeneratedContent } from './types'

export type JobStatus = 'pending' | 'processing' | 'published' | 'failed' | 'action_required' | 'cancelled'

export interface JobAttempt {
  at: string
  ok: boolean
  message: string
}

export interface PublishJob {
  id: string
  idempotencyKey: string
  projectId: string
  variantId: string
  channel: Channel
  theme: string
  content: GeneratedContent
  scheduledAt: string // ISO（Asia/Tokyoで入力された日時）
  status: JobStatus
  attempts: JobAttempt[]
  maxAttempts: number
  nextAttemptAt?: string
  publishedUrl?: string
  /** 手動投稿が必要な場合の理由（API未承認・画像未設定など） */
  actionReason?: string
  createdAt: string
  updatedAt: string
}

interface JobDb {
  jobs: PublishJob[]
}

function dbPath(): string {
  const local = path.join(process.cwd(), '.data')
  try {
    fs.mkdirSync(local, { recursive: true })
    return path.join(local, 'marketing-jobs.json')
  } catch {
    return path.join('/tmp', 'marketing-jobs.json')
  }
}

function load(): JobDb {
  try {
    return JSON.parse(fs.readFileSync(dbPath(), 'utf-8')) as JobDb
  } catch {
    return { jobs: [] }
  }
}

function save(db: JobDb) {
  fs.writeFileSync(dbPath(), JSON.stringify(db, null, 2))
}

/** ジョブ作成。同じidempotencyKeyがあれば新規作成せず既存を返す（重複投稿防止） */
export function createJob(
  input: Omit<PublishJob, 'id' | 'status' | 'attempts' | 'maxAttempts' | 'createdAt' | 'updatedAt'>,
): { job: PublishJob; duplicated: boolean } {
  const db = load()
  const existing = db.jobs.find((j) => j.idempotencyKey === input.idempotencyKey && j.status !== 'cancelled')
  if (existing) {
    // 日時変更は既存ジョブの更新として扱う
    if (existing.status === 'pending' && existing.scheduledAt !== input.scheduledAt) {
      existing.scheduledAt = input.scheduledAt
      existing.updatedAt = new Date().toISOString()
      save(db)
    }
    return { job: existing, duplicated: true }
  }
  const now = new Date().toISOString()
  const job: PublishJob = {
    ...input,
    id: crypto.randomUUID(),
    status: 'pending',
    attempts: [],
    maxAttempts: 5,
    createdAt: now,
    updatedAt: now,
  }
  db.jobs.unshift(job)
  save(db)
  return { job, duplicated: false }
}

export function listJobs(): PublishJob[] {
  return load().jobs.sort((a, b) => b.scheduledAt.localeCompare(a.scheduledAt))
}

export function getJob(id: string): PublishJob | undefined {
  return load().jobs.find((j) => j.id === id)
}

export function updateJob(id: string, updater: (job: PublishJob) => void): PublishJob | null {
  const db = load()
  const job = db.jobs.find((j) => j.id === id)
  if (!job) return null
  updater(job)
  job.updatedAt = new Date().toISOString()
  save(db)
  return job
}

/** 実行対象（予定時刻を過ぎたpending、リトライ待ちはnextAttemptAtも過ぎたもの） */
export function dueJobs(now = new Date()): PublishJob[] {
  const iso = now.toISOString()
  const local = toLocalIso(now)
  return load().jobs.filter(
    (j) =>
      j.status === 'pending' &&
      j.scheduledAt <= local &&
      (!j.nextAttemptAt || j.nextAttemptAt <= iso),
  )
}

/** 試行結果を記録し、失敗時はexponential backoffで次回時刻を設定 */
export function recordAttempt(id: string, ok: boolean, message: string, publishedUrl?: string): PublishJob | null {
  return updateJob(id, (job) => {
    job.attempts.push({ at: new Date().toISOString(), ok, message })
    if (ok) {
      job.status = 'published'
      job.publishedUrl = publishedUrl
      return
    }
    if (job.attempts.length >= job.maxAttempts) {
      job.status = 'failed'
      return
    }
    // 5分 → 10分 → 20分 → 40分
    const delayMinutes = 5 * 2 ** (job.attempts.length - 1)
    job.status = 'pending'
    job.nextAttemptAt = new Date(Date.now() + delayMinutes * 60 * 1000).toISOString()
  })
}

/** 予約日時（datetime-local形式）比較用に現在時刻をローカルISOへ */
function toLocalIso(date: Date): string {
  const offset = 9 * 60 // Asia/Tokyo固定（指示書13章）
  const local = new Date(date.getTime() + offset * 60 * 1000)
  return local.toISOString().slice(0, 16)
}
