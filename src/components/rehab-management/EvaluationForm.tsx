'use client'
// ──────────────────────────────────────────────
// 初回評価フォーム
// ──────────────────────────────────────────────
import { useState } from 'react'
import { nanoid } from 'nanoid'
import type { Evaluation } from '@/types/patient'
import { saveEvaluation } from '@/lib/patient-store'
import {
  Card, CardHeader, CardContent, FormLabel, Input, Textarea,
  ToggleSwitch, SaveButton, SectionTitle, NRSInput,
} from './shared'
import { RedFlagAlert } from './shared'

interface Props {
  patientId: string
  onSaved?: () => void
}

interface FormState {
  evaluationDate: string
  painNrs: number
  restPain: boolean
  nightPain: boolean
  weightBearingPain: boolean
  movementPain: boolean
  swelling: boolean
  heat: boolean
  numbness: boolean
  weakness: boolean
  injuryMechanism: string
  functionalLimitations: string
  adlDifficulties: string
  sportType: string
  returnToSportDate: string
  physicianConsult: boolean
  imaging: boolean
  contraindications: string
  redFlag_cauda: boolean
  redFlag_fracture: boolean
  redFlag_cancer: boolean
  redFlag_infection: boolean
  redFlag_vascular: boolean
  redFlag_neuro: boolean
  redFlag_other: string
  therapistNotes: string
}

const defaultForm: FormState = {
  evaluationDate: new Date().toISOString().split('T')[0],
  painNrs: 5,
  restPain: false,
  nightPain: false,
  weightBearingPain: false,
  movementPain: true,
  swelling: false,
  heat: false,
  numbness: false,
  weakness: false,
  injuryMechanism: '',
  functionalLimitations: '',
  adlDifficulties: '',
  sportType: '',
  returnToSportDate: '',
  physicianConsult: false,
  imaging: false,
  contraindications: '',
  redFlag_cauda: false,
  redFlag_fracture: false,
  redFlag_cancer: false,
  redFlag_infection: false,
  redFlag_vascular: false,
  redFlag_neuro: false,
  redFlag_other: '',
  therapistNotes: '',
}

