'use client'
// ──────────────────────────────────────────────
// 患者管理 - 患者一覧ページ
// ──────────────────────────────────────────────
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { User, Plus, Search, AlertTriangle, ChevronRight, Activity } from 'lucide-react'
import type { Patient } from '@/types/patient'
import { BODY_REGION_LABELS, RISK_LABELS } from '@/types/patient'
import { getPatients, initPatientStore, getSOAPNotes } from '@/lib/patient-store'
import { calculateRetentionRisk, getDaysSinceLastVisit, calcAge } from '@/lib/rehab-algorithms'
import { buttonVariants } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

const FILTER_OPTIONS = [
  { label: 'すべて',     value: 'all' },
  { label: '股関節',     value: 'hip' },
  { label: '膝',         value: 'knee' },
  { label: '足関節',     value: 'ankle' },
  { label: '肩',         value: 'shoulder' },
  { label: '腰部',       value: 'lumbar' },
  { label: '頚部',       value: 'cervical' },
  { label: '離脱リスク高', value: 'high_risk' },
]

export default function PatientsPage() {
  const router = useRouter()
  const [patients, setPatients] = useState<Patient[]>([])
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')

  useEffect(() => {
    initPatientStore()
    setPatients(getPatients())
  }, [])

  const filtered = patients.filter(p => {
    const matchSearch = search === '' ||
      p.name.includes(search) ||
      p.kana.includes(search) ||
      p.diagnosisLabel.includes(search) ||
      p.mainComplaint.includes(search)

    if (!matchSearch) return false
    if (filter === 'all') return true
    if (filter === 'high_risk') {
      const notes = getSOAPNotes(p.id)
      const risk = calculateRetentionRisk({
        daysSinceLastVisit: getDaysSinceLastVisit(p.updatedAt),
        recommendedIntervalDays: 7,
        cancelCount: 0,
        totalVisits: notes.length,
        painChange: -5,
        romImprovementRate: 5,
        strengthImprovementRate: 5,
        homeExerciseAdherence: 50,
        hasEconomicConcern: false,
        hasGoalUnclear: false,
        hasExplanationInsufficient: false,
      })
      return risk.level === 'high'
    }
    return p.bodyRegion === filter
  })

  return (
    <div className="space-y-6">
      {/* ページヘッダー */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900">患者管理</h1>
          <p className="text-sm text-gray-500 mt-1">{patients.length}名登録中</p>
        </div>
        <Link href="/patients/new" className={cn(buttonVariants({ variant: 'default' }))}>
          <Plus className="w-4 h-4" />
          新規患者登録
        </Link>
      </div>

      {/* 検索・フィルター */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            type="text"
            placeholder="氏名・カナ・診断名で検索..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {FILTER_OPTIONS.map(opt => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setFilter(opt.value)}
              className={cn(
                'px-3 py-1.5 text-xs rounded-full border font-medium transition-colors',
                filter === opt.value
                  ? 'bg-teal-600 text-white border-teal-600'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-teal-300 hover:text-teal-700'
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* 患者リスト */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-gray-400">
          <User className="w-12 h-12 mb-3 opacity-30" />
          <p className="text-sm">
            {search || filter !== 'all' ? '条件に一致する患者が見つかりません' : '患者が登録されていません'}
          </p>
          {!search && filter === 'all' && (
            <Link href="/patients/new" className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'mt-4')}>
              <Plus className="w-4 h-4" />最初の患者を登録
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(patient => (
            <PatientCard key={patient.id} patient={patient} onClick={() => router.push(`/patients/${patient.id}`)} />
          ))}
        </div>
      )}
    </div>
  )
}

function PatientCard({ patient, onClick }: { patient: Patient; onClick: () => void }) {
  const notes = getSOAPNotes(patient.id).sort((a, b) => b.visitDate.localeCompare(a.visitDate))
  const latestNote = notes[0]

  const risk = calculateRetentionRisk({
    daysSinceLastVisit: getDaysSinceLastVisit(patient.updatedAt),
    recommendedIntervalDays: 7,
    cancelCount: 0,
    totalVisits: notes.length,
    painChange: latestNote ? latestNote.painToday - 8 : -3,
    romImprovementRate: 10,
    strengthImprovementRate: 10,
    homeExerciseAdherence: latestNote?.homeExerciseAdherence === 'done' ? 100 : 50,
    hasEconomicConcern: false,
    hasGoalUnclear: false,
    hasExplanationInsufficient: false,
  })

  const riskVariant: Record<string, 'success' | 'warning' | 'danger'> = {
    low: 'success', medium: 'warning', high: 'danger',
  }
  const nrsColor = (latestNote?.painToday ?? 0) >= 7 ? 'text-red-600'
    : (latestNote?.painToday ?? 0) >= 4 ? 'text-yellow-600'
    : 'text-green-600'
  const age = calcAge(patient.birthDate)

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left rounded-xl border border-gray-200 bg-white shadow-sm px-5 py-4 hover:border-teal-200 hover:shadow-md transition-all group"
    >
      <div className="flex items-center gap-4">
        {/* アバター */}
        <div className="w-11 h-11 bg-teal-50 rounded-full flex items-center justify-center flex-shrink-0">
          <User className="w-5 h-5 text-teal-600" />
        </div>

        {/* メイン情報 */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-gray-900">{patient.name}</span>
            <span className="text-sm text-gray-400">{age}歳</span>
            <Badge variant="teal">{BODY_REGION_LABELS[patient.bodyRegion]}</Badge>
            <Badge variant={riskVariant[risk.level]}>
              離脱リスク{RISK_LABELS[risk.level]}
            </Badge>
            {risk.level === 'high' && <AlertTriangle className="w-4 h-4 text-red-500" />}
          </div>
          <p className="text-xs text-gray-500 mt-1 truncate">{patient.mainComplaint}</p>
          <p className="text-xs text-gray-400">{patient.diagnosisLabel}</p>
        </div>

        {/* 右側：最新NRS + 来院回数 */}
        <div className="flex-shrink-0 text-right">
          {latestNote ? (
            <>
              <div className={cn('text-lg font-bold tabular-nums', nrsColor)}>
                NRS {latestNote.painToday}
              </div>
              <div className="text-xs text-gray-400">{latestNote.visitDate}</div>
              <div className="text-xs text-gray-500">{notes.length}回来院</div>
            </>
          ) : (
            <div className="text-xs text-gray-400 flex items-center gap-1">
              <Activity className="w-3 h-3" />
              初回評価待ち
            </div>
          )}
        </div>

        <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-teal-500 transition-colors flex-shrink-0" />
      </div>
    </button>
  )
}
