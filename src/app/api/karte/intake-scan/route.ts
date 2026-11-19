/**
 * 問診票の写真の読み取り（院内専用。proxy.ts の Basic 認証の内側）
 *
 * POST multipart { images: image/jpeg × 1〜4 } → { result: IntakeScanResult }
 * 写真は端末で縮めてから送る（合計 3.8MB まで）。読み取りの結果は下書きで、画面の欄に入れるだけ。
 * 保存は院長・スタッフが写真と見比べてから（カルテの保存は端末の側で行う）。
 * 写真と読み取った内容は、このサーバーに保存しない・記録（ログ）に出さない。
 */
import { NextRequest, NextResponse } from 'next/server'
import { jstDate, MAX_SCAN_IMAGES, MAX_SCAN_TOTAL_BYTES } from '@/lib/karte/intake-scan'
import { intakeScanConfigured, readIntakeSheet } from '@/lib/karte/intake-scan-server'

export const dynamic = 'force-dynamic'
export const maxDuration = 90

/** JPEG の先頭の印（中身が本当に JPEG か） */
function isJpeg(bytes: Uint8Array): boolean {
  return bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
}

export async function POST(request: NextRequest) {
  if (!intakeScanConfigured()) {
    return NextResponse.json({ error: 'AIの設定（ANTHROPIC_API_KEY）がありません' }, { status: 503 })
  }
  const form = await request.formData().catch(() => null)
  const files = (form?.getAll('images') ?? []).filter((f): f is File => f instanceof Blob)
  if (files.length === 0) return NextResponse.json({ error: '写真がありません' }, { status: 400 })
  if (files.length > MAX_SCAN_IMAGES) return NextResponse.json({ error: `写真は${MAX_SCAN_IMAGES}枚までです` }, { status: 400 })
  const total = files.reduce((n, f) => n + f.size, 0)
  if (total > MAX_SCAN_TOTAL_BYTES) return NextResponse.json({ error: '写真が大きすぎます。枚数を減らすか、撮り直してください' }, { status: 413 })

  const images: { data: string }[] = []
  for (const file of files) {
    const bytes = new Uint8Array(await file.arrayBuffer())
    if (file.type !== 'image/jpeg' || !isJpeg(bytes)) return NextResponse.json({ error: 'JPEGの写真だけ読み取れます' }, { status: 400 })
    images.push({ data: Buffer.from(bytes).toString('base64') })
  }

  try {
    const result = await readIntakeSheet(images, jstDate())
    // 中身は出さない（枚数・大きさ・読みにくかった欄の数だけ）
    console.info('[karte/intake-scan]', { images: images.length, bytes: total, unclear: result.unclear.length, sheet: result.isIntakeSheet })
    return NextResponse.json({ result }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('[karte/intake-scan] 失敗', message.slice(0, 200))
    return NextResponse.json({ error: `AIで読み取れませんでした（${message.slice(0, 120)}）` }, { status: 502 })
  }
}
