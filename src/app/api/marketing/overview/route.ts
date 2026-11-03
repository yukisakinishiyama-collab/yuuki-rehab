/**
 * 集客概要の数字（集客 → 集客概要）
 *
 * 院長・スタッフのどちらも見られる（売上・利益は入れていない。経営の数字は /marketing/sales だけ）。
 * 取れなかった数字は 0 にせず「未取得／未連携」と理由を返す（overview-server.ts）。
 */
import { NextResponse } from 'next/server'
import { buildOverview } from '@/lib/marketing/overview-server'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET() {
  try {
    return NextResponse.json({ ok: true, overview: await buildOverview() })
  } catch (error) {
    console.error('集客概要の集計に失敗:', error instanceof Error ? error.message : error)
    return NextResponse.json({ ok: false, error: '集客の数字をまとめられませんでした。しばらくしてから開き直してください' }, { status: 500 })
  }
}
