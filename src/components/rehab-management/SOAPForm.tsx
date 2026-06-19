'use client'
// ──────────────────────────────────────────────
// SOAPカルテ入力フォーム
// ──────────────────────────────────────────────
import { useState } from 'react'
import { nanoid } from 'nanoid'
import type { SOAPNote, RehabPhase, SOAPSpecialTest, SpecialTestResult } from '@/types/patient'
import { PHASE_SHORT_LABELS } from '@/types/patient'
import { saveSOAPNote, getSOAPNotes } from '@/lib/patient-store'
import {
  Card, CardHeader, CardContent, FormLabel, Input, Textarea,
  ToggleSwitch, SaveButton, SectionTitle, NRSInput,
} from './shared'
import BodyMap from './BodyMap'

interface Props {
  patientId: string
  onSaved?: () => void
}

interface FormState {
  visitDate: string
  painLocations: string[]
  painToday: number
  changeFromLast: string
  adlDifficulty: string
  homeExerciseAdherence: 'done' | 'partial' | 'not_done'
  patientConcern: string
  patientGoalToday: string
  romFindings: string
  strengthFindings: string
  specialTestFindings: string
  tenderness: string
  swelling: boolean
  heat: boolean
  gait: string
  singleLegStance: string
  squat: string
  treatmentAreas: string[]
  soapSpecialTests: SOAPSpecialTest[]
  therapistObservation: string
  improvements: string
  remainingIssues: string
  priorityIssue: string
  currentPhase: RehabPhase
  visitFrequencyAppropriate: boolean
  exerciseLoadAppropriate: boolean
  physicianReferralNeeded: boolean
  treatmentToday: string
  nextGoal: string
  homeExercise: string
  forbiddenMovements: string
  recommendedFrequency: string
  nextReassessment: string
}

// ── 関節別スペシャルテスト定義 ──────────────────────────────
const TESTS_BY_JOINT: Record<string, string[]> = {
  '膝関節': [
    'Lachman test', 'Anterior drawer test', 'Posterior drawer test',
    'Valgus stress test', 'Varus stress test',
    'McMurray test', 'Apley test', 'Thessaly test',
    'Patellar grind test (Clarke)', 'Patella apprehension test',
  ],
  '股関節': [
    'FABER test (Patrick)', 'FADIR test', 'Thomas test',
    'Ober test', 'Trendelenburg test', 'Hip scour test',
    'Anterior impingement test',
  ],
  '足関節': [
    'Anterior drawer test', 'Talar tilt test',
    'Thompson test', 'Squeeze test',
    'Kleiger test (外旋ストレス)', 'Ottawa ankle rules',
  ],
  '肩関節': [
    'Hawkins-Kennedy test', 'Neer test',
    'Empty can test (Jobe)', 'Drop arm test',
    'Speed test', 'Yergason test',
    'Apprehension test', 'Relocation test', 'Sulcus sign',
    "O'Brien test (SLAP)", 'Cross-arm test',
  ],
  '肘関節': [
    'Valgus stress test', "Cozen's test (外側上顆炎)",
    "Golfer's elbow test (内側上顆炎)",
    'Tinel sign（肘部管）', 'Varus stress test',
  ],
  '手関節・手指': [
    'Finkelstein test', 'Phalen test', 'Tinel sign（手根管）',
    'Watson test (舟状骨)', 'Grind test (第1CM関節)',
  ],
  '頚部': [
    'Spurling test', 'Distraction test',
    'Lhermitte sign', '椎骨動脈テスト', 'Adson test',
    'Upper limb tension test (ULTT)',
  ],
  '腰部': [
    'SLR test', 'SLUMP test', 'Kemp test',
    'Bragard test', '大腿神経伸張テスト', 'ASLR test',
    'Prone instability test',
  ],
}

const RESULT_LABELS: Record<SpecialTestResult, string> = {
  positive: '陽性(+)',
  negative: '陰性(−)',
  suspicious: '疑陽性(±)',
  unable: '実施不可',
}
const RESULT_COLORS: Record<SpecialTestResult, string> = {
  positive: 'bg-red-100 text-red-700 border-red-200',
  negative: 'bg-green-100 text-green-700 border-green-200',
  suspicious: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  unable: 'bg-gray-100 text-gray-500 border-gray-200',
}

