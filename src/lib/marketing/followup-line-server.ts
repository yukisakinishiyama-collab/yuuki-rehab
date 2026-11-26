/**
 * ご来院が空いている方へのご連絡（公式LINE）— サーバー側
 *
 * 2026-11-26 院長「一定期間ご来院のない患者様にも連絡がいくように（これは事前に私に誰に送るか出して承認したものだけ）」。
 * 自動では送らない。院長が画面（/marketing/line/followup）で送る方を選び、承認した方にだけ、そのときに送る。
 *
 * 送る前に、サーバーが1人ずつ確かめる（画面の一覧は端末のカルテから作るので、送ってよいかはここで決める）：
 * - クラウドのカルテにあり、そのカルテが LINE と結びついている（lib/line-link-match.ts。カルテの「LINE連携済み」と同じ見分け方）
 * - ご本人が「配信停止」と送っていない（お知らせ・ご挨拶の受け取り。確かめられないときも送らない）
 * - これからの予約（予約システムの ?api=upcoming）・来院予定（クラウドの控え）が無い。予約を確かめられないときも送らない
 * - FOLLOWUP_REPEAT_DAYS 日のうちに、同じご連絡を送っていない
 * 記録（keiei:followup-log）に残すのは、カルテの ID ごとの送った日と、最近の送信（お名前・日時）。LINE の宛先は残さない
 */
import { kvGet, kvSet } from './kv-store-server'
import { getLineLink, listLineLinks } from '@/lib/line-link-server'
import { matchLinkForKarte, matchLinkForPlan, matchLinkForReservation, matchName, type MatchKarte } from '@/lib/line-link-match'
import { unsealUserId } from '@/lib/liff-ticket'
import {
  FOLLOWUP_MAX_PER_DAY,
  FOLLOWUP_MAX_PER_SEND,
  canSendAgain,
  followupTemplateProblem,
  followupText,
  type FollowupBlock,
  type FollowupCheck,
} from '@/lib/followup-line'
import { recordAudit, recordRun } from './automation-store-server'
import { checkConsent } from './consent-store-server'
import { fetchUpcomingReservations } from './reservation-check-server'

const LOG_KEY = 'keiei:followup-log'

interface FollowupLog {
  /** カルテの ID → 送った日（YYYY-MM-DD。新しい順・5件まで） */
  sent: Record<string, string[]>
  /** 最近の送信（新しい順・200件まで。お名前と日時だけ） */
  recent: Array<{ at: string; name: string; ok: boolean; error?: string }>
}

export async function getFollowupLog(): Promise<FollowupLog> {
  const l = await kvGet<FollowupLog>(LOG_KEY)
  return { sent: l?.sent ?? {}, recent: l?.recent ?? [] }
}

const jstDate = (at: Date = new Date()): string => new Date(at.getTime() + 9 * 3_600_000).toISOString().slice(0, 10)

// LINE_API_BASE_URL は動作確認用（ふだんは設定しない）
const pushUrl = () => `${(process.env.LINE_API_BASE_URL ?? 'https://api.line.me').replace(/\/$/, '')}/v2/bot/message/push`

async function push(to: string, text: string): Promise<{ ok: boolean; error?: string }> {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN
  if (!token) return { ok: false, error: 'LINEの設定がありません' }
  try {
    const res = await fetch(pushUrl(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ to, messages: [{ type: 'text', text }] }),
      signal: AbortSignal.timeout(20_000),
    })
    if (res.ok) return { ok: true }
    const data = (await res.json().catch(() => ({}))) as { message?: string }
    return { ok: false, error: data.message ?? `HTTP ${res.status}` }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) }
  }
}

type CloudPlan = { patientId?: string; name?: string; date?: string; status?: string }

async function cloudData(): Promise<{ kartes: MatchKarte[]; plans: CloudPlan[] }> {
  const parse = <T>(raw: string | undefined): T[] => {
    try {
      const list = raw ? (JSON.parse(raw) as T[]) : []
      return Array.isArray(list) ? list : []
    } catch {
      return []
    }
  }
  try {
    const record = await kvGet<{ payload?: Record<string, string> }>('sync:clinic')
    return { kartes: parse<MatchKarte>(record?.payload?.pt_patients), plans: parse<CloudPlan>(record?.payload?.pt_visit_plans) }
  } catch {
    return { kartes: [], plans: [] }
  }
}

