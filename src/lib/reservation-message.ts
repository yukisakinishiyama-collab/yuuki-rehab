/**
 * 患者さんのLINEへ送る、予約の文面（画面の見本とサーバーの送信で共通）
 *
 * - 院内アプリの「LINEで予約日時を送る」と、LINE連携の方への自動のお知らせ（予約の確定・前日のお知らせ）で使う
 * - 「予約が確定しました」は、LINEで予約した方へ予約システムから届くもの（reservation-notify の patient-confirm）と同じ文面。
 *   reservation-notify にも同じ文面があるので、文面を変えるときは両方を直す
 * - 前日のお知らせは reservation-notify の patient-remind もこれを使う
 */
import { DEFAULT_CLINIC_PROFILE } from '@/lib/marketing/clinic'
import { CONSENT_KEYWORDS } from '@/lib/marketing/consent'

/** 外から来た文字を本文へ入れる前に、改行・制御文字を取り、長さをそろえる（文面のなりすまし防止） */
export function safeName(value?: string): string {
  return String(value ?? '')
    .replace(/[\p{Cc}\p{Zl}\p{Zp}]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 40)
}

/** 'yyyy-MM-dd' → 「M月D日（曜）」。形式が違えばそのまま返す */
export function formatDateJa(dateString?: string): string {
  if (!dateString || !/^\d{4}-\d{2}-\d{2}$/.test(dateString)) return dateString ?? ''
  const [year, month, day] = dateString.split('-').map(Number)
  const youbi = ['日', '月', '火', '水', '木', '金', '土'][new Date(year, month - 1, day).getDay()]
  return `${month}月${day}日（${youbi}）`
}

/** 予約番号として載せてよい形（英数字だけ）なら返す。違えば '' */
export function safeReservationNo(value?: string): string {
  const v = String(value ?? '')
  return /^[A-Za-z0-9]{1,12}$/.test(v) ? v : ''
}

/** 「ご予約ありがとうございます。以下の内容で確定しました」の文面 */
export function patientConfirmText(input: { name?: string; date?: string; time?: string; reservationNo?: string }): string {
  const name = safeName(input.name)
  const reservationNo = safeReservationNo(input.reservationNo)
  const when = `${formatDateJa(input.date)} ${String(input.time ?? '').slice(0, 5)}`.trim()
  return [
    `${name} 様`,
    '',
    'ゆうき整骨院です。ご予約ありがとうございます。',
    '以下の内容で確定しました。',
    '',
    `📅 日時：${when}〜`,
    reservationNo ? `🎫 予約番号：${reservationNo}` : undefined,
    '',
    '変更・キャンセルは、このトークまたは',
    'お電話（083-265-4545）へお気軽にどうぞ。',
    '当日はお気をつけてお越しください😊',
  ]
    .filter((x): x is string => x !== undefined)
    .join('\n')
}

/** 日本時間の明日 'YYYY-MM-DD' */
export function jstTomorrow(now = new Date()): string {
  return new Date(now.getTime() + (9 + 24) * 60 * 60 * 1000).toISOString().slice(0, 10)
}

/** 前日のお知らせ（日時・場所・変更とキャンセルの方法だけ。来院を強くすすめる言葉・施術の指示は入れない） */
export function patientRemindText(input: { name?: string; date?: string; time?: string; reservationNo?: string }, now = new Date()): string {
  const name = safeName(input.name)
  const reservationNo = safeReservationNo(input.reservationNo)
  const when = `${formatDateJa(input.date)} ${String(input.time ?? '').slice(0, 5)}`.trim()
  const tomorrow = input.date === jstTomorrow(now)
  return [
    name ? `${name} 様` : undefined,
    name ? '' : undefined,
    `ゆうき整骨院です。${tomorrow ? '明日の' : ''}ご予約のお知らせです。`,
    '',
    `📅 日時：${when}〜`,
    reservationNo ? `🎫 予約番号：${reservationNo}` : undefined,
    `📍 場所：${DEFAULT_CLINIC_PROFILE.address}（${DEFAULT_CLINIC_PROFILE.parking}）`,
    '',
    '変更・キャンセルは、このトークまたは',
    `お電話（${DEFAULT_CLINIC_PROFILE.phone}）へどうぞ。`,
    '',
    `※このお知らせが不要な方は「${CONSENT_KEYWORDS.stopReservation}」と送ってください。`,
  ]
    .filter((x): x is string => x !== undefined)
    .join('\n')
}
