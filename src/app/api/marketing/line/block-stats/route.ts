/**
 * 公式LINE のブロックの状況（院長のみ・数だけ）
 * - GET : 友だちの数・ブロックの数（LINE の集計。前の日まで）／この30日のブロックの数と、直前に届いていたお知らせの種類／一斉配信の回数
 * お名前・LINE の ID は返さない。2026-11-26 院長「公式lineをブロックしにくい設計に」。lib/marketing/line-touch-server.ts
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/marketing/auth'
import { blockStats } from '@/lib/marketing/line-touch-server'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

export async function GET(request: NextRequest) {
  const denied = requireAdmin(request)
  if (denied) return denied
  try {
    return NextResponse.json({ ok: true, ...(await blockStats()) })
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : '読めませんでした' }, { status: 500 })
  }
}
