/**
 * 経費の設定（院長のみ）。KV の keiei:expenses に保存
 * - GET : 設定（無ければ初期値）
 * - PUT : { fixed, variableRate, oneOff } をまるごと保存
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/marketing/auth'
import { kvGet, kvSet } from '@/lib/marketing/kv-store-server'
import { EMPTY_SETTINGS, type CostItem, type ExpenseSettings } from '@/lib/marketing/profit'

export const dynamic = 'force-dynamic'

const KEY = 'keiei:expenses'

function cleanItems(raw: unknown, max = 30): CostItem[] | null {
  if (!Array.isArray(raw)) return null
  const out: CostItem[] = []
  for (const r of raw.slice(0, max)) {
    if (!r || typeof r !== 'object') return null
    const o = r as Record<string, unknown>
    const label = String(o.label ?? '').trim().slice(0, 30)
    const amount = Number(o.amount)
    if (!label || !Number.isFinite(amount) || amount < 0 || amount > 100_000_000) return null
    out.push({ id: String(o.id ?? '').slice(0, 20) || Math.random().toString(36).slice(2, 8), label, amount: Math.round(amount) })
  }
  return out
}

export async function GET(request: NextRequest) {
  const denied = requireAdmin(request)
  if (denied) return denied
  const s = (await kvGet<ExpenseSettings>(KEY)) ?? EMPTY_SETTINGS
  return NextResponse.json({ ok: true, settings: s })
}

export async function PUT(request: NextRequest) {
  const denied = requireAdmin(request)
  if (denied) return denied
  let raw: unknown
  try {
    raw = await request.json()
  } catch {
    return NextResponse.json({ error: '内容を読み取れませんでした' }, { status: 400 })
  }
  if (!raw || typeof raw !== 'object') return NextResponse.json({ error: '内容の形が正しくありません' }, { status: 400 })
  const b = raw as Record<string, unknown>
  const fixed = cleanItems(b.fixed)
  if (!fixed) return NextResponse.json({ error: '固定費は、名前と0以上の金額で入れてください' }, { status: 400 })
  const variableRate = Number(b.variableRate)
  if (!Number.isFinite(variableRate) || variableRate < 0 || variableRate > 95) {
    return NextResponse.json({ error: '変動費の割合は 0〜95% で入れてください' }, { status: 400 })
  }
  const oneOff: Record<string, CostItem[]> = {}
  if (b.oneOff && typeof b.oneOff === 'object') {
    for (const [month, items] of Object.entries(b.oneOff as Record<string, unknown>).slice(0, 36)) {
      if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) continue
      const cleaned = cleanItems(items)
      if (cleaned === null) return NextResponse.json({ error: `${month} の臨時の出費の形が正しくありません` }, { status: 400 })
      if (cleaned.length) oneOff[month] = cleaned
    }
  }
  const settings: ExpenseSettings = { fixed, variableRate: Math.round(variableRate * 10) / 10, oneOff, updatedAt: new Date().toISOString() }
  await kvSet(KEY, settings)
  return NextResponse.json({ ok: true, settings })
}
