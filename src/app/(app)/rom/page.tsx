'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { UserPlus, Search, ChevronRight, Activity, Calendar } from 'lucide-react'
import { getPatients, getSessionsByPatient } from '@/lib/rom-store'
import type { ROMPatient, ROMSession } from '@/types/rom'
import { JOINT_LABELS, SIDE_LABELS } from '@/types/rom'

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

function PatientCard({ patient }: { patient: ROMPatient }) {
  const [lastSession, setLastSession] = useState<ROMSession | null>(null)

  useEffect(() => {
    const sessions = getSessionsByPatient(patient.id)
    setLastSession(sessions[0] ?? null)
  }, [patient.id])

  const age = calcAge(patient.birthDate)

  return (
    <Link href={`/rom/patients/${patient.id}`}>
      <div className="bg-white rounded-2xl border border-slate-200 p-4 hover:border-teal-400 hover:shadow-md transition-all active:scale-[0.99]">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-lg font-bold text-slate-800">{patient.name}</span>
              <span className="text-sm text-slate-500">{age}歳・{patient.gender === 'male' ? '男性' : patient.gender === 'female' ? '女性' : 'その他'}</span>
            </div>
            <p className="text-sm text-slate-600 truncate">{patient.diagnosis}</p>
            {patient.affectedSide !== 'none' && (
              <span className="inline-block mt-1 text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">
                {SIDE_LABELS[patient.affectedSide]}患側
              </span>
            )}
          </div>
          <ChevronRight className="w-5 h-5 text-slate-400 flex-shrink-0 mt-1" />
        </div>

        {lastSession && (
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center gap-2 text-xs text-slate-500">
            <Calendar className="w-3.5 h-3.5" />
            <span>最終測定: {formatDate(lastSession.measuredAt)}</span>
            <span className="ml-auto bg-teal-50 text-teal-700 px-2 py-0.5 rounded-full font-medium">
              {JOINT_LABELS[lastSession.joint]}
            </span>
          </div>
        )}

        {!lastSession && (
          <div className="mt-3 pt-3 border-t border-slate-100 text-xs text-slate-400">
            まだ測定がありません
          </div>
        )}
      </div>
    </Link>
  )
}

export default function ROMIndexPage() {
  const [patients, setPatients] = useState<ROMPatient[]>([])
  const [query, setQuery] = useState('')

  useEffect(() => {
    setPatients(getPatients())
  }, [])

  const filtered = patients.filter(
    (p) =>
      p.name.includes(query) ||
      p.nameKana.includes(query) ||
      p.diagnosis.includes(query)
  )

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-teal-500 to-teal-700 flex items-center justify-center shadow">
            <Activity className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800">可動域ノート</h1>
            <p className="text-xs text-slate-500">ROM評価・記録・比較</p>
          </div>
        </div>
        <Link
          href="/rom/patients/new"
          className="flex items-center gap-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium px-4 py-2.5 rounded-xl transition-colors shadow-sm"
        >
          <UserPlus className="w-4 h-4" />
          患者追加
        </Link>
      </div>

      {/* Search */}
      <div className="relative mb-5">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          placeholder="氏名・かな・診断名で検索"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent"
        />
      </div>

      {/* Patient list */}
      {filtered.length === 0 ? (
        <div className="text-center py-16">
          <Activity className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 font-medium">
            {query ? '検索結果がありません' : '患者が登録されていません'}
          </p>
          {!query && (
            <Link
              href="/rom/patients/new"
              className="mt-4 inline-flex items-center gap-2 text-teal-600 text-sm font-medium hover:underline"
            >
              <UserPlus className="w-4 h-4" />
              最初の患者を追加する
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-slate-500 px-1">{filtered.length}名</p>
          {filtered.map((p) => (
            <PatientCard key={p.id} patient={p} />
          ))}
        </div>
      )}
    </div>
  )
}
