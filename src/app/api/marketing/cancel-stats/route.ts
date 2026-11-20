/**
 * キャンセルの分析（経営 → キャンセル分析）の、予約システム側の数字（院長だけ）
 *
 * 予約システムの集計の行（お名前・電話は来ない。booking-stats.ts）から、予約日が過ぎた予約のキャンセル率を
 * 月・初めて/2回目以降・曜日・流入元・予約を受けてから予約日までの日数ごとに出す（lib/cancel-analysis.ts）。
 * カルテのキャンセルの記録の分析は、画面（この端末のカルテ）で行う。2026-11-20
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/marketing/auth'
import { fetchHubStatsFast } from '@/lib/marketing/booking-stats-fast'
import { sourceLabel } from '@/lib/marketing/booking-stats'
import { jstParts } from '@/lib/marketing/autopilot-planner'
import { bookingCancelStats } from '@/lib/cancel-analysis'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(request: NextRequest) {
  const denied = requireAdmin(request)
  if (denied) return denied
  const refresh = request.nextUrl.searchParams.get('refresh') === '1'
  // 予約システムが返せるのは、受け付けた日が120日以内の予約まで
  const stats = await fetchHubStatsFast(120, { force: refresh }).catch(() => null)
  if (!stats) return NextResponse.json({ ok: true, stats: null })
  const today = jstParts(new Date()).date
  return NextResponse.json({ ok: true, stats: bookingCancelStats(stats.bookings, today, sourceLabel), generatedAt: stats.generatedAt })
}
