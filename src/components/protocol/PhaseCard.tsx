'use client'

import { useState } from 'react'
import type { Phase } from '@/types/protocol'
import {
  EVIDENCE_LABELS, EVIDENCE_COLORS,
  EVIDENCE_GRADE_LABELS, EVIDENCE_GRADE_COLORS,
} from '@/types/protocol'
import CriteriaGauge from './CriteriaGauge'
import {
  ChevronDown, ChevronUp, AlertTriangle, Edit2, Plus, Trash2,
  Target, Dumbbell, ShieldOff, Flag, BookOpen,
} from 'lucide-react'

interface Props {
  phase: Phase
  isActive: boolean
  isCompleted: boolean
  onUpdate?: (updates: Partial<Phase>) => void
  readOnly?: boolean
}

export default function PhaseCard({ phase, isActive, isCompleted, onUpdate, readOnly }: Props) {
  const [expanded, setExpanded] = useState(isActive)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(phase)

  function toggleCriterion(index: number) {
    if (!onUpdate) return
    const advanceCriteria = draft.advanceCriteria.map((c, i) =>
      i === index ? { ...c, met: !c.met } : c
    )
    const updated = { ...draft, advanceCriteria }
    setDraft(updated)
    onUpdate({ advanceCriteria: updated.advanceCriteria })
  }

  function saveEdit() {
    onUpdate?.(draft)
    setEditing(false)
  }

  function addExercise() {
    setDraft(d => ({
      ...d,
      exercises: [...d.exercises, { name: '', dose: '', notes: '' }],
    }))
  }

  function removeExercise(i: number) {
    setDraft(d => ({ ...d, exercises: d.exercises.filter((_, idx) => idx !== i) }))
  }

  const cardStyle = isCompleted
    ? 'border-emerald-200 bg-gradient-to-r from-emerald-50/60 to-white'
    : isActive
      ? 'border-[--color-primary]/30 bg-white shadow-[0_0_0_2px_rgba(13,148,136,0.08)]'
      : 'border-slate-200 bg-white'

  const badgeStyle = isCompleted
    ? 'bg-emerald-500 text-white'
    : isActive
      ? 'bg-[--color-primary] text-white shadow-sm'
      : 'bg-slate-100 text-slate-500'

  return (
    <div className={`rounded-xl border-2 transition-all duration-300 overflow-hidden font-body ${cardStyle}`}>
      {/* ヘッダー（div role=button で button-in-button を回避） */}
      <div
        role="button"
        tabIndex={0}
        className="w-full flex items-center gap-3 px-4 py-3.5 text-left cursor-pointer
          hover:bg-black/[0.01] transition-colors"
        onClick={() => setExpanded(e => !e)}
        onKeyDown={e => e.key === 'Enter' && setExpanded(v => !v)}
        aria-expanded={expanded}
      >
        <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold
          flex-shrink-0 transition-all duration-300 ${badgeStyle}`}>
          {isCompleted ? '✓' : phase.order}
        </span>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-[--color-text-primary] text-sm font-display">
              {phase.title}
            </span>
            {phase.durationWeeks && (
              <span className="metric text-xs text-[--color-text-muted]">{phase.durationWeeks}</span>
            )}
            {isActive && (
              <span className="text-[10px] bg-[--color-primary] text-white px-2 py-0.5 rounded-full font-semibold font-display">
                現在
              </span>
            )}
            {isCompleted && (
              <span className="text-[10px] bg-emerald-500 text-white px-2 py-0.5 rounded-full font-semibold font-display">
                完了
              </span>
            )}
          </div>
          <span className={`inline-block text-[10px] font-medium px-1.5 py-0.5 rounded mt-0.5 font-display
            ${EVIDENCE_COLORS[phase.evidence]}`}>
            {EVIDENCE_LABELS[phase.evidence]}
          </span>
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          {!readOnly && (
            <button
              onClick={e => { e.stopPropagation(); setEditing(v => !v); setExpanded(true) }}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              aria-label="編集"
            >
              <Edit2 className="w-3.5 h-3.5" />
            </button>
          )}
          {expanded
            ? <ChevronUp className="w-4 h-4 text-slate-400" />
            : <ChevronDown className="w-4 h-4 text-slate-400" />
          }
        </div>
      </div>

      {expanded && (
        <div className="px-4 pb-4 border-t border-slate-100">
          {editing ? (
            <div className="space-y-3 pt-3">
              <div>
                <label className="text-xs font-semibold text-[--color-text-secondary] font-display uppercase tracking-wide mb-1 block">
                  フェーズ名
                </label>
                <input
                  value={draft.title}
                  onChange={e => setDraft(d => ({ ...d, title: e.target.value }))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm font-body
                    focus:ring-2 focus:ring-[--color-primary] focus:border-transparent"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-[--color-text-secondary] font-display uppercase tracking-wide mb-1 block">
                  目標
                </label>
                {draft.goals.map((g, i) => (
                  <input
                    key={i}
                    value={g}
                    onChange={e => {
                      const goals = [...draft.goals]
                      goals[i] = e.target.value
                      setDraft(d => ({ ...d, goals }))
                    }}
                    className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm mb-1 font-body
                      focus:ring-2 focus:ring-[--color-primary] focus:border-transparent"
                  />
                ))}
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-[--color-text-secondary] font-display uppercase tracking-wide">
                    エクササイズ
                  </label>
                  <button onClick={addExercise}
                    className="text-xs text-[--color-primary] hover:underline flex items-center gap-1 font-medium font-body">
                    <Plus className="w-3 h-3" />追加
                  </button>
                </div>
                {draft.exercises.map((ex, i) => (
                  <div key={i} className="flex gap-2 mb-1.5">
                    <input
                      value={ex.name}
                      onChange={e => {
                        const exercises = [...draft.exercises]
                        exercises[i] = { ...exercises[i], name: e.target.value }
                        setDraft(d => ({ ...d, exercises }))
                      }}
                      placeholder="種目名"
                      className="flex-1 border border-slate-200 rounded-lg px-2 py-1 text-sm font-body
                        focus:ring-2 focus:ring-[--color-primary] focus:border-transparent"
                    />
                    <input
                      value={ex.dose ?? ''}
                      onChange={e => {
                        const exercises = [...draft.exercises]
                        exercises[i] = { ...exercises[i], dose: e.target.value }
                        setDraft(d => ({ ...d, exercises }))
                      }}
                      placeholder="量・頻度"
                      className="w-28 border border-slate-200 rounded-lg px-2 py-1 text-sm font-body
                        focus:ring-2 focus:ring-[--color-primary] focus:border-transparent"
                    />
                    <button onClick={() => removeExercise(i)}
                      className="text-red-400 hover:text-red-600 transition-colors p-1">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>

              <div>
                <label className="text-xs font-semibold text-[--color-text-secondary] font-display uppercase tracking-wide mb-1 block">
                  注意事項
                </label>
                {draft.precautions.map((p, i) => (
                  <input
                    key={i}
                    value={p}
                    onChange={e => {
                      const precautions = [...draft.precautions]
                      precautions[i] = e.target.value
                      setDraft(d => ({ ...d, precautions }))
                    }}
                    className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm mb-1 font-body
                      focus:ring-2 focus:ring-[--color-primary] focus:border-transparent"
                  />
                ))}
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  onClick={saveEdit}
                  className="bg-[--color-primary] text-white text-sm px-4 py-1.5 rounded-lg
                    hover:bg-[--color-primary-hover] transition-colors font-display font-medium"
                >
                  保存
                </button>
                <button
                  onClick={() => { setDraft(phase); setEditing(false) }}
                  className="bg-slate-100 text-slate-700 text-sm px-4 py-1.5 rounded-lg
                    hover:bg-slate-200 transition-colors font-body"
                >
                  キャンセル
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4 pt-3">
              {phase.goals.length > 0 && (
                <div>
                  <h4 className="flex items-center gap-1.5 text-xs font-bold text-[--color-text-secondary]
                    font-display uppercase tracking-widest mb-2">
                    <Target className="w-3 h-3" />目標
                  </h4>
                  <ul className="space-y-1">
                    {phase.goals.map((g, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-[--color-text-primary] font-body">
                        <span className="text-[--color-primary] font-bold mt-0.5 leading-none">·</span>
                        {g}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {phase.exercises.length > 0 && (
                <div>
                  <h4 className="flex items-center gap-1.5 text-xs font-bold text-[--color-text-secondary]
                    font-display uppercase tracking-widest mb-2">
                    <Dumbbell className="w-3 h-3" />推奨エクササイズ
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    {phase.exercises.map((ex, i) => (
                      <div key={i} className="bg-[--color-surface-raised] rounded-lg border border-slate-100 px-3 py-2">
                        <div className="text-sm font-semibold text-[--color-text-primary] font-display">{ex.name}</div>
                        {ex.dose && (
                          <div className="metric text-xs text-[--color-text-secondary] mt-0.5">{ex.dose}</div>
                        )}
                        {ex.notes && (
                          <div className="text-xs text-amber-700 mt-0.5 font-body">⚠ {ex.notes}</div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {phase.advanceCriteria.length > 0 && (
                <div>
                  <h4 className="flex items-center gap-1.5 text-xs font-bold text-[--color-text-secondary]
                    font-display uppercase tracking-widest mb-2">
                    <Flag className="w-3 h-3" />次フェーズへの移行基準
                  </h4>
                  <CriteriaGauge
                    criteria={phase.advanceCriteria}
                    onToggle={readOnly ? undefined : toggleCriterion}
                    readOnly={readOnly}
                  />
                </div>
              )}

              {phase.precautions.length > 0 && (
                <div>
                  <h4 className="flex items-center gap-1.5 text-xs font-bold text-amber-700
                    font-display uppercase tracking-widest mb-2">
                    <AlertTriangle className="w-3 h-3" />注意事項・禁忌
                  </h4>
                  <ul className="space-y-1">
                    {phase.precautions.map((p, i) => (
                      <li key={i} className="text-xs text-amber-800 bg-amber-50 rounded-lg px-3 py-1.5
                        border border-amber-100 font-body">{p}</li>
                    ))}
                  </ul>
                </div>
              )}

              {phase.redFlags.length > 0 && (
                <div>
                  <h4 className="flex items-center gap-1.5 text-xs font-bold text-red-700
                    font-display uppercase tracking-widest mb-2">
                    <ShieldOff className="w-3 h-3" />中止基準 / Red Flags
                  </h4>
                  <ul className="space-y-1">
                    {phase.redFlags.map((r, i) => (
                      <li key={i} className="flex items-start gap-1.5 text-xs text-red-800
                        bg-red-50 rounded-lg px-3 py-1.5 border border-red-100 font-body">
                        <span className="text-red-400 font-bold flex-shrink-0">!</span>
                        {r}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {phase.outcomes.length > 0 && (
                <div>
                  <h4 className="text-xs font-bold text-[--color-text-secondary] font-display
                    uppercase tracking-widest mb-2">評価指標</h4>
                  <div className="flex flex-wrap gap-1.5">
                    {phase.outcomes.map((o, i) => (
                      <span key={i} className="metric text-xs bg-slate-100 text-slate-600 rounded-full px-2.5 py-1">
                        {o}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {phase.references && phase.references.length > 0 && (
                <div>
                  <h4 className="flex items-center gap-1.5 text-xs font-bold text-[--color-text-secondary]
                    font-display uppercase tracking-widest mb-2">
                    <BookOpen className="w-3 h-3" />参考文献・ガイドライン
                  </h4>
                  <ul className="space-y-1.5">
                    {phase.references.map((ref, i) => (
                      <li key={i} className="bg-slate-50 border border-slate-100 rounded-lg px-3 py-2">
                        <div className="flex items-start gap-2">
                          <span className={`flex-shrink-0 text-[10px] font-bold border rounded px-1.5 py-0.5 mt-0.5 font-display
                            ${EVIDENCE_GRADE_COLORS[ref.evidenceGrade]}`}>
                            {ref.evidenceGrade}
                          </span>
                          <div className="min-w-0">
                            <p className="text-xs font-medium text-[--color-text-primary] font-body leading-snug">
                              {ref.title}
                            </p>
                            <p className="text-[10px] text-[--color-text-muted] mt-0.5 font-body">
                              {ref.source}{ref.year ? ` (${ref.year})` : ''}
                              {ref.note && <span className="text-amber-600 ml-1">— {ref.note}</span>}
                            </p>
                          </div>
                        </div>
                        <p className="text-[10px] text-slate-400 mt-1 font-body">
                          {EVIDENCE_GRADE_LABELS[ref.evidenceGrade]}
                        </p>
                      </li>
                    ))}
                  </ul>
                  <p className="text-[10px] text-slate-400 mt-1.5 font-body">
                    ※ 引用文献は担当医・PTによる最終確認が必要です
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
