// ──────────────────────────────────────────────
// 会員プランの状態と日付の決まり（純粋な関数）
//
// - 最低利用期間：利用開始日から3か月（休会した月数だけ後ろにずれる）。満了日＝開始日の3か月後の前日
// - 解約：15日までに解約届を出すと当月末、16日以降は翌月末で終了
// - 最低利用期間の途中の解約は、特別な事情（入院・転居・災害・医師の運動制限など）があるときだけ
// - 休会：月初めから。休会中は月額の請求を止める（開始月から再開予定月の前月まで）
// ──────────────────────────────────────────────
import type { ContractRecord, MemberEvent, MemberPlan, MemberStatus } from '@/types/contracts'
import { escapeHtml, jaDate } from './template'

export const MIN_MONTHS = 3
export const MEMBER_PLANS: MemberPlan[] = ['一般会員', '学生会員']
export const MEMBER_FEES: Record<MemberPlan, string> = { 一般会員: '月額23,000円', 学生会員: '月額19,000円' }

const YMD = /^\d{4}-\d{2}-\d{2}$/
const YM = /^\d{4}-\d{2}$/

function pad(n: number) {
  return String(n).padStart(2, '0')
}

/** 日本時間の今日 */
export function jstToday(now: Date = new Date()): string {
  return new Date(now.getTime() + 9 * 3600 * 1000).toISOString().slice(0, 10)
}

export function addMonthsYm(ym: string, n: number): string {
  const [y, m] = ym.split('-').map(Number)
  const d = new Date(Date.UTC(y, m - 1 + n, 1))
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`
}

export function monthEnd(ym: string): string {
  const [y, m] = ym.split('-').map(Number)
  const d = new Date(Date.UTC(y, m, 0))
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`
}

/**
 * 利用開始日から（3＋休会の月数）か月の期間の最後の日。
 * 民法の期間の数え方（143条）と同じく、最後の月の「開始日と同じ日」の前日。その日が無い月（2月30日など）は、その月の末日
 */
export function minEndOf(start: string, pausedMonths = 0): string {
  const [y, m, d] = start.split('-').map(Number)
  const months = MIN_MONTHS + pausedMonths
  const targetYm = addMonthsYm(`${y}-${pad(m)}`, months)
  const last = Number(monthEnd(targetYm).slice(8, 10))
  if (d > last) return monthEnd(targetYm)
  const dt = new Date(Date.UTC(Number(targetYm.slice(0, 4)), Number(targetYm.slice(5, 7)) - 1, d))
  dt.setUTCDate(dt.getUTCDate() - 1)
  return dt.toISOString().slice(0, 10)
}

/** 解約届の提出日から契約終了日（15日までは当月末、16日以降は翌月末） */
export function cancelEndOf(submitted: string): string {
  const day = Number(submitted.slice(8, 10))
  const ym = submitted.slice(0, 7)
  return monthEnd(day <= 15 ? ym : addMonthsYm(ym, 1))
}

const LABELS: Record<MemberStatus['state'], string> = {
  none: '会員ではありません',
  upcoming: '入会予定',
  active: '会員',
  paused: '休会中',
  ending: '解約予定',
  ended: '退会',
}

/** 署名済みの会員の書類（取り消したものは除く）から、今日の状態を出す */
export function memberStatusOf(records: ContractRecord[], today: string): MemberStatus {
  const events = records
    .filter((r) => r.member && !r.voided)
    .sort((a, b) => a.signedAt.localeCompare(b.signedAt))
    .map((r) => r.member as MemberEvent)

  let cur: { plan?: MemberPlan; start: string; pauses: Array<{ from: string; months: number }>; end?: string } | null = null
  for (const ev of events) {
    if (ev.kind === 'join' && ev.start && YMD.test(ev.start)) {
      cur = { plan: ev.plan, start: ev.start, pauses: [] }
    } else if (ev.kind === 'pause' && cur && ev.pauseFrom && YM.test(ev.pauseFrom) && ev.pauseMonths) {
      cur.pauses.push({ from: ev.pauseFrom, months: ev.pauseMonths })
    } else if (ev.kind === 'cancel' && cur && ev.end && YMD.test(ev.end)) {
      cur.end = ev.end
    }
  }
  if (!cur) return { state: 'none', label: LABELS.none, pausedMonths: 0 }

  const pausedMonths = cur.pauses.reduce((s, p) => s + p.months, 0)
  const base = { plan: cur.plan, start: cur.start, minEnd: minEndOf(cur.start, pausedMonths), end: cur.end, pausedMonths }
  const ym = today.slice(0, 7)
  if (cur.end && cur.end < today) return { state: 'ended', label: LABELS.ended, ...base }
  if (cur.start > today) return { state: 'upcoming', label: LABELS.upcoming, ...base }
  const pause = cur.pauses.find((p) => ym >= p.from && ym < addMonthsYm(p.from, p.months))
  if (pause) {
    return { state: 'paused', label: LABELS.paused, resumeMonth: addMonthsYm(pause.from, pause.months), ...base }
  }
  if (cur.end) return { state: 'ending', label: LABELS.ending, ...base }
  return { state: 'active', label: LABELS.active, ...base }
}

/** 画面で入れる会員の手続きの内容 */
export interface MemberInput {
  plan?: string
  start?: string
  pauseFrom?: string
  pauseMonths?: number
  special?: boolean
  specialReason?: string
}

/**
 * 署名の前に、会員の手続きを確かめて MemberEvent を作る。おかしければ、画面に出す理由を返す
 */
