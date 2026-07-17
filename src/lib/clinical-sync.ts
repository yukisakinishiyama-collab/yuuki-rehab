// プロトコル進捗の評価指標 ⇄ 患者管理カルテ（ROM記録・筋力記録・スペシャルテスト・評価）
// の相互反映ロジック。
// - 取り込み: カルテの最新ROM/痛みNRS/MMT/健側比を評価指標のプリセットキーへ変換
// - 書き戻し: 評価指標のROM値をカルテのROM記録として保存
// 患者の対応付けは ProtocolPatient.linkedPatientId（明示リンク）を優先し、
// 未リンク時は氏名の完全一致（一意の場合のみ）で自動候補を出す。

import { nanoid } from 'nanoid'
import type { ProtocolPatient, Joint } from '@/types/protocol'
import type {
  Patient as ChartPatient, BodyRegion, ROMRecord, SpecialTestRecord, MMTGrade,
} from '@/types/patient'
import {
  getPatients as getChartPatients, getPatient as getChartPatient,
  getROMRecords, getStrengthRecords, getSpecialTests, getEvaluations,
  saveROMRecord,
} from '@/lib/patient-store'

// プロトコルの関節 → カルテの部位
export const JOINT_TO_REGION: Record<Joint, BodyRegion> = {
  knee: 'knee',
  shoulder: 'shoulder',
  hip: 'hip',
  ankle: 'ankle',
  elbow: 'elbow',
  hand: 'wrist',
  spine: 'lumbar',
  other: 'other',
}

/** カルテ患者一覧（リンク選択UI用） */
export function getChartPatientList(): ChartPatient[] {
  return getChartPatients()
}

export interface LinkResolution {
  patient: ChartPatient | null
  /** true: linkedPatientId による明示リンク / false: 氏名一致による自動候補 */
  explicit: boolean
}

/** プロトコル患者に対応するカルテ患者を解決する */
export function resolveChartPatient(pp: ProtocolPatient): LinkResolution {
  if (pp.linkedPatientId) {
    const p = getChartPatient(pp.linkedPatientId)
    if (p) return { patient: p, explicit: true }
  }
  if (pp.name) {
    const matches = getChartPatients().filter(p => p.name === pp.name)
    if (matches.length === 1) return { patient: matches[0], explicit: false }
  }
  return { patient: null, explicit: false }
}

// MMTグレード → 数値（評価指標用）
function mmtToNumber(g: MMTGrade): number {
  switch (g) {
    case '4-': return 3.7
    case '4+': return 4.3
    case '5-': return 4.7
    default: return g
  }
}

export interface PulledMetric {
  key: string
  value: number
  date: string
  source: string
}

