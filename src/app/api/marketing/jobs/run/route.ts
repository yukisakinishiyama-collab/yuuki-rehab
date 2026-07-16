/**
 * ジョブ実行エンドポイント（指示書13章）
 *
 * - Vercel Cron（vercel.json）から10分ごとに呼ばれる
 * - 管理画面の「今すぐ実行」からも呼べる
 * - CRON_SECRET 設定時は Authorization: Bearer で保護
 */
import { NextRequest, NextResponse } from 'next/server'
import { dueJobs, recordAttempt, updateJob } from '@/lib/marketing/jobs-store-server'
import { publishToChannel } from '@/lib/marketing/publishers'

export const maxDuration = 120

async function run() {
  const jobs = dueJobs()
  const results: Array<{ id: string; channel: string; outcome: string }> = []

  for (const job of jobs) {
    // 二重実行防止: processingに遷移できたジョブだけ処理する
    const locked = updateJob(job.id, (j) => {
      if (j.status === 'pending') j.status = 'processing'
    })
    if (!locked || locked.status !== 'processing') continue

    try {
      const outcome = await publishToChannel(job.channel, job.content)
      if (outcome.kind === 'published') {
        recordAttempt(job.id, true, outcome.message, outcome.url)
        results.push({ id: job.id, channel: job.channel, outcome: 'published' })
      } else if (outcome.kind === 'action_required') {
        updateJob(job.id, (j) => {
          j.status = 'action_required'
          j.actionReason = outcome.reason
          j.attempts.push({ at: new Date().toISOString(), ok: false, message: `手動対応が必要: ${outcome.reason}` })
        })
        results.push({ id: job.id, channel: job.channel, outcome: 'action_required' })
      } else {
        recordAttempt(job.id, false, outcome.message)
        results.push({ id: job.id, channel: job.channel, outcome: 'retry_scheduled' })
      }
    } catch (error) {
      recordAttempt(job.id, false, error instanceof Error ? error.message : '不明なエラー')
      results.push({ id: job.id, channel: job.channel, outcome: 'retry_scheduled' })
    }
  }

  return { ok: true, processed: results.length, results }
}

function authorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return true // ローカル・未設定時は開放（本番設定手順で必須化を案内）
  return request.headers.get('authorization') === `Bearer ${secret}`
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  return NextResponse.json(await run())
}

export async function POST(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  return NextResponse.json(await run())
}
