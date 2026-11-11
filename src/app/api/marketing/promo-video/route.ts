/**
 * 宣伝の短い動画（YouTubeショート・TikTok）を見る・保存する（院内専用。proxy.ts の Basic 認証の内側）
 *
 * GET ?id=<動画>&kind=poster[&scene=0〜4] … 場面の絵（PNG。すぐ出る）
 * GET ?id=<動画>&kind=video               … 動画（mp4）。作りおきが無ければ組み立てる（はじめは20〜60秒かかる）
 * GET ?id=<動画>&kind=info                … 作りおきの有無（{ ready, url, posterUrl, seconds, aiImages }。作らない）
 * POST { id, action: 'regenerate' }       … AIの絵を作り直して、動画も作り直す（院長のみ。1〜2分かかる）
 * POST { week, n, action }                … 次の予定の1本を approve（承認）・unapprove・skip（見送り）・restore（元に戻す）・swap（別の動画）（院長のみ）
 * 場面の絵は、AIの絵がもう作ってあればそれを、まだなら院の写真（代わりの絵）で出す（見るだけではAIの絵は作らない）
 */
import { NextRequest, NextResponse } from 'next/server'
import { getPromoVideo } from '@/data/promo-videos'
import { requireAdmin } from '@/lib/marketing/auth'
import {
  applyPromoAction,
  ensurePromoVideo,
  getStoredPromoVideo,
  isPublicUrl,
  promoAiConfigured,
  promoSceneAiImage,
  readLocalPromoFile,
  resetPromoAi,
  type PromoAction,
} from '@/lib/marketing/promo-video-server'

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
      return NextResponse.json({
        ok: true,
        ready: Boolean(stored),
        url: stored?.url ?? null,
        posterUrl: stored?.posterUrl ?? null,
        seconds: stored?.seconds ?? null,
        aiImages: stored?.aiImages ?? 0,
        aiConfigured: promoAiConfigured(),
      })
    }
    if (kind === 'poster') {
      const scene = Number(params.get('scene') ?? '0')
      // 作りおきの絵（1場面め）があればそれを使う
      if (!params.has('scene')) {
        const local = await readLocalPromoFile(id, 'jpg')
        if (local && (await getStoredPromoVideo(id))) return new NextResponse(new Uint8Array(local), { headers: { 'Content-Type': 'image/jpeg', 'Cache-Control': 'private, max-age=300' } })
      }
      const { renderPromoPoster } = await import('@/lib/marketing/promo-video-render')
      const index = Number.isFinite(scene) ? scene : 0
      const png = await renderPromoPoster(video, index, await promoSceneAiImage(id, index))
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

const PLAN_ACTIONS = new Set<PromoAction>(['approve', 'unapprove', 'skip', 'restore', 'swap'])

export async function POST(request: NextRequest) {
  const denied = requireAdmin(request)
  if (denied) return denied
  const body = (await request.json().catch(() => ({}))) as { id?: string; action?: string; week?: string; n?: number }
  // 次の予定の1本を、承認・見送り・別の動画に（院長のみ。承認は動画が無ければ作るので1〜2分かかることがある）
  if (PLAN_ACTIONS.has(body.action as PromoAction)) {
    const week = String(body.week ?? '')
    const n = Number(body.n)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(week) || !Number.isInteger(n) || n < 1 || n > 9) return NextResponse.json({ error: '予定が正しくありません' }, { status: 400 })
    try {
      const result = await applyPromoAction(week, n, body.action as PromoAction, 'アプリ（院長）')
      return NextResponse.json(result, { status: result.ok ? 200 : 409 })
    } catch (error) {
      console.error('[promo-video] 予定を変えられませんでした', error)
      return NextResponse.json({ ok: false, message: `できませんでした（${error instanceof Error ? error.message.slice(0, 200) : '不明'}）` }, { status: 500 })
    }
  }
  const id = String(body.id ?? '')
  if (body.action !== 'regenerate' || !getPromoVideo(id)) return NextResponse.json({ error: '動画が見つかりません' }, { status: 400 })
  if (!promoAiConfigured()) return NextResponse.json({ error: 'AI画像の設定（OPENAI_API_KEY）が無いため、作り直せません' }, { status: 409 })
  try {
    await resetPromoAi(id)
    const stored = await ensurePromoVideo(id)
    return NextResponse.json({ ok: true, aiImages: stored.aiImages ?? 0, aiPending: Boolean(stored.aiPending) })
  } catch (error) {
    console.error('[promo-video] 作り直せませんでした', error)
    return NextResponse.json({ error: `作り直せませんでした（${error instanceof Error ? error.message.slice(0, 200) : '不明'}）` }, { status: 500 })
  }
}
