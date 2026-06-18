'use client'
// ──────────────────────────────────────────────
// クラウド同期サービス
// localStorage ↔ Supabase の双方向同期
// ──────────────────────────────────────────────

const SYNC_SECRET = process.env.NEXT_PUBLIC_SYNC_SECRET ?? ''
const SYNC_ENDPOINT = '/api/sync'

// 同期から除外するキー（一時データ・認証情報）
const EXCLUDE_KEYS = ['rehabStore_session', 'pt_initialized']

// デバウンス用タイマー
let debounceTimer: ReturnType<typeof setTimeout> | null = null

// ────────────────────────────────
// クラウドへ全データをプッシュ
// ────────────────────────────────
export async function pushToCloud(): Promise<boolean> {
  if (!SYNC_SECRET) return false

  const payload: Record<string, string> = {}
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)!
    if (!EXCLUDE_KEYS.includes(key)) {
      const val = localStorage.getItem(key)
      if (val) payload[key] = val
    }
  }

  try {
    const res = await fetch(SYNC_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-sync-secret': SYNC_SECRET,
      },
      body: JSON.stringify({ data: payload }),
    })
    return res.ok
  } catch {
    return false
  }
}

// ────────────────────────────────
// クラウドから全データをプル
// ────────────────────────────────
export async function pullFromCloud(): Promise<boolean> {
  if (!SYNC_SECRET) return false

  try {
    const res = await fetch(SYNC_ENDPOINT, {
      headers: { 'x-sync-secret': SYNC_SECRET },
    })
    if (!res.ok) return false

    const { data } = await res.json()
    if (!data || typeof data !== 'object') return false

    for (const [key, value] of Object.entries(data as Record<string, string>)) {
      if (typeof value === 'string') {
        localStorage.setItem(key, value)
      }
    }
    return true
  } catch {
    return false
  }
}

// ────────────────────────────────
// 保存後に呼ぶ（デバウンス付き）
// ────────────────────────────────
export function scheduleSync(delayMs = 1500): void {
  if (!SYNC_SECRET) return
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    pushToCloud()
  }, delayMs)
}

// ────────────────────────────────
// 同期が設定済みか確認
// ────────────────────────────────
export function isSyncEnabled(): boolean {
  return Boolean(SYNC_SECRET)
}
