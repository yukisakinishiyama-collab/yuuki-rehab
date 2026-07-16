/** 効果測定の集計API（指示書17章のダッシュボード用） */
import { NextRequest, NextResponse } from 'next/server'
import { listEvents } from '@/lib/marketing/analytics-store-server'
import { listContacts } from '@/lib/marketing/line-store-server'
import { listJobs } from '@/lib/marketing/jobs-store-server'
import { INTENT_LABELS, type IntentKey } from '@/lib/marketing/line-types'

export async function GET(request: NextRequest) {
  const days = Math.min(Number(request.nextUrl.searchParams.get('days') ?? 30), 365)
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
  const events = listEvents(since)

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
  const jobs = listJobs().filter((j) => j.createdAt >= since)
  const postStats: Record<string, { published: number; pending: number; failed: number }> = {}
  jobs.forEach((j) => {
    if (!postStats[j.channel]) postStats[j.channel] = { published: 0, pending: 0, failed: 0 }
    if (j.status === 'published') postStats[j.channel].published += 1
    else if (j.status === 'failed') postStats[j.channel].failed += 1
    else if (j.status !== 'cancelled') postStats[j.channel].pending += 1
  })

  return NextResponse.json({
    ok: true,
    days,
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
