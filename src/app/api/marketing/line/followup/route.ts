/**
 * ご来院が空いている方へのご連絡（公式LINE）— 院長のみ
 *
 * 2026-11-26 院長「一定期間ご来院のない患者様にも連絡がいくように（これは事前に私に誰に送るか出して承認したものだけ）」。
 * 自動では送らない。送るのは、院長が画面で選んで承認した方にだけ（lib/marketing/followup-line-server.ts）。
 * - GET  : 初めの文・いつも最後に付く文・最近の送信・上限
 * - POST : { action: 'check', people: [{ patientId, name }] } … 送ってよいかを1人ずつ確かめる（送らない）
 *          { action: 'sample', template }                      … 院長の LINE へ見本（患者さんには送らない）
 *          { action: 'send', people, template }                … 承認した方へ送る（送る直前にもう一度確かめる）
 * 返事に、LINE の宛先は入れない
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/marketing/auth'
import { DEFAULT_FOLLOWUP_TEMPLATE, FOLLOWUP_MAX_PER_DAY, FOLLOWUP_MAX_PER_SEND, FOLLOWUP_REPEAT_DAYS, followupFooter } from '@/lib/followup-line'
import { checkFollowupPeople, getFollowupLog, sendFollowupSample, sendFollowups, type FollowupPerson } from '@/lib/marketing/followup-line-server'

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
  const log = await getFollowupLog()
  return NextResponse.json({
    ok: true,
    defaultTemplate: DEFAULT_FOLLOWUP_TEMPLATE,
    footer: followupFooter(),
    recent: log.recent.slice(0, 30),
    limits: { perSend: FOLLOWUP_MAX_PER_SEND, perDay: FOLLOWUP_MAX_PER_DAY, repeatDays: FOLLOWUP_REPEAT_DAYS },
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
    if (body.action === 'send') {
      // 上限より多く選ばれていたら、送らずに知らせる（黙って一部だけ送らない）
      const people = readPeople(body.people, FOLLOWUP_MAX_PER_SEND + 1)
      const r = await sendFollowups(people, template)
      console.log('[followup-line] 院長が承認して送信:', `送った ${r.sent}・送らなかった ${r.skipped}・失敗 ${r.failed}`)
      return NextResponse.json({ ok: true, ...r })
    }
    return NextResponse.json({ ok: false, error: 'action が正しくありません' }, { status: 400 })
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : '処理に失敗しました' }, { status: 400 })
  }
}
