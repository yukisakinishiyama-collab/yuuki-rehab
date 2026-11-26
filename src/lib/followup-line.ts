/**
 * ご来院が空いている方へのご連絡（公式LINE）の決まり（純粋な関数。画面・サーバー・テストから読む）
 *
 * 2026-11-26 院長「一定期間ご来院のない患者様にも連絡がいくように（これは事前に私に誰に送るか出して承認したものだけ）」。
 *
 * - 自動では送らない。院内アプリが「ご来院が空いている方」の一覧を出し、院長が送る方を選んで承認した方にだけ送る
 * - 送れるのは、LINE 連携の方で、ご本人が「配信停止」と送っていない方（お知らせ・ご挨拶＝marketing の受け取り）
 * - これからの予約・来院予定がある方、FOLLOWUP_REPEAT_DAYS 日のうちに同じご連絡を送った方には送らない（しつこくしない）
 * - 文は、ご様子うかがいだけ。症状・施術の内容・効果を約束する言葉は入れない（lib/marketing/compliance.ts で確かめる）。
 *   予約の入口・お電話・止め方（「配信停止」）は、いつも最後に付く（書きかえられない）
 * サーバーは lib/marketing/followup-line-server.ts、画面は /marketing/line/followup
 */
import { DEFAULT_CLINIC_PROFILE, LIFF_RESERVE_URL } from '@/lib/marketing/clinic'
import { findViolations } from '@/lib/marketing/compliance'
import { CONSENT_KEYWORDS } from '@/lib/marketing/consent'
import { matchName, matchPhone } from '@/lib/line-link-match'
import { safeName } from '@/lib/reservation-message'

/** 「最後のご来院から◯日以上」のえらび方 */
export const FOLLOWUP_PERIODS = [
  { days: 14, label: '2週間以上' },
  { days: 30, label: '1か月以上' },
  { days: 60, label: '2か月以上' },
  { days: 90, label: '3か月以上' },
] as const
export const FOLLOWUP_DEFAULT_DAYS = 30
/** これより長く空いた方は一覧に出さない（「少し間があきました」と送る相手ではないため） */
export const FOLLOWUP_MAX_GAP_DAYS = 365
/** 同じ方へ、次にご連絡できるまでの日数 */
export const FOLLOWUP_REPEAT_DAYS = 60
/** 1回の承認で送れる人数・1日に送れる人数（公式LINE の通数を使いすぎないように） */
export const FOLLOWUP_MAX_PER_SEND = 20
export const FOLLOWUP_MAX_PER_DAY = 30
/** 書きかえられる文の長さ */
export const FOLLOWUP_TEMPLATE_MAX = 400

/** 初めの文（今日の画面の「声かけ文」と同じ考え方。{name} はお名前に置きかわる） */
export const DEFAULT_FOLLOWUP_TEMPLATE = [
  '{name} 様',
  '',
  `${DEFAULT_CLINIC_PROFILE.name}です。`,
  'その後、お身体の具合はいかがでしょうか。',
  '前回のご来院から少し間があきましたので、ご様子をうかがいたくご連絡しました。',
  '',
  '気になることがありましたら、このトークでお気軽にご相談ください。',
].join('\n')

/** いつも文の最後に付くもの（予約の入口・お電話・止め方） */
export function followupFooter(): string {
  return [
    'ご予約は、こちらから（24時間）',
    LIFF_RESERVE_URL,
    `お電話（${DEFAULT_CLINIC_PROFILE.phone}）でも承ります。`,
    '',
    `※このようなご連絡が不要な方は「${CONSENT_KEYWORDS.stopMarketing}」と送ってください。`,
  ].join('\n')
}

/** 書きかえた文に問題があれば、画面に出す文。無ければ null */
export function followupTemplateProblem(template: string): string | null {
  const t = String(template ?? '').trim()
  if (!t) return '文を入れてください'
  if (t.length > FOLLOWUP_TEMPLATE_MAX) return `文は${FOLLOWUP_TEMPLATE_MAX}文字までです（いま${t.length}文字）`
  if (!/\{name\}/.test(t)) return '文に {name}（お名前が入る場所）を入れてください'
  if (/https?:\/\/|www\./i.test(t)) return 'リンクは入れられません（ご予約のリンクは、文の最後に自動で付きます）'
  // 効果を約束する言い方などは、注意の段階のものも、患者さんへ送る文では使わない
  const found = findViolations(t)[0]
  if (found) return `使えない言い方があります：「${found.match}」（${found.reason}）`
  return null
}

/** 患者さんへ送る文（{name} をお名前に。最後に予約の入口・お電話・止め方） */
export function followupText(template: string, name: string): string {
  const body = String(template ?? '').trim().replace(/\{name\}/g, safeName(name))
  return `${body}\n\n${followupFooter()}`
}

