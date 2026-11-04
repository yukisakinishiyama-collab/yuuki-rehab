/**
 * お知らせの受け取り（同意）の決まりごと。画面・サーバー・テスト（node）から読む
 *
 * 目的を2つに分けて持つ（docs/marketing-hub/STAGE2-PLAN.md）
 * - reservation … 予約のお知らせ（前日のお知らせ・キャンセル待ちのご案内）
 * - marketing   … お知らせ・ご挨拶（誕生日など、院から一人ずつ送るもの）
 * 予約の確定・キャンセルの控えは、本人のお手続きへの返事なので、どちらを止めていても送る。
 *
 * 記録が無い方は「受け取る」（予約フォームの同意のチェックは最初から入れておく＝2026-11-04 院長の決定。
 * 予約システムは、チェックを外した予約には前日のお知らせを頼まない）。
 * 本人が LINE で「配信停止」「予約のお知らせ停止」と送ると止まり、「配信再開」「予約のお知らせ再開」で戻る。
 */

export type ConsentPurpose = 'reservation' | 'marketing'

export interface ConsentRecord {
  reservation: boolean
  marketing: boolean
  updatedAt: string
  /** どこで変わったか（line=本人が LINE で送った／staff=院で変えた） */
  source: 'line' | 'staff'
}

export const CONSENT_PURPOSE_LABELS: Record<ConsentPurpose, string> = {
  reservation: '予約のお知らせ（前日のお知らせ・キャンセル待ちのご案内）',
  marketing: 'お知らせ・ご挨拶（誕生日など）',
}

/** 本人が送る言葉（LINE のメニューのボタンから同じ言葉を送らせてもよい） */
export const CONSENT_KEYWORDS = {
  stopMarketing: '配信停止',
  resumeMarketing: '配信再開',
  stopReservation: '予約のお知らせ停止',
  resumeReservation: '予約のお知らせ再開',
} as const

export interface ConsentCommand {
  purpose: ConsentPurpose
  allow: boolean
}

const STOP = '(?:停止|ストップ|止めて|とめて|止める|とめる|やめて|やめる|不要|いらない|要らない)'
const RESUME = '(?:再開|受け取る|うけとる|受け取りたい)'
const RESERVATION_SUBJECT = '(?:予約の?お知らせ|前日の?お知らせ|リマインド|キャンセル待ちの?(?:お知らせ|ご?案内))'
const MARKETING_SUBJECT = '(?:配信|お知らせ配信|お知らせ|ご?挨拶|誕生日の?(?:メッセージ|ご?挨拶|あいさつ))'
const POLITE = /(?:してください|して下さい|してほしい|して欲しい|お願いします|おねがいします|お願い|ください|下さい|します|して|です|希望)$/

/** 言葉をそろえる（全角・半角、空白、かっこ、句読点、ていねいな言い方） */
export function normalizeCommand(text: string): string {
  let s = String(text ?? '')
    .normalize('NFKC')
    .replace(/[\s「」『』"'。、．.!！?？]/g, '')
  // 「停止してください」→「停止」。2回まで（「停止希望します」など）
  for (let i = 0; i < 2; i += 1) s = s.replace(POLITE, '')
  return s
}

/**
 * お知らせの受け取りを変える言葉か。ふつうの相談の文に混ざっていても反応しないよう、
 * 言葉だけ（＋ていねいな言い方）のときだけ受け付ける
 */
export function parseConsentCommand(text: string): ConsentCommand | null {
  const s = normalizeCommand(text)
  if (!s || s.length > 30) return null
  const join = (subject: string, verb: string) => new RegExp(`^${subject}(?:を|は)?${verb}$`)
  // 予約のお知らせを先に見る（「予約のお知らせ停止」を「お知らせ停止」と取り違えない）
  if (join(RESERVATION_SUBJECT, STOP).test(s)) return { purpose: 'reservation', allow: false }
  if (join(RESERVATION_SUBJECT, RESUME).test(s)) return { purpose: 'reservation', allow: true }
  if (join(MARKETING_SUBJECT, STOP).test(s)) return { purpose: 'marketing', allow: false }
  if (join(MARKETING_SUBJECT, RESUME).test(s)) return { purpose: 'marketing', allow: true }
  return null
}

/** 記録が無い方は受け取る（上の説明のとおり） */
export function consentAllows(record: ConsentRecord | null | undefined, purpose: ConsentPurpose): boolean {
  if (!record) return true
  return record[purpose] !== false
}

/** 受け取りを変えたときの返事（本人へ。どれが止まり、どれが止まらないかをはっきり書く） */
export function consentReply(command: ConsentCommand): string {
  if (command.purpose === 'marketing') {
    return command.allow
      ? [
          'お知らせ・ご挨拶（誕生日など）の配信を再開しました。',
          `止めるときは「${CONSENT_KEYWORDS.stopMarketing}」と送ってください。`,
        ].join('\n')
      : [
          'お知らせ・ご挨拶（誕生日など、院から一人ずつお送りするもの）の配信を止めました。',
          '',
          `ご予約のお知らせ（前日のお知らせ・キャンセル待ちのご案内）は、これまでどおりお送りします。止めるときは「${CONSENT_KEYWORDS.stopReservation}」と送ってください。`,
          '※友だち全員へ同時にお送りするお知らせは、LINE の仕組み上、この設定では止まりません。',
          '',
          `再開するときは「${CONSENT_KEYWORDS.resumeMarketing}」と送ってください。`,
        ].join('\n')
  }
  return command.allow
    ? [
        '前日のご予約のお知らせと、キャンセル待ちのご案内を再開しました。',
        `止めるときは「${CONSENT_KEYWORDS.stopReservation}」と送ってください。`,
      ].join('\n')
    : [
        '前日のご予約のお知らせと、キャンセル待ちのご案内を止めました。',
        '',
        'ご予約の確定・キャンセルの控えは、お手続きのたびにお送りします。',
        `再開するときは「${CONSENT_KEYWORDS.resumeReservation}」と送ってください。`,
      ].join('\n')
}

/** 日本時間の時（0〜23） */
export function jstHour(at: Date = new Date()): number {
  return new Date(at.getTime() + 9 * 60 * 60 * 1000).getUTCHours()
}

/** 送ってよい時間帯か（日本時間。fromHour 時から toHour 時の前まで。指定が無ければいつでもよい） */
export function inSendHours(at: Date, fromHour?: number, toHour?: number): boolean {
  if (fromHour === undefined || toHour === undefined) return true
  const hour = jstHour(at)
  return hour >= fromHour && hour < toHour
}
