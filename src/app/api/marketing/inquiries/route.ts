/**
 * 問い合わせ（公式LINE の相談）の一覧と対応状況（集客 → 問い合わせ）
 *
 * GET   … 問い合わせの一覧（友だち追加だけの方は入れない）と、状況ごとの数
 * PATCH … { userId, status } 対応状況を変える（院長・スタッフとも可。だれが変えたかを監査ログへ）
 *         - 予約済み … 予約済みの印も付ける
 *         - 完了     … 要対応の印を外し、人の対応中を終えて自動の案内に戻す（LINE導線の「対応終了」と同じ）
 * 会話の中身は LINE導線（/marketing/line）で見る。ここでは一覧に要る最小限だけ返す。
 */
import { NextRequest, NextResponse } from 'next/server'
import { listContacts, patchContact } from '@/lib/marketing/line-store-server'
import { inquiryStatusOf, isInquiry, lastUserMessageAt, lastUserText, type InquiryRow } from '@/lib/marketing/inquiry'
import { INTENT_LABELS, INQUIRY_STATUS_LABELS, type InquiryStatus, type IntentKey, type LineContact } from '@/lib/marketing/line-types'
import { recordAudit } from '@/lib/marketing/automation-store-server'
import { ROLE_HEADER } from '@/lib/marketing/auth'

export const dynamic = 'force-dynamic'

/** 会話ログの「（選択: intent:injury）」を「（選択: ケガをした）」に読みかえる */
function readable(text: string): string {
  return text.replace(/（選択: intent:(\w+)）/, (_, key: string) => `（選択: ${INTENT_LABELS[key as IntentKey] ?? key}）`)
    .replace(/（選択: (?:part|when):(.+?)）/, '（選択: $1）')
    .replace('（選択: handoff）', '（選択: スタッフに相談する）')
}

function toRow(c: LineContact): InquiryRow {
  return {
    userId: c.userId,
    displayName: c.displayName,
    status: inquiryStatusOf(c),
    intent: c.intent ? INTENT_LABELS[c.intent] : null,
    bodyPart: c.bodyPart ?? null,
    timing: c.timing ?? null,
    needsAttention: c.needsAttention ?? null,
    handoff: c.handoff,
    lastText: readable(lastUserText(c)),
    lastAt: lastUserMessageAt(c) ?? c.lastActiveAt,
    blocked: Boolean(c.blockedAt),
    optedOut: c.optedOut,
    simulated: c.userId.startsWith('sim_'),
  }
}

export async function GET() {
  try {
    const rows = (await listContacts()).filter((c) => isInquiry(c)).map(toRow)
    rows.sort((a, b) => b.lastAt.localeCompare(a.lastAt))
    const counts = Object.fromEntries(
      (Object.keys(INQUIRY_STATUS_LABELS) as InquiryStatus[]).map((s) => [s, rows.filter((r) => r.status === s).length]),
    ) as Record<InquiryStatus, number>
    return NextResponse.json({ ok: true, inquiries: rows, counts })
  } catch (error) {
    console.error('問い合わせの読み込みに失敗:', error instanceof Error ? error.message : error)
    return NextResponse.json({ ok: false, error: '問い合わせを読めませんでした' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  let body: { userId?: unknown; status?: unknown }
  try {
    body = (await request.json()) as typeof body
  } catch {
    return NextResponse.json({ ok: false, error: '内容を読み取れませんでした' }, { status: 400 })
  }
  const userId = typeof body.userId === 'string' ? body.userId : ''
  const status = body.status as InquiryStatus
  if (!userId || !(status in INQUIRY_STATUS_LABELS)) {
    return NextResponse.json({ ok: false, error: '問い合わせか状態の指定が正しくありません' }, { status: 400 })
  }

  const contacts = await listContacts()
  const current = contacts.find((c) => c.userId === userId)
  if (!current) return NextResponse.json({ ok: false, error: '問い合わせが見つかりません' }, { status: 404 })

  const patch: Parameters<typeof patchContact>[1] = {
    inquiryStatus: status,
    inquiryUpdatedAt: new Date().toISOString(),
  }
  if (status === 'reserved') {
    patch.reserved = true
    patch.tags = Array.from(new Set([...(current.tags ?? []), '予約済み']))
  }
  if (status === 'done') {
    // 対応を終えたら、要対応の印を外して自動の案内に戻す（patchContact は handoff:false で会話を最初に戻す）
    patch.needsAttention = undefined
    if (current.handoff) patch.handoff = false
    patch.tags = (current.tags ?? []).filter((t) => t !== '要スタッフ対応')
  }
  const updated = await patchContact(userId, patch)
  if (!updated) return NextResponse.json({ ok: false, error: '問い合わせが見つかりません' }, { status: 404 })

  // 監査ログ（お名前・LINE の ID は残さない。何をどの状態にしたかだけ）
  await recordAudit({
    role: request.headers.get(ROLE_HEADER) ?? 'local',
    action: '問い合わせの状態を変更',
    target: '問い合わせ',
    detail: `${INQUIRY_STATUS_LABELS[inquiryStatusOf(current)]} → ${INQUIRY_STATUS_LABELS[status]}`,
  })
  return NextResponse.json({ ok: true, inquiry: toRow(updated) })
}
