/**
 * 患者さんのLINEへ送る、予約の文面（画面の見本とサーバーの送信で共通）
 *
 * - LINEで予約した方へ予約システムから届く「予約が確定しました」と同じ文面（reservation-notify の patient-confirm）
 * - 院内アプリの「LINEで予約日時を送る」でも同じ文面を使う（2026-11-02 院長の依頼）
 */

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
