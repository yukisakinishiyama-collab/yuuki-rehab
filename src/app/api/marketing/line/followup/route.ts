/**
 * ご来院が空いている方へのご連絡（公式LINE）— 院長のみ
 *
 * 2026-11-26 院長「一定期間ご来院のない患者様にも連絡がいくように（これは事前に私に誰に送るか出して承認したものだけ）」。
 * 患者さんへ送るのは、院長が自分の LINE で承認した方にだけ（2026-11-26「承認は私のlineに一度送って承認の確認をしてください」。
 * lib/marketing/followup-approval-server.ts）。この API からは、患者さんへ直接は送らない。
 * - GET  : 設定（毎週のお願い・日数・文）・いつも最後に付く文・最近の送信・上限
 * - PUT  : { weekly?, minDays?, template? } 設定を保存
 * - POST : { action: 'check', people: [{ patientId, name }] }            … 送ってよいかを1人ずつ確かめる（送らない）
 *          { action: 'sample', template }                                 … 院長の LINE へ見本（患者さんには送らない）
 *          { action: 'request', people: [{ patientId, name, lastVisit, days }], template }
 *                                                                         … 院長の LINE へ承認のお願いを送る（患者さんにはまだ送らない）
 * 返事に、LINE の宛先は入れない
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/marketing/auth'
import { DEFAULT_FOLLOWUP_TEMPLATE, FOLLOWUP_MAX_PER_DAY, FOLLOWUP_MAX_PER_SEND, FOLLOWUP_REPEAT_DAYS, followupFooter } from '@/lib/followup-line'
import { FOLLOWUP_REQUEST_HOURS, FOLLOWUP_REQUEST_MAX } from '@/lib/followup-approval'
import { checkFollowupPeople, getFollowupLog, sendFollowupSample, type FollowupPerson } from '@/lib/marketing/followup-line-server'
import { createFollowupRequest, getFollowupSettings, saveFollowupSettings } from '@/lib/marketing/followup-approval-server'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

function readPeople(value: unknown, max: number): FollowupPerson[] {
  if (!Array.isArray(value)) return []
  return value
    .filter((p): p is { patientId: unknown; name: unknown } => Boolean(p) && typeof p === 'object')
    .map((p) => ({ patientId: typeof p.patientId === 'string' ? p.patientId.slice(0, 80) : '', name: typeof p.name === 'string' ? p.name.slice(0, 60) : '' }))
    .filter((p) => p.patientId && p.name)
    .slice(0, max)
}

export async function GET(request: NextRequest) {
  const denied = requireAdmin(request)
  if (denied) return denied
  const [log, settings] = await Promise.all([getFollowupLog(), getFollowupSettings()])
  return NextResponse.json({
    ok: true,
    settings: { weekly: settings.weekly, minDays: settings.minDays, template: settings.template },
    defaultTemplate: DEFAULT_FOLLOWUP_TEMPLATE,
    footer: followupFooter(),
    recent: log.recent.slice(0, 30),
    limits: { perRequest: FOLLOWUP_REQUEST_MAX, requestHours: FOLLOWUP_REQUEST_HOURS, perSend: FOLLOWUP_MAX_PER_SEND, perDay: FOLLOWUP_MAX_PER_DAY, repeatDays: FOLLOWUP_REPEAT_DAYS },
    lineConfigured: Boolean(process.env.LINE_CHANNEL_ACCESS_TOKEN && process.env.RESERVATION_NOTIFY_SECRET),
  })
}

export async function POST(request: NextRequest) {
  const denied = requireAdmin(request)
  if (denied) return denied
  let body: { action?: unknown; people?: unknown; template?: unknown }
  try {
    body = (await request.json()) as typeof body
  } catch {
    return NextResponse.json({ ok: false, error: '内容を読み取れませんでした' }, { status: 400 })
  }
  const template = typeof body.template === 'string' ? body.template : ''
  try {
    if (body.action === 'check') {
      return NextResponse.json({ ok: true, checks: await checkFollowupPeople(readPeople(body.people, 300)) })
    }
    if (body.action === 'sample') {
      const r = await sendFollowupSample(template)
      return NextResponse.json(r.ok ? { ok: true } : { ok: false, error: r.error }, { status: r.ok ? 200 : 400 })
    }
    if (body.action === 'request') {
      // 院長の LINE へ承認のお願いを送る。患者さんへ送るのは、院長が LINE で承認したあと
      const raw = Array.isArray(body.people) ? (body.people as Array<Record<string, unknown>>) : []
      const people = readPeople(body.people, FOLLOWUP_REQUEST_MAX + 1).map((p) => {
        const src = raw.find((r) => r && r.patientId === p.patientId) ?? {}
        return {
          ...p,
          lastVisit: typeof src.lastVisit === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(src.lastVisit) ? src.lastVisit : undefined,
          days: typeof src.days === 'number' && src.days >= 0 && src.days < 5000 ? Math.floor(src.days) : undefined,
        }
      })
      const r = await createFollowupRequest(people, template, 'page')
      console.log('[followup-line] 院長の LINE へ承認のお願い:', r.ok ? `${r.count}人` : r.error)
      return NextResponse.json(r.ok ? { ok: true, count: r.count } : { ok: false, error: r.error }, { status: r.ok ? 200 : 400 })
    }
    return NextResponse.json({ ok: false, error: 'action が正しくありません' }, { status: 400 })
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : '処理に失敗しました' }, { status: 400 })
  }
}

export async function PUT(request: NextRequest) {
  const denied = requireAdmin(request)
  if (denied) return denied
  let body: { weekly?: unknown; minDays?: unknown; template?: unknown }
  try {
    body = (await request.json()) as typeof body
  } catch {
    return NextResponse.json({ ok: false, error: '内容を読み取れませんでした' }, { status: 400 })
  }
  try {
    const s = await saveFollowupSettings(body)
    return NextResponse.json({ ok: true, settings: { weekly: s.weekly, minDays: s.minDays, template: s.template } })
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : '保存できませんでした' }, { status: 400 })
  }
}
