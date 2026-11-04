/** LINE顧客管理API（管理画面用） */
import { NextRequest, NextResponse } from 'next/server'
import { listContacts, patchContact } from '@/lib/marketing/line-store-server'
import { ROLE_HEADER } from '@/lib/marketing/auth'
import { recordAudit } from '@/lib/marketing/automation-store-server'
import { CONSENT_PURPOSE_LABELS } from '@/lib/marketing/consent'
import { applyConsent } from '@/lib/marketing/consent-store-server'

export async function GET() {
  return NextResponse.json({ ok: true, contacts: await listContacts() })
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
    const contact = await patchContact(userId, safePatch)
    if (!contact) return NextResponse.json({ error: '顧客が見つかりません' }, { status: 404 })
    // 「配信停止」の印は、お知らせの受け取り（誕生日のご挨拶などを送るか）にも合わせる
    if (typeof safePatch.optedOut === 'boolean') {
      try {
        await applyConsent(userId, { purpose: 'marketing', allow: !safePatch.optedOut }, 'staff')
        await recordAudit({
          role: request.headers.get(ROLE_HEADER) ?? 'local',
          action: safePatch.optedOut ? 'お知らせの受け取りを停止' : 'お知らせの受け取りを再開',
          target: CONSENT_PURPOSE_LABELS.marketing,
          detail: '院で変えた（LINE導線の配信停止）',
        })
      } catch (error) {
        console.error('お知らせの受け取りの保存に失敗:', error instanceof Error ? error.message : error)
        return NextResponse.json({ ok: false, error: '配信停止の印は付けましたが、お知らせの受け取りを保存できませんでした。もう一度押してください' }, { status: 500 })
      }
    }
    return NextResponse.json({ ok: true, contact })
  } catch {
    return NextResponse.json({ error: '更新に失敗しました' }, { status: 400 })
  }
}
