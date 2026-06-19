'use client'
// ──────────────────────────────────────────────
// 患者詳細ページ（タブ構成）
// ──────────────────────────────────────────────
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import type {
  Patient, Evaluation, ROMRecord, StrengthRecord,
  SpecialTestRecord, SOAPNote, Exercise, PatientExercise, ProgressRecord, RehabPlan,
} from '@/types/patient'
import { BODY_REGION_LABELS, PHASE_LABELS, PHASE_SHORT_LABELS } from '@/types/patient'
import BodyMap from './BodyMap'
import {
  getEvaluations, getROMRecords, getStrengthRecords, getSpecialTests,
  getSOAPNotes, getExercises, getPatientExercises, savePatientExercise,
  deletePatientExercise, getProgressRecords, getRehabPlans,
} from '@/lib/patient-store'
import {
  calculateImprovementScore, calculateROMImprovement,
  calculateRetentionRisk, getDaysSinceLastVisit, generatePatientFriendlyMessage,
} from '@/lib/rehab-algorithms'
import { ProgressGauge, PhaseStepper, RetentionRiskBadge, Badge, Card, CardHeader, CardContent, SectionTitle } from './shared'
import { PainChart, ImprovementChart, ROMChart, StrengthChart, SpecialTestSummary, AdherenceChart } from './charts'
import EvaluationForm from './EvaluationForm'
import ROMInputForm from './ROMInputForm'
import StrengthInputForm from './StrengthInputForm'
import SpecialTestInputForm from './SpecialTestInputForm'
import SOAPForm from './SOAPForm'
import ExerciseCard from './ExerciseCard'
import PatientExplanationSheet from './PatientExplanationSheet'
import { nanoid } from 'nanoid'

