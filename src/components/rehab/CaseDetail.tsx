'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { getCase } from '@/lib/rehab-store'
import type { RehabCase } from '@/types/rehab'
import { MOCK_USERS } from '@/lib/rehab-data'
import StatusBadge from './StatusBadge'
import TagBadge from './TagBadge'
import VideoGrid from './VideoGrid'
import VideoUpload from './VideoUpload'
import ReportView from './ReportView'
import { ArrowLeft, Upload, FileText, Info, Video } from 'lucide-react'

interface Props {
  caseId: string
}

type Tab = 'videos' | 'upload' | 'report'

export default function CaseDetail({ caseId }: Props) {
  const [case_, setCase] = useState<RehabCase | null>(null)
  const searchParams = useSearchParams()
  const [tab, setTab] = useState<Tab>(
    searchParams.get('tab') === 'upload' ? 'upload' : 'videos'
  )

  function reload() {
    const c = getCase(caseId)
    setCase(c ?? null)
  }

  useEffect(() => {
    reload()
  }, [caseId])

  if (!case_) {
    return (
      <div className="text-center py-20 text-gray-400">
        <p>症例が見つかりません</p>
        <Link href="/cases" className="text-[#0d9488] hover:underline text-sm mt-2 inline-block">
          症例一覧へ戻る
        </Link>
      </div>
    )
  }

  const assignedUsers = MOCK_USERS.filter((u) => case_.assignedTo.includes(u.id))
  const reviewerUsers = MOCK_USERS.filter((u) => case_.reviewers.includes(u.id))

  const TABS: Array<{ key: Tab; label: string; icon: React.ElementType }> = [
    { key: 'videos', label: '動画一覧', icon: Video },
    { key: 'upload', label: '動画アップロード', icon: Upload },
    { key: 'report', label: 'レポート', icon: FileText },
  ]

  return (
    <div className="max-w-6xl mx-auto">
      {/* Breadcrumb */}
      <div className="mb-4">
        <Link
          href="/cases"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          症例一覧
        </Link>
      </div>

      {/* Header */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 mb-6">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <div className="flex items-center gap-3 flex-wrap mb-1">
              <h1 className="text-xl font-bold text-gray-900">
                {case_.patientName ?? case_.anonymousId}
              </h1>
              <StatusBadge status={case_.status} />
            </div>
            <p className="text-gray-600">{case_.diagnosis}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mb-4">
          <InfoItem label="匿名ID" value={case_.anonymousId} />
          <InfoItem label="年齢・性別" value={`${case_.age}歳 · ${case_.gender === 'male' ? '男性' : case_.gender === 'female' ? '女性' : 'その他'}`} />
          <InfoItem label="受傷部位" value={case_.injuredPart} />
          {case_.postOpDays != null && (
            <InfoItem label="術後日数" value={`${case_.postOpDays}日`} />
          )}
        </div>

        <div className="bg-blue-50 rounded-lg px-4 py-3 mb-4 flex items-start gap-2">
          <Info className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
          <div>
            <span className="text-xs font-semibold text-blue-800">評価目的</span>
            <p className="text-sm text-blue-900 mt-0.5">{case_.evaluationPurpose}</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-4 text-sm text-gray-600">
          <div>
            <span className="text-xs text-gray-400 block mb-1">担当者</span>
            <div className="flex gap-1 flex-wrap">
              {assignedUsers.map((u) => (
                <span key={u.id} className="px-2 py-0.5 bg-gray-100 rounded text-xs text-gray-700">{u.name}</span>
              ))}
            </div>
          </div>
          {reviewerUsers.length > 0 && (
            <div>
              <span className="text-xs text-gray-400 block mb-1">レビュー担当</span>
              <div className="flex gap-1 flex-wrap">
                {reviewerUsers.map((u) => (
                  <span key={u.id} className="px-2 py-0.5 bg-blue-50 rounded text-xs text-blue-700">{u.name}</span>
                ))}
              </div>
            </div>
          )}
          <div>
            <span className="text-xs text-gray-400 block mb-1">タグ</span>
            <div className="flex gap-1 flex-wrap">
              {case_.tags.map((t) => (
                <TagBadge key={t} tag={t} />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-white rounded-xl border border-gray-200 shadow-sm p-1.5 mb-6 w-fit">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === key
                ? 'bg-[#1e3a5f] text-white shadow-sm'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'videos' && (
        <VideoGrid videos={case_.videos} caseId={case_.id} onDeleted={reload} />
      )}

      {tab === 'upload' && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <h2 className="font-semibold text-gray-900 mb-4">動画アップロード</h2>
          <VideoUpload
            caseId={case_.id}
            onUploaded={() => { reload(); setTab('videos') }}
          />
        </div>
      )}

      {tab === 'report' && (
        <ReportView case_={case_} />
      )}
    </div>
  )
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-xs text-gray-400 block">{label}</span>
      <span className="text-gray-800 font-medium">{value}</span>
    </div>
  )
}
