'use client'
// ──────────────────────────────────────────────
// スペシャルテスト入力フォーム
// ──────────────────────────────────────────────
import { useState } from 'react'
import { nanoid } from 'nanoid'
import type { SpecialTestRecord, BodyRegion, SpecialTestResult } from '@/types/patient'
import { BODY_REGION_LABELS } from '@/types/patient'
import { saveSpecialTest } from '@/lib/patient-store'
import { Card, CardHeader, CardContent, FormLabel, Input, Textarea, ToggleSwitch, SaveButton, SectionTitle } from './shared'

const SPECIAL_TEST_TEMPLATES: Record<BodyRegion, string[]> = {
  hip: [
    'FADIR test', 'FABER test (Patrick)', 'Prone External Rotation Test',
    'Hip Dial test', 'Log Roll test', 'Scour test', 'Stinchfield test',
    'Thomas test', 'Ober test', 'Trendelenburg test',
    'Apprehension test', 'HEER test', 'ER-HEER test',
    'Anterior impingement test', 'Hip scour test',
  ],
  knee: [
    'Lachman test', 'Anterior Drawer test', 'Pivot Shift test',
    'Posterior Drawer test', 'Valgus Stress test', 'Varus Stress test',
    'McMurray test', 'Thessaly test', 'Patellar Apprehension test',
    'Clarke test', 'Step Down test',
  ],
  ankle: [
    'Anterior Drawer test', 'Talar Tilt test', 'Kleiger test',
    'Squeeze test', 'Thompson test', 'Windlass test',
    'Single Leg Heel Raise test', 'Weight Bearing Lunge Test',
    'Star Excursion Balance Test', 'Hop test',
  ],
  shoulder: [
    'Neer test', 'Hawkins-Kennedy test', 'Empty Can test',
    'Full Can test', 'Drop Arm test', 'Lift Off test',
    'Belly Press test', 'Bear Hug test', 'Apprehension test',
    'Relocation test', "O'Brien test", 'Speed test', 'Yergason test',
    'Cross Body Adduction test',
  ],
  lumbar: [
    'SLR test', 'Slump test', 'Kemp test',
    'Femoral Nerve Stretch test', 'Patrick test',
    'SIJ compression test', 'SIJ distraction test', 'Sacral thrust test',
  ],
  cervical: [
    'Spurling test', 'Distraction test', 'ULTT',
    'Roos test', 'Adson test', 'Wright test',
  ],
  elbow: ['Valgus Stress test', 'Moving Valgus Stress test', 'Cozen test', 'Mills test'],
  wrist: ['Watson test', 'Finkelstein test', 'Grind test'],
  thoracic: ['Spring test', 'Passive Intervertebral Motion test'],
  functional: [
    'Single Leg Hop Test（片脚ホップ距離）',
    'Triple Hop Test（トリプルホップ距離）',
    'Crossover Hop Test（クロスオーバーホップ）',
    '6m Timed Hop Test（タイムドホップ）',
    'Y-Balance Test（前方・後内側・後外側）',
    'Star Excursion Balance Test（SEBT）',
    'Drop Jump Screening Test（RSI測定）',
    'Jump-Landing Quality Assessment（LESS）',
    'Single Leg Squat Test（片脚スクワット評価）',
    'Step Down Test（段差降り評価）',
    'Single Leg Press Test（片脚プレス）',
    'Single Leg Bridge Endurance Test',
    'Side Step Test（サイドステップ）',
    'Agility T-Test',
    'Illinois Agility Test',
    'Change of Direction Test（切り返し動作）',
    '10m Sprint Test',
    '20m Sprint Test',
    'Running Gait Analysis（走行動作評価）',
    'Cutting Maneuver Test（カッティング動作）',
    'Deceleration Test（減速動作評価）',
  ],
  other: [],
}

const RESULT_LABELS: Record<SpecialTestResult, string> = {
  positive: '陽性',
  negative: '陰性',
  suspicious: '疑陽性',
  unable: '実施不可',
}

const RESULT_STYLES: Record<SpecialTestResult, string> = {
  positive: 'bg-red-500 text-white',
  negative: 'bg-green-500 text-white',
  suspicious: 'bg-yellow-400 text-white',
  unable: 'bg-gray-300 text-gray-700',
}

interface FormState {
  measuredDate: string
  bodyRegion: BodyRegion
  testName: string
  rightResult: SpecialTestResult
  leftResult: SpecialTestResult
  result: SpecialTestResult
  painLocation: string
  apprehension: boolean
  clickSound: boolean
  limitation: boolean
  memo: string
  patientFriendlyExplanation: string
  faberDistanceRight: string
  faberDistanceLeft: string
}

const defaultForm: FormState = {
  measuredDate: new Date().toISOString().split('T')[0],
  bodyRegion: 'knee',
  testName: '',
  rightResult: 'negative',
  leftResult: 'negative',
  result: 'negative',
  painLocation: '',
  apprehension: false,
  clickSound: false,
  limitation: false,
  memo: '',
  patientFriendlyExplanation: '',
  faberDistanceRight: '',
  faberDistanceLeft: '',
}

interface Props {
  patientId: string
  onSaved?: () => void
}

