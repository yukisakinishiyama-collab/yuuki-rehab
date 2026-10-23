/**
 * 売上・来院（NOAH）の画面用（院長のみ）
 *
 * GET            … 保存済みの月ごとの集計・最新日のまとめ・曜日ごとの平均・次の一手・この先の空き
 * GET ?refresh=1 … 予約システムから取り直してから返す（「最新にする」ボタン）
 * 金額などの経営の数字なので、スタッフの権限では見られない。
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/marketing/auth'
import { fetchHubStats } from '@/lib/marketing/booking-stats'
import { jstParts } from '@/lib/marketing/autopilot-planner'
import { getNoahStore, refreshNoahStore } from '@/lib/marketing/noah-server'
import { nextOpenDay, pickDraftDay, suggestions, summarize, weekdayAverages } from '@/lib/marketing/noah-analysis'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(request: NextRequest) {
  const denied = requireAdmin(request)
  if (denied) return denied
  const refresh = request.nextUrl.searchParams.get('refresh') === '1'
  let store = await getNoahStore()
  let refreshError: string | undefined
  if (refresh || !store) {
    const result = await refreshNoahStore()
    store = result.store
    refreshError = result.fetched ? undefined : result.error
  }
  const months = store?.months ?? []
  const summary = summarize(months)
  const stats = await fetchHubStats(1)
  const openings = stats?.openings ?? []
  const today = jstParts(new Date()).date
  const base = summary && summary.date > today ? summary.date : today
  const draftDay = pickDraftDay(openings, base)
  const weekdays = summary ? weekdayAverages(months, summary.date) : []
  const tips = summary ? suggestions(summary, { draftDay, draftMade: true, weekly: true, weekdays }) : []
  return NextResponse.json({
    ok: true,
    store,
    summary,
    weekdays,
    tips,
    openings: openings.filter((d) => d.date >= today).slice(0, 7),
    next: nextOpenDay(openings, base),
    draftDay,
    refreshError,
  })
}
