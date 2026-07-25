'use client'
// ──────────────────────────────────────────────
// 患者管理 - 患者一覧ページ
// 検索・部位フィルター・並び替え・ピン留め・最近閲覧に対応。
// SOAPノートは一度だけ読み込んで患者別にグループ化し、
// 患者数が増えても検索入力ごとの再パースが起きないようにしている。
// ──────────────────────────────────────────────
import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  User, Plus, Search, AlertTriangle, ChevronRight, Activity,
  Pin, PinOff, History, ArrowUpDown,
} from 'lucide-react'
import type { Patient, SOAPNote } from '@/types/patient'
import { BODY_REGION_LABELS, RISK_LABELS } from '@/types/patient'
import { getPatients, initPatientStore, getSOAPNotes } from '@/lib/patient-store'
import { calculateRetentionRisk, getDaysSinceLastVisit, calcAge } from '@/lib/rehab-algorithms'
import { getPinnedIds, togglePin, getRecentViews } from '@/lib/patient-ui-prefs'
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

const SORT_OPTIONS = [
  { label: '最終来院が新しい順', value: 'visit' },
  { label: '五十音順（カナ）',   value: 'kana' },
  { label: '登録が新しい順',     value: 'created' },
] as const

type SortKey = typeof SORT_OPTIONS[number]['value']

interface RiskInfo {
  level: 'low' | 'medium' | 'high'
}

