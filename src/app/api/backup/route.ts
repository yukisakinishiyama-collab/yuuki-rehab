/**
 * バックアップ（院内専用。proxy.ts の Basic 認証の内側。院長（管理者）だけ）
 *
 * GET ?part=core                 → カルテ全部＋写真の一覧＋契約書の番号（パソコンに保存するときの土台）
 * GET ?part=contracts&ids=a,b,…  → 署名入りの契約書の本文（20件まで）
 * GET ?part=list                 → クラウドの毎月の控えの一覧
 * GET ?part=month&ym=YYYY-MM     → その月の控え
 * POST                           → 今月の控えを今の中身で作りなおす（「今すぐクラウドにも控える」）
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/marketing/auth'
import {
  buildCoreBackup,
  getContractSnapshots,
  getMonthlyBackup,
  listMonthlyBackups,
  saveMonthlyBackup,
} from '@/lib/backup/backup-server'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const noStore = { 'Cache-Control': 'private, no-store' }

export async function GET(request: NextRequest) {
  const denied = requireAdmin(request)
  if (denied) return denied
  const part = request.nextUrl.searchParams.get('part') ?? 'core'
  try {
    if (part === 'core') return NextResponse.json(await buildCoreBackup(), { headers: noStore })
    if (part === 'contracts') {
      const ids = (request.nextUrl.searchParams.get('ids') ?? '').split(',').filter(Boolean)
      if (ids.length === 0 || ids.length > 20) return NextResponse.json({ error: '番号は1〜20件で指定してください' }, { status: 400 })
      return NextResponse.json({ contracts: await getContractSnapshots(ids) }, { headers: noStore })
    }
    if (part === 'list') return NextResponse.json({ backups: await listMonthlyBackups() }, { headers: noStore })
    if (part === 'month') {
      const backup = await getMonthlyBackup(request.nextUrl.searchParams.get('ym') ?? '')
      if (!backup) return NextResponse.json({ error: 'その月の控えはありません' }, { status: 404 })
      return NextResponse.json(backup, { headers: noStore })
    }
    return NextResponse.json({ error: 'part が正しくありません' }, { status: 400 })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('[backup] 読み込みに失敗', message)
    return NextResponse.json({ error: message }, { status: 502 })
  }
}

export async function POST(request: NextRequest) {
  const denied = requireAdmin(request)
  if (denied) return denied
  try {
    const result = await saveMonthlyBackup(new Date(), true)
    console.info('[backup] 手動で今月の控えを作成', { ym: result.ym })
    return NextResponse.json({ ok: true, ...result }, { headers: noStore })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('[backup] 控えの作成に失敗', message)
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
