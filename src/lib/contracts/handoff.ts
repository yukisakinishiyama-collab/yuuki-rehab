// ──────────────────────────────────────────────
// 契約書・同意書を、ほかの端末（iPad）に渡して記入してもらう（決まり。純粋な関数。画面・API・テストから使う）
//
// 2026-11-19 院長の依頼「同意書の途中まではパソコンで説明し、記入するときは iPad で。
// 更新のずれが出る可能性があるので、QR 発行・読み取り → 患者記入 → 反映（パソコンにも）の流れで」。DECISIONS.md
//
// 1. パソコンで書類を開いて説明 →「iPadで記入してもらう」→ そのときの中身（□ のチェック・記入欄・会員の手続き・氏名）を
//    「受け渡し」として1時間だけクラウドに置き、QR コードを出す
// 2. iPad のカメラで QR を読む → 同じ患者さんの同じ書類が、パソコンで入れた中身のまま開く → チェック・署名
// 3. 署名が終わると、今までどおり署名入りの本文をクラウドに保存（書きかえない）→ 受け渡しに「署名済み」の印
// 4. パソコンは受け渡しの印を数秒ごとに見て、署名済みになったら、その記録を取りこんで「署名が完了しました」を出す
//    （カルテの同期＝15秒ごと を待たない）
// 書類の文面・署名の決まり（説明および同意書のチェックなど）は、今までの署名の画面をそのまま使う。
// ──────────────────────────────────────────────
import type { MemberInput } from './member'

/** 受け渡しが使える時間（説明が長引いてもよいように1時間。過ぎたら QR を出し直す） */
export const HANDOFF_TTL_MS = 60 * 60 * 1000
/** パソコンが受け渡しの印を見に行く間隔 */
export const HANDOFF_POLL_MS = 2500
/** 受け渡しの入れ物（KV）の頭 */
export const HANDOFF_PREFIX = 'khand:'

const TOKEN_RE = /^[A-Za-z0-9_-]{20,40}$/
const ID_RE = /^[A-Za-z0-9_-]{1,64}$/
const YMD_RE = /^\d{4}-\d{2}-\d{2}$/
const YM_RE = /^\d{4}-\d{2}$/
const MAX_MARKS = 400

/** パソコンで入れてあった中身（署名の画像は渡さない。署名は iPad でする） */
export interface HandoffDraft {
  /** 書類（ひな形）の ID・版・文面の指紋。iPad の側のひな形と同じかを確かめる */
  docId: string
  version: string
  bodyHash: string
  checks: boolean[]
  /** 手で入れた値（null は自動で入る欄のまま） */
  inputs: Array<string | null>
  member: MemberInput
  patientName: string
  minor: boolean
  guardianName: string
  relation: string
  staffName: string
}

export type HandoffStatus = 'waiting' | 'opened' | 'signed' | 'cancelled'

export interface HandoffSession {
  token: string
  patientId: string
  /** 一覧に出す用（iPad の院内アプリで「パソコンから届いた書類」を選ぶとき） */
  patientName: string
  title: string
  /** 署名済み・取り消しのあとは消す（中身を長く置かない） */
  draft?: HandoffDraft
  status: HandoffStatus
  createdAt: string
  expiresAt: string
  openedAt?: string
  signedAt?: string
  /** 署名済みの記録の ID（kcdoc:<id>・pt_contracts） */
  recordId?: string
}

export function isValidHandoffToken(token: unknown): token is string {
  return typeof token === 'string' && TOKEN_RE.test(token)
}

export function isHandoffExpired(session: Pick<HandoffSession, 'expiresAt'>, now: Date = new Date()): boolean {
  return !session.expiresAt || now.toISOString() >= session.expiresAt
}

/** iPad で開くアドレス（QR コードの中身） */
export function handoffUrl(origin: string, token: string): string {
  return `${origin.replace(/\/$/, '')}/patients/sign?t=${encodeURIComponent(token)}`
}

const str = (v: unknown, max: number): string => (typeof v === 'string' ? v.replace(/[\p{Cc}\p{Zl}\p{Zp}]/gu, ' ').trim().slice(0, max) : '')