export default function SpecialTestInputForm({ patientId, onSaved }: Props) {
  const [form, setForm] = useState<FormState>(defaultForm)
  const [saved, setSaved] = useState(false)

  const templates = SPECIAL_TEST_TEMPLATES[form.bodyRegion] ?? []
  const isFaber = form.testName === 'FABER test (Patrick)'

  function handleSave() {
    if (!form.testName) return alert('テスト名を入力してください')
    const record: SpecialTestRecord = {
      id: nanoid(),
      patientId,
      measuredDate: form.measuredDate,
      bodyRegion: form.bodyRegion,
      testName: form.testName,
      rightResult: form.rightResult,
      leftResult: form.leftResult,
      result: form.result,
      painLocation: form.painLocation,
      apprehension: form.apprehension,
      clickSound: form.clickSound,
      limitation: form.limitation,
      memo: form.memo,
      patientFriendlyExplanation: form.patientFriendlyExplanation,
      ...(isFaber && {
        faberDistanceRight: form.faberDistanceRight !== '' ? Number(form.faberDistanceRight) : undefined,
        faberDistanceLeft: form.faberDistanceLeft !== '' ? Number(form.faberDistanceLeft) : undefined,
      }),
      createdAt: new Date().toISOString(),
    }
    saveSpecialTest(record)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
    onSaved?.()
    setForm(f => ({ ...f, testName: '', rightResult: 'negative', leftResult: 'negative', result: 'negative', painLocation: '', memo: '', patientFriendlyExplanation: '', faberDistanceRight: '', faberDistanceLeft: '' }))
  }

  return (
    <Card>
      <CardHeader>
        <SectionTitle>スペシャルテスト入力</SectionTitle>
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
              onChange={e => setForm(f => ({ ...f, bodyRegion: e.target.value as BodyRegion, testName: '' }))}
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
                key={t}
                type="button"
                onClick={() => setForm(f => ({ ...f, testName: t }))}
                className={`px-2.5 py-1 text-xs rounded-full border transition-colors ${
                  form.testName === t
                    ? 'bg-teal-600 text-white border-teal-600'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-teal-300'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        <div>
          <FormLabel required>テスト名（手入力可）</FormLabel>
          <Input value={form.testName} onChange={v => setForm(f => ({ ...f, testName: v }))} placeholder="例：Lachman test" />
        </div>

        {/* 右・左・総合結果 */}
        <div className="grid grid-cols-3 gap-4">
          {(['rightResult', 'leftResult', 'result'] as const).map((key, i) => (
            <div key={key}>
              <FormLabel>{['右側', '左側', '総合'][i]}</FormLabel>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {(Object.keys(RESULT_LABELS) as SpecialTestResult[]).map(r => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setForm(f => ({ ...f, [key]: r }))}
                    className={`px-2 py-0.5 text-xs rounded-full transition-colors ${
                      form[key] === r
                        ? RESULT_STYLES[r]
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {RESULT_LABELS[r]}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        {isFaber && (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <FormLabel>床から脛骨粗面（右）</FormLabel>
              <div className="relative">
                <Input
                  type="number"
                  value={form.faberDistanceRight}
                  onChange={v => setForm(f => ({ ...f, faberDistanceRight: v }))}
                  placeholder="例：15"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">cm</span>
              </div>
            </div>
            <div>
              <FormLabel>床から脛骨粗面（左）</FormLabel>
              <div className="relative">
                <Input
                  type="number"
                  value={form.faberDistanceLeft}
                  onChange={v => setForm(f => ({ ...f, faberDistanceLeft: v }))}
                  placeholder="例：18"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">cm</span>
              </div>
            </div>
          </div>
        )}

        <div>
          <FormLabel>痛みの部位</FormLabel>
          <Input value={form.painLocation} onChange={v => setForm(f => ({ ...f, painLocation: v }))} placeholder="例：前外側、関節裂隙" />
        </div>

        {/* フラグ */}
        <div className="grid grid-cols-3 gap-4">
          <ToggleSwitch label="不安感あり" value={form.apprehension} onChange={v => setForm(f => ({ ...f, apprehension: v }))} />
          <ToggleSwitch label="クリック音" value={form.clickSound} onChange={v => setForm(f => ({ ...f, clickSound: v }))} />
          <ToggleSwitch label="可動域制限" value={form.limitation} onChange={v => setForm(f => ({ ...f, limitation: v }))} />
        </div>

        <div>
          <FormLabel>施術者メモ</FormLabel>
          <Textarea value={form.memo} onChange={v => setForm(f => ({ ...f, memo: v }))} rows={2} placeholder="詳細所見" />
        </div>

        <div>
          <FormLabel>患者様向け説明</FormLabel>
          <Textarea
            value={form.patientFriendlyExplanation}
            onChange={v => setForm(f => ({ ...f, patientFriendlyExplanation: v }))}
            rows={2}
            placeholder="例：股関節を深く曲げた時に痛みが出やすい状態です。今はその動きを無理に繰り返さず、痛みを増やさない範囲で整えていきます"
          />
          <p className="text-xs text-gray-400 mt-1">※ 診断名の断定は避け、やさしい言葉で説明してください</p>
        </div>

        <div className="flex items-center gap-3">
          <SaveButton onClick={handleSave} label="テスト結果を保存" />
          {saved && <span className="text-teal-600 text-sm">✓ 保存しました</span>}
        </div>
      </CardContent>
    </Card>
  )
}
