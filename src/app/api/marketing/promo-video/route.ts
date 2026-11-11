/**
 * 宣伝の短い動画（YouTubeショート・TikTok）を見る・保存する（院内専用。proxy.ts の Basic 認証の内側）
 *
 * GET ?id=<動画>&kind=poster[&scene=0〜4] … 場面の絵（PNG。すぐ出る）
 * GET ?id=<動画>&kind=video               … 動画（mp4）。作りおきが無ければ組み立てる（はじめは20〜60秒かかる）
 * GET ?id=<動画>&kind=info                … 作りおきの有無（{ ready, url, posterUrl, seconds }。作らない）
 */
import { NextRequest, NextResponse } from 'next/server'
import { getPromoVideo } from '@/data/promo-videos'
import { ensurePromoVideo, getStoredPromoVideo, isPublicUrl, readLocalPromoFile } from '@/lib/marketing/promo-video-server'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams
  const id = params.get('id') ?? ''
  const kind = params.get('kind') ?? 'video'
  const video = getPromoVideo(id)
  if (!video) return NextResponse.json({ error: '動画が見つかりません' }, { status: 404 })

  try {
    if (kind === 'info') {
      const stored = await getStoredPromoVideo(id)
      return NextResponse.json({ ok: true, ready: Boolean(stored), url: stored?.url ?? null, posterUrl: stored?.posterUrl ?? null, seconds: stored?.seconds ?? null })
    }
    if (kind === 'poster') {
      const scene = Number(params.get('scene') ?? '0')
      // 作りおきの絵（1場面め）があればそれを使う
      if (!params.has('scene')) {
        const local = await readLocalPromoFile(id, 'jpg')
        if (local && (await getStoredPromoVideo(id))) return new NextResponse(new Uint8Array(local), { headers: { 'Content-Type': 'image/jpeg', 'Cache-Control': 'private, max-age=300' } })
      }
      const { renderPromoPoster } = await import('@/lib/marketing/promo-video-render')
      const png = await renderPromoPoster(video, Number.isFinite(scene) ? scene : 0)
      return new NextResponse(new Uint8Array(png), { headers: { 'Content-Type': 'image/png', 'Cache-Control': 'private, max-age=300' } })
    }
    const stored = await ensurePromoVideo(id)
    if (isPublicUrl(stored.url)) return NextResponse.redirect(stored.url)
    const bytes = await readLocalPromoFile(id, 'mp4')
    if (!bytes) return NextResponse.json({ error: '動画を読めませんでした' }, { status: 500 })
    return new NextResponse(new Uint8Array(bytes), {
      headers: {
        'Content-Type': 'video/mp4',
        'Content-Length': String(bytes.length),
        'Content-Disposition': `inline; filename="yuuki-${id}.mp4"`,
        'Cache-Control': 'private, max-age=300',
      },
    })
  } catch (error) {
    console.error('[promo-video] 作れませんでした', error)
    return NextResponse.json({ error: `動画を作れませんでした（${error instanceof Error ? error.message.slice(0, 200) : '不明'}）` }, { status: 500 })
  }
}
