/**
 * カルテの画面の「LINE連携のQRコード」の置き場所と結びつけ（サーバー専用）
 *
 * KV の lqr:<番号> に1件ずつ。使えるのは10分・1回だけ（lib/line-link-qr.ts）。
 * - 作る・状態を見る・取り消す … 院内アプリ（/api/line-link/qr。Basic 認証の内側）
 * - お名前を見る・結びつける … 患者さんの LINE（/api/liff/link。LINE でログインした証明＝チケットが要る）
 * 結びついたら、カルテのお名前・電話番号・生年月日は消して、印（状態・日時・キー・患者番号）だけを残す。
 * お名前・電話番号は記録（ログ）に出さない。
 */
import { createHmac, randomBytes } from 'node:crypto'
import { kvDelete, kvGet, kvList, kvSet } from '@/lib/marketing/kv-store-server'
import { nameNoSpace, phoneDigits } from '@/lib/line-link'
import { getLineLink, linkLineUser, type LinkLineUserResult } from '@/lib/line-link-server'
import {
  LINK_QR_PREFIX,
  LINK_QR_TTL_MS,
  isLinkQrExpired,
  isLinkQrOpen,
  isValidLinkCode,
  type LinkQrSession,
} from '@/lib/line-link-qr'

/** 期限が過ぎてから印を残しておく時間（カルテの画面が「結びつきました」を読み取りそこねないように） */
const KEEP_AFTER_MS = 24 * 60 * 60 * 1000
const ID_RE = /^[A-Za-z0-9_-]{1,64}$/
const YMD_RE = /^\d{4}-\d{2}-\d{2}$/

const keyOf = (code: string) => `${LINK_QR_PREFIX}${code}`

/** 古い番号を消す（失敗しても、作る・読むのは続ける） */
async function sweep(now: Date): Promise<void> {
  try {
    const all = await kvList<LinkQrSession>(LINK_QR_PREFIX)
    const limit = new Date(now.getTime() - KEEP_AFTER_MS).toISOString()
    for (const { key, value } of all) {
      if (!value?.expiresAt || value.expiresAt < limit) await kvDelete(key)
    }
  } catch {
    // 掃除は付け足し
  }
}

/** 中身を消して印だけにする（結びついた・取り消した・期限切れ） */
const stripped = (s: LinkQrSession, patch: Partial<LinkQrSession>): LinkQrSession => ({ ...s, name: '', phone: '', birthDate: '', ...patch })

export interface CreateLinkQrInput {
  patientId: string
  name: string
  phone?: string
  birthDate?: string
}

/** カルテの画面から：その方だけの番号を作る（同じ方のまだ使っていない番号は取り消す） */
export async function createLinkQr(input: CreateLinkQrInput, now: Date = new Date()): Promise<LinkQrSession> {
  const patientId = String(input.patientId ?? '')
  const name = String(input.name ?? '').replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 40)
  if (!ID_RE.test(patientId)) throw new Error('カルテが正しくありません')
  if (!nameNoSpace(name)) throw new Error('カルテにお名前がありません')
  const digits = phoneDigits(String(input.phone ?? ''))
  const phone = digits.length >= 10 && digits.length <= 11 ? digits : ''
  const birthDate = YMD_RE.test(String(input.birthDate ?? '')) ? String(input.birthDate) : ''

  await sweep(now)
  const all = await kvList<LinkQrSession>(LINK_QR_PREFIX).catch(() => [])
  for (const { key, value } of all) {
    if (value?.patientId === patientId && isLinkQrOpen(value, now)) await kvSet(key, stripped(value, { status: 'cancelled' }))
  }
  const session: LinkQrSession = {
    code: randomBytes(18).toString('base64url'),
    patientId,
    name,
    phone,
    birthDate,
    status: 'waiting',
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + LINK_QR_TTL_MS).toISOString(),
  }
  await kvSet(keyOf(session.code), session)
  return session
}

export async function getLinkQr(code: string): Promise<LinkQrSession | null> {
  if (!isValidLinkCode(code)) return null
  const s = await kvGet<LinkQrSession>(keyOf(code))
  return s && s.code === code ? s : null
}

/** カルテの画面から：取り消す（閉じた・出し直した） */
export async function cancelLinkQr(code: string): Promise<void> {
  const s = await getLinkQr(code)
  if (s && s.status === 'waiting') await kvSet(keyOf(code), stripped(s, { status: 'cancelled' }))
}

