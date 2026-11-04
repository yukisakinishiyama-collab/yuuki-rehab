/**
 * 売上・来院（NOAH）の画面用（院長のみ）
 *
 * GET            … 保存済みの月ごとの集計・最新日のまとめ・曜日ごとの平均・次の一手・この先の空き
 * GET ?refresh=1 … この先の空き（予約システムの数字）を取り直してから返す
 * 集計は、経営の画面で院長が入れた NOAH の CSV（/api/marketing/noah/import）。自動の読み取りは 2026-11-05 にやめた
 * GET ?lite=1    … 月ごとの集計だけ（この先の空き・次の一手を省く。「道すじ」の画面用で速い）
 * この先の空きは、予約システムの数字の控え（booking-stats-fast.ts）から返す（画面を待たせない）
 * 金額などの経営の数字なので、スタッフの権限では見られない。
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/marketing/auth'
import { fetchHubStatsFast } from '@/lib/marketing/booking-stats-fast'
import { jstParts } from '@/lib/marketing/autopilot-planner'
import { getNoahStore } from '@/lib/marketing/noah-server'
import { nextOpenDay, pickDraftDay, suggestions, summarize, weekdayAverages } from '@/lib/marketing/noah-analysis'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(request: NextRequest) {
  const denied = requireAdmin(request)
  if (denied) return denied
  const refresh = request.nextUrl.searchParams.get('refresh') === '1'
  const lite = request.nextUrl.searchParams.get('lite') === '1'
  // 月ごとの集計と、この先の空き（予約システム）は同時に取りに行く
  const statsPromise = lite ? Promise.resolve(null) : fetchHubStatsFast(1, { force: refresh })
  const store = await getNoahStore()
  const months = store?.months ?? []
  if (lite) return NextResponse.json({ ok: true, store })
  const summary = summarize(months)
  const stats = await statsPromise
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
  })
}
