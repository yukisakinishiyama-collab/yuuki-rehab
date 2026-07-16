/** LINE顧客管理API（管理画面用） */
import { NextRequest, NextResponse } from 'next/server'
import { listContacts, patchContact } from '@/lib/marketing/line-store-server'

export async function GET() {
  return NextResponse.json({ ok: true, contacts: listContacts() })
}

export async function PATCH(request: NextRequest) {
  try {
    const { userId, ...patch } = (await request.json()) as { userId: string } & Record<string, unknown>
    if (!userId) throw new Error('userId required')
    const allowed = ['tags', 'handoff', 'memo', 'needsAttention', 'reserved', 'optedOut'] as const
    const safePatch: Record<string, unknown> = {}
    for (const key of allowed) {
      if (key in patch) safePatch[key] = patch[key]
    }
    const contact = patchContact(userId, safePatch)
    if (!contact) return NextResponse.json({ error: '顧客が見つかりません' }, { status: 404 })
    return NextResponse.json({ ok: true, contact })
  } catch {
    return NextResponse.json({ error: '更新に失敗しました' }, { status: 400 })
  }
}
