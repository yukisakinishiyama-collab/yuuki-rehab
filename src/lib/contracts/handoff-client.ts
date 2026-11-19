/**
 * 契約書・同意書の受け渡し（ブラウザ側）：/api/karte/handoff を呼ぶ
 * 決まりは lib/contracts/handoff.ts、置き場所は lib/karte/handoff-server.ts
 */
import type { ContractRecord, ContractSnapshot } from '@/types/contracts'
import type { HandoffDraft, HandoffListItem, HandoffSession } from './handoff'

const API = '/api/karte/handoff'

async function post(body: Record<string, unknown>): Promise<Record<string, unknown>> {
  const res = await fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify(body) })
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>
  if (res.status === 401) throw new Error('ログインが切れています。アプリを閉じて開き直し、パスワードで入り直してください。')
  if (!res.ok) throw new Error(typeof data.error === 'string' ? data.error : `HTTP ${res.status}`)
  return data
}

export async function createHandoff(input: { patientId: string; patientName: string; title: string; draft: HandoffDraft }): Promise<{ token: string; expiresAt: string }> {
  const data = await post({ action: 'create', ...input })
  if (typeof data.token !== 'string' || typeof data.expiresAt !== 'string') throw new Error('受け渡しを作れませんでした')
  return { token: data.token, expiresAt: data.expiresAt }
}

export type HandoffFetch = { kind: 'ok'; session: HandoffSession; expired: boolean } | { kind: 'missing' } | { kind: 'error'; message: string }

export async function fetchHandoff(token: string): Promise<HandoffFetch> {
  try {
    const res = await fetch(`${API}?t=${encodeURIComponent(token)}`, { cache: 'no-store', credentials: 'same-origin' })
    if (res.status === 404) return { kind: 'missing' }
    const data = (await res.json().catch(() => ({}))) as { session?: HandoffSession; expired?: boolean; error?: string }
    if (!res.ok || !data.session) return { kind: 'error', message: data.error ?? `HTTP ${res.status}` }
    return { kind: 'ok', session: data.session, expired: Boolean(data.expired) }
  } catch (e) {
    return { kind: 'error', message: e instanceof Error ? e.message : String(e) }
  }
}

export async function fetchOpenHandoffs(patientId: string): Promise<HandoffListItem[]> {
  try {
    const res = await fetch(`${API}?patientId=${encodeURIComponent(patientId)}`, { cache: 'no-store', credentials: 'same-origin' })
    if (!res.ok) return []
    const data = (await res.json()) as { sessions?: HandoffListItem[] }
    return Array.isArray(data.sessions) ? data.sessions : []
  } catch {
    return []
  }
}

export async function markHandoffOpened(token: string): Promise<{ ok: boolean; reason?: string }> {
  const data = await post({ action: 'open', token })
  return { ok: data.ok === true, reason: typeof data.reason === 'string' ? data.reason : undefined }
}

export async function cancelHandoff(token: string): Promise<void> {
  await post({ action: 'cancel', token }).catch(() => undefined)
}

/** 署名が終わったことを知らせる（通信が切れていても、数回やり直す。だめでも、パソコンにはカルテの同期で届く） */
export async function markHandoffSigned(token: string, recordId: string): Promise<boolean> {
  for (let i = 0; i < 4; i += 1) {
    try {
      const data = await post({ action: 'done', token, recordId })
      if (data.ok === true) return true
    } catch {
      // やり直す
    }
    await new Promise((r) => setTimeout(r, 1500 * (i + 1)))
  }
  return false
}

/** 署名入りの本文と記録を読む（パソコンが、iPad で署名した書類を受け取るとき） */
export async function fetchSignedContract(recordId: string): Promise<{ record: ContractRecord; html: string } | null> {
  try {
    const res = await fetch(`/api/karte/contracts?id=${encodeURIComponent(recordId)}`, { cache: 'no-store', credentials: 'same-origin' })
    const data = (await res.json().catch(() => ({}))) as { snapshot?: ContractSnapshot }
    if (!res.ok || !data.snapshot?.record || typeof data.snapshot.html !== 'string') return null
    return { record: data.snapshot.record, html: data.snapshot.html }
  } catch {
    return null
  }
}