export interface FollowupPerson {
  patientId: string
  name: string
}

interface Resolved extends FollowupCheck {
  /** 送るときだけ使う（外へは返さない） */
  userId?: string
  linkName?: string
}

/** 1人ずつ、送ってよいかを確かめる（送らない）。お名前・宛先は返さない */
async function resolvePeople(people: FollowupPerson[], now: Date): Promise<Resolved[]> {
  const today = jstDate(now)
  const secret = process.env.RESERVATION_NOTIFY_SECRET ?? ''
  const [{ kartes, plans }, links, log, upcoming] = await Promise.all([cloudData(), listLineLinks(), getFollowupLog(), fetchUpcomingReservations(now)])
  // これからの予約がある方（予約の方を、お知らせを送るときと同じ決まりでカルテ・LINE に当てる）
  const reservedLinkKeys = new Map<string, string>()
  const reservedNames = new Map<string, string>()
  for (const row of upcoming?.rows ?? []) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(row.date) || row.date < today) continue
    const m = matchLinkForReservation(row, kartes, links)
    if (m.linked && !reservedLinkKeys.has(m.link.key)) reservedLinkKeys.set(m.link.key, row.date)
    const n = matchName(row.name)
    if (n && !reservedNames.has(n)) reservedNames.set(n, row.date)
  }
  const out: Resolved[] = []
  for (const person of people) {
    const patientId = String(person.patientId ?? '')
    const block = (b: FollowupBlock, detail?: string, lastSentOn?: string): Resolved => ({ patientId, sendable: false, block: b, ...(detail ? { detail } : {}), ...(lastSentOn ? { lastSentOn } : {}) })
    const lastSentOn = log.sent[patientId]?.[0]
    const karte = kartes.find((k) => String(k.id ?? '') === patientId)
    // 画面のお名前とクラウドのカルテのお名前がちがうときも、送らない（ちがう方へ送らないため）
    if (!patientId || !karte || matchName(karte.name) !== matchName(person.name)) {
      out.push(block('karte_missing', undefined, lastSentOn))
      continue
    }
    const summary = matchLinkForKarte(karte, links)
    const link = summary ? await getLineLink(summary.key) : null
    const userId = link ? unsealUserId(link.sealed, secret) : null
    if (!link || !userId) {
      out.push(block('not_linked', undefined, lastSentOn))
      continue
    }
    const consent = await checkConsent(userId, 'marketing')
    if (consent !== 'allowed') {
      out.push(block(consent === 'opted_out' ? 'opted_out' : 'consent_unknown', undefined, lastSentOn))
      continue
    }
    if (!upcoming) {
      out.push(block('reservation_unknown', undefined, lastSentOn))
      continue
    }
    const reservedOn = reservedLinkKeys.get(link.key) ?? reservedNames.get(matchName(karte.name))
    if (reservedOn) {
      out.push(block('has_reservation', reservedOn, lastSentOn))
      continue
    }
    const plan = plans
      .filter((p) => p && p.status === 'planned' && /^\d{4}-\d{2}-\d{2}$/.test(String(p.date)) && String(p.date) >= today)
      .filter((p) => {
        const m = matchLinkForPlan({ patientId: p.patientId, name: p.name }, kartes, links)
        return p.patientId === patientId || (m.linked && m.link.key === link.key)
      })
      .sort((a, b) => String(a.date).localeCompare(String(b.date)))[0]
    if (plan) {
      out.push(block('has_plan', String(plan.date), lastSentOn))
      continue
    }
    if (!canSendAgain(lastSentOn, today)) {
      out.push(block('recently_sent', lastSentOn, lastSentOn))
      continue
    }
    out.push({ patientId, sendable: true, ...(lastSentOn ? { lastSentOn } : {}), userId, linkName: link.name })
  }
  return out
}

const publicCheck = ({ patientId, sendable, block, detail, lastSentOn }: Resolved): FollowupCheck => ({
  patientId,
  sendable,
  ...(block ? { block } : {}),
  ...(detail ? { detail } : {}),
  ...(lastSentOn ? { lastSentOn } : {}),
})

