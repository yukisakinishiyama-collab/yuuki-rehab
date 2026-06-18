'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Save } from 'lucide-react'
import { savePatient } from '@/lib/rom-store'
import type { ROMPatient, SideType } from '@/types/rom'

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1.5">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      {children}
    </div>
  )
}

const inputCls = 'w-full px-3.5 py-3 border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent bg-white'

export default function NewPatientPage() {
  const router = useRouter()
  const [form, setForm] = useState({
    name: '',
    nameKana: '',
    birthDate: '',
    gender: 'male' as 'male' | 'female' | 'other',
    diagnosis: '',
    affectedSide: 'right' as SideType,
    injuryDate: '',
    surgeryDate: '',
    notes: '',
  })
  const [error, setError] = useState('')

  function handleSave() {
    if (!form.name.trim()) { setError('氏名を入力してください'); return }
    if (!form.birthDate) { setError('生年月日を入力してください'); return }
    if (!form.diagnosis.trim()) { setError('診断名を入力してください'); return }

    const patient: ROMPatient = {
      id: `rp-${Date.now()}`,
      name: form.name.trim(),
      nameKana: form.nameKana.trim(),
      birthDate: form.birthDate,
      gender: form.gender,
      diagnosis: form.diagnosis.trim(),
      affectedSide: form.affectedSide,
      injuryDate: form.injuryDate || null,
      surgeryDate: form.surgeryDate || null,
      notes: form.notes.trim(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    savePatient(patient)
    router.push(`/rom/patients/${patient.id}`)
  }

  return (
    <div className="max-w-lg mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/rom" className="p-2 rounded-xl hover:bg-slate-100 text-slate-500 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-xl font-bold text-slate-800">患者を追加</h1>
      </div>

      {error && (
        <div className="mb-4 p-3.5 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl">
          {error}
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
        <Field label="氏名" required>
          <input
            type="text"
            placeholder="山田 太郎"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className={inputCls}
          />
        </Field>

        <Field label="氏名（ふりがな）">
          <input
            type="text"
            placeholder="やまだ たろう"
            value={form.nameKana}
            onChange={(e) => setForm({ ...form, nameKana: e.target.value })}
            className={inputCls}
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="生年月日" required>
            <input
              type="date"
              value={form.birthDate}
              onChange={(e) => setForm({ ...form, birthDate: e.target.value })}
              className={inputCls}
            />
          </Field>

          <Field label="性別" required>
            <select
              value={form.gender}
              onChange={(e) => setForm({ ...form, gender: e.target.value as typeof form.gender })}
              className={inputCls}
            >
              <option value="male">男性</option>
              <option value="female">女性</option>
              <option value="other">その他</option>
            </select>
          </Field>
        </div>

        <Field label="診断名" required>
          <input
            type="text"
            placeholder="右膝半月板損傷"
            value={form.diagnosis}
            onChange={(e) => setForm({ ...form, diagnosis: e.target.value })}
            className={inputCls}
          />
        </Field>

        <Field label="患側">
          <div className="flex gap-2">
            {(['right', 'left', 'both', 'none'] as SideType[]).map((s) => (
              <button
                key={s}
                onClick={() => setForm({ ...form, affectedSide: s })}
                className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all border ${
                  form.affectedSide === s
                    ? 'bg-teal-600 text-white border-teal-600'
                    : 'bg-white text-slate-600 border-slate-200 hover:border-teal-400'
                }`}
              >
                {s === 'right' ? '右' : s === 'left' ? '左' : s === 'both' ? '両側' : 'なし'}
              </button>
            ))}
          </div>
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="受傷日">
            <input
              type="date"
              value={form.injuryDate}
              onChange={(e) => setForm({ ...form, injuryDate: e.target.value })}
              className={inputCls}
            />
          </Field>
          <Field label="手術日">
            <input
              type="date"
              value={form.surgeryDate}
              onChange={(e) => setForm({ ...form, surgeryDate: e.target.value })}
              className={inputCls}
            />
          </Field>
        </div>

        <Field label="メモ">
          <textarea
            rows={3}
            placeholder="特記事項など"
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            className={`${inputCls} resize-none`}
          />
        </Field>
      </div>

      <button
        onClick={handleSave}
        className="mt-5 w-full flex items-center justify-center gap-2 bg-teal-600 hover:bg-teal-700 text-white font-semibold py-4 rounded-2xl transition-colors shadow-sm text-base"
      >
        <Save className="w-5 h-5" />
        保存する
      </button>
    </div>
  )
}
