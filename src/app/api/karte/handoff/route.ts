/**
 * 契約書・同意書の受け渡し（パソコン → iPad。院内専用。proxy.ts の Basic 認証の内側）
 *
 * POST { action:'create', patientId, patientName, title, draft } → { token, expiresAt }   … パソコン：QR を出す
 * GET  ?t=受け渡しの番号                                         → { session }             … iPad：中身を読む／パソコン：印を見る
 * GET  ?patientId=カルテのID                                     → { sessions }            … iPad の院内アプリ：届いている書類
 * POST { action:'open', token }                                  → { ok } | { ok:false, reason }
 * POST { action:'done', token, recordId }                        → { ok }                  … iPad：署名が終わった
 * POST { action:'cancel', token }                                → { ok }                  … パソコン：取り消した
 * 中身（draft）は1時間だけ置き、署名済み・取り消しで消す。お名前・中身は記録（ログ）に出さない。
 */
import { NextRequest, NextResponse } from 'next/server'
import { isHandoffExpired, isValidHandoffToken, sanitizeHandoffDraft, toHandoffListItem } from '@/lib/contracts/handoff'
import { cancelHandoff, completeHandoff, createHandoff, getHandoff, listOpenHandoffs, openHandoff } from '@/lib/karte/handoff-server'
import { getContractSnapshot, isValidContractId } from '@/lib/karte/contract-storage-server'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

const ID_RE = /^[A-Za-z0-9_-]{1,64}$/
const noStore = { 'Cache-Control': 'private, no-store' }
const clean = (v: unknown, max: number) => (typeof v === 'string' ? v.replace(/[\p{Cc}\p{Zl}\p{Zp}]/gu, ' ').trim().slice(0, max) : '')

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('t')
  const patientId = request.nextUrl.searchParams.get('patientId')
  try {
    if (token !== null) {
      if (!isValidHandoffToken(token)) return NextResponse.json({ error: '受け渡しの番号が正しくありません' }, { status: 400 })
      const session = await getHandoff(token)
      if (!session) return NextResponse.json({ error: '受け渡しが見つかりません' }, { status: 404, headers: noStore })
      return NextResponse.json({ session, expired: isHandoffExpired(session) }, { headers: noStore })
    }
    if (patientId !== null) {
      if (!ID_RE.test(patientId)) return NextResponse.json({ error: 'カルテの番号が正しくありません' }, { status: 400 })
      const sessions = await listOpenHandoffs(patientId)
      return NextResponse.json({ sessions: sessions.map(toHandoffListItem) }, { headers: noStore })
    }
    return NextResponse.json({ error: '受け渡しの番号がありません' }, { status: 400 })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 502 })
  }
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
  if (!body || typeof body.action !== 'string') return NextResponse.json({ error: '形が正しくありません' }, { status: 400 })
  try {
    if (body.action === 'create') {
      const patientId = String(body.patientId ?? '')
      const patientName = clean(body.patientName, 40)
      const title = clean(body.title, 100)
      const draft = sanitizeHandoffDraft(body.draft)
      if (!ID_RE.test(patientId) || !patientName || !title || !draft) {
        return NextResponse.json({ error: '書類の内容が足りないか、形が正しくありません' }, { status: 400 })
      }
      const session = await createHandoff({ patientId, patientName, title, draft })
      console.info('[karte/handoff] created')
      return NextResponse.json({ token: session.token, expiresAt: session.expiresAt }, { headers: noStore })
    }

    const token = body.token
    if (!isValidHandoffToken(token)) return NextResponse.json({ error: '受け渡しの番号が正しくありません' }, { status: 400 })

    if (body.action === 'open') {
      const r = await openHandoff(token)
      return NextResponse.json(r.ok ? { ok: true } : { ok: false, reason: r.reason }, { headers: noStore })
    }
    if (body.action === 'cancel') {
      const r = await cancelHandoff(token)
      return NextResponse.json(r.ok ? { ok: true } : { ok: false, reason: r.reason }, { headers: noStore })
    }
    if (body.action === 'done') {
      const recordId = String(body.recordId ?? '')
      if (!isValidContractId(recordId)) return NextResponse.json({ error: '記録の番号が正しくありません' }, { status: 400 })
      // 署名入りの本文がクラウドに保存されていて、同じ患者さんのものであることを確かめてから「署名済み」にする
      const session = await getHandoff(token)
      if (!session) return NextResponse.json({ ok: false, reason: 'missing' }, { headers: noStore })
      const snapshot = await getContractSnapshot(recordId)
      if (!snapshot || snapshot.record.patientId !== session.patientId) {
        return NextResponse.json({ error: '署名済みの書類が見つかりません' }, { status: 409 })
      }
      const r = await completeHandoff(token, recordId)
      console.info('[karte/handoff] signed')
      return NextResponse.json(r.ok ? { ok: true } : { ok: false, reason: r.reason }, { headers: noStore })
    }
    return NextResponse.json({ error: '形が正しくありません' }, { status: 400 })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('[karte/handoff] 失敗', message.slice(0, 200))
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
