/**
 * 前日のお知らせ（LINE）の設定（動かす／テスト／止める）だけを返す（院内。Basic 認証の内側）
 * 「今日」の画面の「お知らせが届かない方」（ReminderReachPanel）が、LINE 連携の方に届くかを決めるのに使う（2026-11-20）。
 * 設定を変えるのは 集客 → 自動化設定（/api/marketing/automation。院長だけ）
 */
import { NextResponse } from 'next/server'
import { getRule } from '@/lib/marketing/automation-store-server'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const rule = await getRule('reservation_remind')
    return NextResponse.json({ ok: true, mode: rule.mode })
  } catch {
    return NextResponse.json({ ok: true, mode: 'unknown' })
  }
}
