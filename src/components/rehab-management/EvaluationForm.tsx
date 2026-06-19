'use client'
// ──────────────────────────────────────────────
// 初回評価フォーム（人体図・慢性痛対応）
// ──────────────────────────────────────────────
import { useState } from 'react'
import { nanoid } from 'nanoid'
import type { Evaluation, PainDuration } from '@/types/patient'
import { PAIN_DURATION_LABELS } from '@/types/patient'
import { saveEvaluation } from '@/lib/patient-store'
import {
  Card, CardHeader, CardContent, FormLabel, Input, Textarea,
  ToggleSwitch, SaveButton, SectionTitle, NRSInput,
} from './shared'
import { RedFlagAlert } from './shared'
import BodyMap from './BodyMap'

interface Props {
  patientId: string
  onSaved?: () => void
}

interface FormState {
  evaluationDate: string
  painLocations: string[]
  painDuration: PainDuration
  painNrs: number
  restPain: boolean
  nightPain: boolean
  weightBearingPain: boolean
  movementPain: boolean
  // 慢性痛スクリーニング
  spreadingPain: boolean
  centralSensitization: boolean
  sleepDisturbance: boolean
  fatigueNrs: number
  catastrophizing: boolean
  kinesophobia: boolean
  // 症状
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
  painLocations: [],
  painDuration: 'acute',
  painNrs: 5,
  restPain: false,
  nightPain: false,
  weightBearingPain: false,
  movementPain: true,
  spreadingPain: false,
  centralSensitization: false,
  sleepDisturbance: false,
  fatigueNrs: 0,
  catastrophizing: false,
  kinesophobia: false,
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
  const [tab, setTab] = useState<'pain' | 'chronic' | 'function' | 'redflag' | 'notes'>('pain')

  const hasRedFlag = form.redFlag_cauda || form.redFlag_fracture || form.redFlag_cancer ||
    form.redFlag_infection || form.redFlag_vascular || form.redFlag_neuro || form.redFlag_other !== ''

