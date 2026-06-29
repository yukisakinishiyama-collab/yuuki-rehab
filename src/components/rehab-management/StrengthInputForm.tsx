'use client'
// ──────────────────────────────────────────────
// 筋力入力フォーム（MMT・HHD対応）
// ──────────────────────────────────────────────
import { useState } from 'react'
import { nanoid } from 'nanoid'
import type { StrengthRecord, BodyRegion, MMTGrade, StrengthUnit } from '@/types/patient'
import { BODY_REGION_LABELS } from '@/types/patient'
import { saveStrengthRecord } from '@/lib/patient-store'
import { Card, CardHeader, CardContent, FormLabel, Input, Textarea, ToggleSwitch, SaveButton, SectionTitle } from './shared'

const STRENGTH_TEMPLATES: Record<BodyRegion, { movement: string; muscle: string }[]> = {
  hip: [
    { movement: 'Hip Flexion', muscle: '腸腰筋・大腿直筋' },
    { movement: 'Hip Extension', muscle: '大殿筋' },
    { movement: 'Hip Abduction', muscle: '中殿筋' },
    { movement: 'Hip Adduction', muscle: '股関節内転筋群' },
    { movement: 'Hip Internal Rotation', muscle: '股関節内旋筋群' },
    { movement: 'Hip External Rotation', muscle: '深層外旋6筋' },
  ],
  knee: [
    { movement: 'Knee Extension', muscle: '大腿四頭筋' },
    { movement: 'Knee Flexion', muscle: 'ハムストリングス' },
    { movement: 'Quadriceps strength', muscle: '大腿四頭筋（HHD）' },
    { movement: 'Hamstrings strength', muscle: 'ハムストリングス（HHD）' },
  ],
  ankle: [
    { movement: 'Dorsiflexion', muscle: '前脛骨筋' },
    { movement: 'Plantarflexion', muscle: '下腿三頭筋' },
    { movement: 'Inversion', muscle: '後脛骨筋' },
    { movement: 'Eversion', muscle: '腓骨筋群' },
    { movement: 'Single Leg Heel Raise', muscle: '下腿三頭筋（回数）' },
  ],
  shoulder: [
    { movement: 'Shoulder Flexion', muscle: '三角筋前部' },
    { movement: 'Shoulder Abduction', muscle: '三角筋・棘上筋' },
    { movement: 'External Rotation', muscle: '棘下筋・小円筋' },
    { movement: 'Internal Rotation', muscle: '肩甲下筋' },
    { movement: 'Empty Can position', muscle: '棘上筋' },
    { movement: 'Scapular stabilizers', muscle: '前鋸筋・菱形筋' },
  ],
  elbow: [
    { movement: 'Elbow Flexion', muscle: '上腕二頭筋' },
    { movement: 'Elbow Extension', muscle: '上腕三頭筋' },
  ],
  wrist: [
    { movement: 'Wrist Flexion', muscle: '手関節屈筋群' },
    { movement: 'Wrist Extension', muscle: '手関節伸筋群' },
  ],
  cervical: [
    { movement: 'Neck Flexion', muscle: '頚部屈筋群' },
    { movement: 'Neck Extension', muscle: '頚部伸筋群' },
  ],
  lumbar: [
    { movement: 'Trunk Flexion', muscle: '腹直筋' },
    { movement: 'Trunk Extension', muscle: '脊柱起立筋' },
    { movement: 'Side Plank time', muscle: '体幹側面（秒）' },
    { movement: 'Front Plank time', muscle: '体幹前面（秒）' },
  ],
  thoracic: [
    { movement: 'Trunk Rotation', muscle: '体幹回旋筋群' },
  ],
  other: [
    { movement: '筋力', muscle: '（部位を指定）' },
  ],
  functional: [],
}

const MMT_GRADES: MMTGrade[] = [0, 1, 2, 3, '4-', 4, '4+', '5-', 5]

interface FormState {
  measuredDate: string
  bodyRegion: BodyRegion
  muscleGroup: string
  movement: string
  side: 'right' | 'left' | 'bilateral' | 'na'
  mmt: MMTGrade | ''
  hhdValue: string
  unit: StrengthUnit
  bodyWeightRatio: string
  contralateralValue: string
  pain: boolean
  compensation: string
  testPosition: string
  memo: string
}

const defaultForm: FormState = {
  measuredDate: new Date().toISOString().split('T')[0],
  bodyRegion: 'knee',
  muscleGroup: '',
  movement: '',
  side: 'right',
  mmt: '',
  hhdValue: '',
  unit: 'kg',
  bodyWeightRatio: '',
  contralateralValue: '',
  pain: false,
  compensation: '',
  testPosition: '',
  memo: '',
}

interface Props {
  patientId: string
  onSaved?: () => void
}

