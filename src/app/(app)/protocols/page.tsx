'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { getPatients, getProtocolsByPatient } from '@/lib/protocol-store'
import type { ProtocolPatient, Protocol } from '@/types/protocol'
import { JOINT_LABELS } from '@/types/protocol'
import DisclaimerBanner from '@/components/protocol/DisclaimerBanner'
import {
  Plus, ChevronRight, Cpu, FileText,
  ShieldAlert, CheckCircle, Clock, ClipboardList,
} from 'lucide-react'

interface PatientWithProtocol {
  patient: ProtocolPatient
  latestProtocol: Protocol | null
}

export default function ProtocolListPage() {
  const [items, setItems] = useState<PatientWithProtocol[]>([])

  useEffect(() => {
    const patients = getPatients()
    const combined = patients.map(patient => {
      const protocols = getProtocolsByPatient(patient.id)
      const latestProtocol = protocols.sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] ?? null
      return { patient, latestProtocol }
    })
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setItems(combined)
  }, [])

  return (
    <>
      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          デスクトップ: 右ペインの空状態
          サイドバーで症例を選択するよう促す
      ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <div className="hidden md:flex flex-col items-center justify-center h-full
        text-center select-none">
        <div className="w-16 h-16 rounded-2xl bg-[--color-surface-raised] border border-slate-200
          flex items-center justify-center mb-5">
          <ClipboardList className="w-7 h-7 text-[--color-text-muted]" />
        </div>
        <h2 className="text-base font-bold text-[--color-text-primary] font-display mb-1.5">
          症例を選択してください
        </h2>
        <p className="text-sm text-[--color-text-muted] font-body mb-6 max-w-xs leading-relaxed">
          左の一覧から症例を選択するとプロトコルが表示されます。
        </p>
        <Link
          href="/protocols/new"
          className="inline-flex items-center gap-2 bg-[--color-primary] text-white
            px-5 py-2.5 rounded-xl text-sm font-semibold font-display
            hover:bg-[--color-primary-hover] transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" />
          新規プロトコルを作成
        </Link>
      </div>

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          モバイル: 臨床ダッシュボード（全画面リスト）
          デスクトップではサイドバーが代わりに担当
      ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <div className="md:hidden max-w-2xl mx-auto font-body">
        <DisclaimerBanner />

        <div className="flex items-center justify-between mb-5 animate-slide-up">
          <div>
            <h1 className="text-xl font-bold text-[--color-text-primary] font-display leading-tight">
              リハビリプロトコル
            </h1>
            <p className="text-sm text-[--color-text-muted] mt-0.5 font-body">
              {items.length > 0
                ? `${items.length} 症例 · ${items.filter(i => i.latestProtocol).length} プロトコル稼働中`
                : '症例を登録してプロトコルを立案'}
            </p>
          </div>
          <Link
            href="/protocols/new"
            className="flex items-center gap-2 bg-[--color-primary] text-white
              px-4 py-2.5 rounded-xl text-sm font-semibold font-display
              hover:bg-[--color-primary-hover] transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            新規
          </Link>
        </div>

        {items.length === 0 ? (
          <div className="text-center py-20 bg-[--color-surface-card] rounded-2xl
            border-2 border-dashed border-slate-200 animate-slide-up delay-75">
            <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
              <FileText className="w-6 h-6 text-slate-400" />
            </div>
            <div className="text-sm font-semibold text-[--color-text-primary] font-display mb-1">
              プロトコルがありません
            </div>
            <p className="text-sm text-[--color-text-muted] mb-5 font-body">
              患者情報を入力してプロトコルを生成しましょう
            </p>
            <Link
              href="/protocols/new"
              className="inline-flex items-center gap-2 bg-[--color-primary] text-white
                px-5 py-2.5 rounded-xl text-sm font-semibold font-display
                hover:bg-[--color-primary-hover] transition-colors"
            >
              <Plus className="w-4 h-4" />
              最初のプロトコルを作成
            </Link>
          </div>
        ) : (
          <div className="bg-[--color-surface-card] rounded-2xl border border-slate-200 overflow-hidden shadow-sm animate-slide-up delay-75">
            {/* テーブルヘッダー */}
            <div className="grid grid-cols-[1fr_auto] border-b border-slate-100
              px-5 py-2.5 bg-[--color-surface-raised]">
              <span className="text-[10px] font-bold text-[--color-text-muted] font-display uppercase tracking-widest">
                患者 / 診断
              </span>
              <div className="flex items-center gap-5 text-[10px] font-bold text-[--color-text-muted] font-display uppercase tracking-widest">
                <span className="w-14 text-center">フェーズ</span>
                <span className="w-12 text-center">術後日数</span>
                <span className="w-12 text-center">基準達成</span>
                <span className="w-5" />
              </div>
            </div>

            {items.map(({ patient, latestProtocol }, idx) => {
              // eslint-disable-next-line react-hooks/purity
              const nowMs = Date.now()
              const daysPast = patient.eventDate
                ? Math.floor((nowMs - new Date(patient.eventDate).getTime()) / 86400000)
                : null

              const currentPhase = latestProtocol?.phases[latestProtocol.currentPhaseIndex]
              const criteria  = currentPhase?.advanceCriteria ?? []
              const metCount  = criteria.filter(c => c.met).length
              const allMet    = criteria.length > 0 && metCount === criteria.length
              const hasRedFlags = (currentPhase?.redFlags?.length ?? 0) > 0
              const isComplete  = latestProtocol
                ? (latestProtocol.currentPhaseIndex >= latestProtocol.phases.length - 1 && allMet)
                : false

              return (
                <Link
                  key={patient.id}
                  href={latestProtocol
                    ? `/protocols/${latestProtocol.id}`
                    : `/protocols/new?patientId=${patient.id}`}
                  className="grid grid-cols-[1fr_auto] items-center gap-4 px-5 py-4
                    hover:bg-[--color-surface-raised] transition-colors
                    border-b border-slate-100 last:border-b-0 group animate-slide-up"
                  style={{ animationDelay: `${idx * 50 + 100}ms` }}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <span className="font-semibold text-[--color-text-primary] font-display text-sm">
                        {patient.name ?? '匿名患者'}
                      </span>
                      {patient.age && (
                        <span className="metric text-xs text-[--color-text-muted]">{patient.age}歳</span>
                      )}
                      {patient.joint && (
                        <span className="text-[10px] font-semibold font-display
                          bg-[--color-surface-raised] border border-slate-200
                          text-[--color-text-secondary] px-1.5 py-0.5 rounded">
                          {JOINT_LABELS[patient.joint]}
                        </span>
                      )}
                      {latestProtocol?.generatedBy === 'ai' && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold font-display
                          text-slate-600 bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded">
                          <Cpu className="w-2.5 h-2.5" />AI · 要確認
                        </span>
                      )}
                      {isComplete && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold font-display
                          text-[--color-success] bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded">
                          <CheckCircle className="w-2.5 h-2.5" />完了
                        </span>
                      )}
                      {hasRedFlags && !isComplete && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold font-display
                          text-red-600 bg-red-50 border border-red-200 px-1.5 py-0.5 rounded">
                          <ShieldAlert className="w-2.5 h-2.5" />要観察
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-[--color-text-secondary] truncate font-body">
                      {patient.diagnosis ?? '疾患名未入力'}
                      {latestProtocol && (
                        <span className="text-[--color-text-muted] ml-2 text-xs">— {latestProtocol.title}</span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-5 flex-shrink-0">
                    {latestProtocol ? (
                      <>
                        <div className="w-14 text-center">
                          <div className="metric text-base font-bold text-[--color-text-primary] leading-none">
                            {latestProtocol.currentPhaseIndex + 1}
                            <span className="text-[--color-text-muted] font-normal text-xs">/{latestProtocol.phases.length}</span>
                          </div>
                          <div className="text-[9px] text-[--color-text-muted] font-display uppercase tracking-wide mt-0.5">フェーズ</div>
                        </div>
                        <div className="w-12 text-center">
                          {daysPast !== null ? (
                            <>
                              <div className="metric text-base font-bold text-[--color-text-primary] leading-none">{daysPast}</div>
                              <div className="text-[9px] text-[--color-text-muted] font-display uppercase tracking-wide mt-0.5">日目</div>
                            </>
                          ) : (
                            <Clock className="w-4 h-4 text-slate-300 mx-auto" />
                          )}
                        </div>
                        <div className="w-12 text-center">
                          {criteria.length > 0 ? (
                            <>
                              <div className={`metric text-base font-bold leading-none ${allMet ? 'text-[--color-success]' : 'text-[--color-text-primary]'}`}>
                                {metCount}<span className={`font-normal text-xs ${allMet ? 'text-emerald-400' : 'text-[--color-text-muted]'}`}>/{criteria.length}</span>
                              </div>
                              <div className="text-[9px] text-[--color-text-muted] font-display uppercase tracking-wide mt-0.5">基準</div>
                            </>
                          ) : (
                            <span className="text-[--color-text-muted] text-sm">—</span>
                          )}
                        </div>
                      </>
                    ) : (
                      <span className="text-xs text-[--color-text-muted] font-body italic">未作成</span>
                    )}
                    <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-[--color-primary] transition-colors flex-shrink-0 w-5" />
                  </div>
                </Link>
              )
            })}
          </div>
        )}

        {items.length > 0 && (
          <div className="flex items-center gap-4 mt-3 px-1 animate-slide-up delay-300">
            <span className="flex items-center gap-1 text-[10px] text-[--color-text-muted] font-body">
              <ShieldAlert className="w-3 h-3 text-red-400" />要観察：現フェーズに red flags あり
            </span>
            <span className="flex items-center gap-1 text-[10px] text-[--color-text-muted] font-body">
              <CheckCircle className="w-3 h-3 text-[--color-success]" />完了：全基準達成
            </span>
          </div>
        )}
      </div>
    </>
  )
}