export default function EvaluationForm({ patientId, onSaved }: Props) {
  const [form, setForm] = useState<FormState>(defaultForm)
  const [saved, setSaved] = useState(false)
  const [tab, setTab] = useState<'pain' | 'function' | 'redflag' | 'notes'>('pain')

  const hasRedFlag = form.redFlag_cauda || form.redFlag_fracture || form.redFlag_cancer ||
    form.redFlag_infection || form.redFlag_vascular || form.redFlag_neuro || form.redFlag_other !== ''

  function handleSave() {
    const evaluation: Evaluation = {
      id: nanoid(),
      patientId,
      evaluationDate: form.evaluationDate,
      painNrs: form.painNrs,
      restPain: form.restPain,
      nightPain: form.nightPain,
      weightBearingPain: form.weightBearingPain,
      movementPain: form.movementPain,
      swelling: form.swelling,
      heat: form.heat,
      numbness: form.numbness,
      weakness: form.weakness,
      injuryMechanism: form.injuryMechanism,
      functionalLimitations: form.functionalLimitations,
      adlDifficulties: form.adlDifficulties,
      sportType: form.sportType,
      returnToSportDate: form.returnToSportDate,
      physicianConsult: form.physicianConsult,
      imaging: form.imaging,
      contraindications: form.contraindications,
      redFlags: {
        cauda_equina: form.redFlag_cauda,
        fracture_risk: form.redFlag_fracture,
        cancer: form.redFlag_cancer,
        infection: form.redFlag_infection,
        vascular: form.redFlag_vascular,
        severe_neuro: form.redFlag_neuro,
        other: form.redFlag_other,
      },
      therapistNotes: form.therapistNotes,
      createdAt: new Date().toISOString(),
    }
    saveEvaluation(evaluation)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
    onSaved?.()
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <SectionTitle>初回評価</SectionTitle>
          <Input type="date" value={form.evaluationDate}
            onChange={v => setForm(f => ({ ...f, evaluationDate: v }))} className="w-36 text-xs" />
        </div>
        <div className="flex gap-1 mt-3">
          {(['pain', 'function', 'redflag', 'notes'] as const).map(t => (
            <button key={t} type="button" onClick={() => setTab(t)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                tab === t ? 'bg-teal-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}>
              {t === 'pain' ? '痛み・症状' : t === 'function' ? 'ADL・スポーツ' : t === 'redflag' ? 'レッドフラッグ' : '備考'}
            </button>
          ))}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {hasRedFlag && (
          <RedFlagAlert flags={{
            cauda_equina: form.redFlag_cauda,
            fracture_risk: form.redFlag_fracture,
            cancer: form.redFlag_cancer,
            infection: form.redFlag_infection,
            vascular: form.redFlag_vascular,
            severe_neuro: form.redFlag_neuro,
            other: form.redFlag_other,
          }} />
        )}

        {tab === 'pain' && (
          <div className="space-y-4">
            <NRSInput value={form.painNrs} onChange={v => setForm(f => ({ ...f, painNrs: v }))} />
            <div className="grid grid-cols-2 gap-3">
              <ToggleSwitch label="安静時痛" value={form.restPain} onChange={v => setForm(f => ({ ...f, restPain: v }))} />
              <ToggleSwitch label="夜間痛" value={form.nightPain} onChange={v => setForm(f => ({ ...f, nightPain: v }))} />
              <ToggleSwitch label="荷重痛" value={form.weightBearingPain} onChange={v => setForm(f => ({ ...f, weightBearingPain: v }))} />
              <ToggleSwitch label="動作時痛" value={form.movementPain} onChange={v => setForm(f => ({ ...f, movementPain: v }))} />
              <ToggleSwitch label="腫脹" value={form.swelling} onChange={v => setForm(f => ({ ...f, swelling: v }))} />
              <ToggleSwitch label="熱感" value={form.heat} onChange={v => setForm(f => ({ ...f, heat: v }))} />
              <ToggleSwitch label="しびれ" value={form.numbness} onChange={v => setForm(f => ({ ...f, numbness: v }))} />
              <ToggleSwitch label="脱力" value={form.weakness} onChange={v => setForm(f => ({ ...f, weakness: v }))} />
            </div>
            <div>
              <FormLabel>受傷機転</FormLabel>
              <Textarea value={form.injuryMechanism} onChange={v => setForm(f => ({ ...f, injuryMechanism: v }))}
                placeholder="例：術後3週経過。階段降段時に痛み増強。" rows={2} />
            </div>
            <div className="flex gap-6">
              <ToggleSwitch label="医師診察あり" value={form.physicianConsult} onChange={v => setForm(f => ({ ...f, physicianConsult: v }))} />
              <ToggleSwitch label="画像検査あり" value={form.imaging} onChange={v => setForm(f => ({ ...f, imaging: v }))} />
            </div>
            <div>
              <FormLabel>禁忌・注意事項</FormLabel>
              <Input value={form.contraindications} onChange={v => setForm(f => ({ ...f, contraindications: v }))}
                placeholder="例：深屈曲禁忌（主治医指示）" />
            </div>
          </div>
        )}

        {tab === 'function' && (
          <div className="space-y-4">
            <div>
              <FormLabel>日常生活で困る動作</FormLabel>
              <Textarea value={form.adlDifficulties} onChange={v => setForm(f => ({ ...f, adlDifficulties: v }))}
                placeholder="例：階段、正座、しゃがみ動作" rows={2} />
            </div>
            <div>
              <FormLabel>機能制限（詳細）</FormLabel>
              <Textarea value={form.functionalLimitations} onChange={v => setForm(f => ({ ...f, functionalLimitations: v }))}
                placeholder="例：長時間歩行困難、階段昇降困難" rows={2} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <FormLabel>スポーツ種目</FormLabel>
                <Input value={form.sportType} onChange={v => setForm(f => ({ ...f, sportType: v }))}
                  placeholder="例：バスケットボール" />
              </div>
              <div>
                <FormLabel>競技復帰希望日</FormLabel>
                <Input type="date" value={form.returnToSportDate} onChange={v => setForm(f => ({ ...f, returnToSportDate: v }))} />
              </div>
            </div>
          </div>
        )}

        {tab === 'redflag' && (
          <div className="space-y-4">
            <p className="text-xs text-gray-500 bg-yellow-50 border border-yellow-200 rounded-lg p-3">
              以下は診断ではありません。医療機関への受診を検討するためのスクリーニングです。
            </p>
            <div className="grid grid-cols-2 gap-3">
              <ToggleSwitch label="馬尾症状（排泄障害）" value={form.redFlag_cauda} onChange={v => setForm(f => ({ ...f, redFlag_cauda: v }))} />
              <ToggleSwitch label="骨折リスク（骨粗鬆症等）" value={form.redFlag_fracture} onChange={v => setForm(f => ({ ...f, redFlag_fracture: v }))} />
              <ToggleSwitch label="悪性腫瘍の既往" value={form.redFlag_cancer} onChange={v => setForm(f => ({ ...f, redFlag_cancer: v }))} />
              <ToggleSwitch label="感染兆候（発熱・炎症）" value={form.redFlag_infection} onChange={v => setForm(f => ({ ...f, redFlag_infection: v }))} />
              <ToggleSwitch label="血管系の問題" value={form.redFlag_vascular} onChange={v => setForm(f => ({ ...f, redFlag_vascular: v }))} />
              <ToggleSwitch label="重篤な神経症状" value={form.redFlag_neuro} onChange={v => setForm(f => ({ ...f, redFlag_neuro: v }))} />
            </div>
            <div>
              <FormLabel>その他のレッドフラッグ</FormLabel>
              <Input value={form.redFlag_other} onChange={v => setForm(f => ({ ...f, redFlag_other: v }))}
                placeholder="その他の注意事項" />
            </div>
          </div>
        )}

        {tab === 'notes' && (
          <div>
            <FormLabel>施術者メモ</FormLabel>
            <Textarea value={form.therapistNotes} onChange={v => setForm(f => ({ ...f, therapistNotes: v }))}
              placeholder="詳細所見・特記事項" rows={6} />
          </div>
        )}

        <div className="flex items-center justify-end gap-3 pt-2 border-t border-gray-100">
          {saved && <span className="text-teal-600 text-sm">✓ 保存しました</span>}
          <SaveButton onClick={handleSave} label="評価を保存" />
        </div>
      </CardContent>
    </Card>
  )
}
