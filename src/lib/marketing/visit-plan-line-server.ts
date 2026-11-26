/**
 * 来院予定（時間を決めない予定）の LINE（サーバー専用。2026-11-26 院長「更に時間指定のない予約もlineが入るようにしてください」）
 *
 * 時間の予約と同じく2回、LINE 連携の方へ送る：
 * 1. 入れたとき・日にちを変えたとき（院内アプリの画面から /api/line-link/visit-plan）→「ご来院の予定を承りました」を1通
 *    （予約確認の LINE の設定に従う。同じ予定・同じ日にちには1通）
 * 2. 前日（投稿ジョブの定期実行から。日本時間 VISIT_PLAN_REMIND_FROM_HOUR〜REMIND_TO_HOUR 時）→「明日のご来院予定のお知らせ」を1通
 *    （前日のお知らせの設定・ご本人の受け取り「予約のお知らせ停止」に従う）。
 *    クラウドの控え（sync:clinic の pt_visit_plans）の、明日の「予定」のものだけ。取り消した・来院した・日にちを変えた予定、
 *    入れるときに「LINE でお知らせする」を外した予定（lineOff）には送らない。
 *    今日「承りました」を送った明日の予定には、前日のお知らせは重ねない（続けて2通にならないように）
 *
 * だれの LINE かは lib/line-link-match.ts の matchLinkForPlan（カルテから選んだ予定＝そのカルテの LINE／お名前だけ＝同じお名前のカルテが1つのとき）。
 * 院内のメモは送らない。記録に残すのは、予定の ID・日にち・時刻だけ（お名前・宛先は残さない）
 */
import { kvGet, kvSet } from './kv-store-server'
import { getLineLink, listLineLinks } from '@/lib/line-link-server'
import type { LineLink } from '@/lib/line-link'
import { matchLinkForPlan } from '@/lib/line-link-match'
import { unsealUserId } from '@/lib/liff-ticket'
import { jstTomorrow } from '@/lib/reservation-message'
import { visitPlanConfirmText, visitPlanRemindText } from '@/lib/visit-plan-message'
import type { VisitPlan } from '@/lib/visit-plans'
import { getRule } from './automation-store-server'
import { lineMark } from './consent-store-server'
import { REMIND_TO_HOUR, cloudPatients, linkWhyText, type LinkFinderCache, type LinkWhy } from './line-reservation-server'
import { pushToPatient, type PushResult } from './patient-line-push-server'

/** 前日のお知らせを送りはじめる時刻（日本時間。時間の予約の前日のお知らせ＝毎朝8時 と同じ） */
export const VISIT_PLAN_REMIND_FROM_HOUR = 8
/** 1回の定期実行で見る予定の数の上限 */
const REMIND_MAX = 100

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const ID_RE = /^[A-Za-z0-9_-]{6,40}$/
/** 送った印（linesent:_vplan:c:<ID>＝承りました／linesent:_vplan:r:<ID>＝前日のお知らせ） */
const confirmKey = (id: string) => `linesent:_vplan:c:${id}`
const remindKey = (id: string) => `linesent:_vplan:r:${id}`

interface PlanMark {
  date: string
  at: string
  /** テストの見本（院長あて）で済ませた。あとで「動かす」にしたら、ご本人へ送る */
  test?: boolean
  /** 送らなかった理由（今日「承りました」を送った など） */
  skipped?: string
}

export interface PlanNotice {
  /** LINE 連携の方だった */
  linked: boolean
  /** ご本人の LINE に届いた（テストの見本は false） */
  delivered: boolean
  result: PushResult['result'] | 'not_linked' | 'invalid' | 'past'
  /** LINE 連携を見つけた道すじ・見つからなかった理由（お名前などは入らない） */
  why?: LinkWhy | 'seal'
  note: string
}

function jstParts(now = new Date()): { date: string; hour: number } {
  const t = new Date(now.getTime() + 9 * 60 * 60 * 1000)
  return { date: t.toISOString().slice(0, 10), hour: t.getUTCHours() }
}

const jstDateOf = (iso: string): string => {
  const ms = Date.parse(iso)
  return Number.isFinite(ms) ? jstParts(new Date(ms)).date : ''
}

/** クラウドの控えの来院予定（読めなければ空） */
export async function cloudVisitPlans(): Promise<VisitPlan[]> {
  try {
    const record = await kvGet<{ payload?: Record<string, string> }>('sync:clinic')
    const raw = record?.payload?.pt_visit_plans
    const list = raw ? (JSON.parse(raw) as VisitPlan[]) : []
    return Array.isArray(list) ? list.filter((p) => p && typeof p === 'object') : []
  } catch {
    return []
  }
}

/** 来院予定の方の LINE 連携（決まりは lib/line-link-match.ts の matchLinkForPlan） */
export async function resolveLinkForPlan(plan: { patientId?: string; name?: string }, cache: LinkFinderCache = {}): Promise<{ link: LineLink | null; why: LinkWhy }> {
  try {
    const patients = await cloudPatients(cache)
    if (!cache.links) cache.links = await listLineLinks()
    const m = matchLinkForPlan(plan, patients, cache.links)
    if (!m.linked) return { link: null, why: m.why }
    const link = await getLineLink(m.link.key)
    return link ? { link, why: m.how } : { link: null, why: 'karte_not_linked' }
  } catch {
    return { link: null, why: 'error' }
  }
}

