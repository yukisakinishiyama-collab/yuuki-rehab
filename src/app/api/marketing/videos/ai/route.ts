/**
 * AI動画（OpenAI の画像 → スライド動画）
 *
 * GET  … 設定済みか・作れるテーマの一覧（院長のみ）
 * POST { action: 'check' }                … 途中で止まった作成中のものを片付ける（画面を開いたとき）
 * POST { action: 'start', themeKey? }     … いますぐ1本作る（院長のボタン。1〜3分かかる）
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/marketing/auth'
import { AI_VIDEO_THEMES, aiVideoConfigured, startAiVideo, tickAiVideos } from '@/lib/marketing/ai-video-server'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

export async function GET(request: NextRequest) {
  const denied = requireAdmin(request)
  if (denied) return denied
  return NextResponse.json({
    ok: true,
    configured: aiVideoConfigured(),
    themes: AI_VIDEO_THEMES.map((t) => ({ key: t.key, title: t.title, category: t.category, months: t.months ?? null })),
  })
}

export async function POST(request: NextRequest) {
  const denied = requireAdmin(request)
  if (denied) return denied
  const body = (await request.json().catch(() => ({}))) as { action?: string; themeKey?: string }

  if (!aiVideoConfigured()) {
    return NextResponse.json({ ok: false, configured: false, error: 'OpenAI のAPIキー（OPENAI_API_KEY）がまだ設定されていません' }, { status: 200 })
  }

  try {
    if (body.action === 'start') {
      const themeKey = AI_VIDEO_THEMES.some((t) => t.key === body.themeKey) ? body.themeKey : undefined
      const video = await startAiVideo('manual', themeKey)
      return NextResponse.json({ ok: true, video, message: `「${video.title}」ができました。動画ストックに入れました（公開はしていません）` })
    }
    const result = await tickAiVideos({ allowAutoStart: false })
    return NextResponse.json({ ok: true, ...result })
  } catch (error) {
    const message = error instanceof Error ? error.message : '不明なエラー'
    console.error('[videos/ai]', error)
    return NextResponse.json({ ok: false, error: message.slice(0, 300) }, { status: 502 })
  }
}
