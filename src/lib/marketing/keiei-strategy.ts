/**
 * 経営方針（90日計画）の進み具合の決まり（純粋な関数。画面・サーバー・テストで同じ）
 *
 * 中身は src/data/keiei-strategy.ts、進み具合は KV の keiei:strategy（院長だけ）。
 * 2026-11-27 院長「この内容を今後の経営課題としてガイド、登録してください」
 */
import { STRATEGY, STRATEGY_PHASES, STRATEGY_REVIEWS, trialBreakdown, type StrategyPhase, type StrategyTask } from '@/data/keiei-strategy'

export type ReviewStatus = 'checked' | 'decided'

export const REVIEW_STATUS_LABEL: Record<ReviewStatus, string> = {
  checked: '確認した',
  decided: '方針を決めた',
}

export interface StrategyProgress {
  /** 90日の1日目（院長が決める。まだなら null） */
  startDate: string | null
  /** 済んだこと（id → 済ませた日 YYYY-MM-DD） */
  done: Record<string, string>
  /** 見直したほうがよい点（id → 確かめた状態） */
  reviews: Record<string, ReviewStatus>
  updatedAt?: string
}

export const EMPTY_PROGRESS: StrategyProgress = { startDate: null, done: {}, reviews: {} }
export const PLAN_DAYS = 90

const YMD = /^\d{4}-\d{2}-\d{2}$/

function daysBetween(from: string, to: string): number {
  const [y1, m1, d1] = from.split('-').map(Number)
  const [y2, m2, d2] = to.split('-').map(Number)
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86_400_000)
}

/** 何日目か（1日目が始めた日。始めていなければ null。始める前の日は 0 以下） */
export function strategyDay(startDate: string | null, today: string): number | null {
  if (!startDate || !YMD.test(startDate) || !YMD.test(today)) return null
  return daysBetween(startDate, today) + 1
}

/** その日がどの段階か（90日を過ぎたら null） */
export function phaseOfDay(day: number | null): StrategyPhase | null {
  if (day === null || day < 1) return null
  return STRATEGY_PHASES.find((p) => day >= p.from && day <= p.to) ?? null
}

export interface ProgressSummary {
  day: number | null
  phase: StrategyPhase | null
  finished: boolean
  done: number
  total: number
  /** 段階の日が過ぎたのに、まだのこと */
  overdue: StrategyTask[]
  /** まだ確かめていない「見直したほうがよい点」 */
  openReviews: number
}

export function summarizeProgress(p: StrategyProgress, today: string): ProgressSummary {
  const day = strategyDay(p.startDate, today)
  const tasks = STRATEGY_PHASES.flatMap((ph) => ph.tasks)
  const overdue = day === null ? [] : STRATEGY_PHASES.filter((ph) => day > ph.to).flatMap((ph) => ph.tasks).filter((t) => !p.done[t.id])
  return {
    day,
    phase: phaseOfDay(day),
    finished: day !== null && day > PLAN_DAYS,
    done: tasks.filter((t) => p.done[t.id]).length,
    total: tasks.length,
    overdue,
    openReviews: STRATEGY_REVIEWS.filter((r) => !p.reviews[r.id]).length,
  }
}

/** 保存の前の確かめ（だめなら理由） */
export function progressProblem(x: unknown): string | null {
  if (!x || typeof x !== 'object') return '形が正しくありません'
  const p = x as Record<string, unknown>
  if (p.startDate !== null && (typeof p.startDate !== 'string' || !YMD.test(p.startDate))) return '始めた日が正しくありません'
  const taskIds = new Set(STRATEGY_PHASES.flatMap((ph) => ph.tasks.map((t) => t.id)))
  const done = p.done as Record<string, unknown> | undefined
  if (!done || typeof done !== 'object') return '済んだことの形が正しくありません'
  for (const [k, v] of Object.entries(done)) if (!taskIds.has(k) || typeof v !== 'string' || !YMD.test(v)) return '済んだことの形が正しくありません'
  const reviewIds = new Set(STRATEGY_REVIEWS.map((r) => r.id))
  const reviews = p.reviews as Record<string, unknown> | undefined
  if (!reviews || typeof reviews !== 'object') return '見直しの形が正しくありません'
  for (const [k, v] of Object.entries(reviews)) if (!reviewIds.has(k) || (v !== 'checked' && v !== 'decided')) return '見直しの形が正しくありません'
  return null
}

const yen = (n: number) => `${Math.round(n).toLocaleString('ja-JP')}円`

/** 経営相談（AI）に渡す、方針の要点と進み具合（数字と方針だけ。お名前などは入らない） */
export function strategyContextLines(p: StrategyProgress, today: string, appGoal: number | null): string[] {
  const s = summarizeProgress(p, today)
  const t = trialBreakdown()
  const lines = [
    `【院長が登録した経営方針（${STRATEGY.registeredAt}）】${STRATEGY.title}。合言葉「${STRATEGY.motto}」。理念「${STRATEGY.philosophy}」。`,
    `- 目指す姿: ${STRATEGY.vision}`,
    ...STRATEGY.stance.map((x) => `- 立ち位置: ${x}`),
    `- 主力サービス: ${STRATEGY.services.map((x) => `${x.title}（${x.who}）`).join('、')}`,
    `- 入口: ${STRATEGY.entry.name}（${STRATEGY.entry.minutes}分・${yen(STRATEGY.entry.price)}）。${STRATEGY.entry.note}`,
    `- 目標: 月商 ${yen(STRATEGY.goal.monthlySales)} 以上を安定して${appGoal ? `（アプリの月の目標は ${yen(appGoal)}）` : ''}。試算: 初回の評価 ${yen(t.assessment)}＋自費 ${yen(t.self)}＝月 ${yen(t.total)} の上積み（仮定）`,
    `- 時間帯の重点: ${STRATEGY.timeSlots.map((x) => `${x.when}=${x.who}`).join('、')}`,
    `- 予算: ${STRATEGY.budget.days}日で ${yen(STRATEGY.budget.yen)} 以内。配分: ${STRATEGY.allocation.map((a) => `${a.label} ${a.pct}%`).join('、')}`,
  ]
  if (s.day === null) lines.push('- 90日計画: まだ始めていない')
  else if (s.finished) lines.push(`- 90日計画: 終わった（${s.day}日目）。済んだこと ${s.done}/${s.total}`)
  else lines.push(`- 90日計画: ${s.day}日目（${s.phase?.title ?? '始める前'}）。済んだこと ${s.done}/${s.total}${s.overdue.length ? `。遅れていること: ${s.overdue.map((x) => x.text).join('／')}` : ''}`)
  const open = STRATEGY_REVIEWS.filter((r) => !p.reviews[r.id])
  if (open.length) lines.push(`- まだ確かめていない見直しの点: ${open.map((r) => r.title).join('／')}`)
  return lines
}