/** カルテの画面が見る状態（お名前・電話番号は返さない） */
export async function linkQrStatus(
  code: string,
  now: Date = new Date(),
): Promise<{ status: LinkQrSession['status'] | 'missing'; expired: boolean; expiresAt?: string; linkedAt?: string; patientNo?: string }> {
  const s = await getLinkQr(code)
  if (!s) return { status: 'missing', expired: true }
  return { status: s.status, expired: s.status === 'waiting' && isLinkQrExpired(s, now), expiresAt: s.expiresAt, linkedAt: s.linkedAt, patientNo: s.patientNo }
}

export type LinkQrProblem = 'missing' | 'expired' | 'used' | 'cancelled'

/** 結びつけた LINE の印（院の鍵で封じる。同じ LINE かどうかを見分けるだけで、userId には戻せない） */
export function linkedByOf(userId: string, secret: string): string {
  return createHmac('sha256', secret).update(`lqr-user:${userId}`).digest('base64url').slice(0, 22)
}

/** この LINE で、もう結びついている番号か（同じ LINE で開き直したとき） */
export interface LinkQrAlready {
  /** カルテのお名前（結びつけの記録から。読めなければ ''） */
  name: string
  patientNo?: string
}

async function alreadyOf(s: LinkQrSession | null, linkedBy: string | undefined): Promise<LinkQrAlready | null> {
  if (!s || s.status !== 'linked' || !linkedBy || !s.linkedBy || s.linkedBy !== linkedBy) return null
  const link = s.linkKey ? await getLineLink(s.linkKey).catch(() => null) : null
  return { name: link?.name ?? '', patientNo: s.patientNo }
}

function problemOf(s: LinkQrSession | null, now: Date): LinkQrProblem | null {
  if (!s) return 'missing'
  if (s.status === 'linked') return 'used'
  if (s.status === 'cancelled') return 'cancelled'
  if (isLinkQrExpired(s, now)) return 'expired'
  return null
}

/** 患者さんの LINE から：結びつける前に、カルテのお名前と、電話番号を入れてもらうかを返す */
export async function previewLinkQr(
  code: string,
  now: Date = new Date(),
  /** 開いた LINE の印（linkedByOf）。この LINE でもう結びついていれば already を返す */
  linkedBy?: string,
): Promise<{ ok: true; name: string; needPhone: boolean } | { ok: false; reason: LinkQrProblem; already?: LinkQrAlready }> {
  const s = await getLinkQr(code)
  const problem = problemOf(s, now)
  const already = await alreadyOf(s, linkedBy)
  if (already) return { ok: false, reason: 'used', already }
  if (problem || !s) return { ok: false, reason: problem ?? 'missing' }
  return { ok: true, name: s.name, needPhone: !s.phone }
}

/**
 * 患者さんの LINE から：結びつける。お名前・電話番号・生年月日はカルテのもの（電話番号が無い方だけ、入れてもらった番号）。
 * 1回だけ使える。結びついたら番号の中身を消して、印だけを残す。
 */
export async function redeemLinkQr(
  input: { code: string; userId: string; phone?: string },
  secret: string,
  now: Date = new Date(),
): Promise<{ ok: true; result: LinkLineUserResult } | { ok: false; reason: LinkQrProblem | 'phone'; already?: LinkQrAlready }> {
  const s = await getLinkQr(input.code)
  const problem = problemOf(s, now)
  const linkedBy = linkedByOf(input.userId, secret)
  const already = await alreadyOf(s, linkedBy)
  if (already) return { ok: false, reason: 'used', already }
  if (problem || !s) return { ok: false, reason: problem ?? 'missing' }
  let phone = s.phone
  if (!phone) {
    const digits = phoneDigits(String(input.phone ?? ''))
    if (digits.length < 10 || digits.length > 11) return { ok: false, reason: 'phone' }
    phone = digits
  }
  const result = await linkLineUser(
    { userId: input.userId, name: s.name, phone, birthDate: s.birthDate, via: 'karte-qr', patientId: s.patientId },
    secret,
  )
  await kvSet(
    keyOf(s.code),
    stripped(s, {
      status: 'linked',
      linkedAt: new Date().toISOString(),
      linkKey: result.key,
      patientNo: result.patientNo ?? undefined,
      linkedBy,
    }),
  )
  return { ok: true, result }
}
