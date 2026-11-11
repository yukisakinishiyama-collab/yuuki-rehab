/**
 * 署名入りの契約書・同意書（院内専用。proxy.ts の Basic 認証の内側）
 *
 * POST { record, html } → 署名したときの本文をクラウドに保存（kcdoc:<id>）。一度保存したものは書きかえない
 * GET  ?id=…           → { snapshot }（印刷・控えの再発行に使う）
 * 一覧（日付・書類名・会員の手続き）は端末の pt_contracts に持ち、カルテの同期でほかの端末へ届く。
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getContractSnapshot, isValidContractId, MAX_SNAPSHOT_CHARS, saveContractSnapshot } from '@/lib/karte/contract-storage-server'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

const ID = z.string().regex(/^[A-Za-z0-9_-]{1,64}$/)
const YMD = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
const text = (max: number) => z.string().max(max)

const memberSchema = z
  .object({
    kind: z.enum(['join', 'pause', 'cancel']),
    plan: z.enum(['一般会員', '学生会員', '兄弟・親子プラン']).optional(),
    start: YMD.optional(),
    partner: z
      .object({ name: text(40).min(1), relation: text(20).optional(), birthDate: YMD.optional(), patientId: ID.optional() })
      .strict()
      .optional(),
    pauseFrom: z.string().regex(/^\d{4}-\d{2}$/).optional(),
    pauseMonths: z.number().int().min(1).max(6).optional(),
    submitted: YMD.optional(),
    end: YMD.optional(),
    special: z.boolean().optional(),
    specialReason: text(100).optional(),
  })
  .strict()

const recordSchema = z
  .object({
    id: z.string().regex(/^[A-Za-z0-9_-]{6,64}$/),
    patientId: ID,
    docId: text(40),
    title: text(100),
    version: text(20),
    bodyHash: z.string().regex(/^[0-9a-f]{8,32}$/),
    signedAt: text(40),
    signedDate: YMD,
    patientName: text(40).min(1),
    guardianName: text(40).optional(),
    relation: text(20).optional(),
    staffLabel: text(20),
    staffName: text(40).min(1),
    checked: z.number().int().min(0).max(1000),
    written: z.number().int().min(0).max(1000),
    member: memberSchema.optional(),
  })
  .strict()

const bodySchema = z.object({
  record: recordSchema,
  html: z.string().min(1).max(MAX_SNAPSHOT_CHARS),
})

export async function POST(request: NextRequest) {
  const json = await request.json().catch(() => null)
  const parsed = bodySchema.safeParse(json)
  if (!parsed.success) {
    // 値は出さず、どの項目かだけを残す（患者さんの情報をログに出さない）
    console.warn('[karte/contracts] 形が正しくない', parsed.error.issues.map((i) => i.path.join('.')))
    return NextResponse.json({ error: '書類の内容が足りないか、形が正しくありません' }, { status: 400 })
  }
  // 本文に外から読み込むもの（script・外部の画像など）を入れない。署名の画像は data:image/png だけ
  const html = parsed.data.html
  // （署名の画像の文字の並びに on…= が偶然あっても弾かないよう、属性としての on…= だけを見る）
  if (/<script|<iframe|<object|<embed|<link|<meta|javascript:/i.test(html) || /<[^>]*\son[a-z]+\s*=/i.test(html) || /\ssrc\s*=\s*"(?!data:image\/png;base64,)/i.test(html)) {
    return NextResponse.json({ error: '書類の本文に使えないものが入っています' }, { status: 400 })
  }
  try {
    const result = await saveContractSnapshot({ record: parsed.data.record, html, savedAt: new Date().toISOString() })
    console.info('[karte/contracts] saved', { result, bytes: html.length })
    return NextResponse.json({ ok: true, result })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('[karte/contracts] 保存に失敗', message)
    return NextResponse.json({ error: message }, { status: 502 })
  }
}

export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get('id') ?? ''
  if (!isValidContractId(id)) return NextResponse.json({ error: '記録の番号が正しくありません' }, { status: 400 })
  try {
    const snapshot = await getContractSnapshot(id)
    if (!snapshot) return NextResponse.json({ error: '署名済みの書類が見つかりません' }, { status: 404 })
    return NextResponse.json({ snapshot }, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 502 })
  }
}
