/**
 * ジョブ実行エンドポイント（指示書13章）
 *
 * - GitHub Actions（15分ごと）と Vercel Cron（1日1回）から呼ばれる
 * - 管理画面の「今すぐ実行」からも呼べる（管理者のBasic認証で許可）
 * - CRON_SECRET 設定時は Authorization: Bearer で保護
 * - 自動投稿（autopilot）のジョブが手動対応になったら、本文と「投稿した」ボタンを院長のLINEへ送る
 * - LINE連携の方への前日のお知らせ（日本時間10〜20時。明日の予約の控えの分。送り済みはすぐ終わる）
 */
import { NextRequest, NextResponse } from 'next/server'
import { refreshInstagramTokenIfNeeded } from '@/lib/marketing/instagram-token'
import { dueJobs, type PublishJob } from '@/lib/marketing/jobs-store-server'
import { runOneJob } from '@/lib/marketing/job-runner'
import { cronOrAdmin } from '@/lib/marketing/auth'
import { nudgeManualPosts } from '@/lib/marketing/autopilot-server'

export const maxDuration = 300

async function run() {
  // IGトークンの定期延長（60日期限対策）。失敗してもジョブ処理は続行する
  await refreshInstagramTokenIfNeeded()

  const jobs = await dueJobs()
  const results: Array<{ id: string; channel: string; outcome: string }> = []
  const manual: PublishJob[] = []

  for (const job of jobs) {
    // 1件ずつ実行（pending → processing に移せたものだけ。二重実行を防ぐ）
    const r = await runOneJob(job)
    if (!r.ran) continue
    // キャンセルで空いた枠のストーリー（時間帯の外で、あとで出すことにしたもの・やり直し）は、結果を院長のLINEへ
    if (job.idempotencyKey.startsWith('cancel-story:')) {
      try {
        const { reportCancelStory } = await import('@/lib/marketing/cancel-story-server')
        await reportCancelStory(job, r)
      } catch (error) {
        console.error('キャンセルのストーリーのお知らせに失敗:', error instanceof Error ? error.message : error)
      }
    }
    if (r.outcome === 'action_required' && r.job) manual.push(r.job)
    results.push({ id: job.id, channel: job.channel, outcome: r.outcome })
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

  // AI動画: 作成中のものの片付けだけ行う。自動で作り始めるのは止めている（2026-10-29 院長の指示）。
  // 作るときは動画ストックの「1本作る」ボタンから。再開するときは allowAutoStart を true に戻す
  let aiVideos: unknown = null
  try {
    const { tickAiVideos } = await import('@/lib/marketing/ai-video-server')
    aiVideos = await tickAiVideos({ allowAutoStart: false })
  } catch (error) {
    console.error('AI動画の処理に失敗:', error instanceof Error ? error.message : error)
  }

  // LINE連携の方への前日のお知らせ（2026-11-05 院長の依頼。時間外・送り済みはすぐ終わる）
  let lineReminders: unknown = null
  try {
    const { runLineReminders } = await import('@/lib/marketing/line-reservation-server')
    lineReminders = await runLineReminders()
  } catch (error) {
    console.error('前日のお知らせに失敗:', error instanceof Error ? error.message : error)
  }

  return { ok: true, processed: results.length, results, nudged, aiVideos, lineReminders }
}

export async function GET(request: NextRequest) {
  if (!cronOrAdmin(request)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  return NextResponse.json(await run())
}

export async function POST(request: NextRequest) {
  if (!cronOrAdmin(request)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  return NextResponse.json(await run())
}