/** 外から届いた中身の形を確かめる（おかしければ null）。文字は長さを切る */
export function sanitizeHandoffDraft(input: unknown): HandoffDraft | null {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null
  const d = input as Record<string, unknown>
  if (typeof d.docId !== 'string' || !d.docId || d.docId.length > 40) return null
  if (typeof d.version !== 'string' || d.version.length > 20) return null
  if (typeof d.bodyHash !== 'string' || !/^[0-9a-f]{8,32}$/.test(d.bodyHash)) return null
  if (!Array.isArray(d.checks) || d.checks.length > MAX_MARKS || !d.checks.every((c) => typeof c === 'boolean')) return null
  if (!Array.isArray(d.inputs) || d.inputs.length > MAX_MARKS || !d.inputs.every((v) => v === null || typeof v === 'string')) return null
  const m = (d.member && typeof d.member === 'object' && !Array.isArray(d.member) ? d.member : {}) as Record<string, unknown>
  const months = typeof m.pauseMonths === 'number' && Number.isInteger(m.pauseMonths) && m.pauseMonths >= 1 && m.pauseMonths <= 6 ? m.pauseMonths : 1
  const member: MemberInput = {
    plan: str(m.plan, 20),
    start: YMD_RE.test(String(m.start ?? '')) ? String(m.start) : '',
    partnerName: str(m.partnerName, 40),
    partnerRelation: str(m.partnerRelation, 20),
    partnerBirthDate: YMD_RE.test(String(m.partnerBirthDate ?? '')) ? String(m.partnerBirthDate) : '',
    partnerPatientId: ID_RE.test(String(m.partnerPatientId ?? '')) ? String(m.partnerPatientId) : '',
    pauseFrom: YM_RE.test(String(m.pauseFrom ?? '')) ? String(m.pauseFrom) : '',
    pauseMonths: months,
    special: m.special === true,
    specialReason: str(m.specialReason, 100),
  }
  return {
    docId: d.docId,
    version: d.version,
    bodyHash: d.bodyHash,
    checks: d.checks as boolean[],
    inputs: (d.inputs as Array<string | null>).map((v) => (v === null ? null : v.slice(0, 400))),
    member,
    patientName: str(d.patientName, 40),
    minor: d.minor === true,
    guardianName: str(d.guardianName, 40),
    relation: str(d.relation, 20),
    staffName: str(d.staffName, 40),
  }
}

/**
 * 届いた中身が、この端末のひな形と合うか（合わなければ、画面に出す理由）。
 * 版・文面がちがう（片方の端末が古いアプリのまま）と、□ や記入欄の場所がずれるので、開かない
 */
export function handoffDraftProblem(
  draft: HandoffDraft,
  tpl: { id: string; version: string; bodyHash: string; checkCount: number; blankCount: number } | null,
): string | null {
  if (!tpl || tpl.id !== draft.docId) return 'この書類が、この端末のアプリに見つかりませんでした。アプリを読み込み直してから、もう一度 QR コードを読み取ってください。'
  if (tpl.version !== draft.version || tpl.bodyHash !== draft.bodyHash || tpl.checkCount !== draft.checks.length || tpl.blankCount !== draft.inputs.length) {
    return 'パソコンとこの端末で、書類の版がちがいます。両方のアプリを読み込み直してから、パソコンで QR コードを出し直してください。'
  }
  return null
}

/** 受け渡しの状態を、パソコンの画面に出す言葉にする */
export function handoffStatusText(status: HandoffStatus | 'expired' | 'missing'): string {
  if (status === 'waiting') return 'iPad のカメラで、この QR コードを読み取ってください。'
  if (status === 'opened') return 'iPad で書類を開きました。記入と署名をお待ちください。'
  if (status === 'signed') return '署名が完了しました。'
  if (status === 'cancelled') return 'この受け渡しは取り消しました。'
  if (status === 'expired') return '時間が過ぎました（1時間）。QR コードを出し直してください。'
  return '受け渡しが見つかりませんでした。QR コードを出し直してください。'
}

/** ほかの端末に出す一覧の1行（中身は入れない） */
export interface HandoffListItem {
  token: string
  title: string
  status: HandoffStatus
  createdAt: string
}

export function toHandoffListItem(s: HandoffSession): HandoffListItem {
  return { token: s.token, title: s.title, status: s.status, createdAt: s.createdAt }
}

/** まだ記入できる受け渡しか（待ち・開いた・時間内） */
export function isHandoffOpen(s: HandoffSession, now: Date = new Date()): boolean {
  return (s.status === 'waiting' || s.status === 'opened') && !isHandoffExpired(s, now)
}
