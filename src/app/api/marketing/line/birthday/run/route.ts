/**
 * 誕生日のご挨拶を送る（毎朝 9:00 JST の定期実行。Vercel Cron）
 * 認証は定期実行用（CRON_SECRET か、管理者の Basic 認証）。何度呼ばれても同じ年に2回は送らない
 */
import { NextRequest, NextResponse } from 'next/server'
import { cronOrAdmin } from '@/lib/marketing/auth'
import { runBirthday } from '@/lib/marketing/birthday-server'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

async function handle(request: NextRequest) {
  if (!cronOrAdmin(request)) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  try {
    const result = await runBirthday()
    return NextResponse.json({ ok: true, ...result })
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : String(error) }, { status: 500 })
  }
}

export const GET = handle
export const POST = handle
