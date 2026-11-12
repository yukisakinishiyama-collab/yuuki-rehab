/**
 * LINE の管理画面に置いてあるリッチメニュー画像を、こちらのサーバー経由で読む（画面の canvas で加工するため）。
 * ブラウザから直接だと CORS で読めないので、*.line-scdn.net の画像だけを中継する。院長のみ。
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/marketing/auth'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const denied = requireAdmin(request)
  if (denied) return denied
  const url = request.nextUrl.searchParams.get('url') ?? ''
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return NextResponse.json({ ok: false, error: 'url が不正です' }, { status: 400 })
  }
  if (parsed.protocol !== 'https:' || !/(^|\.)line-scdn\.net$/.test(parsed.hostname)) {
    return NextResponse.json({ ok: false, error: 'LINE の画像（line-scdn.net）だけ読めます' }, { status: 400 })
  }
  const res = await fetch(parsed.toString(), { cache: 'no-store' })
  if (!res.ok) return NextResponse.json({ ok: false, error: `画像を読めませんでした（HTTP ${res.status}）` }, { status: 502 })
  const type = res.headers.get('content-type') ?? 'image/jpeg'
  if (!type.startsWith('image/')) return NextResponse.json({ ok: false, error: '画像ではありません' }, { status: 502 })
  return new NextResponse(await res.arrayBuffer(), { headers: { 'Content-Type': type, 'Cache-Control': 'no-store' } })
}