export default function PatientsPage() {
  const router = useRouter()
  const [patients, setPatients] = useState<Patient[]>([])
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [sortKey, setSortKey] = useState<SortKey>('visit')
  const [pins, setPins] = useState<string[]>([])
  const [recentIds, setRecentIds] = useState<string[]>([])

  useEffect(() => {
    initPatientStore()
    setPatients(getPatients())
    setPins(getPinnedIds())
    setRecentIds(getRecentViews().map(v => v.id))
  }, [])

  // SOAPノートを一度だけ読み込み、患者別にグループ化（来院日の降順）
  const notesByPatient = useMemo(() => {
    const map = new Map<string, SOAPNote[]>()
    if (patients.length === 0) return map
    for (const n of getSOAPNotes()) {
      const arr = map.get(n.patientId)
      if (arr) arr.push(n)
      else map.set(n.patientId, [n])
    }
    for (const arr of map.values()) {
      arr.sort((a, b) => b.visitDate.localeCompare(a.visitDate))
    }
    return map
  }, [patients])

  // 離脱リスクを患者ごとに一度だけ算出（既存アルゴリズム・パラメータを維持）
  const riskByPatient = useMemo(() => {
    const map = new Map<string, RiskInfo>()
    for (const p of patients) {
      const notes = notesByPatient.get(p.id) ?? []
      const latestNote = notes[0]
      const risk = calculateRetentionRisk({
        daysSinceLastVisit: getDaysSinceLastVisit(p.updatedAt),
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
      map.set(p.id, { level: risk.level })
    }
    return map
  }, [patients, notesByPatient])

  const highRiskCount = useMemo(
    () => patients.filter(p => riskByPatient.get(p.id)?.level === 'high').length,
    [patients, riskByPatient],
  )

  // 検索 → フィルター → 並び替え
  const { pinned, others } = useMemo(() => {
    const matched = patients.filter(p => {
      const matchSearch = search === '' ||
        p.name.includes(search) ||
        p.kana.includes(search) ||
        p.id.includes(search) ||
        p.diagnosisLabel.includes(search) ||
        p.mainComplaint.includes(search)
      if (!matchSearch) return false
      if (filter === 'all') return true
      if (filter === 'high_risk') return riskByPatient.get(p.id)?.level === 'high'
      return p.bodyRegion === filter
    })

    const lastVisit = (p: Patient) =>
      notesByPatient.get(p.id)?.[0]?.visitDate ?? p.updatedAt.split('T')[0]

    const sorted = [...matched].sort((a, b) => {
      switch (sortKey) {
        case 'kana':    return a.kana.localeCompare(b.kana, 'ja')
        case 'created': return b.createdAt.localeCompare(a.createdAt)
        default:        return lastVisit(b).localeCompare(lastVisit(a))
      }
    })

    return {
      pinned: sorted.filter(p => pins.includes(p.id)),
      others: sorted.filter(p => !pins.includes(p.id)),
    }
  }, [patients, search, filter, sortKey, pins, riskByPatient, notesByPatient])

  // 最近閲覧（現在の患者リストに存在するもののみ）
  const recentPatients = useMemo(() => {
    const byId = new Map(patients.map(p => [p.id, p]))
    return recentIds.map(id => byId.get(id)).filter((p): p is Patient => !!p).slice(0, 6)
  }, [patients, recentIds])

  function handleTogglePin(id: string) {
    setPins(togglePin(id))
  }

  const isEmpty = pinned.length === 0 && others.length === 0

  return (
    <div className="space-y-6">
      {/* ページヘッダー */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900">患者管理</h1>
          <div className="flex items-center gap-2 mt-1">
            <p className="text-sm text-gray-500">{patients.length}名登録中</p>
            {highRiskCount > 0 && (
              <span className="inline-flex items-center gap-1 text-xs text-red-700 bg-red-50
                border border-red-200 rounded-full px-2 py-0.5">
                <AlertTriangle className="w-3 h-3" />離脱リスク高 {highRiskCount}名
              </span>
            )}
          </div>
        </div>
        <Link href="/patients/new" className={cn(buttonVariants({ variant: 'default' }))}>
          <Plus className="w-4 h-4" />
          新規患者登録
        </Link>
      </div>

      {/* 最近閲覧した患者 */}
      {recentPatients.length > 0 && (
        <div>
          <div className="flex items-center gap-1.5 text-xs font-medium text-gray-400 mb-2">
            <History className="w-3.5 h-3.5" />最近閲覧した患者
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {recentPatients.map(p => (
              <Link
                key={p.id}
                href={`/patients/${p.id}`}
                className="flex items-center gap-2 flex-shrink-0 bg-white border border-gray-200
                  rounded-full pl-1.5 pr-3 py-1.5 hover:border-teal-300 hover:shadow-sm transition-all"
              >
                <span className="w-6 h-6 bg-teal-50 rounded-full flex items-center justify-center">
                  <User className="w-3.5 h-3.5 text-teal-600" />
                </span>
                <span className="text-xs font-medium text-gray-700">{p.name}</span>
                <span className="text-[10px] text-gray-400">{BODY_REGION_LABELS[p.bodyRegion]}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* 検索・フィルター・並び替え */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            type="text"
            placeholder="氏名・カナ・診断名・ID・主訴で検索..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex items-center justify-between gap-3 flex-wrap">
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
          <label className="flex items-center gap-1.5 text-xs text-gray-500">
            <ArrowUpDown className="w-3.5 h-3.5 text-gray-400" />
            <select
              value={sortKey}
              onChange={e => setSortKey(e.target.value as SortKey)}
              className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white text-gray-700
                focus:outline-none focus:ring-2 focus:ring-teal-500/40"
              aria-label="並び替え"
            >
              {SORT_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {/* 患者リスト */}
      {isEmpty ? (
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
        <div className="space-y-5">
          {pinned.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 text-xs font-medium text-gray-400 mb-2">
                <Pin className="w-3.5 h-3.5" />ピン留め
              </div>
              <div className="space-y-2">
                {pinned.map(patient => (
                  <PatientCard
                    key={patient.id}
                    patient={patient}
                    notes={notesByPatient.get(patient.id) ?? []}
                    riskLevel={riskByPatient.get(patient.id)?.level ?? 'low'}
                    pinned
                    onTogglePin={() => handleTogglePin(patient.id)}
                    onClick={() => router.push(`/patients/${patient.id}`)}
                  />
                ))}
              </div>
            </div>
          )}
          <div className="space-y-2">
            {others.map(patient => (
              <PatientCard
                key={patient.id}
                patient={patient}
                notes={notesByPatient.get(patient.id) ?? []}
                riskLevel={riskByPatient.get(patient.id)?.level ?? 'low'}
                pinned={false}
                onTogglePin={() => handleTogglePin(patient.id)}
                onClick={() => router.push(`/patients/${patient.id}`)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function PatientCard({ patient, notes, riskLevel, pinned, onTogglePin, onClick }: {
  patient: Patient
  notes: SOAPNote[]
  riskLevel: 'low' | 'medium' | 'high'
  pinned: boolean
  onTogglePin: () => void
  onClick: () => void
}) {
  const latestNote = notes[0]

  const riskVariant: Record<string, 'success' | 'warning' | 'danger'> = {
    low: 'success', medium: 'warning', high: 'danger',
  }
  const nrsColor = (latestNote?.painToday ?? 0) >= 7 ? 'text-red-600'
    : (latestNote?.painToday ?? 0) >= 4 ? 'text-yellow-600'
    : 'text-green-600'
  const age = calcAge(patient.birthDate)

  return (
    // ピンボタンを内包するため button ではなく div role="button" を使用
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={e => { if (e.key === 'Enter') onClick() }}
      className={cn(
        'w-full text-left rounded-xl border bg-white shadow-sm px-5 py-4 cursor-pointer',
        'hover:border-teal-200 hover:shadow-md transition-all group',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/50',
        pinned ? 'border-teal-200' : 'border-gray-200',
      )}
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
            {/* 生年月日未入力の患者では年齢を表示しない（NaN歳の防止） */}
            {Number.isFinite(age) && <span className="text-sm text-gray-400">{age}歳</span>}
            <Badge variant="teal">{BODY_REGION_LABELS[patient.bodyRegion]}</Badge>
            <Badge variant={riskVariant[riskLevel]}>
              離脱リスク{RISK_LABELS[riskLevel]}
            </Badge>
            {riskLevel === 'high' && <AlertTriangle className="w-4 h-4 text-red-500" />}
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

        {/* ピン留めトグル */}
        <button
          type="button"
          onClick={e => { e.stopPropagation(); onTogglePin() }}
          className={cn(
            'p-1.5 rounded-lg transition-colors flex-shrink-0',
            pinned
              ? 'text-teal-600 hover:text-teal-800 hover:bg-teal-50'
              : 'text-gray-300 hover:text-teal-500 hover:bg-gray-50 opacity-0 group-hover:opacity-100 focus-visible:opacity-100',
          )}
          aria-label={pinned ? 'ピン留めを解除' : 'ピン留めする'}
          title={pinned ? 'ピン留めを解除' : 'ピン留めする'}
        >
          {pinned ? <Pin className="w-4 h-4 fill-current" /> : <PinOff className="w-4 h-4" />}
        </button>

        <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-teal-500 transition-colors flex-shrink-0" />
      </div>
    </div>
  )
}
