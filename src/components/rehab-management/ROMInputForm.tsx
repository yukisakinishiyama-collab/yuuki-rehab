'use client'
// ──────────────────────────────────────────────
// ROM入力フォーム（全関節テンプレート対応）
// ──────────────────────────────────────────────
import { useState } from 'react'
import { nanoid } from 'nanoid'
import type { ROMRecord, BodyRegion } from '@/types/patient'
import { BODY_REGION_LABELS } from '@/types/patient'
import { saveROMRecord } from '@/lib/patient-store'
import { Card, CardHeader, CardContent, FormLabel, Input, Textarea, ToggleSwitch, SaveButton, SectionTitle } from './shared'

// ── 部位別テンプレート ──
const ROM_TEMPLATES: Record<BodyRegion, { movement: string; normal: number; unit: 'deg' | 'cm' }[]> = {
  hip: [
    { movement: 'Flexion', normal: 125, unit: 'deg' },
    { movement: 'Extension', normal: 15, unit: 'deg' },
    { movement: 'Abduction', normal: 45, unit: 'deg' },
    { movement: 'Adduction', normal: 20, unit: 'deg' },
    { movement: 'Internal Rotation', normal: 45, unit: 'deg' },
    { movement: 'External Rotation', normal: 45, unit: 'deg' },
    { movement: 'FABER距離', normal: 0, unit: 'cm' },
    { movement: 'Thomas test角度', normal: 0, unit: 'deg' },
    { movement: 'SLR角度', normal: 80, unit: 'deg' },
  ],
  knee: [
    { movement: 'Flexion', normal: 135, unit: 'deg' },
    { movement: 'Extension', normal: 0, unit: 'deg' },
    { movement: 'Heel height difference', normal: 0, unit: 'cm' },
    { movement: 'Extension lag', normal: 0, unit: 'deg' },
    { movement: 'Patellar mobility', normal: 1, unit: 'cm' },
  ],
  ankle: [
    { movement: 'Dorsiflexion (knee extended)', normal: 20, unit: 'deg' },
    { movement: 'Dorsiflexion (knee flexed)', normal: 30, unit: 'deg' },
    { movement: 'Plantarflexion', normal: 45, unit: 'deg' },
    { movement: 'Inversion', normal: 35, unit: 'deg' },
    { movement: 'Eversion', normal: 15, unit: 'deg' },
    { movement: 'Weight Bearing Lunge Test', normal: 12, unit: 'cm' },
  ],
  shoulder: [
    { movement: 'Flexion', normal: 180, unit: 'deg' },
    { movement: 'Abduction', normal: 180, unit: 'deg' },
    { movement: 'External Rotation 1st', normal: 60, unit: 'deg' },
    { movement: 'External Rotation 2nd', normal: 90, unit: 'deg' },
    { movement: 'Internal Rotation', normal: 70, unit: 'deg' },
    { movement: 'Horizontal Adduction', normal: 130, unit: 'deg' },
    { movement: 'Hand Behind Back', normal: 0, unit: 'cm' },
    { movement: 'Hand Behind Neck', normal: 0, unit: 'cm' },
  ],
  elbow: [
    { movement: 'Elbow Flexion', normal: 145, unit: 'deg' },
    { movement: 'Elbow Extension', normal: 0, unit: 'deg' },
    { movement: 'Pronation', normal: 80, unit: 'deg' },
    { movement: 'Supination', normal: 80, unit: 'deg' },
    { movement: 'Wrist Flexion', normal: 80, unit: 'deg' },
    { movement: 'Wrist Extension', normal: 70, unit: 'deg' },
    { movement: 'Radial Deviation', normal: 20, unit: 'deg' },
    { movement: 'Ulnar Deviation', normal: 30, unit: 'deg' },
  ],
  wrist: [
    { movement: 'Wrist Flexion', normal: 80, unit: 'deg' },
    { movement: 'Wrist Extension', normal: 70, unit: 'deg' },
    { movement: 'Radial Deviation', normal: 20, unit: 'deg' },
    { movement: 'Ulnar Deviation', normal: 30, unit: 'deg' },
  ],
  cervical: [
    { movement: 'Flexion', normal: 45, unit: 'deg' },
    { movement: 'Extension', normal: 45, unit: 'deg' },
    { movement: 'Rotation Right', normal: 60, unit: 'deg' },
    { movement: 'Rotation Left', normal: 60, unit: 'deg' },
    { movement: 'Lateral Flexion Right', normal: 45, unit: 'deg' },
    { movement: 'Lateral Flexion Left', normal: 45, unit: 'deg' },
  ],
  lumbar: [
    { movement: 'Flexion', normal: 80, unit: 'deg' },
    { movement: 'Extension', normal: 25, unit: 'deg' },
    { movement: 'Rotation Right', normal: 30, unit: 'deg' },
    { movement: 'Rotation Left', normal: 30, unit: 'deg' },
    { movement: 'Side Bend Right', normal: 40, unit: 'deg' },
    { movement: 'Side Bend Left', normal: 40, unit: 'deg' },
    { movement: 'Finger Floor Distance', normal: 0, unit: 'cm' },
  ],
  thoracic: [
    { movement: 'Rotation Right', normal: 35, unit: 'deg' },
    { movement: 'Rotation Left', normal: 35, unit: 'deg' },
  ],
  other: [
    { movement: '屈曲', normal: 90, unit: 'deg' },
    { movement: '伸展', normal: 0, unit: 'deg' },
  ],
}

