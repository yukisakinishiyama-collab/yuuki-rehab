// アウトカム（カルテ → 評価・測定 → アウトカム）で記録する指標
// better … 'low' は数字が小さいほど良い（痛み）、'high' は大きいほど良い
import type { OutcomeMetricKey } from '@/types/contracts'

export interface OutcomeMetric {
  key: OutcomeMetricKey
  label: string
  group: '痛み' | '可動域' | '機能スコア' | '筋力・LSI'
  unit: string
  min: number
  max: number
  step: number
  better: 'low' | 'high'
  /** 最初に入っている値（その方の前回の値があればそちら） */
  start: number
  /** 目安の線（例：LSI 90%） */
  target?: number
}

export const OUTCOME_METRICS: OutcomeMetric[] = [
  { key: 'nrs', label: '痛み NRS', group: '痛み', unit: '', min: 0, max: 10, step: 1, better: 'low', start: 5 },
  { key: 'rom_knee_flex', label: '膝 屈曲', group: '可動域', unit: '°', min: 0, max: 160, step: 5, better: 'high', start: 120 },
  { key: 'rom_knee_ext', label: '膝 伸展', group: '可動域', unit: '°', min: -30, max: 15, step: 1, better: 'high', start: 0 },
  { key: 'rom_other', label: 'その他の可動域', group: '可動域', unit: '°', min: -90, max: 180, step: 5, better: 'high', start: 90 },
  { key: 'koos', label: 'KOOS', group: '機能スコア', unit: '点', min: 0, max: 100, step: 1, better: 'high', start: 60 },
  { key: 'lysholm', label: 'Lysholm', group: '機能スコア', unit: '点', min: 0, max: 100, step: 1, better: 'high', start: 60 },
  { key: 'ikdc', label: 'IKDC', group: '機能スコア', unit: '点', min: 0, max: 100, step: 1, better: 'high', start: 60 },
  { key: 'lsi_quad', label: '大腿四頭筋 LSI', group: '筋力・LSI', unit: '%', min: 0, max: 150, step: 1, better: 'high', start: 80, target: 90 },
  { key: 'lsi_ham', label: 'ハムストリングス LSI', group: '筋力・LSI', unit: '%', min: 0, max: 150, step: 1, better: 'high', start: 80, target: 90 },
  { key: 'lsi_hop', label: '片脚ホップ LSI', group: '筋力・LSI', unit: '%', min: 0, max: 150, step: 1, better: 'high', start: 80, target: 90 },
]

export function getOutcomeMetric(key: string): OutcomeMetric | undefined {
  return OUTCOME_METRICS.find((m) => m.key === key)
}
