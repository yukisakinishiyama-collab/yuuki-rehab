'use client'
// ──────────────────────────────────────────────
// 患者詳細ページ
// ──────────────────────────────────────────────
import { useEffect, useState } from 'react'
import { use } from 'react'
import { getPatient, initPatientStore } from '@/lib/patient-store'
import type { Patient } from '@/types/patient'
import PatientDetail from '@/components/rehab-management/PatientDetail'

export default function PatientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [patient, setPatient] = useState<Patient | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    initPatientStore()
    const p = getPatient(id)
    setPatient(p ?? null)
    setLoading(false)
  }, [id])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-4 border-teal-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!patient) {
    return (
      <div className="flex items-center justify-center min-h-screen text-gray-500">
        患者が見つかりません
      </div>
    )
  }

  return <PatientDetail patient={patient} />
}
