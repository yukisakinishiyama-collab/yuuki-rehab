// ──────────────────────────────────────────────
// プロトコルの進み具合を数える（純関数）
//
// 患者さんと一緒に画面を見ながら「いまここまで来た」を共有するための計算。
//
// 【決まりごと】
// - 数えるのは、施術者が実際に付けた印だけ（フェーズの現在地・達成チェック・運動のマーカー）。
//   推測で「たぶんできているだろう」と埋めない
// - 患者さんに見せるため、達成率は下げる方向に丸める（実際より進んで見せない）
// ──────────────────────────────────────────────

import type { Phase, Protocol } from '@/types/protocol'

export interface PhaseProgress {
  index: number
  title: string
  /** 済んだフェーズ / いま取り組んでいるフェーズ / これから */
  state: 'done' | 'current' | 'upcoming'
  /** 進行基準の達成数 */
  criteriaMet: number
  criteriaTotal: number
  /** 運動のマーカー内訳 */
  able: number
  doing: number
  hold: number
  untouched: number
  exerciseTotal: number
  /** このフェーズの達成率（0〜100） */
  percent: number
}

export interface ProtocolProgress {
  phases: PhaseProgress[]
  /** 全体の達成率（0〜100） */
  overallPercent: number
  currentIndex: number
  phaseTotal: number
  /** 「できる」が付いた運動の合計（がんばりの見える化に使う） */
  ableTotal: number
  /** 運動の総数 */
  exerciseTotal: number
  /** 達成した進行基準の合計 */
  criteriaMetTotal: number
  criteriaTotal: number
}

/**
 * 1フェーズの達成率。
 * 進行基準と運動マーカーの両方がある場合は半々で見る。
 * 片方しか無ければ、あるほうだけで数える。何も無ければ0。
 */
function phasePercent(phase: Phase, counts: {
  criteriaMet: number; criteriaTotal: number; able: number; doing: number; exerciseTotal: number
}): number {
  const parts: number[] = []
  if (counts.criteriaTotal > 0) {
    parts.push(counts.criteriaMet / counts.criteriaTotal)
  }
  if (counts.exerciseTotal > 0) {
    // 「できる」を1、「実施中」を半分として数える（取り組み始めた分も見えるように）
    parts.push((counts.able + counts.doing * 0.5) / counts.exerciseTotal)
  }
  if (parts.length === 0) return 0
  const avg = parts.reduce((a, b) => a + b, 0) / parts.length
  // 実際より進んで見せないよう切り捨てる
  return Math.max(0, Math.min(100, Math.floor(avg * 100)))
}

export function calcProtocolProgress(protocol: Protocol): ProtocolProgress {
  const currentIndex = Math.max(0, Math.min(protocol.currentPhaseIndex, protocol.phases.length - 1))

  const phases: PhaseProgress[] = protocol.phases.map((phase, index) => {
    const criteriaTotal = phase.advanceCriteria.length
    const criteriaMet = phase.advanceCriteria.filter(c => c.met).length

    const exerciseTotal = phase.exercises.length
    const able = phase.exercises.filter(e => e.status === 'able').length
    const doing = phase.exercises.filter(e => e.status === 'doing').length
    const hold = phase.exercises.filter(e => e.status === 'hold').length
    const untouched = exerciseTotal - able - doing - hold

    const state: PhaseProgress['state'] =
      index < currentIndex ? 'done' : index === currentIndex ? 'current' : 'upcoming'

    // 通過済みのフェーズは、印の付け忘れがあっても100%として扱う
    // （施術者が「次へ進む」と判断した事実のほうが確かなため）
    const percent = state === 'done'
      ? 100
      : phasePercent(phase, { criteriaMet, criteriaTotal, able, doing, exerciseTotal })

    return {
      index, title: phase.title, state,
      criteriaMet, criteriaTotal,
      able, doing, hold, untouched, exerciseTotal,
      percent,
    }
  })

  const phaseTotal = phases.length
  // 全体は「済んだフェーズ数＋いまのフェーズの達成率」をフェーズ数で割る
  const overallPercent = phaseTotal === 0
    ? 0
    : Math.max(0, Math.min(100, Math.floor(
        ((currentIndex + (phases[currentIndex]?.percent ?? 0) / 100) / phaseTotal) * 100,
      )))

  return {
    phases,
    overallPercent,
    currentIndex,
    phaseTotal,
    ableTotal: phases.reduce((a, p) => a + p.able, 0),
    exerciseTotal: phases.reduce((a, p) => a + p.exerciseTotal, 0),
    criteriaMetTotal: phases.reduce((a, p) => a + p.criteriaMet, 0),
    criteriaTotal: phases.reduce((a, p) => a + p.criteriaTotal, 0),
  }
}

/** 患者さんに見せる、進み具合のひとこと（断定や治癒の保証はしない） */
export function progressMessage(p: ProtocolProgress): string {
  if (p.phaseTotal === 0) return ''
  if (p.overallPercent >= 90) return 'ゴールが見えてきました。最後まで一緒に進みましょう。'
  if (p.overallPercent >= 60) return '折り返しを過ぎました。この調子で積み上げていきましょう。'
  if (p.overallPercent >= 30) return '少しずつ形になってきています。'
  if (p.overallPercent > 0) return 'はじめの一歩が進みました。'
  return 'ここからスタートです。一歩ずつ進めていきましょう。'
}
