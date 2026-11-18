// ──────────────────────────────────────────────
// 再評価の予定日とマーク（純粋な関数。画面は ReevalMark・ReevalPanel、保存は reeval/store.ts）
//
// マークの決まり（日本時間の今日と予定日の差で決める）
//   予定日の4日以上前 … 通常表示（マークなし）
//   3日前〜前日       … 「評価まもなく」
//   当日              … 「要再評価」
//   過ぎた            … 「評価期限超過」
//   正式な再評価を完了 … マークを外し、次回の予定日を入れる（決めなければ予定なし）
//
// - 予定日は、担当者が決めたときだけ入る（7日後・14日後・28日後・日付をえらぶ）。全員に一律では入れない
// - SOAP の「再評価予定」に日付を書いて保存したときは、その日を予定日にする（院長がカルテで決めた予定を優先）
// - 前に書いたカルテの日付から、予定日を推測して入れることはしない（過去の方が一斉に「期限超過」にならないように）
// - ふつうの施術の記録（SOAP）を保存しただけでは、再評価の完了にしない
// - 延期は、理由と変えた日を残す
// ──────────────────────────────────────────────
import type { ReevalEvent, ReevalInterval, ReevalPlan, ReevalState } from '@/types/reeval'

export const REEVAL_KEY = 'pt_reeval_plans'
/** 「評価まもなく」を出す日数（予定日の3日前から） */
export const REEVAL_SOON_DAYS = 3
/** えらぶときに最初に選んである間隔（全員に入れるわけではない） */
export const DEFAULT_REEVAL_INTERVAL: ReevalInterval = 14
export const REEVAL_INTERVALS: { value: ReevalInterval; label: string }[] = [
  { value: 7, label: '7日後' },
  { value: 14, label: '14日後' },
  { value: 28, label: '28日後' },
  { value: 'custom', label: '日付をえらぶ' },
]
/** 履歴に残す件数（古いものから落とす） */
const MAX_EVENTS = 60

export const REEVAL_LABELS: Record<'soon' | 'due' | 'overdue', string> = {
  soon: '評価まもなく',
  due: '要再評価',
  overdue: '評価期限超過',
}

const YMD = /^\d{4}-\d{2}-\d{2}$/

export function isYmd(v: unknown): v is string {
  if (typeof v !== 'string' || !YMD.test(v)) return false
  const [y, m, d] = v.split('-').map(Number)
  const t = new Date(Date.UTC(y, m - 1, d))
  return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d
}

/** 日本時間の今日（YYYY-MM-DD） */
export function jstToday(now: Date = new Date()): string {
  return new Date(now.getTime() + 9 * 3600 * 1000).toISOString().slice(0, 10)
}

export function addDaysYmd(ymd: string, n: number): string {
  const [y, m, d] = ymd.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10)
}

/** to − from の日数（どちらも YYYY-MM-DD。時差の影響を受けない） */
export function daysBetween(from: string, to: string): number {
  const [y1, m1, d1] = from.split('-').map(Number)
  const [y2, m2, d2] = to.split('-').map(Number)
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86_400_000)
}

/** 2026-11-30 → 11/30（年がちがうときは 2027/1/5） */
export function shortDate(ymd: string, today?: string): string {
  if (!isYmd(ymd)) return ymd
  const [y, m, d] = ymd.split('-').map(Number)
  return today && today.slice(0, 4) !== String(y) ? `${y}/${m}/${d}` : `${m}/${d}`
}

export interface ReevalStatus {
  state: ReevalState
  dueDate: string | null
  lastDate: string | null
  /** 予定日まであと何日（過ぎたら負の数）。予定が無ければ null */
  daysLeft: number | null
}

/**
 * マークの状態。予定が無い・やめた・カルテが「終了」の方は none
 */
