/**
 * クラウドの毎月の控え（Vercel Cron から毎日呼ぶ。その月の控えが無ければ作る）
 * CRON_SECRET の Bearer か、院長の Basic 認証のときだけ動く（proxy.ts の PUBLIC_PATHS に入れている）
 */
import { NextRequest, NextResponse } from 'next/server'
import { cronOrAdmin } from '@/lib/marketing/auth'
import { saveMonthlyBackup } from '@/lib/backup/backup-server'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

async function run(request: NextRequest) {
  if (!cronOrAdmin(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const result = await saveMonthlyBackup(new Date(), false)
    if (result.status === 'saved') console.info('[backup] 今月の控えを作成', { ym: result.ym })
    return NextResponse.json({ ok: true, ...result })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('[backup] 毎月の控えに失敗', message)
    return NextResponse.json({ error: message }, { status: 502 })
  }
}

export const GET = run
export const POST = run