  function handleSave() {
    const evaluation: Evaluation = {
      id: nanoid(),
      patientId,
      evaluationDate: form.evaluationDate,
      painLocations: form.painLocations,
      painDuration: form.painDuration,
      painNrs: form.painNrs,
      restPain: form.restPain,
      nightPain: form.nightPain,
      weightBearingPain: form.weightBearingPain,
      movementPain: form.movementPain,
      spreadingPain: form.spreadingPain,
      centralSensitization: form.centralSensitization,
      sleepDisturbance: form.sleepDisturbance,
      fatigueNrs: form.fatigueNrs,
      catastrophizing: form.catastrophizing,
      kinesophobia: form.kinesophobia,
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

  const isChronicPain = form.painDuration === 'chronic'

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <SectionTitle>初回評価</SectionTitle>
          <Input type="date" value={form.evaluationDate}
            onChange={v => setForm(f => ({ ...f, evaluationDate: v }))} className="w-36 text-xs" />
        </div>
        <div className="flex gap-1 mt-3 flex-wrap">
          {(['pain', 'chronic', 'function', 'redflag', 'notes'] as const).map(t => (
            <button key={t} type="button" onClick={() => setTab(t as typeof tab)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                tab === t ? 'bg-teal-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}>
              {t === 'pain' ? '痛み・症状' : t === 'chronic' ? '慢性痛スクリーニング' : t === 'function' ? 'ADL・スポーツ' : t === 'redflag' ? 'レッドフラッグ' : '備考'}
              {t === 'chronic' && isChronicPain && <span className="ml-1 bg-orange-400 text-white rounded-full px-1 text-[9px]">!</span>}
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
          <div className="space-y-5">
            {/* 人体図 */}
            <div>
              <FormLabel>痛みの部位（人体図）</FormLabel>
              <BodyMap
                selected={form.painLocations}
                onChange={locs => setForm(f => ({ ...f, painLocations: locs }))}
              />
            </div>

            {/* 痛みの経過 */}
            <div>
              <FormLabel>痛みの経過</FormLabel>
              <div className="flex gap-2 flex-wrap">
                {(Object.entries(PAIN_DURATION_LABELS) as [PainDuration, string][]).map(([k, label]) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setForm(f => ({ ...f, painDuration: k }))}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                      form.painDuration === k
                        ? k === 'chronic'
                          ? 'bg-orange-500 text-white border-orange-500'
                          : 'bg-teal-600 text-white border-teal-600'
                        : 'bg-white text-gray-600 border-gray-200 hover:border-teal-400'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {isChronicPain && (
                <p className="mt-1.5 text-xs text-orange-600 bg-orange-50 border border-orange-200 rounded-lg px-3 py-2">
                  慢性痛が疑われます。「慢性痛スクリーニング」タブで詳細を確認してください。
                </p>
              )}
            </div>

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
              <FormLabel>受傷機転・発症のきっかけ</FormLabel>
              <Textarea value={form.injuryMechanism} onChange={v => setForm(f => ({ ...f, injuryMechanism: v }))}
                placeholder="例：術後3週経過。階段降段時に痛み増強。／慢性の場合：明確なきっかけなし、じわじわ増悪" rows={2} />
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

        {(tab as string) === 'chronic' && (
          <div className="space-y-4">
            <div className={`text-xs rounded-xl p-3 border ${isChronicPain ? 'bg-orange-50 border-orange-200 text-orange-800' : 'bg-gray-50 border-gray-200 text-gray-500'}`}>
              {isChronicPain
                ? '⚠️ 慢性痛（3ヶ月以上）が疑われます。中枢感作・心理社会的因子を確認してください。'
                : '痛みの経過で「慢性（3ヶ月以上）」を選択すると、このスクリーニングが特に重要になります。'}
            </div>

            <SectionTitle>中枢感作スクリーニング</SectionTitle>
            <div className="grid grid-cols-2 gap-3">
              <ToggleSwitch
                label="痛みが広がっている"
                value={form.spreadingPain}
                onChange={v => setForm(f => ({ ...f, spreadingPain: v }))}
              />
              <ToggleSwitch
                label="軽い刺激で強く痛む"
                value={form.centralSensitization}
                onChange={v => setForm(f => ({ ...f, centralSensitization: v }))}
              />
              <ToggleSwitch
                label="痛みで眠れない"
                value={form.sleepDisturbance}
                onChange={v => setForm(f => ({ ...f, sleepDisturbance: v }))}
              />
              <ToggleSwitch
                label="強い疲労感がある"
                value={false}
                onChange={() => {}}
              />
            </div>

            <div>
              <FormLabel>疲労感（NRS 0〜10）</FormLabel>
              <NRSInput value={form.fatigueNrs} onChange={v => setForm(f => ({ ...f, fatigueNrs: v }))} />
            </div>

            <SectionTitle>心理社会的因子</SectionTitle>
            <div className="grid grid-cols-2 gap-3">
              <ToggleSwitch
                label="「絶対に治らない」と感じている（破局化）"
                value={form.catastrophizing}
                onChange={v => setForm(f => ({ ...f, catastrophizing: v }))}
              />
              <ToggleSwitch
                label="動くのが怖い（運動恐怖）"
                value={form.kinesophobia}
                onChange={v => setForm(f => ({ ...f, kinesophobia: v }))}
              />
            </div>

            {(form.catastrophizing || form.kinesophobia || form.centralSensitization) && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-800 space-y-1">
                <p className="font-bold">📋 アドバイス</p>
                {form.catastrophizing && <p>• 破局化思考あり → 段階的な目標設定と成功体験の積み重ねが重要</p>}
                {form.kinesophobia && <p>• 運動恐怖あり → 「痛み＝傷害」でないことの説明と漸進的暴露療法を検討</p>}
                {form.centralSensitization && <p>• 中枢感作の可能性 → 通常の組織治癒モデルでなく、神経系の過敏性として説明</p>}
              </div>
            )}
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
