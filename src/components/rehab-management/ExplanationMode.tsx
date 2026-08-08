'use client'
// ──────────────────────────────────────────────
// 患者説明モード（NextGen v2.0）
//
// カルテから「患者さんへ説明」を押すと全画面になり、施術中に
// モニター・タブレットを患者さんへ向けて現在地を説明するための画面。
//
// 【表示するもの】本人の目標／現在のリハビリ段階／良くなってきているところ／
// 　これから取り組むところ／次の目標／次回確認すること
// 【表示しないもの】施術者メモ・内部評価コメント・連絡先などの管理情報・専門用語の生数値
// 【文言の決まり】治癒の断定（必ず治る等）をしない。恐怖を与える表現をしない。
// ──────────────────────────────────────────────
import { useState } from 'react'
import type { Patient, PatientGoals, ClinicalProblem } from '@/types/patient'
import { PROBLEM_STATUS_PATIENT_LABELS } from '@/types/patient'
import { getPatientGoals, getProblems } from '@/lib/clinical-goals-store'
import {
  getPatients as getProtocolPatients, getProtocolsByPatient, getMilestones,
} from '@/lib/protocol-store'
import type { Milestone, Protocol } from '@/types/protocol'
import { recommendConditionImage, getConditionImage, type ConditionImage } from '@/lib/condition-images'
import { isFeatureEnabled } from '@/lib/feature-flags'
import ConditionPhoto, { useResolvedIllustration } from './ConditionPhoto'
import { X, Target, Flag, Sprout, Award, CalendarCheck } from 'lucide-react'

interface Derived {
  goals: PatientGoals | undefined
  problems: ClinicalProblem[]
  protocol: Protocol | null
  milestones: Milestone[]
  conditionImage: ConditionImage | null
}

/**
 * 説明モードに表示する実写画像を決める（画像統合指示書§9）。
 * 施術者の明示選択が最優先。'none' なら表示しない。未設定のときだけ推奨を使う。
 */
function resolveConditionImage(
  patient: Patient, goals: PatientGoals | undefined, protocol: Protocol | null,
): ConditionImage | null {
  if (!isFeatureEnabled('conditionImages')) return null
  const chosen = goals?.explanationImageId
  if (chosen === 'none') return null
  if (chosen) return getConditionImage(chosen)
  return recommendConditionImage({
    diagnosis: patient.diagnosisLabel,
    protocolTitle: protocol?.title,
    phaseTitle: protocol?.phases[protocol.currentPhaseIndex]?.title,
    bodyRegion: patient.bodyRegion,
    mainComplaint: patient.mainComplaint,
  })
}

/**
 * 説明に使うデータを各ストアから集める。
 * 【重要】表示するのは「患者に見せる前提で入力されたデータ」だけにする。
 * SOAPカルテの自由記述（スタッフ向けメモ）は、内容を審査できないため一切拾わない。
 */
function derive(patient: Patient): Derived {
  const goals = getPatientGoals(patient.id)
  const problems = getProblems(patient.id)

  // プロトコル連携（明示リンクのみ。氏名推測は使わない＝別人表示の防止）。
  // 再受傷などで複数リンクがある場合は、最も新しく更新されたものを現在の治療とみなす
  const protocolPatient = getProtocolPatients()
    .filter(pp => pp.linkedPatientId === patient.id)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0]
  const protocol = protocolPatient
    ? getProtocolsByPatient(protocolPatient.id)
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0] ?? null
    : null
  const milestones = protocolPatient ? getMilestones(protocolPatient.id) : []

  return {
    goals, problems, protocol, milestones,
    conditionImage: resolveConditionImage(patient, goals, protocol),
  }
}

interface Props {
  patient: Patient
  onClose: () => void
}

