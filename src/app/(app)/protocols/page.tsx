'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { getPatients, getProtocolsByPatient } from '@/lib/protocol-store'
import type { ProtocolPatient, Protocol } from '@/types/protocol'
import { JOINT_LABELS } from '@/types/protocol'
import { resolveChartPatient } from '@/lib/clinical-sync'
import DisclaimerBanner from '@/components/protocol/DisclaimerBanner'
import {
  Plus, ChevronRight, Cpu, FileText,
  ShieldAlert, CheckCircle, Clock, ClipboardList,
  Users, Activity, Link2, ArrowRight,
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

  // カルテ連携の解決（明示リンク or 氏名一致）
  const linkedMap = useMemo(() => {
    const map = new Map<string, boolean>()
    for (const { patient } of items) {
      map.set(patient.id, !!resolveChartPatient(patient).patient)
    }
    return map
  }, [items])

  return (
    <>
      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          デスクトップ: プロトコル概況ダッシュボード
          （旧: 空状態の案内のみ → 統計・最近のプロトコル・導線を表示）
      ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <div className="hidden md:block max-w-3xl mx-auto font-body">
        {(() => {
          const withProtocol = items.filter(i => i.latestProtocol)
          const watchCount = withProtocol.filter(i => {
            const ph = i.latestProtocol!.phases[i.latestProtocol!.currentPhaseIndex]
            return (ph?.redFlags?.length ?? 0) > 0
          }).length
          const readyCount = withProtocol.filter(i => {
            const p = i.latestProtocol!
            const c = p.phases[p.currentPhaseIndex]?.advanceCriteria ?? []
            return c.length > 0 && c.every(x => x.met) && p.currentPhaseIndex < p.phases.length - 1
          }).length
          const linkedCount = items.filter(i => linkedMap.get(i.patient.id)).length
          const recent = [...withProtocol]
            .sort((a, b) => b.latestProtocol!.updatedAt.localeCompare(a.latestProtocol!.updatedAt))
            .slice(0, 5)

          return (
            <div className="space-y-5">
              {/* ヘッダー */}
              <div className="flex items-center justify-between animate-slide-up">
                <div>
                  <h1 className="text-xl font-bold text-[--color-text-primary] font-display">
                    リハビリプロトコル
                  </h1>
                  <p className="text-sm text-[--color-text-muted] mt-0.5">
                    左の一覧から症例を選択するか、下の最近のプロトコルから開けます
                  </p>
                </div>
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

              {/* 統計カード */}
              <div className="grid grid-cols-4 gap-3 animate-slide-up delay-75">
                {[
                  { Icon: ClipboardList, label: '症例', value: items.length, tint: 'text-[--color-primary]', bg: 'bg-[--color-primary-light]' },
                  { Icon: Activity, label: '稼働中プロトコル', value: withProtocol.length, tint: 'text-sky-600', bg: 'bg-sky-50' },
                  { Icon: ShieldAlert, label: '要観察', value: watchCount, tint: 'text-red-500', bg: 'bg-red-50' },
                  { Icon: Link2, label: 'カルテ連携済み', value: linkedCount, tint: 'text-teal-600', bg: 'bg-teal-50' },
                ].map(({ Icon, label, value, tint, bg }) => (
                  <div key={label} className="bg-[--color-surface-card] rounded-2xl border border-slate-200 p-4 shadow-sm">
                    <div className={`w-8 h-8 rounded-lg ${bg} flex items-center justify-center mb-2.5`}>
                      <Icon className={`w-4 h-4 ${tint}`} />
                    </div>
                    <div className="metric text-2xl font-bold text-[--color-text-primary] leading-none">{value}</div>
                    <div className="text-[11px] text-[--color-text-muted] mt-1">{label}</div>
                  </div>
                ))}
              </div>

              {/* 次フェーズへ進める症例（基準達成） */}
              {readyCount > 0 && (
                <div className="flex items-center gap-2.5 bg-emerald-50 border border-emerald-200
                  rounded-xl px-4 py-3 animate-slide-up delay-100">
                  <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  <span className="text-sm text-emerald-800 font-body">
                    <span className="font-bold">{readyCount}件</span>の症例が移行基準をすべて達成しています。次フェーズへの進行を検討してください。
                  </span>
                </div>
              )}

              {/* 最近のプロトコル */}
              <div className="bg-[--color-surface-card] rounded-2xl border border-slate-200 shadow-sm overflow-hidden animate-slide-up delay-150">
                <div className="px-5 py-3 border-b border-slate-100 bg-[--color-surface-raised]">
                  <span className="text-[10px] font-bold text-[--color-text-muted] font-display uppercase tracking-widest">
                    最近更新されたプロトコル
                  </span>
                </div>
                {recent.length === 0 ? (
                  <div className="text-center py-12">
                    <FileText className="w-8 h-8 text-slate-300 mx-auto mb-3" />
                    <p className="text-sm text-[--color-text-muted] mb-4">プロトコルはまだありません</p>
                    <Link
                      href="/protocols/new"
                      className="inline-flex items-center gap-2 text-sm text-[--color-primary] font-semibold hover:underline"
                    >
                      <Plus className="w-4 h-4" />最初のプロトコルを作成
                    </Link>
                  </div>
                ) : (
                  recent.map(({ patient, latestProtocol }) => {
                    const p = latestProtocol!
                    const pct = Math.round(((p.currentPhaseIndex) / Math.max(1, p.phases.length)) * 100)
                    const linked = linkedMap.get(patient.id)
                    return (
                      <Link
                        key={p.id}
                        href={`/protocols/${p.id}`}
                        className="flex items-center gap-4 px-5 py-3.5 border-b border-slate-100 last:border-b-0
                          hover:bg-[--color-surface-raised] transition-colors group"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-semibold text-[--color-text-primary] font-display">
                              {patient.name ?? '匿名患者'}
                            </span>
                            {patient.joint && (
                              <span className="text-[10px] text-[--color-text-secondary] bg-[--color-surface-raised]
                                border border-slate-200 rounded px-1.5 py-0.5 font-display font-semibold">
                                {JOINT_LABELS[patient.joint]}
                              </span>
                            )}
                            {linked && (
                              <span className="inline-flex items-center gap-1 text-[10px] text-teal-700
                                bg-teal-50 border border-teal-200 rounded-full px-1.5 py-0.5 font-semibold">
                                <Link2 className="w-2.5 h-2.5" />カルテ連携
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-[--color-text-muted] truncate mt-0.5">{p.title}</div>
                        </div>
                        {/* フェーズ進行ミニバー */}
                        <div className="w-32 flex-shrink-0">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[9px] text-[--color-text-muted] font-display uppercase tracking-wide">
                              Phase {p.currentPhaseIndex + 1}/{p.phases.length}
                            </span>
                            <span className="metric text-[9px] text-[--color-text-muted]">{pct}%</span>
                          </div>
                          <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full bg-[--color-primary] rounded-full transition-all"
                              style={{ width: `${Math.max(4, pct)}%` }} />
                          </div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-[--color-primary] transition-colors flex-shrink-0" />
                      </Link>
                    )
                  })
                )}
              </div>

              {/* クイックリンク */}
              <div className="grid grid-cols-2 gap-3 animate-slide-up delay-200">
                <Link
                  href="/patients/dashboard"
                  className="flex items-center gap-3 bg-[--color-surface-card] rounded-2xl border border-slate-200
                    px-4 py-3.5 shadow-sm hover:border-[--color-primary]/40 hover:shadow-md transition-all group"
                >
                  <span className="w-9 h-9 rounded-xl bg-sky-50 flex items-center justify-center">
                    <Activity className="w-4 h-4 text-sky-600" />
                  </span>
                  <span className="flex-1">
                    <span className="block text-sm font-semibold text-[--color-text-primary] font-display">リハビリ状況</span>
                    <span className="block text-[11px] text-[--color-text-muted]">全患者の進行とリスクを俯瞰</span>
                  </span>
                  <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-[--color-primary] transition-colors" />
                </Link>
                <Link
                  href="/patients"
                  className="flex items-center gap-3 bg-[--color-surface-card] rounded-2xl border border-slate-200
                    px-4 py-3.5 shadow-sm hover:border-[--color-primary]/40 hover:shadow-md transition-all group"
                >
                  <span className="w-9 h-9 rounded-xl bg-teal-50 flex items-center justify-center">
                    <Users className="w-4 h-4 text-teal-600" />
                  </span>
                  <span className="flex-1">
                    <span className="block text-sm font-semibold text-[--color-text-primary] font-display">患者管理（カルテ）</span>
                    <span className="block text-[11px] text-[--color-text-muted]">来院記録・評価・スペシャルテスト</span>
                  </span>
                  <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-[--color-primary] transition-colors" />
                </Link>
              </div>
            </div>
          )
        })()}
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
                      {linkedMap.get(patient.id) && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold font-display
                          text-teal-700 bg-teal-50 border border-teal-200 px-1.5 py-0.5 rounded-full">
                          <Link2 className="w-2.5 h-2.5" />カルテ連携
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
