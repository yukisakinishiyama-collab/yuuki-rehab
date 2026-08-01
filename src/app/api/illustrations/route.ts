import { NextRequest, NextResponse } from 'next/server'
import { list, put, del } from '@vercel/blob'
import { ILLUSTRATION_SLOT_NAMES } from '@/lib/illustrations'

// イラスト画像の一覧・アップロード・削除（Vercel Blob 保存）
// ChatGPT等で生成した画像を再デプロイなしで各画面に反映するための API

const PREFIX = 'illustrations/'
const MAX_SIZE = 8 * 1024 * 1024 // 8MB
const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp']

function blobConfigured(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN)
}

/** スロット名 → 画像URL のマップを返す */
export async function GET() {
  if (!blobConfigured()) return NextResponse.json({ map: {} })
  try {
    const { blobs } = await list({ prefix: PREFIX })
    const map: Record<string, string> = {}
    for (const b of blobs) {
      const slot = b.pathname.slice(PREFIX.length).replace(/\.(png|jpg|jpeg|webp)$/i, '')
      if (!ILLUSTRATION_SLOT_NAMES.includes(slot)) continue
      // 同一パス上書き運用のためキャッシュバスターとして更新時刻を付与
      map[slot] = `${b.url}?v=${Date.parse(String(b.uploadedAt))}`
    }
    return NextResponse.json({ map })
  } catch {
    return NextResponse.json({ map: {} })
  }
}

/** multipart/form-data (slot, file) で画像をアップロード */
export async function POST(req: NextRequest) {
  if (!blobConfigured()) {
    return NextResponse.json({ error: 'Blobストレージが未設定です（BLOB_READ_WRITE_TOKEN）' }, { status: 501 })
  }
  const form = await req.formData()
  const slot = String(form.get('slot') ?? '')
  const file = form.get('file')

  if (!ILLUSTRATION_SLOT_NAMES.includes(slot)) {
    return NextResponse.json({ error: '不明なスロット名です' }, { status: 400 })
  }
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'ファイルがありません' }, { status: 400 })
  }
  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: 'PNG / JPEG / WebP のみアップロードできます' }, { status: 400 })
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: '8MB以下の画像にしてください' }, { status: 400 })
  }

  const blob = await put(`${PREFIX}${slot}.png`, file, {
    access: 'public',
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: file.type,
  })
  return NextResponse.json({ url: `${blob.url}?v=${Date.now()}` })
}

/** ?slot=xxx の画像を削除 */
export async function DELETE(req: NextRequest) {
  if (!blobConfigured()) {
    return NextResponse.json({ error: 'Blobストレージが未設定です' }, { status: 501 })
  }
  const slot = req.nextUrl.searchParams.get('slot') ?? ''
  if (!ILLUSTRATION_SLOT_NAMES.includes(slot)) {
    return NextResponse.json({ error: '不明なスロット名です' }, { status: 400 })
  }
  const { blobs } = await list({ prefix: `${PREFIX}${slot}.` })
  for (const b of blobs) await del(b.url)
  return NextResponse.json({ ok: true })
}
