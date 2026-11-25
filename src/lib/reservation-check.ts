/**
 * 公式LINEの「予約確認」（2026-11-25 院長「公式lineで患者様側から日程を確認して返信が来るような設定はできますか？（予約確認です）」）
 *
 * 患者さんが公式LINEのトークで「予約確認」と送ると、その LINE と結びついた方のこれからの予約を返事する。
 * - だれの予約か … 予約のお知らせ（確定・前日）を送るときと同じ決まり（lib/line-link-match.ts）で、その LINE に届く予約だけ。
 *                   LINE から予約した方は、予約の行の封印（LINE通知キー）がその LINE のもの
 * - 返事は、患者さんのメッセージへの返信（Reply）なので、LINE の月の通数には数えない
 * - 予約の一覧は予約システム（v3.30〜の ?api=upcoming）から、そのつど取る（控えは持たない＝院の画面での変更・キャンセルもすぐ反映）
 * ここは、言葉の見分け・予約の選び方・返事の文（純粋な関数）。サーバーの動きは lib/marketing/reservation-check-server.ts
 */
import { matchLinkForReservation, type MatchKarte, type MatchLink } from '@/lib/line-link-match'
import { normalizeCommand } from '@/lib/marketing/consent'
import { formatDateJa, safeChangeUrl, safeName, safeReservationNo } from '@/lib/reservation-message'

/** 患者さんが送る言葉（LINE のメニューのボタンから同じ言葉を送らせてもよい） */
export const RESERVATION_CHECK_KEYWORD = '予約確認'

/** いちどに返す予約の数の上限（それより多い分は「ほか◯件」） */
export const RESERVATION_CHECK_MAX = 8

const CHECK_PATTERNS = [
  // 予約確認・予約の確認・予約を確認したい・次の予約の日時の確認
  /^(?:次の|つぎの|私の|わたしの|自分の)?ご?予約(?:の|を)?(?:日時|日程|日にち|時間|内容|状況)?(?:の|を)?(?:確認|かくにん|照会)(?:したい)?$/,
  // 予約日時・予約の日程を教えて・予約状況を知りたい
  /^(?:次の|つぎの|私の|わたしの|自分の)?ご?予約(?:の)?(?:日時|日程|日にち|内容|状況)(?:を)?(?:教えて|おしえて|知りたい|しりたい)?$/,
  // 次の予約・次の予約はいつ・予約いつでしたか
  /^(?:次の|つぎの)ご?予約(?:は|って)?(?:いつ(?:ですか|でしたか|だっけ|でしたっけ)?)?$/,
  /^(?:私の|わたしの|自分の)?ご?予約(?:は|って)?いつ(?:ですか|でしたか|だっけ|でしたっけ)?$/,
]

/**
 * 「予約確認」の言葉か。ふつうの相談の文に混ざっていても反応しないよう、言葉だけ（＋ていねいな言い方）のときだけ。
 * 「予約」「予約したい」「予約を変更したい」には反応しない（予約を取りたい・変えたい方のため）
 */
export function parseReservationCheck(text: string): boolean {
  const s = normalizeCommand(text)
  if (!s || s.length > 20) return false
  return CHECK_PATTERNS.some((re) => re.test(s))
}

/** 予約システムから届く、これからの予約の1行（?api=upcoming） */
export interface UpcomingRow {
  no: string
  date: string
  time: string
  name: string
  phone: string
  /** LINE から予約した方の封印（LINE通知キー）。無ければ '' */
  lineKey: string
}

/** 返事に出す予約1件 */
export interface CheckItem {
  /** だれの予約か（カルテ連携の方は連携のお名前、LINE から予約した方は予約のお名前） */
  name: string
  date: string
  time: string
  reservationNo: string
}

/**
 * その LINE に届く予約を選ぶ。
 * myLinkKeys … その LINE と結びついた連携のキー／isMyLineKey … 予約の行の封印が、その LINE のものか
 * 今日の分は、まだ来ていない時刻だけ。日にち・時間の順
 */
