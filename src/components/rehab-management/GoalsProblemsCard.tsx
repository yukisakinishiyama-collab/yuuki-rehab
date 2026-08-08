'use client'
// ──────────────────────────────────────────────
// 目標と課題カード（NextGen v2.0）
// カルテ概要タブの最上部に置き、「本人の目標」「臨床目標」「問題リスト」を
// その場で編集できる。ここで入れた内容が患者説明モードの表示元になる。
// ──────────────────────────────────────────────
import { useState } from 'react'
import { nanoid } from 'nanoid'
import type { Patient, PatientGoals, ClinicalProblem, ProblemStatus } from '@/types/patient'
import { PROBLEM_STATUS_LABELS } from '@/types/patient'
import {
  getPatientGoals, savePatientGoals, getProblems, addProblem, updateProblem, deleteProblem,
  PROBLEM_STATUS_ORDER,
} from '@/lib/clinical-goals-store'
import VoiceInputButton from '@/components/rehab/VoiceInputButton'
import { Card, CardHeader, CardContent, SectionTitle } from './shared'
import { Target, Plus, Trash2 } from 'lucide-react'

const STATUS_STYLES: Record<ProblemStatus, string> = {
  active: 'bg-red-50 text-red-700 border-red-200',
  improving: 'bg-teal-50 text-teal-700 border-teal-200',
  monitor: 'bg-slate-50 text-slate-600 border-slate-200',
  resolved: 'bg-emerald-50 text-emerald-700 border-emerald-200 line-through',
}

/** クリックで次のステータスへ順送りする */
function nextStatus(status: ProblemStatus): ProblemStatus {
  const idx = PROBLEM_STATUS_ORDER.indexOf(status)
  return PROBLEM_STATUS_ORDER[(idx + 1) % PROBLEM_STATUS_ORDER.length]
}

interface Props {
  patient: Patient
}

