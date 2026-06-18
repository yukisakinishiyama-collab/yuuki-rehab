'use client'
// ──────────────────────────────────────────────
// SOAPカルテ入力フォーム
// ──────────────────────────────────────────────
import { useState } from 'react'
import { nanoid } from 'nanoid'
import type { SOAPNote, RehabPhase } from '@/types/patient'
import { PHASE_SHORT_LABELS } from '@/types/patient'
import { saveSOAPNote, getSOAPNotes } from '@/lib/patient-store'
import {
  Card, CardHeader, CardContent, FormLabel, Input, Textarea,
  ToggleSwitch, SaveButton, SectionTitle, NRSInput,
} from './shared'

interface Props {
  patientId: string
  onSaved?: () => void
}

interface FormState {
  visitDate: string
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

const PHASES: RehabPhase[] = [1, 2, 3, 4, 5, 6]

const defaultForm: FormState = {
  visitDate: new Date().toISOString().split('T')[0],
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
            <NRSInput value={form.painToday} onChange={v => setForm(f => ({ ...f, painToday: v }))} label="本日の痛み（NRS）" />

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
              <FormLabel>スペシャルテスト所見</FormLabel>
              <Textarea value={form.specialTestFindings} onChange={v => setForm(f => ({ ...f, specialTestFindings: v }))}
                placeholder="例：Lachman test 陰性、McMurray test 陰性" rows={2} />
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
