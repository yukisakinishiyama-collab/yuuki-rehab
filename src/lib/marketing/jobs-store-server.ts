/**
 * 予約投稿ジョブのサーバー側ストア（指示書13章）
 *
 * - idempotency key による重複投稿防止
 * - リトライ（exponential backoff・最大5回）
 * - 全試行履歴の保存
 * 保存先はKVストア（Supabase設定時はPostgres・未設定時はローカルファイル）。
 * サーバーレス環境でもジョブが消えない。
 */
import { kvDelete, kvGet, kvList, kvSet } from './kv-store-server'
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

const KEY = (id: string) => `job:${id}`

/** ジョブ作成。同じidempotencyKeyがあれば新規作成せず既存を返す（重複投稿防止） */
export async function createJob(
  input: Omit<PublishJob, 'id' | 'status' | 'attempts' | 'maxAttempts' | 'createdAt' | 'updatedAt'>,
): Promise<{ job: PublishJob; duplicated: boolean }> {
  const jobs = await listJobs()
  const existing = jobs.find((j) => j.idempotencyKey === input.idempotencyKey && j.status !== 'cancelled')
  if (existing) {
    // 日時変更は既存ジョブの更新として扱う
    if (existing.status === 'pending' && existing.scheduledAt !== input.scheduledAt) {
      existing.scheduledAt = input.scheduledAt
      existing.updatedAt = new Date().toISOString()
      await kvSet(KEY(existing.id), existing)
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
  await kvSet(KEY(job.id), job)
  return { job, duplicated: false }
}

export async function listJobs(): Promise<PublishJob[]> {
  const rows = await kvList<PublishJob>('job:')
  return rows.map((r) => r.value).sort((a, b) => b.scheduledAt.localeCompare(a.scheduledAt))
}

export async function getJob(id: string): Promise<PublishJob | null> {
  return kvGet<PublishJob>(KEY(id))
}

export async function updateJob(id: string, updater: (job: PublishJob) => void): Promise<PublishJob | null> {
  const job = await kvGet<PublishJob>(KEY(id))
  if (!job) return null
  updater(job)
  job.updatedAt = new Date().toISOString()
  await kvSet(KEY(id), job)
  return job
}

export async function deleteJob(id: string): Promise<void> {
  await kvDelete(KEY(id))
}

/** 実行対象（予定時刻を過ぎたpending、リトライ待ちはnextAttemptAtも過ぎたもの） */
export async function dueJobs(now = new Date()): Promise<PublishJob[]> {
  const iso = now.toISOString()
  const local = toLocalIso(now)
  return (await listJobs()).filter(
    (j) => j.status === 'pending' && j.scheduledAt <= local && (!j.nextAttemptAt || j.nextAttemptAt <= iso),
  )
}

/** 試行結果を記録し、失敗時はexponential backoffで次回時刻を設定 */
export async function recordAttempt(
  id: string,
  ok: boolean,
  message: string,
  publishedUrl?: string,
): Promise<PublishJob | null> {
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
