'use client'

import { useState, useMemo } from 'react'
import type { ProtocolPatient, Joint } from '@/types/protocol'
import { JOINT_LABELS, PRESET_DIAGNOSES } from '@/types/protocol'
import { getChartPatientList } from '@/lib/clinical-sync'
import {
  User, Activity, Stethoscope, CalendarDays, StickyNote, Sparkles, MessageCircle, Link2,
} from 'lucide-react'

/** カルテ（患者管理）との連携方法 */
export interface ChartLinkChoice {
  mode: 'create' | 'link' | 'none'
  chartPatientId?: string
}

interface Props {
  initial?: Partial<ProtocolPatient>
  onSubmit: (
    data: Omit<ProtocolPatient, 'id' | 'createdAt' | 'updatedAt'>,
    chartLink?: ChartLinkChoice,
  ) => void
  loading?: boolean
}

/* ── 共通インプットスタイル ── */
const INPUT_CLS = [
  'w-full bg-[--color-surface-raised] border border-slate-200 rounded-xl',
  'px-3 py-2.5 text-sm font-body text-[--color-text-primary]',
  'focus:outline-none focus:ring-2 focus:ring-[--color-primary]/40 focus:border-[--color-primary]',
  'placeholder:text-slate-400 transition-colors',
].join(' ')

const LABEL_CLS = 'block text-xs font-semibold text-[--color-text-secondary] font-display mb-1.5'
const OPTIONAL_CLS = 'text-[--color-text-muted] font-normal'
const REQUIRED_CLS = 'text-[--color-accent] ml-0.5'

