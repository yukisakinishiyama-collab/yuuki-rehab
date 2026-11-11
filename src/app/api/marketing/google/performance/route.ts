/**
 * Googleビジネスプロフィールの成果（集客の効果の画面）
 * GET … 直近28日の表示・電話・ルート・ウェブサイト・予約と、その前の28日、先月・先々月の「検索された言葉」
 *       ?refresh=1 で Google へ取り直す（ふだんは6時間とっておいた値）
 */
import { NextRequest, NextResponse } from 'next/server'
import { getGbpPerformance } from '@/lib/marketing/gbp-performance-server'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(request: NextRequest) {
  try {
    return NextResponse.json(await getGbpPerformance(request.nextUrl.searchParams.get('refresh') === '1'))
  } catch (error) {
    return NextResponse.json({ connected: false, error: error instanceof Error ? error.message : '不明' }, { status: 500 })
  }
}
