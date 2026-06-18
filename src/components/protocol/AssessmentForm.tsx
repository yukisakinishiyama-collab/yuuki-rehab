'use client'

import { useState } from 'react'
import type { Assessment, Phase } from '@/types/protocol'
import { Plus, Trash2, Calendar, ChevronDown } from 'lucide-react'

const METRIC_PRESETS = [
  { key: 'pain',     label: '疼痛 (NRS 0–10)',   min: 0,   max: 10  },
  { key: 'rom_flex', label: 'ROM 屈曲 (°)',       min: 0,   max: 180 },
  { key: 'rom_ext',  label: 'ROM 伸展 (°)',       min: -20, max: 180 },
  { key: 'lsi',      label: 'LSI 患健比 (%)',     min: 0,   max: 150 },
  { key: 'mmt',      label: 'MMT (0–5)',          min: 0,   max: 5   },
  { key: 'swelling', label: '浮腫・周径 (cm)',    min: 0,   max: 100 },
]

interface Props {
  patientId: string
  protocolId: string
  phases: Phase[]
  currentPhaseIndex: number
  onSave: (assessment: Omit<Assessment, 'id'>) => void
  onCancel: () => void
}

interface MetricEntry {
  key: string
  label: string
  value: string
  isCustom?: boolean
}

/* ── 共通インプットスタイル ── */
const INPUT_CLS = [
  'w-full bg-[--color-surface-raised] border border-slate-200 rounded-xl',
  'px-3 py-2 text-sm font-body text-[--color-text-primary]',
  'focus:outline-none focus:ring-2 focus:ring-[--color-primary]/40 focus:border-[--color-primary]',
  'placeholder:text-slate-400 transition-colors',
].join(' ')

