/**
 * ご来院が空いている方へのご連絡：院長の LINE での承認（サーバー専用）
 *
 * 2026-11-26 院長「日にちが開いての来院されていない患者の承認は私のlineに一度送って承認の確認をしてください」。
 * 1. 承認のお願いを作って、院長の LINE へ送る（だれに・どんな文を送るか＋ボタン）
 *    - 院内アプリの画面で選んだ方（createFollowupRequest）
 *    - 毎週の自動の候補（proposeWeeklyFollowups。月曜の朝。設定で止められる）
 * 2. 院長が LINE のボタンを押す（handleFollowupPostback。院長の LINE からのときだけ・期限の中だけ）
 *    - 全員に送る／1人ずつ選ぶ／今回は送らない
 *    - 送ってよい時間（8〜20時）なら、その場で送る。夜なら「承認済み」にして、次の朝に送る（runFollowupQueue）
 * 送るときは、今までの sendFollowups を通す（送る直前に、LINE 連携・配信停止・これからの予約などをもう一度確かめる）。
 * 承認が無い方には送らない。お願いの記録（keiei:followup-request:<ID>）に残すのは、カルテの ID・お名前・最後のご来院・状態
 */
import { randomBytes } from 'node:crypto'
import { kvGet, kvList, kvSet } from './kv-store-server'
import { patientGaps } from './patient-movement'
import { ownerCard, notifyOwner, type OwnerMessage } from './owner-notify'
import { checkFollowupPeople, sendFollowups, type FollowupPerson } from './followup-line-server'
import {
  DEFAULT_FOLLOWUP_TEMPLATE,
  FOLLOWUP_BLOCK_TEXT,
  FOLLOWUP_DEFAULT_DAYS,
  FOLLOWUP_PERIODS,
  followupCandidates,
  followupTemplateProblem,
  latestVisitDates,
  type PastReservation,
} from '@/lib/followup-line'
import {
  FOLLOWUP_REPROPOSE_DAYS,
  FOLLOWUP_REQUEST_MAX,
  followupPostback,
  inFollowupSendHours,
  jstDateOf,
  parseFollowupPostback,
  personLine,
  requestExpired,
  requestSampleText,
  requestText,
  resultText,
  weeklyRequestDue,
  type FollowupRequest,
  type RequestPerson,
} from '@/lib/followup-approval'

const SETTINGS_KEY = 'keiei:followup-settings'
const REQUEST_PREFIX = 'keiei:followup-request:'
const PROPOSED_KEY = 'keiei:followup-proposed'

export interface FollowupSettings {
  /** 毎週（月曜の朝）、候補を院長の LINE へ送る */
  weekly: boolean
  /** 何日以上空いた方を候補にするか */
  minDays: number
  /** 送る文（{name} はお名前） */
  template: string
  /** 毎週のお願いを最後に出した日（YYYY-MM-DD） */
  lastWeeklyOn?: string
  updatedAt?: string
}

export const DEFAULT_FOLLOWUP_SETTINGS: FollowupSettings = { weekly: true, minDays: FOLLOWUP_DEFAULT_DAYS, template: DEFAULT_FOLLOWUP_TEMPLATE }

export async function getFollowupSettings(): Promise<FollowupSettings> {
  const s = await kvGet<FollowupSettings>(SETTINGS_KEY).catch(() => null)
  const merged = { ...DEFAULT_FOLLOWUP_SETTINGS, ...(s ?? {}) }
  if (!FOLLOWUP_PERIODS.some((p) => p.days === merged.minDays)) merged.minDays = FOLLOWUP_DEFAULT_DAYS
  if (followupTemplateProblem(merged.template)) merged.template = DEFAULT_FOLLOWUP_TEMPLATE
  return merged
}

export async function saveFollowupSettings(input: { weekly?: unknown; minDays?: unknown; template?: unknown }): Promise<FollowupSettings> {
  const current = await getFollowupSettings()
  const next: FollowupSettings = { ...current }
  if (typeof input.weekly === 'boolean') next.weekly = input.weekly
  if (typeof input.minDays === 'number' && FOLLOWUP_PERIODS.some((p) => p.days === input.minDays)) next.minDays = input.minDays
  if (typeof input.template === 'string') {
    const problem = followupTemplateProblem(input.template)
    if (problem) throw new Error(problem)
    next.template = input.template.trim()
  }
  next.updatedAt = new Date().toISOString()
  await kvSet(SETTINGS_KEY, next)
  return next
}

