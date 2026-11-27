/**
 * NOAH の来院者日報（1日の合計。数字だけ）（院長のみ）
 *
 * GET  ?date=YYYY-MM-DD … その日の合計（無ければ sheet: null）
 * GET  ?month=YYYY-MM   … その月に入っている日の合計
 * POST { sheets: NoahDailySheet[] } … 保存（1回に31日分まで。同じ日は置きかえる）
 *
 * PDF は日報の画面（ブラウザの中）で読み、ここには合計の数字だけが来る。お名前・受診者No・保険種別は来ないし、保存しない。
 * 2026-11-27 院長「NOAHの日報をのせます」
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/marketing/auth'
import { sheetProblem, type NoahDailySheet } from '@/lib/marketing/noah-daily'
import { getNoahDaily, listNoahDailyMonth, saveNoahDaily } from '@/lib/marketing/noah-daily-server'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const denied = requireAdmin(request)
  if (denied) return denied
  const date = request.nextUrl.searchParams.get('date') ?? ''
  const month = request.nextUrl.searchParams.get('month') ?? ''
  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) return NextResponse.json({ ok: true, sheet: await getNoahDaily(date) })
  if (/^\d{4}-\d{2}$/.test(month)) return NextResponse.json({ ok: true, sheets: await listNoahDailyMonth(month) })
  return NextResponse.json({ ok: false, error: 'date か month を入れてください' }, { status: 400 })
}

export async function POST(request: NextRequest) {
  const denied = requireAdmin(request)
  if (denied) return denied
  const body = (await request.json().catch(() => null)) as { sheets?: unknown } | null
  const sheets = Array.isArray(body?.sheets) ? body.sheets : null
  if (!sheets || sheets.length === 0 || sheets.length > 31) {
    return NextResponse.json({ ok: false, error: '入れる日報の形が正しくありません（1回に31日分まで）' }, { status: 400 })
  }
  for (const s of sheets) {
    const problem = sheetProblem(s)
    if (problem) return NextResponse.json({ ok: false, error: problem }, { status: 400 })
  }
  try {
    const saved = await saveNoahDaily(sheets as NoahDailySheet[])
    return NextResponse.json({ ok: true, saved })
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : '保存できませんでした' }, { status: 500 })
  }
}
