'use client'
// ──────────────────────────────────────────────
// 患者説明シート（印刷・PDF対応）
// ──────────────────────────────────────────────
import { useRef, useState } from 'react'
import { nanoid } from 'nanoid'
import type { Patient, Evaluation, SOAPNote, ROMRecord, StrengthRecord, PatientExercise, Exercise, RehabPhase, ExplanationOverride } from '@/types/patient'
import { PHASE_SHORT_LABELS } from '@/types/patient'
import { ProgressGauge, PhaseStepper, Textarea, FormLabel } from './shared'
import ExerciseIllustration from './ExerciseIllustration'
import { generatePatientFriendlyMessage } from '@/lib/rehab-algorithms'
import { getExplanationOverride, saveExplanationOverride } from '@/lib/patient-store'
import { ENCOURAGEMENT_TEMPLATES } from '@/data/encouragement-templates'

const emptyOverride = (patientId: string): ExplanationOverride => ({
  id: nanoid(),
  patientId,
  customStatusMessage: '',
  customEncouragement: '',
  customNextGoal: '',
  customNote: '',
  updatedAt: '',
})

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
  const savedOverride = getExplanationOverride(patient.id) ?? emptyOverride(patient.id)
  const [draft, setDraft] = useState<ExplanationOverride | null>(null)
  const [templateOpen, setTemplateOpen] = useState(false)
  const [templateCategory, setTemplateCategory] = useState(ENCOURAGEMENT_TEMPLATES[0].id)
  const editing = draft !== null

  function startEditing() {
    setDraft(savedOverride)
  }

  function applyTemplate(text: string) {
    setDraft(d => d && ({ ...d, customEncouragement: text.replace('{name}', patient.name) }))
    setTemplateOpen(false)
  }

  function handleSaveOverride() {
    if (!draft) return
    saveExplanationOverride({ ...draft, updatedAt: new Date().toISOString() })
    setDraft(null)
  }

  const override = draft ?? savedOverride

  const msg = generatePatientFriendlyMessage({
    phase: currentPhase,
    painNrs: soapNote?.painToday ?? evaluation?.painNrs ?? 5,
    initialPainNrs: evaluation?.painNrs ?? 8,
    romImprovementRate: 15,
    strengthImprovementRate: 10,
    improvementScore,
    nextGoal: soapNote?.nextGoal ?? '',
  })

  const statusMessage = override.customStatusMessage || msg.statusMessage
  const encouragementMessage = override.customEncouragement || msg.encouragementMessage
  const nextGoalMessage = override.customNextGoal || soapNote?.nextGoal || msg.nextGoalMessage

  const assignedExercises = patientExercises
    .filter(pe => pe.status === 'active')
    .map(pe => exercises.find(e => e.id === pe.exerciseId))
    .filter((e): e is Exercise => !!e)

  function handlePrint() {
    window.print()
  }

  return (
    <div>
      {/* 編集・印刷ボタン */}
      <div className="flex justify-end gap-2 mb-4 print:hidden">
        <button
          type="button"
          onClick={() => (editing ? setDraft(null) : startEditing())}
          className="px-5 py-2 bg-white border border-teal-300 text-teal-700 text-sm font-medium rounded-lg hover:bg-teal-50 flex items-center gap-2"
        >
          {editing ? '✕ 編集を閉じる' : '✏️ 内容を編集'}
        </button>
        <button
          type="button"
          onClick={handlePrint}
          className="px-5 py-2 bg-teal-600 text-white text-sm font-medium rounded-lg hover:bg-teal-700 flex items-center gap-2"
        >
          🖨 印刷・PDF保存
        </button>
      </div>

      {/* 編集パネル */}
      {draft && (
        <div className="bg-white rounded-xl border border-teal-200 shadow-sm p-6 mb-4 print:hidden space-y-4">
          <p className="text-sm font-bold text-teal-700">説明書の内容を編集（空欄の項目は自動生成の文章を使用します）</p>
          <div>
            <FormLabel>現在の状態メッセージ</FormLabel>
            <Textarea
              value={draft.customStatusMessage}
              onChange={v => setDraft(d => d && ({ ...d, customStatusMessage: v }))}
              placeholder={msg.statusMessage}
              rows={2}
            />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <FormLabel>スタッフからの応援メッセージ</FormLabel>
              <button
                type="button"
                onClick={() => setTemplateOpen(v => !v)}
                className="text-xs text-teal-600 hover:text-teal-800 font-medium whitespace-nowrap"
              >
                {templateOpen ? '✕ 定型文を閉じる' : '📋 定型文から選ぶ'}
              </button>
            </div>

            {templateOpen && (
              <div className="mb-2 rounded-lg border border-teal-100 bg-teal-50/50 p-3 space-y-2">
                <div className="flex flex-wrap gap-1.5">
                  {ENCOURAGEMENT_TEMPLATES.map(cat => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setTemplateCategory(cat.id)}
                      className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                        templateCategory === cat.id
                          ? 'bg-teal-600 text-white'
                          : 'bg-white text-gray-600 border border-gray-200 hover:border-teal-300'
                      }`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {ENCOURAGEMENT_TEMPLATES.find(c => c.id === templateCategory)?.templates.map((t, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => applyTemplate(t)}
                      className="block w-full text-left text-xs text-gray-700 bg-white border border-gray-100 rounded-lg px-3 py-2 hover:border-teal-300 hover:bg-teal-50 transition-colors"
                    >
                      {t.replace('{name}', patient.name)}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <Textarea
              value={draft.customEncouragement}
              onChange={v => setDraft(d => d && ({ ...d, customEncouragement: v }))}
              placeholder={msg.encouragementMessage}
              rows={2}
            />
          </div>
          <div>
            <FormLabel>次の目標</FormLabel>
            <Textarea
              value={draft.customNextGoal}
              onChange={v => setDraft(d => d && ({ ...d, customNextGoal: v }))}
              placeholder={soapNote?.nextGoal || msg.nextGoalMessage}
              rows={2}
            />
          </div>
          <div>
            <FormLabel>追加の一言（任意）</FormLabel>
            <Textarea
              value={draft.customNote}
              onChange={v => setDraft(d => d && ({ ...d, customNote: v }))}
              placeholder="例：次回は一緒に階段の昇り降りを確認しましょう"
              rows={2}
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setDraft(null)}
              className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700"
            >
              キャンセル
            </button>
            <button
              type="button"
              onClick={handleSaveOverride}
              className="px-5 py-2 bg-teal-600 text-white text-sm font-medium rounded-lg hover:bg-teal-700"
            >
              保存
            </button>
          </div>
        </div>
      )}

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

        {/* 応援メッセージ */}
        <section className="mb-6">
          <div className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-bold text-amber-800 flex items-center gap-1.5">🎉 応援メッセージ</p>
              {!!soapNote?.visitNumber && (
                <span className="text-xs font-bold text-amber-700 bg-white px-2.5 py-1 rounded-full border border-amber-200 whitespace-nowrap">
                  {soapNote.visitNumber}回目のご来院
                </span>
              )}
            </div>
            <p className="text-sm text-gray-800 leading-relaxed font-medium">{encouragementMessage}</p>
            {override.customNote && (
              <p className="text-sm text-amber-700 mt-2 leading-relaxed">{override.customNote}</p>
            )}
          </div>
        </section>

        {/* 現在の状態 */}
        <section className="mb-6">
          <h2 className="text-base font-bold text-teal-700 mb-3 flex items-center gap-2">
            <span className="w-5 h-5 bg-teal-100 rounded-full flex items-center justify-center text-teal-600 text-xs">1</span>
            現在の状態
          </h2>
          <div className="bg-teal-50 rounded-xl p-4">
            <p className="text-sm font-bold text-teal-800 mb-2">{statusMessage}</p>
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
            <p className="text-sm font-bold text-blue-800">{nextGoalMessage}</p>
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
