// ──────────────────────────────────────────────
// Feature Flag（次世代化プロジェクト）
//
// 新機能は必ずフラグで包み、問題があればコードを戻さずに
// 機能単位でOFFにできるようにする（NEXTGEN-PLAN.md §6）。
// 設定は端末ごと（localStorage）。既定値はここで管理する。
// ──────────────────────────────────────────────

export type FeatureKey =
  | 'explanationMode'   // 患者説明モード（カルテの全画面提示）
  | 'goalsProblems'     // 目標二層（本人の目標／臨床目標）と問題リスト
  | 'smartProtocol'     // 進行基準×実測値の自動照合＋条件ベース再評価リマインド
  | 'conditionImages'   // 患者説明モードの疾患別実写画像

/** 既定値。問題発生時はここを false にしてデプロイすれば全端末で止まる */
const DEFAULTS: Record<FeatureKey, boolean> = {
  explanationMode: true,
  goalsProblems: true,
  smartProtocol: true,
  conditionImages: true,
}

const STORAGE_KEY = 'featureFlags'

function readOverrides(): Partial<Record<FeatureKey, boolean>> {
  if (typeof window === 'undefined') return {}
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as unknown
    return parsed && typeof parsed === 'object' ? (parsed as Partial<Record<FeatureKey, boolean>>) : {}
  } catch {
    return {}
  }
}

export function isFeatureEnabled(key: FeatureKey): boolean {
  const overrides = readOverrides()
  return overrides[key] ?? DEFAULTS[key]
}

/** 端末単位でのON/OFF切り替え（トラブル時の避難ハッチ） */
export function setFeatureFlag(key: FeatureKey, enabled: boolean): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...readOverrides(), [key]: enabled }))
}