export function pickReservationsForLine<L extends MatchLink>(
  rows: UpcomingRow[],
  now: { today: string; time: string },
  kartes: MatchKarte[],
  links: L[],
  myLinkKeys: Set<string>,
  isMyLineKey: (lineKey: string) => boolean,
): CheckItem[] {
  const out: CheckItem[] = []
  const seen = new Set<string>()
  for (const row of rows) {
    const no = safeReservationNo(row.no)
    if (!no || seen.has(no) || !/^\d{4}-\d{2}-\d{2}$/.test(row.date) || !/^\d{2}:\d{2}$/.test(row.time)) continue
    if (row.date < now.today || (row.date === now.today && row.time < now.time)) continue
    let name = ''
    if (row.lineKey && isMyLineKey(row.lineKey)) {
      name = row.name
    } else if (myLinkKeys.size > 0) {
      const m = matchLinkForReservation(row, kartes, links)
      if (m.linked && myLinkKeys.has(m.link.key)) name = m.link.name
    }
    if (!name) continue
    seen.add(no)
    out.push({ name: safeName(name), date: row.date, time: row.time, reservationNo: no })
  }
  return out.sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`))
}

export type CheckReply =
  | { kind: 'found'; items: CheckItem[]; changeUrls?: Record<string, string> }
  /** その LINE と結びついた方はいるが、これからの予約が無い */
  | { kind: 'none'; names: string[] }
  /** その LINE では、予約を見つけられない（カルテと結びついていない・LINE から予約した分も無い） */
  | { kind: 'unknown' }
  /** 予約システムから取れなかった */
  | { kind: 'error' }

export interface CheckTextOptions {
  clinicName: string
  phone: string
  /** 予約ページ（LINE の中で開く） */
  reserveUrl: string
}

/** 返事の文（2026-11-25 院長に見本を見せて決めた） */
export function reservationCheckText(reply: CheckReply, opts: CheckTextOptions): string {
  const contact = `このトーク・お電話（${opts.phone}）でも承ります。`
  if (reply.kind === 'error') {
    return [
      `${opts.clinicName}です。`,
      'いま、ご予約をお調べできませんでした。申し訳ありません。',
      '少し時間をおいて、もう一度「予約確認」と送ってください。',
      `お急ぎのときは、お電話（${opts.phone}）でおたずねください。`,
    ].join('\n')
  }
  if (reply.kind === 'unknown') {
    return [
      `${opts.clinicName}です。`,
      'このLINEでは、ご予約を見つけられませんでした。',
      '',
      'ここでお調べできるのは、LINEから取ったご予約と、このLINEをカルテと結びつけた方のご予約です。',
      'ご来院のときに受付でお声がけいただくと、その場で結びつけられます（次から、ここでお調べできます）。',
      '',
      `ご予約の確認は、お電話（${opts.phone}）でも承ります。`,
    ].join('\n')
  }
  if (reply.kind === 'none') {
    const who = reply.names.map((n) => `${safeName(n)} 様`).join('・')
    return [
      `${opts.clinicName}です。`,
      `${who ? `${who}の、` : ''}これからのご予約はありません。`,
      '',
      'ご予約は、こちらから',
      opts.reserveUrl,
      contact,
    ].join('\n')
  }
  const shown = reply.items.slice(0, RESERVATION_CHECK_MAX)
  const rest = reply.items.length - shown.length
  const names = [...new Set(shown.map((i) => i.name))]
  const lines: string[] = []
  if (names.length === 1) lines.push(`${names[0]} 様`, '')
  lines.push(`${opts.clinicName}です。これからのご予約は、次のとおりです。`)
  for (const name of names) {
    if (names.length > 1) lines.push('', `■ ${name} 様`)
    for (const item of shown.filter((i) => i.name === name)) {
      const url = safeChangeUrl(reply.changeUrls?.[item.reservationNo])
      lines.push('', `📅 ${formatDateJa(item.date)} ${item.time}〜`, `🎫 予約番号：${item.reservationNo}`)
      if (url) lines.push('日時の変更・キャンセルは、こちらから（入力はいりません）', url)
    }
  }
  if (rest > 0) lines.push('', `ほかに ${rest} 件のご予約があります。`)
  lines.push('', contact)
  return lines.join('\n')
}
