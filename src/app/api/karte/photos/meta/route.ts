/**
 * 患部の写真の一覧（メタデータ。院内専用・Basic 認証の内側）
 *
 * GET  ?patientId=…        → { photos: KartePhoto[] }（クラウドに保存した一覧。端末をまたいで同じものが出る）
 * PUT  { photo: KartePhoto } → 1件を保存（追加・説明の変更）
 * DELETE ?patientId=…&id=… → 1件を一覧から外す（画像本体は /api/karte/photos の DELETE で消す）
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { listPhotoMeta, removePhotoMeta, upsertPhotoMeta } from '@/lib/karte/photo-storage-server'

export const dynamic = 'force-dynamic'

const ID = z.string().regex(/^[A-Za-z0-9_-]{1,64}$/)
const photoSchema = z.object({
  id: ID,
  patientId: ID,
  takenDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  storagePath: z.string().regex(/^[A-Za-z0-9_-]{1,64}\/[A-Za-z0-9_-]{1,64}\.jpg$/),
  caption: z.string().max(300),
  bodyRegion: z.string().max(20).optional(),
  width: z.number().int().min(1).max(10000),
  height: z.number().int().min(1).max(10000),
  bytes: z.number().int().min(0),
  createdAt: z.string().max(40),
})

export async function GET(request: NextRequest) {
  const patientId = request.nextUrl.searchParams.get('patientId') ?? ''
  if (!ID.safeParse(patientId).success) return NextResponse.json({ error: '患者さんの情報が正しくありません' }, { status: 400 })
  try {
    return NextResponse.json({ photos: await listPhotoMeta(patientId) }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 502 })
  }
}

export async function PUT(request: NextRequest) {
  const parsed = photoSchema.safeParse((await request.json().catch(() => ({})))?.photo)
  if (!parsed.success) return NextResponse.json({ error: '写真の情報が正しくありません' }, { status: 400 })
  if (!parsed.data.storagePath.startsWith(`${parsed.data.patientId}/`)) return NextResponse.json({ error: '保存先が患者さんと合いません' }, { status: 400 })
  try {
    await upsertPhotoMeta(parsed.data as Parameters<typeof upsertPhotoMeta>[0])
    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 502 })
  }
}

export async function DELETE(request: NextRequest) {
  const patientId = request.nextUrl.searchParams.get('patientId') ?? ''
  const id = request.nextUrl.searchParams.get('id') ?? ''
  if (!ID.safeParse(patientId).success || !ID.safeParse(id).success) return NextResponse.json({ error: '情報が正しくありません' }, { status: 400 })
  try {
    await removePhotoMeta(patientId, id)
    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 502 })
  }
}