export default function StrengthInputForm({ patientId, onSaved }: Props) {
  const [form, setForm] = useState<FormState>(defaultForm)
  const [saved, setSaved] = useState(false)

  const templates = STRENGTH_TEMPLATES[form.bodyRegion] ?? []

  function applyTemplate(t: typeof templates[0]) {
    setForm(prev => ({ ...prev, movement: t.movement, muscleGroup: t.muscle }))
  }

  function handleSave() {
    if (!form.movement) return alert('動作を入力してください')
    const record: StrengthRecord = {
      id: nanoid(),
      patientId,
      measuredDate: form.measuredDate,
      bodyRegion: form.bodyRegion,
      muscleGroup: form.muscleGroup,
      movement: form.movement,
      side: form.side,
      mmt: form.mmt !== '' ? form.mmt : null,
      hhdValue: form.hhdValue !== '' ? Number(form.hhdValue) : null,
      unit: form.unit,
      bodyWeightRatio: form.bodyWeightRatio !== '' ? Number(form.bodyWeightRatio) : null,
      contralateralRatio: form.contralateralValue !== '' ? Number(form.contralateralValue) : null,
      pain: form.pain,
      compensation: form.compensation,
      testPosition: form.testPosition,
      memo: form.memo,
      createdAt: new Date().toISOString(),
    }
    saveStrengthRecord(record)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
    onSaved?.()
    setForm(f => ({ ...f, mmt: '', hhdValue: '', pain: false, compensation: '', memo: '' }))
  }

  return (
    <Card>
      <CardHeader>
        <SectionTitle>筋力測定入力</SectionTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <FormLabel required>測定日</FormLabel>
            <Input type="date" value={form.measuredDate} onChange={v => setForm(f => ({ ...f, measuredDate: v }))} />
          </div>
          <div>
            <FormLabel required>部位</FormLabel>
            <select
              value={form.bodyRegion}
              onChange={e => setForm(f => ({ ...f, bodyRegion: e.target.value as BodyRegion, movement: '', muscleGroup: '' }))}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              {(Object.keys(BODY_REGION_LABELS) as BodyRegion[]).map(r => (
                <option key={r} value={r}>{BODY_REGION_LABELS[r]}</option>
              ))}
            </select>
          </div>
        </div>

        {/* テンプレート */}
        <div>
          <FormLabel>テンプレートから選択</FormLabel>
          <div className="flex flex-wrap gap-1.5 mt-1">
            {templates.map(t => (
              <button
                key={t.movement}
                type="button"
                onClick={() => applyTemplate(t)}
                className={`px-2.5 py-1 text-xs rounded-full border transition-colors ${
                  form.movement === t.movement
                    ? 'bg-teal-600 text-white border-teal-600'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-teal-300'
                }`}
              >
                {t.movement}
              </button>
            ))}
          </div>
        </div>

        {/* 動作・患側 */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <FormLabel required>動作</FormLabel>
            <Input value={form.movement} onChange={v => setForm(f => ({ ...f, movement: v }))} placeholder="例：Knee Extension" />
          </div>
          <div>
            <FormLabel>患側</FormLabel>
            <select
              value={form.side}
              onChange={e => setForm(f => ({ ...f, side: e.target.value as FormState['side'] }))}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              <option value="right">右</option>
              <option value="left">左</option>
              <option value="bilateral">両側</option>
              <option value="na">N/A</option>
            </select>
          </div>
        </div>

        {/* MMT */}
        <div>
          <FormLabel>MMT グレード</FormLabel>
          <div className="flex flex-wrap gap-2 mt-1">
            {MMT_GRADES.map(g => (
              <button
                key={String(g)}
                type="button"
                onClick={() => setForm(f => ({ ...f, mmt: g }))}
                className={`w-10 h-10 rounded-lg text-sm font-bold border transition-colors ${
                  form.mmt === g
                    ? 'bg-teal-600 text-white border-teal-600'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-teal-300'
                }`}
              >
                {String(g)}
              </button>
            ))}
          </div>
        </div>

        {/* HHD数値入力 */}
        <div className="grid grid-cols-3 gap-4">
          <div>
            <FormLabel>HHD数値</FormLabel>
            <Input type="number" value={form.hhdValue} onChange={v => setForm(f => ({ ...f, hhdValue: v }))} placeholder="数値" />
          </div>
          <div>
            <FormLabel>単位</FormLabel>
            <select
              value={form.unit}
              onChange={e => setForm(f => ({ ...f, unit: e.target.value as StrengthUnit }))}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              <option value="kg">kg</option>
              <option value="N">N</option>
              <option value="Nm">Nm</option>
              <option value="bw_ratio">体重比 (%)</option>
              <option value="contra_ratio">健側比 (%)</option>
            </select>
          </div>
          <div>
            <FormLabel>健側値</FormLabel>
            <Input type="number" value={form.contralateralValue} onChange={v => setForm(f => ({ ...f, contralateralValue: v }))} placeholder="健側数値" />
          </div>
        </div>

        {/* 痛み・代償 */}
        <div className="space-y-2">
          <ToggleSwitch label="測定時に痛みあり" value={form.pain} onChange={v => setForm(f => ({ ...f, pain: v }))} />
          <div>
            <FormLabel>代償動作</FormLabel>
            <Input value={form.compensation} onChange={v => setForm(f => ({ ...f, compensation: v }))} placeholder="例：体幹の回旋" />
          </div>
          <div>
            <FormLabel>測定姿勢</FormLabel>
            <Input value={form.testPosition} onChange={v => setForm(f => ({ ...f, testPosition: v }))} placeholder="例：背臥位・膝屈曲90度" />
          </div>
        </div>

        <div>
          <FormLabel>メモ</FormLabel>
          <Textarea value={form.memo} onChange={v => setForm(f => ({ ...f, memo: v }))} rows={2} placeholder="特記事項" />
        </div>

        <div className="flex items-center gap-3">
          <SaveButton onClick={handleSave} label="筋力記録を保存" />
          {saved && <span className="text-teal-600 text-sm">✓ 保存しました</span>}
        </div>
      </CardContent>
    </Card>
  )
}