export function reevalStatus(plan: ReevalPlan | null | undefined, today: string, opts: { ended?: boolean } = {}): ReevalStatus {
  const lastDate = plan?.lastDate ?? null
  if (!plan || !plan.active || opts.ended || !isYmd(plan.dueDate)) {
    return { state: 'none', dueDate: null, lastDate, daysLeft: null }
  }
  const daysLeft = daysBetween(today, plan.dueDate)
  const state: ReevalState =
    daysLeft > REEVAL_SOON_DAYS ? 'scheduled' : daysLeft >= 1 ? 'soon' : daysLeft === 0 ? 'due' : 'overdue'
  return { state, dueDate: plan.dueDate, lastDate, daysLeft }
}

/** マークに出す言葉（通常表示・予定なしは null） */
export function reevalMarkLabel(state: ReevalState): string | null {
  return state === 'soon' || state === 'due' || state === 'overdue' ? REEVAL_LABELS[state] : null
}

/** 「あと3日」「今日」「2日過ぎ」 */
export function daysLeftText(daysLeft: number | null): string {
  if (daysLeft === null) return ''
  if (daysLeft === 0) return '今日'
  return daysLeft > 0 ? `あと${daysLeft}日` : `${-daysLeft}日過ぎ`
}

// ── 予定を変える（新しい plan を返す。保存は呼ぶ側） ─────────────

type Result = { ok: true; plan: ReevalPlan } | { ok: false; error: string }

interface Base {
  /** 出来事の ID（呼ぶ側で作る） */
  eventId: string
  today: string
  /** 記録した時刻（ISO） */
  now: string
}

function emptyPlan(patientId: string, now: string): ReevalPlan {
  return { id: patientId, patientId, interval: null, dueDate: null, lastDate: null, active: true, events: [], updatedAt: now }
}

function withEvent(plan: ReevalPlan, ev: ReevalEvent, patch: Partial<ReevalPlan>): ReevalPlan {
  const events = [...(plan.events ?? []), ev].slice(-MAX_EVENTS)
  return { ...plan, ...patch, events, updatedAt: ev.at }
}

/** 間隔から予定日（7・14・28 日後）。個別は null */
export function dueFromInterval(base: string, interval: ReevalInterval): string | null {
  return interval === 'custom' ? null : addDaysYmd(base, interval)
}

function cleanReason(reason: string | undefined): string {
  return (reason ?? '').replace(/\s+/g, ' ').trim().slice(0, 120)
}

/**
 * 予定日を決める・変える。予定日より後ろへずらすときは「延期」として理由が要る。
 * 予定日は今日以降だけ（過ぎた日を入れて、いきなり「期限超過」にしない）
 */
export function setReevalDue(
  plan: ReevalPlan | null | undefined,
  input: Base & { patientId: string; due: string; interval?: ReevalInterval | null; reason?: string; source?: 'manual' | 'soap' },
): Result {
  if (!isYmd(input.due)) return { ok: false, error: '予定日をえらんでください。' }
  if (input.due < input.today) return { ok: false, error: '予定日は今日以降にしてください。' }
  const base = plan ?? emptyPlan(input.patientId, input.now)
  const prevDue = base.active && isYmd(base.dueDate) ? base.dueDate : null
  const reason = cleanReason(input.reason)
  const postpone = prevDue !== null && input.due > prevDue
  if (postpone && !reason) return { ok: false, error: '予定日を後ろにずらす（延期する）ときは、理由を書いてください。' }
  if (prevDue === input.due && base.active) return { ok: false, error: 'いまの予定日と同じです。' }
  const interval = input.interval === undefined ? base.interval : input.interval
  const ev: ReevalEvent = {
    id: input.eventId,
    kind: postpone ? 'postpone' : 'set',
    at: input.now,
    date: input.today,
    prevDue,
    nextDue: input.due,
    interval: interval ?? undefined,
    reason: reason || undefined,
    source: input.source ?? 'manual',
  }
  return { ok: true, plan: withEvent(base, ev, { active: true, dueDate: input.due, interval: interval ?? null }) }
}

/**
 * 正式な再評価をした（マークを外し、次回の予定日を入れる）。
 * next を null にすると、次回は未定（マークは出ない）
 */
