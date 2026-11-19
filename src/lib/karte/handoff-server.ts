/**
 * 契約書・同意書の「受け渡し」（パソコン → iPad）の置き場所（サーバー専用。院内アプリの Basic 認証の内側）
 *
 * KV の khand:<受け渡しの番号> に1件ずつ。使える時間は1時間（lib/contracts/handoff.ts）。
 * 署名済み・取り消しになったら、中身（draft）は消して、印（状態・記録の ID）だけを残す。
 * 時間が過ぎたものは、次に作るとき・一覧を出すときに消す。お名前・中身は記録（ログ）に出さない。
 */
import { randomBytes } from 'node:crypto'
import { kvDelete, kvGet, kvList, kvSet } from '@/lib/marketing/kv-store-server'
import {
  HANDOFF_PREFIX,
  HANDOFF_TTL_MS,
  isHandoffExpired,
  isHandoffOpen,
  isValidHandoffToken,
  type HandoffDraft,
  type HandoffSession,
} from '@/lib/contracts/handoff'

/** 時間が過ぎてから、印を残しておく時間（パソコンが「署名済み」を読み取りそこねないように） */
const KEEP_AFTER_MS = 24 * 60 * 60 * 1000

const keyOf = (token: string) => `${HANDOFF_PREFIX}${token}`

function newToken(): string {
  return randomBytes(18).toString('base64url')
}

/** 古い受け渡しを消す（失敗しても、作る・読むのは続ける） */
async function sweep(now: Date): Promise<void> {
  try {
    const all = await kvList<HandoffSession>(HANDOFF_PREFIX)
    const limit = new Date(now.getTime() - KEEP_AFTER_MS).toISOString()
    for (const { key, value } of all) {
      if (!value?.expiresAt || value.expiresAt < limit) await kvDelete(key)
    }
  } catch {
    // 掃除は付け足し
  }
}

export async function createHandoff(
  input: { patientId: string; patientName: string; title: string; draft: HandoffDraft },
  now: Date = new Date(),
): Promise<HandoffSession> {
  await sweep(now)
  // 同じ患者さんの同じ書類で、まだ記入していない受け渡しがあれば取り消す（古い QR から2通目を作らせない）
  const all = await kvList<HandoffSession>(HANDOFF_PREFIX).catch(() => [])
  for (const { key, value } of all) {
    if (value?.patientId === input.patientId && value.draft?.docId === input.draft.docId && isHandoffOpen(value, now)) {
      const { draft: _draft, ...rest } = value
      void _draft
      await kvSet(key, { ...rest, status: 'cancelled' } satisfies HandoffSession)
    }
  }
  const session: HandoffSession = {
    token: newToken(),
    patientId: input.patientId,
    patientName: input.patientName,
    title: input.title,
    draft: input.draft,
    status: 'waiting',
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + HANDOFF_TTL_MS).toISOString(),
  }
  await kvSet(keyOf(session.token), session)
  return session
}

export async function getHandoff(token: string): Promise<HandoffSession | null> {
  if (!isValidHandoffToken(token)) return null
  const session = await kvGet<HandoffSession>(keyOf(token))
  return session && session.token === token ? session : null
}

export type HandoffUpdate =
  | { ok: true; session: HandoffSession }
  | { ok: false; reason: 'missing' | 'expired' | 'cancelled' | 'signed' }

/** iPad で書類を開いた */
export async function openHandoff(token: string, now: Date = new Date()): Promise<HandoffUpdate> {
  const session = await getHandoff(token)
  if (!session) return { ok: false, reason: 'missing' }
  if (session.status === 'cancelled') return { ok: false, reason: 'cancelled' }
  if (session.status === 'signed') return { ok: false, reason: 'signed' }
  if (isHandoffExpired(session, now)) return { ok: false, reason: 'expired' }
  if (session.status === 'opened') return { ok: true, session }
  const next: HandoffSession = { ...session, status: 'opened', openedAt: now.toISOString() }
  await kvSet(keyOf(token), next)
  return { ok: true, session: next }
}

/** iPad で署名が終わった（署名入りの本文は、もう kcdoc:<記録ID> に保存してある） */
export async function completeHandoff(token: string, recordId: string, now: Date = new Date()): Promise<HandoffUpdate> {
  const session = await getHandoff(token)
  if (!session) return { ok: false, reason: 'missing' }
  if (session.status === 'signed') return { ok: true, session }
  // 取り消し・時間切れのあとでも、署名してしまった書類は「署名済み」として残す（署名入りの本文はもう保存されているため。
  // パソコンの側は、カルテの同期でその記録を受け取る）
  const { draft: _draft, ...rest } = session
  void _draft
  const next: HandoffSession = { ...rest, status: 'signed', signedAt: now.toISOString(), recordId }
  await kvSet(keyOf(token), next)
  return { ok: true, session: next }
}

/** パソコンで取り消した（iPad に渡すのをやめた） */
export async function cancelHandoff(token: string): Promise<HandoffUpdate> {
  const session = await getHandoff(token)
  if (!session) return { ok: false, reason: 'missing' }
  if (session.status === 'signed') return { ok: false, reason: 'signed' }
  if (session.status === 'cancelled') return { ok: true, session }
  const { draft: _draft, ...rest } = session
  void _draft
  const next: HandoffSession = { ...rest, status: 'cancelled' }
  await kvSet(keyOf(token), next)
  return { ok: true, session: next }
}

/** その患者さんの、まだ記入できる受け渡し（新しい順） */
export async function listOpenHandoffs(patientId: string, now: Date = new Date()): Promise<HandoffSession[]> {
  const all = await kvList<HandoffSession>(HANDOFF_PREFIX)
  return all
    .map((x) => x.value)
    .filter((s): s is HandoffSession => Boolean(s) && s.patientId === patientId && isHandoffOpen(s, now))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}