const requestKey = (id: string) => `${REQUEST_PREFIX}${id}`

export async function getFollowupRequest(id: string): Promise<FollowupRequest | null> {
  return kvGet<FollowupRequest>(requestKey(id))
}

function buttons(request: FollowupRequest): OwnerMessage {
  const n = request.people.filter((p) => p.status === 'pending').length
  return ownerCard('ご連絡の承認のお願い', '承認した方にだけ送ります。', [
    { label: n > 1 ? `全員に送る（${n}人）` : 'この方に送る', postback: followupPostback('ok', request.id, 'all'), primary: true },
    ...(n > 1 ? [{ label: '1人ずつ選ぶ', postback: followupPostback('pick', request.id, 'all') }] : []),
    { label: '今回は送らない', postback: followupPostback('no', request.id, 'all') },
  ])
}

/** 承認のお願いを作って、院長の LINE へ送る（患者さんには、まだ何も送らない） */
export async function createFollowupRequest(
  people: Array<{ patientId: string; name: string; lastVisit?: string; days?: number }>,
  template: string,
  source: FollowupRequest['source'],
  now = new Date(),
): Promise<{ ok: boolean; id?: string; count?: number; error?: string }> {
  const problem = followupTemplateProblem(template)
  if (problem) return { ok: false, error: problem }
  if (people.length === 0) return { ok: false, error: '送る方が選ばれていません' }
  if (people.length > FOLLOWUP_REQUEST_MAX) return { ok: false, error: `1回のお願いは${FOLLOWUP_REQUEST_MAX}人までです` }
  const request: FollowupRequest = {
    id: randomBytes(9).toString('base64url'),
    createdAt: now.toISOString(),
    source,
    template: template.trim(),
    people: people.map((p) => ({
      patientId: p.patientId,
      name: p.name,
      ...(p.lastVisit ? { lastVisit: p.lastVisit } : {}),
      ...(typeof p.days === 'number' ? { days: p.days } : {}),
      status: 'pending' as const,
    })),
  }
  await kvSet(requestKey(request.id), request)
  const r = await notifyOwner([requestText(request), requestSampleText(request), buttons(request)])
  if (!r.delivered) return { ok: false, error: `院長の LINE に送れませんでした（${r.reason ?? '理由不明'}）` }
  // 自動の候補に、同じ方をしばらく出さない
  const proposed = (await kvGet<Record<string, string>>(PROPOSED_KEY).catch(() => null)) ?? {}
  for (const p of request.people) proposed[p.patientId] = jstDateOf(now)
  await kvSet(PROPOSED_KEY, proposed).catch(() => undefined)
  return { ok: true, id: request.id, count: request.people.length }
}

/** 承認した方へ送る（sendFollowups が、送る直前にもう一度確かめる）。結果をお願いの記録へ */
async function sendApproved(request: FollowupRequest, targets: RequestPerson[], now: Date): Promise<void> {
  if (targets.length === 0) return
  const people: FollowupPerson[] = targets.map((p) => ({ patientId: p.patientId, name: p.name }))
  try {
    const r = await sendFollowups(people, request.template, now)
    for (const one of r.results) {
      const person = targets.find((p) => p.patientId === one.patientId)
      if (!person) continue
      if (one.ok) {
        person.status = 'sent'
        delete person.note
      } else {
        person.status = one.block || !one.error ? 'skipped' : 'failed'
        person.note = one.block ? FOLLOWUP_BLOCK_TEXT[one.block] : (one.error ?? '送れませんでした')
      }
    }
  } catch (error) {
    for (const p of targets) {
      p.status = 'failed'
      p.note = error instanceof Error ? error.message : '送れませんでした'
    }
  }
}

