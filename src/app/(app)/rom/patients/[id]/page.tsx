'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, PlusCircle, BarChart2, GitCompareArrows,
  HeartPulse, FileText, Trash2, ChevronRight, Calendar,
} from 'lucide-react'
import { getPatient, getSessionsByPatient, deletePatient, deleteSession } from '@/lib/rom-store'
import type { ROMPatient, ROMSession } from '@/types/rom'
import { JOINT_LABELS, SIDE_LABELS, GENDER_LABELS } from '@/types/rom'

function calcAge(birthDate: string): number {
  const birth = new Date(birthDate)
  const today = new Date()
  let age = today.getFullYear() - birth.getFullYear()
  const m = today.getMonth() - birth.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--
  return age
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`
}

function SessionCard({
  session,
  prevSession,
  onDelete,
}: {
  session: ROMSession
  prevSession: ROMSession | null
  onDelete: (id: string) => void
}) {
  const [expanded, setExpanded] = useState(false)

  const highlights = session.records.slice(0, 3).map((r) => {
    const prev = prevSession?.records.find(
      (pr) => pr.direction === r.direction && pr.side === r.side
    )
    const diff = prev && r.arom !== null && prev.arom !== null ? r.arom - prev.arom : null

    return { r, diff }
  })

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left p-4 flex items-start justify-between gap-3"
      >
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-base font-bold text-slate-800">{JOINT_LABELS[session.joint]}</span>
            <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
              第{session.sessionNumber}回
            </span>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Calendar className="w-3.5 h-3.5" />
            {formatDate(session.measuredAt)}
            <span>・</span>
            <span>{session.measuredBy}</span>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {highlights.map(({ r, diff }) => (
              <span
                key={`${r.direction}-${r.side}`}
                className="text-xs bg-teal-50 text-teal-800 px-2 py-1 rounded-lg"
              >
                {r.direction}
                {r.side !== 'none' && ` (${SIDE_LABELS[r.side]})`}
                {r.arom !== null && ` ${r.arom}°`}
                {diff !== null && (
                  <span className={diff >= 0 ? 'text-green-600 ml-1' : 'text-red-500 ml-1'}>
                    {diff >= 0 ? `↑${diff}` : `↓${Math.abs(diff)}`}
                  </span>
                )}
                {r.hasPain && <span className="text-orange-500 ml-1">⚠</span>}
              </span>
            ))}
          </div>
        </div>
        <ChevronRight className={`w-4 h-4 text-slate-400 flex-shrink-0 mt-1 transition-transform ${expanded ? 'rotate-90' : ''}`} />
      </button>

      {expanded && (
        <div className="border-t border-slate-100 px-4 py-3 space-y-2">
          {session.records.map((r) => (
            <div key={r.id} className="flex items-center text-sm gap-2">
              <span className="font-medium text-slate-700 w-24 flex-shrink-0">
                {r.direction}
                {r.side !== 'none' && ` (${SIDE_LABELS[r.side]})`}
              </span>
              <span className="text-slate-600">
                AROM: {r.arom ?? '－'}°
              </span>
              <span className="text-slate-400">|</span>
              <span className="text-slate-600">
                PROM: {r.prom ?? '－'}°
              </span>
              {r.hasPain && (
                <span className="text-orange-500 text-xs">
                  痛み {r.painAngle}°
                </span>
              )}
            </div>
          ))}
          {session.overallNote && (
            <p className="text-xs text-slate-500 pt-1 border-t border-slate-100 mt-2">
              {session.overallNote}
            </p>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(session.id) }}
            className="flex items-center gap-1.5 text-xs text-red-400 hover:text-red-600 transition-colors mt-2"
          >
            <Trash2 className="w-3.5 h-3.5" />
            この測定を削除
          </button>
        </div>
      )}
    </div>
  )
}

export default function PatientDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [patient, setPatient] = useState<ROMPatient | null>(null)
  const [sessions, setSessions] = useState<ROMSession[]>([])
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    setPatient(getPatient(id) ?? null)
    setSessions(getSessionsByPatient(id))
  }, [id])

  function handleDeleteSession(sessionId: string) {
    deleteSession(sessionId)
    setSessions(getSessionsByPatient(id))
  }

  function handleDeletePatient() {
    deletePatient(id)
    router.push('/rom')
  }

  if (!patient) {
    return (
      <div className="text-center py-20 text-slate-500">
        患者が見つかりません
      </div>
    )
  }

  const age = calcAge(patient.birthDate)

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <Link href="/rom" className="p-2 rounded-xl hover:bg-slate-100 text-slate-500 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-xl font-bold text-slate-800">{patient.name}</h1>
      </div>

      {/* Patient info card */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 mb-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-slate-500">{patient.nameKana}</p>
            <p className="text-sm text-slate-600 mt-1">
              {age}歳・{GENDER_LABELS[patient.gender]}
            </p>
            <p className="text-base font-semibold text-slate-800 mt-1">{patient.diagnosis}</p>
            {patient.affectedSide !== 'none' && (
              <span className="inline-block mt-1.5 text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">
                {SIDE_LABELS[patient.affectedSide]}患側
              </span>
            )}
          </div>
          <div className="text-right text-xs text-slate-400 space-y-1">
            {patient.injuryDate && <p>受傷: {formatDate(patient.injuryDate)}</p>}
            {patient.surgeryDate && <p>手術: {formatDate(patient.surgeryDate)}</p>}
          </div>
        </div>
        {patient.notes && (
          <p className="mt-3 pt-3 border-t border-slate-100 text-sm text-slate-600">{patient.notes}</p>
        )}
      </div>

      {/* Action buttons */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <Link
          href={`/rom/patients/${id}/sessions/new`}
          className="flex items-center justify-center gap-2 bg-teal-600 hover:bg-teal-700 text-white font-semibold py-3.5 rounded-2xl transition-colors shadow-sm"
        >
          <PlusCircle className="w-5 h-5" />
          新規測定
        </Link>
        <Link
          href={`/rom/patients/${id}/explain`}
          className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3.5 rounded-2xl transition-colors shadow-sm"
        >
          <HeartPulse className="w-5 h-5" />
          患者説明
        </Link>
        <Link
          href={`/rom/patients/${id}/compare`}
          className="flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-700 text-white font-semibold py-3.5 rounded-2xl transition-colors shadow-sm"
        >
          <GitCompareArrows className="w-5 h-5" />
          左右比較
        </Link>
        <Link
          href={`/rom/patients/${id}/graph`}
          className="flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-600 text-white font-semibold py-3.5 rounded-2xl transition-colors shadow-sm"
        >
          <BarChart2 className="w-5 h-5" />
          経過グラフ
        </Link>
      </div>

      {/* Sessions */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base font-semibold text-slate-700">測定履歴</h2>
        <span className="text-xs text-slate-500">{sessions.length}回</span>
      </div>

      {sessions.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-2xl border border-slate-200">
          <FileText className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 text-sm">まだ測定データがありません</p>
          <Link
            href={`/rom/patients/${id}/sessions/new`}
            className="mt-3 inline-flex items-center gap-2 text-teal-600 text-sm font-medium hover:underline"
          >
            <PlusCircle className="w-4 h-4" />
            最初の測定を始める
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {sessions.map((session, idx) => (
            <SessionCard
              key={session.id}
              session={session}
              prevSession={sessions[idx + 1] ?? null}
              onDelete={handleDeleteSession}
            />
          ))}
        </div>
      )}

      {/* Delete patient */}
      <div className="mt-8 pt-6 border-t border-slate-200">
        {!confirmDelete ? (
          <button
            onClick={() => setConfirmDelete(true)}
            className="flex items-center gap-2 text-sm text-red-400 hover:text-red-600 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            この患者を削除する
          </button>
        ) : (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4">
            <p className="text-sm text-red-700 mb-3 font-medium">
              {patient.name}さんの全データを削除します。この操作は元に戻せません。
            </p>
            <div className="flex gap-3">
              <button
                onClick={handleDeletePatient}
                className="flex-1 bg-red-600 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-red-700"
              >
                削除する
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                className="flex-1 bg-white border border-slate-300 text-slate-700 py-2.5 rounded-xl text-sm font-semibold hover:bg-slate-50"
              >
                キャンセル
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
