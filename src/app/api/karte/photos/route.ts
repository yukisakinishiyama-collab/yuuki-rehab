/**
 * 患部の写真（院内専用。proxy.ts の Basic 認証の内側）
 *
 * POST   multipart { file: image/jpeg, patientId, photoId } → { storagePath, bytes }   … 保存（縮小は画面側で済ませる）
 * GET    ?path=patientId/photoId.jpg                      → 画像そのもの（キャッシュは端末だけ）
 * DELETE ?path=patientId/photoId.jpg                      → 削除
 * メタデータ（日付・説明）は端末の localStorage（pt_karte_photos）に持つ。ログに患者IDは出さない。
 */
import { NextRequest, NextResponse } from 'next/server'
import { getPhoto, isValidPhotoPath, MAX_PHOTO_BYTES, putPhoto, removePhoto } from '@/lib/karte/photo-storage-server'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

const ID_RE = /^[A-Za-z0-9_-]{1,64}$/

export async function POST(request: NextRequest) {
  const form = await request.formData().catch(() => null)
  const file = form?.get('file')
  const patientId = String(form?.get('patientId') ?? '')
  const photoId = String(form?.get('photoId') ?? '')
  if (!(file instanceof Blob) || !ID_RE.test(patientId) || !ID_RE.test(photoId)) {
    return NextResponse.json({ error: '写真か患者さんの情報が足りません' }, { status: 400 })
  }
  if (file.type !== 'image/jpeg') return NextResponse.json({ error: 'JPEGの写真だけ保存できます' }, { status: 400 })
  if (file.size > MAX_PHOTO_BYTES) return NextResponse.json({ error: '写真が大きすぎます（3MBまで）' }, { status: 413 })
  const storagePath = `${patientId}/${photoId}.jpg`
  try {
    await putPhoto(storagePath, new Uint8Array(await file.arrayBuffer()))
    console.info('[karte/photos] saved', { bytes: file.size })
    return NextResponse.json({ storagePath, bytes: file.size })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('[karte/photos] 保存に失敗', message)
    return NextResponse.json({ error: message }, { status: 502 })
  }
}

export async function GET(request: NextRequest) {
  const path = request.nextUrl.searchParams.get('path') ?? ''
  if (!isValidPhotoPath(path)) return NextResponse.json({ error: '場所が正しくありません' }, { status: 400 })
  try {
    const bytes = await getPhoto(path)
    if (!bytes) return NextResponse.json({ error: '写真が見つかりません' }, { status: 404 })
    return new NextResponse(new Uint8Array(bytes), {
      headers: { 'Content-Type': 'image/jpeg', 'Cache-Control': 'private, max-age=86400' },
    })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 502 })
  }
}

export async function DELETE(request: NextRequest) {
  const path = request.nextUrl.searchParams.get('path') ?? ''
  if (!isValidPhotoPath(path)) return NextResponse.json({ error: '場所が正しくありません' }, { status: 400 })
  try {
    await removePhoto(path)
    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 502 })
  }
}