/** 送れない理由（お名前などは入らない） */
export type FollowupBlock =
  | 'karte_missing'
  | 'not_linked'
  | 'opted_out'
  | 'consent_unknown'
  | 'has_reservation'
  | 'has_plan'
  | 'reservation_unknown'
  | 'recently_sent'

export const FOLLOWUP_BLOCK_TEXT: Record<FollowupBlock, string> = {
  karte_missing: 'カルテがまだクラウドにそろっていません（少し待って読み直してください）',
  not_linked: 'LINE と結びついていません（お電話でのご連絡になります）',
  opted_out: 'ご本人が「配信停止」と送っています',
  consent_unknown: '受け取りの記録を確かめられませんでした',
  has_reservation: 'これからのご予約があります',
  has_plan: 'これからの来院予定があります',
  reservation_unknown: 'ご予約があるかを、いま確かめられませんでした',
  recently_sent: `${FOLLOWUP_REPEAT_DAYS}日のうちに、ご連絡を送っています`,
}

/** サーバーが確かめた結果（1人分。お名前・LINE の宛先は入らない） */
export interface FollowupCheck {
  patientId: string
  sendable: boolean
  block?: FollowupBlock
  /** 理由に添える日にち（予約の日・来院予定の日・前に送った日） */
  detail?: string
  /** いちばん最近、このご連絡を送った日（YYYY-MM-DD） */
  lastSentOn?: string
}

/** 前に送った日から、もう送ってよいか */
export function canSendAgain(lastSentOn: string | undefined, today: string): boolean {
  if (!lastSentOn || !/^\d{4}-\d{2}-\d{2}$/.test(lastSentOn)) return true
  const days = Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${lastSentOn}T00:00:00Z`)) / 86_400_000)
  return days >= FOLLOWUP_REPEAT_DAYS
}

/** 一覧の1人（画面で作る。カルテの「最後に来た日」から） */
export interface FollowupCandidate {
  patientId: string
  name: string
  phone: string
  lastVisit: string
  days: number
  visits: number
}

/** 予約の表の過去の1行（キャンセル以外は「来られた」とみる） */
export interface PastReservation {
  date: string
  name: string
  phone: string
  status: string
}

/**
 * カルテの「最後に来た日」を、予約の表の過去の分・来院予定の「来院した」で新しくする。
 * カルテに毎回の記録が無い方を、まちがって「空いている」としないため（まちがえるなら「来ている」の側へ）。
 * 同じ方＝お名前が同じ（空白・全角半角はそろえる）で、電話がどちらにもあれば電話も同じ
 */
export function latestVisitDates(
  people: Array<{ id: string; name: string; phone: string; lastVisit: string | null }>,
  past: PastReservation[],
  visitedPlans: Array<{ patientId?: string; name?: string; date?: string }>,
  today: string,
): Map<string, string> {
  const out = new Map<string, string>()
  const put = (id: string, date: string | null | undefined) => {
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date) || date > today) return
    const cur = out.get(id)
    if (!cur || date > cur) out.set(id, date)
  }
  const rows = past
    .filter((r) => r && r.status !== 'キャンセル' && /^\d{4}-\d{2}-\d{2}$/.test(String(r.date)) && r.date <= today)
    .map((r) => ({ date: r.date, name: matchName(r.name), phone: matchPhone(r.phone) }))
  for (const p of people) {
    put(p.id, p.lastVisit)
    const name = matchName(p.name)
    const phone = matchPhone(p.phone)
    if (name) for (const r of rows) if (r.name === name && (!phone || !r.phone || r.phone === phone)) put(p.id, r.date)
    for (const v of visitedPlans) if (v.patientId === p.id || (!v.patientId && name && matchName(v.name) === name)) put(p.id, v.date)
  }
  return out
}

/** 一覧に出す方（minDays 日以上・FOLLOWUP_MAX_GAP_DAYS 日まで空いている方。空いて間もない順） */
export function followupCandidates(
  people: Array<{ id: string; name: string; phone: string; visits: number }>,
  lastVisits: Map<string, string>,
  today: string,
  minDays: number,
): FollowupCandidate[] {
  const out: FollowupCandidate[] = []
  for (const p of people) {
    const lastVisit = lastVisits.get(p.id)
    if (!lastVisit) continue
    const days = Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${lastVisit}T00:00:00Z`)) / 86_400_000)
    if (days < minDays || days > FOLLOWUP_MAX_GAP_DAYS) continue
    out.push({ patientId: p.id, name: p.name, phone: p.phone, lastVisit, days, visits: p.visits })
  }
  return out.sort((a, b) => a.days - b.days || a.name.localeCompare(b.name, 'ja'))
}