export default function GoalsProblemsCard({ patient }: Props) {
  const [goals, setGoals] = useState<PatientGoals>(() =>
    getPatientGoals(patient.id) ?? {
      patientId: patient.id, patientGoal: '', targetNote: '', clinicalGoals: [],
      nextVisitNote: '', updatedAt: '',
    })
  const [problems, setProblems] = useState<ClinicalProblem[]>(() => getProblems(patient.id))
  const [newGoalLabel, setNewGoalLabel] = useState('')
  const [newProblemLabel, setNewProblemLabel] = useState('')

  function persistGoals(next: PatientGoals) {
    setGoals(next)
    savePatientGoals(next)
  }

  /**
   * 関数型更新で保存する（音声入力用）。
   * 音声認識は確定文を連続で渡してくることがあり、レンダー時のstateを直接参照すると
   * 直前の断片を上書きして消してしまうため、必ず prev ベースで更新する。
   */
  function persistGoalsFn(updater: (prev: PatientGoals) => PatientGoals) {
    setGoals(prev => {
      const next = updater(prev)
      savePatientGoals(next)
      return next
    })
  }

  function addClinicalGoal() {
    const label = newGoalLabel.trim()
    if (!label) return
    persistGoals({
      ...goals,
      clinicalGoals: [...goals.clinicalGoals, { id: nanoid(), label, achieved: false }],
    })
    setNewGoalLabel('')
  }

  function toggleClinicalGoal(id: string) {
    persistGoals({
      ...goals,
      clinicalGoals: goals.clinicalGoals.map(g =>
        g.id === id
          ? { ...g, achieved: !g.achieved, achievedDate: !g.achieved ? new Date().toISOString() : undefined }
          : g,
      ),
    })
  }

  function removeClinicalGoal(id: string) {
    persistGoals({ ...goals, clinicalGoals: goals.clinicalGoals.filter(g => g.id !== id) })
  }

  function handleAddProblem() {
    const label = newProblemLabel.trim()
    if (!label) return
    addProblem(patient.id, label)
    setProblems(getProblems(patient.id))
    setNewProblemLabel('')
  }

  function cycleProblem(problem: ClinicalProblem) {
    updateProblem(problem.id, { status: nextStatus(problem.status) })
    setProblems(getProblems(patient.id))
  }

  function removeProblem(id: string) {
    if (!confirm('この問題を削除しますか？（解決した場合は、削除ではなくステータスを「解決」にするのがおすすめです）')) return
    deleteProblem(id)
    setProblems(getProblems(patient.id))
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Target className="w-4 h-4 text-teal-600" />
          <SectionTitle>目標と課題</SectionTitle>
          <span className="text-[11px] text-gray-400">患者説明モードに表示されます</span>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 本人の目標 */}
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1.5">
            🎯 本人の目標（患者さんの言葉のまま）
          </label>
          <div className="flex items-center gap-1.5">
            <input
              value={goals.patientGoal}
              onChange={e => setGoals({ ...goals, patientGoal: e.target.value })}
              onBlur={() => persistGoals(goals)}
              placeholder="例: サッカーの試合に出たい／孫と旅行に行きたい"
              className="flex-1 h-10 px-3 text-sm border border-gray-200 rounded-lg
                focus:outline-none focus:ring-2 focus:ring-teal-500/40"
            />
            <VoiceInputButton
              size="sm"
              onText={t => persistGoalsFn(prev => ({
                ...prev,
                patientGoal: prev.patientGoal ? `${prev.patientGoal} ${t}` : t,
              }))}
            />
          </div>
        </div>

        {/* 臨床目標 */}
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1.5">
            📐 からだの目標（達成したらチェック）
          </label>
          <div className="space-y-1.5">
            {goals.clinicalGoals.map(g => (
              <div key={g.id} className="flex items-center gap-2 group">
                <button
                  type="button"
                  onClick={() => toggleClinicalGoal(g.id)}
                  aria-pressed={g.achieved}
                  className={`w-6 h-6 rounded-full border-2 flex items-center justify-center text-xs
                    flex-shrink-0 transition-colors ${
                    g.achieved
                      ? 'bg-teal-500 border-teal-500 text-white'
                      : 'bg-white border-gray-300 text-transparent hover:border-teal-400'
                  }`}
                >
                  ✓
                </button>
                <span className={`text-sm flex-1 ${g.achieved ? 'text-gray-400 line-through' : 'text-gray-700'}`}>
                  {g.label}
                </span>
                <button
                  type="button"
                  onClick={() => removeClinicalGoal(g.id)}
                  className="p-1 text-gray-200 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                  aria-label={`${g.label} を削除`}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
            <div className="flex items-center gap-1.5">
              <input
                value={newGoalLabel}
                onChange={e => setNewGoalLabel(e.target.value)}
                onKeyDown={e => {
                  // IMEの変換確定Enterでは登録しない（未確定の断片が保存されるのを防ぐ）
                  if (e.key === 'Enter' && !e.nativeEvent.isComposing) addClinicalGoal()
                }}
                placeholder="例: 膝の曲がり140°／片脚スクワット10回"
                className="flex-1 h-9 px-3 text-sm border border-dashed border-gray-300 rounded-lg
                  focus:outline-none focus:ring-2 focus:ring-teal-500/40"
              />
              <button
                type="button"
                onClick={addClinicalGoal}
                disabled={!newGoalLabel.trim()}
                className="h-9 px-3 rounded-lg bg-teal-600 text-white text-xs font-semibold
                  hover:bg-teal-700 disabled:opacity-40 transition-colors"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* 次回確認すること（患者説明モードにそのまま表示される） */}
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1.5">
            📅 次回、一緒に確認すること（患者さんに見せる文章で・空欄なら説明モードに出ません）
          </label>
          <div className="flex items-center gap-1.5">
            <input
              value={goals.nextVisitNote ?? ''}
              onChange={e => setGoals({ ...goals, nextVisitNote: e.target.value })}
              onBlur={() => persistGoals(goals)}
              placeholder="例: 太ももの筋力を測って、ジョギングを始められるか確認します"
              className="flex-1 h-10 px-3 text-sm border border-gray-200 rounded-lg
                focus:outline-none focus:ring-2 focus:ring-teal-500/40"
            />
            <VoiceInputButton
              size="sm"
              onText={t => persistGoalsFn(prev => ({
                ...prev,
                nextVisitNote: prev.nextVisitNote ? `${prev.nextVisitNote} ${t}` : t,
              }))}
            />
          </div>
        </div>

        {/* 問題リスト */}
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1.5">
            🧩 問題リスト（ラベルをタップでステータス切替: 要対応→改善中→経過観察→解決）
          </label>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {problems.map(p => (
              <span key={p.id} className="inline-flex items-center gap-1 group">
                <button
                  type="button"
                  onClick={() => cycleProblem(p)}
                  title={`${PROBLEM_STATUS_LABELS[p.status]}（タップで切替）`}
                  className={`px-3 py-1.5 text-xs rounded-full border font-medium transition-colors ${STATUS_STYLES[p.status]}`}
                >
                  {p.label}
                  <span className="ml-1.5 opacity-70">{PROBLEM_STATUS_LABELS[p.status]}</span>
                </button>
                <button
                  type="button"
                  onClick={() => removeProblem(p.id)}
                  className="p-0.5 text-gray-200 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                  aria-label={`${p.label} を削除`}
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </span>
            ))}
            {problems.length === 0 && (
              <span className="text-xs text-gray-400">例: 太もも筋力の低下／着地の不安定さ／再受傷への不安</span>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            <input
              value={newProblemLabel}
              onChange={e => setNewProblemLabel(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.nativeEvent.isComposing) handleAddProblem()
              }}
              placeholder="問題を追加"
              className="flex-1 h-9 px-3 text-sm border border-dashed border-gray-300 rounded-lg
                focus:outline-none focus:ring-2 focus:ring-teal-500/40"
            />
            <button
              type="button"
              onClick={handleAddProblem}
              disabled={!newProblemLabel.trim()}
              className="h-9 px-3 rounded-lg bg-teal-600 text-white text-xs font-semibold
                hover:bg-teal-700 disabled:opacity-40 transition-colors"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
