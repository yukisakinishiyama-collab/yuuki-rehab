// 進捗管理・がんばりレポート用の計算ユーティリティ
// 評価指標の「良い方向」を定義し、初回→最新の変化から改善サマリーと
// 患者向けのほめメッセージを決定論的に生成する（外部API不要・印刷でも同一結果）

import type { Assessment, Protocol, Milestone } from '@/types/protocol'

export interface MetricInfo {
  /** 患者にも分かる表現のラベル */
  label: string
  shortLabel: string
  unit: string
  /**
   * 値の良い方向。
   * neutral は記録方法により方向が変わる指標（例: 伸展ROM）で、
   * 変化は表示するが改善/悪化の判定はしない
   */
  betterWhen: 'lower' | 'higher' | 'neutral'
}

export const METRIC_INFO: Record<string, MetricInfo> = {
  pain:     { label: '痛みの強さ（NRS）',        shortLabel: '痛み',     unit: '',   betterWhen: 'lower' },
  nrs:      { label: '痛みの強さ（NRS）',        shortLabel: '痛み',     unit: '',   betterWhen: 'lower' },
  rom_flex: { label: '関節の曲がる角度（屈曲）', shortLabel: '屈曲ROM',  unit: '°',  betterWhen: 'higher' },
  rom_ext:  { label: '関節の伸びる角度（伸展）', shortLabel: '伸展ROM',  unit: '°',  betterWhen: 'neutral' },
  lsi:      { label: '左右の筋力バランス（LSI）', shortLabel: 'LSI',     unit: '%',  betterWhen: 'higher' },
  mmt:      { label: '筋力（MMT）',              shortLabel: 'MMT',      unit: '',   betterWhen: 'higher' },
  swelling: { label: 'むくみ・周径',             shortLabel: '周径',     unit: 'cm', betterWhen: 'lower' },
}

export type Judgment = 'improved' | 'worsened' | 'flat' | 'neutral'

export interface MetricChange {
  key: string
  info: MetricInfo
  first: number
  latest: number
  firstDate: string
  latestDate: string
  delta: number
  judgment: Judgment
}

/** 各指標について「初回に記録された値」→「最新の値」の変化を算出する */
export function computeMetricChanges(assessments: Assessment[]): MetricChange[] {
  if (assessments.length === 0) return []
  const sorted = [...assessments].sort((a, b) => a.date.localeCompare(b.date))

  // 出現する全指標キー
  const keys = Array.from(new Set(sorted.flatMap(a => Object.keys(a.metrics))))

  const changes: MetricChange[] = []
  for (const key of keys) {
    const withValue = sorted.filter(a => a.metrics[key] != null)
    if (withValue.length < 2) continue

    const firstA  = withValue[0]
    const latestA = withValue[withValue.length - 1]
    const first  = firstA.metrics[key]
    const latest = latestA.metrics[key]
    const delta  = latest - first

    const info = METRIC_INFO[key.toLowerCase()] ?? {
      label: key, shortLabel: key, unit: '', betterWhen: 'neutral' as const,
    }

    let judgment: Judgment
    if (info.betterWhen === 'neutral') judgment = 'neutral'
    else if (delta === 0)              judgment = 'flat'
    else if (info.betterWhen === 'lower')  judgment = delta < 0 ? 'improved' : 'worsened'
    else                                    judgment = delta > 0 ? 'improved' : 'worsened'

    changes.push({
      key, info, first, latest,
      firstDate: firstA.date, latestDate: latestA.date,
      delta, judgment,
    })
  }
  return changes
}

/** プロトコル全体の進捗率（0〜1）: 完了フェーズ + 現在フェーズの基準達成率 */
export function overallProgress(protocol: Protocol): number {
  const n = protocol.phases.length
  if (n === 0) return 0
  const current = protocol.phases[protocol.currentPhaseIndex]
  const criteria = current?.advanceCriteria ?? []
  const partial = criteria.length > 0
    ? criteria.filter(c => c.met).length / criteria.length
    : 0
  return Math.min(1, (protocol.currentPhaseIndex + partial) / n)
}

/** 受傷・手術からの経過日数（eventDate未設定ならプロトコル作成日から） */
export function daysSinceStart(eventDate: string | undefined, fallbackIso: string): number {
  const start = eventDate ? new Date(eventDate) : new Date(fallbackIso)
  return Math.max(0, Math.floor((Date.now() - start.getTime()) / 86400000))
}

// ── ほめメッセージ生成（医療広告ガイドライン準拠の表現のみ使用） ──

export interface PraiseResult {
  /** がんばりポイントの箇条書き（最大4件） */
  points: string[]
  /** スタンプの段階 */
  grade: 'excellent' | 'great' | 'keep'
}

export function generatePraise(
  changes: MetricChange[],
  milestones: Milestone[],
  assessmentCount: number,
): PraiseResult {
  const points: string[] = []

  // 改善した指標から具体的なほめ
  const improved = changes.filter(c => c.judgment === 'improved')
  for (const c of improved) {
    const u = c.info.unit
    switch (c.key.toLowerCase()) {
      case 'pain':
      case 'nrs':
        points.push(`痛みの強さが ${c.first} → ${c.latest} に軽減しています`)
        break
      case 'rom_flex':
        points.push(`関節の曲がる角度が ${c.first}° → ${c.latest}° に広がりました`)
        break
      case 'lsi':
        points.push(`左右の筋力バランスが ${c.latest}% まで回復してきています`)
        break
      case 'mmt':
        points.push(`筋力（MMT）が ${c.first} → ${c.latest} に向上しました`)
        break
      case 'swelling':
        points.push(`むくみが ${c.first}${u} → ${c.latest}${u} に軽減しています`)
        break
      default:
        points.push(`${c.info.shortLabel}が ${c.first}${u} → ${c.latest}${u} に変化し、良い方向に進んでいます`)
    }
  }

  // 直近で達成したマイルストーン（最新2件）
  const achieved = milestones
    .filter(m => m.achieved && m.date)
    .sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''))
  for (const m of achieved.slice(0, 2)) {
    points.push(`「${m.label}」を達成しました${m.icon ? ` ${m.icon}` : ''}`)
  }

  // 継続をほめる（記録回数）
  if (assessmentCount >= 3) {
    points.push(`${assessmentCount}回の評価を重ね、継続してリハビリに取り組めています`)
  }

  if (points.length === 0) {
    points.push('リハビリのスタートを切りました。焦らず一歩ずつ進んでいきましょう')
  }

  // スタンプ段階: 改善指標数と達成マイルストーンで判定
  const score = improved.length + Math.min(achieved.length, 2)
  const grade: PraiseResult['grade'] =
    score >= 3 ? 'excellent' : score >= 1 ? 'great' : 'keep'

  return { points: points.slice(0, 4), grade }
}
