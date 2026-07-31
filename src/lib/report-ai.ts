// がんばりレポートAI下書き生成のクライアント側ロジック
//
// - カルテ（SOAP・簡易メモ）・評価・マイルストーン・プロトコル現在地を集約して
//   /api/report-message に渡すコンテキストを構築する
// - API不通時（キー未設定・オフライン等）でも機能が完結するよう、
//   同じデータから思いやりのある文面を組み立てるローカル生成も持つ

import type { Protocol, ProtocolPatient, Assessment, Milestone } from '@/types/protocol'
import type { MetricChange } from '@/lib/progress-utils'
import { daysSinceStart } from '@/lib/progress-utils'
import { getSOAPNotes, getQuickMemos } from '@/lib/patient-store'

export interface ReportDraft {
  message: string
  praisePoints: string[]
  /** 'ai' = Claude生成 / 'local' = 記録データからの自動組み立て（API不通時） */
  source: 'ai' | 'local'
}

// ── コンテキスト構築 ────────────────────────────────────────────────────────

function buildContext(
  protocol: Protocol,
  patient: ProtocolPatient,
  assessments: Assessment[],
  milestones: Milestone[],
  changes: MetricChange[],
) {
  const currentPhase = protocol.phases[protocol.currentPhaseIndex]
  const criteria = currentPhase?.advanceCriteria ?? []
  const met = criteria.filter(c => c.met).length

  // カルテ連携（linkedPatientId があれば SOAP・簡易メモの直近3件を読む）
  const linkedId = patient.linkedPatientId
  const karteSoap = linkedId
    ? getSOAPNotes(linkedId)
        .sort((a, b) => b.visitDate.localeCompare(a.visitDate))
        .slice(0, 3)
        .map(s => ({
          date: s.visitDate,
          concern: s.patientConcern || undefined,
          improvements: s.improvements || undefined,
          remaining: s.remainingIssues || undefined,
          nextGoal: s.nextGoal || undefined,
        }))
        .filter(s => s.concern || s.improvements || s.remaining || s.nextGoal)
    : []
  const karteMemos = linkedId
    ? getQuickMemos(linkedId)
        .sort((a, b) => b.memoDate.localeCompare(a.memoDate))
        .slice(0, 3)
        .map(m => ({ date: m.memoDate, content: m.content }))
    : []

  const assessmentNotes = [...assessments]
    .filter(a => a.notes && a.notes.trim())
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 3)
    .map(a => ({ date: a.date, note: a.notes!.trim() }))

  const achieved = milestones
    .filter(m => m.achieved)
    .sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''))
    .map(m => m.label)
  const nextMilestone = milestones.find(m => !m.achieved)?.label

  return {
    patient: {
      name: patient.name || undefined,
      age: patient.age || undefined,
      diagnosis: patient.diagnosis || undefined,
      sport: patient.sport || undefined,
      concerns: patient.concerns || undefined,
      notes: patient.notes || undefined,
      daysSince: daysSinceStart(patient.eventDate, protocol.createdAt) || undefined,
    },
    protocol: {
      title: protocol.title,
      phaseCount: protocol.phases.length,
      currentPhaseNumber: protocol.currentPhaseIndex + 1,
      currentPhaseTitle: currentPhase?.title ?? '',
      currentPhaseGoals: currentPhase?.goals ?? [],
      unmetCriteria: criteria.filter(c => !c.met).map(c => c.label),
      criteriaMetRatio: criteria.length > 0 ? met / criteria.length : 0,
    },
    changes: changes.map(c => ({
      label: c.info.label,
      first: c.first,
      latest: c.latest,
      unit: c.info.unit,
      judgment: c.judgment,
    })),
    milestonesAchieved: achieved,
    nextMilestone,
    assessmentNotes,
    karteSoap,
    karteMemos,
    assessmentCount: assessments.length,
  }
}

// ── ローカル生成（API不通時のフォールバック） ────────────────────────────────

