/**
 * アウトカムの「測り方の図」の記録の決まり（純粋な関数。サーバー・画面・テストで同じ）
 *
 * 2026-11-27 院長「検査方法をChat Gptを使用して画像としても載せてください」。
 * 図は院長が作る（ChatGPT＝OpenAI の画像生成）→ 院長が見て「この図を使う」にしたものだけカルテに出す。
 * 場面の説明は src/data/outcome-method-images.ts、記録は KV の omimg:all（method-image-server.ts）。
 */
import { METHOD_IMAGE_SCENES } from '@/data/outcome-method-images'
import type { OutcomeMetricKey } from '@/types/contracts'

export interface MethodImage {
  url: string
  /** 作った画像のモデル（gpt-image-…） */
  model: string
  createdAt: string
  approvedAt?: string
}

export interface MethodImageEntry {
  /** カルテに出している図 */
  approved?: MethodImage
  /** 作ったが、まだ院長が「使う」にしていない図 */
  draft?: MethodImage
}

export type MethodImageStore = Partial<Record<OutcomeMetricKey, MethodImageEntry>>

export type MethodImageAction = 'generate' | 'approve' | 'discard' | 'remove'
export const METHOD_IMAGE_ACTIONS: MethodImageAction[] = ['generate', 'approve', 'discard', 'remove']

export const METHOD_IMAGE_NOTE = 'AI（ChatGPT）で作ったイメージ図です。測り方は、説明の文と院の手順を優先してください。'

export function isMethodImageKey(key: unknown): key is OutcomeMetricKey {
  return typeof key === 'string' && Object.prototype.hasOwnProperty.call(METHOD_IMAGE_SCENES, key)
}

/**
 * 操作を当てはめる。消してよい Blob の URL（toDelete）も返す
 * - generate：新しい図を下書きに（前の下書きは消す。使っている図はそのまま）
 * - approve：下書きを使う図に（前に使っていた図は消す）
 * - discard：下書きを消す
 * - remove：使っている図を外して消す
 */
export function applyMethodImageAction(
  store: MethodImageStore,
  key: OutcomeMetricKey,
  action: MethodImageAction,
  now: string,
  generated?: Omit<MethodImage, 'approvedAt'>,
): { next: MethodImageStore; toDelete: string[]; error?: string } {
  const cur: MethodImageEntry = { ...(store[key] ?? {}) }
  const toDelete: string[] = []
  if (action === 'generate') {
    if (!generated) return { next: store, toDelete, error: '作った図がありません' }
    if (cur.draft) toDelete.push(cur.draft.url)
    cur.draft = { ...generated }
  } else if (action === 'approve') {
    if (!cur.draft) return { next: store, toDelete, error: '使う図（下書き）がありません' }
    if (cur.approved) toDelete.push(cur.approved.url)
    cur.approved = { ...cur.draft, approvedAt: now }
    delete cur.draft
  } else if (action === 'discard') {
    if (!cur.draft) return { next: store, toDelete, error: '下書きがありません' }
    toDelete.push(cur.draft.url)
    delete cur.draft
  } else {
    if (!cur.approved) return { next: store, toDelete, error: '使っている図がありません' }
    toDelete.push(cur.approved.url)
    delete cur.approved
  }
  const next: MethodImageStore = { ...store }
  if (cur.approved || cur.draft) next[key] = cur
  else delete next[key]
  return { next, toDelete }
}

/** まだ図（使っている図も下書きも）が無い指標 */
export function keysWithoutImage(store: MethodImageStore): OutcomeMetricKey[] {
  return (Object.keys(METHOD_IMAGE_SCENES) as OutcomeMetricKey[]).filter((k) => !store[k]?.approved && !store[k]?.draft)
}