/** 1人ずつ選ぶ：1人に1枚のカード（横に並ぶ）。押した方にだけ送る */
function pickCarousel(request: FollowupRequest): OwnerMessage {
  const pending = request.people.map((p, i) => ({ p, i })).filter(({ p }) => p.status === 'pending')
  return {
    type: 'flex',
    altText: '送る方を1人ずつ選んでください',
    contents: {
      type: 'carousel',
      contents: pending.slice(0, 12).map(({ p, i }) => ({
        type: 'bubble',
        size: 'kilo',
        body: { type: 'box', layout: 'vertical', contents: [{ type: 'text', text: personLine(p), wrap: true, size: 'sm', weight: 'bold' }] },
        footer: {
          type: 'box',
          layout: 'vertical',
          spacing: 'sm',
          contents: [
            { type: 'button', style: 'primary', color: '#0f766e', height: 'sm', action: { type: 'postback', label: 'この方に送る', data: followupPostback('ok', request.id, i), displayText: `${p.name} 様に送る` } },
            { type: 'button', style: 'secondary', height: 'sm', action: { type: 'postback', label: '見送る', data: followupPostback('no', request.id, i), displayText: `${p.name} 様は見送る` } },
          ],
        },
      })),
    },
  }
}

/** 院長が LINE のボタンを押した（Webhook が、院長の LINE からのときだけ呼ぶ）。返事を返す */
export async function handleFollowupPostback(data: string, now = new Date()): Promise<OwnerMessage[]> {
  const parsed = parseFollowupPostback(data)
  if (!parsed) return ['このボタンは使えません。']
  const request = await getFollowupRequest(parsed.id)
  if (!request) return ['このお願いは見つかりません。院内アプリの「ご来院が空いている方へ（LINE）」から、もう一度お願いを送ってください。']
  if (requestExpired(request, now)) return ['このお願いは期限が切れています（だれにも送っていません）。院内アプリから、もう一度お願いを送ってください。']
  const targets = parsed.target === 'all' ? request.people.filter((p) => p.status === 'pending') : request.people.filter((p, i) => i === parsed.target && p.status === 'pending')
  if (targets.length === 0) return [parsed.target === 'all' ? 'このお願いの方は、すべて対応済みです。' : 'この方は、もう対応済みです。']
  if (parsed.action === 'pick') return ['送る方の「この方に送る」を押してください。押した方にだけ送ります。', pickCarousel(request)]
  const later = !inFollowupSendHours(now)
  if (parsed.action === 'no') {
    for (const p of targets) p.status = 'declined'
  } else if (later) {
    for (const p of targets) p.status = 'approved'
  } else {
    await sendApproved(request, targets, now)
  }
  await kvSet(requestKey(request.id), request)
  const left = request.people.filter((p) => p.status === 'pending').length
  return [resultText(targets, later) + (left > 0 && parsed.target !== 'all' ? `\n\n（あと ${left}人は、まだ選んでいません）` : '')]
}

/** 夜に承認した分を、朝になったら送る（定期実行から。送ったら院長の LINE へ結果） */
export async function runFollowupQueue(now = new Date()): Promise<{ sent: number; skipped: number }> {
  if (!inFollowupSendHours(now)) return { sent: 0, skipped: 0 }
  const rows = await kvList<FollowupRequest>(REQUEST_PREFIX)
  let sent = 0
  let skipped = 0
  for (const { key, value } of rows) {
    if (!value || !Array.isArray(value.people)) continue
    const targets = value.people.filter((p) => p.status === 'approved')
    if (targets.length === 0) continue
    await sendApproved(value, targets, now)
    await kvSet(key, value)
    sent += targets.filter((p) => p.status === 'sent').length
    skipped += targets.filter((p) => p.status !== 'sent').length
    await notifyOwner([`📮 夜に承認いただいたご連絡を、お送りしました。\n\n${resultText(targets, false)}`]).catch(() => undefined)
  }
  return { sent, skipped }
}

type CloudRecord = { payload?: Record<string, string> }
const parse = <T>(raw: string | undefined): T[] => {
  try {
    const list = raw ? (JSON.parse(raw) as T[]) : []
    return Array.isArray(list) ? list : []
  } catch {
    return []
  }
}

/**
 * サーバーで候補を出す（毎週の自動のお願い用）。クラウドのカルテ（SOAP・来院記録・NOAH の最終来院・来院予定の「来院した」）と、
 * 確定の LINE を送った予約（linesent:）の日にちから「最後のご来院」を出す。
 * 画面（端末のカルテ＋予約の表の過去60日）より材料が少ないので、最後のご来院の日にちを、お願いの文に必ず出す
 */
