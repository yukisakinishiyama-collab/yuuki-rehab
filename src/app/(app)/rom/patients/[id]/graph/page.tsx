'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, TrendingUp } from 'lucide-react'
import { getPatient, getSessionsByPatient } from '@/lib/rom-store'
import { JOINT_CONFIGS, JOINT_LABELS, SIDE_LABELS } from '@/types/rom'
import type { JointType, ROMSession } from '@/types/rom'

function formatDateShort(iso: string): string {
  const d = new Date(iso)
  return `${d.getMonth() + 1}/${d.getDate()}`
}

interface DataPoint {
  date: string
  arom: number | null
  prom: number | null
  sessionNumber: number
}

function LineGraph({
  points,
  normalValue,
  maxVal,
}: {
  points: DataPoint[]
  normalValue: number
  maxVal: number
}) {
  const W = 560
  const H = 240
  const PL = 48  // padding left
  const PR = 16  // padding right
  const PT = 16  // padding top
  const PB = 40  // padding bottom

  const chartW = W - PL - PR
  const chartH = H - PT - PB

  const yMax = Math.max(maxVal, normalValue) * 1.1
  const toY = (v: number) => PT + chartH - (v / yMax) * chartH
  const toX = (i: number) => PL + (points.length === 1 ? chartW / 2 : (i / (points.length - 1)) * chartW)

  const aromPoints = points.filter((p) => p.arom !== null)
  const promPoints = points.filter((p) => p.prom !== null)

  function polyline(pts: DataPoint[], key: 'arom' | 'prom'): string {
    return pts.map((p, i) => `${toX(points.indexOf(p))},${toY(p[key]!)}`).join(' ')
  }

  const yTicks = [0, Math.round(yMax * 0.25), Math.round(yMax * 0.5), Math.round(yMax * 0.75), Math.round(yMax)]

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ fontFamily: 'sans-serif' }}>
      {/* Y grid lines */}
      {yTicks.map((v) => (
        <g key={v}>
          <line x1={PL} y1={toY(v)} x2={W - PR} y2={toY(v)} stroke="#e2e8f0" strokeWidth={1} />
          <text x={PL - 4} y={toY(v)} textAnchor="end" dominantBaseline="middle" fontSize={10} fill="#94a3b8">
            {v}°
          </text>
        </g>
      ))}

      {/* Normal value reference line */}
      <line x1={PL} y1={toY(normalValue)} x2={W - PR} y2={toY(normalValue)} stroke="#0d9488" strokeWidth={1.5} strokeDasharray="6 3" />
      <text x={W - PR + 4} y={toY(normalValue)} fontSize={9} fill="#0d9488" dominantBaseline="middle">基準</text>

      {/* PROM line */}
      {promPoints.length >= 2 && (
        <polyline points={polyline(promPoints, 'prom')} fill="none" stroke="#a78bfa" strokeWidth={2} strokeDasharray="5 3" />
      )}

      {/* AROM line */}
      {aromPoints.length >= 2 && (
        <polyline points={polyline(aromPoints, 'arom')} fill="none" stroke="#0d9488" strokeWidth={2.5} strokeLinejoin="round" />
      )}

      {/* Data points */}
      {points.map((p, i) => (
        <g key={i}>
          {p.arom !== null && (
            <>
              <circle cx={toX(i)} cy={toY(p.arom)} r={5} fill="#0d9488" stroke="white" strokeWidth={2} />
              <text x={toX(i)} y={toY(p.arom) - 10} textAnchor="middle" fontSize={10} fill="#0d9488" fontWeight="bold">
                {p.arom}°
              </text>
            </>
          )}
          {p.prom !== null && p.arom === null && (
            <circle cx={toX(i)} cy={toY(p.prom)} r={4} fill="#a78bfa" stroke="white" strokeWidth={2} />
          )}
          {/* X label */}
          <text x={toX(i)} y={H - PT} textAnchor="middle" fontSize={10} fill="#64748b">
            {formatDateShort(p.date)}
          </text>
          <text x={toX(i)} y={H - PT + 12} textAnchor="middle" fontSize={9} fill="#94a3b8">
            第{p.sessionNumber}回
          </text>
        </g>
      ))}

      {/* Legend */}
      <g transform={`translate(${PL}, ${PT - 4})`}>
        <circle cx={0} cy={0} r={4} fill="#0d9488" />
        <text x={8} y={0} fontSize={10} fill="#0d9488" dominantBaseline="middle">AROM</text>
        <line x1={55} y1={0} x2={70} y2={0} stroke="#a78bfa" strokeWidth={2} strokeDasharray="4 2" />
        <text x={75} y={0} fontSize={10} fill="#a78bfa" dominantBaseline="middle">PROM</text>
      </g>
    </svg>
  )
}

