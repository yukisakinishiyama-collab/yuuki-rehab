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

const fmtNum = (v: number) => String(Number(v.toFixed(2)))

/**
 * 記録する前に、入れた値を確かめる。記録できないときは、画面に出す理由（どの欄を・どの範囲で）を返す。記録できれば null。
 * 2026-11-20 院長「アウトカムの評価で記録がつかないものがあります」：範囲の外の値は、前は理由が分からないまま
 * 記録されなかった（左右の指標は「健側を 0 より大きく」と出ていた）・1つの値の指標は黙って上限に丸めていた
 */
export function outcomeInputProblem(metric: OutcomeMetric, input: OutcomeInput): string | null {
  if (metric.rotation) {
    if (input.kind !== 'rotation') return '値を確かめてください。'
    const names: Array<[keyof RotationInput, string]> = [
      ['irThrow', '投げる側 内旋'],
      ['erThrow', '投げる側 外旋'],
      ['irNon', '投げない側 内旋'],
      ['erNon', '投げない側 外旋'],
    ]
    for (const [k, label] of names) {
      const v = input.r[k]
      if (!Number.isFinite(v)) return `${label}の値を入れてください。`
      if (v < 0 || v > 180) return `${label}は 0〜180° の範囲で入れてください。`
    }
    return null
  }
  if (metric.pair) {
    if (input.kind !== 'pair') return '値を確かめてください。'
    const p = metric.pair
    const sides: Array<[number, string]> = [
      [input.a, p.labels[0]],
      [input.b, p.labels[1]],
    ]
    for (const [v, label] of sides) {
      if (!Number.isFinite(v)) return `${label}の値を入れてください。`
      if (v < p.min || v > p.max) return `${label}は ${fmtNum(p.min)}〜${fmtNum(p.max)}${p.unit} の範囲で入れてください。`
    }
    if (p.calc === 'lsi' && input.b <= 0) return `${p.labels[1]}の値を 0 より大きくしてください（LSI は ${p.labels[0]}÷${p.labels[1]} で出すため）。`
    if (p.calc === 'lsi_time' && input.a <= 0) return `${p.labels[0]}の時間を 0 より大きくしてください（LSI は ${p.labels[1]}÷${p.labels[0]} で出すため）。`
    return null
  }
  if (input.kind !== 'single') return '値を確かめてください。'
  if (!Number.isFinite(input.value)) return '値を入れてください。'
  if (input.value < metric.min || input.value > metric.max) {
    return `値は ${fmtNum(metric.min)}〜${fmtNum(metric.max)}${metric.unit} の範囲で入れてください。`
  }
  return null
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
