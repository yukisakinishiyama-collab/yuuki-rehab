'use client'
// ──────────────────────────────────────────────
// 問診票フォーム（多段タブ構成）
// ──────────────────────────────────────────────
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { nanoid } from 'nanoid'
import type { Intake } from '@/types/patient'
import { saveIntake } from '@/lib/patient-store'
import {
  Card, CardHeader, CardContent, FormLabel, Input, Textarea,
  ToggleSwitch, SectionTitle, NRSInput,
} from './shared'
import BodyMap from './BodyMap'
import JointDetailMap, { SUPPORTED_JOINTS } from './JointDetailMap'

interface Props {
  patientId: string
  onSaved?: () => void
}

interface FormState {
  intakeDate: string
  isNewInjury: boolean
  chiefComplaint: string
  injuryDate: string
  injuryMechanism: string
  firstTimeSymptoм: boolean
  previousSameInjury: boolean
  previousTreatment: string
  painLocations: string[]
  jointDetailLocations: Record<string, string[]>
  painNrs: number
  painCharacter: string[]
  painTiming: string[]
  worseFactor: string
  betterFactor: string
  adlDifficulty: string[]
  occupation: string
  sportsActivity: string
  importantGoal: string
  pastMedicalHistory: string
  currentMedications: string
  imagingResults: string
  suspectedDiagnosis: string
  therapistNotes: string
}

const defaultForm: FormState = {
  intakeDate: new Date().toISOString().split('T')[0],
  isNewInjury: false,
  chiefComplaint: '',
  injuryDate: '',
  injuryMechanism: '',
  firstTimeSymptoм: true,
  previousSameInjury: false,
  previousTreatment: '',
  painLocations: [],
  jointDetailLocations: {},
  painNrs: 5,
  painCharacter: [],
  painTiming: [],
  worseFactor: '',
  betterFactor: '',
  adlDifficulty: [],
  occupation: '',
  sportsActivity: '',
  importantGoal: '',
  pastMedicalHistory: '',
  currentMedications: '',
  imagingResults: '',
  suspectedDiagnosis: '',
  therapistNotes: '',
}

// 痛み部位IDから関節名へのマッピング
const BODY_REGION_TO_JOINT: Record<string, string> = {
  fkl: '膝関節', fkr: '膝関節', bkl: '膝関節', bkr: '膝関節',
  fsl: '肩関節', fsr: '肩関節', bsl: '肩関節', bsr: '肩関節',
  fhil: '股関節', fhir: '股関節', bgl: '股関節', bgr: '股関節',
  fal: '足関節', far: '足関節', bhal: '足関節', bher: '足関節',
  fab: '腰部', blb: '腰部',
  fn: '頚部', bn: '頚部',
  fel: '肘関節', fer: '肘関節', bel: '肘関節', ber: '肘関節',
  fhdl: '手関節・手指', fhdr: '手関節・手指',
}

// 選択された痛み部位から対応する関節名のセットを取得
function getJointsFromPainLocations(locations: string[]): string[] {
  const joints = new Set<string>()
  for (const loc of locations) {
    const joint = BODY_REGION_TO_JOINT[loc]
    if (joint && SUPPORTED_JOINTS.includes(joint)) {
      joints.add(joint)
    }
  }
  return Array.from(joints)
}

