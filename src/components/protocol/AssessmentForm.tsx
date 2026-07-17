'use client'

import { useState, useMemo } from 'react'
import type { Assessment, Phase, ProtocolPatient } from '@/types/protocol'
import type { SpecialTestRecord } from '@/types/patient'
import {
  JOINT_TO_REGION, resolveChartPatient, getChartPatientList,
  pullLatestMetrics, pullLatestSpecialTests, pushRomToChart,
  TEST_RESULT_LABELS,
} from '@/lib/clinical-sync'
import { Plus, Trash2, Calendar, ChevronDown, Link2, Download, FlaskConical } from 'lucide-react'

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
  /** カルテ連携用: プロトコル患者情報 */
  protocolPatient?: ProtocolPatient
  /** カルテ患者とのリンクを保存するコールバック */
  onLinkChart?: (chartPatientId: string) => void
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
  protocolPatient, onLinkChart,
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

  // ── カルテ連携 ──
  const [linkVersion, setLinkVersion] = useState(0) // リンク直後の再解決用
  const [selectedChartId, setSelectedChartId] = useState('')
  const [syncToChart, setSyncToChart] = useState(true)
  const [pulledInfo, setPulledInfo] = useState<string[]>([])
  const [specialTests, setSpecialTests] = useState<SpecialTestRecord[]>([])

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const link = useMemo(() => protocolPatient ? resolveChartPatient(protocolPatient) : { patient: null, explicit: false }, [protocolPatient, linkVersion])
  const chartPatients = useMemo(() => getChartPatientList(), [])
  const region = protocolPatient?.joint
    ? JOINT_TO_REGION[protocolPatient.joint]
    : link.patient?.bodyRegion ?? 'other'

  function handleLink() {
    if (!selectedChartId) return
    onLinkChart?.(selectedChartId)
    setLinkVersion(v => v + 1)
  }

  function handlePull() {
    if (!link.patient) return
    const pulled = pullLatestMetrics(link.patient.id, region)
    if (pulled.length === 0) {
      setPulledInfo(['カルテに取り込める記録がまだありません'])
    } else {
      setMetrics(prev => {
        const next = [...prev]
        for (const p of pulled) {
          const idx = next.findIndex(m => m.key === p.key)
          const preset = METRIC_PRESETS.find(x => x.key === p.key)
          if (idx >= 0) {
            next[idx] = { ...next[idx], value: String(p.value) }
          } else if (preset) {
            next.push({ key: preset.key, label: preset.label, value: String(p.value) })
          }
        }
        return next
      })
      setPulledInfo(pulled.map(p =>
        `${METRIC_PRESETS.find(x => x.key === p.key)?.label ?? p.key}: ${p.value}（${new Date(p.date).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' })} ${p.source}）`
      ))
    }
    setSpecialTests(pullLatestSpecialTests(link.patient.id, region))
  }

  function appendTestsToNotes() {
    if (specialTests.length === 0) return
    const summary = 'スペシャルテスト: ' + specialTests.map(t =>
      `${t.testName} ${TEST_RESULT_LABELS[t.result]}（${new Date(t.measuredDate).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' })}）`
    ).join('、')
    setNotes(n => n ? `${n}\n${summary}` : summary)
  }

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
    const metricValues = Object.fromEntries(filled.map(m => [m.key, parseFloat(m.value)]))
    // カルテ連携: ROM値をカルテのROM記録へ書き戻す
    if (syncToChart && link.patient) {
      pushRomToChart(link.patient.id, region, date, metricValues)
    }
    onSave({
      patientId,
      protocolId,
      phaseId: phaseId || undefined,
      date,
      metrics: metricValues,
      notes: notes || undefined,
    })
  }

  const unusedPresets = METRIC_PRESETS.filter(p => !metrics.some(m => m.key === p.key))

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* カルテ連携パネル */}
      {protocolPatient && (
        <div className="rounded-xl border border-teal-100 bg-teal-50/40 p-3.5 space-y-2.5">
          {link.patient ? (
            <>
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <Link2 className="w-3.5 h-3.5 text-teal-600" />
                  <span className="text-xs font-bold text-teal-800 font-display">
                    カルテ連携: {link.patient.name}
                  </span>
                  {!link.explicit && (
                    <button
                      type="button"
                      onClick={() => { setSelectedChartId(link.patient!.id); onLinkChart?.(link.patient!.id); setLinkVersion(v => v + 1) }}
                      className="text-[10px] text-teal-600 bg-white border border-teal-200 rounded-full px-2 py-0.5
                        hover:bg-teal-100 transition-colors"
                      title="氏名一致による自動候補です。クリックでリンクを確定します"
                    >
                      氏名一致 · リンクを確定
                    </button>
                  )}
                </div>
                <button
                  type="button"
                  onClick={handlePull}
                  className="flex items-center gap-1.5 text-xs font-bold text-white bg-teal-600
                    px-3 py-1.5 rounded-lg hover:bg-teal-700 transition-colors font-display"
                >
                  <Download className="w-3 h-3" />カルテから最新値を取り込む
                </button>
              </div>

              {pulledInfo.length > 0 && (
                <ul className="text-[11px] text-teal-800 bg-white/70 rounded-lg px-3 py-2 space-y-0.5">
                  {pulledInfo.map((line, i) => <li key={i}>· {line}</li>)}
                </ul>
              )}

              {/* スペシャルテスト（カルテの最新結果） */}
              {specialTests.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="flex items-center gap-1 text-[10px] font-bold text-teal-700 font-display uppercase tracking-wider">
                      <FlaskConical className="w-3 h-3" />スペシャルテスト（カルテ最新）
                    </span>
                    <button
                      type="button"
                      onClick={appendTestsToNotes}
                      className="text-[10px] text-teal-600 hover:underline"
                    >
                      メモへ追記
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {specialTests.map(t => (
                      <span key={t.id} className={`text-[10px] font-semibold rounded-full px-2 py-1 border ${
                        t.result === 'positive'   ? 'bg-red-50 border-red-200 text-red-700' :
                        t.result === 'negative'   ? 'bg-teal-50 border-teal-200 text-teal-700' :
                        t.result === 'suspicious' ? 'bg-amber-50 border-amber-200 text-amber-700' :
                                                    'bg-slate-50 border-slate-200 text-slate-500'
                      }`}>
                        {t.testName} {TEST_RESULT_LABELS[t.result]}
                        <span className="metric ml-1 opacity-60">
                          {new Date(t.measuredDate).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' })}
                        </span>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <label className="flex items-center gap-2 text-[11px] text-teal-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={syncToChart}
                  onChange={e => setSyncToChart(e.target.checked)}
                  className="accent-teal-600"
                />
                保存時にROM値をカルテのROM記録にも反映する
              </label>
            </>
          ) : (
            <div className="flex items-center gap-2 flex-wrap">
              <Link2 className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-xs text-slate-500">カルテ未連携 —</span>
              <select
                value={selectedChartId}
                onChange={e => setSelectedChartId(e.target.value)}
                className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white
                  focus:outline-none focus:ring-2 focus:ring-teal-500/40 max-w-[180px]"
              >
                <option value="">カルテ患者を選択...</option>
                {chartPatients.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={handleLink}
                disabled={!selectedChartId}
                className="text-xs font-bold text-white bg-teal-600 px-3 py-1.5 rounded-lg
                  hover:bg-teal-700 disabled:opacity-40 transition-colors font-display"
              >
                リンクする
              </button>
              <span className="text-[10px] text-slate-400 w-full">
                リンクするとROM・スペシャルテスト・痛みNRSをカルテと相互反映できます
              </span>
            </div>
          )}
        </div>
      )}

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
