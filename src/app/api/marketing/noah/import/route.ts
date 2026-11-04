/**
 * 経営の「CSVを入れて最新にする」：NOAH の金額集計（数字だけ）を保存する（院長のみ）
 *
 * POST { file, months: NoahMonth[] }
 *   CSV はブラウザの中で読み（lib/marketing/keiei-csv.ts）、日ごとの人数・金額と自費・商品の内訳・エリアの順位だけを送ってくる。
 *   同じ月は、集計日 → 入れた日時 の新しい方に置きかえる。
 * 患者さんのお名前などは、NOAH の金額集計の CSV にはもともと入っていない。
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/marketing/auth'
import { importNoahMonths } from '@/lib/marketing/noah-server'
import type { NoahMonth } from '@/lib/marketing/noah-types'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const denied = requireAdmin(request)
  if (denied) return denied
  const body = (await request.json().catch(() => null)) as { file?: unknown; months?: unknown } | null
  if (!body || !Array.isArray(body.months) || body.months.length === 0 || body.months.length > 3) {
    return NextResponse.json({ ok: false, error: '入れる月の形が正しくありません（1回に3か月まで）' }, { status: 400 })
  }
  try {
    const store = await importNoahMonths(body.months as NoahMonth[], String(body.file ?? ''))
    return NextResponse.json({ ok: true, latest: store.latest, months: store.months.map((m) => ({ month: m.month, asOf: m.asOf })) })
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : '保存できませんでした' }, { status: 400 })
  }
}
