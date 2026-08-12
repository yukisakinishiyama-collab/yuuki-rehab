'use client'

import { useState, useEffect } from 'react'
import type { Phase } from '@/types/protocol'
import { findVideoUrl } from '@/lib/exercise-video-map'
import {
  EVIDENCE_LABELS, EVIDENCE_COLORS,
  EVIDENCE_GRADE_LABELS, EVIDENCE_GRADE_COLORS,
  EXERCISE_STATUSES, EXERCISE_STATUS_LABELS, EXERCISE_STATUS_DESCRIPTIONS,
  EXERCISE_STATUS_STYLES, EXERCISE_STATUS_CARD_STYLES,
} from '@/types/protocol'
import CriteriaGauge from './CriteriaGauge'
import {
  ChevronDown, ChevronUp, AlertTriangle, Edit2, Plus, Trash2, Save,
  Target, Dumbbell, ShieldOff, Flag, BookOpen, PlayCircle,
} from 'lucide-react'

interface Props {
  phase: Phase
  isActive: boolean
  isCompleted: boolean
  onUpdate?: (updates: Partial<Phase>) => void
  onDelete?: () => void
  readOnly?: boolean
  /** 編集モードの開始/終了を親へ通知（編集中は他UIからの基準チェックをロックするため） */
  onEditingChange?: (editing: boolean) => void
}

