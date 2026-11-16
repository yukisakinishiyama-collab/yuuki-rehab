/**
 * 患者さんが「日時の変更・キャンセル」を入力なしで開けるリンク（サーバー専用）
 *
 * 予約システム（GAS v3.20〜）の予約ページは、?rsv=<予約番号>&rk=<署名> で開くと、
 * 予約番号や電話番号の下4桁を入れなくても、その予約の変更・キャンセルの画面を出す。
 * 署名は HMAC-SHA256("rsvchange:<予約番号>") の16進の先頭24文字。鍵は予約システムと共有の
 * RESERVATION_NOTIFY_SECRET（予約システム側の PATIENT_NOTIFY_SECRET と同じ値）。
 * 予約システムの reservationLinkKey_ と同じ計算（どちらかを変えたら両方を直す。tools/test-reservation-change.mjs に同じ答えの確認あり）。
 *
 * このリンクは、ご本人の LINE（とメール）にだけ入れる。リンクを知っている人はその予約の日時を変えられるので、
 * 記録（動いた記録・ログ）には書かない。鍵が無い・予約番号の形が違うときは ''（リンクなしの文面になる）。
 */
import { createHmac } from 'node:crypto'
import { RESERVE_URL } from '@/lib/marketing/clinic'

/** 予約システムが受け付ける予約番号の形（英数字4〜12文字。小文字は大文字にして数える） */
const NO_RE = /^[A-Z0-9]{4,12}$/

export function reservationChangeKey(reservationNo: string, secret: string): string {
  const no = String(reservationNo ?? '').trim().toUpperCase()
  if (!secret || !NO_RE.test(no)) return ''
  return createHmac('sha256', secret).update(`rsvchange:${no}`).digest('hex').slice(0, 24)
}

export function reservationChangeUrl(reservationNo?: string, secret = process.env.RESERVATION_NOTIFY_SECRET ?? ''): string {
  const no = String(reservationNo ?? '').trim().toUpperCase()
  const key = reservationChangeKey(no, secret)
  return key ? `${RESERVE_URL}?rsv=${no}&rk=${key}` : ''
}
