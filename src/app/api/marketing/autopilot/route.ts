/**
 * 自動投稿パイプライン：設定・投稿案の取得、設定の保存、「今すぐ作る」
 *
 * GET  … 設定・直近の投稿案・接続状況（承認画面用）
 * PUT  … 設定の保存（院長のみ）
 * POST … { action: 'generate_now' } 今週の残り枠（なければ来週）の下書きを今すぐ作る（院長のみ）
 */
import { NextRequest, NextResponse } from 'next/server'
import { isInstagramConnected } from '@/lib/marketing/instagram-token'
import { isGbpConnected } from '@/lib/marketing/gbp-token'
import { youtubeStatus } from '@/lib/marketing/youtube-server'
import { z } from 'zod'
import { requireAdmin } from '@/lib/marketing/auth'
import { generateNow } from '@/lib/marketing/autopilot-server'
import { getAutopilotSettings, listProposals, saveAutopilotSettings } from '@/lib/marketing/autopilot-store-server'
import { DEFAULT_AUTOPILOT_SETTINGS } from '@/lib/marketing/autopilot-types'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

const SettingsSchema = z.object({
  enabled: z.boolean(),
  postsPerWeek: z.number().int().min(1).max(5),
  slots: z
    .array(z.object({ weekday: z.number().int().min(0).max(6), time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/) }))
    .min(1)
    .max(5),
  instagram: z.enum(['instagram_feed', 'instagram_carousel', 'off']),
  google: z.boolean(),
  availabilityPost: z.boolean(),
  googleSeo: z.boolean().default(true),
  googleSeoPerWeek: z.number().int().min(1).max(2).default(2),
  youtubeShorts: z.boolean().default(true),
  tiktokVideo: z.boolean().default(true),
  instagramReels: z.boolean().default(true),
  promoVideoPerWeek: z.number().int().min(1).max(2).default(1),
  youtubeAudited: z.boolean().default(false),
  availabilityStory: z.boolean().default(true),
  cancelStory: z.boolean().default(false),
  cancelStoryDays: z.enum(['today', 'tomorrow']).default('tomorrow'),
  cancelStoryLeadMinutes: z.number().int().min(0).max(360).default(60),
  cancelStoryFromHour: z.number().int().min(0).max(23).default(7),
  cancelStoryToHour: z.number().int().min(1).max(24).default(21),
  cancelStoryMaxPerDay: z.number().int().min(1).max(10).default(3),
  generateHour: z.number().int().min(6).max(22),
  ownerNote: z.string().max(400),
  clinicProfile: z.record(z.string(), z.string().max(2000)).optional(),
})

/** YouTubeショート・TikTokの動画の予定（今週・来週。承認の状態・出し方つき） */
async function upcomingPromoPlan() {
  try {
    const { promoPlanView } = await import('@/lib/marketing/promo-video-server')
    return await promoPlanView()
  } catch (error) {
    console.error('[autopilot] 動画の予定を読めませんでした', error)
    return []
  }
}

async function bufferConnection() {
  try {
    const { bufferStatus } = await import('@/lib/marketing/buffer-server')
    return await bufferStatus()
  } catch {
    return null
  }
}

export async function GET() {
  try {
    const [settings, proposals] = await Promise.all([getAutopilotSettings(), listProposals()])
    return NextResponse.json({
      ok: true,
      settings,
      proposals: proposals.slice(0, 6),
      promoPlan: await upcomingPromoPlan(),
      connections: {
        ai: Boolean(process.env.ANTHROPIC_API_KEY) && process.env.MARKETING_MODE !== 'mock',
        aiImage: Boolean(process.env.OPENAI_API_KEY) && process.env.MARKETING_MODE !== 'mock',
        instagram: await isInstagramConnected(),
        googleApi: await isGbpConnected(),
        youtube: await youtubeStatus(),
        buffer: await bufferConnection(),
        ownerLine: Boolean(process.env.LINE_CHANNEL_ACCESS_TOKEN && process.env.RESERVATION_NOTIFY_LINE_USER_ID),
        bookingStats: Boolean(process.env.RESERVATION_NOTIFY_SECRET),
        mock: process.env.MARKETING_MODE === 'mock',
      },
    })
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: `読み込みに失敗しました（${error instanceof Error ? error.message : '不明'}）` },
      { status: 500 },
    )
  }
}

export async function PUT(request: NextRequest) {
  const denied = requireAdmin(request)
  if (denied) return denied
  let input
  try {
    input = SettingsSchema.parse(await request.json())
  } catch {
    return NextResponse.json({ error: '設定の内容が正しくありません' }, { status: 400 })
  }
  const current = await getAutopilotSettings()
  const next = { ...DEFAULT_AUTOPILOT_SETTINGS, ...current, ...input }
  await saveAutopilotSettings(next)
  // Google検索向けの投稿をオフにしたら、予約済みでまだ出していない分も取り消す（すぐに止まるように）
  if (!next.googleSeo) {
    const { cancelPendingSeoPosts } = await import('@/lib/marketing/gbp-seo-server')
    await cancelPendingSeoPosts()
  }
  // 動画（YouTubeショート・TikTok）：オフにした媒体の予約は取り消し、オンの媒体はすぐ予約する（次の定期実行を待たない）
  try {
    const { cancelPendingPromoJobs, enabledPromoChannels, schedulePromoVideos } = await import('@/lib/marketing/promo-video-server')
    await cancelPendingPromoJobs(enabledPromoChannels(next))
    await schedulePromoVideos()
  } catch (error) {
    console.error('[autopilot] 動画の投稿の予約を更新できませんでした', error)
  }
  return NextResponse.json({ ok: true, settings: next })
}

export async function POST(request: NextRequest) {
  const denied = requireAdmin(request)
  if (denied) return denied
  const body = (await request.json().catch(() => ({}))) as { action?: string }
  if (body.action !== 'generate_now') return NextResponse.json({ error: '不明な操作です' }, { status: 400 })
  try {
    const result = await generateNow()
    return NextResponse.json(result, { status: result.ok ? 200 : 409 })
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: `作成に失敗しました（${error instanceof Error ? error.message : '不明'}）` },
      { status: 500 },
    )
  }
}