export default function PhaseCard({ phase, isActive, isCompleted, onUpdate, onDelete, readOnly, onEditingChange }: Props) {
  const [expanded, setExpanded] = useState(isActive)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(phase)
  const [prevPhaseForDraft, setPrevPhaseForDraft] = useState(phase)

  // 編集状態を親へ通知する。編集中のままアンマウントされた場合（タブ切替など）も
  // クリーンアップで必ず解除し、親側のロックが残らないようにする
  useEffect(() => {
    onEditingChange?.(editing)
    return () => { if (editing) onEditingChange?.(false) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing])

  // 編集中でない間は、保存済みの最新phaseにdraftを同期し続ける（レンダー中に調整）。
  // これを怠ると、以前保存した内容から更新されない古いdraftを基準に
  // 移行基準のチェック操作（onToggle）が実行され、最新の編集内容が
  // 古い内容で上書きされて消える不具合が起きる。
  if (phase !== prevPhaseForDraft && !editing) {
    setPrevPhaseForDraft(phase)
    setDraft(phase)
  }

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

  /**
   * 運動の実施状況を切り替える（実施中 → できる → 見合わせ → 未設定）。
   * 保存済みの phase を基点にするため、編集中の draft とは混ざらない。
   */
  function cycleExerciseStatus(index: number) {
    if (!onUpdate) return
    const current = phase.exercises[index]?.status
    const at = current ? EXERCISE_STATUSES.indexOf(current) : -1
    const next = EXERCISE_STATUSES[at + 1] // 最後まで行くと undefined＝未設定に戻る
    const exercises = phase.exercises.map((ex, i) =>
      i === index ? { ...ex, status: next } : ex,
    )
    onUpdate({ exercises })
  }

  function addExercise() {
    setDraft(d => ({
      ...d,
      exercises: [...d.exercises, { name: '', dose: '', notes: '', videoUrl: '' }],
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
          {!readOnly && onDelete && (
            <button
              onClick={e => { e.stopPropagation(); onDelete() }}
              className="p-1.5 rounded-lg text-slate-300 hover:text-red-400 hover:bg-red-50 transition-colors"
              aria-label="フェーズを削除"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
          {!readOnly && !editing && (
            <button
              onClick={e => { e.stopPropagation(); setEditing(true); setExpanded(true) }}
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
            <div className="space-y-4 pt-3">
              {/* ── ラベルヘルパ ── */}
              {/* フェーズ名 */}
              <div>
                <label className="text-xs font-semibold text-[--color-text-secondary] font-display uppercase tracking-wide mb-1 block">フェーズ名</label>
                <input
                  value={draft.title}
                  onChange={e => setDraft(d => ({ ...d, title: e.target.value }))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm font-body focus:ring-2 focus:ring-[--color-primary] focus:border-transparent"
                />
              </div>

              {/* 期間 */}
              <div>
                <label className="text-xs font-semibold text-[--color-text-secondary] font-display uppercase tracking-wide mb-1 block">期間の目安</label>
                <input
                  value={draft.durationWeeks ?? ''}
                  onChange={e => setDraft(d => ({ ...d, durationWeeks: e.target.value }))}
                  placeholder="例: 2〜4週間"
                  className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm font-body focus:ring-2 focus:ring-[--color-primary] focus:border-transparent"
                />
              </div>

              {/* 目標 */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-[--color-text-secondary] font-display uppercase tracking-wide">目標</label>
                  <button onClick={() => setDraft(d => ({ ...d, goals: [...d.goals, ''] }))}
                    className="text-xs text-[--color-primary] hover:underline flex items-center gap-1 font-medium font-body">
                    <Plus className="w-3 h-3" />追加
                  </button>
                </div>
                {draft.goals.map((g, i) => (
                  <div key={i} className="flex gap-1.5 mb-1">
                    <input
                      value={g}
                      onChange={e => { const a = [...draft.goals]; a[i] = e.target.value; setDraft(d => ({ ...d, goals: a })) }}
                      className="flex-1 border border-slate-200 rounded-lg px-3 py-1.5 text-sm font-body focus:ring-2 focus:ring-[--color-primary] focus:border-transparent"
                    />
                    <button onClick={() => setDraft(d => ({ ...d, goals: d.goals.filter((_, j) => j !== i) }))}
                      className="text-slate-300 hover:text-red-400 transition-colors p-1"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                ))}
              </div>

              {/* エクササイズ */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-[--color-text-secondary] font-display uppercase tracking-wide">エクササイズ</label>
                  <button onClick={addExercise}
                    className="text-xs text-[--color-primary] hover:underline flex items-center gap-1 font-medium font-body">
                    <Plus className="w-3 h-3" />追加
                  </button>
                </div>
                {draft.exercises.map((ex, i) => (
                  <div key={i} className="mb-2 border border-slate-100 rounded-lg p-2 bg-slate-50">
                    <div className="flex gap-1.5 mb-1">
                      <input
                        value={ex.name}
                        onChange={e => {
                          const a = [...draft.exercises]
                          const name = e.target.value
                          const autoUrl = findVideoUrl(name)
                          a[i] = { ...a[i], name, videoUrl: a[i].videoUrl || autoUrl || '' }
                          setDraft(d => ({ ...d, exercises: a }))
                        }}
                        placeholder="種目名"
                        className="flex-1 border border-slate-200 rounded-lg px-2 py-1.5 text-sm font-body focus:ring-2 focus:ring-[--color-primary] focus:border-transparent bg-white"
                      />
                      <input
                        value={ex.dose ?? ''}
                        onChange={e => { const a = [...draft.exercises]; a[i] = { ...a[i], dose: e.target.value }; setDraft(d => ({ ...d, exercises: a })) }}
                        placeholder="量・頻度"
                        className="w-28 border border-slate-200 rounded-lg px-2 py-1.5 text-sm font-body focus:ring-2 focus:ring-[--color-primary] focus:border-transparent bg-white"
                      />
                      <button onClick={() => removeExercise(i)} className="text-slate-300 hover:text-red-400 transition-colors p-1">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <input
                      value={ex.videoUrl ?? ''}
                      onChange={e => { const a = [...draft.exercises]; a[i] = { ...a[i], videoUrl: e.target.value }; setDraft(d => ({ ...d, exercises: a })) }}
                      placeholder="YouTube URL（例: https://youtube.com/watch?v=...）"
                      className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-xs font-body focus:ring-2 focus:ring-[--color-primary] focus:border-transparent bg-white"
                    />
                  </div>
                ))}
              </div>

              {/* 移行基準 */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-[--color-text-secondary] font-display uppercase tracking-wide">移行基準</label>
                  <button onClick={() => setDraft(d => ({ ...d, advanceCriteria: [...d.advanceCriteria, { label: '', target: '', met: false }] }))}
                    className="text-xs text-[--color-primary] hover:underline flex items-center gap-1 font-medium font-body">
                    <Plus className="w-3 h-3" />追加
                  </button>
                </div>
                {draft.advanceCriteria.map((c, i) => (
                  <div key={i} className="flex gap-1.5 mb-1">
                    <input
                      value={c.label}
                      onChange={e => { const a = [...draft.advanceCriteria]; a[i] = { ...a[i], label: e.target.value }; setDraft(d => ({ ...d, advanceCriteria: a })) }}
                      placeholder="基準名"
                      className="flex-1 border border-slate-200 rounded-lg px-2 py-1.5 text-sm font-body focus:ring-2 focus:ring-[--color-primary] focus:border-transparent"
                    />
                    <input
                      value={c.target ?? ''}
                      onChange={e => { const a = [...draft.advanceCriteria]; a[i] = { ...a[i], target: e.target.value }; setDraft(d => ({ ...d, advanceCriteria: a })) }}
                      placeholder="目標値・目安"
                      className="w-36 border border-slate-200 rounded-lg px-2 py-1.5 text-sm font-body focus:ring-2 focus:ring-[--color-primary] focus:border-transparent"
                    />
                    <button onClick={() => setDraft(d => ({ ...d, advanceCriteria: d.advanceCriteria.filter((_, j) => j !== i) }))}
                      className="text-slate-300 hover:text-red-400 transition-colors p-1"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                ))}
              </div>

              {/* 注意事項 */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-amber-700 font-display uppercase tracking-wide">注意事項・禁忌</label>
                  <button onClick={() => setDraft(d => ({ ...d, precautions: [...d.precautions, ''] }))}
                    className="text-xs text-[--color-primary] hover:underline flex items-center gap-1 font-medium font-body">
                    <Plus className="w-3 h-3" />追加
                  </button>
                </div>
                {draft.precautions.map((p, i) => (
                  <div key={i} className="flex gap-1.5 mb-1">
                    <input
                      value={p}
                      onChange={e => { const a = [...draft.precautions]; a[i] = e.target.value; setDraft(d => ({ ...d, precautions: a })) }}
                      className="flex-1 border border-amber-200 rounded-lg px-3 py-1.5 text-sm font-body focus:ring-2 focus:ring-amber-400 focus:border-transparent"
                    />
                    <button onClick={() => setDraft(d => ({ ...d, precautions: d.precautions.filter((_, j) => j !== i) }))}
                      className="text-slate-300 hover:text-red-400 transition-colors p-1"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                ))}
              </div>

              {/* 中止基準 */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-red-700 font-display uppercase tracking-wide">中止基準 / Red Flags</label>
                  <button onClick={() => setDraft(d => ({ ...d, redFlags: [...d.redFlags, ''] }))}
                    className="text-xs text-[--color-primary] hover:underline flex items-center gap-1 font-medium font-body">
                    <Plus className="w-3 h-3" />追加
                  </button>
                </div>
                {draft.redFlags.map((r, i) => (
                  <div key={i} className="flex gap-1.5 mb-1">
                    <input
                      value={r}
                      onChange={e => { const a = [...draft.redFlags]; a[i] = e.target.value; setDraft(d => ({ ...d, redFlags: a })) }}
                      className="flex-1 border border-red-200 rounded-lg px-3 py-1.5 text-sm font-body focus:ring-2 focus:ring-red-400 focus:border-transparent"
                    />
                    <button onClick={() => setDraft(d => ({ ...d, redFlags: d.redFlags.filter((_, j) => j !== i) }))}
                      className="text-slate-300 hover:text-red-400 transition-colors p-1"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                ))}
              </div>

              {/* 評価指標 */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-[--color-text-secondary] font-display uppercase tracking-wide">評価指標</label>
                  <button onClick={() => setDraft(d => ({ ...d, outcomes: [...d.outcomes, ''] }))}
                    className="text-xs text-[--color-primary] hover:underline flex items-center gap-1 font-medium font-body">
                    <Plus className="w-3 h-3" />追加
                  </button>
                </div>
                {draft.outcomes.map((o, i) => (
                  <div key={i} className="flex gap-1.5 mb-1">
                    <input
                      value={o}
                      onChange={e => { const a = [...draft.outcomes]; a[i] = e.target.value; setDraft(d => ({ ...d, outcomes: a })) }}
                      className="flex-1 border border-slate-200 rounded-lg px-3 py-1.5 text-sm font-body focus:ring-2 focus:ring-[--color-primary] focus:border-transparent"
                    />
                    <button onClick={() => setDraft(d => ({ ...d, outcomes: d.outcomes.filter((_, j) => j !== i) }))}
                      className="text-slate-300 hover:text-red-400 transition-colors p-1"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                ))}
              </div>

              <div className="flex gap-2 pt-1 border-t border-slate-100">
                <button
                  onClick={saveEdit}
                  className="bg-[--color-primary] text-white text-sm px-4 py-1.5 rounded-lg
                    hover:bg-[--color-primary-hover] transition-colors font-display font-medium
                    flex items-center gap-1.5"
                >
                  <Save className="w-3.5 h-3.5" />変更を保存して登録
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
                    font-display uppercase tracking-widest mb-2 flex-wrap">
                    <Dumbbell className="w-3 h-3" />推奨エクササイズ
                    {/* 色の意味。押して切り替えられることも伝える */}
                    {onUpdate && (
                      <span className="no-print ml-auto flex items-center gap-1 normal-case tracking-normal font-medium">
                        {EXERCISE_STATUSES.map(s => (
                          <span key={s}
                            className={`px-1.5 py-0.5 rounded-full border text-[9px] ${EXERCISE_STATUS_STYLES[s]}`}>
                            {EXERCISE_STATUS_LABELS[s]}
                          </span>
                        ))}
                        <span className="text-[9px] text-slate-400">を押して切替</span>
                      </span>
                    )}
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    {phase.exercises.map((ex, i) => {
                      // 動画URL未設定でも運動名からマップを自動検索して表示
                      const videoUrl = ex.videoUrl || findVideoUrl(ex.name)
                      const cardStyle = ex.status
                        ? EXERCISE_STATUS_CARD_STYLES[ex.status]
                        : 'bg-[--color-surface-raised] border-slate-100'
                      return (
                      <div key={i} className={`rounded-lg border px-3 py-2 transition-colors ${cardStyle}`}>
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-start gap-2 min-w-0">
                            {/* タップするたび 実施中 → できる → 見合わせ → 未設定 と切り替わる */}
                            {onUpdate && (
                              <button
                                type="button"
                                onClick={() => cycleExerciseStatus(i)}
                                title={ex.status
                                  ? `${EXERCISE_STATUS_LABELS[ex.status]}（${EXERCISE_STATUS_DESCRIPTIONS[ex.status]}）／押すと切り替え`
                                  : '押して実施状況をつける'}
                                className={`no-print flex-shrink-0 mt-0.5 px-2 py-0.5 rounded-full border text-[10px]
                                  font-bold transition-colors ${
                                  ex.status
                                    ? EXERCISE_STATUS_STYLES[ex.status]
                                    : 'bg-white text-slate-300 border-slate-200 hover:border-teal-300 hover:text-teal-500'
                                }`}
                              >
                                {ex.status ? EXERCISE_STATUS_LABELS[ex.status] : '未設定'}
                              </button>
                            )}
                            {/* 印刷にも状態を残す（ボタンは印刷しないため） */}
                            {ex.status && (
                              <span className={`hidden print:inline px-1.5 rounded border text-[10px] font-bold
                                ${EXERCISE_STATUS_STYLES[ex.status]}`}>
                                {EXERCISE_STATUS_LABELS[ex.status]}
                              </span>
                            )}
                            <div className="text-sm font-semibold text-[--color-text-primary] font-display">{ex.name}</div>
                          </div>
                          {videoUrl && (
                            <a
                              href={videoUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 text-[10px] text-red-500 hover:text-red-600 font-medium shrink-0 mt-0.5"
                            >
                              <PlayCircle className="w-3 h-3" />動画
                            </a>
                          )}
                        </div>
                        {ex.dose && (
                          <div className="metric text-xs text-[--color-text-secondary] mt-0.5">{ex.dose}</div>
                        )}
                        {ex.notes && (
                          <div className="text-xs text-amber-700 mt-0.5 font-body">⚠ {ex.notes}</div>
                        )}
                      </div>
                    )})}
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
