'use client'
// ──────────────────────────────────────────────
// 新規患者登録ページ
// ──────────────────────────────────────────────
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { nanoid } from 'nanoid'
import type { Patient, BodyRegion, Gender } from '@/types/patient'
import { BODY_REGION_LABELS } from '@/types/patient'
import { savePatient } from '@/lib/patient-store'
import { saveCase, getCurrentUser, generateId, getCases } from '@/lib/rehab-store'
import type { RehabCase } from '@/types/rehab'
import { FormLabel, Input, Textarea, SectionTitle } from '@/components/rehab-management/shared'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'

const selectClass = 'flex h-10 w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-offset-1'

export default function NewPatientPage() {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    name: '',
    kana: '',
    birthDate: '',
    gender: 'male' as Gender,
    phone: '',
    emergencyContact: '',
    mainComplaint: '',
    bodyRegion: 'knee' as BodyRegion,
    diagnosisLabel: '',
    onsetDate: '',
    therapistNotes: '',
  })

  function handleSave() {
    if (!form.name || !form.mainComplaint) {
      alert('氏名・主訴は必須です')
      return
    }
    setSaving(true)
    const now = new Date().toISOString()
    const patient: Patient = {
      id: nanoid(),
      name: form.name,
      kana: form.kana,
      birthDate: form.birthDate,
      gender: form.gender,
      phone: form.phone,
      emergencyContact: form.emergencyContact,
      mainComplaint: form.mainComplaint,
      bodyRegion: form.bodyRegion,
      diagnosisLabel: form.diagnosisLabel,
      onsetDate: form.onsetDate,
      firstVisitDate: new Date().toISOString().split('T')[0],
      status: 'active',
      therapistNotes: form.therapistNotes,
      createdAt: now,
      updatedAt: now,
    }
    savePatient(patient)

    // 同名案件がなければ動画解析にも自動登録
    const user = getCurrentUser()
    const existingCase = getCases().find(c => c.patientName === form.name)
    if (!existingCase) {
      const newCase: RehabCase = {
        id: generateId('case'),
        anonymousId: `YML-${new Date().getFullYear()}-${String(Date.now()).slice(-4)}`,
        patientName: form.name,
        age: 0,
        gender: form.gender,
        diagnosis: form.mainComplaint,
        injuredPart: form.mainComplaint,
        evaluationPurpose: form.mainComplaint,
        status: 'initial',
        assignedTo: user ? [user.id] : [],
        reviewers: [],
        tags: [form.diagnosisLabel, BODY_REGION_LABELS[form.bodyRegion]].filter(Boolean),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        videos: [],
        clientEmail: '',
        clientPhone: form.phone || undefined,
        sport: form.mainComplaint,
        serviceType: 'rehab',
        deliveryStatus: 'received',
        requestNote: form.therapistNotes || undefined,
      }
      saveCase(newCase)
    }

    router.push(`/patients/${patient.id}`)
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* ヘッダー */}
      <div>
        <button
          onClick={() => router.back()}
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-3 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          戻る
        </button>
        <h1 className="text-2xl font-semibold tracking-tight text-gray-900">新規患者登録</h1>
        <p className="text-sm text-gray-500 mt-1">患者様の基本情報と症状を入力してください</p>
      </div>

      <Card>
        <CardContent className="p-6 space-y-5">
          <SectionTitle>基本情報</SectionTitle>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <FormLabel required>氏名</FormLabel>
              <Input value={form.name} onChange={v => setForm(f => ({ ...f, name: v }))} placeholder="山田 太郎" />
            </div>
            <div>
              <FormLabel>カナ</FormLabel>
              <Input value={form.kana} onChange={v => setForm(f => ({ ...f, kana: v }))} placeholder="ヤマダ タロウ" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <FormLabel>生年月日</FormLabel>
              <Input type="date" value={form.birthDate} onChange={v => setForm(f => ({ ...f, birthDate: v }))} />
            </div>
            <div>
              <FormLabel>性別</FormLabel>
              <select
                value={form.gender}
                onChange={e => setForm(f => ({ ...f, gender: e.target.value as Gender }))}
                className={selectClass}
              >
                <option value="male">男性</option>
                <option value="female">女性</option>
                <option value="other">その他</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <FormLabel>電話番号</FormLabel>
              <Input type="tel" value={form.phone} onChange={v => setForm(f => ({ ...f, phone: v }))} placeholder="090-0000-0000" />
            </div>
            <div>
              <FormLabel>緊急連絡先</FormLabel>
              <Input value={form.emergencyContact} onChange={v => setForm(f => ({ ...f, emergencyContact: v }))} placeholder="氏名・続柄・電話番号" />
            </div>
          </div>

          <Separator />
          <SectionTitle>症状・診断</SectionTitle>

          <div>
            <FormLabel required>主訴</FormLabel>
            <Input value={form.mainComplaint} onChange={v => setForm(f => ({ ...f, mainComplaint: v }))} placeholder="例：右膝の痛みと腫脹" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <FormLabel required>対象部位</FormLabel>
              <select
                value={form.bodyRegion}
                onChange={e => setForm(f => ({ ...f, bodyRegion: e.target.value as BodyRegion }))}
                className={selectClass}
              >
                {(Object.keys(BODY_REGION_LABELS) as BodyRegion[]).map(r => (
                  <option key={r} value={r}>{BODY_REGION_LABELS[r]}</option>
                ))}
              </select>
            </div>
            <div>
              <FormLabel>診断名（疑い含む）</FormLabel>
              <Input value={form.diagnosisLabel} onChange={v => setForm(f => ({ ...f, diagnosisLabel: v }))} placeholder="例：右膝半月板損傷" />
            </div>
          </div>

          <div>
            <FormLabel>発症日</FormLabel>
            <Input type="date" value={form.onsetDate} onChange={v => setForm(f => ({ ...f, onsetDate: v }))} />
          </div>

          <div>
            <FormLabel>担当者メモ</FormLabel>
            <Textarea value={form.therapistNotes} onChange={v => setForm(f => ({ ...f, therapistNotes: v }))} placeholder="特記事項・注意点" rows={3} />
          </div>

          <div className="flex justify-end pt-2">
            <Button onClick={handleSave} disabled={saving}>
              {saving && <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
              患者を登録する
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
