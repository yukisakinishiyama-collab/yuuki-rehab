'use client'
// ──────────────────────────────────────────────
// 案件管理用 紹介状・報告書 作成モーダル
// ──────────────────────────────────────────────
import { useState, useRef } from 'react'
import type { RehabCase, EvaluationResult, AISummary } from '@/types/rehab'
import { X, Printer, Sparkles, AlertCircle, FileText, ClipboardList } from 'lucide-react'

interface Props {
  case_: RehabCase
  evaluations: EvaluationResult[]
  aiSummaries: AISummary[]
  onClose: () => void
}

type LetterType = 'referral' | 'report'

interface Destination {
  institution: string
  department: string
  doctor: string
}

interface LetterContent {
  diagnosis: string
  onset: string
  symptoms: string
  course: string
}

function toReiwa(dateStr?: string): string {
  const date = dateStr ? new Date(dateStr) : new Date()
  const reiwaStart = new Date('2019-05-01')
  if (date >= reiwaStart) {
    const y = date.getFullYear() - 2018
    return `令和${y}年${date.getMonth() + 1}月${date.getDate()}日`
  }
  const y = date.getFullYear() - 1988
  return `平成${y}年${date.getMonth() + 1}月${date.getDate()}日`
}

function ReferralPreview({ case_, destination, content }: {
  case_: RehabCase; destination: Destination; content: LetterContent
}) {
  const today = toReiwa()
  const patientName = case_.patientName ?? case_.anonymousId
  return (
    <div className="font-serif text-sm leading-relaxed text-gray-900 space-y-5">
      <h2 className="text-center text-xl tracking-[0.4em] font-bold mt-2">御　紹　介　書</h2>
      <div className="space-y-0.5">
        <p>{destination.institution}　{destination.department}</p>
        <p>{destination.doctor}　先生　御机下</p>
      </div>
      <p className="text-right">{today}</p>
      <div className="border-t border-b border-gray-300 py-3 space-y-1">
        <p>患者氏名：<span className="font-bold">{patientName}</span>　様</p>
        <p>年齢・性別：{case_.age}歳　{case_.gender === 'male' ? '男性' : case_.gender === 'female' ? '女性' : 'その他'}</p>
        {content.diagnosis && <p>傷病名：{content.diagnosis}</p>}
      </div>
      <div className="space-y-4">
        <div>
          <p className="font-bold underline mb-1">【発症経緯】</p>
          <p className="whitespace-pre-wrap">{content.onset || '（AI生成後に表示されます）'}</p>
        </div>
        <div>
          <p className="font-bold underline mb-1">【症状・所見】</p>
          <p className="whitespace-pre-wrap">{content.symptoms || '（AI生成後に表示されます）'}</p>
        </div>
        <div>
          <p className="font-bold underline mb-1">【経過・紹介理由】</p>
          <p className="whitespace-pre-wrap">{content.course || '（AI生成後に表示されます）'}</p>
        </div>
      </div>
      <div className="border-t border-gray-200 pt-4 text-right space-y-1 text-sm">
        <p>ゆうき整骨院</p>
        <p>〒753-0000　山口県下関市（住所）</p>
        <p>TEL: 083-000-0000</p>
        <p>柔道整復師　西山 勇来</p>
      </div>
    </div>
  )
}

function ReportPreview({ case_, destination, content }: {
  case_: RehabCase; destination: Destination; content: LetterContent
}) {
  const today = toReiwa()
  const patientName = case_.patientName ?? case_.anonymousId
  return (
    <div className="font-serif text-sm leading-relaxed text-gray-900 space-y-5">
      <h2 className="text-center text-xl tracking-[0.4em] font-bold mt-2">御　報　告　書</h2>
      <div className="space-y-0.5">
        <p>{destination.institution}　{destination.department}</p>
        <p>{destination.doctor}　先生　御机下</p>
      </div>
      <p className="text-right">{today}</p>
      <div className="border-t border-b border-gray-300 py-3 space-y-1">
        <p>患者氏名：<span className="font-bold">{patientName}</span>　様</p>
        <p>年齢・性別：{case_.age}歳　{case_.gender === 'male' ? '男性' : case_.gender === 'female' ? '女性' : 'その他'}</p>
        {content.diagnosis && <p>傷病名：{content.diagnosis}</p>}
      </div>
      <div className="space-y-4">
        <div>
          <p className="font-bold underline mb-1">【経過報告】</p>
          <p className="whitespace-pre-wrap">{content.course || '（AI生成後に表示されます）'}</p>
        </div>
      </div>
      <div className="border-t border-gray-200 pt-4 text-right space-y-1 text-sm">
        <p>ゆうき整骨院</p>
        <p>〒753-0000　山口県下関市（住所）</p>
        <p>TEL: 083-000-0000</p>
        <p>柔道整復師　西山 勇来</p>
      </div>
    </div>
  )
}

