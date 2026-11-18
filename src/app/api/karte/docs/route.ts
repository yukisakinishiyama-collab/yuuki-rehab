/**
 * カルテの資料（論文・リハビリプロトコルなどのファイル。院内専用。proxy.ts の Basic 認証の内側）
 *
 * POST   JSON { patientId, docId, fileName, bytes }            → { storagePath, uploadUrl, contentType }
 *          … クラウドへ直接送るための署名つきの宛先を作る（大きい PDF は API を通せないため）
 * POST   multipart { file, patientId, docId, fileName }        → { storagePath, bytes }
 *          … API を通して保存（4MB まで。直接送れなかったときの予備）
 * GET    ?path=<カルテのID>/<資料のID>.<拡張子>[&name=保存名]   → { url }（1時間だけ開ける URL。name があれば端末に保存する形）
 * DELETE ?path=…                                               → 削除
 * 題名・メモなどは端末の localStorage（pt_karte_docs）に持ち、ほかのカルテと同じように同期する。ログに患者IDは出さない。
 */
import { NextRequest, NextResponse } from 'next/server'
import { API_UPLOAD_MAX_BYTES, checkDocFile, docStoragePath, formatBytes, isValidDocId, isValidDocPath } from '@/lib/karte/doc-rules'
import { createDocUpload, putDoc, removeDoc, signedDocUrl } from '@/lib/karte/doc-storage-server'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

function fail(error: unknown, status = 502) {
  return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status })
}

export async function POST(request: NextRequest) {
  const multipart = (request.headers.get('content-type') ?? '').includes('multipart/form-data')
  try {
    if (multipart) {
      const form = await request.formData().catch(() => null)
      const file = form?.get('file')
      const patientId = String(form?.get('patientId') ?? '')
      const docId = String(form?.get('docId') ?? '')
      const fileName = String(form?.get('fileName') ?? '')
      if (!(file instanceof Blob) || !isValidDocId(patientId) || !isValidDocId(docId)) return fail('ファイルか患者さんの情報が足りません', 400)
      const check = checkDocFile(fileName, file.size)
      if (!check.ok) return fail(check.error, 400)
      if (file.size > API_UPLOAD_MAX_BYTES) return fail(`この通り道では ${formatBytes(API_UPLOAD_MAX_BYTES)} までです`, 413)
      const storagePath = docStoragePath(patientId, docId, check.type.ext)
      await putDoc(storagePath, new Uint8Array(await file.arrayBuffer()), check.type.mime)
      console.info('[karte/docs] saved', { bytes: file.size, ext: check.type.ext, via: 'api' })
      return NextResponse.json({ storagePath, bytes: file.size })
    }
    const body = (await request.json().catch(() => ({}))) as { patientId?: unknown; docId?: unknown; fileName?: unknown; bytes?: unknown }
    const patientId = String(body.patientId ?? '')
    const docId = String(body.docId ?? '')
    if (!isValidDocId(patientId) || !isValidDocId(docId)) return fail('患者さんの情報が足りません', 400)
    const check = checkDocFile(String(body.fileName ?? ''), Number(body.bytes))
    if (!check.ok) return fail(check.error, 400)
    const storagePath = docStoragePath(patientId, docId, check.type.ext)
    const { uploadUrl } = await createDocUpload(storagePath)
    console.info('[karte/docs] upload url', { bytes: Number(body.bytes), ext: check.type.ext })
    return NextResponse.json({ storagePath, uploadUrl, contentType: check.type.mime })
  } catch (error) {
    console.error('[karte/docs] 保存に失敗', error instanceof Error ? error.message : String(error))
    return fail(error)
  }
}

export async function GET(request: NextRequest) {
  const path = request.nextUrl.searchParams.get('path') ?? ''
  const name = (request.nextUrl.searchParams.get('name') ?? '').slice(0, 120)
  if (!isValidDocPath(path)) return fail('場所が正しくありません', 400)
  try {
    const url = await signedDocUrl(path, name || undefined)
    if (!url) return fail('資料が見つかりません', 404)
    return NextResponse.json({ url }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    return fail(error)
  }
}

export async function DELETE(request: NextRequest) {
  const path = request.nextUrl.searchParams.get('path') ?? ''
  if (!isValidDocPath(path)) return fail('場所が正しくありません', 400)
  try {
    await removeDoc(path)
    return NextResponse.json({ ok: true })
  } catch (error) {
    return fail(error)
  }
}
