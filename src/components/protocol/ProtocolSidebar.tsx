'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { getPatients, getProtocolsByPatient } from '@/lib/protocol-store'
import type { ProtocolPatient, Protocol } from '@/types/protocol'
import { JOINT_LABELS } from '@/types/protocol'
import { Plus, ShieldAlert, CheckCircle, Clock, Search, FileText } from 'lucide-react'

interface Item {
  patient: ProtocolPatient
  latestProtocol: Protocol | null
}

export default function ProtocolSidebar() {
  const pathname = usePathname()
  const [items, setItems]   = useState<Item[]>([])
  const [query, setQuery]   = useState('')

  /* パス変更のたびに再読み込み（新規作成後など） */
  useEffect(() => {
    const patients = getPatients()
    const combined = patients.map(patient => {
      const protocols = getProtocolsByPatient(patient.id)
      const latest = protocols
        .slice()
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] ?? null
      return { patient, latestProtocol: latest }
    })
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setItems(combined)
  }, [pathname])

  const filtered = query.trim()
    ? items.filter(({ patient }) =>
        (patient.name ?? '').includes(query) ||
        (patient.diagnosis ?? '').includes(query))
    : items

  return (
    <aside className="hidden md:flex flex-col w-64 flex-shrink-0
      border-r border-slate-200 bg-[--color-surface-card] overflow-hidden">

      {/* ヘッダー */}
      <div className="px-4 pt-4 pb-3 border-b border-slate-100 flex-shrink-0">
        <div className="flex items-center justify-between mb-2.5">
          <span className="text-[10px] font-bold text-[--color-text-muted] font-display
            uppercase tracking-widest">
            症例一覧
          </span>
          <Link
            href="/protocols/new"
            title="新規プロトコル"
            className="w-6 h-6 rounded-md bg-[--color-primary] text-white
              flex items-center justify-center hover:bg-[--color-primary-hover]
              transition-colors focus-visible:ring-2 focus-visible:ring-[--color-primary]"
          >
            <Plus className="w-3.5 h-3.5" />
          </Link>
        </div>

        {/* 検索 */}
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3
            text-[--color-text-muted] pointer-events-none" />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="患者名・診断名"
            className="w-full pl-7 pr-3 py-1.5 text-xs rounded-lg font-body
              bg-[--color-surface-raised] border border-slate-200
              text-[--color-text-primary] placeholder:text-[--color-text-muted]
              focus:outline-none focus:border-[--color-primary]
              focus:ring-1 focus:ring-[--color-primary]/40 transition-colors"
          />
        </div>
      </div>

      {/* 症例リスト */}
      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 gap-2
            text-[--color-text-muted]">
            <FileText className="w-6 h-6 opacity-25" />
            <p className="text-xs font-body">
              {query ? '一致する症例なし' : '症例がありません'}
            </p>
          </div>
        ) : (
          filtered.map(({ patient, latestProtocol }) => {
            const isActive = latestProtocol
              ? pathname.startsWith(`/protocols/${latestProtocol.id}`)
              : false

            const currentPhase = latestProtocol
              ? latestProtocol.phases[latestProtocol.currentPhaseIndex]
              : null
            const criteria  = currentPhase?.advanceCriteria ?? []
            const metCount  = criteria.filter(c => c.met).length
            const allMet    = criteria.length > 0 && metCount === criteria.length
            const hasFlags  = (currentPhase?.redFlags?.length ?? 0) > 0
            const daysPast  = patient.eventDate
              // eslint-disable-next-line react-hooks/purity
              ? Math.floor((Date.now() - new Date(patient.eventDate).getTime()) / 86400000)
              : null

            return (
              <Link
                key={patient.id}
                href={
                  latestProtocol
                    ? `/protocols/${latestProtocol.id}`
                    : `/protocols/new?patientId=${patient.id}`
                }
                className={`block px-4 py-3 border-b border-slate-100 transition-all duration-150
                  border-l-2 ${
                  isActive
                    ? 'bg-[--color-primary-light] border-l-[--color-primary]'
                    : 'border-l-transparent hover:bg-[--color-surface-raised]'
                }`}
              >
                {/* 行1: 患者名・年齢・フラグ */}
                <div className="flex items-start justify-between gap-1 mb-0.5">
                  <div className="flex items-baseline gap-1.5 min-w-0">
                    <span className={`text-sm font-semibold font-display truncate ${
                      isActive
                        ? 'text-[--color-primary-hover]'
                        : 'text-[--color-text-primary]'
                    }`}>
                      {patient.name ?? '匿名患者'}
                    </span>
                    {patient.age && (
                      <span className="metric text-[10px] text-[--color-text-muted] flex-shrink-0">
                        {patient.age}歳
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-0.5 flex-shrink-0 mt-0.5">
                    {hasFlags && !allMet && (
                      <ShieldAlert className="w-3 h-3 text-red-500" />
                    )}
                    {allMet && (
                      <CheckCircle className="w-3 h-3 text-[--color-success]" />
                    )}
                  </div>
                </div>

                {/* 行2: 診断名 */}
                <div className="text-[11px] text-[--color-text-muted] font-body truncate mb-1.5">
                  {patient.diagnosis ?? '—'}
                  {patient.joint && (
                    <span className="ml-1.5 text-[10px] bg-slate-100 text-[--color-text-secondary]
                      px-1 py-0.5 rounded font-display">
                      {JOINT_LABELS[patient.joint]}
                    </span>
                  )}
                </div>

                {/* 行3: 臨床指標チップ */}
                {latestProtocol && (
                  <div className="flex items-center gap-2.5">
                    <span className="metric text-[10px] text-[--color-text-secondary] font-semibold">
                      Ph.{latestProtocol.currentPhaseIndex + 1}
                      <span className="font-normal text-[--color-text-muted]">
                        /{latestProtocol.phases.length}
                      </span>
                    </span>

                    {daysPast !== null && (
                      <span className="metric text-[10px] text-[--color-text-muted]
                        flex items-center gap-0.5">
                        <Clock className="w-2.5 h-2.5" />{daysPast}d
                      </span>
                    )}

                    {criteria.length > 0 && (
                      <span className={`metric text-[10px] font-semibold ${
                        allMet
                          ? 'text-[--color-success]'
                          : 'text-[--color-text-muted]'
                      }`}>
                        {metCount}/{criteria.length}基準
                      </span>
                    )}
                  </div>
                )}
              </Link>
            )
          })
        )}
      </div>

      {/* フッター: 症例数 */}
      <div className="px-4 py-2.5 border-t border-slate-100 flex-shrink-0">
        <span className="text-[10px] text-[--color-text-muted] font-body">
          {items.length} 症例 · {items.filter(i => i.latestProtocol).length} プロトコル稼働中
        </span>
      </div>
    </aside>
  )
}
