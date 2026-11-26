/**
 * 来院予定（時間を決めない予定）を、患者さんの LINE へ知らせる文（画面の見本とサーバーの送信で共通）
 *
 * 2026-11-26 院長「更に時間指定のない予約もlineが入るようにしてください」。
 * 時間の予約と同じく2回：入れたとき（日にちを変えたとき）の「承りました」と、前日のお知らせ。
 * - 日にち・場所・変更の方法だけ。来院を強くすすめる言葉・施術の内容は入れない（lib/reservation-message.ts と同じ考え方）
 * - 院内のメモ（「夕方ごろ」「テーピングだけ」など）は入れない（院内むけの書きつけのため）
 * - 予約番号・変更のリンクは無い（予約システムの予約ではないため）。変更は、トーク・お電話で
 */
import { DEFAULT_CLINIC_PROFILE } from '@/lib/marketing/clinic'
import { CONSENT_KEYWORDS } from '@/lib/marketing/consent'
import { formatDateJa, jstTomorrow, safeName } from '@/lib/reservation-message'

/** 時間のところに出す言葉（確定・前日・「予約確認」の返事で同じ言い方にする） */
export const VISIT_PLAN_TIME_TEXT = '決めていません'

/** 「ご来院の予定を承りました」（入れたとき・日にちを変えたとき） */
export function visitPlanConfirmText(input: { name?: string; date?: string }): string {
  const name = safeName(input.name)
  return [
    name ? `${name} 様` : undefined,
    name ? '' : undefined,
    `${DEFAULT_CLINIC_PROFILE.name}です。ご来院の予定を承りました。`,
    '',
    `📅 ご来院日：${formatDateJa(input.date)}`,
    `⏰ 時間：${VISIT_PLAN_TIME_TEXT}`,
    '',
    '日にちの変更・取り消しは、このトークまたは',
    `お電話（${DEFAULT_CLINIC_PROFILE.phone}）へお気軽にどうぞ。`,
    '当日はお気をつけてお越しください😊',
  ]
    .filter((x): x is string => x !== undefined)
    .join('\n')
}

/** 前日のお知らせ */
export function visitPlanRemindText(input: { name?: string; date?: string }, now = new Date()): string {
  const name = safeName(input.name)
  const tomorrow = input.date === jstTomorrow(now)
  return [
    name ? `${name} 様` : undefined,
    name ? '' : undefined,
    `${DEFAULT_CLINIC_PROFILE.name}です。${tomorrow ? '明日の' : ''}ご来院予定のお知らせです。`,
    '',
    `📅 ご来院日：${formatDateJa(input.date)}`,
    `⏰ 時間：${VISIT_PLAN_TIME_TEXT}`,
    `📍 場所：${DEFAULT_CLINIC_PROFILE.address}（${DEFAULT_CLINIC_PROFILE.parking}）`,
    '',
    '日にちの変更・取り消しは、このトークまたは',
    `お電話（${DEFAULT_CLINIC_PROFILE.phone}）へどうぞ。`,
    '',
    `※このお知らせが不要な方は「${CONSENT_KEYWORDS.stopReservation}」と送ってください。`,
  ]
    .filter((x): x is string => x !== undefined)
    .join('\n')
}
