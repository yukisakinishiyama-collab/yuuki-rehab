/**
 * Search Console（集客の効果の画面）
 * GET … 直近28日とその前の28日の、ホームページの Google 検索でのクリック・表示・平均掲載順位、検索キーワード、ページ
 *       ?refresh=1 で取り直す（ふだんは6時間とっておいた値）
 */
import { NextRequest, NextResponse } from 'next/server'
import { getSearchConsole } from '@/lib/marketing/gsc-server'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(request: NextRequest) {
  try {
    return NextResponse.json(await getSearchConsole(request.nextUrl.searchParams.get('refresh') === '1'))
  } catch (error) {
    return NextResponse.json({ connected: false, error: error instanceof Error ? error.message : '不明' }, { status: 500 })
  }
}
