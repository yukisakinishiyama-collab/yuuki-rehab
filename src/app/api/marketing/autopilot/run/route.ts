/**
 * 自動投稿パイプラインの定期実行
 *
 * - GitHub Actions（15分ごと）と Vercel Cron（週1回の保険）から呼ばれる
 * - ほとんどの回は「期限切れの整理・前日リマインド」だけで終わる（数百ミリ秒）
 * - 日曜の夕方（設定の時刻）以降の最初の回だけ、翌週分のAI下書きを作って院長へLINE通知する
 * - 認証: CRON_SECRET（Bearer）または管理者のBasic認証（proxyの認証対象外のためここで確認）
 */
import { NextRequest, NextResponse } from 'next/server'
import { cronOrAdmin } from '@/lib/marketing/auth'
import { runAutopilot } from '@/lib/marketing/autopilot-server'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

async function handle(request: NextRequest) {
  if (!cronOrAdmin(request)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  try {
    return NextResponse.json(await runAutopilot())
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : '不明なエラー' },
      { status: 500 },
    )
  }
}

export const GET = handle
export const POST = handle
