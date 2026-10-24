/**
 * カルテ ↔ 公式LINE の結びつけ（共通の型と、患者さんを見分けるキー）
 *
 * 患者さんは「電話番号＋氏名（空白なし）」で見分ける。予約システム（GAS）の
 * patientKeyOf と同じ作りなので、予約・カルテ・LINEで同じ人を同じキーで指せる。
 * 同じ電話番号のご家族（親のLINEで子どものカルテ、など）はキーが別になる。
 *
 * LINEの userId は生で保存しない。署名付きの封印（sealed、lib/liff-ticket.ts）だけを
 * サーバー側（KV）に持ち、送信のときにサーバーの中でだけ開く。
 */

/** サーバーに保存する1件（KV の linelink:<key>） */
export interface LineLink {
  /** 電話番号の数字＋'|'＋氏名（空白なし） */
  key: string
  name: string
  phone: string
  /** 署名付きの封印済み userId（生の userId ではない） */
  sealed: string
  /** 結びつけた日時（ISO） */
  linkedAt: string
  /** どこで結びついたか */
  via: 'liff-link' | 'reservation'
}

/** 画面に出す分（封印済みの参照は出さない） */
export type LineLinkSummary = Omit<LineLink, 'sealed'>

export const phoneDigits = (value: string): string => String(value || '').replace(/[^0-9]/g, '')
export const nameNoSpace = (value: string): string => String(value || '').replace(/[\s　]/g, '')

/** 患者さんのキー。電話番号が10桁未満、または氏名が空なら ''（結びつけられない） */
export function patientLinkKey(name: string, phone: string): string {
  const digits = phoneDigits(phone)
  const compact = nameNoSpace(name)
  if (digits.length < 10 || !compact) return ''
  return `${digits}|${compact}`
}
