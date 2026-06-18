'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, AlertCircle } from 'lucide-react'
import { getPatient, getSessionsByPatient } from '@/lib/rom-store'
import { JOINT_CONFIGS, JOINT_LABELS } from '@/types/rom'
import type { JointType, ROMSession } from '@/types/rom'

function Bar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0
  return (
    <div className="w-full bg-slate-100 rounded-full h-5 overflow-hidden">
      <div
        className={`h-full rounded-full transition-all duration-500 ${color}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}

export default function ComparePage() {
  const { id } = useParams<{ id: string }>()
  const [patientName, setPatientName] = useState('')
  const [sessions, setSessions] = useState<ROMSession[]>([])
  const [selectedJoint, setSelectedJoint] = useState<JointType>('knee')
  const [availableJoints, setAvailableJoints] = useState<JointType[]>([])

  useEffect(() => {
    const patient = getPatient(id)
    if (patient) setPatientName(patient.name)
    const all = getSessionsByPatient(id)
    setSessions(all)
    const joints = [...new Set(all.map((s) => s.joint))] as JointType[]
    setAvailableJoints(joints)
    if (joints.length > 0) setSelectedJoint(joints[0])
  }, [id])

  const jointSessions = sessions.filter((s) => s.joint === selectedJoint)
  const latestSession = jointSessions[0] ?? null

  const config = JOINT_CONFIGS[selectedJoint]

  // Build comparison data: direction → { right, left }
  const compareData = config?.directions
    .filter((d) => !d.sideFixed && !config.bilateral)
    .map((d) => {
      const recR = latestSession?.records.find((r) => r.direction === d.label && r.side === 'right')
      const recL = latestSession?.records.find((r) => r.direction === d.label && r.side === 'left')
      const aromR = recR?.arom ?? null
      const aromL = recL?.arom ?? null
      const diff = aromR !== null && aromL !== null ? aromL - aromR : null
      const pctHealthy = aromR !== null && aromL !== null && aromL > 0 ? Math.round((aromR / aromL) * 100) : null

      return { label: d.label, normalValue: d.normalValue, aromR, aromL, diff, pctHealthy, max: Math.max(d.normalValue, aromR ?? 0, aromL ?? 0, 1) }
    }) ?? []

  const hasBothSides = compareData.some((d) => d.aromR !== null && d.aromL !== null)

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-5">
        <Link href={`/rom/patients/${id}`} className="p-2 rounded-xl hover:bg-slate-100 text-slate-500 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-slate-800">左右比較</h1>
          <p className="text-xs text-slate-500">{patientName}</p>
        </div>
      </div>

      {/* Joint selector */}
      <div className="flex flex-wrap gap-2 mb-5">
        {availableJoints.map((j) => (
          <button
            key={j}
            onClick={() => setSelectedJoint(j)}
            className={`px-3 py-2 rounded-xl text-sm font-medium transition-all border ${
              selectedJoint === j
                ? 'bg-purple-600 text-white border-purple-600'
                : 'bg-white text-slate-600 border-slate-200 hover:border-purple-400'
            }`}
          >
            {JOINT_LABELS[j]}
          </button>
        ))}
      </div>

      {/* No data */}
      {!latestSession && (
        <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center text-slate-400">
          <AlertCircle className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p>この関節の測定データがありません</p>
        </div>
      )}

      {latestSession && config.bilateral && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-sm text-amber-700">
          {JOINT_LABELS[selectedJoint]}は左右比較が適用されない関節です
        </div>
      )}

      {latestSession && !config.bilateral && (
        <>
          {!hasBothSides && (
            <div className="mb-4 bg-blue-50 border border-blue-200 rounded-xl p-3 text-sm text-blue-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>片側のみ測定されています。両側測定するとグラフが完成します。</span>
            </div>
          )}

          <div className="space-y-4">
            {compareData.map((d) => (
              <div key={d.label} className="bg-white rounded-2xl border border-slate-200 p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-base font-bold text-slate-800">{d.label}</h3>
                  <span className="text-xs text-slate-400">基準値 {d.normalValue}°</span>
                </div>

                {/* Right */}
                <div className="mb-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-blue-700">右（Right）</span>
                    <span className="text-lg font-bold text-blue-800">
                      {d.aromR !== null ? `${d.aromR}°` : '未測定'}
                    </span>
                  </div>
                  <Bar value={d.aromR ?? 0} max={d.max} color="bg-blue-400" />
                </div>

                {/* Left */}
                <div className="mb-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-teal-700">左（Left）</span>
                    <span className="text-lg font-bold text-teal-800">
                      {d.aromL !== null ? `${d.aromL}°` : '未測定'}
                    </span>
                  </div>
                  <Bar value={d.aromL ?? 0} max={d.max} color="bg-teal-400" />
                </div>

                {/* Normal value reference */}
                <div className="mb-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-slate-400">正常参考値</span>
                    <span className="text-sm text-slate-400">{d.normalValue}°</span>
                  </div>
                  <Bar value={d.normalValue} max={d.max} color="bg-slate-200" />
                </div>

                {/* Summary */}
                {d.diff !== null && d.aromR !== null && d.aromL !== null && (
                  <div className={`mt-3 p-3 rounded-xl text-sm ${
                    Math.abs(d.diff) <= 5
                      ? 'bg-green-50 text-green-700'
                      : Math.abs(d.diff) <= 15
                      ? 'bg-yellow-50 text-yellow-700'
                      : 'bg-red-50 text-red-700'
                  }`}>
                    {Math.abs(d.diff) <= 5 ? (
                      <span>✅ 左右差 {Math.abs(d.diff)}° — ほぼ左右対称です</span>
                    ) : (
                      <>
                        <span>
                          ⚠ 左右差 {Math.abs(d.diff)}°
                          {d.diff > 0 ? '（右 < 左）' : '（左 < 右）'}
                        </span>
                        {d.pctHealthy !== null && (
                          <span className="ml-2">— 健側の {d.pctHealthy}%</span>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