export function completeReeval(
  plan: ReevalPlan | null | undefined,
  input: Base & {
    patientId: string
    /** 再評価をした日 */
    date: string
    next: { interval: ReevalInterval; due?: string } | null
    summary?: string[]
    note?: string
  },
): Result {
  if (!isYmd(input.date)) return { ok: false, error: '再評価をした日をえらんでください。' }
  if (input.date > input.today) return { ok: false, error: '再評価をした日は今日までの日にしてください。' }
  let nextDue: string | null = null
  if (input.next) {
    nextDue = input.next.interval === 'custom' ? (input.next.due ?? null) : dueFromInterval(input.date, input.next.interval)
    if (!isYmd(nextDue)) return { ok: false, error: '次回の予定日をえらんでください。' }
    if (nextDue <= input.date) return { ok: false, error: '次回の予定日は、再評価をした日より後にしてください。' }
    if (nextDue < input.today) return { ok: false, error: '次回の予定日が過ぎています。日付をえらび直してください。' }
  }
  const base = plan ?? emptyPlan(input.patientId, input.now)
  const prevDue = base.active && isYmd(base.dueDate) ? base.dueDate : null
  const lastDate = base.lastDate && base.lastDate > input.date ? base.lastDate : input.date
  const ev: ReevalEvent = {
    id: input.eventId,
    kind: 'complete',
    at: input.now,
    date: input.date,
    prevDue,
    nextDue,
    interval: input.next?.interval,
    summary: input.summary?.slice(0, 30),
    note: cleanReason(input.note) || undefined,
    source: 'manual',
  }
  return {
    ok: true,
    plan: withEvent(base, ev, {
      active: true,
      lastDate,
      dueDate: nextDue,
      interval: input.next?.interval ?? base.interval,
    }),
  }
}

/** 再評価の予定をやめる（終了・中止・医療機関へ移った など）。履歴は残す */
export function stopReeval(plan: ReevalPlan | null | undefined, input: Base & { reason: string }): Result {
  if (!plan || !plan.active) return { ok: false, error: '予定はありません。' }
  const reason = cleanReason(input.reason)
  if (!reason) return { ok: false, error: 'やめる理由を書いてください（例：施術終了、医療機関で管理）。' }
  const ev: ReevalEvent = {
    id: input.eventId,
    kind: 'stop',
    at: input.now,
    date: input.today,
    prevDue: isYmd(plan.dueDate) ? plan.dueDate : null,
    nextDue: null,
    reason,
    source: 'manual',
  }
  return { ok: true, plan: withEvent(plan, ev, { active: false, dueDate: null }) }
}

// ── SOAP の「再評価予定」 ─────────────────────────

interface SoapLike {
  visitDate: string
  nextReassessment?: string
  createdAt: string
}

/** いちばん新しく書いた SOAP の「再評価予定」（日付が入っているもの）。予定を決めるときの候補に出す */
export function soapReassessmentHint(notes: SoapLike[]): { date: string; visitDate: string } | null {
  const hit = [...notes]
    .filter((n) => isYmd(n.nextReassessment))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]
  return hit ? { date: hit.nextReassessment as string, visitDate: hit.visitDate } : null
}

/**
 * いま保存した SOAP の「再評価予定」を、予定日に入れる（変わるときだけ新しい plan を返す）。
 * 過ぎた日は入れない（前の日付でカルテを書いたときに、いきなり「期限超過」にしない）。
 * 後ろへずらすときは「SOAP の再評価予定で変更」を理由として残す
 */
export function reevalFromSoap(
  plan: ReevalPlan | null | undefined,
  input: Base & { patientId: string; nextReassessment: string | undefined; visitDate: string },
): ReevalPlan | null {
  const due = input.nextReassessment
  if (!isYmd(due) || due < input.today) return null
  if (plan?.active && plan.dueDate === due) return null
  const r = setReevalDue(plan, {
    ...input,
    due,
    source: 'soap',
    reason: `SOAP（${input.visitDate}）の「再評価予定」で変更`,
  })
  return r.ok ? r.plan : null
}

export const REEVAL_EVENT_LABELS: Record<ReevalEvent['kind'], string> = {
  set: '予定を決めた',
  postpone: '延期',
  complete: '再評価をした',
  stop: '予定をやめた',
}