export async function cloudFollowupCandidates(minDays: number, now = new Date()) {
  const today = jstDateOf(now)
  const record = await kvGet<CloudRecord>('sync:clinic').catch(() => null)
  const patients = parse<{ id: string; name: string; phone: string; status: string; firstVisitDate?: string; noah?: { lastVisit?: string; visitCount?: number } }>(record?.payload?.pt_patients)
  const visits = [
    ...parse<{ patientId: string; visitDate: string }>(record?.payload?.pt_soap_notes).map((n) => ({ patientId: n.patientId, visitDate: n.visitDate })),
    ...parse<{ patientId: string; visitDate: string; status?: string }>(record?.payload?.pt_attendance_records).filter((a) => a.status === 'visited').map((a) => ({ patientId: a.patientId, visitDate: a.visitDate })),
  ]
  const visited = parse<{ patientId?: string; name?: string; date?: string; status?: string }>(record?.payload?.pt_visit_plans).filter((p) => p.status === 'visited')
  // 確定の LINE を送った予約（LINE 連携の方の予約。キーは「電話|お名前」）。過ぎた日のものは「来られた」とみる
  const sentRows = await kvList<{ reservationNo?: string; key?: string; date?: string }>('linesent:').catch(() => [])
  const past: PastReservation[] = sentRows
    .map((r) => r.value)
    .filter((v): v is { reservationNo: string; key: string; date: string } => Boolean(v && v.reservationNo && v.key && v.key.includes('|') && v.date && v.date < today))
    .map((v) => ({ date: v.date, phone: v.key.split('|')[0], name: v.key.split('|').slice(1).join('|'), status: '確定' }))
  const gaps = patientGaps(patients, visits, today)
  const people = gaps.map((g) => ({ id: g.id, name: g.name, phone: g.phone, visits: g.visits, lastVisit: g.lastVisit }))
  return followupCandidates(people, latestVisitDates(people, past, visited, today), today, minDays)
}

/** 毎週の自動のお願い（定期実行から。月曜の朝に1回。設定で止められる。候補がいなければ何も送らない） */
export async function proposeWeeklyFollowups(now = new Date()): Promise<{ proposed: number; reason?: string }> {
  const settings = await getFollowupSettings()
  if (!settings.weekly) return { proposed: 0, reason: '毎週のお願いは止めています' }
  if (!weeklyRequestDue(now, settings.lastWeeklyOn)) return { proposed: 0, reason: '出す時間ではない・今週は出しました' }
  const today = jstDateOf(now)
  // 先に「今週は出した」にする（15分ごとの定期実行で、同じお願いを重ねて送らない）
  await kvSet(SETTINGS_KEY, { ...settings, lastWeeklyOn: today })
  const candidates = await cloudFollowupCandidates(settings.minDays, now)
  if (candidates.length === 0) return { proposed: 0, reason: '候補なし' }
  const proposed = (await kvGet<Record<string, string>>(PROPOSED_KEY).catch(() => null)) ?? {}
  const fresh = candidates.filter((c) => {
    const last = proposed[c.patientId]
    return !last || (Date.parse(`${today}T00:00:00Z`) - Date.parse(`${last}T00:00:00Z`)) / 86_400_000 >= FOLLOWUP_REPROPOSE_DAYS
  })
  if (fresh.length === 0) return { proposed: 0, reason: '新しい候補なし' }
  const checks = await checkFollowupPeople(fresh.slice(0, 100).map((c) => ({ patientId: c.patientId, name: c.name })), now)
  const ok = new Set(checks.filter((c) => c.sendable).map((c) => c.patientId))
  const picked = fresh.filter((c) => ok.has(c.patientId)).slice(0, FOLLOWUP_REQUEST_MAX)
  if (picked.length === 0) return { proposed: 0, reason: 'LINE で送れる候補なし' }
  const r = await createFollowupRequest(picked.map((c) => ({ patientId: c.patientId, name: c.name, lastVisit: c.lastVisit, days: c.days })), settings.template, 'weekly', now)
  return r.ok ? { proposed: picked.length } : { proposed: 0, reason: r.error }
}
