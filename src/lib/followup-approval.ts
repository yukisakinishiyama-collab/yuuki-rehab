/**
 * ご来院が空いている方へのご連絡：院長の LINE での承認（純粋な関数）
 *
 * 2026-11-26 院長「日にちが開いての来院されていない患者の承認は私のlineに一度送って承認の確認をしてください」。
 * 患者さんへ送る前に、だれに送るかを院長の LINE へ送り、院長が LINE のボタンで承認した方にだけ送る。
 * - 承認のお願いは、①院内アプリの画面で選んだ方、②毎週の自動の候補（月曜の朝。設定で止められる）の2通り
 * - お願いは FOLLOWUP_REQUEST_HOURS 時間で期限切れ（古いお願いのボタンでは送らない）
 * - 夜（FOLLOWUP_SEND_FROM_HOUR〜FOLLOWUP_SEND_TO_HOUR 時の外）に承認したら、次の朝に送る
 * サーバーは lib/marketing/followup-approval-server.ts
 */
import { formatDateJa } from '@/lib/reservation-message'
import { followupText } from '@/lib/followup-line'

/** 1回のお願いに入れる人数（LINE の1通に入る数。画面で選べるのは20人までだが、お願いは10人ずつ） */
export const FOLLOWUP_REQUEST_MAX = 10
/** お願いの期限（時間） */
export const FOLLOWUP_REQUEST_HOURS = 72
/** 患者さんへ送ってよい時間（日本時間） */
export const FOLLOWUP_SEND_FROM_HOUR = 8
export const FOLLOWUP_SEND_TO_HOUR = 20
/** 毎週の自動のお願い：月曜の朝（日本時間。WEEKLY_FROM_HOUR〜WEEKLY_TO_HOUR 時の間の最初の定期実行で） */
export const FOLLOWUP_WEEKLY_WEEKDAY = 1
export const FOLLOWUP_WEEKLY_FROM_HOUR = 9
export const FOLLOWUP_WEEKLY_TO_HOUR = 12
/** 同じ方を、次に自動の候補に出すまでの日数（見送った・返事が無かった方を毎週出さない） */
export const FOLLOWUP_REPROPOSE_DAYS = 60

export type RequestPersonStatus = 'pending' | 'approved' | 'sent' | 'declined' | 'skipped' | 'failed'

export interface RequestPerson {
  patientId: string
  name: string
  lastVisit?: string
  days?: number
  status: RequestPersonStatus
  /** 送らなかった理由・送れなかった理由（短い文） */
  note?: string
}

export interface FollowupRequest {
  id: string
  createdAt: string
  /** page＝画面で選んだ／weekly＝毎週の自動の候補 */
  source: 'page' | 'weekly'
  template: string
  people: RequestPerson[]
}

export const jstHourOf = (at: Date): number => new Date(at.getTime() + 9 * 3_600_000).getUTCHours()
export const jstDateOf = (at: Date): string => new Date(at.getTime() + 9 * 3_600_000).toISOString().slice(0, 10)
export const jstWeekdayOf = (at: Date): number => new Date(at.getTime() + 9 * 3_600_000).getUTCDay()

/** いま、患者さんへ送ってよい時間か */
export function inFollowupSendHours(now: Date): boolean {
  const h = jstHourOf(now)
  return h >= FOLLOWUP_SEND_FROM_HOUR && h < FOLLOWUP_SEND_TO_HOUR
}

export function requestExpired(request: Pick<FollowupRequest, 'createdAt'>, now: Date): boolean {
  return now.getTime() - Date.parse(request.createdAt) > FOLLOWUP_REQUEST_HOURS * 3_600_000
}

/** 毎週の自動のお願いを出す時間か（その週にまだ出していないとき） */
export function weeklyRequestDue(now: Date, lastWeeklyOn: string | undefined): boolean {
  if (jstWeekdayOf(now) !== FOLLOWUP_WEEKLY_WEEKDAY) return false
  const h = jstHourOf(now)
  if (h < FOLLOWUP_WEEKLY_FROM_HOUR || h >= FOLLOWUP_WEEKLY_TO_HOUR) return false
  return lastWeeklyOn !== jstDateOf(now)
}

