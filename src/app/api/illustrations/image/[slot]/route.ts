import { NextRequest, NextResponse } from 'next/server'
import { kvGet } from '@/lib/marketing/kv-store-server'
import { ILLUSTRATION_SLOT_NAMES } from '@/lib/illustrations'

// KVストアに保存されたイラスト画像の配信（Blob未設定環境のフォールバック）

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slot: string }> },
) {
  const { slot } = await params
  if (!ILLUSTRATION_SLOT_NAMES.includes(slot)) {
    return NextResponse.json({ error: 'not found' }, { status: 404 })
  }
  let record: { contentType: string; base64: string } | null = null
  try {
    record = await kvGet<{ contentType: string; base64: string }>(`ill:${slot}`)
  } catch {
    return NextResponse.json({ error: 'storage unavailable' }, { status: 404 })
  }
  if (!record?.base64) {
    return NextResponse.json({ error: 'not found' }, { status: 404 })
  }
  return new NextResponse(Buffer.from(record.base64, 'base64'), {
    headers: {
      'Content-Type': record.contentType || 'image/png',
      // URLに ?v=更新時刻 が付くため長期キャッシュ可
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  })
}
