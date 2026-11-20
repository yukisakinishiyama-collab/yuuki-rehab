// ──────────────────────────────────────────────
// 会員プランの状態と日付の決まり（純粋な関数）
//
// - 最低利用期間：利用開始日から3か月（休会した月数だけ後ろにずれる）。満了日＝開始日の3か月後の前日
// - 解約：15日までに解約届を出すと当月末、16日以降は翌月末で終了
// - 最低利用期間の途中の解約は、特別な事情（入院・転居・災害・医師の運動制限など）があるときだけ
// - 休会：月初めから。休会中は月額の請求を止める（開始月から再開予定月の前月まで）
// - 兄弟・親子プラン（2名まで・月額30,000円）：契約・休会・解約は契約者（代表）のカルテで行い、
//   もう1名の方のカルテにも、代表の方の契約から会員の状態を出す
// ──────────────────────────────────────────────
import type { ContractRecord, MemberEvent, MemberPartner, MemberPlan, MemberStatus } from '@/types/contracts'
import { escapeHtml, jaDate } from './template'
import { MEMBER_PART_FEE_TEXT } from './member-guide'

export const MIN_MONTHS = 3
export const PAIR_PLAN: MemberPlan = '兄弟・親子プラン'
export const MEMBER_PLANS: MemberPlan[] = ['一般会員', '学生会員', PAIR_PLAN]
export const MEMBER_FEES: Record<MemberPlan, string> = {
  一般会員: '月額23,000円',
  学生会員: '月額19,000円',
  '兄弟・親子プラン': '月額30,000円・2名まで',
}

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

  let cur: { plan?: MemberPlan; start: string; partner?: MemberPartner; pauses: Array<{ from: string; months: number }>; end?: string } | null = null
  for (const ev of events) {
    if (ev.kind === 'join' && ev.start && YMD.test(ev.start)) {
      cur = { plan: ev.plan, start: ev.start, partner: ev.plan === PAIR_PLAN ? ev.partner : undefined, pauses: [] }
    } else if (ev.kind === 'pause' && cur && ev.pauseFrom && YM.test(ev.pauseFrom) && ev.pauseMonths) {
      cur.pauses.push({ from: ev.pauseFrom, months: ev.pauseMonths })
    } else if (ev.kind === 'cancel' && ev.paper && YMD.test(ev.paper.start) && ev.end && YMD.test(ev.end)) {
      // 紙の入会申込書で入会した方の解約届：紙の契約（プラン・利用開始日）から始まり、この届で終わる
      const p = ev.paper
      cur = { plan: p.plan, start: p.start, partner: p.plan === PAIR_PLAN ? p.partner : undefined, pauses: [], end: ev.end }
    } else if (ev.kind === 'cancel' && cur && ev.end && YMD.test(ev.end)) {
      cur.end = ev.end
    }
  }
  if (!cur) return { state: 'none', label: LABELS.none, pausedMonths: 0 }

  const pausedMonths = cur.pauses.reduce((s, p) => s + p.months, 0)
  const base = { plan: cur.plan, start: cur.start, minEnd: minEndOf(cur.start, pausedMonths), end: cur.end, pausedMonths, partner: cur.partner }
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

/**
 * ある患者さんの会員の状態。ご自身の契約が無い（または終わっている）ときは、
 * 兄弟・親子プランの「もう1名」として登録されている契約者（代表）の契約から状態を出す（via に代表の方）
 */
export function memberStatusForPatient(patientId: string, allRecords: ContractRecord[], today: string): MemberStatus {
  const own = memberStatusOf(
    allRecords.filter((r) => r.patientId === patientId),
    today,
  )
  if (own.state !== 'none' && own.state !== 'ended') return own
  const reps = new Map<string, string>()
  for (const r of allRecords) {
    if (r.voided || r.patientId === patientId || !r.member) continue
    const partnerId = r.member.kind === 'join' ? r.member.partner?.patientId : r.member.kind === 'cancel' ? r.member.paper?.partner?.patientId : undefined
    if (partnerId === patientId) reps.set(r.patientId, r.patientName)
  }
  const order: MemberStatus['state'][] = ['active', 'paused', 'ending', 'upcoming', 'ended']
  let best: MemberStatus | null = null
  for (const [repId, repName] of reps) {
    const st = memberStatusOf(
      allRecords.filter((r) => r.patientId === repId),
      today,
    )
    // 代表の方のいまの契約で、この方がもう1名になっているときだけ
    if (st.state === 'none' || st.partner?.patientId !== patientId) continue
    if (!best || order.indexOf(st.state) < order.indexOf(best.state)) best = { ...st, via: { patientId: repId, name: repName } }
  }
  if (best && (own.state === 'none' || best.state !== 'ended')) return best
  return own
}