/** ボタンの中身（fu:<動き>:<お願いの ID>:<何番目 | all>） */
export type FollowupAction = 'ok' | 'no' | 'pick'
export const FOLLOWUP_POSTBACK_PREFIX = 'fu:'

export function followupPostback(action: FollowupAction, id: string, target: number | 'all'): string {
  return `${FOLLOWUP_POSTBACK_PREFIX}${action}:${id}:${target}`
}

export function parseFollowupPostback(data: string): { action: FollowupAction; id: string; target: number | 'all' } | null {
  const m = /^fu:(ok|no|pick):([A-Za-z0-9_-]{8,40}):(all|\d{1,2})$/.exec(String(data ?? ''))
  if (!m) return null
  return { action: m[1] as FollowupAction, id: m[2], target: m[3] === 'all' ? 'all' : Number(m[3]) }
}

const md = (d?: string) => (d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? formatDateJa(d).replace(/（.）$/, '') : '')

/** 1人分の説明（「山田 花子 様（最後のご来院 10月22日・35日前）」） */
export function personLine(p: Pick<RequestPerson, 'name' | 'lastVisit' | 'days'>): string {
  const last = md(p.lastVisit)
  const tail = [last ? `最後のご来院 ${last}` : '', typeof p.days === 'number' ? `${p.days}日前` : ''].filter(Boolean).join('・')
  return `${p.name} 様${tail ? `（${tail}）` : ''}`
}

/** 院長の LINE へ送る「承認のお願い」の文（だれに・どんな文を送るか） */
export function requestText(request: FollowupRequest): string {
  const pending = request.people.filter((p) => p.status === 'pending')
  return [
    '📮 ご来院が空いている方へのご連絡（承認のお願い）',
    request.source === 'weekly' ? '今週の候補です。' : '院内アプリで選んだ方です。',
    '',
    `次の ${pending.length}人の LINE へ、ご様子うかがいを送ってよいですか？`,
    ...pending.map((p, i) => `${i + 1}. ${personLine(p)}`),
    '',
    '承認した方にだけ送ります。押さなければ、だれにも送りません。',
    `（このお願いは${FOLLOWUP_REQUEST_HOURS}時間で期限が切れます）`,
  ].join('\n')
}

/** 院長の LINE へ送る、患者さんに届く文の見本（1人目のお名前で） */
export function requestSampleText(request: FollowupRequest): string {
  const first = request.people.find((p) => p.status === 'pending')
  return `【患者さんに届く文】（${first ? `${first.name} 様の場合` : '見本'}）\n\n${followupText(request.template, first?.name ?? '山田 太郎')}`
}

/** 承認・見送りのあとの、院長への返事 */
export function resultText(done: Array<Pick<RequestPerson, 'name' | 'status' | 'note'>>, later: boolean): string {
  const by = (s: RequestPersonStatus) => done.filter((p) => p.status === s)
  const lines: string[] = []
  const sent = by('sent')
  const approved = by('approved')
  const declined = by('declined')
  const other = [...by('skipped'), ...by('failed')]
  if (sent.length) lines.push(`✅ 送りました（${sent.length}人）：${sent.map((p) => `${p.name} 様`).join('・')}`)
  if (approved.length) lines.push(`${later ? '🌙 夜のため、次の朝8時すぎにお送りします' : '承認を受けつけました。このあとお送りします'}（${approved.length}人）：${approved.map((p) => `${p.name} 様`).join('・')}`)
  if (declined.length) lines.push(`見送りました（${declined.length}人）：${declined.map((p) => `${p.name} 様`).join('・')}`)
  for (const p of other) lines.push(`⚠️ ${p.name} 様には送っていません：${p.note ?? '送れませんでした'}`)
  return lines.length ? lines.join('\n') : 'このお願いの方は、すべて対応済みです。'
}