// チェックボックスグループコンポーネント
function CheckboxGroup({
  options,
  selected,
  onChange,
}: {
  options: string[]
  selected: string[]
  onChange: (values: string[]) => void
}) {
  function toggle(val: string) {
    if (selected.includes(val)) {
      onChange(selected.filter(v => v !== val))
    } else {
      onChange([...selected, val])
    }
  }
  return (
    <div className="flex flex-wrap gap-2">
      {options.map(opt => (
        <button
          key={opt}
          type="button"
          onClick={() => toggle(opt)}
          className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
            selected.includes(opt)
              ? 'bg-teal-600 text-white border-teal-600'
              : 'bg-white text-gray-600 border-gray-200 hover:border-teal-400'
          }`}
        >
          {opt}
        </button>
      ))}
    </div>
  )
}

// AIの鑑別診断結果の型
interface Differential {
  diagnosis: string
  likelihood: string
  reason: string
}

// AI分析結果の型
interface AIResult {
  suggestedTests?: string[]
  differentials?: Differential[]
  protocol?: string
  reasoning?: string
  redFlags?: string[]
  priorityAssessment?: string
}

type TabKey = 'basic' | 'pain_location' | 'detail' | 'life' | 'ai'

// 関節名（日本語）→ Protocol Joint キーのマッピング
const JOINT_NAME_TO_KEY: Record<string, string> = {
  '膝関節': 'knee', '肩関節': 'shoulder', '股関節': 'hip',
  '足関節': 'ankle', '肘関節': 'elbow', '手関節・手指': 'hand',
  '腰部': 'spine', '頚部': 'spine',
}

interface ProtocolPrefill {
  diagnosis: string
  joint: string
  sport: string
  eventDate: string
  notes: string
}

export default function IntakeForm({ patientId, onSaved }: Props) {
  const router = useRouter()
  const [form, setForm] = useState<FormState>(defaultForm)
  const [tab, setTab] = useState<TabKey>('basic')
  const [saved, setSaved] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [aiResult, setAiResult] = useState<AIResult | null>(null)
  const [aiError, setAiError] = useState<string | null>(null)
  const [protocolPrefill, setProtocolPrefill] = useState<ProtocolPrefill | null>(null)

  const TABS: { key: TabKey; label: string }[] = [
    { key: 'basic', label: '基本情報' },
    { key: 'pain_location', label: '痛み部位' },
    { key: 'detail', label: '詳細' },
    { key: 'life', label: '生活情報' },
    { key: 'ai', label: 'AI分析' },
  ]

  // 選択済みの痛み部位から表示すべき関節を算出
  const selectedJoints = getJointsFromPainLocations(form.painLocations)

  // 関節別詳細部位を更新
  function handleJointDetailChange(joint: string, regions: string[]) {
    setForm(f => ({
      ...f,
      jointDetailLocations: {
        ...f.jointDetailLocations,
        [joint]: regions,
      },
    }))
  }

  // AI分析を実行
  async function handleAnalyze() {
    setAnalyzing(true)
    setAiError(null)
    try {
      const res = await fetch('/api/intake-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ intake: form }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setAiResult(data.result)
    } catch (e) {
      setAiError(e instanceof Error ? e.message : 'AI分析に失敗しました')
    } finally {
      setAnalyzing(false)
    }
  }

  // 保存処理
  function handleSave() {
    const intake: Intake = {
      id: nanoid(),
      patientId,
      intakeDate: form.intakeDate,
      isNewInjury: form.isNewInjury,
      chiefComplaint: form.chiefComplaint,
      injuryDate: form.injuryDate,
      injuryMechanism: form.injuryMechanism,
      firstTimeSymptoм: form.firstTimeSymptoм,
      previousSameInjury: form.previousSameInjury,
      previousTreatment: form.previousTreatment,
      painLocations: form.painLocations,
      jointDetailLocations: form.jointDetailLocations,
      painNrs: form.painNrs,
      painCharacter: form.painCharacter,
      painTiming: form.painTiming,
      worseFactor: form.worseFactor,
      betterFactor: form.betterFactor,
      adlDifficulty: form.adlDifficulty,
      occupation: form.occupation,
      sportsActivity: form.sportsActivity,
      importantGoal: form.importantGoal,
      pastMedicalHistory: form.pastMedicalHistory,
      currentMedications: form.currentMedications,
      imagingResults: form.imagingResults,
      suspectedDiagnosis: form.suspectedDiagnosis,
      therapistNotes: form.therapistNotes,
      // AI分析結果
      aiSuggestedTests: aiResult?.suggestedTests,
      aiDifferentials: aiResult?.differentials?.map(d => `${d.diagnosis}（${d.likelihood}）`),
      aiProtocol: aiResult?.protocol,
      aiReasoning: aiResult?.reasoning,
      createdAt: new Date().toISOString(),
    }
    saveIntake(intake)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)

    // プロトコル作成用の転記データを保存
    const joints = getJointsFromPainLocations(form.painLocations)
    const firstJoint = joints[0] ? (JOINT_NAME_TO_KEY[joints[0]] ?? 'other') : ''
    const notesParts: string[] = []
    if (form.chiefComplaint) notesParts.push(form.chiefComplaint)
    if (form.importantGoal) notesParts.push(`目標: ${form.importantGoal}`)
    if (form.therapistNotes) notesParts.push(`施術者メモ: ${form.therapistNotes}`)
    setProtocolPrefill({
      diagnosis: form.suspectedDiagnosis,
      joint: firstJoint,
      sport: form.sportsActivity,
      eventDate: form.injuryDate,
      notes: notesParts.join('\n'),
    })

    setForm(defaultForm)
    setAiResult(null)
    onSaved?.()
  }

  // プロトコル作成ページへ問診データを転記して遷移
  function handleGoToProtocol() {
    if (!protocolPrefill) return
    const params = new URLSearchParams()
    if (protocolPrefill.diagnosis) params.set('diagnosis', protocolPrefill.diagnosis)
    if (protocolPrefill.joint) params.set('joint', protocolPrefill.joint)
    if (protocolPrefill.sport) params.set('sport', protocolPrefill.sport)
    if (protocolPrefill.eventDate) params.set('eventDate', protocolPrefill.eventDate)
    if (protocolPrefill.notes) params.set('notes', protocolPrefill.notes)
    router.push(`/protocols/new?${params.toString()}`)
  }

  return (
    <>
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <SectionTitle>新規問診票</SectionTitle>
          <input
            type="date"
            value={form.intakeDate}
            onChange={e => setForm(f => ({ ...f, intakeDate: e.target.value }))}
            className="border border-gray-200 rounded-lg px-3 py-1 text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-teal-400"
          />
        </div>

        {/* タブバー */}
        <div className="flex gap-1 mt-3 flex-wrap">
          {TABS.map(t => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                tab === t.key
                  ? 'bg-teal-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">

        {/* ── Tab 1: 基本情報 ── */}
        {tab === 'basic' && (
          <div className="space-y-4">
            <ToggleSwitch
              label="既存患者の新しいけが"
              value={form.isNewInjury}
              onChange={v => setForm(f => ({ ...f, isNewInjury: v }))}
            />

            <div>
              <FormLabel required>主訴</FormLabel>
              <Textarea
                value={form.chiefComplaint}
                onChange={v => setForm(f => ({ ...f, chiefComplaint: v }))}
                placeholder="例：膝の内側が痛く、歩くのがつらい"
                rows={2}
              />
            </div>

            <div>
              <FormLabel>受傷日</FormLabel>
              <input
                type="date"
                value={form.injuryDate}
                onChange={e => setForm(f => ({ ...f, injuryDate: e.target.value }))}
                className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-teal-400"
              />
            </div>

            <div>
              <FormLabel>受傷機転</FormLabel>
              <Textarea
                value={form.injuryMechanism}
                onChange={v => setForm(f => ({ ...f, injuryMechanism: v }))}
                placeholder="例：バスケットボールで着地した際に膝を捻った"
                rows={2}
              />
            </div>

            <div>
              <FormLabel>初発・再発</FormLabel>
              <div className="flex gap-3">
                {[
                  { value: true, label: '初発' },
                  { value: false, label: '再発' },
                ].map(opt => (
                  <button
                    key={String(opt.value)}
                    type="button"
                    onClick={() => setForm(f => ({ ...f, firstTimeSymptoм: opt.value }))}
                    className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                      form.firstTimeSymptoм === opt.value
                        ? 'bg-teal-600 text-white border-teal-600'
                        : 'bg-white text-gray-600 border-gray-200 hover:border-teal-400'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <ToggleSwitch
              label="以前に同じ症状があった"
              value={form.previousSameInjury}
              onChange={v => setForm(f => ({ ...f, previousSameInjury: v }))}
            />

            {form.previousSameInjury && (
              <div>
                <FormLabel>以前の治療内容</FormLabel>
                <Input
                  value={form.previousTreatment}
                  onChange={v => setForm(f => ({ ...f, previousTreatment: v }))}
                  placeholder="例：〇〇病院で湿布と安静指示"
                />
              </div>
            )}
          </div>
        )}

        {/* ── Tab 2: 痛み部位 ── */}
        {tab === 'pain_location' && (
          <div className="space-y-6">
            <div>
              <FormLabel>全体の痛み部位（人体図）</FormLabel>
              <BodyMap
                selected={form.painLocations}
                onChange={locs => setForm(f => ({ ...f, painLocations: locs }))}
              />
            </div>

            {/* 選択された部位に対応する関節詳細マップ */}
            {selectedJoints.length > 0 && (
              <div className="space-y-4">
                <p className="text-xs font-semibold text-gray-600 border-t border-gray-100 pt-3">
                  関節別詳細部位
                </p>
                {selectedJoints.map(joint => (
                  <JointDetailMap
                    key={joint}
                    joint={joint}
                    selected={form.jointDetailLocations[joint] ?? []}
                    onChange={regions => handleJointDetailChange(joint, regions)}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Tab 3: 詳細（痛みの性状） ── */}
        {tab === 'detail' && (
          <div className="space-y-4">
            <NRSInput
              value={form.painNrs}
              onChange={v => setForm(f => ({ ...f, painNrs: v }))}
            />

            <div>
              <FormLabel>痛みの性状</FormLabel>
              <CheckboxGroup
                options={['鈍痛', '鋭痛', 'ズキズキ', '灼熱感', 'しびれ', '重だるい', '引っ張られる感じ']}
                selected={form.painCharacter}
                onChange={v => setForm(f => ({ ...f, painCharacter: v }))}
              />
            </div>

            <div>
              <FormLabel>痛みのタイミング</FormLabel>
              <CheckboxGroup
                options={['安静時', '動作時', '動作後', '朝方', '夜間']}
                selected={form.painTiming}
                onChange={v => setForm(f => ({ ...f, painTiming: v }))}
              />
            </div>

            <div>
              <FormLabel>悪化因子</FormLabel>
              <Input
                value={form.worseFactor}
                onChange={v => setForm(f => ({ ...f, worseFactor: v }))}
                placeholder="例：長時間歩行、階段下り"
              />
            </div>

            <div>
              <FormLabel>軽快因子</FormLabel>
              <Input
                value={form.betterFactor}
                onChange={v => setForm(f => ({ ...f, betterFactor: v }))}
                placeholder="例：安静にすると楽になる"
              />
            </div>
          </div>
        )}

        {/* ── Tab 4: 生活情報 ── */}
        {tab === 'life' && (
          <div className="space-y-4">
            <div>
              <FormLabel>職業</FormLabel>
              <Input
                value={form.occupation}
                onChange={v => setForm(f => ({ ...f, occupation: v }))}
                placeholder="例：デスクワーク、立ち仕事、主婦"
              />
            </div>

            <div>
              <FormLabel>スポーツ・運動習慣</FormLabel>
              <Input
                value={form.sportsActivity}
                onChange={v => setForm(f => ({ ...f, sportsActivity: v }))}
                placeholder="例：週2回バスケットボール"
              />
            </div>

            <div>
              <FormLabel>生活上の困難</FormLabel>
              <CheckboxGroup
                options={['歩行', '階段昇降', '正座', 'しゃがみ動作', '上肢挙上', '荷物を持つ', '立ち仕事', 'デスクワーク']}
                selected={form.adlDifficulty}
                onChange={v => setForm(f => ({ ...f, adlDifficulty: v }))}
              />
            </div>

            <div>
              <FormLabel>最も取り戻したい動作・活動</FormLabel>
              <Input
                value={form.importantGoal}
                onChange={v => setForm(f => ({ ...f, importantGoal: v }))}
                placeholder="例：子どもと公園で走り回りたい"
              />
            </div>

            <div>
              <FormLabel>既往歴・過去の手術</FormLabel>
              <Textarea
                value={form.pastMedicalHistory}
                onChange={v => setForm(f => ({ ...f, pastMedicalHistory: v }))}
                placeholder="例：5年前に右膝前十字靭帯再建術"
                rows={2}
              />
            </div>

            <div>
              <FormLabel>現在の服薬</FormLabel>
              <Input
                value={form.currentMedications}
                onChange={v => setForm(f => ({ ...f, currentMedications: v }))}
                placeholder="例：ロキソニン（頓服）"
              />
            </div>

            <div>
              <FormLabel>画像所見（レントゲン・MRIなど）</FormLabel>
              <Input
                value={form.imagingResults}
                onChange={v => setForm(f => ({ ...f, imagingResults: v }))}
                placeholder="例：MRI：内側半月板後節に変性"
              />
            </div>

            <div>
              <FormLabel>疑い診断（施術者入力）</FormLabel>
              <Input
                value={form.suspectedDiagnosis}
                onChange={v => setForm(f => ({ ...f, suspectedDiagnosis: v }))}
                placeholder="例：内側半月板損傷疑い"
              />
            </div>

            <div>
              <FormLabel>施術者メモ</FormLabel>
              <Textarea
                value={form.therapistNotes}
                onChange={v => setForm(f => ({ ...f, therapistNotes: v }))}
                placeholder="気になる点や観察事項"
                rows={2}
              />
            </div>
          </div>
        )}

        {/* ── Tab 5: AI分析 ── */}
        {tab === 'ai' && (
          <div className="space-y-4">
            {/* 分析実行ボタン */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleAnalyze}
                disabled={analyzing || !form.chiefComplaint}
                className="px-5 py-2 bg-teal-600 text-white text-sm font-medium rounded-lg hover:bg-teal-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
              >
                {analyzing && (
                  <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                )}
                {analyzing ? 'AI分析中...' : '🤖 AI分析を実行'}
              </button>
              {!form.chiefComplaint && (
                <p className="text-xs text-gray-400">「基本情報」タブで主訴を入力してください</p>
              )}
            </div>

            {/* エラー表示 */}
            {aiError && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                <p className="text-sm text-red-700">⚠️ {aiError}</p>
              </div>
            )}

            {/* AI分析結果 */}
            {aiResult && (
              <div className="space-y-4">
                {/* 優先評価ポイント */}
                {aiResult.priorityAssessment && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                    <p className="text-xs font-semibold text-amber-700 mb-1">⚡ 優先評価ポイント</p>
                    <p className="text-sm text-amber-800">{aiResult.priorityAssessment}</p>
                  </div>
                )}

                {/* 推奨スペシャルテスト */}
                {aiResult.suggestedTests && aiResult.suggestedTests.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-gray-700 mb-2">🔍 推奨スペシャルテスト</p>
                    <div className="flex flex-wrap gap-2">
                      {aiResult.suggestedTests.map((test, i) => (
                        <span
                          key={i}
                          className="px-2.5 py-1 text-xs rounded-full bg-teal-50 text-teal-700 border border-teal-200 font-medium"
                        >
                          {test}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* 鑑別診断 */}
                {aiResult.differentials && aiResult.differentials.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-gray-700 mb-2">📋 鑑別診断</p>
                    <div className="space-y-2">
                      {aiResult.differentials.map((d, i) => (
                        <div key={i} className="bg-white border border-gray-100 rounded-lg p-3">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm font-medium text-gray-800">{d.diagnosis}</span>
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                              d.likelihood === '高'
                                ? 'bg-red-100 text-red-700'
                                : d.likelihood === '中'
                                ? 'bg-yellow-100 text-yellow-700'
                                : 'bg-gray-100 text-gray-600'
                            }`}>
                              可能性: {d.likelihood}
                            </span>
                          </div>
                          <p className="text-xs text-gray-500">{d.reason}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* レッドフラッグ */}
                {aiResult.redFlags && aiResult.redFlags.length > 0 && (
                  <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                    <p className="text-xs font-semibold text-red-700 mb-2">🚨 注意所見・レッドフラッグ</p>
                    <ul className="space-y-1">
                      {aiResult.redFlags.map((flag, i) => (
                        <li key={i} className="text-sm text-red-700">• {flag}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* 推奨プロトコル */}
                {aiResult.protocol && (
                  <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                    <p className="text-xs font-semibold text-green-700 mb-2">📅 推奨プロトコル</p>
                    <p className="text-sm text-green-800 whitespace-pre-wrap">{aiResult.protocol}</p>
                  </div>
                )}

                {/* AI推論根拠 */}
                {aiResult.reasoning && (
                  <div className="bg-gray-50 rounded-xl p-4">
                    <p className="text-xs font-semibold text-gray-600 mb-1">💭 AI推論根拠</p>
                    <p className="text-xs text-gray-500 whitespace-pre-wrap">{aiResult.reasoning}</p>
                  </div>
                )}
              </div>
            )}

            {/* 保存ボタン */}
            <div className="pt-2 border-t border-gray-100 flex items-center justify-between">
              {saved && <span className="text-teal-600 text-sm">✓ 保存しました</span>}
              {!saved && <span />}
              <button
                type="button"
                onClick={handleSave}
                disabled={!form.chiefComplaint}
                className="px-5 py-2 bg-teal-600 text-white text-sm font-medium rounded-lg hover:bg-teal-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                💾 問診票を保存
              </button>
            </div>
          </div>
        )}

        {/* 保存ボタン（AI分析タブ以外） */}
        {tab !== 'ai' && (
          <div className="pt-2 border-t border-gray-100 flex items-center justify-between">
            <button
              type="button"
              onClick={() => {
                const keys: TabKey[] = ['basic', 'pain_location', 'detail', 'life', 'ai']
                const idx = keys.indexOf(tab)
                if (idx < keys.length - 1) setTab(keys[idx + 1])
              }}
              className="text-sm text-teal-600 hover:text-teal-800 font-medium"
            >
              次へ →
            </button>
            <div className="flex items-center gap-3">
              {saved && <span className="text-teal-600 text-sm">✓ 保存しました</span>}
              <button
                type="button"
                onClick={handleSave}
                disabled={!form.chiefComplaint}
                className="px-5 py-2 bg-teal-600 text-white text-sm font-medium rounded-lg hover:bg-teal-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                保存
              </button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>

    {/* 問診票保存後: プロトコル作成への誘導バナー */}
    {protocolPrefill && (
      <div className="mt-3 bg-teal-50 border border-teal-200 rounded-xl px-4 py-3 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-teal-800">問診票を保存しました</p>
          <p className="text-xs text-teal-600 mt-0.5 truncate">
            この情報をもとにリハビリプロトコルを作成できます
          </p>
        </div>
        <button
          type="button"
          onClick={handleGoToProtocol}
          className="flex-shrink-0 px-4 py-2 bg-teal-600 text-white text-sm font-medium rounded-lg hover:bg-teal-700 transition-colors flex items-center gap-1.5 whitespace-nowrap"
        >
          プロトコル作成 →
        </button>
      </div>
    )}
    </>
  )
}
