'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { saveCase, getCurrentUser, generateId } from '@/lib/rehab-store'
import type { RehabCase, ServiceType, DeliveryStatus } from '@/types/rehab'
import { SERVICE_TYPE_LABELS } from '@/types/rehab'
import { Save, User, Mail, Phone, Activity, FileText } from 'lucide-react'

const SERVICE_TYPES = Object.keys(SERVICE_TYPE_LABELS) as ServiceType[]

const SPORT_SUGGESTIONS = [
  'サッカー', 'バスケットボール', '野球', '陸上', '水泳', 'テニス',
  'バレーボール', 'バドミントン', 'ラグビー', '柔道', '剣道',
  'バレエ', 'ダンス', 'ゴルフ', 'マラソン', 'トライアスロン',
  '体操', '姿勢改善', '日常生活動作', 'リハビリ',
]

export default function CaseForm() {
  const router = useRouter()
  const user = getCurrentUser()

  const [form, setForm] = useState({
    clientName: '',
    clientEmail: '',
    clientPhone: '',
    age: '',
    gender: 'male' as 'male' | 'female' | 'other',
    sport: '',
    serviceType: 'sports' as ServiceType,
    requestNote: '',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  function validate() {
    const e: Record<string, string> = {}
    if (!form.clientName.trim()) e.clientName = '氏名を入力してください'
    if (!form.clientEmail.trim()) e.clientEmail = 'メールアドレスを入力してください'
    if (form.clientEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.clientEmail)) {
      e.clientEmail = '正しいメールアドレスを入力してください'
    }
    if (!form.sport.trim()) e.sport = 'スポーツ・目的を入力してください'
    return e
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length > 0) { setErrors(errs); return }
    setSaving(true)

    const caseId = generateId('case')
    const newCase: RehabCase = {
      id: caseId,
      anonymousId: `YML-${new Date().getFullYear()}-${String(Date.now()).slice(-4)}`,
      patientName: form.clientName,
      age: Number(form.age) || 0,
      gender: form.gender,
      diagnosis: form.sport,
      injuredPart: form.sport,
      evaluationPurpose: form.requestNote || form.sport,
      status: 'initial',
      assignedTo: user ? [user.id] : [],
      reviewers: [],
      tags: [form.sport, SERVICE_TYPE_LABELS[form.serviceType]].filter(Boolean),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      videos: [],
      // サービス向けフィールド
      clientEmail: form.clientEmail,
      clientPhone: form.clientPhone || undefined,
      sport: form.sport,
      serviceType: form.serviceType,
      deliveryStatus: 'received' as DeliveryStatus,
      requestNote: form.requestNote || undefined,
    }
    saveCase(newCase)
    router.push(`/cases/${newCase.id}`)
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-6">

      {/* クライアント情報 */}
      <section>
        <div className="flex items-center gap-2 mb-4 pb-2 border-b border-gray-100">
          <User className="w-4 h-4 text-[#0d9488]" />
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">クライアント情報</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="氏名" error={errors.clientName} required>
            <input
              type="text"
              placeholder="例：山田 太郎"
              value={form.clientName}
              onChange={(e) => setForm({ ...form, clientName: e.target.value })}
              className={inputClass}
            />
          </Field>
          <Field label="年齢">
            <input
              type="number" min={0} max={120}
              placeholder="例：25"
              value={form.age}
              onChange={(e) => setForm({ ...form, age: e.target.value })}
              className={inputClass}
            />
          </Field>
          <Field label="性別">
            <select value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value as typeof form.gender })} className={inputClass}>
              <option value="male">男性</option>
              <option value="female">女性</option>
              <option value="other">その他</option>
            </select>
          </Field>
        </div>
      </section>

      {/* 連絡先 */}
      <section>
        <div className="flex items-center gap-2 mb-4 pb-2 border-b border-gray-100">
          <Mail className="w-4 h-4 text-[#0d9488]" />
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">連絡先（レポート送付先）</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="メールアドレス" error={errors.clientEmail} required>
            <input
              type="email"
              placeholder="例：yamada@example.com"
              value={form.clientEmail}
              onChange={(e) => setForm({ ...form, clientEmail: e.target.value })}
              className={inputClass}
            />
          </Field>
          <Field label="電話番号（任意）">
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="tel"
                placeholder="例：090-1234-5678"
                value={form.clientPhone}
                onChange={(e) => setForm({ ...form, clientPhone: e.target.value })}
                className={`${inputClass} pl-9`}
              />
            </div>
          </Field>
        </div>
      </section>

      {/* 依頼内容 */}
      <section>
        <div className="flex items-center gap-2 mb-4 pb-2 border-b border-gray-100">
          <Activity className="w-4 h-4 text-[#0d9488]" />
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">依頼内容</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="サービス種別">
            <select value={form.serviceType} onChange={(e) => setForm({ ...form, serviceType: e.target.value as ServiceType })} className={inputClass}>
              {SERVICE_TYPES.map((t) => (
                <option key={t} value={t}>{SERVICE_TYPE_LABELS[t]}</option>
              ))}
            </select>
          </Field>
          <Field label="スポーツ・目的" error={errors.sport} required>
            <input
              type="text"
              placeholder="例：サッカー / 姿勢改善 / リハビリ"
              value={form.sport}
              onChange={(e) => setForm({ ...form, sport: e.target.value })}
              className={inputClass}
            />
          </Field>
        </div>
        {/* スポーツ候補 */}
        <div className="flex flex-wrap gap-1.5 mt-2">
          {SPORT_SUGGESTIONS.filter((s) => s !== form.sport).map((s) => (
            <button key={s} type="button" onClick={() => setForm({ ...form, sport: s })}
              className="px-2 py-0.5 rounded-full text-xs border border-gray-200 text-gray-500 hover:border-[#0d9488] hover:text-[#0d9488] transition-colors">
              + {s}
            </button>
          ))}
        </div>
      </section>

      {/* 依頼メモ */}
      <section>
        <div className="flex items-center gap-2 mb-4 pb-2 border-b border-gray-100">
          <FileText className="w-4 h-4 text-[#0d9488]" />
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">依頼メモ（任意）</h2>
        </div>
        <textarea
          rows={3}
          placeholder="例：右膝の着地時の痛みを気にしている。スポーツ復帰前に確認したい。"
          value={form.requestNote}
          onChange={(e) => setForm({ ...form, requestNote: e.target.value })}
          className={inputClass}
        />
      </section>

      <div className="flex justify-end gap-3 pt-2">
        <button type="button" onClick={() => router.back()} className="px-4 py-2.5 text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors">
          キャンセル
        </button>
        <button type="submit" disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 text-sm bg-[#0d9488] hover:bg-[#0b8276] text-white font-medium rounded-xl transition-colors disabled:opacity-60">
          <Save className="w-4 h-4" />
          {saving ? '保存中...' : '案件を登録'}
        </button>
      </div>
    </form>
  )
}

const inputClass = 'w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0d9488] focus:border-transparent'

function Field({ label, error, required, children }: { label: string; error?: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1.5">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  )
}