export default function CaseReferralModal({ case_, evaluations, aiSummaries, onClose }: Props) {
  const [letterType, setLetterType] = useState<LetterType>('referral')
  const [destination, setDestination] = useState<Destination>({ institution: '', department: '', doctor: '' })
  const [content, setContent] = useState<LetterContent>({ diagnosis: '', onset: '', symptoms: '', course: '' })
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [generated, setGenerated] = useState(false)
  const previewRef = useRef<HTMLDivElement>(null)

  // 評価データをSOAP-likeなサマリーに変換
  const evalSummary = evaluations.slice(0, 5).map((ev, i) => {
    const problems = ev.items.filter(it => it.checked && it.severity !== 'none').map(it => `${it.label}(${it.severity})`).join('、')
    return {
      visitDate: ev.evaluatedAt.split('T')[0],
      painToday: '-',
      currentPhase: ev.movementType,
      changeFromLast: problems || '問題なし',
      treatmentContent: ev.overallNote || '-',
      improvements: '',
      nextGoal: '',
    }
  })

  // AIサマリーを経過メモとして使用
  const latestAI = aiSummaries[0]
  const intakeForAPI = {
    intakeDate: case_.createdAt.split('T')[0],
    chiefComplaint: case_.evaluationPurpose,
    injuryMechanism: null,
    injuryDate: null,
    painNrs: null,
    painCharacter: [],
    worseFactor: null,
    adlDifficulty: [],
    sportsActivity: case_.sport ?? null,
    importantGoal: null,
    pastMedicalHistory: case_.postOpDays != null ? `術後${case_.postOpDays}日目` : null,
    imagingResults: null,
    suspectedDiagnosis: case_.diagnosis,
    therapistNotes: latestAI ? `AI解析結果: ${latestAI.summary.slice(0, 200)}` : null,
  }

  async function handleGenerate() {
    if (!destination.institution.trim() || !destination.doctor.trim()) {
      setError('医療機関名と医師名は必須です')
      return
    }
    setError(null)
    setGenerating(true)
    try {
      const res = await fetch('/api/referral-generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: letterType,
          patient: {
            name: case_.patientName ?? case_.anonymousId,
            diagnosis: case_.diagnosis,
            bodyRegion: case_.injuredPart,
          },
          destination,
          latestIntake: intakeForAPI,
          soapNotes: evalSummary,
        }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error ?? 'AI生成に失敗しました')
      }
      const { content: generated } = await res.json()
      setContent({
        diagnosis: generated.diagnosis ?? case_.diagnosis,
        onset: generated.onset ?? '',
        symptoms: generated.symptoms ?? '',
        course: generated.course ?? '',
      })
      setGenerated(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'AI生成に失敗しました')
    } finally {
      setGenerating(false)
    }
  }

  function handlePrint() {
    const html = previewRef.current?.innerHTML ?? ''
    const win = window.open('', '_blank')
    if (!win) return
    win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8">
      <title>${letterType === 'referral' ? '御紹介書' : '御報告書'}</title>
      <style>
        body { font-family: 'Hiragino Mincho ProN', 'Yu Mincho', serif; font-size: 14px; line-height: 1.8; padding: 0; margin: 0; color: #111; }
        @page { margin: 20mm 25mm; }
        h2 { text-align: center; font-size: 18px; letter-spacing: 0.4em; }
        .whitespace-pre-wrap { white-space: pre-wrap; }
      </style>
      </head><body>${html}</body></html>`)
    win.document.close()
    win.print()
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col">
        {/* ヘッダー */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 flex-shrink-0">
          <div className="flex items-center gap-3">
            <FileText className="w-5 h-5 text-teal-600" />
            <h2 className="text-base font-bold text-gray-800">紹介状・報告書の作成</h2>
            <span className="text-sm text-gray-500">— {case_.patientName ?? case_.anonymousId}（{case_.diagnosis}）</span>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex flex-1 min-h-0">
          {/* 左パネル：入力 */}
          <div className="w-80 flex-shrink-0 border-r border-gray-200 p-5 overflow-y-auto space-y-5">
            {/* 種別切替 */}
            <div>
              <p className="text-xs font-semibold text-gray-500 mb-2">書類の種類</p>
              <div className="flex gap-2">
                <button
                  onClick={() => { setLetterType('referral'); setGenerated(false) }}
                  className={`flex-1 py-2 text-sm font-medium rounded-lg border transition-colors ${letterType === 'referral' ? 'bg-teal-600 text-white border-teal-600' : 'border-gray-200 text-gray-600 hover:border-teal-300'}`}
                >
                  <FileText className="w-3.5 h-3.5 inline mr-1" />紹介状
                </button>
                <button
                  onClick={() => { setLetterType('report'); setGenerated(false) }}
                  className={`flex-1 py-2 text-sm font-medium rounded-lg border transition-colors ${letterType === 'report' ? 'bg-teal-600 text-white border-teal-600' : 'border-gray-200 text-gray-600 hover:border-teal-300'}`}
                >
                  <ClipboardList className="w-3.5 h-3.5 inline mr-1" />報告書
                </button>
              </div>
            </div>

            {/* 患者情報 */}
            <div className="bg-gray-50 rounded-xl p-3 text-xs space-y-1 text-gray-600">
              <p className="font-semibold text-gray-700 mb-1">患者情報</p>
              <p>氏名：{case_.patientName ?? case_.anonymousId}</p>
              <p>診断：{case_.diagnosis}（{case_.injuredPart}）</p>
              <p>年齢：{case_.age}歳　{case_.gender === 'male' ? '男性' : case_.gender === 'female' ? '女性' : 'その他'}</p>
              {case_.postOpDays != null && <p>術後：{case_.postOpDays}日目</p>}
              {evaluations.length > 0 && <p>評価データ：{evaluations.length}件</p>}
              {aiSummaries.length > 0 && <p>AI解析：{aiSummaries.length}件</p>}
            </div>

            {/* 紹介先 */}
            <div className="space-y-3">
              <p className="text-xs font-semibold text-gray-500">{letterType === 'referral' ? '紹介先' : '報告先'}</p>
              <div>
                <label className="text-xs text-gray-500 block mb-1">医療機関名 <span className="text-red-500">必須</span></label>
                <input
                  value={destination.institution}
                  onChange={e => setDestination(d => ({ ...d, institution: e.target.value }))}
                  placeholder="例：下関整形外科クリニック"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">診療科</label>
                <input
                  value={destination.department}
                  onChange={e => setDestination(d => ({ ...d, department: e.target.value }))}
                  placeholder="例：整形外科"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">医師名 <span className="text-red-500">必須</span></label>
                <input
                  value={destination.doctor}
                  onChange={e => setDestination(d => ({ ...d, doctor: e.target.value }))}
                  placeholder="例：山田 太郎"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
                />
              </div>
            </div>

            {error && (
              <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg p-3 text-xs text-red-700">
                <AlertCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                {error}
              </div>
            )}

            <button
              onClick={handleGenerate}
              disabled={generating}
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-teal-600 text-white rounded-xl text-sm font-medium hover:bg-teal-700 disabled:opacity-60 transition-colors"
            >
              <Sparkles className="w-4 h-4" />
              {generating ? 'AI生成中...' : '✨ AI生成'}
            </button>

            {generated && (
              <button
                onClick={handlePrint}
                className="w-full flex items-center justify-center gap-2 py-2.5 bg-white border border-gray-300 text-gray-700 rounded-xl text-sm font-medium hover:border-teal-400 hover:text-teal-700 transition-colors"
              >
                <Printer className="w-4 h-4" />
                🖨 印刷・PDF保存
              </button>
            )}
          </div>

          {/* 右パネル：プレビュー */}
          <div className="flex-1 overflow-y-auto p-6 bg-gray-50">
            <div ref={previewRef} className="bg-white rounded-xl border border-gray-200 shadow-sm p-8 max-w-2xl mx-auto">
              {letterType === 'referral' ? (
                <ReferralPreview case_={case_} destination={destination} content={content} />
              ) : (
                <ReportPreview case_={case_} destination={destination} content={content} />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
