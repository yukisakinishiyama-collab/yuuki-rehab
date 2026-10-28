/**
 * 自動投稿パイプライン：設定・投稿案の取得、設定の保存、「今すぐ作る」
 *
 * GET  … 設定・直近の投稿案・接続状況（承認画面用）
 * PUT  … 設定の保存（院長のみ）
 * POST … { action: 'generate_now' } 今週の残り枠（なければ来週）の下書きを今すぐ作る（院長のみ）
 */
import { NextRequest, NextResponse } from 'next/server'
import { isInstagramConnected } from '@/lib/marketing/instagram-token'
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
  availabilityStory: z.boolean().default(true),
  generateHour: z.number().int().min(6).max(22),
  ownerNote: z.string().max(400),
  clinicProfile: z.record(z.string(), z.string().max(2000)).optional(),
})

export async function GET() {
  try {
    const [settings, proposals] = await Promise.all([getAutopilotSettings(), listProposals()])
    return NextResponse.json({
      ok: true,
      settings,
      proposals: proposals.slice(0, 6),
      connections: {
        ai: Boolean(process.env.ANTHROPIC_API_KEY) && process.env.MARKETING_MODE !== 'mock',
        instagram: await isInstagramConnected(),
        googleApi: Boolean(
          process.env.GBP_CLIENT_ID && process.env.GBP_CLIENT_SECRET && process.env.GBP_REFRESH_TOKEN && process.env.GBP_LOCATION_NAME,
        ),
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