export default function GraphPage() {
  const { id } = useParams<{ id: string }>()
  const [patientName, setPatientName] = useState('')
  const [sessions, setSessions] = useState<ROMSession[]>([])
  const [selectedJoint, setSelectedJoint] = useState<JointType>('knee')
  const [selectedDirection, setSelectedDirection] = useState('')
  const [selectedSide, setSelectedSide] = useState<'right' | 'left' | 'none'>('right')
  const [availableJoints, setAvailableJoints] = useState<JointType[]>([])

  useEffect(() => {
    const patient = getPatient(id)
    if (patient) setPatientName(patient.name)
    const all = getSessionsByPatient(id).slice().reverse() // chronological order
    setSessions(all)
    const joints = [...new Set(all.map((s) => s.joint))] as JointType[]
    setAvailableJoints(joints)
    if (joints.length > 0) {
      setSelectedJoint(joints[0])
      const cfg = JOINT_CONFIGS[joints[0]]
      if (cfg?.directions.length > 0) setSelectedDirection(cfg.directions[0].label)
    }
  }, [id])

  const config = JOINT_CONFIGS[selectedJoint]
  const directions = config?.directions ?? []

  const isBilateral = config?.bilateral ?? false
  const availableSides: Array<'right' | 'left' | 'none'> = isBilateral ? ['none'] : ['right', 'left']

  const jointSessions = sessions.filter((s) => s.joint === selectedJoint)

  const dataPoints: DataPoint[] = jointSessions
    .map((s) => {
      const rec = s.records.find((r) => r.direction === selectedDirection && r.side === selectedSide)
      return rec ? { date: s.measuredAt, arom: rec.arom, prom: rec.prom, sessionNumber: s.sessionNumber } : null
    })
    .filter((p): p is DataPoint => p !== null)

  const allAroms = dataPoints.map((p) => p.arom ?? 0)
  const maxVal = allAroms.length > 0 ? Math.max(...allAroms) : 100
  const normalValue = directions.find((d) => d.label === selectedDirection)?.normalValue ?? 100

  const first = dataPoints[0]?.arom ?? null
  const last = dataPoints[dataPoints.length - 1]?.arom ?? null
  const totalImprovement = first !== null && last !== null ? last - first : null

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-5">
        <Link href={`/rom/patients/${id}`} className="p-2 rounded-xl hover:bg-slate-100 text-slate-500 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-slate-800">経過グラフ</h1>
          <p className="text-xs text-slate-500">{patientName}</p>
        </div>
      </div>

      {/* Selectors */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 mb-4 space-y-3">
        {/* Joint */}
        <div>
          <p className="text-xs font-medium text-slate-600 mb-2">関節</p>
          <div className="flex flex-wrap gap-2">
            {availableJoints.map((j) => (
              <button
                key={j}
                onClick={() => {
                  setSelectedJoint(j)
                  const cfg = JOINT_CONFIGS[j]
                  if (cfg?.directions.length > 0) setSelectedDirection(cfg.directions[0].label)
                  setSelectedSide(cfg?.bilateral ? 'none' : 'right')
                }}
                className={`px-3 py-1.5 rounded-xl text-sm font-medium transition-all border ${
                  selectedJoint === j
                    ? 'bg-orange-500 text-white border-orange-500'
                    : 'bg-white text-slate-600 border-slate-200 hover:border-orange-400'
                }`}
              >
                {JOINT_LABELS[j]}
              </button>
            ))}
          </div>
        </div>

        {/* Direction */}
        <div>
          <p className="text-xs font-medium text-slate-600 mb-2">運動方向</p>
          <div className="flex flex-wrap gap-2">
            {directions.map((d) => (
              <button
                key={d.label}
                onClick={() => setSelectedDirection(d.label)}
                className={`px-3 py-1.5 rounded-xl text-sm font-medium transition-all border ${
                  selectedDirection === d.label
                    ? 'bg-slate-700 text-white border-slate-700'
                    : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>

        {/* Side */}
        {!isBilateral && (
          <div>
            <p className="text-xs font-medium text-slate-600 mb-2">患側</p>
            <div className="flex gap-2">
              {availableSides.map((s) => (
                <button
                  key={s}
                  onClick={() => setSelectedSide(s)}
                  className={`px-4 py-1.5 rounded-xl text-sm font-medium transition-all border ${
                    selectedSide === s
                      ? 'bg-slate-700 text-white border-slate-700'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'
                  }`}
                >
                  {SIDE_LABELS[s] === '－' ? '全体' : SIDE_LABELS[s]}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Graph */}
      {dataPoints.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center text-slate-400">
          <TrendingUp className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p>選択した条件のデータがありません</p>
        </div>
      ) : (
        <>
          <div className="bg-white rounded-2xl border border-slate-200 p-4 mb-4">
            <LineGraph points={dataPoints} normalValue={normalValue} maxVal={maxVal} />
          </div>

          {/* Summary stats */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white rounded-2xl border border-slate-200 p-3 text-center">
              <p className="text-xs text-slate-500 mb-1">初回</p>
              <p className="text-2xl font-bold text-slate-700">{first ?? '—'}°</p>
            </div>
            <div className="bg-white rounded-2xl border border-slate-200 p-3 text-center">
              <p className="text-xs text-slate-500 mb-1">現在</p>
              <p className="text-2xl font-bold text-teal-700">{last ?? '—'}°</p>
            </div>
            <div className={`rounded-2xl border p-3 text-center ${
              totalImprovement !== null && totalImprovement >= 0
                ? 'bg-green-50 border-green-200'
                : 'bg-red-50 border-red-200'
            }`}>
              <p className="text-xs text-slate-500 mb-1">改善量</p>
              <p className={`text-2xl font-bold ${
                totalImprovement !== null && totalImprovement >= 0 ? 'text-green-700' : 'text-red-600'
              }`}>
                {totalImprovement !== null ? (totalImprovement >= 0 ? `+${totalImprovement}` : totalImprovement) : '—'}°
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
