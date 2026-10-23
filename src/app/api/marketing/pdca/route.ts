/**
 * PDCA（施策）の一覧・作成・更新・削除（院長のみ）
 *
 * GET           … 施策の一覧と、それぞれの C（評価）の数字・指標の一覧・ひな形の一覧
 * POST          … 計画（P）から施策を作る { title, purpose, hypothesis, metric, filter?, target, start, end, actions[], origin? }
 * PUT           … { id, ...変えるところ } で更新（実行の記録・やることのチェック・振り返り・完了など）
 * DELETE ?id=   … 施策を消す
 *
 * 売上などの経営の数字が出るので、スタッフの権限では使えない。保存は KV の keiei:pdca。
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/marketing/auth'
import { METRICS, TEMPLATES, type PdcaItem } from '@/lib/marketing/pdca'
import { DraftSchema, PatchSchema, aiAvailable, listItems, listWithChecks, newId, saveItems } from '@/lib/marketing/pdca-server'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const bad = (error: string, status = 400) => NextResponse.json({ error }, { status })

async function readBody(request: NextRequest): Promise<Record<string, unknown> | null> {
  try {
    const raw: unknown = await request.json()
    return raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : null
  } catch {
    return null
  }
}

export async function GET(request: NextRequest) {
  const denied = requireAdmin(request)
  if (denied) return denied
  const { items, checks, today } = await listWithChecks()
  return NextResponse.json({
    ok: true,
    today,
    items,
    checks,
    metrics: METRICS,
    templates: TEMPLATES.map((t) => ({ id: t.id, label: t.label })),
    ai: aiAvailable(),
  })
}

export async function POST(request: NextRequest) {
  const denied = requireAdmin(request)
  if (denied) return denied
  const body = await readBody(request)
  if (!body) return bad('内容の形が正しくありません')
  const parsed = DraftSchema.safeParse(body)
  if (!parsed.success) return bad('計画の内容を確かめてください（施策名・指標・目標・期間）')
  const d = parsed.data
  if (d.end < d.start) return bad('期間の終わりは、始まりより後の日にしてください')
  const now = new Date().toISOString()
  const item: PdcaItem = {
    id: newId(),
    createdAt: now,
    updatedAt: now,
    status: 'doing',
    title: d.title,
    purpose: d.purpose,
    hypothesis: d.hypothesis,
    metric: d.metric as PdcaItem['metric'],
    filter: d.filter,
    target: Math.round(d.target),
    start: d.start,
    end: d.end,
    actions: d.actions.filter(Boolean).map((text) => ({ id: newId(), text, done: false })),
    logs: [],
    manual: [],
    origin: d.origin,
  }
  const items = await listItems()
  await saveItems([item, ...items])
  return NextResponse.json({ ok: true, item })
}

export async function PUT(request: NextRequest) {
  const denied = requireAdmin(request)
  if (denied) return denied
  const body = await readBody(request)
  if (!body || typeof body.id !== 'string') return bad('どの施策かが分かりません')
  const parsed = PatchSchema.safeParse(body)
  if (!parsed.success) return bad('内容を確かめてください')
  const items = await listItems()
  const index = items.findIndex((i) => i.id === body.id)
  if (index === -1) return bad('施策が見つかりません', 404)
  const patch = parsed.data
  const next: PdcaItem = { ...items[index] }
  // 送られてきた項目だけを変える
  for (const key of Object.keys(patch) as Array<keyof typeof patch>) {
    if (!(key in body)) continue
    const value = patch[key]
    if (key === 'filter') next.filter = value as PdcaItem['filter']
    else if (value !== undefined) (next as unknown as Record<string, unknown>)[key] = value
  }
  if (next.end < next.start) return bad('期間の終わりは、始まりより後の日にしてください')
  next.target = Math.round(next.target)
  next.updatedAt = new Date().toISOString()
  items[index] = next
  await saveItems(items)
  return NextResponse.json({ ok: true, item: next })
}

export async function DELETE(request: NextRequest) {
  const denied = requireAdmin(request)
  if (denied) return denied
  const id = request.nextUrl.searchParams.get('id') ?? ''
  const items = await listItems()
  const rest = items.filter((i) => i.id !== id)
  if (rest.length === items.length) return bad('施策が見つかりません', 404)
  await saveItems(rest)
  return NextResponse.json({ ok: true })
}