export function buildMemberEvent(
  kind: MemberEvent['kind'],
  input: MemberInput,
  records: ContractRecord[],
  today: string,
): { ok: true; event: MemberEvent } | { ok: false; error: string } {
  const st = memberStatusOf(records, today)
  if (kind === 'join') {
    if (st.state === 'active' || st.state === 'paused' || st.state === 'upcoming' || st.state === 'ending') {
      return { ok: false, error: `すでに「${st.label}」です。プランを変えるときは、解約届のあとで入会してください。` }
    }
    const plan = MEMBER_PLANS.find((p) => p === input.plan)
    if (!plan) return { ok: false, error: '会員の種別（一般会員・学生会員）を選んでください。' }
    if (!input.start || !YMD.test(input.start)) return { ok: false, error: '利用開始日（最初の決済日）を入れてください。' }
    return { ok: true, event: { kind, plan, start: input.start } }
  }
  if (kind === 'pause') {
    if (st.state !== 'active') {
      return { ok: false, error: st.state === 'none' || st.state === 'ended' ? '会員プランのご契約がありません。' : `いまは「${st.label}」のため、休会届は受け付けられません。` }
    }
    if (!input.pauseFrom || !YM.test(input.pauseFrom)) return { ok: false, error: '休会の開始月を選んでください。' }
    if (input.pauseFrom < today.slice(0, 7)) return { ok: false, error: '休会の開始月は、今月か来月以降にしてください。' }
    const months = Number(input.pauseMonths)
    if (!Number.isInteger(months) || months < 1 || months > 6) return { ok: false, error: '休会の月数は1〜6か月で選んでください。' }
    return { ok: true, event: { kind, pauseFrom: input.pauseFrom, pauseMonths: months } }
  }
  // 解約
  if (st.state === 'none' || st.state === 'ended') return { ok: false, error: '会員プランのご契約がありません。' }
  if (st.state === 'ending') return { ok: false, error: `すでに解約届を受け付けています（契約終了日 ${jaDate(st.end ?? '')}）。` }
  const end = cancelEndOf(today)
  const early = st.minEnd ? end < st.minEnd : false
  if (early && !input.special) {
    return {
      ok: false,
      error: `最低利用期間（${jaDate(st.minEnd ?? '')}まで）の途中です。入院・転居・災害・医師による運動制限などの特別な事情がある場合だけ、「特別な事情あり」にして理由を入れてください。`,
    }
  }
  if (early && !String(input.specialReason ?? '').trim()) return { ok: false, error: '特別な事情の内容を入れてください。' }
  return {
    ok: true,
    event: {
      kind,
      submitted: today,
      end,
      special: early ? true : undefined,
      specialReason: early ? String(input.specialReason ?? '').trim().slice(0, 100) : undefined,
    },
  }
}

/** 印刷・保存に入れる「会員の手続き」の枠 */
export function memberEventHtml(ev: MemberEvent, before: MemberStatus): string {
  const rows: Array<[string, string]> = []
  if (ev.kind === 'join' && ev.start && ev.plan) {
    rows.push(['会員の種別', `${ev.plan}（${MEMBER_FEES[ev.plan]}）`])
    rows.push(['利用開始日（最初の決済日）', jaDate(ev.start)])
    rows.push(['最低利用期間の満了日', jaDate(minEndOf(ev.start))])
    rows.push(['満了後', '解約のお申し出がない場合は1か月ごとに自動更新'])
  } else if (ev.kind === 'pause' && ev.pauseFrom && ev.pauseMonths) {
    const resume = addMonthsYm(ev.pauseFrom, ev.pauseMonths)
    const [y, m] = ev.pauseFrom.split('-').map(Number)
    const [ry, rm] = resume.split('-').map(Number)
    rows.push(['休会の期間', `${y}年${m}月から${ev.pauseMonths}か月（請求を止める月：${y}年${m}月〜）`])
    rows.push(['再開予定月', `${ry}年${rm}月`])
    if (before.start) rows.push(['最低利用期間の満了日（休会分を延長）', jaDate(minEndOf(before.start, before.pausedMonths + ev.pauseMonths))])
  } else if (ev.kind === 'cancel' && ev.submitted && ev.end) {
    const day = Number(ev.submitted.slice(8, 10))
    rows.push(['解約届の提出日', jaDate(ev.submitted)])
    rows.push(['契約終了日', `${jaDate(ev.end)}（${day <= 15 ? '15日までの提出のため当月末' : '16日以降の提出のため翌月末'}）`])
    const [y, m] = ev.end.split('-').map(Number)
    rows.push(['最後の決済月', `${y}年${m}月`])
    if (before.minEnd) {
      rows.push([
        '最低利用期間',
        ev.special ? `途中（満了日 ${jaDate(before.minEnd)}）・特別な事情：${ev.specialReason ?? ''}` : `満了（${jaDate(before.minEnd)}）`,
      ])
    }
  }
  if (rows.length === 0) return ''
  const title = ev.kind === 'join' ? '会員プランの入会（院の記録）' : ev.kind === 'pause' ? '会員プランの休会（院の記録）' : '会員プランの解約（院の記録）'
  return `<div class="member-box"><h3>${escapeHtml(title)}</h3><table>${rows
    .map(([k, v]) => `<tr><th>${escapeHtml(k)}</th><td>${escapeHtml(v)}</td></tr>`)
    .join('')}</table></div>`
}
