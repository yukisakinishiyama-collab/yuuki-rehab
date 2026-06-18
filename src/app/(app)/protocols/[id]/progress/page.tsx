'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { Protocol, ProtocolPatient, Assessment } from '@/types/protocol'
import {
  getProtocolById, getPatientById, getAssessmentsByProtocol,
  saveAssessment, deleteAssessment
} from '@/lib/protocol-store'
import ProgressChart from '@/components/protocol/ProgressChart'
import AssessmentForm from '@/components/protocol/AssessmentForm'
import MilestonePanel from '@/components/protocol/MilestonePanel'
import DisclaimerBanner from '@/components/protocol/DisclaimerBanner'
import {
  Plus, ChevronRight, Trash2, Calendar, BarChart2, Trophy, TrendingUp
} from 'lucide-react'

type Tab = 'chart' | 'records' | 'milestones'

const METRIC_LABEL_MAP: Record<string, string> = {
  pain:     '疼痛(NRS)',
  nrs:      '疼痛(NRS)',
  rom_flex: 'ROM屈曲(°)',
  rom_ext:  'ROM伸展(°)',
  lsi:      'LSI(%)',
  mmt:      'MMT',
  swelling: '浮腫(cm)',
}

export default function ProgressPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [protocol, setProtocol] = useState<Protocol | null>(null)
  const [patient, setPatient] = useState<ProtocolPatient | null>(null)
  const [assessments, setAssessments] = useState<Assessment[]>([])
  const [showForm, setShowForm] = useState(false)
  const [tab, setTab] = useState<Tab>('chart')

  function reload() {
    const p = getProtocolById(id)
    if (!p) { router.replace('/protocols'); return }
    setProtocol(p)
    setPatient(getPatientById(p.patientId))
    setAssessments(getAssessmentsByProtocol(id).sort((a, b) => a.date.localeCompare(b.date)))
  }

  // eslint-disable-next-line react-hooks/set-state-in-effect, react-hooks/exhaustive-deps
  useEffect(() => { reload() }, [id])

  function handleSave(data: Omit<Assessment, 'id'>) {
    saveAssessment(data)
    setShowForm(false)
    reload()
  }

  function handleDelete(assessmentId: string) {
    if (!confirm('この記録を削除しますか？')) return
    deleteAssessment(assessmentId)
    reload()
  }

  if (!protocol || !patient) return null

  const TABS = [
    { key: 'chart' as const,      label: 'トレンドグラフ', icon: BarChart2 },
    { key: 'records' as const,    label: '記録一覧',       icon: Calendar },
    { key: 'milestones' as const, label: 'マイルストーン', icon: Trophy },
  ]

  return (
    <div className="max-w-4xl mx-auto font-body">
      <div className="no-print mb-2">
        <DisclaimerBanner compact />
      </div>

      {/* パンくず */}
      <div className="flex items-center gap-2 text-xs text-[--color-text-muted] mb-3 font-body animate-slide-up">
        <Link href="/protocols" className="hover:text-[--color-primary] transition-colors">プロトコル一覧</Link>
        <ChevronRight className="w-3 h-3" />
        <Link href={`/protocols/${id}`} className="hover:text-[--color-primary] transition-colors truncate max-w-[200px]">
          {protocol.title}
        </Link>
        <ChevronRight className="w-3 h-3" />
        <span>進捗管理</span>
      </div>

      {/* ヘッダー */}
      <div className="flex items-center justify-between mb-5 animate-slide-up delay-75">
        <div>
          <h1 className="text-xl font-bold text-[--color-text-primary] font-display">進捗管理</h1>
          <div className="text-sm text-[--color-text-secondary] font-body">
            {patient.name ?? '匿名患者'} · {protocol.title}
          </div>
        </div>
        <button
          onClick={() => setShowForm(v => !v)}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold font-display
            transition-colors shadow-sm ${
            showForm
              ? 'bg-slate-200 text-slate-700 hover:bg-slate-300'
              : 'bg-[--color-primary] text-white hover:bg-[--color-primary-hover]'
          }`}
        >
          <Plus className={`w-4 h-4 transition-transform ${showForm ? 'rotate-45' : ''}`} />
          {showForm ? '閉じる' : '評価を記録'}
        </button>
      </div>

      {/* 評価入力フォーム */}
      {showForm && (
        <div className="bg-[--color-surface-card] rounded-2xl border border-slate-200 p-5 mb-5 shadow-sm animate-scale-in">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-7 h-7 rounded-lg bg-[--color-primary-light] flex items-center justify-center">
              <TrendingUp className="w-3.5 h-3.5 text-[--color-primary]" />
            </div>
            <h3 className="text-sm font-bold text-[--color-text-primary] font-display">新規評価記録</h3>
          </div>
          <AssessmentForm
            patientId={patient.id}
            protocolId={protocol.id}
            phases={protocol.phases}
            currentPhaseIndex={protocol.currentPhaseIndex}
            onSave={handleSave}
            onCancel={() => setShowForm(false)}
          />
        </div>
      )}

      {/* タブ */}
      <div className="flex border-b border-slate-200 mb-5 animate-slide-up delay-150">
        {TABS.map(({ key, label, icon: Icon }) => (
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

      {/* トレンドグラフ */}
      {tab === 'chart' && (
        <div className="bg-[--color-surface-card] rounded-2xl border border-slate-200 p-5 shadow-sm animate-slide-up">
          <div className="flex items-center justify-between mb-4">
            <div className="text-sm font-bold text-[--color-text-primary] font-display">評価指標のトレンド</div>
            {assessments.length > 0 && (
              <div className="metric text-xs text-[--color-text-muted]">
                {assessments.length}件 · 最終 {new Date(assessments[assessments.length - 1].date).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' })}
              </div>
            )}
          </div>
          <ProgressChart assessments={assessments} />

          {/* 移行基準ゲージ ─ 現フェーズの進行条件を計器的に表示 */}
          {(() => {
            const criteria = protocol.phases[protocol.currentPhaseIndex]?.advanceCriteria ?? []
            if (criteria.length === 0) return null
            const metCount  = criteria.filter(c => c.met).length
            const total     = criteria.length
            const pct       = Math.round((metCount / total) * 100)
            const allMet    = metCount === total
            return (
              <div className="mt-5 pt-5 border-t border-slate-100">
                {/* ヘッダー */}
                <div className="flex items-center justify-between mb-3">
                  <div className="text-[10px] font-bold text-[--color-text-secondary] font-display uppercase tracking-widest">
                    フェーズ移行基準
                  </div>
                  <div className={`metric text-xs font-bold ${allMet ? 'text-[--color-success]' : 'text-[--color-text-muted]'}`}>
                    {metCount} / {total} 達成
                  </div>
                </div>

                {/* ゲージバー */}
                <div className="flex items-center gap-3 mb-3">
                  <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-700 ${
                        allMet
                          ? 'bg-[--color-success]'
                          : 'bg-gradient-to-r from-[--color-primary] to-[--color-primary-mid]'
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="metric text-xs text-[--color-text-muted] flex-shrink-0 w-8 text-right">
                    {pct}%
                  </span>
                </div>

                {/* 条件チップ */}
                <div className="flex flex-wrap gap-2">
                  {criteria.map((c, i) => (
                    <div
                      key={i}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs border font-body transition-all duration-300 ${
                        c.met
                          ? 'bg-[--color-primary-light] border-[--color-primary]/30 text-[--color-primary-hover]'
                          : 'bg-[--color-surface-raised] border-slate-200 text-[--color-text-secondary]'
                      }`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 transition-colors ${
                        c.met ? 'bg-[--color-primary]' : 'bg-slate-300'
                      }`} />
                      <span className="font-medium">{c.label}</span>
                      {c.target && (
                        <span className="metric text-[--color-text-muted] text-[10px]">
                          {c.target}
                        </span>
                      )}
                    </div>
                  ))}
                </div>

                {allMet && (
                  <p className="mt-3 text-xs text-[--color-success] font-body font-medium">
                    すべての移行基準を達成しました。次フェーズへの進行を検討してください。
                  </p>
                )}
              </div>
            )
          })()}
        </div>
      )}

      {/* 記録一覧 */}
      {tab === 'records' && (
        <div className="space-y-3 animate-slide-up">
          {assessments.length === 0 ? (
            <div className="text-center py-14 bg-[--color-surface-card] rounded-2xl border-2 border-dashed border-slate-200">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-3">
                <Calendar className="w-6 h-6 text-slate-400" />
              </div>
              <div className="text-sm font-semibold text-[--color-text-primary] font-display mb-1">
                まだ評価記録がありません
              </div>
              <button
                onClick={() => setShowForm(true)}
                className="mt-3 text-sm text-[--color-primary] hover:underline font-body"
              >
                最初の記録を追加する
              </button>
            </div>
          ) : (
            [...assessments].reverse().map((a, idx) => {
              const phaseName = protocol.phases.find(ph => ph.id === a.phaseId)?.title
              return (
                <div
                  key={a.id}
                  className="bg-[--color-surface-card] rounded-xl border border-slate-200 p-4 shadow-sm
                    hover:border-[--color-primary]/20 transition-colors animate-slide-up"
                  style={{ animationDelay: `${idx * 40}ms` }}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="text-sm font-bold text-[--color-text-primary] font-display">
                        {new Date(a.date).toLocaleDateString('ja-JP', {
                          year: 'numeric', month: 'long', day: 'numeric'
                        })}
                      </div>
                      {phaseName && (
                        <div className="text-xs text-[--color-primary] font-body mt-0.5">{phaseName}</div>
                      )}
                    </div>
                    <button
                      onClick={() => handleDelete(a.id)}
                      className="text-red-400 hover:text-red-600 transition-colors p-1 -mr-1"
                      aria-label="記録を削除"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(a.metrics).map(([key, val]) => (
                      <div key={key} className="bg-[--color-surface-raised] rounded-lg px-3 py-1.5 text-sm">
                        <span className="text-[--color-text-muted] text-xs font-body">
                          {METRIC_LABEL_MAP[key] ?? key}：
                        </span>
                        <span className="metric font-bold text-[--color-text-primary]">{val}</span>
                      </div>
                    ))}
                  </div>
                  {a.notes && (
                    <div className="text-xs text-[--color-text-muted] mt-2 italic font-body">{a.notes}</div>
                  )}
                </div>
              )
            })
          )}
        </div>
      )}

      {/* マイルストーン */}
      {tab === 'milestones' && (
        <div className="bg-[--color-surface-card] rounded-2xl border border-slate-200 p-5 shadow-sm animate-slide-up">
          <MilestonePanel patientId={patient.id} />
        </div>
      )}
    </div>
  )
}
