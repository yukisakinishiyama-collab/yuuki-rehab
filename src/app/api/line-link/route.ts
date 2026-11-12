/**
 * カルテ ↔ LINE の結びつけ（院内用。Basic 認証の内側）
 * - GET    : 結びついている患者さんの一覧（キー・氏名・電話・日時。封印済みの参照は返さない）
 * - DELETE : ?key=… の結びつけを外す（患者さんが変わった・間違えて結んだとき）
 */
import { NextRequest, NextResponse } from 'next/server'
import { deleteLineLink, listLineLinks } from '@/lib/line-link-server'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const links = await listLineLinks()
    return NextResponse.json({ ok: true, links }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : '取得に失敗' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  const key = request.nextUrl.searchParams.get('key') ?? ''
  if (!/^\d{10,11}\|.+$/.test(key)) return NextResponse.json({ ok: false, error: 'key required' }, { status: 400 })
  try {
    await deleteLineLink(key)
    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : '削除に失敗' }, { status: 500 })
  }
}
