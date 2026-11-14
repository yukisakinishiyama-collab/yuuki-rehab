/**
 * ジョブ実行エンドポイント（指示書13章）
 *
 * - Vercel Cron（vercel.json。日本時間6〜21時は1時間ごと）と GitHub Actions（15分ごとの設定だが、実際は数時間に1回）から呼ばれる。
 *   Vercel の Cron は、予定の時刻から1時間ほどの幅でずれることがある（2026-11-13：18:00 の投稿が 18:34 に出た）
 * - 管理画面の「今すぐ実行」からも呼べる（管理者のBasic認証で許可）
 * - CRON_SECRET 設定時は Authorization: Bearer で保護
 * - 自動投稿（autopilot）のジョブが手動対応になったら、本文と「投稿した」ボタンを院長のLINEへ送る
 * - LINE連携の方への前日のお知らせ（日本時間10〜20時。明日の予約の控えの分。送り済みはすぐ終わる）
 * - YouTube・TikTok の動画：Buffer に渡した投稿が出たかを確かめる／前日に見本と「承認して投稿」ボタンを院長のLINEへ
 * - Google の投稿：Google の審査で拒否されていないかを確かめ、拒否なら「公開失敗」にして院長のLINEへ（gbp-posts-server.ts）
 */
import { NextRequest, NextResponse } from 'next/server'
import { refreshInstagramTokenIfNeeded } from '@/lib/marketing/instagram-token'
import { dueJobs, type PublishJob } from '@/lib/marketing/jobs-store-server'
import { runOneJob } from '@/lib/marketing/job-runner'
import { cronOrAdmin } from '@/lib/marketing/auth'
import { nudgeManualPosts } from '@/lib/marketing/autopilot-server'

export const maxDuration = 300

async function run() {
  const startedAt = Date.now()
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

  // YouTube・TikTok の動画：Buffer に渡した投稿が出たかを確かめる。出せなかったものは手で投稿できるよう、LINEへ届ける
  let buffer: unknown = null
  try {
    const { checkBufferPromoPosts } = await import('@/lib/marketing/promo-video-server')
    const checked = await checkBufferPromoPosts()
    manual.push(...checked.failed)
    buffer = { checked: checked.checked, sent: checked.sent, failed: checked.failed.length }
  } catch (error) {
    console.error('Bufferの投稿の確認に失敗:', error instanceof Error ? error.message : error)
  }

  // Google の投稿：受け取ってもらえても、あとで Google の審査で拒否されることがある。結果を確かめ、拒否は院長のLINEへ
  let google: unknown = null
  try {
    const { checkGooglePosts, notifyGoogleRejections } = await import('@/lib/marketing/gbp-posts-server')
    const checked = await checkGooglePosts()
    const notified = await notifyGoogleRejections(checked)
    google = { checked: checked.checked, live: checked.live, rejected: checked.rejected.length, outside: checked.outside.length, notified }
  } catch (error) {
    console.error('Googleの投稿の確認に失敗:', error instanceof Error ? error.message : error)
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

  // LINE連携の方への前日のお知らせ（2026-11-05 院長の依頼。時間外・送り済みはすぐ終わる）
  // 動画の見本づくり（時間がかかる）より先に行う
  let lineReminders: unknown = null
  try {
    const { runLineReminders } = await import('@/lib/marketing/line-reservation-server')
    lineReminders = await runLineReminders()
  } catch (error) {
    console.error('前日のお知らせに失敗:', error instanceof Error ? error.message : error)
  }

  // YouTube・TikTok の動画：投稿の前日に、見本の動画と「承認して投稿」ボタンを院長のLINEへ（見本は1回に1本まで作る）
  let approvals: unknown = null
  try {
    const { requestPromoApprovals } = await import('@/lib/marketing/promo-video-server')
    approvals = await requestPromoApprovals({ deadlineMs: startedAt + 150_000 })
  } catch (error) {
    console.error('動画の承認のお願いに失敗:', error instanceof Error ? error.message : error)
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

  return { ok: true, processed: results.length, results, nudged, lineReminders, buffer, google, approvals, aiVideos }
}

export async function GET(request: NextRequest) {
  if (!cronOrAdmin(request)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  return NextResponse.json(await run())
}

export async function POST(request: NextRequest) {
  if (!cronOrAdmin(request)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  return NextResponse.json(await run())
}
