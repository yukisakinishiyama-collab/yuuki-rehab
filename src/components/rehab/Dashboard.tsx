'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { getCases, getCurrentUser, updateDeliveryStatus, saveCase, generateId } from '@/lib/rehab-store'
import type { RehabCase, DeliveryStatus, ServiceType } from '@/types/rehab'
import { DELIVERY_STATUS_LABELS, DELIVERY_STATUS_COLORS } from '@/types/rehab'
import { Inbox, Loader2, CheckCircle, Send, Plus, Video, Clock, ChevronRight, Download } from 'lucide-react'

interface Submission {
  id: string; clientName: string; clientEmail: string; clientPhone?: string
  age?: number; gender: string; serviceType: string; sport: string
  requestNote?: string; videoPath: string; videoFileName: string
  createdAt: string; processed: boolean
}

export default function Dashboard() {
  const [user, setUser] = useState<{ name: string } | null>(null)
  const [cases, setCases] = useState<RehabCase[]>([])
  const [submissions, setSubmissions] = useState<Submission[]>([])

  useEffect(() => {
    setUser(getCurrentUser())
    setCases(getCases())
    fetch('/api/submit').then((r) => r.json()).then((d) => setSubmissions(d.filter((s: Submission) => !s.processed))).catch(() => {})
  }, [])

  const reload = () => { setCases(getCases()); fetch('/api/submit').then((r) => r.json()).then((d) => setSubmissions(d.filter((s: Submission) => !s.processed))).catch(() => {}) }

  // フォーム送信から案件として登録
  async function registerSubmission(s: Submission) {
    const currentUser = getCurrentUser()
    const newCase: RehabCase = {
      id: generateId('case'),
      anonymousId: `YML-${new Date().getFullYear()}-${String(Date.now()).slice(-4)}`,
      patientName: s.clientName,
      age: s.age ?? 0,
      gender: s.gender as 'male' | 'female' | 'other',
      diagnosis: s.sport,
      injuredPart: s.sport,
      evaluationPurpose: s.requestNote ?? s.sport,
      status: 'initial',
      assignedTo: currentUser ? [currentUser.id] : [],
      reviewers: [],
      tags: [s.sport],
      createdAt: s.createdAt,
      updatedAt: new Date().toISOString(),
      videos: [],
      clientEmail: s.clientEmail,
      clientPhone: s.clientPhone,
      sport: s.sport,
      serviceType: s.serviceType as ServiceType,
      deliveryStatus: 'received' as DeliveryStatus,
      requestNote: s.requestNote,
    }
    saveCase(newCase)
    // processed フラグをセット
    await fetch(`/api/submit/${s.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ processed: true }) }).catch(() => {})
    reload()
    window.location.href = `/cases/${newCase.id}`
  }

  const received  = cases.filter((c) => !c.deliveryStatus || c.deliveryStatus === 'received')
  const analyzing = cases.filter((c) => c.deliveryStatus === 'analyzing')
  const done      = cases.filter((c) => c.deliveryStatus === 'done')
  const sent      = cases.filter((c) => c.deliveryStatus === 'sent')
  const recent    = [...cases].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 6)

  const stats = [
    { label: '新着依頼',   value: received.length,  color: 'text-blue-600',   bg: 'bg-blue-50',   icon: Inbox },
    { label: '解析中',     value: analyzing.length, color: 'text-yellow-600', bg: 'bg-yellow-50', icon: Loader2 },
    { label: '解析完了',   value: done.length,      color: 'text-green-600',  bg: 'bg-green-50',  icon: CheckCircle },
    { label: '送付済み',   value: sent.length,      color: 'text-gray-500',   bg: 'bg-gray-50',   icon: Send },
  ]

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            こんにちは、{user?.name ?? ''}さん
          </h1>
          <p className="text-sm text-gray-500 mt-1">YUUKI MOTION LAB — 動作解析サービス管理</p>
        </div>
        <Link href="/cases/new"
          className="inline-flex items-center gap-2 bg-[#0d9488] hover:bg-[#0b8276] text-white font-medium px-4 py-2.5 rounded-xl transition-colors shadow-sm text-sm">
          <Plus className="w-4 h-4" />
          新規案件登録
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map(({ label, value, color, bg, icon: Icon }) => (
          <div key={label} className={`${bg} rounded-xl border border-gray-200 p-4 shadow-sm`}>
            <div className="flex items-center gap-2 mb-1">
              <Icon className={`w-4 h-4 ${color}`} />
              <span className="text-xs text-gray-500 font-medium">{label}</span>
            </div>
            <div className={`text-3xl font-bold ${color}`}>{value}</div>
          </div>
        ))}
      </div>

      {/* フォームからの新着依頼 */}
      {submissions.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl shadow-sm">
          <div className="flex items-center gap-2 px-5 py-4 border-b border-blue-200">
            <Download className="w-4 h-4 text-blue-600" />
            <h2 className="font-semibold text-blue-900">フォームからの新着依頼</h2>
            <span className="ml-auto bg-blue-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">{submissions.length}</span>
          </div>
          <div className="divide-y divide-blue-100">
            {submissions.map((s) => (
              <div key={s.id} className="flex items-start gap-3 px-5 py-3.5">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-blue-900">{s.clientName}</span>
                    <span className="text-xs text-blue-600">{s.sport}</span>
                  </div>
                  <div className="text-xs text-blue-700 mt-0.5">✉ {s.clientEmail}</div>
                  {s.requestNote && <div className="text-xs text-blue-600 mt-0.5 italic">"{s.requestNote}"</div>}
                  <div className="text-xs text-blue-400 mt-1">{s.createdAt.slice(0, 16).replace('T', ' ')} · {s.videoFileName}</div>
                </div>
                <button onClick={() => registerSubmission(s)}
                  className="flex-shrink-0 text-xs px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-medium">
                  案件として登録
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 新着・解析中 */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
          <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-100">
            <Inbox className="w-4 h-4 text-blue-500" />
            <h2 className="font-semibold text-gray-900">対応が必要な案件</h2>
            {(received.length + analyzing.length) > 0 && (
              <span className="ml-auto bg-blue-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                {received.length + analyzing.length}
              </span>
            )}
          </div>
          <div className="divide-y divide-gray-50">
            {[...received, ...analyzing].length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">対応中の案件はありません</p>
            ) : (
              [...received, ...analyzing].slice(0, 5).map((c) => (
                <div key={c.id} className="flex items-center gap-3 px-5 py-3.5 hover:bg-gray-50 transition-colors">
                  <Link href={`/cases/${c.id}`} className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-900 truncate">
                        {c.patientName ?? c.anonymousId}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${DELIVERY_STATUS_COLORS[c.deliveryStatus ?? 'received']}`}>
                        {DELIVERY_STATUS_LABELS[c.deliveryStatus ?? 'received']}
                      </span>
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5 flex items-center gap-2">
                      <span>{c.sport ?? c.diagnosis}</span>
                      {c.clientEmail && <span className="text-[#0d9488]">✉ {c.clientEmail}</span>}
                    </div>
                  </Link>
                  {/* ステータス変更 */}
                  {c.deliveryStatus === 'received' && (
                    <button onClick={() => { updateDeliveryStatus(c.id, 'analyzing'); reload() }}
                      className="text-xs px-2 py-1 bg-yellow-100 text-yellow-800 rounded-lg hover:bg-yellow-200 transition-colors whitespace-nowrap">
                      解析開始
                    </button>
                  )}
                  {c.deliveryStatus === 'analyzing' && (
                    <button onClick={() => { updateDeliveryStatus(c.id, 'done'); reload() }}
                      className="text-xs px-2 py-1 bg-green-100 text-green-800 rounded-lg hover:bg-green-200 transition-colors whitespace-nowrap">
                      解析完了
                    </button>
                  )}
                  <Link href={`/cases/${c.id}`} className="text-gray-300 hover:text-gray-500">
                    <ChevronRight className="w-4 h-4" />
                  </Link>
                </div>
              ))
            )}
          </div>
        </div>

        {/* 最近の案件 */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
          <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-100">
            <Clock className="w-4 h-4 text-[#0d9488]" />
            <h2 className="font-semibold text-gray-900">最近の案件</h2>
            <Link href="/cases" className="ml-auto text-xs text-[#0d9488] hover:underline font-medium">
              すべて見る
            </Link>
          </div>
          <div className="divide-y divide-gray-50">
            {recent.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">案件がまだありません</p>
            ) : recent.map((c) => (
              <Link key={c.id} href={`/cases/${c.id}`}
                className="flex items-start gap-3 px-5 py-3.5 hover:bg-gray-50 transition-colors">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-gray-900 truncate">
                      {c.patientName ?? c.anonymousId}
                    </span>
                    <span className={`text-xs px-1.5 py-0.5 rounded-full border ${DELIVERY_STATUS_COLORS[c.deliveryStatus ?? 'received']}`}>
                      {DELIVERY_STATUS_LABELS[c.deliveryStatus ?? 'received']}
                    </span>
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">{c.sport ?? c.diagnosis}</div>
                </div>
                <div className="flex items-center gap-1 text-xs text-gray-400 whitespace-nowrap">
                  <Video className="w-3 h-3" />
                  {c.videos.length}
                  <span className="ml-2">{c.updatedAt.slice(5, 10)}</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
