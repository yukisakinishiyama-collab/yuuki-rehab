/**
 * 動画ストック API（一覧・登録）
 */
import { NextRequest, NextResponse } from 'next/server'
import { listVideos, saveVideo } from '@/lib/marketing/video-store-server'
import type { StockVideo } from '@/lib/marketing/video-types'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const videos = await listVideos()
    return NextResponse.json({ ok: true, videos })
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : '取得に失敗' },
      { status: 500 },
    )
  }
}

export async function POST(request: NextRequest) {
  let body: Partial<StockVideo>
  try {
    body = (await request.json()) as Partial<StockVideo>
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid json' }, { status: 400 })
  }

  const title = (body.title ?? '').trim()
  if (!title) {
    return NextResponse.json({ ok: false, error: 'タイトルは必須です' }, { status: 400 })
  }

  const now = new Date().toISOString()
  const video: StockVideo = {
    id: body.id ?? `v_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    title,
    url: body.url ?? '',
    thumbUrl: body.thumbUrl,
    shotDate: body.shotDate,
    place: body.place,
    performer: body.performer,
    patientPresent: Boolean(body.patientPresent),
    permission: body.permission ?? 'none',
    durationSec: body.durationSec,
    format: body.format,
    resolution: body.resolution,
    orientation: body.orientation,
    disease: body.disease,
    bodyPart: body.bodyPart,
    theme: body.theme,
    channels: body.channels ?? [],
    publishState: body.publishState ?? 'unused',
    caption: body.caption,
    hashtags: body.hashtags ?? [],
    memo: body.memo,
    createdAt: body.createdAt ?? now,
    updatedAt: now,
  }

  try {
    await saveVideo(video)
    return NextResponse.json({ ok: true, video })
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : '保存に失敗' },
      { status: 500 },
    )
  }
}
