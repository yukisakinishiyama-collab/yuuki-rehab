'use client'

import { useState, useMemo, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import PatientForm from '@/components/protocol/PatientForm'
import DisclaimerBanner from '@/components/protocol/DisclaimerBanner'
import type { ProtocolPatient, Joint } from '@/types/protocol'
import {
  savePatient, generateProtocolFromTemplate, saveProtocol
} from '@/lib/protocol-store'
import { nanoid } from 'nanoid'
import { Cpu, FileText, AlertCircle, ArrowLeft, CheckCircle } from 'lucide-react'

type Mode = 'select' | 'ai' | 'template'

function NewProtocolPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()

  // 問診票からの転記データをURLパラメータで受け取る
  const prefillData = useMemo(() => {
    const diagnosis = searchParams.get('diagnosis')
    const joint = searchParams.get('joint') as Joint | null
    if (!diagnosis && !joint) return undefined
    return {
      diagnosis: diagnosis ?? undefined,
      joint: joint ?? undefined,
      sport: searchParams.get('sport') ?? undefined,
      eventDate: searchParams.get('eventDate') ?? undefined,
      notes: searchParams.get('notes') ?? undefined,
    }
  }, [searchParams])

  const [mode, setMode] = useState<Mode>(prefillData ? 'template' : 'select')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [consentChecked, setConsentChecked] = useState(false)
  const [consentError, setConsentError] = useState(false)
  const [showConsentModal, setShowConsentModal] = useState(false)
  const [pendingData, setPendingData] = useState<Omit<ProtocolPatient, 'id' | 'createdAt' | 'updatedAt'> | null>(null)

  async function handleFormSubmit(data: Omit<ProtocolPatient, 'id' | 'createdAt' | 'updatedAt'>) {
    if (mode === 'ai') {
      setPendingData(data)
      setShowConsentModal(true)
      return
    }
    await generateProtocol(data, false)
  }

  async function generateProtocol(
    data: Omit<ProtocolPatient, 'id' | 'createdAt' | 'updatedAt'>,
    useAI: boolean,
  ) {
    setLoading(true)
    setError(null)
    try {
      const patient = savePatient(data)

      if (useAI) {
        const res = await fetch('/api/protocol-generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ patient: data, consentGiven: true }),
        })
        if (!res.ok) {
          const err = await res.json()
          throw new Error(err.error ?? 'AI生成に失敗しました')
        }
        const { protocol: aiData } = await res.json()

        const phases = aiData.phases.map((ph: Record<string, unknown>, i: number) => ({
          ...ph,
          id: nanoid(),
          order: i + 1,
        }))

        const protocol = saveProtocol({
          patientId: patient.id,
          title: aiData.title,
          phases,
          discussion: aiData.discussion ?? [],
          consensusNotes: aiData.consensusNotes ?? '',
          generatedBy: 'ai',
          currentPhaseIndex: 0,
        })

        router.push(`/protocols/${protocol.id}`)
      } else {
        const diagnosisKey = (data as Record<string, unknown>).diagnosisKey as string ?? ''
        const protocol = generateProtocolFromTemplate(
          patient.id,
          diagnosisKey,
          data.diagnosis,
          data.joint,
        )

        if (!protocol) {
          throw new Error('この疾患・関節のテンプレートが見つかりませんでした。疾患名か関節部位を変更してみてください。')
        }

        router.push(`/protocols/${protocol.id}`)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '生成に失敗しました')
      setLoading(false)
    }
  }

  if (mode === 'select') {
    return (
      <div className="max-w-2xl mx-auto font-body">
        <div className="mb-6 animate-slide-up">
          <h1 className="text-2xl font-bold text-[--color-text-primary] font-display">新規プロトコル作成</h1>
          <p className="text-sm text-[--color-text-secondary] mt-0.5">生成モードを選択してください</p>
        </div>

        <DisclaimerBanner />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          {/* テンプレートモード */}
          <button
            onClick={() => setMode('template')}
            className="text-left bg-[--color-surface-card] border-2 border-slate-200
              hover:border-[--color-primary]/50 rounded-2xl p-6 transition-all
              hover:shadow-md group animate-slide-up delay-75
              focus-visible:ring-2 focus-visible:ring-[--color-primary]"
          >
            <div className="w-12 h-12 rounded-xl bg-[--color-primary-light] flex items-center justify-center mb-4
              group-hover:bg-[--color-primary] transition-colors duration-300">
              <FileText className="w-5 h-5 text-[--color-primary] group-hover:text-white transition-colors duration-300" />
            </div>
            <div className="font-bold text-[--color-text-primary] font-display text-base mb-2">
              テンプレートモード
            </div>
            <div className="text-sm text-[--color-text-secondary] font-body leading-relaxed mb-3">
              エビデンスベースのテンプレートから即座にプロトコルを生成。
              ネット接続・APIキー不要。
            </div>
            <div className="inline-flex items-center gap-1.5 text-xs text-[--color-primary] font-semibold
              font-display bg-[--color-primary-light] px-2.5 py-1 rounded-full">
              <CheckCircle className="w-3 h-3" />推奨 · オフライン対応
            </div>
          </button>

          {/* AIモード */}
          <button
            onClick={() => setMode('ai')}
            className="text-left bg-[--color-surface-card] border-2 border-slate-200
              hover:border-purple-400/60 rounded-2xl p-6 transition-all
              hover:shadow-md group animate-slide-up delay-150
              focus-visible:ring-2 focus-visible:ring-purple-400"
          >
            <div className="w-12 h-12 rounded-xl bg-purple-50 flex items-center justify-center mb-4
              group-hover:bg-purple-600 transition-colors duration-300">
              <Cpu className="w-5 h-5 text-purple-600 group-hover:text-white transition-colors duration-300" />
            </div>
            <div className="font-bold text-[--color-text-primary] font-display text-base mb-2">
              AIモード
            </div>
            <div className="text-sm text-[--color-text-secondary] font-body leading-relaxed mb-3">
              Claude AIが患者情報から個別に最適化したプロトコルを生成。
              APIキーの設定が必要です。
            </div>
            <div className="inline-flex items-center gap-1.5 text-xs text-purple-700 font-semibold
              font-display bg-purple-50 px-2.5 py-1 rounded-full border border-purple-200/80">
              <Cpu className="w-3 h-3" />要 APIキー · 個別最適化
            </div>
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto font-body">
      <div className="flex items-center gap-3 mb-6 animate-slide-up">
        <button
          onClick={() => setMode('select')}
          className="flex items-center gap-1.5 text-sm text-[--color-text-secondary]
            hover:text-[--color-text-primary] transition-colors font-body"
        >
          <ArrowLeft className="w-4 h-4" />モード選択
        </button>
        <span className="text-slate-300">/</span>
        <div className="flex items-center gap-1.5">
          {mode === 'ai' ? (
            <>
              <Cpu className="w-4 h-4 text-purple-600" />
              <span className="text-sm font-semibold text-purple-700 font-display">AIモード</span>
            </>
          ) : (
            <>
              <FileText className="w-4 h-4 text-[--color-primary]" />
              <span className="text-sm font-semibold text-[--color-primary] font-display">テンプレートモード</span>
            </>
          )}
        </div>
      </div>

      <div className="animate-slide-up delay-75">
        <h1 className="text-2xl font-bold text-[--color-text-primary] font-display mb-1">患者情報の入力</h1>
        <p className="text-sm text-[--color-text-secondary] mb-4 font-body">
          疾患名か関節部位のどちらかを入力すればプロトコルを生成できます
        </p>
      </div>

      <DisclaimerBanner />

      {/* 問診票からの転記バナー */}
      {prefillData && (
        <div className="flex items-center gap-2 bg-teal-50 border border-teal-200 rounded-xl px-4 py-2.5 my-3 text-sm text-teal-800 font-body animate-slide-up">
          <span className="text-base">📋</span>
          問診票のデータを転記しました。内容を確認・修正してからプロトコルを生成してください。
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 my-3 text-sm text-red-700 font-body animate-slide-up">
          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          {error}
        </div>
      )}

      <div className="bg-[--color-surface-card] rounded-2xl border border-slate-200 p-5 mt-2 shadow-sm animate-slide-up delay-150">
        <PatientForm onSubmit={handleFormSubmit} loading={loading} initial={prefillData} />
      </div>

      {/* AI同意モーダル */}
      {showConsentModal && pendingData && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[--color-surface-card] rounded-2xl shadow-2xl max-w-md w-full p-6 animate-scale-in">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-xl bg-purple-100 flex items-center justify-center">
                <Cpu className="w-4 h-4 text-purple-600" />
              </div>
              <h3 className="text-lg font-bold text-[--color-text-primary] font-display">
                情報送信の確認
              </h3>
            </div>
            <p className="text-sm text-[--color-text-secondary] mb-4 font-body leading-relaxed">
              AIプロトコル生成では、入力した患者情報をAnthropicのAPIサーバーに送信します。
              患者の個人を特定できる情報（氏名・生年月日等）は入力しないことを強く推奨します。
            </p>
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4 text-xs text-amber-800 font-body">
              送信する情報：疾患名、関節部位、年齢、スポーツ種目、経過日数、補足メモ
            </div>
            <label className={`flex items-start gap-2.5 cursor-pointer group p-3 rounded-xl transition-colors
              ${consentError ? 'bg-red-50 ring-1 ring-red-300' : 'hover:bg-slate-50'}`}
              onClick={() => setConsentError(false)}
            >
              <input
                type="checkbox"
                checked={consentChecked}
                onChange={e => { setConsentChecked(e.target.checked); setConsentError(false) }}
                className="mt-0.5 w-4 h-4 accent-[--color-primary] cursor-pointer flex-shrink-0"
              />
              <span className="text-sm text-[--color-text-primary] font-body leading-relaxed">
                上記を理解し、個人を特定できる情報を含まないことを確認しました
              </span>
            </label>
            {consentError && (
              <p className="text-xs text-red-600 font-body mt-1.5 flex items-center gap-1">
                <AlertCircle className="w-3 h-3 flex-shrink-0" />
                チェックを入れてから「AI生成を開始」を押してください
              </p>
            )}
            <div className="flex gap-3 mt-4">
              <button
                onClick={async () => {
                  if (!consentChecked) { setConsentError(true); return }
                  setConsentError(false)
                  setShowConsentModal(false)
                  await generateProtocol(pendingData!, true)
                }}
                disabled={loading}
                className="flex-1 bg-[#4c1d95] text-white py-2.5 rounded-xl text-sm font-bold
                  font-display hover:bg-[#3b1578] disabled:opacity-60 transition-colors
                  tracking-wide"
              >
                {loading ? '生成中...' : 'AI生成を開始'}
              </button>
              <button
                onClick={() => { setShowConsentModal(false); setConsentError(false) }}
                className="flex-1 bg-[--color-surface-raised] text-[--color-text-secondary] py-2.5 rounded-xl text-sm
                  hover:bg-slate-200 transition-colors font-body"
              >
                キャンセル
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function NewProtocolPage() {
  return (
    <Suspense>
      <NewProtocolPageInner />
    </Suspense>
  )
}