/** 画面で入れる会員の手続きの内容 */
export interface MemberInput {
  plan?: string
  start?: string
  /** 兄弟・親子プランのもう1名 */
  partnerName?: string
  partnerRelation?: string
  partnerBirthDate?: string
  partnerPatientId?: string
  pauseFrom?: string
  pauseMonths?: number
  special?: boolean
  specialReason?: string
  /** 解約届：紙の入会申込書で入会した方（アプリに入会の記録が無い）。プラン（plan）ともう1名（partner…）は入会と同じ欄を使う */
  paper?: boolean
  /** 紙の入会申込書の利用開始日（最初の決済日） */
  paperStart?: string
}

/** 兄弟・親子プランのもう1名（入会・紙の契約の解約で同じ確かめ方） */
function partnerOf(input: MemberInput): { ok: true; partner: MemberPartner } | { ok: false; error: string } {
  const name = String(input.partnerName ?? '').trim().slice(0, 40)
  if (!name) return { ok: false, error: '兄弟・親子プランの、もう1名の利用者のお名前を入れてください。' }
  const relation = String(input.partnerRelation ?? '').trim().slice(0, 20)
  if (!relation) return { ok: false, error: 'もう1名の方の続柄（契約者との関係）を入れてください。' }
  const birthDate = input.partnerBirthDate && YMD.test(input.partnerBirthDate) ? input.partnerBirthDate : undefined
  const patientId = input.partnerPatientId && /^[A-Za-z0-9_-]{1,64}$/.test(input.partnerPatientId) ? input.partnerPatientId : undefined
  return { ok: true, partner: { name, relation, birthDate, patientId } }
}

/** アプリに会員の記録が無い（または終わっている）ので、紙の入会申込書の内容で解約届を書ける */
export function canUsePaperCancel(status: MemberStatus): boolean {
  return !status.via && (status.state === 'none' || status.state === 'ended')
}

/**
 * 解約届で入れた紙の契約の内容から、「解約の前の状態」を作る（最低利用期間・ご契約内容の枠・記入欄の利用開始日に使う）。
 * プランか利用開始日がまだなら null
 */
export function paperStatusOf(input: MemberInput, today: string): MemberStatus | null {
  const plan = MEMBER_PLANS.find((p) => p === input.plan)
  const start = input.paperStart && YMD.test(input.paperStart) && input.paperStart <= today ? input.paperStart : ''
  if (!plan || !start) return null
  const partner = plan === PAIR_PLAN ? partnerOf(input) : null
  return {
    state: 'active',
    label: LABELS.active,
    plan,
    start,
    minEnd: minEndOf(start),
    pausedMonths: 0,
    partner: partner && partner.ok ? partner.partner : undefined,
  }
}

/** 署名する書類の「手続きの前の状態」。紙の契約の解約届なら、紙の内容から */
export function statusBeforeOf(kind: MemberEvent['kind'] | undefined, input: MemberInput, status: MemberStatus, today: string): MemberStatus {
  if (kind === 'cancel' && input.paper && canUsePaperCancel(status)) return paperStatusOf(input, today) ?? status
  return status
}

/**
 * 署名の前に、会員の手続きを確かめて MemberEvent を作る。おかしければ、画面に出す理由を返す
 */
