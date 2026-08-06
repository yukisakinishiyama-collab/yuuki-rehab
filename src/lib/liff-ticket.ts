/**
 * LIFFチケット / 封印済みuserId のユーティリティ
 *
 * 目的: 患者のLINE userId を「URLクエリやGAS側に生で流さない」こと。
 * userId を生で運ぶと、リンクの共有・履歴経由で第三者が他人のIDを指定して予約でき、
 * 院の公式アカウント名義で任意の相手へ通知を送れてしまう（なりすまし・フィッシング）。
 *
 * - ticket: LIFF IDトークン検証の直後に発行する短命（15分）の署名付き文字列。
 *           予約フォームまで運ばれ、予約確定時に1度だけ userId へ引き換えられる。
 * - sealed: 予約確定後、キャンセル通知のためにシートへ保存する長期の署名付き文字列。
 *           署名鍵なしに他人のIDの sealed を作れないため、なりすまし送信を防げる。
 */
import { createHmac, timingSafeEqual } from 'crypto'

/** チケットの有効期間＝15分（予約入力にかかる時間を考慮） */
const TICKET_TTL_MS = 15 * 60 * 1000

const USER_ID_PATTERN = /^U[0-9a-f]{32}$/

function sign(body: string, key: string): string {
  return createHmac('sha256', key).update(body).digest('base64url')
}

function verifySignature(body: string, signature: string, key: string): boolean {
  const expected = sign(body, key)
  const a = Buffer.from(signature)
  const b = Buffer.from(expected)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

/** userId を短命チケットにする（LIFF検証直後に発行） */
export function issueTicket(userId: string, key: string): string {
  const body = Buffer.from(`${userId}.${Date.now() + TICKET_TTL_MS}`, 'utf8').toString('base64url')
  return `t1.${body}.${sign(body, key)}`
}

/** チケットを検証して userId を取り出す。無効・期限切れは null */
export function readTicket(ticket: string, key: string): string | null {
  const parts = String(ticket ?? '').split('.')
  if (parts.length !== 3 || parts[0] !== 't1') return null
  const [, body, signature] = parts
  if (!verifySignature(body, signature, key)) return null

  const decoded = Buffer.from(body, 'base64url').toString('utf8')
  const sep = decoded.lastIndexOf('.')
  if (sep < 0) return null
  const userId = decoded.slice(0, sep)
  const expiresAt = Number(decoded.slice(sep + 1))
  if (!Number.isFinite(expiresAt) || Date.now() > expiresAt) return null
  if (!USER_ID_PATTERN.test(userId)) return null
  return userId
}

/** userId を長期保存用に封印する（シートへ保存し、キャンセル通知で使う） */
export function sealUserId(userId: string, key: string): string {
  const body = Buffer.from(userId, 'utf8').toString('base64url')
  return `s1.${body}.${sign(body, key)}`
}

/** 封印済み文字列から userId を取り出す。改ざん・形式不正は null */
export function unsealUserId(sealed: string, key: string): string | null {
  const parts = String(sealed ?? '').split('.')
  if (parts.length !== 3 || parts[0] !== 's1') return null
  const [, body, signature] = parts
  if (!verifySignature(body, signature, key)) return null
  const userId = Buffer.from(body, 'base64url').toString('utf8')
  return USER_ID_PATTERN.test(userId) ? userId : null
}
