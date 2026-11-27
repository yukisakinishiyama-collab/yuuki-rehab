/**
 * 経営方針（90日計画）の進み具合の保存（サーバー専用。院長だけの API と経営相談から使う）
 * KV の keiei:strategy。中身（方針の文）はコードの src/data/keiei-strategy.ts
 */
import { kvGet, kvSet } from './kv-store-server'
import { EMPTY_PROGRESS, type StrategyProgress } from './keiei-strategy'

const KEY = 'keiei:strategy'

export async function getStrategyProgress(): Promise<StrategyProgress> {
  const v = await kvGet<StrategyProgress>(KEY).catch(() => null)
  if (!v || typeof v !== 'object') return { ...EMPTY_PROGRESS }
  return { startDate: v.startDate ?? null, done: v.done ?? {}, reviews: v.reviews ?? {}, updatedAt: v.updatedAt }
}

export async function saveStrategyProgress(p: StrategyProgress, now = new Date()): Promise<StrategyProgress> {
  const next: StrategyProgress = { startDate: p.startDate, done: p.done, reviews: p.reviews, updatedAt: now.toISOString() }
  await kvSet(KEY, next)
  return next
}
