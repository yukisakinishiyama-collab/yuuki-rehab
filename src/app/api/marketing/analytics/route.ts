/** 効果測定の集計API（指示書17章のダッシュボード用） */
import { NextRequest, NextResponse } from 'next/server'
import { listEvents } from '@/lib/marketing/analytics-store-server'
import { listContacts } from '@/lib/marketing/line-store-server'
import { listJobs } from '@/lib/marketing/jobs-store-server'
import { INTENT_LABELS, type IntentKey } from '@/lib/marketing/line-types'
import { fetchHubStats, sourceLabel } from '@/lib/marketing/booking-stats'
import { listProposals } from '@/lib/marketing/autopilot-store-server'

export const dynamic = 'force-dynamic'

/** 予約（流入元別）と、自動投稿ごとの予約数。予約システムが未対応なら null */
async function bookingsBySource(days: number, since: string, clicks: Array<{ meta: Record<string, string> }>) {
  const stats = await fetchHubStats(days)
  if (!stats) return null
  const sinceDay = since.slice(0, 10)
  const rows = stats.bookings.filter((b) => b.received >= sinceDay)

  const bySource = new Map<string, { bookings: number; firstVisit: number; cancelled: number }>()
  for (const row of rows) {
    const key = row.source || 'direct'
    const entry = bySource.get(key) ?? { bookings: 0, firstVisit: 0, cancelled: 0 }
    entry.bookings += 1
    if (row.visitType.startsWith('初')) entry.firstVisit += 1
    if (row.status === 'キャンセル') entry.cancelled += 1
    bySource.set(key, entry)
  }
  const clickCount = (source: string) =>
    clicks.filter((e) => e.meta.dest === 'reserve' && (e.meta.source ?? '') === source).length

  const sources = [...bySource.entries()]
    .map(([source, v]) => ({ source, label: sourceLabel(source), ...v, clicks: clickCount(source) }))
    .sort((a, b) => b.bookings - a.bookings)

  // 自動投稿ごと（計測名 ap… → 投稿のテーマ）
  const themeByCampaign = new Map<string, { theme: string; scheduledAt: string }>()
  try {
    for (const proposal of await listProposals()) {
      for (const item of proposal.items) {
        if (item.campaign) themeByCampaign.set(item.campaign, { theme: item.theme, scheduledAt: item.scheduledAt })
      }
    }
  } catch {
    // テーマが引けなくても計測名で表示する
  }
  const byCampaign = new Map<string, number>()
  rows.filter((r) => r.campaign.startsWith('ap')).forEach((r) => byCampaign.set(r.campaign, (byCampaign.get(r.campaign) ?? 0) + 1))
  const posts = [...byCampaign.entries()]
    .map(([campaign, bookings]) => ({ campaign, bookings, ...(themeByCampaign.get(campaign) ?? { theme: campaign, scheduledAt: '' }) }))
    .sort((a, b) => b.bookings - a.bookings)
    .slice(0, 10)

  return { total: rows.length, firstVisit: rows.filter((r) => r.visitType.startsWith('初')).length, sources, posts, generatedAt: stats.generatedAt }
}

export async function GET(request: NextRequest) {
  const days = Math.min(Number(request.nextUrl.searchParams.get('days') ?? 30), 365)
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
  const events = await listEvents(since)

  const count = (kind: string) => events.filter((e) => e.kind === kind).length
  const uniq = (kind: string) => new Set(events.filter((e) => e.kind === kind).map((e) => e.actor ?? Math.random())).size

  // LINEファネル（ユニーク人数ベース）
  const funnel = {
    follow: uniq('line_follow'),
    intent: uniq('line_intent'),
    guide: uniq('line_guide'),
    reserveClick: events.filter((e) => e.kind === 'link_click' && e.meta.dest === 'reserve' && e.meta.source === 'line').length,
  }

  // 相談入口の内訳
  const intentBreakdown: Record<string, number> = {}
  events
    .filter((e) => e.kind === 'line_intent')
    .forEach((e) => {
      const label = INTENT_LABELS[e.meta.intent as IntentKey] ?? e.meta.intent ?? '不明'
      intentBreakdown[label] = (intentBreakdown[label] ?? 0) + 1
    })

  // クリック内訳（遷移先・流入元別）
  const clickBreakdown: Record<string, number> = {}
  events
    .filter((e) => e.kind === 'link_click')
    .forEach((e) => {
      const key = `${e.meta.dest}${e.meta.source ? `（${e.meta.source}${e.meta.intent ? `/${e.meta.intent}` : ''}）` : ''}`
      clickBreakdown[key] = (clickBreakdown[key] ?? 0) + 1
    })

  // コンバージョン（LINE顧客のタグ・状態から集計）
  const contacts = await listContacts()
  const conversions = {
    contacts: contacts.length,
    reserved: contacts.filter((c) => c.tags.includes('予約済み') || c.reserved).length,
    visited: contacts.filter((c) => c.tags.includes('来院済み')).length,
    handedOff: contacts.filter((c) => c.tags.includes('要スタッフ対応')).length,
  }

  // フォロー候補（指示書4-6: 途中離脱・過剰追客なし・対象条件を厳密に）
  const now = Date.now()
  const followUps = contacts
    .filter(
      (c) =>
        !c.handoff &&
        !c.optedOut &&
        !c.reserved &&
        !c.tags.includes('予約済み') &&
        c.step !== 'urgent' &&
        (c.step === 'ask_part' || c.step === 'ask_when' || c.step === 'guide') &&
        now - new Date(c.lastActiveAt).getTime() > 24 * 60 * 60 * 1000,
    )
    .map((c) => ({
      userId: c.userId,
      displayName: c.displayName,
      intent: c.intent ?? null,
      step: c.step,
      lastActiveAt: c.lastActiveAt,
      daysSince: Math.floor((now - new Date(c.lastActiveAt).getTime()) / (24 * 60 * 60 * 1000)),
    }))

  // 投稿実績（媒体別）
  const jobs = (await listJobs()).filter((j) => j.createdAt >= since)
  const postStats: Record<string, { published: number; pending: number; failed: number }> = {}
  jobs.forEach((j) => {
    if (!postStats[j.channel]) postStats[j.channel] = { published: 0, pending: 0, failed: 0 }
    if (j.status === 'published') postStats[j.channel].published += 1
    else if (j.status === 'failed') postStats[j.channel].failed += 1
    else if (j.status !== 'cancelled') postStats[j.channel].pending += 1
  })

  // 予約（流入元別）… 予約システム（GAS）から集計値だけを受け取る。失敗しても他の表示は返す
  let bookings = null
  try {
    bookings = await bookingsBySource(days, since, events.filter((e) => e.kind === 'link_click'))
  } catch {
    bookings = null
  }

  return NextResponse.json({
    ok: true,
    days,
    bookings,
    funnel,
    counts: {
      urgent: count('line_urgent'),
      handoff: count('line_handoff'),
      totalClicks: count('link_click'),
    },
    intentBreakdown,
    clickBreakdown,
    conversions,
    followUps,
    postStats,
  })
}
