'use client'
// ──────────────────────────────────────────────
// リハビリ管理ダッシュボード
// ──────────────────────────────────────────────
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Users, AlertTriangle, Activity, TrendingUp, Clock, Award, ChevronRight, Route } from 'lucide-react'
import type { Patient, SOAPNote } from '@/types/patient'
import { BODY_REGION_LABELS, RISK_LABELS } from '@/types/patient'
import { getPatients, getSOAPNotes, initPatientStore } from '@/lib/patient-store'
import {
  getProtocols, getPatients as getProtocolPatients,
} from '@/lib/protocol-store'
import { calculateRetentionRisk, getDaysSinceLastVisit } from '@/lib/rehab-algorithms'
import { RetentionRiskBadge } from './shared'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'

// この患者にリンクされたプロトコルの進行情報
interface ProtocolInfo {
  id: string
  phaseTitle: string
  order: number
  total: number
}

interface PatientStat {
  patient: Patient
  latestNote?: SOAPNote
  visitCount: number
  riskLevel: 'low' | 'medium' | 'high'
  daysSinceLastVisit: number
  protocolInfo?: ProtocolInfo
}

export default function RehabDashboard() {
  const router = useRouter()
  const [stats, setStats] = useState<PatientStat[]>([])

  useEffect(() => {
    initPatientStore()
    const patients = getPatients()

    // カルテ患者 → リンク済みプロトコル（明示リンク優先、氏名一致は一意の場合のみ）
    const protocols = getProtocols()
    const protocolPatients = getProtocolPatients()
    const nameCount = new Map<string, number>()
    for (const pp of protocolPatients) {
      if (pp.name) nameCount.set(pp.name, (nameCount.get(pp.name) ?? 0) + 1)
    }
    const protocolByChartId = new Map<string, ProtocolInfo>()
    for (const p of patients) {
      const pp = protocolPatients.find(x => x.linkedPatientId === p.id)
        ?? (nameCount.get(p.name) === 1 ? protocolPatients.find(x => x.name === p.name) : undefined)
      if (!pp) continue
      const protos = protocols
        .filter(pr => pr.patientId === pp.id)
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      const proto = protos[0]
      if (!proto) continue
      const phase = proto.phases[proto.currentPhaseIndex]
      protocolByChartId.set(p.id, {
        id: proto.id,
        phaseTitle: phase?.title ?? '',
        order: proto.currentPhaseIndex + 1,
        total: proto.phases.length,
      })
    }

    const allStats: PatientStat[] = patients.map(p => {
      const notes = getSOAPNotes(p.id).sort((a, b) => b.visitDate.localeCompare(a.visitDate))
      const latestNote = notes[0]
      const days = getDaysSinceLastVisit(p.updatedAt)
      const risk = calculateRetentionRisk({
        daysSinceLastVisit: days,
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
      return {
        patient: p,
        latestNote,
        visitCount: notes.length,
        riskLevel: risk.level,
        daysSinceLastVisit: days,
        protocolInfo: protocolByChartId.get(p.id),
      }
    })
    setStats(allStats)
  }, [])

  const activePatients = stats.filter(s => s.patient.status === 'active')
  const highRisk = stats.filter(s => s.riskLevel === 'high')
  const needReassessment = stats.filter(s => s.visitCount > 0 && s.visitCount % 10 === 0)
  const absentLong = stats.filter(s => s.daysSinceLastVisit > 14)

  const avgVisits = activePatients.length > 0
    ? Math.round(activePatients.reduce((acc, s) => acc + s.visitCount, 0) / activePatients.length)
    : 0

  const continuationRate = activePatients.length > 0
    ? Math.round(activePatients.filter(s => s.riskLevel !== 'high').length / activePatients.length * 100)
    : 0

  return (
    <div className="space-y-6">
      {/* ページヘッダー */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-gray-900">リハビリ管理</h1>
        <p className="text-sm text-gray-500 mt-1">患者様の状況を一目で把握</p>
      </div>

      {/* サマリーカード */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatCard
          icon={<Users className="w-4 h-4 text-teal-600" />}
          label="管理患者数" value={`${activePatients.length}名`}
          accent="teal"
        />
        <StatCard
          icon={<AlertTriangle className="w-4 h-4 text-red-500" />}
          label="離脱リスク高" value={`${highRisk.length}名`}
          accent="red"
        />
        <StatCard
          icon={<Clock className="w-4 h-4 text-orange-500" />}
          label="来院間隔空き" value={`${absentLong.length}名`}
          accent="orange"
        />
        <StatCard
          icon={<Activity className="w-4 h-4 text-blue-500" />}
          label="再評価対象" value={`${needReassessment.length}名`}
          accent="blue"
        />
        <StatCard
          icon={<TrendingUp className="w-4 h-4 text-green-500" />}
          label="継続率" value={`${continuationRate}%`}
          accent="green"
        />
        <StatCard
          icon={<Award className="w-4 h-4 text-purple-500" />}
          label="平均来院回数" value={`${avgVisits}回`}
          accent="purple"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 離脱リスク高 */}
        {highRisk.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-500" />
                <CardTitle className="text-sm font-semibold text-red-700">
                  離脱リスクが高い患者様
                </CardTitle>
                <Badge variant="danger" className="ml-auto">{highRisk.length}名</Badge>
              </div>
            </CardHeader>
            <Separator />
            <CardContent className="pt-3 space-y-2">
              {highRisk.map(s => (
                <PatientRow key={s.patient.id} stat={s} onClick={() => router.push(`/patients/${s.patient.id}`)} />
              ))}
            </CardContent>
          </Card>
        )}

        {/* 来院間隔が空いている */}
        {absentLong.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-orange-500" />
                <CardTitle className="text-sm font-semibold text-orange-700">
                  来院間隔が空いている患者様
                </CardTitle>
                <Badge variant="warning" className="ml-auto">{absentLong.length}名</Badge>
              </div>
            </CardHeader>
            <Separator />
            <CardContent className="pt-3 space-y-2">
              {absentLong.map(s => (
                <PatientRow key={s.patient.id} stat={s} onClick={() => router.push(`/patients/${s.patient.id}`)} />
              ))}
            </CardContent>
          </Card>
        )}
      </div>

      {/* 全患者一覧 */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold text-gray-700">管理中の患者様</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => router.push('/patients')}>
              全員を見る <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </CardHeader>
        <Separator />
        <CardContent className="pt-3">
          {activePatients.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">患者が登録されていません</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {activePatients.slice(0, 6).map(s => (
                <PatientRow key={s.patient.id} stat={s} onClick={() => router.push(`/patients/${s.patient.id}`)} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function StatCard({
  icon, label, value, accent,
}: {
  icon: React.ReactNode
  label: string
  value: string
  accent: string
}) {
  const accentBg: Record<string, string> = {
    teal:   'bg-teal-50',
    red:    'bg-red-50',
    orange: 'bg-orange-50',
    blue:   'bg-blue-50',
    green:  'bg-green-50',
    purple: 'bg-purple-50',
  }
  return (
    <Card className={`${accentBg[accent] ?? 'bg-gray-50'} border-0 shadow-none`}>
      <CardContent className="p-4">
        <div className="mb-2">{icon}</div>
        <div className="text-2xl font-bold text-gray-900 tabular-nums">{value}</div>
        <div className="text-xs text-gray-500 mt-0.5">{label}</div>
      </CardContent>
    </Card>
  )
}

function PatientRow({ stat, onClick }: { stat: PatientStat; onClick: () => void }) {
  const nrsColor = (stat.latestNote?.painToday ?? 0) >= 7 ? 'text-red-600'
    : (stat.latestNote?.painToday ?? 0) >= 4 ? 'text-yellow-600'
    : 'text-green-600'

  return (
    // プロトコルへのリンクを内包するため button ではなく div role="button" を使用
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={e => { if (e.key === 'Enter') onClick() }}
      className="w-full text-left rounded-lg border border-gray-100 bg-white p-3 cursor-pointer
        hover:border-teal-200 hover:bg-teal-50/30 transition-colors group
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/50"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center flex-shrink-0">
            <Users className="w-3.5 h-3.5 text-gray-400" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-medium text-sm text-gray-900">{stat.patient.name}</span>
              <Badge variant="teal" className="text-[10px] px-1.5 py-0">{BODY_REGION_LABELS[stat.patient.bodyRegion]}</Badge>
            </div>
            <p className="text-xs text-gray-400 mt-0.5">
              {stat.visitCount}回来院 · {stat.daysSinceLastVisit > 0 ? `${stat.daysSinceLastVisit}日前` : '本日'}
            </p>
            {/* リンク済みプロトコルの進行状況（クリックで進捗管理へ直行） */}
            {stat.protocolInfo && (
              <Link
                href={`/protocols/${stat.protocolInfo.id}/progress`}
                onClick={e => e.stopPropagation()}
                className="inline-flex items-center gap-1 mt-1 text-[10px] font-semibold
                  text-slate-600 bg-slate-50 border border-slate-200 rounded-full px-2 py-0.5
                  hover:border-teal-300 hover:text-teal-700 hover:bg-teal-50 transition-colors"
                title="プロトコル進捗管理を開く"
              >
                <Route className="w-3 h-3" />
                P{stat.protocolInfo.order}/{stat.protocolInfo.total} {stat.protocolInfo.phaseTitle}
              </Link>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {stat.latestNote && (
            <span className={`text-sm font-bold tabular-nums ${nrsColor}`}>
              NRS {stat.latestNote.painToday}
            </span>
          )}
          <RetentionRiskBadge level={stat.riskLevel} />
          <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-gray-500 transition-colors" />
        </div>
      </div>
    </div>
  )
}
