/**
 * 誕生日のご挨拶（公式LINE）の設定と状況（院長のみ）
 * - GET  : 設定・この先14日の対象・最近の送信
 * - PUT  : { enabled, template } を保存
 * - POST : { sample: true } 院長のLINEへ見本を送る
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/marketing/auth'
import { getLog, getSettings, saveSettings, sendSample, upcoming, DEFAULT_TEMPLATE } from '@/lib/marketing/birthday-server'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const denied = requireAdmin(request)
  if (denied) return denied
  const [settings, list, log] = await Promise.all([getSettings(), upcoming(14), getLog()])
  return NextResponse.json({
    ok: true,
    settings,
    defaultTemplate: DEFAULT_TEMPLATE,
    upcoming: list,
    recent: log.recent.slice(0, 20),
    lineConfigured: Boolean(process.env.LINE_CHANNEL_ACCESS_TOKEN),
  })
}

export async function PUT(request: NextRequest) {
  const denied = requireAdmin(request)
  if (denied) return denied
  let body: { enabled?: unknown; template?: unknown }
  try {
    body = (await request.json()) as typeof body
  } catch {
    return NextResponse.json({ ok: false, error: '内容を読み取れませんでした' }, { status: 400 })
  }
  const template = typeof body.template === 'string' ? body.template.trim().slice(0, 500) : ''
  if (!template) return NextResponse.json({ ok: false, error: '文面を入れてください' }, { status: 400 })
  if (!/\{name\}|\{氏名\}/.test(template)) return NextResponse.json({ ok: false, error: '文面に {name}（お名前が入る場所）を入れてください' }, { status: 400 })
  const settings = { enabled: Boolean(body.enabled), template }
  await saveSettings(settings)
  return NextResponse.json({ ok: true, settings })
}

export async function POST(request: NextRequest) {
  const denied = requireAdmin(request)
  if (denied) return denied
  let body: { sample?: unknown; template?: unknown }
  try {
    body = (await request.json()) as typeof body
  } catch {
    return NextResponse.json({ ok: false, error: '内容を読み取れませんでした' }, { status: 400 })
  }
  if (!body.sample) return NextResponse.json({ ok: false, error: 'sample が要ります' }, { status: 400 })
  const template = typeof body.template === 'string' && body.template.trim() ? body.template.slice(0, 500) : (await getSettings()).template
  const r = await sendSample(template)
  return NextResponse.json(r.ok ? { ok: true } : { ok: false, error: r.error }, { status: r.ok ? 200 : 502 })
}
