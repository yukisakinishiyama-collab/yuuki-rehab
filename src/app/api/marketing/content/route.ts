/**
 * コンテンツの一覧（集客 → コンテンツ）。サーバーにあるものだけ返す
 * - 自動投稿の案（autopilot:week:…）… 承認待ち・期限切れ → 確認待ち（承認したものは投稿ジョブの側で出す）
 * - 投稿ジョブ（job:…）            … 予約中・手動対応待ち・失敗 → 承認済み、出したもの → 公開済み
 * 「投稿を作る」の下書きは端末（ブラウザ）に保存されているので、画面の側で足す。
 * 同じ投稿を2回数えないよう、承認済みの案は投稿ジョブだけで出す（ジョブは同じ投稿に1つ。jobs-store-server の idempotencyKey）。
 */
import { NextResponse } from 'next/server'
import { listProposals } from '@/lib/marketing/autopilot-store-server'
import { activeVariants } from '@/lib/marketing/autopilot-types'
import { listJobs } from '@/lib/marketing/jobs-store-server'
import { CHANNEL_LABELS } from '@/lib/marketing/types'
import { mediumOf, toJstLocal, type ContentItem } from '@/lib/marketing/content-types'

export const dynamic = 'force-dynamic'

const DAY_MS = 24 * 60 * 60 * 1000

export async function GET() {
  try {
    const [proposals, jobs] = await Promise.all([listProposals(), listJobs()])
    const items: ContentItem[] = []

    for (const proposal of proposals) {
      for (const item of proposal.items) {
        if (item.status !== 'proposed' && item.status !== 'expired') continue
        for (const variant of activeVariants(item)) {
          const blocked = variant.compliance.status === 'blocked'
          items.push({
            id: `ap:${proposal.weekStart}:${item.id}:${variant.channel}`,
            origin: 'autopilot',
            medium: mediumOf(variant.channel),
            channelLabel: CHANNEL_LABELS[variant.channel],
            theme: item.theme,
            stage: 'review',
            flag: blocked
              ? { label: 'NG表現あり（直すまで承認できません）', tone: 'red' }
              : item.status === 'expired'
                ? { label: '予定を過ぎました（承認すれば次の回で投稿）', tone: 'amber' }
                : undefined,
            when: item.scheduledAt,
            href: `/marketing/autopilot?week=${proposal.weekStart}`,
          })
        }
      }
    }

    // 投稿ジョブは直近60日（予定・作成のどちらか）だけ
    const since = new Date(Date.now() - 60 * DAY_MS).toISOString()
    for (const job of jobs) {
      if (job.status === 'cancelled') continue
      if (job.scheduledAt < since && job.createdAt < since) continue
      const stage = job.status === 'published' ? 'published' : 'approved'
      items.push({
        id: `job:${job.id}`,
        origin: 'job',
        variantId: job.variantId,
        medium: mediumOf(job.channel),
        channelLabel: CHANNEL_LABELS[job.channel],
        theme: job.theme,
        stage,
        flag:
          job.status === 'failed'
            ? { label: '公開に失敗しました', tone: 'red' }
            : job.status === 'action_required'
              ? { label: '手動での投稿待ち', tone: 'amber' }
              : undefined,
        when: toJstLocal(job.scheduledAt),
        href: '/marketing/jobs',
      })
    }

    items.sort((a, b) => (b.when ?? '').localeCompare(a.when ?? ''))
    return NextResponse.json({ ok: true, items })
  } catch (error) {
    console.error('コンテンツの読み込みに失敗:', error instanceof Error ? error.message : error)
    return NextResponse.json({ ok: false, error: 'コンテンツの一覧を読めませんでした' }, { status: 500 })
  }
}
