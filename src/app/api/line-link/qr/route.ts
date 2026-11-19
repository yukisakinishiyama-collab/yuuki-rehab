/**
 * カルテの画面の「LINE連携のQRコード」（院内用。Basic 認証の内側＝src/proxy.ts の /api/line-link/:path*）
 * - POST   : {patientId, name, phone, birthDate} → その方だけの番号（10分・1回だけ）。QR の URL は画面で作る（LIFF ID は端末の控え）
 * - GET    : ?c=番号 → 状態（待っている・結びついた・取り消し・期限切れ）。お名前・電話番号は返さない
 * - DELETE : ?c=番号 → 取り消す（閉じた・出し直した）
 */
import { NextRequest, NextResponse } from 'next/server'
import { cancelLinkQr, createLinkQr, linkQrStatus } from '@/lib/line-link-qr-server'
import { isValidLinkCode } from '@/lib/line-link-qr'

export const dynamic = 'force-dynamic'

const noStore = { 'Cache-Control': 'no-store' }

export async function POST(request: NextRequest) {
  let body: { patientId?: string; name?: string; phone?: string; birthDate?: string }
  try {
    body = (await request.json()) as typeof body
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid json' }, { status: 400 })
  }
  try {
    const s = await createLinkQr({ patientId: String(body.patientId ?? ''), name: String(body.name ?? ''), phone: body.phone, birthDate: body.birthDate })
    return NextResponse.json({ ok: true, code: s.code, expiresAt: s.expiresAt, needPhone: !s.phone }, { headers: noStore })
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : '作れませんでした' }, { status: 400 })
  }
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('c') ?? ''
  if (!isValidLinkCode(code)) return NextResponse.json({ ok: false, error: 'code required' }, { status: 400 })
  try {
    return NextResponse.json({ ok: true, ...(await linkQrStatus(code)) }, { headers: noStore })
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : '読めませんでした' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('c') ?? ''
  if (!isValidLinkCode(code)) return NextResponse.json({ ok: false, error: 'code required' }, { status: 400 })
  try {
    await cancelLinkQr(code)
    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : '取り消せませんでした' }, { status: 500 })
  }
}
