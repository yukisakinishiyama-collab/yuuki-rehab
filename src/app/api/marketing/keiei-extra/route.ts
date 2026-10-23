/**
 * NOAH 以外の収入（アルファノートのサブスク、QR・クレジットカードの支払い）の月ごとの記録（院長のみ）
 *
 * GET … 記録している月の一覧（新しい月が先頭、最大24か月）
 * PUT … { month:'YYYY-MM', subscription, cashless, overlap, note? } を保存
 *        subscription … サブスク（継続課金）の収入。NOAH には入っていない
 *        cashless     … QR・クレジットカードの支払いの合計
 *        overlap      … cashless のうち、NOAH の窓口の金額と重なっている分（同じお支払いを両方に記録しているもの）
 *        売上の合計に足すのは subscription ＋（cashless − overlap）
 *
 * 金額だけを保存する。患者さんのお名前や取引ごとの明細は保存しない。
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/marketing/auth'
import { kvGet, kvSet } from '@/lib/marketing/kv-store-server'

export const dynamic = 'force-dynamic'

const KEY = 'keiei:extra'

export interface ExtraMonth {
  month: string
  subscription: number
  cashless: number
  overlap: number
  note?: string
  updatedAt: string
}

interface ExtraStore {
  months: Record<string, ExtraMonth>
}

const amount = (v: unknown): number | null => {
  const n = typeof v === 'string' ? Number(v.replace(/[,，円\s]/g, '')) : Number(v)
  return Number.isFinite(n) && n >= 0 && n < 100_000_000 ? Math.round(n) : null
}

export async function GET(request: NextRequest) {
  const denied = requireAdmin(request)
  if (denied) return denied
  const store = (await kvGet<ExtraStore>(KEY)) ?? { months: {} }
  const months = Object.values(store.months)
    .sort((a, b) => b.month.localeCompare(a.month))
    .slice(0, 24)
  return NextResponse.json({ ok: true, months })
}

export async function PUT(request: NextRequest) {
  const denied = requireAdmin(request)
  if (denied) return denied
  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: '内容を読み取れませんでした' }, { status: 400 })
  }
  const month = String(body.month ?? '')
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
    return NextResponse.json({ error: '月の形が正しくありません（例 2026-10）' }, { status: 400 })
  }
  const subscription = amount(body.subscription ?? 0)
  const cashless = amount(body.cashless ?? 0)
  const overlap = amount(body.overlap ?? 0)
  if (subscription === null || cashless === null || overlap === null) {
    return NextResponse.json({ error: '金額は0以上の数字で入れてください' }, { status: 400 })
  }
  if (overlap > cashless) {
    return NextResponse.json({ error: '「NOAHと重なる分」は、QR・カードの合計より大きくできません' }, { status: 400 })
  }
  const note = typeof body.note === 'string' ? body.note.slice(0, 200) : undefined
  const store = (await kvGet<ExtraStore>(KEY)) ?? { months: {} }
  store.months[month] = { month, subscription, cashless, overlap, note, updatedAt: new Date().toISOString() }
  // 古い月は24か月分だけ残す
  const keep = Object.keys(store.months).sort().reverse().slice(0, 24)
  store.months = Object.fromEntries(keep.map((m) => [m, store.months[m]]))
  await kvSet(KEY, store)
  return NextResponse.json({ ok: true, month: store.months[month] })
}