export function buildMemberEvent(
  kind: MemberEvent['kind'],
  input: MemberInput,
  records: ContractRecord[],
  today: string,
  /** 兄弟・親子プランのもう1名として登録されているときの状態（memberStatusForPatient の via つき） */
  covered?: MemberStatus,
): { ok: true; event: MemberEvent } | { ok: false; error: string } {
  const st = memberStatusOf(records, today)
  if (covered?.via && covered.state !== 'ended' && (st.state === 'none' || st.state === 'ended')) {
    return {
      ok: false,
      error:
        kind === 'join'
          ? `${covered.via.name}さんの兄弟・親子プランのもう1名として登録されています（${covered.label}）。別に入会するときは、先に${covered.via.name}さんのプランの手続きを確かめてください。`
          : `兄弟・親子プランの休会・解約は、契約者の${covered.via.name}さんのカルテで手続きしてください（2名分まとめての扱いです）。`,
    }
  }
  if (kind === 'join') {
    if (st.state === 'active' || st.state === 'paused' || st.state === 'upcoming' || st.state === 'ending') {
      return { ok: false, error: `すでに「${st.label}」です。プランを変えるときは、解約届のあとで入会してください。` }
    }
    const plan = MEMBER_PLANS.find((p) => p === input.plan)
    if (!plan) return { ok: false, error: '会員の種別（一般会員・学生会員・兄弟・親子プラン）を選んでください。' }
    if (!input.start || !YMD.test(input.start)) return { ok: false, error: '利用開始日（最初の決済日）を入れてください。' }
    if (plan !== PAIR_PLAN) return { ok: true, event: { kind, plan, start: input.start } }
    const partner = partnerOf(input)
    if (!partner.ok) return partner
    return { ok: true, event: { kind, plan, start: input.start, partner: partner.partner } }
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
  let paper: MemberEvent['paper']
  let before = st
  if (st.state === 'none' || st.state === 'ended') {
    // アプリに入会の記録が無い：紙の入会申込書で入会した方なら、紙の契約の内容を入れて解約届を書ける（2026-11-20）
    if (!input.paper) {
      return {
        ok: false,
        error: '会員プランの入会の記録がアプリにありません。紙の入会申込書でご契約の方は、下の「紙の入会申込書で入会した方」にチェックして、プランと利用開始日を入れてください。',
      }
    }
    const plan = MEMBER_PLANS.find((p) => p === input.plan)
    if (!plan) return { ok: false, error: '紙の申込書の会員の種別（一般会員・学生会員・兄弟・親子プラン）を選んでください。' }
    if (!input.paperStart || !YMD.test(input.paperStart)) return { ok: false, error: '紙の申込書の利用開始日（最初の決済日）を入れてください。' }
    if (input.paperStart > today) return { ok: false, error: '紙の申込書の利用開始日が今日より後になっています。日付を確かめてください。' }
    let partner: MemberPartner | undefined
    if (plan === PAIR_PLAN) {
      const p = partnerOf(input)
      if (!p.ok) return p
      partner = p.partner
    }
    paper = { plan, start: input.paperStart, partner }
    before = paperStatusOf(input, today) ?? st
  }
  if (before.state === 'ending') return { ok: false, error: `すでに解約届を受け付けています（契約終了日 ${jaDate(before.end ?? '')}）。` }
  const end = cancelEndOf(today)
  const early = before.minEnd ? end < before.minEnd : false
  if (early && !input.special) {
    return {
      ok: false,
      error: `最低利用期間（${jaDate(before.minEnd ?? '')}まで）の途中です。入院・転居・災害・医師による運動制限などの特別な事情がある場合だけ、「特別な事情あり」にして理由を入れてください。`,
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
      ...(paper ? { paper } : {}),
    },
  }
}

/** 会員の手続きの中身（見出しと値の組）。書類の頭の「ご契約内容」の枠（summary.ts）と、下の memberEventHtml で使う */
export function memberEventRows(ev: MemberEvent, before: MemberStatus): Array<[string, string]> {
  const rows: Array<[string, string]> = []
  if (ev.kind === 'join' && ev.start && ev.plan) {
    rows.push(['会員の種別', `${ev.plan}（${MEMBER_FEES[ev.plan]}）`])
    if (ev.partner) {
      rows.push([
        'もう1名の利用者',
        `${ev.partner.name}（${ev.partner.relation ?? ''}${ev.partner.birthDate ? `・${jaDate(ev.partner.birthDate)}生` : ''}）`,
      ])
      rows.push(['1部位施術料', `来院した方ごと・施術した部位ごとに${MEMBER_PART_FEE_TEXT}`])
    }
    rows.push(['利用開始日（最初の決済日）', jaDate(ev.start)])
    rows.push(['最低利用期間の満了日', jaDate(minEndOf(ev.start))])
    rows.push(['満了後', '解約のお申し出がない場合は1か月ごとに自動更新'])
  } else if (ev.kind === 'pause' && ev.pauseFrom && ev.pauseMonths) {
    if (before.partner) rows.push(['対象', `兄弟・親子プラン（契約者と ${before.partner.name}さんの2名分）`])
    const resume = addMonthsYm(ev.pauseFrom, ev.pauseMonths)
    const [y, m] = ev.pauseFrom.split('-').map(Number)
    const [ry, rm] = resume.split('-').map(Number)
    rows.push(['休会の期間', `${y}年${m}月から${ev.pauseMonths}か月（請求を止める月：${y}年${m}月〜）`])
    rows.push(['再開予定月', `${ry}年${rm}月`])
    if (before.start) rows.push(['最低利用期間の満了日（休会分を延長）', jaDate(minEndOf(before.start, before.pausedMonths + ev.pauseMonths))])
  } else if (ev.kind === 'cancel' && ev.submitted && ev.end) {
    const day = Number(ev.submitted.slice(8, 10))
    if (ev.paper) {
      // 紙の入会申込書で入会した方：紙の契約の内容も、この届に残す
      rows.push(['会員の種別', `${ev.paper.plan}（${MEMBER_FEES[ev.paper.plan]}）`])
      rows.push(['ご入会', `紙の入会申込書（利用開始日 ${jaDate(ev.paper.start)}）`])
    }
    if (before.partner) rows.push(['対象', `兄弟・親子プラン（契約者と ${before.partner.name}さんの2名分）`])
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
  return rows
}

/** 印刷・保存に入れる「会員の手続き」の枠（2026-11-13 までの書類の形。いまは書類の頭の「ご契約内容」の枠に入れる） */
export function memberEventHtml(ev: MemberEvent, before: MemberStatus): string {
  const rows = memberEventRows(ev, before)
  if (rows.length === 0) return ''
  const title = ev.kind === 'join' ? '会員プランの入会（院の記録）' : ev.kind === 'pause' ? '会員プランの休会（院の記録）' : '会員プランの解約（院の記録）'
  return `<div class="member-box"><h3>${escapeHtml(title)}</h3><table>${rows
    .map(([k, v]) => `<tr><th>${escapeHtml(k)}</th><td>${escapeHtml(v)}</td></tr>`)
    .join('')}</table></div>`
}
