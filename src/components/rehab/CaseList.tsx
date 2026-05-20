'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { getCases } from '@/lib/rehab-store'
import type { RehabCase, CaseStatus } from '@/types/rehab'
import { CASE_STATUS_LABELS } from '@/types/rehab'
import CaseCard from './CaseCard'
import { Plus, Search, Filter } from 'lucide-react'

const STATUS_OPTIONS: Array<{ value: CaseStatus | 'all'; label: string }> = [
  { value: 'all', label: 'すべて' },
  { value: 'initial', label: '初回評価' },
  { value: 'intervention', label: '介入中' },
  { value: 'preReturn', label: '復帰前評価' },
  { value: 'closed', label: '終了' },
]

export default function CaseList() {
  const [cases, setCases] = useState<RehabCase[]>([])
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<CaseStatus | 'all'>('all')

  useEffect(() => {
    setCases(getCases())
  }, [])

  const filtered = cases.filter((c) => {
    const matchStatus = statusFilter === 'all' || c.status === statusFilter
    const q = search.toLowerCase()
    const matchSearch =
      !q ||
      (c.patientName ?? '').toLowerCase().includes(q) ||
      c.anonymousId.toLowerCase().includes(q) ||
      c.diagnosis.toLowerCase().includes(q) ||
      c.injuredPart.toLowerCase().includes(q) ||
      c.tags.some((t) => t.toLowerCase().includes(q))
    return matchStatus && matchSearch
  })

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">症例管理</h1>
          <p className="text-sm text-gray-500 mt-1">{cases.length}件の症例が登録されています</p>
        </div>
        <Link
          href="/cases/new"
          className="inline-flex items-center gap-2 bg-[#1e3a5f] hover:bg-[#162d4a] text-white font-medium px-4 py-2.5 rounded-xl transition-colors shadow-sm text-sm"
        >
          <Plus className="w-4 h-4" />
          新規症例
        </Link>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 mb-6 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="患者名・ID・診断名・タグで検索..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0d9488] focus:border-transparent"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-400 flex-shrink-0" />
          <div className="flex gap-1.5 flex-wrap">
            {STATUS_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setStatusFilter(opt.value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  statusFilter === opt.value
                    ? 'bg-[#1e3a5f] text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Search className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p>該当する症例が見つかりません</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((c) => (
            <CaseCard key={c.id} case_={c} />
          ))}
        </div>
      )}
    </div>
  )
}