export default function PatientForm({ initial, onSubmit, loading }: Props) {
  const [form, setForm] = useState({
    name:         initial?.name         ?? '',
    age:          initial?.age?.toString() ?? '',
    diagnosis:    initial?.diagnosis    ?? '',
    diagnosisKey: '',
    joint:        (initial?.joint       ?? '') as Joint | '',
    sport:        initial?.sport        ?? '',
    eventDate:    initial?.eventDate    ?? '',
    concerns:     initial?.concerns     ?? '',
    notes:        initial?.notes        ?? '',
  })

  // ── カルテ連携の選択 ──
  const [chartMode, setChartMode] = useState<ChartLinkChoice['mode']>('create')
  const [chartId, setChartId] = useState('')
  const chartPatients = useMemo(() => getChartPatientList(), [])
  // 氏名が既存カルテ患者と一致（一意）する場合はリンク候補を提示
  const nameMatch = useMemo(() => {
    const name = form.name.trim()
    if (!name) return null
    const matches = chartPatients.filter(p => p.name === name)
    return matches.length === 1 ? matches[0] : null
  }, [form.name, chartPatients])

  function handleDiagnosisPreset(key: string) {
    const preset = PRESET_DIAGNOSES.find(p => p.key === key)
    if (!preset) return
    setForm(f => ({ ...f, diagnosisKey: key, diagnosis: preset.label, joint: preset.joint }))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.diagnosis && !form.joint) {
      alert('疾患名または関節部位のいずれかを入力してください')
      return
    }
    // カルテ連携の解決
    let chartLink: ChartLinkChoice = { mode: 'none' }
    if (chartMode === 'link' && chartId) {
      chartLink = { mode: 'link', chartPatientId: chartId }
    } else if (chartMode === 'create') {
      if (nameMatch) {
        // 同名の既存カルテ患者がいる場合は二重登録を避けてリンクする
        chartLink = { mode: 'link', chartPatientId: nameMatch.id }
      } else if (form.name.trim()) {
        chartLink = { mode: 'create' }
      } else {
        // 患者名がなければカルテ登録はできない（匿名プロトコルとして続行）
        chartLink = { mode: 'none' }
      }
    }
    onSubmit({
      name:      form.name      || undefined,
      age:       form.age       ? parseInt(form.age) : undefined,
      diagnosis: form.diagnosis || undefined,
      joint:     (form.joint as Joint) || undefined,
      sport:     form.sport     || undefined,
      eventDate: form.eventDate || undefined,
      concerns:  form.concerns  || undefined,
      notes:     form.notes     || undefined,
    }, chartLink)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">

      {/* 患者の悩み・現在の症状 */}
      <div className="bg-teal-50/60 border border-teal-200/70 rounded-2xl p-4">
        <label className="block text-xs font-semibold text-teal-800 font-display mb-1.5">
          <span className="flex items-center gap-1.5">
            <MessageCircle className="w-3.5 h-3.5 text-teal-600" />
            患者の悩み・現在の症状
            <span className="text-teal-600/70 font-normal">（AI生成時に優先反映）</span>
          </span>
        </label>
        <textarea
          value={form.concerns}
          onChange={e => setForm(f => ({ ...f, concerns: e.target.value }))}
          rows={3}
          placeholder="例: 階段の下りが痛い、長時間立っていると膝が腫れる、走り出しが怖い、夜間痛がある"
          className={`${INPUT_CLS} resize-none bg-white/80`}
        />
        <p className="text-[10px] text-teal-700/60 mt-1 font-body">
          患者が日常で感じている不安・制限・痛みの状況を自由に記入してください。AIがその悩みに対応したプロトコルを生成します。
        </p>
      </div>

      {/* 疾患プリセット */}
      <div>
        <label className={LABEL_CLS}>
          <span className="flex items-center gap-1.5">
            <Sparkles className="w-3 h-3 text-[--color-primary]" />
            疾患プリセット
            <span className={OPTIONAL_CLS}>（任意・自動入力）</span>
          </span>
        </label>
        <select
          value={form.diagnosisKey}
          onChange={e => handleDiagnosisPreset(e.target.value)}
          className={INPUT_CLS}
        >
          <option value="">── プリセットから選択 ──</option>
          {PRESET_DIAGNOSES.map(p => (
            <option key={p.key} value={p.key}>{p.label}</option>
          ))}
        </select>
        {form.diagnosisKey && (
          <p className="text-xs text-[--color-primary] mt-1 font-body">
            疾患名・関節が自動入力されました。必要に応じて修正できます。
          </p>
        )}
      </div>

      {/* 疾患名・関節部位 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className={LABEL_CLS}>
            <span className="flex items-center gap-1.5">
              <Stethoscope className="w-3 h-3 text-[--color-text-muted]" />
              疾患名 / 術式
              <span className={REQUIRED_CLS}>＊いずれか必須</span>
            </span>
          </label>
          <input
            type="text"
            value={form.diagnosis}
            onChange={e => setForm(f => ({ ...f, diagnosis: e.target.value }))}
            placeholder="例: ACL再建後、変形性膝関節症"
            className={INPUT_CLS}
          />
        </div>

        <div>
          <label className={LABEL_CLS}>
            <span className="flex items-center gap-1.5">
              <Activity className="w-3 h-3 text-[--color-text-muted]" />
              関節部位
              <span className={REQUIRED_CLS}>＊いずれか必須</span>
            </span>
          </label>
          <select
            value={form.joint}
            onChange={e => setForm(f => ({ ...f, joint: e.target.value as Joint | '' }))}
            className={INPUT_CLS}
          >
            <option value="">── 選択 ──</option>
            {(Object.entries(JOINT_LABELS) as [Joint, string][]).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* 患者名・年齢・スポーツ・受傷日 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className={LABEL_CLS}>
            <span className="flex items-center gap-1.5">
              <User className="w-3 h-3 text-[--color-text-muted]" />
              患者名
              <span className={OPTIONAL_CLS}>（任意・匿名可）</span>
            </span>
          </label>
          <input
            type="text"
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            placeholder="患者A など匿名でも可"
            className={INPUT_CLS}
          />
        </div>

        <div>
          <label className={LABEL_CLS}>
            年齢
            <span className={OPTIONAL_CLS}> （任意）</span>
          </label>
          <input
            type="number"
            min="0"
            max="120"
            value={form.age}
            onChange={e => setForm(f => ({ ...f, age: e.target.value }))}
            placeholder="例: 25"
            className={`${INPUT_CLS} metric`}
          />
        </div>

        <div>
          <label className={LABEL_CLS}>
            スポーツ種目
            <span className={OPTIONAL_CLS}> （任意）</span>
          </label>
          <input
            type="text"
            value={form.sport}
            onChange={e => setForm(f => ({ ...f, sport: e.target.value }))}
            placeholder="例: サッカー、バスケ、なし"
            className={INPUT_CLS}
          />
        </div>

        <div>
          <label className={LABEL_CLS}>
            <span className="flex items-center gap-1.5">
              <CalendarDays className="w-3 h-3 text-[--color-text-muted]" />
              受傷 / 手術日
              <span className={OPTIONAL_CLS}> （任意）</span>
            </span>
          </label>
          <input
            type="date"
            value={form.eventDate}
            onChange={e => setForm(f => ({ ...f, eventDate: e.target.value }))}
            className={INPUT_CLS}
          />
        </div>
      </div>

      {/* カルテ連携（リハビリ状況・来院記録と一緒に作成） */}
      <div className="border border-slate-200 rounded-2xl p-4 bg-[--color-surface-raised]/50">
        <div className="flex items-center gap-1.5 mb-2.5">
          <Link2 className="w-3.5 h-3.5 text-teal-600" />
          <span className="text-xs font-semibold text-[--color-text-secondary] font-display">
            カルテ（患者管理・リハビリ状況）との連携
          </span>
        </div>
        <div className="space-y-2">
          <label className="flex items-start gap-2.5 cursor-pointer">
            <input
              type="radio"
              name="chartMode"
              checked={chartMode === 'create'}
              onChange={() => setChartMode('create')}
              className="mt-0.5 accent-teal-600"
            />
            <span className="text-sm text-[--color-text-primary] font-body">
              カルテにも患者を登録する
              <span className="text-[10px] text-teal-700 bg-teal-50 border border-teal-200 rounded-full px-1.5 py-0.5 ml-1.5 font-semibold">推奨</span>
              <span className="block text-[11px] text-[--color-text-muted] mt-0.5">
                {nameMatch
                  ? `同名のカルテ患者「${nameMatch.name}」が見つかったため、新規登録せずにリンクします`
                  : form.name.trim()
                    ? 'リハビリ状況・来院記録（SOAP）・ROM評価とすぐに連携できます'
                    : '患者名を入力すると登録できます（未入力の場合は連携なしで作成）'}
              </span>
            </span>
          </label>
          <label className="flex items-start gap-2.5 cursor-pointer">
            <input
              type="radio"
              name="chartMode"
              checked={chartMode === 'link'}
              onChange={() => setChartMode('link')}
              className="mt-0.5 accent-teal-600"
            />
            <span className="text-sm text-[--color-text-primary] font-body flex-1">
              既存のカルテ患者とリンクする
              {chartMode === 'link' && (
                <select
                  value={chartId}
                  onChange={e => setChartId(e.target.value)}
                  className={`${INPUT_CLS} mt-1.5`}
                >
                  <option value="">── カルテ患者を選択 ──</option>
                  {chartPatients.map(p => (
                    <option key={p.id} value={p.id}>{p.name}{p.diagnosisLabel && `（${p.diagnosisLabel}）`}</option>
                  ))}
                </select>
              )}
            </span>
          </label>
          <label className="flex items-start gap-2.5 cursor-pointer">
            <input
              type="radio"
              name="chartMode"
              checked={chartMode === 'none'}
              onChange={() => setChartMode('none')}
              className="mt-0.5 accent-teal-600"
            />
            <span className="text-sm text-[--color-text-muted] font-body">
              連携しない（プロトコル単体で作成）
            </span>
          </label>
        </div>
      </div>

      {/* 補足メモ */}
      <div>
        <label className={LABEL_CLS}>
          <span className="flex items-center gap-1.5">
            <StickyNote className="w-3 h-3 text-[--color-text-muted]" />
            補足メモ
            <span className={OPTIONAL_CLS}> （任意）</span>
          </span>
        </label>
        <textarea
          value={form.notes}
          onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
          rows={3}
          placeholder="既往歴、合併症、生活・競技レベルの目標など"
          className={`${INPUT_CLS} resize-none`}
        />
      </div>

      {/* 送信ボタン */}
      <button
        type="submit"
        disabled={loading}
        className="w-full bg-gradient-to-r from-[--color-primary] to-[--color-primary-mid] text-white
          font-semibold font-display py-3 rounded-xl hover:opacity-90 transition-opacity
          disabled:opacity-50 disabled:cursor-not-allowed shadow-sm text-sm"
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            プロトコル生成中...
          </span>
        ) : 'プロトコルを生成する →'}
      </button>
    </form>
  )
}
