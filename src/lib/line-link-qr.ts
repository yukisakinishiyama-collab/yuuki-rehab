// ──────────────────────────────────────────────
// カルテの画面に出す「LINE連携のQRコード」の決まり（純粋な関数。画面・API・テストから使う）
//
// 2026-11-19 院長の依頼「患者様のカルテ画面で個別のQRコードを出して、それを読みとることで既存のLINE連携ができるように」。
// 1. カルテの「公式LINE」の欄 →「QRコードでLINEと結びつける」→ その方だけの番号を10分だけクラウドに置き、QR を出す
//    （QR の中は https://liff.line.me/{LIFF_ID}/link?c=番号 だけ。お名前・電話番号は入れない）
// 2. 患者さんのスマホの LINE で読み取る → 今までの「カルテ連携」のページが開き、カルテのお名前（例：山田 太郎 様）を出す
//    （2026-11-20 院長「名前の◯◯に患者様の名前が入っていませんでした」→ 一部を伏せるのをやめた）
// 3.「結びつける」を押す → 今までと同じ結びつけ（KV の linelink:・患者番号・LINEへのお知らせ）。お名前・電話番号・生年月日を入れなくてよい
//    （カルテに電話番号が無い方だけ、電話番号を入れてもらう）
// 4. 番号は1回だけ使える。カルテの画面は数秒ごとに見て「結びつきました」を出す
// ──────────────────────────────────────────────

/** QR の番号が使える時間（読み取ってもらうまで。過ぎたら出し直す） */
export const LINK_QR_TTL_MS = 10 * 60 * 1000
/** カルテの画面が、結びついたかを見に行く間隔 */
export const LINK_QR_POLL_MS = 3000
/** 入れ物（KV）の頭 */
export const LINK_QR_PREFIX = 'lqr:'

const CODE_RE = /^[A-Za-z0-9_-]{20,40}$/
const LIFF_ID_RE = /^\d{5,}-\w+$/

export type LinkQrStatus = 'waiting' | 'linked' | 'cancelled'

/** クラウドに置く1件（KV の lqr:<番号>）。院内の API だけが中身を読む */
export interface LinkQrSession {
  code: string
  /** カルテの ID（結びつけた LINE にも残し、カルテの画面で見分ける） */
  patientId: string
  name: string
  /** カルテの電話番号（無ければ ''。そのときは LINE の画面で入れてもらう） */
  phone: string
  /** カルテの生年月日（'YYYY-MM-DD' か ''） */
  birthDate: string
  status: LinkQrStatus
  createdAt: string
  expiresAt: string
  /** 結びついた日時・キー（電話＋氏名）・患者番号 */
  linkedAt?: string
  linkKey?: string
  patientNo?: string
  /**
   * 結びつけた LINE の印（userId を院の鍵で封じたもの。userId そのものは残さない）。
   * 同じ LINE でもう一度開いたとき（LINE が画面を読み直した・2回読み取った）に「結びついています」を出すため（2026-11-20）。
   * そのときのお名前は、結びつけの記録（linelink:<linkKey>）から読む（この番号にはお名前を残さない）
   */
  linkedBy?: string
}

export const isValidLinkCode = (code: unknown): code is string => typeof code === 'string' && CODE_RE.test(code)
export const isValidLiffId = (id: unknown): id is string => typeof id === 'string' && LIFF_ID_RE.test(id)

export const isLinkQrExpired = (s: Pick<LinkQrSession, 'expiresAt'>, now: Date = new Date()): boolean =>
  !s.expiresAt || now.toISOString() > s.expiresAt

/** まだ読み取って使える番号か */
export const isLinkQrOpen = (s: Pick<LinkQrSession, 'status' | 'expiresAt'>, now: Date = new Date()): boolean =>
  s.status === 'waiting' && !isLinkQrExpired(s, now)

/** QR に入れる URL（今までの「カルテ連携」のページ＋番号）。LIFF ID が正しくなければ '' */
export function linkQrUrl(liffId: string, code: string): string {
  if (!isValidLiffId(liffId) || !isValidLinkCode(code)) return ''
  return `https://liff.line.me/${liffId}/link?c=${code}`
}

/** 残り時間の表示（例「あと 9分12秒」・過ぎたら「期限切れ」） */
export function remainingText(expiresAt: string, now: Date = new Date()): string {
  const ms = Date.parse(expiresAt) - now.getTime()
  if (!Number.isFinite(ms) || ms <= 0) return '期限切れ'
  const sec = Math.ceil(ms / 1000)
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return m > 0 ? `あと ${m}分${String(s).padStart(2, '0')}秒` : `あと ${s}秒`
}

/** 番号が使えないときの、患者さん向けの短い文 */
export function linkQrProblemText(reason: 'missing' | 'expired' | 'used' | 'cancelled'): string {
  if (reason === 'expired') return 'このQRコードは期限が切れました（10分）。受付で新しいQRコードを出してもらってください。'
  if (reason === 'used') return 'このQRコードはもう使われました。結びつけ直すときは、受付で新しいQRコードを出してもらってください。'
  if (reason === 'cancelled') return 'このQRコードは使えなくなりました。受付で新しいQRコードを出してもらってください。'
  return 'QRコードを読み取れませんでした。受付で新しいQRコードを出してもらってください。'
}
