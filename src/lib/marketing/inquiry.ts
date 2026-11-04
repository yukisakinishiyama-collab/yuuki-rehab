/**
 * 問い合わせ（公式LINE の相談）の対応状況を決める（純粋関数。画面・サーバー・テストから使う）
 *
 * 問い合わせとして数えるのは、友だち追加のあとに、本人が何か送った・選んだ方だけ
 * （友だち追加だけの方は数えない）。同じ方は1件として数える（重複して数えない）。
 *
 * 状況（未対応・対応中・予約済み・完了）
 * - スタッフが画面で変えたもの（inquiryStatus）をいちばん優先する
 * - 変えていないときは、ほかの印から決める
 *   予約済みの印 → 予約済み / スタッフの対応が要る印（要対応・人対応中）→ 未対応 /
 *   自動の案内の途中・案内ずみ → 対応中 / 自由に書いた文に自動の案内しか返していない → 未対応
 * 新しくスタッフの対応が要ることが起きたら、webhook が inquiryStatus を「未対応」に戻す（完了のままにしない）
 */
import type { InquiryStatus, LineContact } from './line-types'

/** 問い合わせの一覧の1行（/api/marketing/inquiries が返す形） */
export interface InquiryRow {
  userId: string
  displayName: string
  status: InquiryStatus
  intent: string | null
  bodyPart: string | null
  timing: string | null
  needsAttention: string | null
  handoff: boolean
  lastText: string
  lastAt: string
  blocked: boolean
  optedOut: boolean
  /** LINE導線のシミュレーターで作ったテストの方 */
  simulated: boolean
}

/** 友だち追加のときに会話ログへ残している文（本人が送った文ではない） */
const FOLLOW_TEXT = '（友だち追加）'

type ContactLike = Pick<
  LineContact,
  'messages' | 'intent' | 'needsAttention' | 'handoff' | 'reserved' | 'tags' | 'step' | 'inquiryStatus'
>

/** 本人が送った文（友だち追加の印と、「配信停止」などお知らせの受け取りの変更は除く） */
function userMessages(contact: Pick<LineContact, 'messages'>) {
  return (contact.messages ?? []).filter((m) => m.from === 'user' && m.text !== FOLLOW_TEXT && m.note !== 'consent')
}

/** 問い合わせとして数えるか（本人が何か送った・選んだ） */
export function isInquiry(contact: ContactLike): boolean {
  return userMessages(contact).length > 0 || Boolean(contact.intent) || Boolean(contact.needsAttention)
}

export function inquiryStatusOf(contact: ContactLike): InquiryStatus {
  if (contact.inquiryStatus) return contact.inquiryStatus
  if (contact.reserved || (contact.tags ?? []).includes('予約済み')) return 'reserved'
  if (contact.needsAttention || contact.handoff) return 'new'
  if (contact.step === 'guide' || contact.step === 'ask_part' || contact.step === 'ask_when') return 'in_progress'
  return 'new'
}

/** 本人が最後に送った時刻（ISO）。無ければ null */
export function lastUserMessageAt(contact: Pick<LineContact, 'messages'>): string | null {
  const list = userMessages(contact)
  return list.length > 0 ? list[list.length - 1].at : null
}

/** 本人が最後に送った文（一覧に出す短い形） */
export function lastUserText(contact: Pick<LineContact, 'messages'>, max = 60): string {
  const list = userMessages(contact)
  const text = list.length > 0 ? list[list.length - 1].text : ''
  return text.length > max ? `${text.slice(0, max)}…` : text
}

/** 日本時間の 'YYYY-MM-DD' */
export function jstDayOf(iso: string): string {
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return ''
  return new Date(t + 9 * 60 * 60 * 1000).toISOString().slice(0, 10)
}

/** その日（日本時間）に本人から何か届いたか */
export function inquiredOn(contact: Pick<LineContact, 'messages'>, day: string): boolean {
  return userMessages(contact).some((m) => jstDayOf(m.at) === day)
}
