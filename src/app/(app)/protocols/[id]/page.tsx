'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { Protocol, ProtocolPatient } from '@/types/protocol'
import {
  getProtocolById, getPatientById, updatePhase, advancePhase, deleteProtocol
} from '@/lib/protocol-store'
import PhaseCard from '@/components/protocol/PhaseCard'
import ExpertPanel from '@/components/protocol/ExpertPanel'
import DisclaimerBanner from '@/components/protocol/DisclaimerBanner'
import {
  ArrowRight, ChevronRight, Printer, Trash2, User, MonitorPlay,
  BarChart2, MessageSquare, Cpu, FileText, AlertCircle, CheckCircle,
} from 'lucide-react'
import type { Phase } from '@/types/protocol'

type Tab = 'protocol' | 'discussion'

export default function ProtocolDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [protocol, setProtocol] = useState<Protocol | null>(null)
  const [patient, setPatient] = useState<ProtocolPatient | null>(null)
  const [tab, setTab] = useState<Tab>('protocol')
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    const p = getProtocolById(id)
    if (!p) { router.replace('/protocols'); return }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setProtocol(p)
    setPatient(getPatientById(p.patientId))
  }, [id, router])

  function handlePhaseUpdate(phaseId: string, updates: Partial<Phase>) {
    if (!protocol) return
    updatePhase(protocol.id, phaseId, updates)
    setProtocol(getProtocolById(protocol.id))
  }

  function handleAdvancePhase() {
    if (!protocol) return
    if (protocol.currentPhaseIndex >= protocol.phases.length - 1) return
    advancePhase(protocol.id)
    setProtocol(getProtocolById(protocol.id))
  }

  function handleDelete() {
    if (!protocol) return
    deleteProtocol(protocol.id)
    router.replace('/protocols')
  }

  if (!protocol || !patient) {
    return (
      <div className="flex items-center justify-center h-64 text-[--color-text-muted] font-body">
        <div className="text-center">
          <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-40" />
          <div className="text-sm">読み込み中...</div>
        </div>
      </div>
    )
  }

  const currentPhase = protocol.phases[protocol.currentPhaseIndex]
  const allCriteriaMet = currentPhase?.advanceCriteria.every(c => c.met) ?? false
  const canAdvance = allCriteriaMet && protocol.currentPhaseIndex < protocol.phases.length - 1
  const isComplete = allCriteriaMet && protocol.currentPhaseIndex === protocol.phases.length - 1

  return (
    <div className="max-w-4xl mx-auto font-body">
      {/* 免責（印刷時は表示） */}
      <div className="no-print mb-2">
        <DisclaimerBanner compact />
      </div>

      {/* パンくず + アクションヘッダー */}
      <div className="flex items-start justify-between mb-5 mt-1 animate-slide-up">
        <div className="min-w-0 flex-1 mr-4">
          <div className="flex items-center gap-2 text-xs text-[--color-text-muted] mb-2 font-body">
            <Link href="/protocols" className="hover:text-[--color-primary] transition-colors">
              プロトコル一覧
            </Link>
            <ChevronRight className="w-3 h-3" />
            <span className="truncate max-w-[200px]">{protocol.title}</span>
          </div>
          <h1 className="text-xl font-bold text-[--color-text-primary] font-display leading-tight mb-1.5">
            {protocol.title}
          </h1>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="flex items-center gap-1.5 text-sm text-[--color-text-secondary] font-body">
              <User className="w-3.5 h-3.5" />
              {patient.name ?? '匿名患者'}
              {patient.age && <span className="metric">· {patient.age}歳</span>}
            </span>
            {protocol.generatedBy === 'ai' && (
              <span className="inline-flex items-center gap-1 text-xs text-purple-700
                bg-purple-50 border border-purple-200/80 px-2 py-0.5 rounded-full font-display font-semibold">
                <Cpu className="w-3 h-3" />AI生成 · 要臨床確認
              </span>
            )}
            {protocol.generatedBy === 'template' && (
              <span className="inline-flex items-center gap-1 text-xs text-[--color-primary]
                bg-[--color-primary-light] px-2 py-0.5 rounded-full font-display font-semibold">
                <FileText className="w-3 h-3" />テンプレート
              </span>
            )}
          </div>
        </div>

        {/* アクションボタン */}
        <div className="flex items-center gap-2 no-print flex-shrink-0">
          <button
            onClick={() => window.print()}
            title="印刷"
            className="p-2.5 rounded-xl border border-slate-200 bg-[--color-surface-card]
              hover:bg-[--color-surface-raised] transition-colors text-slate-500 hover:text-slate-700"
          >
            <Printer className="w-4 h-4" />
          </button>
          <Link
            href={`/protocols/${id}/patient-view`}
            className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl border border-slate-200
              bg-[--color-surface-card] hover:bg-[--color-surface-raised] transition-colors
              text-sm text-slate-600 font-body"
          >
            <MonitorPlay className="w-3.5 h-3.5 text-[--color-primary]" />
            <span className="hidden sm:inline">患者提示</span>
          </Link>
          <Link
            href={`/protocols/${id}/progress`}
            className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-[--color-primary]
              text-white hover:bg-[--color-primary-hover] transition-colors text-sm font-semibold font-display shadow-sm"
          >
            <BarChart2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">進捗管理</span>
          </Link>
        </div>
      </div>

      {/* フェーズジャーニーカード */}
      <div className="bg-[--color-surface-card] rounded-2xl border border-slate-200 p-5 mb-4 shadow-sm animate-slide-up delay-75">
        <div className="flex items-center justify-between mb-4">
          <div className="text-xs font-bold text-[--color-text-secondary] font-display uppercase tracking-widest">
            フェーズ進行状況
          </div>
          <div className="metric text-xs text-[--color-text-muted] font-semibold">
            {protocol.currentPhaseIndex + 1} / {protocol.phases.length} フェーズ
          </div>
        </div>

        {/* ジャーニーステッパー */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1">
          {protocol.phases.map((ph, i) => {
            const done   = i < protocol.currentPhaseIndex
            const active = i === protocol.currentPhaseIndex
            return (
              <div key={ph.id} className="flex items-center gap-1 flex-shrink-0">
                <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs
                  font-semibold font-display transition-all duration-300 ${
                  done   ? 'bg-emerald-500 text-white' :
                  active ? 'bg-[--color-primary] text-white shadow-[0_0_0_3px_rgba(13,148,136,0.2)]' :
                           'bg-[--color-surface-raised] text-[--color-text-muted] border border-slate-200'
                }`}>
                  {done ? <CheckCircle className="w-3 h-3" /> : (
                    <span className="metric">{ph.order}</span>
                  )}
                  <span className="hidden sm:inline">{ph.title}</span>
                </div>
                {i < protocol.phases.length - 1 && (
                  <ArrowRight className={`w-3 h-3 flex-shrink-0 ${
                    done ? 'text-emerald-400' : 'text-slate-300'
                  }`} />
                )}
              </div>
            )
          })}
        </div>

        {/* フェーズ進行ボタン */}
        {canAdvance && (
          <div className="mt-4 pt-4 border-t border-slate-100">
            <button
              onClick={handleAdvancePhase}
              className="w-full flex items-center justify-center gap-2
                bg-gradient-to-r from-[--color-primary] to-teal-500 text-white
                py-3 rounded-xl text-sm font-bold font-display
                hover:opacity-90 transition-opacity shadow-sm"
            >
              <ArrowRight className="w-4 h-4" />
              次フェーズへ進む：{protocol.phases[protocol.currentPhaseIndex + 1]?.title}
            </button>
          </div>
        )}
        {isComplete && (
          <div className="mt-4 pt-4 border-t border-slate-100 text-center">
            <span className="inline-flex items-center gap-2 text-sm text-emerald-600 font-bold font-display
              bg-emerald-50 px-4 py-2 rounded-full border border-emerald-200">
              <CheckCircle className="w-4 h-4" />全フェーズ完了
            </span>
          </div>
        )}
      </div>

      {/* タブ */}
      <div className="flex border-b border-slate-200 mb-5 no-print animate-slide-up delay-150">
        {([
          { key: 'protocol', label: 'プロトコル', icon: FileText },
          { key: 'discussion', label: '専門家ディスカッション', icon: MessageSquare },
        ] as const).map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-1.5 px-4 py-3 text-sm font-semibold
              border-b-2 transition-all duration-200 font-display ${
              tab === key
                ? 'border-[--color-primary] text-[--color-primary]'
                : 'border-transparent text-[--color-text-muted] hover:text-[--color-text-secondary]'
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      {/* コンテンツ */}
      {tab === 'protocol' && (
        <div className="space-y-3">
          {protocol.phases.map((phase, i) => (
            <div key={phase.id} className="animate-slide-up" style={{ animationDelay: `${i * 60}ms` }}>
              <PhaseCard
                phase={phase}
                isActive={i === protocol.currentPhaseIndex}
                isCompleted={i < protocol.currentPhaseIndex}
                onUpdate={(updates) => handlePhaseUpdate(phase.id, updates)}
              />
            </div>
          ))}
        </div>
      )}

      {tab === 'discussion' && (
        <ExpertPanel
          discussion={protocol.discussion}
          consensusNotes={protocol.consensusNotes}
          generatedBy={protocol.generatedBy}
        />
      )}

      {/* 削除ゾーン */}
      <div className="mt-10 pt-5 border-t border-slate-100 no-print">
        {!confirmDelete ? (
          <button
            onClick={() => setConfirmDelete(true)}
            className="flex items-center gap-1.5 text-sm text-red-400 hover:text-red-600
              transition-colors font-body"
          >
            <Trash2 className="w-3.5 h-3.5" />このプロトコルを削除
          </button>
        ) : (
          <div className="flex items-center gap-3">
            <span className="text-sm text-red-600 font-body">本当に削除しますか？</span>
            <button
              onClick={handleDelete}
              className="text-sm bg-red-500 text-white px-3 py-1.5 rounded-lg
                hover:bg-red-600 transition-colors font-display font-semibold"
            >
              削除
            </button>
            <button
              onClick={() => setConfirmDelete(false)}
              className="text-sm text-[--color-text-secondary] hover:text-[--color-text-primary]
                transition-colors font-body"
            >
              キャンセル
            </button>
          </div>
        )}
      </div>

      {/* 印刷用免責 */}
      <div className="hidden print:block mt-6 text-xs text-gray-400 border-t pt-4 font-body">
        本プロトコルは臨床意思決定支援を目的とし、医療行為・確定診断を代替しません。最終判断は有資格の医療者が行ってください。
        生成日時: {new Date(protocol.createdAt).toLocaleString('ja-JP')}
      </div>
    </div>
  )
}