/** 1. 入れたとき・日にちを変えたとき：「ご来院の予定を承りました」を1通 */
export async function confirmVisitPlan(
  input: { id?: string; date?: string; patientId?: string; name?: string },
  opts: { now?: Date } = {},
): Promise<PlanNotice> {
  const id = String(input.id ?? '')
  const date = String(input.date ?? '')
  const name = String(input.name ?? '').trim()
  if (!ID_RE.test(id) || !DATE_RE.test(date) || !name) return { linked: false, delivered: false, result: 'invalid', note: '予定の ID・日にち・お名前が読めません' }
  if (date < jstParts(opts.now).date) return { linked: false, delivered: false, result: 'past', note: '過ぎた日の予定' }
  const patientId = typeof input.patientId === 'string' && input.patientId ? input.patientId : undefined
  const { link, why } = await resolveLinkForPlan({ patientId, name })
  if (!link) return { linked: false, delivered: false, result: 'not_linked', why, note: `LINE連携していない方（${linkWhyText(why)}）` }
  const userId = unsealUserId(link.sealed, process.env.RESERVATION_NOTIFY_SECRET ?? '')
  if (!userId) return { linked: false, delivered: false, result: 'not_linked', why: 'seal', note: 'LINEの宛先を開けません' }
  const r = await pushToPatient({
    automation: 'reservation_confirm',
    userId,
    text: visitPlanConfirmText({ name: link.name, date }),
    note: '来院予定（時間を決めない）の確定',
    // 同じ予定・同じ日にちには1通（日にちを変えたら、新しい日にちでもう1通）
    dedupe: { day: date, mark: (test) => ['visitplan-confirm', test ? 'test' : 'live', lineMark(userId), id].join('|') },
  })
  if (r.result === 'sent' || r.result === 'test') {
    await kvSet(confirmKey(id), { date, at: (opts.now ?? new Date()).toISOString(), test: r.result === 'test' || undefined } satisfies PlanMark)
  }
  return { linked: true, delivered: r.delivered, result: r.result, why, note: r.reason ?? r.result }
}

/** 2. 前日のお知らせ（定期実行から。時間帯の外・送り済みは何もしない） */
export async function runVisitPlanReminders(now = new Date()): Promise<{ sent: number; skipped: number; reason?: string }> {
  const { date: today, hour } = jstParts(now)
  if (hour < VISIT_PLAN_REMIND_FROM_HOUR || hour >= REMIND_TO_HOUR) return { sent: 0, skipped: 0, reason: `送る時間外（${VISIT_PLAN_REMIND_FROM_HOUR}〜${REMIND_TO_HOUR}時）` }
  const tomorrow = jstTomorrow(now)
  const plans = (await cloudVisitPlans())
    .filter((p) => p.date === tomorrow && p.status === 'planned' && !p.lineOff && ID_RE.test(String(p.id ?? '')) && String(p.name ?? '').trim())
    .slice(0, REMIND_MAX)
  if (plans.length === 0) return { sent: 0, skipped: 0 }
  const secret = process.env.RESERVATION_NOTIFY_SECRET ?? ''
  const testing = (await getRule('reservation_remind')).mode === 'test'
  const cache: LinkFinderCache = {}
  let sent = 0
  let skipped = 0
  for (const plan of plans) {
    const done = await kvGet<PlanMark>(remindKey(plan.id))
    // この日にちの分は済み（見本だけのものは、「動かす」になったらご本人へ）
    if (done && done.date === plan.date && (!done.test || testing)) continue
    const finish = (mark: Omit<PlanMark, 'date' | 'at'> = {}) => kvSet(remindKey(plan.id), { date: plan.date, at: now.toISOString(), ...mark } satisfies PlanMark)
    // 今日「承りました」を送った明日の予定には、前日のお知らせを重ねない
    const confirmed = await kvGet<PlanMark>(confirmKey(plan.id))
    // （「承りました」が見本だけで、前日のお知らせは「動かす」のときは、ご本人にはまだ何も届いていないので送る）
    if (confirmed && confirmed.date === plan.date && jstDateOf(confirmed.at) === today && (!confirmed.test || testing)) {
      skipped += 1
      await finish({ skipped: 'confirmed_today', test: confirmed.test })
      continue
    }
    // LINE 連携の無い方は、印を付けずに次へ（あとで連携したら、その日のうちの次の回に送る）
    const { link } = await resolveLinkForPlan(plan, cache)
    const userId = link ? unsealUserId(link.sealed, secret) : null
    if (!link || !userId) {
      skipped += 1
      continue
    }
    const r = await pushToPatient({
      automation: 'reservation_remind',
      userId,
      text: visitPlanRemindText({ name: link.name, date: plan.date }, now),
      note: '前日のお知らせ（来院予定・時間を決めない）',
      requireConsent: true,
      dedupe: { day: plan.date, mark: (test) => ['visitplan-remind', test ? 'test' : 'live', lineMark(userId), plan.id].join('|') },
    })
    if (r.result === 'sent') sent += 1
    else skipped += 1
    // 上限・送れなかったときは、次の回にもう一度（それ以外は、その予定は終わり）
    if (r.result !== 'limited' && r.result !== 'error') {
      const sample = r.result === 'test' || (r.result === 'duplicate' && !r.delivered)
      await finish({ test: sample || undefined, skipped: r.result === 'sent' || sample ? undefined : r.result })
    }
  }
  return { sent, skipped }
}
