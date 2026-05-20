'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { getCases, getCurrentUser, getComments } from '@/lib/rehab-store'
import type { RehabCase, User } from '@/types/rehab'
import { CASE_STATUS_LABELS, ROLE_LABELS } from '@/types/rehab'
import StatusBadge from './StatusBadge'
import TagBadge from './TagBadge'
import { AlertTriangle, Clock, FolderOpen, Plus, Video } from 'lucide-react'

export default function Dashboard() {
  const [user, setUser] = useState<User | null>(null)
  const [cases, setCases] = useState<RehabCase[]>([])

  useEffect(() => {
    setUser(getCurrentUser())
    setCases(getCases())
  }, [])

  const reviewPending = cases.filter(
    (c) => c.reviewers.includes(user?.id ?? '') && c.status !== 'closed',
  )
  const recentCases = [...cases]
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, 5)

  // Count cases with risk comments (type: 'risk')
  const riskCaseIds = new Set<string>()
  cases.forEach((c) => {
    c.videos.forEach((v) => {
      const comments = getComments(v.id)
      if (comments.some((cm) => cm.type === 'risk')) {
        riskCaseIds.add(c.id)
      }
    })
  })

  const stats = [
    { label: '総症例数', value: cases.length, color: 'text-[#1e3a5f]' },
    { label: '介入中', value: cases.filter((c) => c.status === 'intervention').length, color: 'text-yellow-600' },
    { label: '復帰前評価', value: cases.filter((c) => c.status === 'preReturn').length, color: 'text-purple-600' },
    { label: 'リスク症例', value: riskCaseIds.size, color: 'text-red-600' },
  ]

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">
          こんにちは、{user?.name ?? ''}さん
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          {ROLE_LABELS[user?.role ?? 'viewer']} · {user?.department}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {stats.map(({ label, value, color }) => (
          <div key={label} className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
            <div className={`text-3xl font-bold ${color}`}>{value}</div>
            <div className="text-sm text-gray-500 mt-1">{label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Review pending */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
          <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-100">
            <Clock className="w-4 h-4 text-[#0d9488]" />
            <h2 className="font-semibold text-gray-900">レビュー依頼中</h2>
            {reviewPending.length > 0 && (
              <span className="ml-auto bg-[#0d9488] text-white text-xs font-bold px-2 py-0.5 rounded-full">
                {reviewPending.length}
              </span>
            )}
          </div>
          <div className="divide-y divide-gray-50">
            {reviewPending.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">
                レビュー依頼中の症例はありません
              </p>
            ) : (
              reviewPending.map((c) => (
                <Link
                  key={c.id}
                  href={`/cases/${c.id}`}
                  className="flex items-center gap-3 px-5 py-3.5 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-900 truncate">
                        {c.patientName ?? c.anonymousId}
                      </span>
                      <StatusBadge status={c.status} />
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">{c.diagnosis}</div>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-gray-400">
                    <Video className="w-3 h-3" />
                    {c.videos.length}
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>

        {/* Recent cases */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
          <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-100">
            <FolderOpen className="w-4 h-4 text-[#0d9488]" />
            <h2 className="font-semibold text-gray-900">最近の症例</h2>
            <Link
              href="/cases"
              className="ml-auto text-xs text-[#0d9488] hover:underline font-medium"
            >
              すべて見る
            </Link>
          </div>
          <div className="divide-y divide-gray-50">
            {recentCases.map((c) => (
              <Link
                key={c.id}
                href={`/cases/${c.id}`}
                className="flex items-start gap-3 px-5 py-3.5 hover:bg-gray-50 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-gray-900 truncate">
                      {c.patientName ?? c.anonymousId}
                    </span>
                    <StatusBadge status={c.status} />
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">{c.diagnosis}</div>
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {c.tags.slice(0, 3).map((t) => (
                      <TagBadge key={t} tag={t} />
                    ))}
                  </div>
                </div>
                <div className="text-xs text-gray-400 whitespace-nowrap">
                  {c.updatedAt.slice(0, 10)}
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Risk alerts */}
        {riskCaseIds.size > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-xl shadow-sm col-span-1 lg:col-span-2">
            <div className="flex items-center gap-2 px-5 py-4 border-b border-red-200">
              <AlertTriangle className="w-4 h-4 text-red-600" />
              <h2 className="font-semibold text-red-800">リスクコメントあり</h2>
            </div>
            <div className="px-5 py-3">
              <p className="text-sm text-red-700 mb-3">
                以下の症例にリスクコメントが付いています。専門家による確認を推奨します。
              </p>
              <div className="flex flex-wrap gap-2">
                {cases
                  .filter((c) => riskCaseIds.has(c.id))
                  .map((c) => (
                    <Link
                      key={c.id}
                      href={`/cases/${c.id}`}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-red-300 rounded-lg text-sm text-red-800 hover:bg-red-50 transition-colors"
                    >
                      <AlertTriangle className="w-3.5 h-3.5" />
                      {c.patientName ?? c.anonymousId} — {c.diagnosis}
                    </Link>
                  ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Quick action */}
      <div className="mt-6 flex justify-end">
        <Link
          href="/cases/new"
          className="inline-flex items-center gap-2 bg-[#1e3a5f] hover:bg-[#162d4a] text-white font-medium px-5 py-2.5 rounded-xl transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" />
          新規症例登録
        </Link>
      </div>
    </div>
  )
}
