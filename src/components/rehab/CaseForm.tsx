'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { saveCase, getCurrentUser, generateId } from '@/lib/rehab-store'
import type { RehabCase, CaseStatus } from '@/types/rehab'
import { CASE_STATUS_LABELS } from '@/types/rehab'
import TagBadge from './TagBadge'
import { Save } from 'lucide-react'

const SUGGESTED_TAGS = [
  '歩行', 'スクワット', 'ジャンプ', 'ランニング', '肩関節', '膝関節', '足関節',
  '術後評価', 'スポーツ復帰', 'ACL', '腱板', '片麻痺', '高齢者',
]

export default function CaseForm() {
  const router = useRouter()
  const user = getCurrentUser()

  const [form, setForm] = useState({
    patientName: '',
    anonymousId: `PT-${new Date().getFullYear()}-${String(Date.now()).slice(-4)}`,
    age: '',
    gender: 'male' as 'male' | 'female' | 'other',
    diagnosis: '',
    injuredPart: '',
    postOpDays: '',
    evaluationPurpose: '',
    status: 'initial' as CaseStatus,
  })
  const [tags, setTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  function addTag(t: string) {
    const trimmed = t.trim()
    if (trimmed && !tags.includes(trimmed)) setTags([...tags, trimmed])
    setTagInput('')
  }

  function validate() {
    const e: Record<string, string> = {}
    if (!form.age || isNaN(Number(form.age))) e.age = '年齢を正しく入力してください'
    if (!form.diagnosis) e.diagnosis = '診断名を入力してください'
    if (!form.injuredPart) e.injuredPart = '受傷部位を入力してください'
    if (!form.evaluationPurpose) e.evaluationPurpose = '評価目的を入力してください'
    return e
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length > 0) {
      setErrors(errs)
      return
    }
    setSaving(true)
    const newCase: RehabCase = {
      id: generateId('case'),
      anonymousId: form.anonymousId,
      patientName: form.patientName || undefined,
      age: Number(form.age),
      gender: form.gender,
      diagnosis: form.diagnosis,
      injuredPart: form.injuredPart,
      postOpDays: form.postOpDays ? Number(form.postOpDays) : undefined,
      evaluationPurpose: form.evaluationPurpose,
      status: form.status,
      assignedTo: user ? [user.id] : [],
      reviewers: [],
      tags,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      videos: [],
    }
    saveCase(newCase)
    router.push(`/cases/${newCase.id}`)
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-6">
      <section>
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4 pb-2 border-b border-gray-100">
          対象者情報
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="患者氏名（任意）">
            <input
              type="text"
              placeholder="例：山本 健太（空欄で匿名ID使用）"
              value={form.patientName}
              onChange={(e) => setForm({ ...form, patientName: e.target.value })}
              className={inputClass}
            />
          </Field>
          <Field label="匿名ID">
            <input
              type="text"
              value={form.anonymousId}
              onChange={(e) => setForm({ ...form, anonymousId: e.target.value })}
              className={inputClass}
            />
          </Field>
          <Field label="年齢" error={errors.age}>
            <input
              type="number"
              min={0}
              max={120}
              placeholder="例：35"
              value={form.age}
              onChange={(e) => setForm({ ...form, age: e.target.value })}
              className={inputClass}
            />
          </Field>
          <Field label="性別">
            <select
              value={form.gender}
              onChange={(e) => setForm({ ...form, gender: e.target.value as typeof form.gender })}
              className={inputClass}
            >
              <option value="male">男性</option>
              <option value="female">女性</option>
              <option value="other">その他</option>
            </select>
          </Field>
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4 pb-2 border-b border-gray-100">
          医療情報
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="診断名" error={errors.diagnosis}>
            <input
              type="text"
              placeholder="例：右ACL再建術後"
              value={form.diagnosis}
              onChange={(e) => setForm({ ...form, diagnosis: e.target.value })}
              className={inputClass}
            />
          </Field>
          <Field label="受傷部位" error={errors.injuredPart}>
            <input
              type="text"
              placeholder="例：右膝関節"
              value={form.injuredPart}
              onChange={(e) => setForm({ ...form, injuredPart: e.target.value })}
              className={inputClass}
            />
          </Field>
          <Field label="術後日数（任意）">
            <input
              type="number"
              min={0}
              placeholder="例：30"
              value={form.postOpDays}
              onChange={(e) => setForm({ ...form, postOpDays: e.target.value })}
              className={inputClass}
            />
          </Field>
          <Field label="ステータス">
            <select
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value as CaseStatus })}
              className={inputClass}
            >
              {(Object.keys(CASE_STATUS_LABELS) as CaseStatus[]).map((s) => (
                <option key={s} value={s}>{CASE_STATUS_LABELS[s]}</option>
              ))}
            </select>
          </Field>
          <div className="sm:col-span-2">
            <Field label="評価目的" error={errors.evaluationPurpose}>
              <textarea
                rows={3}
                placeholder="例：スポーツ復帰前の機能評価（ジャンプ着地・方向転換動作）"
                value={form.evaluationPurpose}
                onChange={(e) => setForm({ ...form, evaluationPurpose: e.target.value })}
                className={inputClass}
              />
            </Field>
          </div>
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4 pb-2 border-b border-gray-100">
          タグ
        </h2>
        <div className="flex flex-wrap gap-1.5 mb-3">
          {tags.map((t) => (
            <TagBadge key={t} tag={t} onRemove={() => setTags(tags.filter((x) => x !== t))} />
          ))}
        </div>
        <div className="flex gap-2 mb-3">
          <input
            type="text"
            placeholder="タグを追加..."
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); addTag(tagInput) }
            }}
            className={`${inputClass} flex-1`}
          />
          <button
            type="button"
            onClick={() => addTag(tagInput)}
            className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm rounded-lg transition-colors"
          >
            追加
          </button>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {SUGGESTED_TAGS.filter((t) => !tags.includes(t)).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => addTag(t)}
              className="px-2 py-0.5 rounded-full text-xs border border-gray-200 text-gray-500 hover:border-[#0d9488] hover:text-[#0d9488] transition-colors"
            >
              + {t}
            </button>
          ))}
        </div>
      </section>

      <div className="flex justify-end gap-3 pt-2">
        <button
          type="button"
          onClick={() => router.back()}
          className="px-4 py-2.5 text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors"
        >
          キャンセル
        </button>
        <button
          type="submit"
          disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 text-sm bg-[#0d9488] hover:bg-[#0b8276] text-white font-medium rounded-xl transition-colors disabled:opacity-60"
        >
          <Save className="w-4 h-4" />
          {saving ? '保存中...' : '症例を保存'}
        </button>
      </div>
    </form>
  )
}

const inputClass =
  'w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0d9488] focus:border-transparent'

function Field({
  label,
  error,
  children,
}: {
  label: string
  error?: string
  children: React.ReactNode
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1.5">{label}</label>
      {children}
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  )
}
