// ──────────────────────────────────────────────
// 前日のお知らせが「届く・届かない」の見分け（純粋な関数。画面は components/clinic/ReminderReachPanel.tsx）
//
// 2026-11-20 院長「キャンセル率を下げる対策を」→ 院長が選んだ対策の1つ「届かない方を一覧に」。
// 来院しなかった理由でいちばん多いのは「予約を忘れていた」（AAFP 2013 の解説で約半数）。前日のお知らせは
// 予約システムが毎朝8時に送る（LINE から予約した方は LINE・ほかはメール）。カルテから LINE 連携した方へは
// 院内アプリが 10〜20時に LINE で送る。どちらも無い方（電話で取った予約でメールも LINE も無い など）には何も届かない。
// → 明日の予約のうち届かない方を「今日」の画面に出し、電話で確かめられるようにする。
//   今日来られる方で届く手段が無い方は、受付で LINE 連携（カルテのQR）をすすめる。
//
// 予約システム v3.26〜は、予約の一覧に remind（sent/mail/line/off の印。メールアドレスなどの中身は無い）を付ける。
// 古い予約システム（remind が無い）では、LINE 連携の有無しか分からない（＝'unknown'）。
// ──────────────────────────────────────────────

/** 予約システムが付ける印（v3.26〜） */
export interface RemindFlags {
  /** もう送った（前日通知日時がある） */
  sent?: boolean
  /** メールアドレスがある */
  mail?: boolean
  /** LINE から予約した（LINE通知キーがある） */
  line?: boolean
  /** 予約のときに「前日のお知らせを受け取らない」にした */
  off?: boolean
}

/** 自動化設定の「前日のお知らせ」（LINE）。読めなかったときは 'unknown'（届く扱い） */
export type RemindMode = 'on' | 'test' | 'off' | 'unknown'

export type Reach =
  /** もう送った */
  | 'sent'
  /** LINE で届く（LINE 連携・LINE から予約。前日のお知らせが「動かす」） */
  | 'line'
  /** メールで届く */
  | 'mail'
  /** 本人が受け取らないにした */
  | 'off'
  /** LINE はあるが、前日のお知らせ（LINE）が「テスト」「止める」のため届かない（メールも無い） */
  | 'line_paused'
  /** 届く手段が無い */
  | 'none'
  /** 予約システムが古く、メールの有無が分からない（LINE 連携は無い） */
  | 'unknown'

export const REACH_LABELS: Record<Reach, string> = {
  sent: '送りました',
  line: 'LINEで届きます',
  mail: 'メールで届きます',
  off: 'お知らせ不要（ご本人の設定）',
  line_paused: 'LINEはあるが、前日のお知らせ（LINE）が止まっていて届かない',
  none: 'LINEもメールも無い',
  unknown: 'LINE未連携（メールの有無は予約システムの更新後に分かります）',
}

/** LINE の前日のお知らせが、患者さんに届く設定か（テスト・止めるのときは院長の見本だけ・送らない） */
export const lineRemindWorks = (mode: RemindMode): boolean => mode === 'on' || mode === 'unknown'

/** この予約の前日のお知らせは届くか */
export function reachOf(flags: RemindFlags | undefined, appLinked: boolean, mode: RemindMode): Reach {
  if (flags?.off) return 'off'
  if (flags?.sent) return 'sent'
  if (lineRemindWorks(mode) && (appLinked || flags?.line)) return 'line'
  if (flags?.mail) return 'mail'
  if (appLinked || flags?.line) return 'line_paused'
  if (!flags) return 'unknown'
  return 'none'
}

/** 届く手段（LINE・メール）が、そもそもあるか（今日来られる方に LINE 連携をすすめるかを決める） */
export function hasReachRoute(flags: RemindFlags | undefined, appLinked: boolean, mode: RemindMode): boolean {
  if (lineRemindWorks(mode) && (appLinked || flags?.line)) return true
  return Boolean(flags?.mail)
}

/** 電話で確かめたい予約か */
export const needsCall = (reach: Reach): boolean => reach === 'none' || reach === 'unknown' || reach === 'line_paused'

export interface ReachRow {
  date: string
  time: string
  name: string
  phone: string
  status: string
  reservationNo: string
  remind?: RemindFlags
}

export interface ReachItem {
  date: string
  time: string
  name: string
  phone: string
  reservationNo: string
  reach: Reach
}

export interface ReachSummary {
  /** 明日の予約で、届かない方（電話で確かめる） */
  tomorrow: ReachItem[]
  /** 明日の予約で、ご本人が「お知らせ不要」にした方 */
  tomorrowOff: ReachItem[]
  /** 明日の予約の数（確定のもの） */
  tomorrowTotal: number
  /** 今日来られる方で、届く手段が無い方（受付で LINE 連携をすすめる） */
  todayNoRoute: ReachItem[]
  /** 明後日から先（読んだ範囲）で、届く手段が無い予約の数 */
  laterNoRoute: number
  /** 予約システムが古く、メールの有無が分からない */
  legacy: boolean
}

const BOOKED = '確定'
const hhmm = (t: string) => String(t || '').slice(0, 5)

/**
 * 読んだ予約から、届かない方の一覧を作る。
 * isLinked … その予約の方が LINE 連携しているか（電話＋お名前、またはカルテを通して）
 * now      … 端末の今日の日付・時刻（今日の予約は、まだ来ていない時刻だけ）
 */
export function buildReachSummary(
  rows: ReachRow[],
  isLinked: (row: ReachRow) => boolean,
  mode: RemindMode,
  now: { date: string; time: string; tomorrow: string },
): ReachSummary {
  const out: ReachSummary = { tomorrow: [], tomorrowOff: [], tomorrowTotal: 0, todayNoRoute: [], laterNoRoute: 0, legacy: false }
  for (const row of rows) {
    if (row.status !== BOOKED || !row.reservationNo) continue
    if (!row.remind) out.legacy = true
    const linked = isLinked(row)
    const item = (reach: Reach): ReachItem => ({ date: row.date, time: hhmm(row.time), name: row.name, phone: row.phone, reservationNo: row.reservationNo, reach })
    if (row.date === now.tomorrow) {
      out.tomorrowTotal += 1
      const reach = reachOf(row.remind, linked, mode)
      if (reach === 'off') out.tomorrowOff.push(item(reach))
      else if (needsCall(reach)) out.tomorrow.push(item(reach))
    } else if (row.date === now.date) {
      if (hhmm(row.time) < now.time) continue
      if (row.remind?.off) continue
      if (!hasReachRoute(row.remind, linked, mode)) out.todayNoRoute.push(item(row.remind ? 'none' : 'unknown'))
    } else if (row.date > now.tomorrow) {
      if (!row.remind?.off && !hasReachRoute(row.remind, linked, mode)) out.laterNoRoute += 1
    }
  }
  const byTime = (a: ReachItem, b: ReachItem) => (a.date + a.time).localeCompare(b.date + b.time)
  out.tomorrow.sort(byTime)
  out.tomorrowOff.sort(byTime)
  out.todayNoRoute.sort(byTime)
  return out
}

/** 電話をかけるリンク（数字だけ。番号が短すぎれば ''） */
export function telHref(phone: string): string {
  const d = String(phone || '').replace(/[^0-9]/g, '')
  return d.length >= 10 && d.length <= 11 ? `tel:${d}` : ''
}
