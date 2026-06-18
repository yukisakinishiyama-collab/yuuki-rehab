'use client'
// ──────────────────────────────────────────────
// 患者説明シート（印刷・PDF対応）
// ──────────────────────────────────────────────
import { useRef } from 'react'
import type { Patient, Evaluation, SOAPNote, ROMRecord, StrengthRecord, PatientExercise, Exercise, RehabPhase } from '@/types/patient'
import { PHASE_SHORT_LABELS } from '@/types/patient'
import { ProgressGauge, PhaseStepper } from './shared'
import ExerciseIllustration from './ExerciseIllustration'
import { generatePatientFriendlyMessage } from '@/lib/rehab-algorithms'

interface Props {
  patient: Patient
  evaluation?: Evaluation
  soapNote?: SOAPNote
  improvementScore: number
  currentPhase: RehabPhase
  romRecords: ROMRecord[]
  strengthRecords: StrengthRecord[]
  patientExercises: PatientExercise[]
  exercises: Exercise[]
}

export default function PatientExplanationSheet({
  patient, evaluation, soapNote, improvementScore, currentPhase,
  romRecords, strengthRecords, patientExercises, exercises,
}: Props) {
  const printRef = useRef<HTMLDivElement>(null)

  const msg = generatePatientFriendlyMessage({
    phase: currentPhase,
    painNrs: soapNote?.painToday ?? evaluation?.painNrs ?? 5,
    initialPainNrs: evaluation?.painNrs ?? 8,
    romImprovementRate: 15,
    strengthImprovementRate: 10,
    improvementScore,
    nextGoal: soapNote?.nextGoal ?? '',
  })

  const assignedExercises = patientExercises
    .filter(pe => pe.status === 'active')
    .map(pe => exercises.find(e => e.id === pe.exerciseId))
    .filter((e): e is Exercise => !!e)

  function handlePrint() {
    window.print()
  }

  return (
    <div>
      {/* 印刷ボタン */}
      <div className="flex justify-end mb-4 print:hidden">
        <button
          type="button"
          onClick={handlePrint}
          className="px-5 py-2 bg-teal-600 text-white text-sm font-medium rounded-lg hover:bg-teal-700 flex items-center gap-2"
        >
          🖨 印刷・PDF保存
        </button>
      </div>

      {/* 説明シート本体 */}
      <div
        ref={printRef}
        className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 print:shadow-none print:border-none"
        style={{ fontFamily: '"Hiragino Sans", "Noto Sans JP", sans-serif' }}
      >
        {/* ヘッダー */}
        <div className="flex items-start justify-between mb-6 pb-4 border-b border-gray-200">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-5 h-5 flex items-center justify-center">
                <svg width="20" height="20" viewBox="0 0 28 28" fill="none">
                  <rect width="28" height="28" rx="7" fill="#0d9488" fillOpacity="0.15"/>
                  <path d="M14 6v16M6 14h16" stroke="#0d9488" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </div>
              <span className="text-xs font-bold text-teal-700 tracking-wider">ゆうき整骨院</span>
            </div>
            <h1 className="text-2xl font-bold text-gray-900">リハビリ経過説明書</h1>
            <p className="text-sm text-gray-500 mt-1">{patient.name} 様　作成日：{new Date().toLocaleDateString('ja-JP')}</p>
          </div>
          <div className="text-right">
            <ProgressGauge score={improvementScore} size={90} />
            <p className="text-xs text-gray-500 mt-1">現在の改善スコア</p>
          </div>
        </div>

        {/* 安全免責事項 */}
        <div className="bg-gray-50 rounded-lg p-3 mb-6 text-xs text-gray-500">
          ※ このシートは医師の診断を代替するものではありません。強い痛み・しびれ・夜間痛・発熱などの症状が現れた場合は、医療機関の受診をご検討ください。
        </div>

        {/* 現在の状態 */}
        <section className="mb-6">
          <h2 className="text-base font-bold text-teal-700 mb-3 flex items-center gap-2">
            <span className="w-5 h-5 bg-teal-100 rounded-full flex items-center justify-center text-teal-600 text-xs">1</span>
            現在の状態
          </h2>
          <div className="bg-teal-50 rounded-xl p-4">
            <p className="text-sm font-bold text-teal-800 mb-2">{msg.statusMessage}</p>
            <p className="text-sm text-gray-700 leading-relaxed">{msg.phaseExplanation}</p>
          </div>
        </section>

        {/* フェーズ */}
        <section className="mb-6">
          <h2 className="text-base font-bold text-teal-700 mb-3 flex items-center gap-2">
            <span className="w-5 h-5 bg-teal-100 rounded-full flex items-center justify-center text-teal-600 text-xs">2</span>
            回復のステップ
          </h2>
          <PhaseStepper currentPhase={currentPhase} />
          <p className="text-xs text-gray-500 mt-2">
            現在は「{PHASE_SHORT_LABELS[currentPhase]}」の段階です。
          </p>
        </section>

        {/* 改善している点 */}
        {soapNote?.improvements && (
          <section className="mb-6">
            <h2 className="text-base font-bold text-teal-700 mb-3 flex items-center gap-2">
              <span className="w-5 h-5 bg-teal-100 rounded-full flex items-center justify-center text-teal-600 text-xs">3</span>
              改善している点
            </h2>
            <div className="bg-green-50 rounded-xl p-4">
              <p className="text-sm text-gray-700">{soapNote.improvements}</p>
            </div>
          </section>
        )}

        {/* 課題 */}
        {soapNote?.remainingIssues && (
          <section className="mb-6">
            <h2 className="text-base font-bold text-teal-700 mb-3 flex items-center gap-2">
              <span className="w-5 h-5 bg-teal-100 rounded-full flex items-center justify-center text-teal-600 text-xs">4</span>
              まだ整えていること
            </h2>
            <div className="bg-yellow-50 rounded-xl p-4">
              <p className="text-sm text-gray-700">{soapNote.remainingIssues}</p>
            </div>
          </section>
        )}

        {/* ROMの変化 */}
        {romRecords.length >= 2 && (
          <section className="mb-6">
            <h2 className="text-base font-bold text-teal-700 mb-3 flex items-center gap-2">
              <span className="w-5 h-5 bg-teal-100 rounded-full flex items-center justify-center text-teal-600 text-xs">5</span>
              動きの変化
            </h2>
            <div className="grid grid-cols-2 gap-3">
              {[...new Set(romRecords.map(r => r.movement))].slice(0, 4).map(movement => {
                const records = romRecords.filter(r => r.movement === movement)
                const first = records[0]
                const latest = records.at(-1)
                const diff = first && latest && first.activeRom && latest.activeRom
                  ? latest.activeRom - first.activeRom
                  : null
                return (
                  <div key={movement} className="bg-gray-50 rounded-lg p-3">
                    <p className="text-xs font-medium text-gray-600 mb-1">{movement}</p>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-400">初回 {first?.activeRom ?? '—'}°</span>
                      <span className="text-gray-400">→</span>
                      <span className={`text-sm font-bold ${diff && diff > 0 ? 'text-green-600' : 'text-gray-700'}`}>
                        {latest?.activeRom ?? '—'}°
                      </span>
                      {diff !== null && diff > 0 && (
                        <span className="text-xs text-green-600 bg-green-100 px-1.5 rounded-full">+{diff}°</span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {/* 次の目標 */}
        <section className="mb-6">
          <h2 className="text-base font-bold text-teal-700 mb-3 flex items-center gap-2">
            <span className="w-5 h-5 bg-teal-100 rounded-full flex items-center justify-center text-teal-600 text-xs">6</span>
            次の目標
          </h2>
          <div className="bg-blue-50 rounded-xl p-4">
            <p className="text-sm font-bold text-blue-800">{soapNote?.nextGoal || msg.nextGoalMessage}</p>
          </div>
        </section>

        {/* 自宅運動 */}
        {assignedExercises.length > 0 && (
          <section className="mb-6">
            <h2 className="text-base font-bold text-teal-700 mb-3 flex items-center gap-2">
              <span className="w-5 h-5 bg-teal-100 rounded-full flex items-center justify-center text-teal-600 text-xs">7</span>
              自宅でできる運動
            </h2>
            <div className="space-y-4">
              {assignedExercises.map(exercise => (
                <div key={exercise.id} className="flex gap-4 bg-gray-50 rounded-xl p-4">
                  <ExerciseIllustration type={exercise.svgIllustration} size={80} className="flex-shrink-0" />
                  <div className="flex-1">
                    <h4 className="font-bold text-gray-800 text-sm mb-1">{exercise.name}</h4>
                    <p className="text-xs text-teal-600 mb-2">{exercise.reps} × {exercise.sets}セット｜{exercise.frequency}</p>
                    <p className="text-xs text-gray-600 leading-relaxed">{exercise.patientInstruction}</p>
                    {exercise.contraindications && (
                      <p className="text-xs text-orange-600 mt-1.5">⚠ {exercise.contraindications}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* 注意点 */}
        <section className="mb-6">
          <h2 className="text-base font-bold text-teal-700 mb-3 flex items-center gap-2">
            <span className="w-5 h-5 bg-teal-100 rounded-full flex items-center justify-center text-teal-600 text-xs">8</span>
            注意点
          </h2>
          <div className="bg-orange-50 rounded-xl p-4">
            <ul className="text-sm text-gray-700 space-y-1.5">
              <li>• 運動中に痛みが増す場合は、無理をせず中止してください</li>
              <li>• 翌日以降も痛みが残る場合は、回数を減らしてください</li>
              {soapNote?.forbiddenMovements && (
                <li>• 以下の動作は控えてください：{soapNote.forbiddenMovements}</li>
              )}
              <li>• 強い痛み・しびれ・夜間痛・発熱がある場合は医療機関へ</li>
            </ul>
          </div>
        </section>

        {/* 次回来院の意味 */}
        <section className="mb-6">
          <h2 className="text-base font-bold text-teal-700 mb-3 flex items-center gap-2">
            <span className="w-5 h-5 bg-teal-100 rounded-full flex items-center justify-center text-teal-600 text-xs">9</span>
            次回来院の意味
          </h2>
          <div className="bg-purple-50 rounded-xl p-4">
            <p className="text-sm text-gray-700">
              今の状態を確認し、運動の進み具合に合わせてメニューを調整します。
              来院を続けることで、小さな変化を一緒に確認できます。
              {soapNote?.recommendedFrequency && (
                <span> 次回は{soapNote.recommendedFrequency}が目安です。</span>
              )}
            </p>
          </div>
        </section>

        {/* フッター */}
        <div className="mt-8 pt-4 border-t border-gray-200 text-center text-xs text-gray-400">
          <p>ゆうき整骨院｜このシートに関するご質問はスタッフまでお気軽にお声がけください</p>
          <p className="mt-1">※ このシートは医師の診断を代替するものではありません</p>
        </div>
      </div>
    </div>
  )
}