// 関節別スペシャルテストピッカー
function SpecialTestPicker({
  value, onChange,
}: {
  value: SOAPSpecialTest[]
  onChange: (v: SOAPSpecialTest[]) => void
}) {
  const [joint, setJoint] = useState<string>(Object.keys(TESTS_BY_JOINT)[0])
  const joints = Object.keys(TESTS_BY_JOINT)

  function getEntry(j: string, t: string) {
    return value.find(v => v.joint === j && v.testName === t)
  }

  function toggle(testName: string) {
    const existing = getEntry(joint, testName)
    if (existing) {
      onChange(value.filter(v => !(v.joint === joint && v.testName === testName)))
    } else {
      onChange([...value, { joint, testName, result: 'negative' }])
    }
  }

  function setResult(testName: string, result: SpecialTestResult) {
    onChange(value.map(v =>
      v.joint === joint && v.testName === testName ? { ...v, result } : v
    ))
  }

  return (
    <div className="space-y-3">
      {/* 選択済みチップ */}
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map(v => (
            <span
              key={`${v.joint}-${v.testName}`}
              className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full border font-medium ${RESULT_COLORS[v.result]}`}
            >
              <span className="text-gray-400 font-normal">{v.joint.replace('関節', '').replace('・手指', '')}</span>
              {v.testName.replace(/ test| sign/i, '')}
              <span className="font-bold">{v.result === 'positive' ? '+' : v.result === 'negative' ? '−' : v.result === 'suspicious' ? '±' : '?'}</span>
              <button
                type="button"
                onClick={() => onChange(value.filter(x => !(x.joint === v.joint && x.testName === v.testName)))}
                className="ml-0.5 hover:text-red-500"
              >×</button>
            </span>
          ))}
        </div>
      )}

      {/* 関節タブ */}
      <div className="flex flex-wrap gap-1">
        {joints.map(j => {
          const count = value.filter(v => v.joint === j).length
          return (
            <button
              key={j}
              type="button"
              onClick={() => setJoint(j)}
              className={`px-2.5 py-1 text-xs rounded-lg border transition-colors relative ${
                joint === j
                  ? 'bg-teal-600 text-white border-teal-600'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-teal-300'
              }`}
            >
              {j}
              {count > 0 && (
                <span className={`ml-1 inline-flex items-center justify-center w-4 h-4 rounded-full text-[10px] font-bold ${
                  joint === j ? 'bg-white text-teal-700' : 'bg-teal-100 text-teal-700'
                }`}>{count}</span>
              )}
            </button>
          )
        })}
      </div>

      {/* テスト一覧 */}
      <div className="grid grid-cols-1 gap-1.5">
        {TESTS_BY_JOINT[joint].map(testName => {
          const entry = getEntry(joint, testName)
          const selected = !!entry
          return (
            <div
              key={testName}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs transition-colors ${
                selected
                  ? 'border-teal-300 bg-teal-50'
                  : 'border-gray-200 bg-white hover:border-teal-200'
              }`}
            >
              <button
                type="button"
                onClick={() => toggle(testName)}
                className={`w-4 h-4 rounded border-2 flex-shrink-0 transition-colors ${
                  selected ? 'bg-teal-600 border-teal-600' : 'border-gray-300'
                }`}
              >
                {selected && <span className="text-white text-[10px] leading-none flex items-center justify-center">✓</span>}
              </button>
              <span className={`flex-1 ${selected ? 'text-teal-800 font-medium' : 'text-gray-700'}`}>{testName}</span>
              {selected && (
                <div className="flex gap-1">
                  {(Object.keys(RESULT_LABELS) as SpecialTestResult[]).map(r => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setResult(testName, r)}
                      className={`px-2 py-0.5 rounded text-[11px] border transition-colors ${
                        entry.result === r
                          ? RESULT_COLORS[r]
                          : 'border-gray-200 text-gray-400 hover:border-gray-300'
                      }`}
                    >
                      {RESULT_LABELS[r]}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

const PHASES: RehabPhase[] = [1, 2, 3, 4, 5, 6]

const defaultForm: FormState = {
  visitDate: new Date().toISOString().split('T')[0],
  painLocations: [],
  painToday: 3,
  changeFromLast: '',
  adlDifficulty: '',
  homeExerciseAdherence: 'partial',
  patientConcern: '',
  patientGoalToday: '',
  romFindings: '',
  strengthFindings: '',
  specialTestFindings: '',
  tenderness: '',
  swelling: false,
  heat: false,
  gait: '',
  singleLegStance: '',
  squat: '',
  treatmentAreas: [],
  soapSpecialTests: [],
  therapistObservation: '',
  improvements: '',
  remainingIssues: '',
  priorityIssue: '',
  currentPhase: 3,
  visitFrequencyAppropriate: true,
  exerciseLoadAppropriate: true,
  physicianReferralNeeded: false,
  treatmentToday: '',
  nextGoal: '',
  homeExercise: '',
  forbiddenMovements: '',
  recommendedFrequency: '週2回',
  nextReassessment: '',
}

type TabKey = 'S' | 'O' | 'A' | 'P'

export default function SOAPForm({ patientId, onSaved }: Props) {
  const [form, setForm] = useState<FormState>(defaultForm)
  const [activeTab, setActiveTab] = useState<TabKey>('S')
  const [saved, setSaved] = useState(false)

  function handleSave() {
    const notes = getSOAPNotes(patientId)
    const note: SOAPNote = {
      id: nanoid(),
      patientId,
      visitDate: form.visitDate,
      visitNumber: notes.length + 1,
      painLocations: form.painLocations,
      painToday: form.painToday,
      changeFromLast: form.changeFromLast,
      adlDifficulty: form.adlDifficulty,
      homeExerciseAdherence: form.homeExerciseAdherence,
      patientConcern: form.patientConcern,
      patientGoalToday: form.patientGoalToday,
      romFindings: form.romFindings,
      strengthFindings: form.strengthFindings,
      specialTestFindings: form.specialTestFindings,
      tenderness: form.tenderness,
      swelling: form.swelling,
      heat: form.heat,
      gait: form.gait,
      singleLegStance: form.singleLegStance,
      squat: form.squat,
      treatmentAreas: form.treatmentAreas,
      soapSpecialTests: form.soapSpecialTests,
      therapistObservation: form.therapistObservation,
      improvements: form.improvements,
      remainingIssues: form.remainingIssues,
      priorityIssue: form.priorityIssue,
      currentPhase: form.currentPhase,
      visitFrequencyAppropriate: form.visitFrequencyAppropriate,
      exerciseLoadAppropriate: form.exerciseLoadAppropriate,
      physicianReferralNeeded: form.physicianReferralNeeded,
      treatmentToday: form.treatmentToday,
      nextGoal: form.nextGoal,
      homeExercise: form.homeExercise,
      forbiddenMovements: form.forbiddenMovements,
      recommendedFrequency: form.recommendedFrequency,
      nextReassessment: form.nextReassessment,
      createdAt: new Date().toISOString(),
    }
    saveSOAPNote(note)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
    onSaved?.()
  }

  const tabs: { key: TabKey; label: string; color: string }[] = [
    { key: 'S', label: 'S：主観', color: 'bg-blue-600' },
    { key: 'O', label: 'O：客観', color: 'bg-teal-600' },
    { key: 'A', label: 'A：評価', color: 'bg-purple-600' },
    { key: 'P', label: 'P：計画', color: 'bg-orange-600' },
  ]

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <SectionTitle>SOAPカルテ</SectionTitle>
          <div className="flex items-center gap-2">
            <Input
              type="date"
              value={form.visitDate}
              onChange={v => setForm(f => ({ ...f, visitDate: v }))}
              className="w-36 text-xs"
            />
          </div>
        </div>
        {/* タブ */}
        <div className="flex gap-1 mt-3">
          {tabs.map(tab => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                activeTab === tab.key
                  ? `${tab.color} text-white`
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* S: Subjective */}
        {activeTab === 'S' && (
          <div className="space-y-4">
            <div>
              <FormLabel>本日の痛み部位（人体図）</FormLabel>
              <div className="mt-1">
                <BodyMap
                  selected={form.painLocations}
                  onChange={v => setForm(f => ({ ...f, painLocations: v }))}
                />
              </div>
            </div>
            <NRSInput value={form.painToday} onChange={v => setForm(f => ({ ...f, painToday: v }))} label="本日の痛み強度（NRS）" />

            <div>
              <FormLabel>前回からの変化</FormLabel>
              <Textarea value={form.changeFromLast} onChange={v => setForm(f => ({ ...f, changeFromLast: v }))}
                placeholder="例：階段が少し楽になった。朝の痛みが減った。" rows={2} />
            </div>
            <div>
              <FormLabel>生活上困ったこと</FormLabel>
              <Textarea value={form.adlDifficulty} onChange={v => setForm(f => ({ ...f, adlDifficulty: v }))}
                placeholder="例：長時間の歩行が辛い" rows={2} />
            </div>

            <div>
              <FormLabel>自宅運動の実施状況</FormLabel>
              <div className="flex gap-3 mt-1">
                {(['done', 'partial', 'not_done'] as const).map((v, i) => (
                  <label key={v} className="flex items-center gap-1.5 cursor-pointer">
                    <input type="radio" value={v} checked={form.homeExerciseAdherence === v}
                      onChange={() => setForm(f => ({ ...f, homeExerciseAdherence: v }))}
                      className="accent-teal-600" />
                    <span className="text-sm">{['できた', '一部できた', 'できなかった'][i]}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <FormLabel>患者様の不安</FormLabel>
              <Textarea value={form.patientConcern} onChange={v => setForm(f => ({ ...f, patientConcern: v }))}
                placeholder="例：いつ治るか不安。仕事に戻れるか心配。" rows={2} />
            </div>
            <div>
              <FormLabel>今日の希望・目標</FormLabel>
              <Input value={form.patientGoalToday} onChange={v => setForm(f => ({ ...f, patientGoalToday: v }))}
                placeholder="例：階段を楽に降りたい" />
            </div>
          </div>
        )}

        {/* O: Objective */}
        {activeTab === 'O' && (
          <div className="space-y-4">
            <div>
              <FormLabel>施術部位（人体図）</FormLabel>
              <div className="mt-1">
                <BodyMap
                  selected={form.treatmentAreas}
                  onChange={v => setForm(f => ({ ...f, treatmentAreas: v }))}
                />
              </div>
            </div>
            <div>
              <FormLabel>ROM所見</FormLabel>
              <Textarea value={form.romFindings} onChange={v => setForm(f => ({ ...f, romFindings: v }))}
                placeholder="例：膝屈曲 右125度 / 左140度" rows={2} />
            </div>
            <div>
              <FormLabel>筋力所見</FormLabel>
              <Textarea value={form.strengthFindings} onChange={v => setForm(f => ({ ...f, strengthFindings: v }))}
                placeholder="例：大腿四頭筋 右MMT4、左5" rows={2} />
            </div>
            <div>
              <FormLabel>スペシャルテスト（関節別）</FormLabel>
              <div className="mt-1">
                <SpecialTestPicker
                  value={form.soapSpecialTests}
                  onChange={v => setForm(f => ({ ...f, soapSpecialTests: v }))}
                />
              </div>
            </div>
            <div>
              <FormLabel>スペシャルテスト補足メモ</FormLabel>
              <Textarea value={form.specialTestFindings} onChange={v => setForm(f => ({ ...f, specialTestFindings: v }))}
                placeholder="例：再現性低い、疼痛回避あり" rows={2} />
            </div>
            <div>
              <FormLabel>圧痛</FormLabel>
              <Input value={form.tenderness} onChange={v => setForm(f => ({ ...f, tenderness: v }))}
                placeholder="例：関節裂隙前内側（+）" />
            </div>
            <div className="flex gap-6">
              <ToggleSwitch label="腫脹あり" value={form.swelling} onChange={v => setForm(f => ({ ...f, swelling: v }))} />
              <ToggleSwitch label="熱感あり" value={form.heat} onChange={v => setForm(f => ({ ...f, heat: v }))} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <FormLabel>歩行所見</FormLabel>
                <Input value={form.gait} onChange={v => setForm(f => ({ ...f, gait: v }))} placeholder="例：右膝屈曲制限あり" />
              </div>
              <div>
                <FormLabel>片脚立位</FormLabel>
                <Input value={form.singleLegStance} onChange={v => setForm(f => ({ ...f, singleLegStance: v }))} placeholder="例：右10秒" />
              </div>
            </div>
            <div>
              <FormLabel>動作観察・施術者メモ</FormLabel>
              <Textarea value={form.therapistObservation} onChange={v => setForm(f => ({ ...f, therapistObservation: v }))}
                placeholder="例：スクワット時の膝valgusが改善傾向" rows={3} />
            </div>
          </div>
        )}

        {/* A: Assessment */}
        {activeTab === 'A' && (
          <div className="space-y-4">
            <div>
              <FormLabel>改善している点</FormLabel>
              <Textarea value={form.improvements} onChange={v => setForm(f => ({ ...f, improvements: v }))}
                placeholder="例：ROM改善、腫脹消退、痛みNRS減少" rows={2} />
            </div>
            <div>
              <FormLabel>残っている問題</FormLabel>
              <Textarea value={form.remainingIssues} onChange={v => setForm(f => ({ ...f, remainingIssues: v }))}
                placeholder="例：大腿四頭筋筋力低下、深屈曲制限" rows={2} />
            </div>
            <div>
              <FormLabel>優先課題</FormLabel>
              <Input value={form.priorityIssue} onChange={v => setForm(f => ({ ...f, priorityIssue: v }))}
                placeholder="例：筋力強化と動的安定性の向上" />
            </div>

            <div>
              <FormLabel required>現在フェーズ</FormLabel>
              <div className="flex flex-wrap gap-2 mt-1">
                {PHASES.map(p => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setForm(f => ({ ...f, currentPhase: p }))}
                    className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                      form.currentPhase === p
                        ? 'bg-teal-600 text-white border-teal-600'
                        : 'bg-white text-gray-600 border-gray-200 hover:border-teal-300'
                    }`}
                  >
                    Phase {p}: {PHASE_SHORT_LABELS[p]}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <ToggleSwitch label="通院頻度は妥当" value={form.visitFrequencyAppropriate}
                onChange={v => setForm(f => ({ ...f, visitFrequencyAppropriate: v }))} />
              <ToggleSwitch label="運動負荷は妥当" value={form.exerciseLoadAppropriate}
                onChange={v => setForm(f => ({ ...f, exerciseLoadAppropriate: v }))} />
              <ToggleSwitch label="医師相談が必要" value={form.physicianReferralNeeded}
                onChange={v => setForm(f => ({ ...f, physicianReferralNeeded: v }))} />
            </div>
          </div>
        )}

        {/* P: Plan */}
        {activeTab === 'P' && (
          <div className="space-y-4">
            <div>
              <FormLabel>本日の施術内容</FormLabel>
              <Textarea value={form.treatmentToday} onChange={v => setForm(f => ({ ...f, treatmentToday: v }))}
                placeholder="例：膝周囲ストレッチ、スクワット練習、階段降段練習" rows={2} />
            </div>
            <div>
              <FormLabel>次回までの目標</FormLabel>
              <Textarea value={form.nextGoal} onChange={v => setForm(f => ({ ...f, nextGoal: v }))}
                placeholder="例：片脚スクワット安定、階段降段の痛み軽減" rows={2} />
            </div>
            <div>
              <FormLabel>自宅運動</FormLabel>
              <Textarea value={form.homeExercise} onChange={v => setForm(f => ({ ...f, homeExercise: v }))}
                placeholder="例：スクワット15回×3セット、カーフレイズ20回×3セット" rows={2} />
            </div>
            <div>
              <FormLabel>禁止動作</FormLabel>
              <Input value={form.forbiddenMovements} onChange={v => setForm(f => ({ ...f, forbiddenMovements: v }))}
                placeholder="例：深屈曲（130度以上）" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <FormLabel>通院目安</FormLabel>
                <Input value={form.recommendedFrequency} onChange={v => setForm(f => ({ ...f, recommendedFrequency: v }))}
                  placeholder="例：週2回" />
              </div>
              <div>
                <FormLabel>再評価予定</FormLabel>
                <Input type="date" value={form.nextReassessment} onChange={v => setForm(f => ({ ...f, nextReassessment: v }))} />
              </div>
            </div>
          </div>
        )}

        {/* ナビゲーション + 保存 */}
        <div className="flex items-center justify-between pt-2 border-t border-gray-100">
          <div className="flex gap-2">
            {tabs.map((tab, i) => {
              const prev = tabs[i - 1]?.key
              const next = tabs[i + 1]?.key
              if (tab.key !== activeTab) return null
              return (
                <div key={tab.key} className="flex gap-2">
                  {prev && (
                    <button type="button" onClick={() => setActiveTab(prev)}
                      className="px-3 py-1.5 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">
                      ← 前へ
                    </button>
                  )}
                  {next && (
                    <button type="button" onClick={() => setActiveTab(next)}
                      className="px-3 py-1.5 text-sm text-teal-600 border border-teal-300 rounded-lg hover:bg-teal-50">
                      次へ →
                    </button>
                  )}
                </div>
              )
            })}
          </div>
          <div className="flex items-center gap-3">
            {saved && <span className="text-teal-600 text-sm">✓ 保存しました</span>}
            <SaveButton onClick={handleSave} label="カルテを保存" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
