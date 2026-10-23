/**
 * PDCA の相談（院長のみ）
 *
 * POST { mode:'plan', concern, templateId?, goal? } … 計画（P）の下書きを作る（保存はしない）
 * POST { mode:'review', id }                       … 振り返り（A）の下書きを作る（保存はしない）
 *
 * AIに渡すのは院全体の集計の数字と、院長が書いた文だけ。AIのキーが無い・失敗したときは、ひな形・数字から作る。
 * AIを使うと Anthropic の API の料金がかかる（1回あたり数円〜10円ほどの目安）。
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/marketing/auth'
import { addDays, check, daysBetween } from '@/lib/marketing/pdca'
import { consultPlan, consultReview, listItems, loadData, todayJst } from '@/lib/marketing/pdca-server'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function POST(request: NextRequest) {
  const denied = requireAdmin(request)
  if (denied) return denied
  let body: Record<string, unknown>
  try {
    const raw: unknown = await request.json()
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('shape')
    body = raw as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: '内容の形が正しくありません' }, { status: 400 })
  }

  if (body.mode === 'review') {
    const items = await listItems()
    const item = items.find((i) => i.id === body.id)
    if (!item) return NextResponse.json({ error: '施策が見つかりません' }, { status: 404 })
    const today = todayJst()
    const data = await loadData(addDays(item.start, -daysBetween(item.start, item.end)), today)
    const result = await consultReview(item, check(item, data, today))
    return NextResponse.json({ ok: true, ...result })
  }

  const concern = typeof body.concern === 'string' ? body.concern.slice(0, 600) : ''
  const templateId = typeof body.templateId === 'string' ? body.templateId : undefined
  const goal = typeof body.goal === 'number' && Number.isFinite(body.goal) && body.goal > 0 ? body.goal : undefined
  if (!concern.trim() && !templateId) {
    return NextResponse.json({ error: '相談の内容を書くか、ひな形を選んでください' }, { status: 400 })
  }
  const result = await consultPlan({ concern, templateId, goal })
  return NextResponse.json({ ok: true, ...result })
}
