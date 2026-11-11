// アウトカムの計算（LSI・左右差・GIRD/TRM）と、目安との比べ方
// 画面（OutcomeQuickTab）とテスト（tools/test-outcome-sets.mjs）から使う
import type { OutcomeRecord } from '@/types/contracts'
import type { OutcomeMetric } from '@/data/outcome-metrics'
import { TRM_CAUTION } from '@/data/outcome-metrics'

const round1 = (v: number) => Math.round(v * 10) / 10

/** LSI（%）＝患側÷健側×100。健側が 0 以下なら出さない */
export function lsi(involved: number, uninvolved: number): number | null {
  if (!Number.isFinite(involved) || !Number.isFinite(uninvolved) || uninvolved <= 0 || involved < 0) return null
  return round1((involved / uninvolved) * 100)
}

/** 時間の LSI（%）＝健側÷患側×100（短いほど良いので逆にする） */
export function lsiTime(involved: number, uninvolved: number): number | null {
  if (!Number.isFinite(involved) || !Number.isFinite(uninvolved) || involved <= 0 || uninvolved < 0) return null
  return round1((uninvolved / involved) * 100)
}

export function absDiff(a: number, b: number): number | null {
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null
  return round1(Math.abs(a - b))
}

export interface RotationInput {
  /** 投げる側の内旋・外旋 */
  irThrow: number
  erThrow: number
  /** 投げない側の内旋・外旋 */
  irNon: number
  erNon: number
}

/** GIRD＝投げない側の内旋 − 投げる側の内旋、TRM 差＝投げない側の(内旋+外旋) − 投げる側の(内旋+外旋) */
export function rotation(r: RotationInput): { gird: number; trm: number } | null {
  const vals = [r.irThrow, r.erThrow, r.irNon, r.erNon]
  if (vals.some((v) => !Number.isFinite(v) || v < 0 || v > 180)) return null
  return {
    gird: round1(r.irNon - r.irThrow),
    trm: round1(r.irNon + r.erNon - (r.irThrow + r.erThrow)),
  }
}

export type OutcomeInput =
  | { kind: 'single'; value: number }
  | { kind: 'pair'; a: number; b: number }
  | { kind: 'rotation'; r: RotationInput }

/** 入れた値から、記録に残す値（グラフに出す値）と元の値を作る。計算できなければ null */
export function buildOutcomeValues(
  metric: OutcomeMetric,
  input: OutcomeInput,
): Pick<OutcomeRecord, 'value' | 'involved' | 'uninvolved' | 'detail'> | null {
  if (metric.rotation) {
    if (input.kind !== 'rotation') return null
    const res = rotation(input.r)
    if (!res) return null
    return {
      value: res.gird,
      detail: { irThrow: input.r.irThrow, erThrow: input.r.erThrow, irNon: input.r.irNon, erNon: input.r.erNon, trm: res.trm },
    }
  }
  if (metric.pair) {
    if (input.kind !== 'pair') return null
    const { a, b } = input
    if (a < metric.pair.min || b < metric.pair.min || a > metric.pair.max || b > metric.pair.max) return null
    const v = metric.pair.calc === 'lsi' ? lsi(a, b) : metric.pair.calc === 'lsi_time' ? lsiTime(a, b) : absDiff(a, b)
    if (v === null) return null
    return { value: v, involved: a, uninvolved: b }
  }
  if (input.kind !== 'single' || !Number.isFinite(input.value)) return null
  const clamped = Math.min(metric.max, Math.max(metric.min, input.value))
  return { value: round1(clamped) }
}

export type TargetJudge =
  | { state: 'none' }
  | { state: 'reached' | 'notyet'; gap: number }
  | { state: 'over' | 'within' }
  | { state: 'reference'; gap: number }

/** 目安との比べ方。reach は届いたか、caution は超えたか、reference は参考の値との差 */
export function judgeTarget(metric: OutcomeMetric, value: number): TargetJudge {
  const t = metric.target
  if (!t || !Number.isFinite(value)) return { state: 'none' }
  if (t.type === 'reach') return value >= t.value ? { state: 'reached', gap: 0 } : { state: 'notyet', gap: round1(t.value - value) }
  if (t.type === 'caution') {
    // GIRD は「20°以上」、それ以外（Yバランス）は「4cm を超える」
    const over = metric.key === 'gird' ? value >= t.value : value > t.value
    return { state: over ? 'over' : 'within' }
  }
  return { state: 'reference', gap: round1(t.value - value) }
}

/** TRM 差が目安（5°）を超えているか */
export function trmOver(trm: number | undefined): boolean {
  return typeof trm === 'number' && trm > TRM_CAUTION
}

/** 指標ごとの最新の記録（日付→作った時刻の順で最後のもの） */
export function latestByMetric(records: OutcomeRecord[]): Map<string, OutcomeRecord> {
  const sorted = [...records].sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt))
  const out = new Map<string, OutcomeRecord>()
  for (const r of sorted) out.set(r.metric, r)
  return out
}
