'use client'
/**
 * この端末に覚えてある「月の売上の目標」（localStorage の keiei:goal。月の目標への道すじ・経営相談・PDCA・CSV の取り込みで同じ値）
 *
 * 2026-11-27 院長「初期値を200万円に修正」：初めの値（DEFAULT_GOAL）を 300万円 → 200万円 に。
 * 前の初めの値 300万円 のまま覚えている端末は、1回だけ 200万円 に直す（keiei:goal-v2 の印。そのあと院長が
 * 300万円 を入れ直したときは、そのまま使う）。
 */
import { DEFAULT_GOAL } from './goal-plan'

export const GOAL_KEY = 'keiei:goal'
const MIGRATED_KEY = 'keiei:goal-v2'
const OLD_DEFAULT = 3_000_000

/** 前の初めの値（300万円）のままなら、1回だけ今の初めの値に直す */
export function migrateSavedGoal(): void {
  try {
    if (window.localStorage.getItem(MIGRATED_KEY)) return
    if (Number(window.localStorage.getItem(GOAL_KEY)) === OLD_DEFAULT) window.localStorage.setItem(GOAL_KEY, String(DEFAULT_GOAL))
    window.localStorage.setItem(MIGRATED_KEY, '1')
  } catch {
    // 保存できない端末では何もしない
  }
}

/** 覚えてある目標（無ければ null） */
export function readSavedGoal(): number | null {
  migrateSavedGoal()
  try {
    const v = Number(window.localStorage.getItem(GOAL_KEY))
    return Number.isFinite(v) && v > 0 ? v : null
  } catch {
    return null
  }
}

/** 覚えてある目標（無ければ初めの値 200万円） */
export function goalOrDefault(): number {
  return readSavedGoal() ?? DEFAULT_GOAL
}