// ── SOAPカルテ展開カード ────────────────────────────────────
function SOAPNoteCard({ note }: { note: SOAPNote }) {
  const [open, setOpen] = useState(false)
  const nrsColor = note.painToday >= 7 ? 'text-red-600' : note.painToday >= 4 ? 'text-yellow-600' : 'text-green-600'
  const adherenceLabel = note.homeExerciseAdherence === 'done' ? '✅ 実施' : note.homeExerciseAdherence === 'partial' ? '⚠️ 一部' : '❌ 未実施'

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden bg-white shadow-sm">
      {/* ヘッダー行（クリックで展開） */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left"
      >
        {/* 回数バッジ */}
        <span className="w-7 h-7 rounded-full bg-teal-50 border border-teal-200 text-teal-700 text-xs font-bold flex items-center justify-center flex-shrink-0">
          {note.visitNumber}
        </span>

        {/* 日付 */}
        <span className="text-sm font-medium text-gray-700 w-24 flex-shrink-0">{note.visitDate}</span>

        {/* NRS */}
        <span className={`text-sm font-bold ${nrsColor} w-14 flex-shrink-0`}>NRS {note.painToday}</span>

        {/* Phase */}
        <span className="text-xs bg-teal-50 border border-teal-200 text-teal-700 rounded-full px-2 py-0.5 flex-shrink-0">
          Phase {note.currentPhase}
        </span>

        {/* 自宅運動 */}
        <span className="text-xs text-gray-500 flex-shrink-0 hidden sm:block">{adherenceLabel}</span>

        {/* 改善点プレビュー */}
        {note.improvements && (
          <span className="text-xs text-gray-400 truncate flex-1 hidden md:block">
            ✓ {note.improvements}
          </span>
        )}

        {/* 開閉矢印 */}
        <span className={`ml-auto text-gray-400 text-xs transition-transform duration-200 ${open ? 'rotate-180' : ''}`}>
          ▼
        </span>
      </button>

      {/* 展開コンテンツ */}
      {open && (
        <div className="border-t border-gray-100 px-4 py-4 space-y-4 bg-gray-50/50">

          {/* S: 主観的情報 */}
          <section>
            <div className="flex items-center gap-1.5 mb-2">
              <span className="w-5 h-5 rounded-full bg-blue-500 text-white text-[10px] font-bold flex items-center justify-center">S</span>
              <span className="text-xs font-semibold text-blue-700">主観的情報（患者の訴え）</span>
            </div>
            {note.painLocations && note.painLocations.length > 0 && (
              <div className="mb-3">
                <p className="text-xs text-gray-500 font-medium mb-1">この日の痛み部位</p>
                <BodyMap selected={note.painLocations} onChange={() => {}} readOnly />
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              {note.changeFromLast && <Row label="前回からの変化" value={note.changeFromLast} />}
              {note.adlDifficulty && <Row label="日常生活の困り事" value={note.adlDifficulty} />}
              {note.patientConcern && <Row label="患者の不安" value={note.patientConcern} />}
              {note.patientGoalToday && <Row label="本日の目標" value={note.patientGoalToday} />}
              <Row label="自宅運動" value={adherenceLabel} />
            </div>
          </section>

          {/* O: 客観的情報 */}
          <section>
            <div className="flex items-center gap-1.5 mb-2">
              <span className="w-5 h-5 rounded-full bg-green-500 text-white text-[10px] font-bold flex items-center justify-center">O</span>
              <span className="text-xs font-semibold text-green-700">客観的情報（検査・観察）</span>
            </div>
            {note.treatmentAreas && note.treatmentAreas.length > 0 && (
              <div className="mb-3">
                <p className="text-xs text-gray-500 font-medium mb-1">施術部位</p>
                <BodyMap selected={note.treatmentAreas} onChange={() => {}} readOnly />
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              {note.romFindings && <Row label="ROM所見" value={note.romFindings} />}
              {note.strengthFindings && <Row label="筋力所見" value={note.strengthFindings} />}
              {note.specialTestFindings && <Row label="スペシャルテスト" value={note.specialTestFindings} />}
              {note.tenderness && <Row label="圧痛" value={note.tenderness} />}
              {note.gait && <Row label="歩行" value={note.gait} />}
              {note.singleLegStance && <Row label="片脚立位" value={note.singleLegStance} />}
              {note.squat && <Row label="スクワット" value={note.squat} />}
              {(note.swelling || note.heat) && (
                <Row label="腫脹・熱感" value={[note.swelling && '腫脹あり', note.heat && '熱感あり'].filter(Boolean).join('　')} />
              )}
              {note.therapistObservation && <Row label="施術者観察" value={note.therapistObservation} className="sm:col-span-2" />}
            </div>
          </section>

          {/* A: 評価・分析 */}
          <section>
            <div className="flex items-center gap-1.5 mb-2">
              <span className="w-5 h-5 rounded-full bg-amber-500 text-white text-[10px] font-bold flex items-center justify-center">A</span>
              <span className="text-xs font-semibold text-amber-700">評価・分析</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              {note.improvements && <Row label="改善したこと" value={note.improvements} highlight="green" />}
              {note.remainingIssues && <Row label="残存課題" value={note.remainingIssues} highlight="amber" />}
              {note.priorityIssue && <Row label="優先課題" value={note.priorityIssue} />}
            </div>
          </section>

          {/* P: 計画 */}
          <section>
            <div className="flex items-center gap-1.5 mb-2">
              <span className="w-5 h-5 rounded-full bg-purple-500 text-white text-[10px] font-bold flex items-center justify-center">P</span>
              <span className="text-xs font-semibold text-purple-700">計画</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              {note.treatmentToday && <Row label="本日の治療内容" value={note.treatmentToday} />}
              {note.homeExercise && <Row label="自宅運動指示" value={note.homeExercise} highlight="purple" />}
              {note.nextGoal && <Row label="次回目標" value={note.nextGoal} highlight="blue" />}
              {note.forbiddenMovements && <Row label="禁忌動作" value={note.forbiddenMovements} highlight="red" />}
              {note.recommendedFrequency && <Row label="来院頻度" value={note.recommendedFrequency} />}
              {note.nextReassessment && <Row label="再評価予定" value={note.nextReassessment} />}
            </div>
          </section>
        </div>
      )}
    </div>
  )
}

function Row({ label, value, highlight, className = '' }: {
  label: string
  value: string
  highlight?: 'green' | 'amber' | 'blue' | 'purple' | 'red'
  className?: string
}) {
  const bg = highlight === 'green' ? 'bg-green-50 border-green-100' :
    highlight === 'amber' ? 'bg-amber-50 border-amber-100' :
    highlight === 'blue' ? 'bg-blue-50 border-blue-100' :
    highlight === 'purple' ? 'bg-purple-50 border-purple-100' :
    highlight === 'red' ? 'bg-red-50 border-red-100' :
    'bg-white border-gray-100'
  return (
    <div className={`rounded-lg border p-2 ${bg} ${className}`}>
      <p className="text-gray-400 font-medium mb-0.5">{label}</p>
      <p className="text-gray-700 whitespace-pre-wrap">{value}</p>
    </div>
  )
}

type TabKey = 'overview' | 'plan' | 'evaluation' | 'soap' | 'rom' | 'strength' | 'special' | 'progress' | 'exercises' | 'explanation'

interface Props {
  patient: Patient
}

export default function PatientDetail({ patient }: Props) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<TabKey>('overview')
  const [evaluations, setEvaluations] = useState<Evaluation[]>([])
  const [romRecords, setRomRecords] = useState<ROMRecord[]>([])
  const [strengthRecords, setStrengthRecords] = useState<StrengthRecord[]>([])
  const [specialTests, setSpecialTests] = useState<SpecialTestRecord[]>([])
  const [soapNotes, setSoapNotes] = useState<SOAPNote[]>([])
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [patientExercises, setPatientExercises] = useState<PatientExercise[]>([])
  const [progressRecords, setProgressRecords] = useState<ProgressRecord[]>([])
  const [rehabPlans, setRehabPlans] = useState<RehabPlan[]>([])

  useEffect(() => {
    reload()
  }, [patient.id])

  function reload() {
    setEvaluations(getEvaluations(patient.id))
    setRomRecords(getROMRecords(patient.id))
    setStrengthRecords(getStrengthRecords(patient.id))
    setSpecialTests(getSpecialTests(patient.id))
    setSoapNotes(getSOAPNotes(patient.id).sort((a, b) => b.visitDate.localeCompare(a.visitDate)))
    setExercises(getExercises())
    setPatientExercises(getPatientExercises(patient.id))
    setProgressRecords(getProgressRecords(patient.id))
    setRehabPlans(getRehabPlans(patient.id).sort((a, b) => a.phase - b.phase))
  }

  // ── 算出値 ──
  const latestEval = evaluations.at(-1)
  const firstEval = evaluations[0]
  const latestSoap = soapNotes[0]
  const currentPhase = latestSoap?.currentPhase ?? 1

  const romImprovement = firstEval
    ? calculateROMImprovement(firstEval.painNrs, latestEval?.painNrs ?? null, latestEval?.painNrs ?? null, 10)
    : null

  const improvementScore = latestEval
    ? calculateImprovementScore({
        initialPain: firstEval?.painNrs ?? 10,
        currentPain: latestSoap?.painToday ?? latestEval.painNrs,
        romImprovementRate: 20,
        strengthImprovementRate: 15,
        specialTestImproved: false,
        functionalScore: 40,
        homeExerciseAdherence: latestSoap?.homeExerciseAdherence === 'done' ? 100 : latestSoap?.homeExerciseAdherence === 'partial' ? 50 : 0,
        visitContinuity: 80,
        patientSubjective: 60,
      })
    : null

  const retentionRisk = calculateRetentionRisk({
    daysSinceLastVisit: getDaysSinceLastVisit(patient.updatedAt),
    recommendedIntervalDays: 7,
    cancelCount: 0,
    totalVisits: soapNotes.length,
    painChange: firstEval ? (latestSoap?.painToday ?? 5) - firstEval.painNrs : 0,
    romImprovementRate: 15,
    strengthImprovementRate: 15,
    homeExerciseAdherence: latestSoap?.homeExerciseAdherence === 'done' ? 100 : 50,
    hasEconomicConcern: false,
    hasGoalUnclear: false,
    hasExplanationInsufficient: false,
  })

  const patientMessage = improvementScore
    ? generatePatientFriendlyMessage({
        phase: currentPhase,
        painNrs: latestSoap?.painToday ?? latestEval?.painNrs ?? 5,
        initialPainNrs: firstEval?.painNrs ?? 8,
        romImprovementRate: 15,
        strengthImprovementRate: 10,
        improvementScore: improvementScore.total,
        nextGoal: latestSoap?.nextGoal ?? '',
      })
    : null

  // ── グラフデータ ──
  const painChartData = soapNotes.map(n => ({ date: n.visitDate, nrs: n.painToday })).reverse()
  const progressChartData = progressRecords.map(r => ({ date: r.recordDate, score: r.improvementScore }))
  const adherenceData = soapNotes.slice(0, 10).map(n => ({
    date: n.visitDate,
    rate: n.homeExerciseAdherence === 'done' ? 100 : n.homeExerciseAdherence === 'partial' ? 50 : 0,
  })).reverse()

  // ── ROM グラフデータ（最初の動作） ──
  const romMovements = [...new Set(romRecords.map(r => r.movement))].slice(0, 4)

  // ── 運動割り当て ──
  function handleAssignExercise(exerciseId: string) {
    const pe: PatientExercise = {
      id: nanoid(),
      patientId: patient.id,
      exerciseId,
      assignedDate: new Date().toISOString().split('T')[0],
      status: 'active',
      adherenceRate: 0,
      painAfterExercise: null,
      memo: '',
    }
    savePatientExercise(pe)
    reload()
  }

  function handleRemoveExercise(patientExerciseId: string) {
    deletePatientExercise(patientExerciseId)
    reload()
  }

  const assignedExerciseIds = new Set(patientExercises.filter(pe => pe.status === 'active').map(pe => pe.exerciseId))

  const TABS: { key: TabKey; label: string; icon: string; badge?: number }[] = [
    { key: 'overview', label: '概要', icon: '👁' },
    { key: 'plan', label: 'リハビリ計画', icon: '📅', badge: rehabPlans.length || undefined },
    { key: 'evaluation', label: '初回評価', icon: '📋' },
    { key: 'soap', label: 'SOAPカルテ', icon: '📝' },
    { key: 'rom', label: 'ROM', icon: '📐' },
    { key: 'strength', label: '筋力', icon: '💪' },
    { key: 'special', label: 'スペシャルテスト', icon: '🔍' },
    { key: 'progress', label: '進捗', icon: '📈' },
    { key: 'exercises', label: '運動メニュー', icon: '🏃' },
    { key: 'explanation', label: '患者説明', icon: '📄' },
  ]

  return (
    <div className="space-y-0">
      {/* ヘッダーカード */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm mb-4">
        <div className="px-6 pt-5 pb-4">
          <button
            onClick={() => router.back()}
            className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-gray-700 mb-3 transition-colors"
          >
            ← 患者一覧に戻る
          </button>
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h1 className="text-xl font-semibold text-gray-900">{patient.name}</h1>
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                <span className="text-sm text-gray-400">{patient.kana}</span>
                <Badge color="teal">{BODY_REGION_LABELS[patient.bodyRegion]}</Badge>
                {patient.diagnosisLabel && <Badge color="gray">{patient.diagnosisLabel}</Badge>}
                <RetentionRiskBadge level={retentionRisk.level} />
              </div>
            </div>
            {improvementScore && (
              <div className="flex flex-col items-center flex-shrink-0">
                <ProgressGauge score={improvementScore.total} size={72} />
                <span className="text-xs text-gray-400 mt-1">改善スコア</span>
              </div>
            )}
          </div>
          {latestSoap && (
            <div className="mt-4 max-w-lg">
              <PhaseStepper currentPhase={currentPhase} />
            </div>
          )}
        </div>

        {/* タブバー */}
        <div className="px-1 overflow-x-auto border-t border-gray-100">
          <div className="flex min-w-max">
            {TABS.map(tab => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`relative px-3.5 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                  activeTab === tab.key
                    ? 'border-teal-600 text-teal-700'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab.icon} {tab.label}
                {tab.badge != null && tab.badge > 0 && (
                  <span className="ml-1 bg-teal-500 text-white text-[10px] font-bold rounded-full px-1.5 py-0.5">
                    {tab.badge}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* コンテンツ */}
      <div className="max-w-5xl mx-auto">

        {/* ── 概要タブ ── */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* 患者メッセージ（施術者向け参考）*/}
            {patientMessage && (
              <Card>
                <CardContent className="pt-5">
                  <div className="bg-teal-50 rounded-xl p-4">
                    <p className="text-sm font-bold text-teal-800 mb-2">📣 患者様への今日のメッセージ</p>
                    <p className="text-sm text-teal-700">{patientMessage.encouragementMessage}</p>
                    <p className="text-sm text-teal-600 mt-2">{patientMessage.phaseExplanation}</p>
                    {patientMessage.nextGoalMessage && (
                      <p className="text-sm text-teal-800 font-medium mt-2">🎯 {patientMessage.nextGoalMessage}</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* 離脱リスクが高い場合の提案 */}
            {retentionRisk.level === 'high' && (
              <Card>
                <CardContent className="pt-5">
                  <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                    <p className="text-sm font-bold text-red-700 mb-2">⚠️ 離脱リスクが高い状態です</p>
                    <p className="text-sm text-red-600 mb-2">{retentionRisk.recommendedAction}</p>
                    <ul className="text-xs text-red-500 space-y-1">
                      {retentionRisk.reasons.map((r, i) => <li key={i}>• {r}</li>)}
                    </ul>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* 基本情報 */}
            <Card>
              <CardHeader><SectionTitle>患者基本情報</SectionTitle></CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                  <div><span className="text-gray-500">主訴</span><p className="font-medium">{patient.mainComplaint}</p></div>
                  <div><span className="text-gray-500">初回来院</span><p className="font-medium">{patient.firstVisitDate}</p></div>
                  <div><span className="text-gray-500">来院回数</span><p className="font-medium">{soapNotes.length}回</p></div>
                  <div><span className="text-gray-500">診断</span><p className="font-medium">{patient.diagnosisLabel}</p></div>
                  <div><span className="text-gray-500">発症日</span><p className="font-medium">{patient.onsetDate}</p></div>
                  <div><span className="text-gray-500">担当者メモ</span><p className="font-medium text-xs">{patient.therapistNotes || 'なし'}</p></div>
                </div>
              </CardContent>
            </Card>

            {/* できるようになったこと */}
            {soapNotes.length > 0 && (
              <Card>
                <CardHeader><SectionTitle>できるようになったこと</SectionTitle></CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {latestSoap?.improvements && (
                      <li className="flex items-start gap-2 text-sm text-gray-700">
                        <span className="text-green-500 mt-0.5">✓</span>
                        {latestSoap.improvements}
                      </li>
                    )}
                    {romRecords.length > 0 && (
                      <li className="flex items-start gap-2 text-sm text-gray-700">
                        <span className="text-green-500 mt-0.5">✓</span>
                        ROM測定が {romRecords.length}件記録されています
                      </li>
                    )}
                    {strengthRecords.length > 0 && (
                      <li className="flex items-start gap-2 text-sm text-gray-700">
                        <span className="text-green-500 mt-0.5">✓</span>
                        筋力測定が {strengthRecords.length}件記録されています
                      </li>
                    )}
                  </ul>
                </CardContent>
              </Card>
            )}

            {/* 次の目標 */}
            {latestSoap?.nextGoal && (
              <Card>
                <CardHeader><SectionTitle>次の目標</SectionTitle></CardHeader>
                <CardContent>
                  <p className="text-sm text-gray-700 bg-blue-50 rounded-lg p-3">{latestSoap.nextGoal}</p>
                </CardContent>
              </Card>
            )}

            {/* 最新SOAP概要 */}
            {latestSoap && (
              <Card>
                <CardHeader><SectionTitle>最新カルテ概要（{latestSoap.visitDate}）</SectionTitle></CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-500">痛みNRS</span>
                      <p className={`font-bold text-lg ${latestSoap.painToday >= 7 ? 'text-red-600' : latestSoap.painToday >= 4 ? 'text-yellow-600' : 'text-green-600'}`}>
                        {latestSoap.painToday} / 10
                      </p>
                    </div>
                    <div>
                      <span className="text-gray-500">自宅運動</span>
                      <p className="font-medium">{latestSoap.homeExerciseAdherence === 'done' ? '✅ 実施できた' : latestSoap.homeExerciseAdherence === 'partial' ? '⚠️ 一部実施' : '❌ 未実施'}</p>
                    </div>
                  </div>
                  {latestSoap.changeFromLast && (
                    <p className="mt-2 text-xs text-gray-600 bg-gray-50 rounded p-2">{latestSoap.changeFromLast}</p>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* ── リハビリ計画タブ ── */}
        {activeTab === 'plan' && (
          <div className="space-y-4">
            {rehabPlans.length === 0 ? (
              <Card>
                <CardContent className="py-10 text-center">
                  <p className="text-gray-400 text-sm mb-2">リハビリ計画がまだありません</p>
                  <p className="text-gray-400 text-xs">「プロトコル立案」でプロトコルを作成し、「カルテへ反映」ボタンで追加できます</p>
                </CardContent>
              </Card>
            ) : (
              <>
                <div className="flex items-center gap-2 px-1">
                  <span className="text-sm font-medium text-gray-700">{rehabPlans.length}フェーズのリハビリ計画</span>
                  <span className="text-xs text-gray-400">（プロトコルから反映）</span>
                </div>
                {rehabPlans.map((plan, i) => (
                  <Card key={plan.id}>
                    <CardHeader>
                      <div className="flex items-center gap-3">
                        <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${
                          i === 0 ? 'bg-teal-100 text-teal-700' : 'bg-gray-100 text-gray-600'
                        }`}>
                          {plan.phase}
                        </span>
                        <div>
                          <SectionTitle>{plan.mainProblem || PHASE_SHORT_LABELS[plan.phase]}</SectionTitle>
                          <p className="text-xs text-gray-400 mt-0.5">{PHASE_LABELS[plan.phase]}</p>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                        {plan.shortTermGoal && (
                          <div>
                            <p className="text-xs font-medium text-gray-400 mb-1">短期ゴール</p>
                            <p className="text-gray-700 bg-green-50 rounded-lg p-2 text-xs">{plan.shortTermGoal}</p>
                          </div>
                        )}
                        {plan.midTermGoal && (
                          <div>
                            <p className="text-xs font-medium text-gray-400 mb-1">中期ゴール</p>
                            <p className="text-gray-700 bg-blue-50 rounded-lg p-2 text-xs">{plan.midTermGoal}</p>
                          </div>
                        )}
                        {plan.longTermGoal && (
                          <div className="md:col-span-2">
                            <p className="text-xs font-medium text-gray-400 mb-1">長期ゴール</p>
                            <p className="text-gray-700 bg-purple-50 rounded-lg p-2 text-xs">{plan.longTermGoal}</p>
                          </div>
                        )}
                        {plan.recommendedFrequency && (
                          <div className="md:col-span-2">
                            <p className="text-xs font-medium text-gray-400 mb-1">運動メニュー</p>
                            <p className="text-gray-700 text-xs">{plan.recommendedFrequency}</p>
                          </div>
                        )}
                        {plan.precautions && (
                          <div className="md:col-span-2">
                            <p className="text-xs font-medium text-gray-400 mb-1">進行基準</p>
                            <p className="text-gray-700 bg-amber-50 rounded-lg p-2 text-xs">{plan.precautions}</p>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </>
            )}
          </div>
        )}

        {/* ── 初回評価タブ ── */}
        {activeTab === 'evaluation' && (
          <div className="space-y-6">
            {evaluations.length > 0 && (
              <Card>
                <CardHeader><SectionTitle>評価履歴</SectionTitle></CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {evaluations.map(ev => (
                      <div key={ev.id} className="py-3 border-b border-gray-50 last:border-0">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-gray-600 text-sm">{ev.evaluationDate}</span>
                          <div className="flex items-center gap-2">
                            <span className={`font-medium text-sm ${ev.painNrs >= 7 ? 'text-red-600' : ev.painNrs >= 4 ? 'text-yellow-600' : 'text-green-600'}`}>
                              NRS: {ev.painNrs}
                            </span>
                            {ev.painDuration && (
                              <Badge color={ev.painDuration === 'chronic' ? 'red' : ev.painDuration === 'subacute' ? 'yellow' : 'teal'}>
                                {ev.painDuration === 'chronic' ? '慢性' : ev.painDuration === 'subacute' ? '亜急性' : '急性'}
                              </Badge>
                            )}
                          </div>
                          <div className="flex gap-1">
                            {ev.swelling && <Badge color="blue">腫脹</Badge>}
                            {ev.numbness && <Badge color="red">しびれ</Badge>}
                            {ev.nightPain && <Badge color="red">夜間痛</Badge>}
                            {ev.centralSensitization && <Badge color="purple">中枢感作</Badge>}
                          </div>
                        </div>
                        {ev.painLocations && ev.painLocations.length > 0 && (
                          <div className="mt-2">
                            <BodyMap selected={ev.painLocations} onChange={() => {}} readOnly />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
            <EvaluationForm patientId={patient.id} onSaved={reload} />
          </div>
        )}

        {/* ── SOAPカルテタブ ── */}
        {activeTab === 'soap' && (
          <div className="space-y-4">
            {/* 新規カルテ入力 */}
            <SOAPForm patientId={patient.id} onSaved={reload} />

            {/* 過去カルテ一覧（アコーディオン） */}
            {soapNotes.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 px-1 pt-2">
                  <SectionTitle>過去のカルテ</SectionTitle>
                  <span className="text-xs text-gray-400">{soapNotes.length}件</span>
                </div>
                {soapNotes.map(note => (
                  <SOAPNoteCard key={note.id} note={note} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── ROM タブ ── */}
        {activeTab === 'rom' && (
          <div className="space-y-6">
            {romRecords.length > 0 && (
              <Card>
                <CardHeader><SectionTitle>ROM記録一覧</SectionTitle></CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-100">
                          <th className="text-left py-2 text-gray-500 font-medium text-xs">日付</th>
                          <th className="text-left py-2 text-gray-500 font-medium text-xs">部位</th>
                          <th className="text-left py-2 text-gray-500 font-medium text-xs">動作</th>
                          <th className="text-right py-2 text-gray-500 font-medium text-xs">自動</th>
                          <th className="text-right py-2 text-gray-500 font-medium text-xs">他動</th>
                          <th className="text-right py-2 text-gray-500 font-medium text-xs">正常値</th>
                          <th className="text-center py-2 text-gray-500 font-medium text-xs">痛み</th>
                        </tr>
                      </thead>
                      <tbody>
                        {romRecords.map(r => {
                          const imp = calculateROMImprovement(null, null, r.activeRom, r.normalValue)
                          const pct = imp.normalRatio ? Math.round(imp.normalRatio) : null
                          return (
                            <tr key={r.id} className="border-b border-gray-50 hover:bg-gray-50">
                              <td className="py-2 text-xs">{r.measuredDate}</td>
                              <td className="py-2 text-xs">{BODY_REGION_LABELS[r.bodyRegion]}</td>
                              <td className="py-2 text-xs font-medium">{r.movement}</td>
                              <td className="py-2 text-right">
                                <span className={`text-xs font-bold ${pct && pct < 70 ? 'text-red-600' : pct && pct < 90 ? 'text-yellow-600' : 'text-green-600'}`}>
                                  {r.activeRom ?? '—'}{r.unit === 'deg' ? '°' : 'cm'}
                                </span>
                              </td>
                              <td className="py-2 text-right text-xs">{r.passiveRom ?? '—'}</td>
                              <td className="py-2 text-right text-xs text-gray-400">{r.normalValue}{r.unit === 'deg' ? '°' : 'cm'}</td>
                              <td className="py-2 text-center">{r.pain ? '⚠' : '—'}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}
            {romMovements.length > 0 && (
              <Card>
                <CardHeader><SectionTitle>ROM推移グラフ</SectionTitle></CardHeader>
                <CardContent>
                  {romMovements.map(movement => {
                    const data = romRecords
                      .filter(r => r.movement === movement)
                      .map(r => ({ date: r.measuredDate, active: r.activeRom, passive: r.passiveRom }))
                    const firstRecord = romRecords.find(r => r.movement === movement)
                    return (
                      <div key={movement} className="mb-4">
                        <p className="text-xs font-medium text-gray-600 mb-1">{movement}</p>
                        <ROMChart data={data} movement={movement} normalValue={firstRecord?.normalValue} />
                      </div>
                    )
                  })}
                </CardContent>
              </Card>
            )}
            <ROMInputForm patientId={patient.id} onSaved={reload} />
          </div>
        )}

        {/* ── 筋力タブ ── */}
        {activeTab === 'strength' && (
          <div className="space-y-6">
            {strengthRecords.length > 0 && (
              <Card>
                <CardHeader><SectionTitle>筋力記録一覧</SectionTitle></CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-100">
                          <th className="text-left py-2 text-gray-500 font-medium text-xs">日付</th>
                          <th className="text-left py-2 text-gray-500 font-medium text-xs">動作</th>
                          <th className="text-center py-2 text-gray-500 font-medium text-xs">患側</th>
                          <th className="text-center py-2 text-gray-500 font-medium text-xs">MMT</th>
                          <th className="text-center py-2 text-gray-500 font-medium text-xs">HHD</th>
                          <th className="text-center py-2 text-gray-500 font-medium text-xs">痛み</th>
                        </tr>
                      </thead>
                      <tbody>
                        {strengthRecords.map(r => (
                          <tr key={r.id} className="border-b border-gray-50 hover:bg-gray-50">
                            <td className="py-2 text-xs">{r.measuredDate}</td>
                            <td className="py-2 text-xs font-medium">{r.movement}</td>
                            <td className="py-2 text-center text-xs">{r.side === 'right' ? '右' : r.side === 'left' ? '左' : r.side}</td>
                            <td className="py-2 text-center">
                              <span className="font-bold text-teal-600 text-sm">{r.mmt !== null ? r.mmt : '—'}</span>
                            </td>
                            <td className="py-2 text-center text-xs">{r.hhdValue !== null ? `${r.hhdValue} ${r.unit}` : '—'}</td>
                            <td className="py-2 text-center">{r.pain ? '⚠' : '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}
            <StrengthInputForm patientId={patient.id} onSaved={reload} />
          </div>
        )}

        {/* ── スペシャルテストタブ ── */}
        {activeTab === 'special' && (
          <div className="space-y-6">
            {specialTests.length > 0 && (
              <Card>
                <CardHeader><SectionTitle>テスト結果</SectionTitle></CardHeader>
                <CardContent>
                  <SpecialTestSummary tests={specialTests.map(t => ({ name: t.testName, result: t.result }))} />
                  <div className="mt-4 space-y-2">
                    {specialTests.map(t => (
                      <div key={t.id} className="text-xs border border-gray-100 rounded-lg p-3">
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-gray-800">{t.testName}</span>
                          <div className="flex gap-1.5">
                            <span className={`px-2 py-0.5 rounded-full ${t.result === 'positive' ? 'bg-red-100 text-red-700' : t.result === 'suspicious' ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'}`}>
                              {t.result === 'positive' ? '陽性' : t.result === 'suspicious' ? '疑陽性' : t.result === 'negative' ? '陰性' : '不可'}
                            </span>
                          </div>
                        </div>
                        {t.patientFriendlyExplanation && (
                          <p className="mt-1.5 text-gray-600 bg-blue-50 rounded p-2">{t.patientFriendlyExplanation}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
            <SpecialTestInputForm patientId={patient.id} onSaved={reload} />
          </div>
        )}

        {/* ── 進捗タブ ── */}
        {activeTab === 'progress' && (
          <div className="space-y-6">
            {improvementScore && (
              <Card>
                <CardHeader><SectionTitle>改善スコア</SectionTitle></CardHeader>
                <CardContent>
                  <div className="flex items-center gap-6">
                    <ProgressGauge score={improvementScore.total} size={120} />
                    <div className="space-y-2">
                      <p className="font-bold text-gray-800">{improvementScore.label}</p>
                      <div className="text-xs text-gray-600 space-y-1">
                        <p>痛み改善: {improvementScore.painScore}/25</p>
                        <p>ROM改善: {improvementScore.romScore}/20</p>
                        <p>筋力改善: {improvementScore.strengthScore}/20</p>
                        <p>機能改善: {improvementScore.functionalScore}/15</p>
                        <p>自宅運動: {improvementScore.adherenceScore}/5</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader><SectionTitle>痛みNRS推移</SectionTitle></CardHeader>
              <CardContent>
                <PainChart data={painChartData} />
              </CardContent>
            </Card>

            {progressRecords.length > 0 && (
              <Card>
                <CardHeader><SectionTitle>改善スコア推移</SectionTitle></CardHeader>
                <CardContent>
                  <ImprovementChart data={progressChartData} />
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader><SectionTitle>自宅運動実施率</SectionTitle></CardHeader>
              <CardContent>
                <AdherenceChart data={adherenceData} />
              </CardContent>
            </Card>
          </div>
        )}

        {/* ── 運動メニュータブ ── */}
        {activeTab === 'exercises' && (
          <div className="space-y-6">
            {/* 処方中の運動 */}
            {patientExercises.filter(pe => pe.status === 'active').length > 0 && (
              <div>
                <h3 className="text-sm font-bold text-gray-700 mb-3">処方中の運動</h3>
                <div className="space-y-3">
                  {patientExercises.filter(pe => pe.status === 'active').map(pe => {
                    const exercise = exercises.find(e => e.id === pe.exerciseId)
                    if (!exercise) return null
                    return (
                      <ExerciseCard
                        key={pe.id}
                        exercise={exercise}
                        patientExercise={pe}
                        onRemove={handleRemoveExercise}
                      />
                    )
                  })}
                </div>
              </div>
            )}

            {/* 追加可能な運動 */}
            <div>
              <h3 className="text-sm font-bold text-gray-700 mb-3">追加できる運動</h3>
              <div className="space-y-3">
                {exercises
                  .filter(e => e.bodyRegion === patient.bodyRegion || e.bodyRegion === 'lumbar')
                  .filter(e => !assignedExerciseIds.has(e.id))
                  .map(exercise => (
                    <ExerciseCard
                      key={exercise.id}
                      exercise={exercise}
                      onAssign={handleAssignExercise}
                    />
                  ))}
              </div>
            </div>
          </div>
        )}

        {/* ── 患者説明タブ ── */}
        {activeTab === 'explanation' && (
          <PatientExplanationSheet
            patient={patient}
            evaluation={latestEval}
            soapNote={latestSoap}
            improvementScore={improvementScore?.total ?? 0}
            currentPhase={currentPhase}
            romRecords={romRecords}
            strengthRecords={strengthRecords}
            patientExercises={patientExercises}
            exercises={exercises}
          />
        )}
      </div>
    </div>
  )
}
