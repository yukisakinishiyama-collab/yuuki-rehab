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
import { requireAdmin } from '@/lib/marketing/auth'
import { generateNow } from '@/lib/marketing/autopilot-server'
import { getAutopilotSettings, listProposals, saveAutopilotSettings } from '@/lib/marketing/autopilot-store-server'
import { DEFAULT_AUTOPILOT_SETTINGS } from '@/lib/marketing/autopilot-types'
import { SettingsSchema } from '@/lib/marketing/autopilot-settings-schema'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

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
  {
    const { normalizeTimes } = await import('@/lib/marketing/daily-openings')
    next.dailyOpeningsTimes = normalizeTimes(next.dailyOpeningsTimes)
    if (next.dailyOpenings && next.dailyOpeningsTimes.length === 0) {
      return NextResponse.json({ error: '今日の空き：出す時刻を1つ以上えらんでください' }, { status: 400 })
    }
    if (next.dailyOpenings && !next.dailyOpeningsStory && !next.dailyOpeningsGoogle) {
      return NextResponse.json({ error: '今日の空き：出す先（Instagramのストーリー・Google）を1つ以上えらんでください' }, { status: 400 })
    }
  }
  if (next.recruitStory) {
    const { isUsableVideoUrl, normalizeRecruitTimes } = await import('@/lib/marketing/recruit-story')
    if (!isUsableVideoUrl(next.recruitStoryVideoUrl)) {
      return NextResponse.json({ error: '求人ストーリー：出す動画をえらんでください' }, { status: 400 })
    }
    if (normalizeRecruitTimes(next.recruitStoryTimes).length === 0) {
      return NextResponse.json({ error: '求人ストーリー：出す時刻を1つ以上えらんでください' }, { status: 400 })
    }
  }
  await saveAutopilotSettings(next)
  // 今日の空き（毎日）：オフ・時刻や出す先を変えた分は取り消し、オンなら今日の分をすぐ予定に入れる（次の定期実行を待たない）
  try {
    const { cancelPendingDailyOpenings, scheduleDailyOpenings } = await import('@/lib/marketing/daily-openings-server')
    await cancelPendingDailyOpenings(next)
    if (next.dailyOpenings) await scheduleDailyOpenings(new Date(), next)
  } catch (error) {
    console.error('[autopilot] 今日の空きの予定を更新できませんでした', error)
  }
  // 求人ストーリー：オフ・時刻や動画を変えた分は取り消し、オンなら今日の分をすぐ予定に入れる（次の定期実行を待たない）
  try {
    const { cancelPendingRecruitStories, scheduleRecruitStories } = await import('@/lib/marketing/recruit-story-server')
    await cancelPendingRecruitStories(next)
    if (next.recruitStory) await scheduleRecruitStories(new Date(), next)
  } catch (error) {
    console.error('[autopilot] 求人ストーリーの予定を更新できませんでした', error)
  }
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
