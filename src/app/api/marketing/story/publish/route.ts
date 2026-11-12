/**
 * 「今の空きでストーリー画像を作る」から、そのままInstagramのストーリーに出す（院長のみ）
 *
 * POST { range: 'today' | 'next' | 'week' }
 * - 出す瞬間に予約システムから空きを取り直して画像を作り直す（画面で見た画像と時刻がずれても、出すのは最新の空き）
 * - 案内できる空きが無ければ出さない（どこも「いっぱい」か休診）
 * - 公開は自動投稿と同じ処理（publishers.ts の instagram_story）。Instagram未接続なら手動投稿の案内を返す
 * - 「投稿の予定と結果」に残すため、ジョブとして記録する。同じ分に2回押しても二重には出さない
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/marketing/auth'
import { fetchHubStatsFast } from '@/lib/marketing/booking-stats-fast'
import { jstParts, storyRange } from '@/lib/marketing/autopilot-planner'
import { buildStory, sanitizeStoryEdits, storyEditsProblem } from '@/lib/marketing/story-server'
import { DEFAULT_CLINIC_PROFILE } from '@/lib/marketing/clinic'
import { createJob, recordAttempt, updateJob } from '@/lib/marketing/jobs-store-server'
import { publishToChannel } from '@/lib/marketing/publishers'
import type { GeneratedContent } from '@/lib/marketing/types'

export const dynamic = 'force-dynamic'
// Instagram が画像を取り込み終わるのを待つため、少し長めに
export const maxDuration = 120

const RANGES = ['today', 'next', 'week'] as const
type Range = (typeof RANGES)[number]

export async function POST(request: NextRequest) {
  const denied = requireAdmin(request)
  if (denied) return denied

  const body = (await request.json().catch(() => ({}))) as { range?: string; edits?: unknown }
  const range = RANGES.includes(body.range as Range) ? (body.range as Range) : null
  if (!range) return NextResponse.json({ error: 'range は today・next・week のどれかです' }, { status: 400 })
  // 画面で直したところ（見出し・ひとこと・出さない時間・残り枠の数を出すか）
  const edits = sanitizeStoryEdits(body.edits)
  const problem = storyEditsProblem(edits)
  if (problem) return NextResponse.json({ error: problem }, { status: 422 })

  const openings = (await fetchHubStatsFast(1, { force: true }))?.openings ?? []
  if (openings.length === 0) return NextResponse.json({ error: '予約システムから空きを受け取れませんでした' }, { status: 502 })

  const now = jstParts(new Date())
  const r = storyRange(range, openings, now.date)
  const built = buildStory(openings, r.dates, r.scope, now.local, r.title, edits)
  if (built.rows.length === 0) return NextResponse.json({ error: '載せられる日がありません（休診の日など）' }, { status: 404 })
  if (!built.hasOpening) {
    return NextResponse.json({ error: '案内できる空きが無いため、ストーリーには出しませんでした（どこも「いっぱい」か休診です）' }, { status: 409 })
  }

  const text = { title: built.title, body: built.body }
  const content: GeneratedContent = {
    title: text.title,
    hook: text.title,
    body: text.body,
    cta: { label: '予約', url: DEFAULT_CLINIC_PROFILE.reserveUrl },
    hashtags: [],
    warnings: ['院内アプリの「今の空きでストーリー画像を作る」から院長が出したストーリー（予約システムの空きから作る定型の画像）'],
    story: {
      scope: r.scope,
      dates: r.dates,
      snapshot: openings.filter((o) => r.dates.includes(o.date)).map((o) => ({ date: o.date, closed: o.closed, am: o.am, pm: o.pm })),
      title: r.title,
      edits,
    },
  }

  const { job, duplicated } = await createJob({
    idempotencyKey: `story-manual:${range}:${now.local.slice(0, 16)}`,
    projectId: 'manual-story',
    variantId: `manual-story-${range}`,
    channel: 'instagram_story',
    theme: text.title,
    content,
    scheduledAt: new Date().toISOString(),
  })
  if (duplicated) {
    return NextResponse.json(
      { error: 'いま出したところです（同じ分に2回は出しません）。少し待ってから「投稿の予定と結果」で確かめてください', publishedUrl: job.publishedUrl },
      { status: 409 },
    )
  }
  // 15分ごとの定期実行が同じジョブを拾わないよう、すぐに処理中にする
  await updateJob(job.id, (j) => {
    j.status = 'processing'
  })

  try {
    const outcome = await publishToChannel('instagram_story', content)
    if (outcome.kind === 'published') {
      await recordAttempt(job.id, true, outcome.message, outcome.url)
      return NextResponse.json({ ok: true, message: outcome.message, url: outcome.url ?? null })
    }
    if (outcome.kind === 'action_required') {
      await updateJob(job.id, (j) => {
        j.status = 'action_required'
        j.actionReason = outcome.reason
        j.manualUrl = outcome.manualUrl
        j.attempts.push({ at: new Date().toISOString(), ok: false, message: `手動対応が必要: ${outcome.reason}` })
      })
      return NextResponse.json({ ok: false, manual: true, error: outcome.reason, manualUrl: outcome.manualUrl }, { status: 200 })
    }
    if (outcome.kind === 'skipped') {
      await updateJob(job.id, (j) => {
        j.status = 'cancelled'
        j.actionReason = outcome.message
        j.attempts.push({ at: new Date().toISOString(), ok: true, message: outcome.message })
      })
      return NextResponse.json({ error: outcome.message }, { status: 409 })
    }
    // 手で押した投稿は自動でやり直さない（同じストーリーが後から勝手に出ないように）
    await updateJob(job.id, (j) => {
      j.status = 'failed'
      j.attempts.push({ at: new Date().toISOString(), ok: false, message: outcome.message })
    })
    return NextResponse.json({ error: outcome.message }, { status: 502 })
  } catch (error) {
    const message = error instanceof Error ? error.message : '不明なエラー'
    console.error('[story/publish] ストーリーを出せませんでした', error)
    await updateJob(job.id, (j) => {
      j.status = 'failed'
      j.attempts.push({ at: new Date().toISOString(), ok: false, message })
    })
    return NextResponse.json({ error: `ストーリーを出せませんでした（${message.slice(0, 200)}）` }, { status: 500 })
  }
}
