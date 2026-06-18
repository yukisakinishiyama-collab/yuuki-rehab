'use client'

import { useState } from 'react'
import type { ProtocolPatient, Joint } from '@/types/protocol'
import { JOINT_LABELS, PRESET_DIAGNOSES } from '@/types/protocol'
import { User, Activity, Stethoscope, CalendarDays, StickyNote, Sparkles } from 'lucide-react'

interface Props {
  initial?: Partial<ProtocolPatient>
  onSubmit: (data: Omit<ProtocolPatient, 'id' | 'createdAt' | 'updatedAt'>) => void
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
    notes:        initial?.notes        ?? '',
  })

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
    onSubmit({
      name:      form.name      || undefined,
      age:       form.age       ? parseInt(form.age) : undefined,
      diagnosis: form.diagnosis || undefined,
      joint:     (form.joint as Joint) || undefined,
      sport:     form.sport     || undefined,
      eventDate: form.eventDate || undefined,
      notes:     form.notes     || undefined,
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">

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
