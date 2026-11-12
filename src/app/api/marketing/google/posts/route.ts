/**
 * Google の投稿の状態（「投稿の予定と結果」の画面）
 * GET … Google の投稿の一覧（新しい100本）から、公開・拒否・審査中の数と、拒否された投稿（日時・見出し・ボタンのリンク先）
 *       ?refresh=1 で Google へ取り直す（ふだんは10分とっておいた値）。読むだけで、Google 側は何も変えない
 */
import { NextRequest, NextResponse } from 'next/server'
import { googlePostsOverview } from '@/lib/marketing/gbp-posts-server'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(request: NextRequest) {
  try {
    return NextResponse.json({ ok: true, ...(await googlePostsOverview(request.nextUrl.searchParams.get('refresh') === '1')) })
  } catch (error) {
    return NextResponse.json({ ok: false, connected: false, error: error instanceof Error ? error.message : '不明' }, { status: 500 })
  }
}
