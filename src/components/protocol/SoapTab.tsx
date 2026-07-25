'use client'

// プロトコル進捗ページ内の「来院記録（SOAP）」タブ
// リンク済みのカルテ患者に対して、既存のSOAPフォーム（患者管理と同一）で
// 記録の閲覧・作成を行う。データはすべて patient-store（カルテ側）に保存され、
// リハビリ状況ダッシュボード・患者詳細と完全に共有される。

import { useState, useMemo } from 'react'
import Link from 'next/link'
import type { ProtocolPatient } from '@/types/protocol'
import type { SOAPNote } from '@/types/patient'
import { PHASE_LABELS } from '@/types/patient'
import { getSOAPNotes } from '@/lib/patient-store'
import { resolveChartPatient, getChartPatientList } from '@/lib/clinical-sync'
import {
  NotebookPen, Plus, User, Link2, ChevronDown, ChevronUp, ExternalLink,
} from 'lucide-react'
import SOAPForm from '@/components/rehab-management/SOAPForm'

interface Props {
  protocolPatient: ProtocolPatient
  onLinkChart: (chartPatientId: string) => void
}

export default function SoapTab({ protocolPatient, onLinkChart }: Props) {
  const [showForm, setShowForm] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [selectedChartId, setSelectedChartId] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)

  const link = useMemo(
    () => resolveChartPatient(protocolPatient),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [protocolPatient, refreshKey],
  )
  const chartPatients = useMemo(() => getChartPatientList(), [])

  const notes: SOAPNote[] = useMemo(() => {
    if (!link.patient) return []
    return getSOAPNotes(link.patient.id).sort((a, b) => b.visitDate.localeCompare(a.visitDate))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [link.patient, refreshKey])

  // ── 未リンク: リンク導線 ──
  if (!link.patient) {
    return (
      <div className="bg-[--color-surface-card] rounded-2xl border border-slate-200 p-8 text-center">
        <Link2 className="w-8 h-8 text-slate-300 mx-auto mb-3" />
        <p className="text-sm font-semibold text-slate-600 mb-1">カルテ患者が未リンクです</p>
        <p className="text-xs text-slate-400 mb-4">
          カルテ患者とリンクすると、この画面から来院記録（SOAP）を書き込めます。<br />
          記録は患者管理・リハビリ状況と共有されます。
        </p>
        <div className="flex items-center justify-center gap-2">
          <select
            value={selectedChartId}
            onChange={e => setSelectedChartId(e.target.value)}
            className="text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white
              focus:outline-none focus:ring-2 focus:ring-teal-500/40"
          >
            <option value="">カルテ患者を選択...</option>
            {chartPatients.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          <button
            onClick={() => { if (selectedChartId) { onLinkChart(selectedChartId); setRefreshKey(k => k + 1) } }}
            disabled={!selectedChartId}
            className="text-sm font-bold text-white bg-teal-600 px-4 py-2 rounded-lg
              hover:bg-teal-700 disabled:opacity-40 transition-colors font-display"
          >
            リンクする
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* 記録先の患者を明示（誤記録防止） */}
      <div className="flex items-center justify-between gap-3 flex-wrap bg-[--color-surface-card]
        rounded-2xl border border-slate-200 px-4 py-3">
        <div className="flex items-center gap-2.5">
          <span className="w-8 h-8 rounded-full bg-teal-50 flex items-center justify-center">
            <User className="w-4 h-4 text-teal-600" />
          </span>
          <div>
            <div className="text-sm font-bold text-slate-800 font-display">
              記録先: {link.patient.name} 様
              <span className="text-[10px] font-normal text-slate-400 ml-1.5">（カルテと共有）</span>
            </div>
            <div className="metric text-xs text-slate-400">
              来院記録 {notes.length}件
              {notes[0] && ` · 最終 ${notes[0].visitDate}`}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/patients/${link.patient.id}`}
            className="flex items-center gap-1 text-xs text-slate-500 hover:text-teal-600
              border border-slate-200 rounded-lg px-2.5 py-2 transition-colors"
          >
            <ExternalLink className="w-3 h-3" />カルテを開く
          </Link>
          <button
            onClick={() => setShowForm(v => !v)}
            className={`flex items-center gap-1.5 text-sm font-bold px-3.5 py-2 rounded-lg
              transition-colors font-display ${
              showForm
                ? 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                : 'bg-teal-600 text-white hover:bg-teal-700'
            }`}
          >
            <Plus className={`w-3.5 h-3.5 transition-transform ${showForm ? 'rotate-45' : ''}`} />
            {showForm ? '閉じる' : '来院記録を書く'}
          </button>
        </div>
      </div>

      {/* SOAP入力（患者管理と同一フォームを再利用） */}
      {showForm && (
        <div className="bg-[--color-surface-card] rounded-2xl border border-teal-200 p-4">
          <SOAPForm
            patientId={link.patient.id}
            onSaved={() => { setShowForm(false); setRefreshKey(k => k + 1) }}
          />
        </div>
      )}

      {/* 記録一覧 */}
      {notes.length === 0 ? (
        <div className="text-center py-10 bg-[--color-surface-card] rounded-2xl border-2 border-dashed border-slate-200">
          <NotebookPen className="w-7 h-7 text-slate-300 mx-auto mb-2" />
          <p className="text-sm text-slate-500 font-semibold mb-1">来院記録はまだありません</p>
          <p className="text-xs text-slate-400">「来院記録を書く」から最初のSOAP記録を作成できます</p>
        </div>
      ) : (
        <div className="space-y-2">
          {notes.slice(0, 10).map(note => {
            const expanded = expandedId === note.id
            const nrsColor = note.painToday >= 7 ? 'text-red-600'
              : note.painToday >= 4 ? 'text-amber-600' : 'text-emerald-600'
            return (
              <div key={note.id} className="bg-[--color-surface-card] rounded-xl border border-slate-200 overflow-hidden">
                <button
                  onClick={() => setExpandedId(expanded ? null : note.id)}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-50/60 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-slate-800 font-display">{note.visitDate}</span>
                      <span className="metric text-[10px] text-slate-400">#{note.visitNumber}</span>
                      {note.currentPhase && (
                        <span className="text-[10px] bg-teal-50 text-teal-700 border border-teal-100
                          rounded-full px-2 py-0.5 font-semibold">
                          {PHASE_LABELS[note.currentPhase] ?? `Phase ${note.currentPhase}`}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 truncate mt-0.5">
                      {note.changeFromLast || note.patientConcern || note.treatmentToday || '—'}
                    </p>
                  </div>
                  <span className={`metric text-sm font-bold flex-shrink-0 ${nrsColor}`}>
                    NRS {note.painToday}
                  </span>
                  {expanded
                    ? <ChevronUp className="w-4 h-4 text-slate-400 flex-shrink-0" />
                    : <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" />}
                </button>
                {expanded && (
                  <div className="px-4 pb-4 pt-1 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {([
                      ['S: 主観', [note.changeFromLast, note.patientConcern, note.adlDifficulty].filter(Boolean).join(' / ')],
                      ['O: 客観', [note.romFindings, note.strengthFindings, note.therapistObservation].filter(Boolean).join(' / ')],
                      ['A: 評価', [note.improvements, note.remainingIssues, note.priorityIssue].filter(Boolean).join(' / ')],
                      ['P: 計画', [note.treatmentToday, note.nextGoal, note.homeExercise].filter(Boolean).join(' / ')],
                    ] as const).map(([label, text]) => (
                      <div key={label}>
                        <div className="text-[10px] font-bold text-teal-700 font-display mb-1">{label}</div>
                        <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-wrap">
                          {text || '記載なし'}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
          {notes.length > 10 && (
            <Link
              href={`/patients/${link.patient.id}`}
              className="block text-center text-xs text-teal-600 hover:underline py-2"
            >
              すべての記録をカルテで見る（{notes.length}件）
            </Link>
          )}
        </div>
      )}
    </div>
  )
}
