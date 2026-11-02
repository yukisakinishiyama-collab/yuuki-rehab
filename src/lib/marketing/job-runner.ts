/**
 * 投稿ジョブを1件実行する（サーバー専用）
 *
 * 定期実行（/api/marketing/jobs/run）と、キャンセルのストーリーをすぐ出すとき（cancel-story-server.ts）の両方から使う。
 * 二重実行を防ぐため、pending → processing に移せたジョブだけを実行する。
 */
import { recordAttempt, updateJob, type PublishJob } from './jobs-store-server'
import { publishToChannel, type PublishOutcome } from './publishers'

export type JobRunResult =
  | { ran: false }
  | { ran: true; outcome: 'published' | 'action_required' | 'skipped' | 'retry_scheduled'; job: PublishJob | null; detail?: PublishOutcome }

export async function runOneJob(job: PublishJob): Promise<JobRunResult> {
  const locked = await updateJob(job.id, (j) => {
    if (j.status === 'pending') j.status = 'processing'
  })
  if (!locked || locked.status !== 'processing') return { ran: false }

  try {
    const outcome = await publishToChannel(locked.channel, locked.content)
    if (outcome.kind === 'published') {
      const updated = await recordAttempt(locked.id, true, outcome.message, outcome.url)
      return { ran: true, outcome: 'published', job: updated, detail: outcome }
    }
    if (outcome.kind === 'action_required') {
      const updated = await updateJob(locked.id, (j) => {
        j.status = 'action_required'
        j.actionReason = outcome.reason
        j.manualUrl = outcome.manualUrl
        j.attempts.push({ at: new Date().toISOString(), ok: false, message: `手動対応が必要: ${outcome.reason}` })
      })
      return { ran: true, outcome: 'action_required', job: updated, detail: outcome }
    }
    if (outcome.kind === 'skipped') {
      // 出す必要がなくなった（ストーリーの時刻に空きが無いなど）。やり直さない
      const updated = await updateJob(locked.id, (j) => {
        j.status = 'cancelled'
        j.actionReason = outcome.message
        j.attempts.push({ at: new Date().toISOString(), ok: true, message: outcome.message })
      })
      return { ran: true, outcome: 'skipped', job: updated, detail: outcome }
    }
    const updated = await recordAttempt(locked.id, false, outcome.message)
    return { ran: true, outcome: 'retry_scheduled', job: updated, detail: outcome }
  } catch (error) {
    const updated = await recordAttempt(locked.id, false, error instanceof Error ? error.message : '不明なエラー')
    return { ran: true, outcome: 'retry_scheduled', job: updated }
  }
}
