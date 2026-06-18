'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { Protocol, ProtocolPatient, Assessment } from '@/types/protocol'
import {
  getProtocolById, getPatientById, getAssessmentsByProtocol
} from '@/lib/protocol-store'
import PatientView from '@/components/protocol/PatientView'
import { ArrowLeft, MonitorPlay } from 'lucide-react'

export default function PatientViewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [protocol, setProtocol]     = useState<Protocol | null>(null)
  const [patient, setPatient]       = useState<ProtocolPatient | null>(null)
  const [assessments, setAssessments] = useState<Assessment[]>([])

  useEffect(() => {
    const p = getProtocolById(id)
    if (!p) { router.replace('/protocols'); return }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setProtocol(p)
    setPatient(getPatientById(p.patientId))
    setAssessments(getAssessmentsByProtocol(id))
  }, [id, router])

  if (!protocol || !patient) return null

  return (
    <div className="min-h-screen bg-gradient-to-b from-teal-50/60 to-[--color-surface] pb-12">

      {/* スティッキーヘッダー ─ サブ画面であることを明示 */}
      <div className="sticky top-0 z-20 bg-white/90 backdrop-blur-md border-b border-slate-200
        px-4 py-3 flex items-center justify-between shadow-sm">
        <Link
          href={`/protocols/${id}`}
          className="flex items-center gap-1.5 text-sm text-[--color-text-secondary]
            hover:text-[--color-text-primary] transition-colors font-body"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="hidden sm:inline">プロトコルに戻る</span>
          <span className="sm:hidden">戻る</span>
        </Link>

        {/* プレゼンテーション・モード表示 */}
        <div className="flex flex-col items-center gap-0">
          <div className="flex items-center gap-1.5">
            <MonitorPlay className="w-3.5 h-3.5 text-[--color-primary]" />
            <span className="text-sm font-semibold text-[--color-text-primary] font-display">
              プレゼンテーション・モード
            </span>
          </div>
          <span className="text-[10px] text-[--color-text-muted] font-body hidden sm:block">
            患者に画面を見せる際に使用
          </span>
        </div>

        {/* 患者名バッジ */}
        <div className="text-xs text-[--color-text-muted] font-body hidden sm:block">
          {patient.name ?? '匿名患者'}
        </div>
      </div>

      {/* コンテンツ */}
      <div className="p-4 max-w-2xl mx-auto">
        <PatientView patient={patient} protocol={protocol} assessments={assessments} />
      </div>
    </div>
  )
}
