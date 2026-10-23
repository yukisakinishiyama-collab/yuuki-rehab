/**
 * 院内アプリの端末ログイン（院内専用。患者さんのカルテは patient-store.ts）
 *
 * 以前の「動作解析（案件・動画・コメント・AI分析）」のデータ置き場は機能ごと削除した
 * （端末やクラウドの控えに残っている古いデータは使わないだけで、消してはいない）。
 */
import type { User } from '@/types/rehab'
import { MOCK_USERS } from './rehab-data'

const MOCK_CREDENTIALS: Record<string, string> = {
  'user-001': 'rehab2026',
}

const USER_KEY = 'rehabUser'

/** 以前の版との互換のために残す（いまは準備することがない） */
export function initStore(): void {}

/** ログイン。成功で true、IDかパスワードが違えば false */
export function login(userId: string, password: string): boolean {
  const expected = MOCK_CREDENTIALS[userId]
  if (!expected || password !== expected) return false
  const user = MOCK_USERS.find((u) => u.id === userId)
  if (!user) return false
  localStorage.setItem(USER_KEY, JSON.stringify(user))
  return true
}

export function logout(): void {
  localStorage.removeItem(USER_KEY)
}

// QRログイン用トークン（30分有効）
// フォーマット: userId~expires~nonce（URLセーフ、localStorage不要）
export function generateQRToken(): string {
  const userId = 'user-001'
  const expires = Date.now() + 30 * 60 * 1000
  const nonce = Math.random().toString(36).slice(2, 8)
  return `${userId}~${expires}~${nonce}`
}

export function loginWithQRToken(token: string): boolean {
  if (typeof window === 'undefined') return false
  try {
    const parts = token.split('~')
    if (parts.length < 2) return false
    const userId = parts[0]
    const expires = parseInt(parts[1], 10)
    if (!userId || isNaN(expires) || Date.now() > expires) return false
    const user = MOCK_USERS.find((u) => u.id === userId)
    if (!user) return false
    localStorage.setItem(USER_KEY, JSON.stringify(user))
    return true
  } catch {
    return false
  }
}

export function getCurrentUser(): User | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(USER_KEY)
    return raw ? (JSON.parse(raw) as User) : null
  } catch {
    return null
  }
}