/** カルテから最新の評価値を取り込む（評価指標キーへ変換） */
export function pullLatestMetrics(chartPatientId: string, region: BodyRegion): PulledMetric[] {
  const out: PulledMetric[] = []
  const byDateDesc = <T extends { measuredDate?: string; evaluationDate?: string }>(a: T, b: T) =>
    (b.measuredDate ?? b.evaluationDate ?? '').localeCompare(a.measuredDate ?? a.evaluationDate ?? '')

  // ROM: Flexion → rom_flex / Extension → rom_ext
  const roms = getROMRecords(chartPatientId)
    .filter(r => r.bodyRegion === region)
    .sort(byDateDesc)
  const flex = roms.find(r => r.movement === 'Flexion' && (r.activeRom ?? r.passiveRom) != null)
  if (flex) {
    out.push({
      key: 'rom_flex', value: (flex.activeRom ?? flex.passiveRom)!,
      date: flex.measuredDate, source: `ROM記録（${flex.side === 'left' ? '左' : flex.side === 'right' ? '右' : ''}屈曲）`,
    })
  }
  const ext = roms.find(r => r.movement === 'Extension' && (r.activeRom ?? r.passiveRom) != null)
  if (ext) {
    out.push({
      key: 'rom_ext', value: (ext.activeRom ?? ext.passiveRom)!,
      date: ext.measuredDate, source: 'ROM記録（伸展）',
    })
  }

  // 痛みNRS: 評価記録の最新
  const evals = getEvaluations(chartPatientId)
    .filter(e => e.painNrs != null)
    .sort((a, b) => b.evaluationDate.localeCompare(a.evaluationDate))
  if (evals[0]) {
    out.push({ key: 'pain', value: evals[0].painNrs, date: evals[0].evaluationDate, source: '評価記録（NRS）' })
  }

  // 筋力: MMT・健側比(LSI)
  const strengths = getStrengthRecords(chartPatientId)
    .filter(s => s.bodyRegion === region)
    .sort(byDateDesc)
  const mmtRec = strengths.find(s => s.mmt != null)
  if (mmtRec) {
    out.push({
      key: 'mmt', value: mmtToNumber(mmtRec.mmt!),
      date: mmtRec.measuredDate, source: `筋力記録（${mmtRec.muscleGroup || 'MMT'}）`,
    })
  }
  const lsiRec = strengths.find(s => s.contralateralRatio != null)
  if (lsiRec) {
    out.push({
      key: 'lsi', value: Math.round(lsiRec.contralateralRatio!),
      date: lsiRec.measuredDate, source: `筋力記録（${lsiRec.muscleGroup || '健側比'}）`,
    })
  }

  return out
}

/** カルテの最新スペシャルテスト（対象部位優先、無ければ全部位から） */
export function pullLatestSpecialTests(
  chartPatientId: string, region: BodyRegion, limit = 6,
): SpecialTestRecord[] {
  const all = getSpecialTests(chartPatientId)
    .sort((a, b) => b.measuredDate.localeCompare(a.measuredDate))
  const inRegion = all.filter(t => t.bodyRegion === region)
  return (inRegion.length > 0 ? inRegion : all).slice(0, limit)
}

// 書き戻し時に使う部位別の参考正常値（Flexion / Extension）
const ROM_NORMALS: Partial<Record<BodyRegion, { flex: number; ext: number }>> = {
  knee: { flex: 135, ext: 0 },
  hip: { flex: 125, ext: 15 },
  shoulder: { flex: 180, ext: 50 },
  elbow: { flex: 145, ext: 5 },
}

/** 評価指標のROM値をカルテのROM記録として書き戻す。作成した記録数を返す */
export function pushRomToChart(
  chartPatientId: string,
  region: BodyRegion,
  date: string,
  metrics: Record<string, number>,
): number {
  const normals = ROM_NORMALS[region]
  let count = 0
  const base = {
    patientId: chartPatientId,
    measuredDate: date,
    bodyRegion: region,
    joint: '',
    side: 'na' as const,
    passiveRom: null,
    unit: 'deg' as const,
    pain: false,
    painLocation: '',
    endFeel: '' as const,
    limitationFactor: '',
    memo: 'プロトコル進捗評価より自動反映',
    createdAt: new Date().toISOString(),
  }
  if (metrics.rom_flex != null) {
    const rec: ROMRecord = {
      ...base, id: nanoid(),
      movement: 'Flexion', activeRom: metrics.rom_flex, normalValue: normals?.flex ?? 0,
    }
    saveROMRecord(rec)
    count++
  }
  if (metrics.rom_ext != null) {
    const rec: ROMRecord = {
      ...base, id: nanoid(),
      movement: 'Extension', activeRom: metrics.rom_ext, normalValue: normals?.ext ?? 0,
    }
    saveROMRecord(rec)
    count++
  }
  return count
}

// スペシャルテスト結果の表示用ラベル・色
export const TEST_RESULT_LABELS: Record<SpecialTestRecord['result'], string> = {
  positive: '陽性',
  negative: '陰性',
  suspicious: '疑い',
  unable: '実施不可',
}
