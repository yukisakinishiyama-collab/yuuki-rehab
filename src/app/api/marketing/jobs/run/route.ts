/**
 * ジョブ実行エンドポイント（指示書13章）
 *
 * - GitHub Actions（15分ごと）と Vercel Cron（1日1回）から呼ばれる
 * - 管理画面の「今すぐ実行」からも呼べる（管理者のBasic認証で許可）
 * - CRON_SECRET 設定時は Authorization: Bearer で保護
 * - 自動投稿（autopilot）のジョブが手動対応になったら、本文と「投稿した」ボタンを院長のLINEへ送る
 */
import { NextRequest, NextResponse } from 'next/server'
import { refreshInstagramTokenIfNeeded } from '@/lib/marketing/instagram-token'
import { dueJobs, recordAttempt, updateJob, type PublishJob } from '@/lib/marketing/jobs-store-server'
import { publishToChannel } from '@/lib/marketing/publishers'
import { cronOrAdmin } from '@/lib/marketing/auth'
import { nudgeManualPosts } from '@/lib/marketing/autopilot-server'

export const maxDuration = 120

async function run() {
  // IGトークンの定期延長（60日期限対策）。失敗してもジョブ処理は続行する
  await refreshInstagramTokenIfNeeded()

  const jobs = await dueJobs()
  const results: Array<{ id: string; channel: string; outcome: string }> = []
  const manual: PublishJob[] = []

  for (const job of jobs) {
    // 二重実行防止: processingに遷移できたジョブだけ処理する
    const locked = await updateJob(job.id, (j) => {
      if (j.status === 'pending') j.status = 'processing'
    })
    if (!locked || locked.status !== 'processing') continue

    try {
      const outcome = await publishToChannel(job.channel, job.content)
      if (outcome.kind === 'published') {
        await recordAttempt(job.id, true, outcome.message, outcome.url)
        results.push({ id: job.id, channel: job.channel, outcome: 'published' })
      } else if (outcome.kind === 'action_required') {
        const updated = await updateJob(job.id, (j) => {
          j.status = 'action_required'
          j.actionReason = outcome.reason
          j.manualUrl = outcome.manualUrl
          j.attempts.push({ at: new Date().toISOString(), ok: false, message: `手動対応が必要: ${outcome.reason}` })
        })
        if (updated) manual.push(updated)
        results.push({ id: job.id, channel: job.channel, outcome: 'action_required' })
      } else if (outcome.kind === 'skipped') {
        // 出す必要がなくなった（ストーリーの時刻に空きが無いなど）。やり直さない
        await updateJob(job.id, (j) => {
          j.status = 'cancelled'
          j.actionReason = outcome.message
          j.attempts.push({ at: new Date().toISOString(), ok: true, message: outcome.message })
        })
        results.push({ id: job.id, channel: job.channel, outcome: 'skipped' })
      } else {
        await recordAttempt(job.id, false, outcome.message)
        results.push({ id: job.id, channel: job.channel, outcome: 'retry_scheduled' })
      }
    } catch (error) {
      await recordAttempt(job.id, false, error instanceof Error ? error.message : '不明なエラー')
      results.push({ id: job.id, channel: job.channel, outcome: 'retry_scheduled' })
    }
  }

  // 手動で投稿する媒体は、院長のLINEへ本文を届ける（失敗してもジョブ処理の結果は返す）
  let nudged = 0
  if (manual.length > 0) {
    try {
      nudged = await nudgeManualPosts(manual)
    } catch (error) {
      console.error('手動投稿のお知らせに失敗:', error instanceof Error ? error.message : error)
    }
  }

  // AI動画（週2本）: 作成中のものを取りに行き、月・木の朝なら1本作り始める。失敗しても投稿の結果は返す
  let aiVideos: unknown = null
  try {
    const { tickAiVideos } = await import('@/lib/marketing/ai-video-server')
    aiVideos = await tickAiVideos({ allowAutoStart: true })
  } catch (error) {
    console.error('AI動画の処理に失敗:', error instanceof Error ? error.message : error)
  }

  return { ok: true, processed: results.length, results, nudged, aiVideos }
}

export async function GET(request: NextRequest) {
  if (!cronOrAdmin(request)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  return NextResponse.json(await run())
}

export async function POST(request: NextRequest) {
  if (!cronOrAdmin(request)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  return NextResponse.json(await run())
}