/** 画面の一覧の方を、送ってよいか確かめる（送らない） */
export async function checkFollowupPeople(people: FollowupPerson[], now = new Date()): Promise<FollowupCheck[]> {
  return (await resolvePeople(people.slice(0, 300), now)).map(publicCheck)
}

/** 今日送った数（1日の上限のため） */
function sentTodayCount(log: FollowupLog, today: string): number {
  return log.recent.filter((r) => r.ok && jstDate(new Date(r.at)) === today).length
}

export interface FollowupSendResult {
  sent: number
  skipped: number
  failed: number
  results: Array<FollowupCheck & { ok: boolean; error?: string }>
}

/**
 * 院長が承認した方へ送る。送る直前にもう一度確かめ、送ってよい方にだけ送る
 * （一覧を出してから承認までの間に、予約が入った・配信停止になった方へ送らないため）
 */
export async function sendFollowups(people: FollowupPerson[], template: string, now = new Date()): Promise<FollowupSendResult> {
  const problem = followupTemplateProblem(template)
  if (problem) throw new Error(problem)
  if (people.length === 0) throw new Error('送る方が選ばれていません')
  if (people.length > FOLLOWUP_MAX_PER_SEND) throw new Error(`1回に送れるのは${FOLLOWUP_MAX_PER_SEND}人までです`)
  const today = jstDate(now)
  const resolved = await resolvePeople(people, now)
  const log = await getFollowupLog()
  let left = FOLLOWUP_MAX_PER_DAY - sentTodayCount(log, today)
  const result: FollowupSendResult = { sent: 0, skipped: 0, failed: 0, results: [] }
  const seen = new Set<string>()
  for (const r of resolved) {
    if (!r.sendable || !r.userId || seen.has(r.userId)) {
      // 同じ LINE（ご家族で1つの LINE）へは、1回の承認で1通だけ
      result.skipped += 1
      result.results.push({ ...publicCheck(r), sendable: false, ok: false, ...(r.sendable ? { error: '同じ LINE へは、今回1通だけお送りしました' } : {}) })
      continue
    }
    if (left <= 0) {
      result.skipped += 1
      result.results.push({ ...publicCheck(r), ok: false, error: `1日に送れるのは${FOLLOWUP_MAX_PER_DAY}人までです` })
      continue
    }
    seen.add(r.userId)
    const name = r.linkName ?? ''
    const sentResult = await push(r.userId, followupText(template, name))
    const at = new Date().toISOString()
    log.recent.unshift({ at, name, ok: sentResult.ok, ...(sentResult.error ? { error: sentResult.error.slice(0, 120) } : {}) })
    if (sentResult.ok) {
      left -= 1
      result.sent += 1
      log.sent[r.patientId] = [today, ...(log.sent[r.patientId] ?? [])].slice(0, 5)
      result.results.push({ ...publicCheck(r), lastSentOn: today, ok: true })
    } else {
      result.failed += 1
      result.results.push({ ...publicCheck(r), ok: false, error: sentResult.error })
    }
    await recordRun({ automation: 'followup', result: sentResult.ok ? 'sent' : 'error', note: 'ご来院が空いている方へのご連絡（院長が承認）' })
  }
  log.recent = log.recent.slice(0, 200)
  await kvSet(LOG_KEY, log)
  await recordAudit({ role: 'admin', action: 'ご来院が空いている方へ LINE', target: `${result.sent}人に送信`, detail: `選んだ ${people.length}人・送らなかった ${result.skipped}人・失敗 ${result.failed}人` })
  return result
}

/** 院長の LINE へ見本を送る（文の確認用。患者さんには送らない） */
export async function sendFollowupSample(template: string): Promise<{ ok: boolean; error?: string }> {
  const problem = followupTemplateProblem(template)
  if (problem) return { ok: false, error: problem }
  const owner = process.env.RESERVATION_NOTIFY_LINE_USER_ID
  if (!owner) return { ok: false, error: '院長のLINE（RESERVATION_NOTIFY_LINE_USER_ID）が未設定です' }
  return push(owner, `【見本】患者さんには送っていません。\n\n${followupText(template, '山田 太郎')}`)
}