function buildLocalDraft(ctx: ReturnType<typeof buildContext>): ReportDraft {
  const p = ctx.patient
  const pr = ctx.protocol
  const parts: string[] = []

  // 呼びかけ＋労い
  const callName = p.name ? `${p.name}様、` : ''
  if (p.daysSince && p.daysSince > 0) {
    parts.push(`${callName}${p.daysSince}日間、リハビリを続けてこられたこと、本当に素晴らしいです。`)
  } else {
    parts.push(`${callName}いつもリハビリに取り組んでいただき、ありがとうございます。`)
  }

  // 不安への寄り添い（カルテの訴え → concerns の順で採用）
  const concern = ctx.karteSoap.find(s => s.concern)?.concern ?? p.concerns
  if (concern) {
    parts.push(`「${concern.length > 30 ? concern.slice(0, 30) + '…' : concern}」というお気持ち、私たちも受け止めています。焦らなくて大丈夫です。`)
  }

  // 良い変化（改善指標を1つ）
  const improved = ctx.changes.find(c => c.judgment === 'improved')
  if (improved) {
    parts.push(`${improved.label}は${improved.first}${improved.unit}から${improved.latest}${improved.unit}へと、確実に良い方向に進んでいます。`)
  } else if (ctx.milestonesAchieved.length > 0) {
    parts.push(`「${ctx.milestonesAchieved[0]}」を達成できたのは、日々の積み重ねの成果です。`)
  }

  // プロトコル現在地
  parts.push(`回復プログラムは全${pr.phaseCount}段階のうち第${pr.currentPhaseNumber}段階「${pr.currentPhaseTitle}」まで来ました。`)

  // 次の目標＋伴走
  if (ctx.nextMilestone) {
    parts.push(`次は「${ctx.nextMilestone}」を一緒に目指していきましょう。私たちがしっかりサポートします。`)
  } else {
    parts.push(`これからも一歩ずつ、一緒に進んでいきましょう。私たちがしっかりサポートします。`)
  }

  // がんばりポイント
  const points: string[] = []
  for (const c of ctx.changes.filter(c => c.judgment === 'improved').slice(0, 2)) {
    points.push(`${c.label}が ${c.first}${c.unit} → ${c.latest}${c.unit} に改善`)
  }
  for (const m of ctx.milestonesAchieved.slice(0, 2)) {
    if (points.length >= 3) break
    points.push(`「${m}」を達成`)
  }
  if (ctx.assessmentCount >= 3) {
    points.push(`${ctx.assessmentCount}回の評価を重ね、継続して取り組めています`)
  }
  if (points.length === 0) {
    points.push('リハビリのスタートを切り、一歩ずつ前に進んでいます')
  }

  return { message: parts.join(''), praisePoints: points.slice(0, 4), source: 'local' }
}

// ── 公開API ─────────────────────────────────────────────────────────────────

/**
 * AIレポート下書きを生成する。
 * APIが失敗した場合は記録データからのローカル組み立てに自動フォールバックし、
 * 必ず ReportDraft を返す（source で由来を区別できる）。
 */
export async function generateReportDraft(
  protocol: Protocol,
  patient: ProtocolPatient,
  assessments: Assessment[],
  milestones: Milestone[],
  changes: MetricChange[],
): Promise<ReportDraft> {
  const ctx = buildContext(protocol, patient, assessments, milestones, changes)

  try {
    const res = await fetch('/api/report-message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(ctx),
    })
    if (!res.ok) throw new Error(`API ${res.status}`)
    const data = (await res.json()) as { message?: string; praisePoints?: string[] }
    if (!data.message) throw new Error('empty message')
    return {
      message: data.message,
      praisePoints: data.praisePoints && data.praisePoints.length > 0
        ? data.praisePoints
        : buildLocalDraft(ctx).praisePoints,
      source: 'ai',
    }
  } catch {
    return buildLocalDraft(ctx)
  }
}
