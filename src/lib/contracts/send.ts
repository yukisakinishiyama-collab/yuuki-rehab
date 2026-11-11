'use client'
// ──────────────────────────────────────────────
// 署名済みの書類をクラウドへ送る（/api/karte/contracts）と、送れなかったときの「送信待ち」
//
// 送れなかった書類は、この端末の localStorage（contract_pending。pt_ ではないのでカルテの同期には乗らない）に残し、
// 「送り直す」かカルテの「契約・同意書」を開いたときに、もう一度送る。控えの印刷は送れなくてもできる。
// 送れなかった理由（状態の番号・端末の種類。お名前などは入れない）はサーバーの記録に残す（原因を調べるため）。
// ──────────────────────────────────────────────
import type { ContractRecord } from '@/types/contracts'

export const PENDING_KEY = 'contract_pending'
const TIMEOUT_MS = 25_000

export interface PendingContract {
  record: ContractRecord
  html: string
  at: string
  error?: string
}

export type SendResult = { ok: true } | { ok: false; status: number; message: string }

function readPending(): PendingContract[] {
  if (typeof window === 'undefined') return []
  try {
    const v = JSON.parse(localStorage.getItem(PENDING_KEY) ?? '[]')
    return Array.isArray(v) ? (v as PendingContract[]) : []
  } catch {
    return []
  }
}

function writePending(list: PendingContract[]): boolean {
  try {
    localStorage.setItem(PENDING_KEY, JSON.stringify(list))
    return true
  } catch {
    return false
  }
}

export function getPendingContracts(patientId?: string): PendingContract[] {
  return readPending().filter((p) => !patientId || p.record.patientId === patientId)
}

/** 送れなかった書類を端末に残す（同じ記録IDは上書き）。残せなかったら false */
export function keepPending(item: PendingContract): boolean {
  const list = readPending().filter((p) => p.record.id !== item.record.id)
  list.push(item)
  return writePending(list)
}

export function dropPending(id: string): void {
  writePending(readPending().filter((p) => p.record.id !== id))
}

/** 送れなかった理由を、画面に出す言葉にする */
export function sendErrorText(r: Extract<SendResult, { ok: false }>): string {
  if (r.status === 0) return `インターネットにつながらず送れませんでした（${r.message}）。Wi-Fi を確かめてください。`
  if (r.status === 401) return 'ログインが切れています。アプリを閉じて開き直し、院長かスタッフのパスワードで入り直してください。'
  if (r.status === 413) return '送る量が大きすぎました。署名を「書き直す」で小さめに書き直してください。'
  return `保存できませんでした（${r.status}${r.message ? `：${r.message}` : ''}）。`
}

/** 送れなかったことをサーバーの記録に残す（中身・お名前は送らない。失敗しても何もしない） */
function report(stage: string, r: Extract<SendResult, { ok: false }>, bytes: number) {
  try {
    const nav = navigator as Navigator & { standalone?: boolean }
    const body = JSON.stringify({
      report: {
        stage,
        status: r.status,
        message: r.message.slice(0, 200),
        bytes,
        standalone: nav.standalone === true || Boolean(window.matchMedia?.('(display-mode: standalone)').matches),
        online: navigator.onLine,
        ua: navigator.userAgent.slice(0, 200),
      },
    })
    void fetch('/api/karte/contracts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body, keepalive: true }).catch(() => {})
  } catch {
    // 記録できなくても、画面の動きには関係ない
  }
}

/** 1件送る（25秒で打ち切る） */
export async function sendContract(record: ContractRecord, html: string, stage = 'sign'): Promise<SendResult> {
  const body = JSON.stringify({ record, html })
  const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null
  const timer = ctrl ? setTimeout(() => ctrl.abort(), TIMEOUT_MS) : null
  let result: SendResult
  try {
    const res = await fetch('/api/karte/contracts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      cache: 'no-store',
      body,
      signal: ctrl?.signal,
    })
    if (res.ok) {
      result = { ok: true }
    } else {
      const j = (await res.json().catch(() => ({}))) as { error?: string }
      result = { ok: false, status: res.status, message: j.error ?? '' }
    }
  } catch (e) {
    const aborted = e instanceof DOMException && e.name === 'AbortError'
    result = { ok: false, status: 0, message: aborted ? '25秒たっても返事がありませんでした' : e instanceof Error ? e.message : String(e) }
  } finally {
    if (timer) clearTimeout(timer)
  }
  if (!result.ok) report(stage, result, body.length)
  return result
}
