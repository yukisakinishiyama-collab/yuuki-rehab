/**
 * 動画ストック API（個別取得・更新・削除）
 */
import { NextRequest, NextResponse } from 'next/server'
import { deleteVideo, getVideo, saveVideo } from '@/lib/marketing/video-store-server'
import type { StockVideo } from '@/lib/marketing/video-types'

export const dynamic = 'force-dynamic'

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const video = await getVideo(id)
    if (!video) return NextResponse.json({ ok: false, error: 'not found' }, { status: 404 })
    return NextResponse.json({ ok: true, video })
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : '取得に失敗' },
      { status: 500 },
    )
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  let patch: Partial<StockVideo>
  try {
    patch = (await request.json()) as Partial<StockVideo>
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid json' }, { status: 400 })
  }
  try {
    const current = await getVideo(id)
    if (!current) return NextResponse.json({ ok: false, error: 'not found' }, { status: 404 })
    const updated: StockVideo = { ...current, ...patch, id, updatedAt: new Date().toISOString() }
    await saveVideo(updated)
    return NextResponse.json({ ok: true, video: updated })
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : '更新に失敗' },
      { status: 500 },
    )
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    await deleteVideo(id)
    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : '削除に失敗' },
      { status: 500 },
    )
  }
}