export default function ExplanationMode({ patient, onClose }: Props) {
  // 開いた時点のデータで固定（説明中に裏で変わって表示が揺れないように）
  const [data] = useState<Derived>(() => derive(patient))
  const { goals, problems, protocol, milestones, conditionImage } = data
  // 実際に読み込めた画像だけを表示する（未登録なら写真セクションごと出さない）
  const photoSrc = useResolvedIllustration(conditionImage?.slot)

  const improving = problems.filter(p => p.status === 'improving' || p.status === 'resolved')
  const working = problems.filter(p => p.status === 'active' || p.status === 'monitor')
  const achievedMilestones = milestones.filter(m => m.achieved).slice(-3)
  const nextMilestone = milestones.find(m => !m.achieved)
  const currentPhase = protocol?.phases[protocol.currentPhaseIndex]

  const clinicalGoals = goals?.clinicalGoals ?? []
  // 次回確認：患者に見せる前提で明示入力された欄のみ（SOAPの自由記述は使わない）
  const nextVisitNote = goals?.nextVisitNote?.trim() ?? ''

  return (
    // z-indexはアプリ内最大にして、スタッフ向けのフローティングUI・モーダルを必ず覆う
    <div className="fixed inset-0 z-[10000] overflow-y-auto"
      style={{ background: 'linear-gradient(160deg, #f0fdfa 0%, #f0f9ff 60%, #ffffff 100%)' }}>
      {/* ヘッダー */}
      <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4"
        style={{ background: 'linear-gradient(135deg, #115e59, #0d9488)' }}>
        <div>
          <div className="text-[11px] tracking-[0.25em] text-white/60 font-semibold">YUUKI SEIKOTSUIN</div>
          <h1 className="text-xl font-bold text-white">
            {patient.name} 様の回復のあゆみ
          </h1>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-white/15 text-white text-sm
            font-semibold hover:bg-white/25 transition-colors"
        >
          <X className="w-4 h-4" />閉じる
        </button>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-8 space-y-6 pb-16">

        {/* 本人の目標（最上部・最重要） */}
        <section className="rounded-3xl bg-white border-2 border-teal-200 shadow-sm px-7 py-6">
          <div className="flex items-center gap-2 text-teal-700 font-bold text-sm mb-2">
            <Target className="w-5 h-5" />{patient.name}様の目標
          </div>
          {goals?.patientGoal ? (
            <p className="text-2xl font-bold text-slate-800 leading-relaxed">「{goals.patientGoal}」</p>
          ) : (
            <p className="text-lg text-slate-400">
              目標を一緒に決めましょう。「どんなことができるようになりたいですか？」
            </p>
          )}
          {goals?.targetNote && (
            <p className="text-sm text-slate-500 mt-2">{goals.targetNote}</p>
          )}
          {clinicalGoals.length > 0 && (
            <div className="mt-4 pt-4 border-t border-slate-100">
              <p className="text-xs font-bold text-slate-500 mb-2">この目標のために、からだで達成したいこと</p>
              <ul className="space-y-1.5">
                {clinicalGoals.map(g => (
                  <li key={g.id} className="flex items-center gap-2.5 text-base">
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-sm flex-shrink-0 ${
                      g.achieved ? 'bg-teal-500 text-white' : 'bg-slate-100 text-slate-300'
                    }`}>
                      {g.achieved ? '✓' : '○'}
                    </span>
                    <span className={g.achieved ? 'text-slate-700' : 'text-slate-500'}>{g.label}</span>
                    {g.achieved && <span className="text-xs font-bold text-teal-600">できました！</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        {/* 現在地（プロトコル連携がある場合） */}
        {protocol && currentPhase && (
          <section className="rounded-3xl bg-white border border-slate-200 shadow-sm px-7 py-6">
            <div className="flex items-center gap-2 text-slate-600 font-bold text-sm mb-3">
              <Flag className="w-5 h-5 text-orange-500" />いま、ここまで来ています
            </div>
            <div className="flex items-center gap-2 mb-3">
              {protocol.phases.map((ph, i) => {
                const done = i < protocol.currentPhaseIndex
                const active = i === protocol.currentPhaseIndex
                return (
                  <div key={ph.id} className="flex-1 flex flex-col items-center gap-1.5">
                    <div className={`w-full h-2.5 rounded-full ${
                      done ? 'bg-teal-500' : active ? 'bg-orange-400' : 'bg-slate-150 bg-slate-200'
                    }`} />
                    {active && <span className="text-[11px] font-bold text-orange-600">いまここ</span>}
                  </div>
                )
              })}
            </div>
            <p className="text-xl font-bold text-slate-800">
              第{protocol.currentPhaseIndex + 1}段階
              <span className="text-slate-400 text-base font-medium">（全{protocol.phases.length}段階）</span>
              ：{currentPhase.title}
            </p>
          </section>
        )}

        {/* 取り組んでいる内容の実写イメージ（画像が未登録なら自動的に非表示） */}
        {conditionImage && photoSrc && (
          <section className="rounded-3xl bg-white border border-slate-200 shadow-sm px-7 py-6">
            <div className="flex items-center gap-2 text-slate-600 font-bold text-sm mb-3">
              <Sprout className="w-5 h-5 text-teal-500" />いま取り組んでいる練習のイメージ
            </div>
            <ConditionPhoto
              src={photoSrc}
              alt={conditionImage.alt}
              caption={conditionImage.patientCaption}
              className="max-w-xl"
            />
            <p className="text-xs text-slate-400 mt-3">
              ※ 写真は練習内容のイメージです。実際の内容は、お一人ずつの状態に合わせて調整します。
            </p>
          </section>
        )}

        {/* 良くなっている × これから */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <section className="rounded-3xl bg-white border border-teal-100 shadow-sm px-6 py-5">
            <div className="flex items-center gap-2 text-teal-700 font-bold text-sm mb-3">
              <Award className="w-5 h-5" />良くなってきているところ
            </div>
            <ul className="space-y-2 text-base text-slate-700">
              {improving.map(p => (
                <li key={p.id} className="flex items-start gap-2">
                  <span className="text-teal-500 mt-0.5">✓</span>
                  <span>
                    {p.label}
                    <span className="text-xs text-teal-600 ml-1.5">
                      {PROBLEM_STATUS_PATIENT_LABELS[p.status]}
                    </span>
                  </span>
                </li>
              ))}
              {achievedMilestones.map(m => (
                <li key={m.id} className="flex items-start gap-2">
                  <span className="text-teal-500 mt-0.5">✓</span>
                  「{m.label}」を達成
                </li>
              ))}
              {improving.length === 0 && achievedMilestones.length === 0 && (
                <li className="text-slate-400 text-sm">これから一つずつ増やしていきましょう</li>
              )}
            </ul>
          </section>

          <section className="rounded-3xl bg-white border border-orange-100 shadow-sm px-6 py-5">
            <div className="flex items-center gap-2 text-orange-700 font-bold text-sm mb-3">
              <Sprout className="w-5 h-5" />これから取り組むところ
            </div>
            <ul className="space-y-2 text-base text-slate-700">
              {working.map(p => (
                <li key={p.id} className="flex items-start gap-2">
                  <span className="text-orange-400 mt-0.5">→</span>
                  <span>
                    {p.label}
                    {p.status === 'monitor' && (
                      <span className="text-xs text-slate-400 ml-1.5">様子を見ています</span>
                    )}
                  </span>
                </li>
              ))}
              {nextMilestone && (
                <li className="flex items-start gap-2">
                  <span className="text-orange-400 mt-0.5">🎯</span>
                  次の節目：「{nextMilestone.label}」
                </li>
              )}
              {working.length === 0 && !nextMilestone && (
                <li className="text-slate-400 text-sm">次の課題はスタッフと相談して決めましょう</li>
              )}
            </ul>
          </section>
        </div>

        {/* 次回確認すること（患者向けに明示入力された欄のみ表示） */}
        {nextVisitNote && (
          <section className="rounded-3xl bg-white border border-sky-100 shadow-sm px-7 py-5">
            <div className="flex items-center gap-2 text-sky-700 font-bold text-sm mb-2">
              <CalendarCheck className="w-5 h-5" />次回、一緒に確認すること
            </div>
            <p className="text-base text-slate-700 whitespace-pre-wrap">{nextVisitNote}</p>
          </section>
        )}

        <p className="text-center text-sm text-slate-400 pt-2">
          焦らず、一歩ずつ。私たちが一緒に進みます。
        </p>
      </div>
    </div>
  )
}