export default function AssessmentForm({
  patientId, protocolId, phases, currentPhaseIndex, onSave, onCancel,
}: Props) {
  const [date, setDate]     = useState(new Date().toISOString().split('T')[0])
  const [phaseId, setPhaseId] = useState(phases[currentPhaseIndex]?.id ?? '')
  const [notes, setNotes]   = useState('')
  const [metrics, setMetrics] = useState<MetricEntry[]>([
    { key: 'pain',     label: '疼痛 (NRS 0–10)',   value: '' },
    { key: 'rom_flex', label: 'ROM 屈曲 (°)',       value: '' },
    { key: 'lsi',      label: 'LSI 患健比 (%)',     value: '' },
  ])
  const [customKey,   setCustomKey]   = useState('')
  const [customLabel, setCustomLabel] = useState('')

  function addPreset(key: string) {
    if (metrics.some(m => m.key === key)) return
    const preset = METRIC_PRESETS.find(p => p.key === key)
    if (!preset) return
    setMetrics(m => [...m, { key: preset.key, label: preset.label, value: '' }])
  }

  function addCustom() {
    if (!customKey || !customLabel) return
    if (metrics.some(m => m.key === customKey)) return
    setMetrics(m => [...m, { key: customKey, label: customLabel, value: '', isCustom: true }])
    setCustomKey('')
    setCustomLabel('')
  }

  function removeMetric(key: string) {
    setMetrics(m => m.filter(x => x.key !== key))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const filled = metrics.filter(m => m.value !== '')
    if (filled.length === 0) {
      alert('少なくとも1つの指標を入力してください')
      return
    }
    onSave({
      patientId,
      protocolId,
      phaseId: phaseId || undefined,
      date,
      metrics: Object.fromEntries(filled.map(m => [m.key, parseFloat(m.value)])),
      notes: notes || undefined,
    })
  }

  const unusedPresets = METRIC_PRESETS.filter(p => !metrics.some(m => m.key === p.key))

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* 日付・フェーズ */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-semibold text-[--color-text-secondary] font-display mb-1.5 flex items-center gap-1 block">
            <Calendar className="w-3 h-3" />記録日
          </label>
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            required
            className={INPUT_CLS}
          />
        </div>
        <div>
          <label className="text-xs font-semibold text-[--color-text-secondary] font-display mb-1.5 flex items-center gap-1 block">
            <ChevronDown className="w-3 h-3" />フェーズ
          </label>
          <select
            value={phaseId}
            onChange={e => setPhaseId(e.target.value)}
            className={INPUT_CLS}
          >
            {phases.map(ph => (
              <option key={ph.id} value={ph.id}>{ph.order}. {ph.title}</option>
            ))}
          </select>
        </div>
      </div>

      {/* 評価指標 */}
      <div>
        <div className="text-xs font-semibold text-[--color-text-secondary] font-display mb-2">
          評価指標
        </div>
        <div className="space-y-2">
          {metrics.map(m => (
            <div key={m.key} className="flex items-center gap-2">
              <label className="text-xs text-[--color-text-muted] w-36 flex-shrink-0 font-body leading-snug">
                {m.label}
              </label>
              <input
                type="number"
                step="any"
                value={m.value}
                onChange={e =>
                  setMetrics(ms =>
                    ms.map(x => x.key === m.key ? { ...x, value: e.target.value } : x)
                  )
                }
                placeholder="値を入力"
                className={[
                  'flex-1 bg-[--color-surface-raised] border border-slate-200 rounded-lg',
                  'px-3 py-1.5 text-sm metric text-[--color-text-primary]',
                  'focus:outline-none focus:ring-2 focus:ring-[--color-primary]/40 focus:border-[--color-primary]',
                  'placeholder:text-slate-400 transition-colors',
                ].join(' ')}
              />
              <button
                type="button"
                onClick={() => removeMetric(m.key)}
                className="text-slate-400 hover:text-red-500 transition-colors p-1 -mr-1 flex-shrink-0"
                aria-label={`${m.label}を削除`}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>

        {/* プリセット追加ボタン */}
        {unusedPresets.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-3">
            {unusedPresets.map(p => (
              <button
                key={p.key}
                type="button"
                onClick={() => addPreset(p.key)}
                className="flex items-center gap-1 text-xs bg-[--color-surface-raised] text-[--color-text-muted]
                  hover:bg-[--color-primary-light] hover:text-[--color-primary]
                  rounded-full px-2.5 py-1 border border-slate-200 hover:border-[--color-primary]/30
                  transition-colors font-body"
              >
                <Plus className="w-3 h-3" />{p.label}
              </button>
            ))}
          </div>
        )}

        {/* カスタム指標 */}
        <div className="flex gap-2 mt-2.5 pt-2.5 border-t border-slate-100">
          <input
            value={customKey}
            onChange={e => setCustomKey(e.target.value)}
            placeholder="キー (英数字)"
            className="w-28 bg-[--color-surface-raised] border border-slate-200 rounded-lg px-2 py-1.5
              text-xs font-body focus:outline-none focus:ring-2 focus:ring-[--color-primary]/40
              focus:border-[--color-primary] placeholder:text-slate-400 transition-colors"
          />
          <input
            value={customLabel}
            onChange={e => setCustomLabel(e.target.value)}
            placeholder="表示名"
            className="flex-1 bg-[--color-surface-raised] border border-slate-200 rounded-lg px-2 py-1.5
              text-xs font-body focus:outline-none focus:ring-2 focus:ring-[--color-primary]/40
              focus:border-[--color-primary] placeholder:text-slate-400 transition-colors"
          />
          <button
            type="button"
            onClick={addCustom}
            disabled={!customKey || !customLabel}
            className="text-xs text-[--color-primary] hover:underline disabled:opacity-40
              font-display font-semibold flex-shrink-0 px-1"
          >
            追加
          </button>
        </div>
      </div>

      {/* メモ */}
      <div>
        <label className="text-xs font-semibold text-[--color-text-secondary] font-display mb-1.5 block">
          メモ <span className="text-[--color-text-muted] font-normal">（任意）</span>
        </label>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          rows={2}
          placeholder="気づいた点、患者の状態など"
          className={`${INPUT_CLS} resize-none`}
        />
      </div>

      {/* アクション */}
      <div className="flex gap-2 pt-1">
        <button
          type="submit"
          className="flex-1 bg-[--color-primary] hover:bg-[--color-primary-hover] text-white
            text-sm font-semibold font-display py-2.5 rounded-xl transition-colors shadow-sm"
        >
          記録を保存
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 bg-[--color-surface-raised] text-[--color-text-secondary]
            hover:bg-slate-200 text-sm font-body py-2.5 rounded-xl transition-colors"
        >
          キャンセル
        </button>
      </div>
    </form>
  )
}
