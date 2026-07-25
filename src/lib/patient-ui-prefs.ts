// 患者一覧のUI設定（ピン留め・最近閲覧）
// 既存の patient-store のデータ構造には手を加えず、独立したキーで管理する。
// クラウド同期のデバウンスを無駄に起動しないよう、直接 localStorage を読み書きする。

const PIN_KEY = 'pt_pinned'
const RECENT_KEY = 'pt_recent_views'
const RECENT_MAX = 8

function read<T>(key: string): T[] {
  if (typeof window === 'undefined') return []
  try {
    return JSON.parse(localStorage.getItem(key) ?? '[]') as T[]
  } catch {
    return []
  }
}

// ── ピン留め ──
export function getPinnedIds(): string[] {
  return read<string>(PIN_KEY)
}

export function togglePin(patientId: string): string[] {
  const pins = getPinnedIds()
  const next = pins.includes(patientId)
    ? pins.filter(id => id !== patientId)
    : [...pins, patientId]
  localStorage.setItem(PIN_KEY, JSON.stringify(next))
  return next
}

// ── 最近閲覧 ──
export interface RecentView {
  id: string
  at: string
}

export function getRecentViews(): RecentView[] {
  return read<RecentView>(RECENT_KEY)
}

export function recordRecentView(patientId: string): void {
  if (typeof window === 'undefined') return
  const views = getRecentViews().filter(v => v.id !== patientId)
  views.unshift({ id: patientId, at: new Date().toISOString() })
  localStorage.setItem(RECENT_KEY, JSON.stringify(views.slice(0, RECENT_MAX)))
}