interface Props {
  patientId: string
  onSaved?: () => void
}

type FormState = {
  measuredDate: string
  bodyRegion: BodyRegion
  joint: string
  movement: string
  side: 'right' | 'left' | 'bilateral' | 'na'
  activeRom: string
  passiveRom: string
  normalValue: string
  unit: 'deg' | 'cm'
  pain: boolean
  painLocation: string
  endFeel: string
  limitationFactor: string
  memo: string
}

const defaultForm: FormState = {
  measuredDate: new Date().toISOString().split('T')[0],
  bodyRegion: 'knee',
  joint: '',
  movement: '',
  side: 'right',
  activeRom: '',
  passiveRom: '',
  normalValue: '',
  unit: 'deg',
  pain: false,
  painLocation: '',
  endFeel: '',
  limitationFactor: '',
  memo: '',
}

export default function ROMInputForm({ patientId, onSaved }: Props) {
  const [form, setForm] = useState<FormState>(defaultForm)
  const [saved, setSaved] = useState(false)

  const templates = ROM_TEMPLATES[form.bodyRegion] ?? []

  function applyTemplate(t: typeof templates[0]) {
    setForm(prev => ({
      ...prev,
      movement: t.movement,
      normalValue: String(t.normal),
      unit: t.unit,
    }))
  }

  function handleSave() {
    if (!form.movement) return alert('動作を入力してください')
    const record: ROMRecord = {
      id: nanoid(),
      patientId,
      measuredDate: form.measuredDate,
      bodyRegion: form.bodyRegion,
      joint: form.joint,
      movement: form.movement,
      side: form.side,
      activeRom: form.activeRom !== '' ? Number(form.activeRom) : null,
      passiveRom: form.passiveRom !== '' ? Number(form.passiveRom) : null,
      normalValue: Number(form.normalValue) || 90,
      unit: form.unit,
      pain: form.pain,
      painLocation: form.painLocation,
      endFeel: form.endFeel as ROMRecord['endFeel'],
      limitationFactor: form.limitationFactor,
      memo: form.memo,
      createdAt: new Date().toISOString(),
    }
    saveROMRecord(record)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
    onSaved?.()
    setForm(f => ({ ...f, movement: '', activeRom: '', passiveRom: '', pain: false, painLocation: '', endFeel: '', memo: '' }))
  }

  return (
    <Card>
      <CardHeader>
        <SectionTitle>ROM測定入力</SectionTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 測定日 */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <FormLabel required>測定日</FormLabel>
            <Input type="date" value={form.measuredDate} onChange={v => setForm(f => ({ ...f, measuredDate: v }))} />
          </div>
          <div>
            <FormLabel required>部位</FormLabel>
            <select
              value={form.bodyRegion}
              onChange={e => setForm(f => ({ ...f, bodyRegion: e.target.value as BodyRegion, movement: '' }))}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              {(Object.keys(BODY_REGION_LABELS) as BodyRegion[]).map(r => (
                <option key={r} value={r}>{BODY_REGION_LABELS[r]}</option>
              ))}
            </select>
          </div>
        </div>

        {/* テンプレートボタン */}
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
            <FormLabel required>動作（手入力可）</FormLabel>
            <Input value={form.movement} onChange={v => setForm(f => ({ ...f, movement: v }))} placeholder="例：Flexion" />
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

        {/* 測定値 */}
        <div className="grid grid-cols-3 gap-4">
          <div>
            <FormLabel>自動ROM</FormLabel>
            <Input
              type="number" value={form.activeRom}
              onChange={v => setForm(f => ({ ...f, activeRom: v }))}
              placeholder="度"
              className=""
            />
          </div>
          <div>
            <FormLabel>他動ROM</FormLabel>
            <Input
              type="number" value={form.passiveRom}
              onChange={v => setForm(f => ({ ...f, passiveRom: v }))}
              placeholder="度"
              className=""
            />
          </div>
          <div>
            <FormLabel>正常値</FormLabel>
            <Input
              type="number" value={form.normalValue}
              onChange={v => setForm(f => ({ ...f, normalValue: v }))}
              placeholder="度"
              className=""
            />
          </div>
        </div>

        {/* 単位 */}
        <div>
          <FormLabel>単位</FormLabel>
          <div className="flex gap-4">
            {(['deg', 'cm'] as const).map(u => (
              <label key={u} className="flex items-center gap-1.5 cursor-pointer">
                <input type="radio" value={u} checked={form.unit === u}
                  onChange={() => setForm(f => ({ ...f, unit: u }))}
                  className="accent-teal-600" />
                <span className="text-sm">{u === 'deg' ? '度（°）' : 'センチ（cm）'}</span>
              </label>
            ))}
          </div>
        </div>

        {/* 終末感 */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <FormLabel>終末感（End Feel）</FormLabel>
            <select
              value={form.endFeel}
              onChange={e => setForm(f => ({ ...f, endFeel: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              <option value="">未選択</option>
              <option value="bony">Bony（骨性）</option>
              <option value="soft">Soft（軟部組織）</option>
              <option value="firm">Firm（筋・靭帯）</option>
              <option value="springy">Springy（弾力性）</option>
              <option value="empty">Empty（痛みで制限）</option>
              <option value="spasm">Spasm（筋スパズム）</option>
            </select>
          </div>
          <div>
            <FormLabel>制限因子</FormLabel>
            <Input value={form.limitationFactor} onChange={v => setForm(f => ({ ...f, limitationFactor: v }))} placeholder="例：筋タイトネス" />
          </div>
        </div>

        {/* 痛み */}
        <div className="space-y-2">
          <ToggleSwitch label="測定時に痛みあり" value={form.pain} onChange={v => setForm(f => ({ ...f, pain: v }))} />
          {form.pain && (
            <Input value={form.painLocation} onChange={v => setForm(f => ({ ...f, painLocation: v }))} placeholder="痛みの部位・性状" />
          )}
        </div>

        {/* メモ */}
        <div>
          <FormLabel>メモ</FormLabel>
          <Textarea value={form.memo} onChange={v => setForm(f => ({ ...f, memo: v }))} placeholder="特記事項" rows={2} />
        </div>

        <div className="flex items-center gap-3">
          <SaveButton onClick={handleSave} label="ROM記録を保存" />
          {saved && <span className="text-teal-600 text-sm">✓ 保存しました</span>}
        </div>
      </CardContent>
    </Card>
  )
}
