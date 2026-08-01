import { NextRequest, NextResponse } from 'next/server'
import { list, put, del } from '@vercel/blob'
import { kvGet, kvSet, kvDelete } from '@/lib/marketing/kv-store-server'
import { ILLUSTRATION_SLOT_NAMES } from '@/lib/illustrations'

// イラスト画像の一覧・アップロード・削除
// 保存先: Vercel Blob（BLOB_READ_WRITE_TOKEN 設定時）→ 無ければ KVストア（Supabase/ローカルファイル）
// どちらの場合も再デプロイなしで各画面に即時反映される

const PREFIX = 'illustrations/'
const INDEX_KEY = 'ill:__index'
const MAX_SIZE = 4 * 1024 * 1024 // 4MB（Vercelのリクエストボディ上限に合わせる）
const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp']

type IllIndex = Record<string, number>  // slot -> 更新時刻(ms)

function blobConfigured(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN)
}

/** スロット名 → 画像URL のマップを返す */
export async function GET() {
  const map: Record<string, string> = {}

  // KVストア側（インデックスのみ読む・画像本体は /api/illustrations/image/[slot] が配信）
  try {
    const index = (await kvGet<IllIndex>(INDEX_KEY)) ?? {}
    for (const [slot, ts] of Object.entries(index)) {
      if (ILLUSTRATION_SLOT_NAMES.includes(slot)) {
        map[slot] = `/api/illustrations/image/${slot}?v=${ts}`
      }
    }
  } catch { /* KV不通時はスキップ */ }

  // Blob側（設定されていれば優先）
  if (blobConfigured()) {
    try {
      const { blobs } = await list({ prefix: PREFIX })
      for (const b of blobs) {
        const slot = b.pathname.slice(PREFIX.length).replace(/\.(png|jpg|jpeg|webp)$/i, '')
        if (!ILLUSTRATION_SLOT_NAMES.includes(slot)) continue
        map[slot] = `${b.url}?v=${Date.parse(String(b.uploadedAt))}`
      }
    } catch { /* Blob不通時はKVの結果を使う */ }
  }

  return NextResponse.json({ map })
}

/** multipart/form-data (slot, file) で画像をアップロード */
export async function POST(req: NextRequest) {
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
    return NextResponse.json({ error: '4MB以下の画像にしてください' }, { status: 400 })
  }

  try {
    if (blobConfigured()) {
      const blob = await put(`${PREFIX}${slot}.png`, file, {
        access: 'public',
        addRandomSuffix: false,
        allowOverwrite: true,
        contentType: file.type,
      })
      return NextResponse.json({ url: `${blob.url}?v=${Date.now()}` })
    }

    // KVフォールバック: base64で保存し、自前エンドポイントから配信
    const base64 = Buffer.from(await file.arrayBuffer()).toString('base64')
    const ts = Date.now()
    await kvSet(`ill:${slot}`, { contentType: file.type, base64 })
    const index = (await kvGet<IllIndex>(INDEX_KEY)) ?? {}
    index[slot] = ts
    await kvSet(INDEX_KEY, index)
    return NextResponse.json({ url: `/api/illustrations/image/${slot}?v=${ts}` })
  } catch (e) {
    return NextResponse.json({ error: `保存に失敗しました: ${(e as Error).message}` }, { status: 500 })
  }
}

/** ?slot=xxx の画像を削除（Blob・KVの両方から） */
export async function DELETE(req: NextRequest) {
  const slot = req.nextUrl.searchParams.get('slot') ?? ''
  if (!ILLUSTRATION_SLOT_NAMES.includes(slot)) {
    return NextResponse.json({ error: '不明なスロット名です' }, { status: 400 })
  }
  try {
    if (blobConfigured()) {
      const { blobs } = await list({ prefix: `${PREFIX}${slot}.` })
      for (const b of blobs) await del(b.url)
    }
    await kvDelete(`ill:${slot}`)
    const index = (await kvGet<IllIndex>(INDEX_KEY)) ?? {}
    if (index[slot]) {
      delete index[slot]
      await kvSet(INDEX_KEY, index)
    }
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: `削除に失敗しました: ${(e as Error).message}` }, { status: 500 })
  }
}
