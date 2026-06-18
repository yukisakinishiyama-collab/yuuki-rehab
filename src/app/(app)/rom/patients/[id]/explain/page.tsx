'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Printer } from 'lucide-react'
import { getPatient, getSessionsByPatient } from '@/lib/rom-store'
import { JOINT_CONFIGS, JOINT_LABELS } from '@/types/rom'
import type { JointType, ROMSession } from '@/types/rom'

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
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`
}

function ProgressBar({ value, max, label }: { value: number; max: number; label: string }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0
  const color = pct >= 80 ? 'bg-green-500' : pct >= 50 ? 'bg-yellow-400' : 'bg-red-400'

  return (
    <div className="space-y-1.5">
      <div className="flex justify-between items-center">
        <span className="text-sm font-medium text-slate-700">{label}</span>
        <span className="text-lg font-bold text-slate-800">{value}°</span>
      </div>
      <div className="w-full h-5 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all duration-700`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

export default function ExplainPage() {
  const { id } = useParams<{ id: string }>()
  const [patientName, setPatientName] = useState('')
  const [patientAge, setPatientAge] = useState(0)
  const [sessions, setSessions] = useState<ROMSession[]>([])
  const [selectedJoint, setSelectedJoint] = useState<JointType>('knee')
  const [selectedDirection, setSelectedDirection] = useState('')
  const [availableJoints, setAvailableJoints] = useState<JointType[]>([])

  useEffect(() => {
    const patient = getPatient(id)
    if (patient) {
      setPatientName(patient.name)
      setPatientAge(calcAge(patient.birthDate))
    }
    const all = getSessionsByPatient(id).slice().reverse()
    setSessions(all)
    const joints = [...new Set(all.map((s) => s.joint))] as JointType[]
    setAvailableJoints(joints)
    if (joints.length > 0) {
      setSelectedJoint(joints[joints.length - 1])
      const cfg = JOINT_CONFIGS[joints[joints.length - 1]]
      if (cfg?.directions.length > 0) setSelectedDirection(cfg.directions[0].label)
    }
  }, [id])

  const config = JOINT_CONFIGS[selectedJoint]
  const jointSessions = sessions.filter((s) => s.joint === selectedJoint)
  const latest = jointSessions[jointSessions.length - 1] ?? null
  const prev = jointSessions.length >= 2 ? jointSessions[jointSessions.length - 2] : null
  const first = jointSessions[0] ?? null

  const getArom = (session: ROMSession | null, dir: string, side: 'right' | 'left' | 'none' | 'any'): number | null => {
    if (!session) return null
    const rec = session.records.find((r) => r.direction === dir && (side === 'any' || r.side === side))
    return rec?.arom ?? null
  }

  const getPainAngle = (session: ROMSession | null, dir: string): number | null => {
    if (!session) return null
    const rec = session.records.find((r) => r.direction === dir)
    return rec?.hasPain ? (rec.painAngle ?? null) : null
  }

  const config_dir = config?.directions.find((d) => d.label === selectedDirection)
  const normalValue = config_dir?.normalValue ?? 100

  // Get side to display (patient's affected side or first available)
  const side: 'right' | 'left' | 'none' = config?.bilateral ? 'none' : 'right'

  const currentArom = getArom(latest, selectedDirection, 'any')
  const prevArom = getArom(prev, selectedDirection, 'any')
  const firstArom = getArom(first, selectedDirection, 'any')
  const painAngle = getPainAngle(latest, selectedDirection)

  const diffFromPrev = currentArom !== null && prevArom !== null ? currentArom - prevArom : null
  const diffFromFirst = currentArom !== null && firstArom !== null ? currentArom - firstArom : null
  const toNormal = currentArom !== null ? normalValue - currentArom : null

  // Left/Right comparison (for bilateral joints, not applicable)
  const aromR = config?.bilateral ? null : getArom(latest, selectedDirection, 'right')
  const aromL = config?.bilateral ? null : getArom(latest, selectedDirection, 'left')
  const lrDiff = aromR !== null && aromL !== null ? Math.abs(aromL - aromR) : null

  function getMessage(): string {
    if (currentArom === null) return 'まだ測定データがありません'
    const pct = Math.round((currentArom / normalValue) * 100)

    if (toNormal !== null && toNormal <= 0) return `目標角度に到達しました！ 引き続きケアを続けましょう`
    if (toNormal !== null && toNormal <= 5) return `目標まであと ${toNormal}度 です！もう少しです`
    if (diffFromPrev !== null && diffFromPrev > 0) return `前回より ${diffFromPrev}度 よくなっています`
    if (pct >= 80) return `順調に回復しています`
    if (pct >= 50) return `少しずつ改善しています。引き続き頑張りましょう`
    return `まだ制限がありますが、焦らず続けましょう`
  }

  return (
    <div className="max-w-lg mx-auto">
      {/* Nav (スタッフ用、印刷時非表示) */}
      <div className="flex items-center justify-between mb-5 print:hidden">
        <div className="flex items-center gap-3">
          <Link href={`/rom/patients/${id}`} className="p-2 rounded-xl hover:bg-slate-100 text-slate-500 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="text-xl font-bold text-slate-800">患者説明画面</h1>
        </div>
        <button
          onClick={() => window.print()}
          className="flex items-center gap-2 px-3 py-2 bg-slate-700 text-white rounded-xl text-sm hover:bg-slate-800 transition-colors"
        >
          <Printer className="w-4 h-4" />
          印刷
        </button>
      </div>

      {/* Joint & direction selector (staff) */}
      <div className="print:hidden space-y-3 mb-5">
        <div className="flex flex-wrap gap-2">
          {availableJoints.map((j) => (
            <button
              key={j}
              onClick={() => {
                setSelectedJoint(j)
                const cfg = JOINT_CONFIGS[j]
                if (cfg?.directions.length > 0) setSelectedDirection(cfg.directions[0].label)
              }}
              className={`px-3 py-1.5 rounded-xl text-sm font-medium border transition-all ${
                selectedJoint === j
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-blue-400'
              }`}
            >
              {JOINT_LABELS[j]}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {config?.directions.map((d) => (
            <button
              key={d.label}
              onClick={() => setSelectedDirection(d.label)}
              className={`px-3 py-1.5 rounded-xl text-sm font-medium border transition-all ${
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

      {/* ===== 患者向け表示 ===== */}
      <div className="bg-white rounded-3xl border-2 border-blue-200 p-6 shadow-md">
        {/* Header */}
        <div className="text-center mb-6 pb-4 border-b border-blue-100">
          <p className="text-sm text-slate-500 mb-1">{latest ? formatDate(latest.measuredAt) : '—'} の記録</p>
          <h2 className="text-2xl font-bold text-slate-800">
            {patientName} さん{patientAge > 0 && `（${patientAge}歳）`}
          </h2>
          <p className="text-base text-slate-600 mt-1">
            {JOINT_LABELS[selectedJoint]} ・ {selectedDirection}
          </p>
        </div>

        {currentArom !== null ? (
          <div className="space-y-6">
            {/* Main message */}
            <div className={`text-center py-4 px-5 rounded-2xl text-lg font-bold ${
              diffFromPrev !== null && diffFromPrev > 0
                ? 'bg-green-50 text-green-700'
                : 'bg-blue-50 text-blue-700'
            }`}>
              {diffFromPrev !== null && diffFromPrev > 0 && (
                <span className="text-3xl block mb-1">✨</span>
              )}
              {getMessage()}
            </div>

            {/* Current value */}
            <div className="text-center">
              <p className="text-slate-500 text-sm mb-2">今日の角度</p>
              <p className="text-6xl font-black text-teal-700">{currentArom}°</p>
            </div>

            {/* Progress bars */}
            <div className="space-y-4">
              {prevArom !== null && (
                <ProgressBar value={prevArom} max={normalValue} label={`前回 ${prev ? formatDate(prev.measuredAt) : ''}`} />
              )}
              <ProgressBar value={currentArom} max={normalValue} label="今日" />
              <ProgressBar value={normalValue} max={normalValue} label="目標の目安" />
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-3">
              {diffFromPrev !== null && (
                <div className={`rounded-2xl p-4 text-center ${diffFromPrev >= 0 ? 'bg-green-50' : 'bg-red-50'}`}>
                  <p className="text-xs text-slate-500 mb-1">前回から</p>
                  <p className={`text-2xl font-bold ${diffFromPrev >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                    {diffFromPrev >= 0 ? `+${diffFromPrev}` : diffFromPrev}度
                  </p>
                </div>
              )}
              {toNormal !== null && toNormal > 0 && (
                <div className="bg-slate-50 rounded-2xl p-4 text-center">
                  <p className="text-xs text-slate-500 mb-1">目標まで</p>
                  <p className="text-2xl font-bold text-slate-700">あと{toNormal}度</p>
                </div>
              )}
              {toNormal !== null && toNormal <= 0 && (
                <div className="bg-green-50 rounded-2xl p-4 text-center">
                  <p className="text-xs text-green-600 mb-1">目標達成！</p>
                  <p className="text-2xl font-bold text-green-700">🎉</p>
                </div>
              )}
              {diffFromFirst !== null && diffFromFirst > 0 && (
                <div className="bg-blue-50 rounded-2xl p-4 text-center">
                  <p className="text-xs text-slate-500 mb-1">最初から</p>
                  <p className="text-2xl font-bold text-blue-700">+{diffFromFirst}度</p>
                </div>
              )}
              {lrDiff !== null && (
                <div className={`rounded-2xl p-4 text-center ${lrDiff <= 5 ? 'bg-green-50' : lrDiff <= 15 ? 'bg-yellow-50' : 'bg-orange-50'}`}>
                  <p className="text-xs text-slate-500 mb-1">左右の差</p>
                  <p className={`text-2xl font-bold ${lrDiff <= 5 ? 'text-green-700' : lrDiff <= 15 ? 'text-yellow-700' : 'text-orange-700'}`}>
                    {lrDiff}度
                  </p>
                </div>
              )}
            </div>

            {/* Pain notice */}
            {painAngle !== null && (
              <div className="bg-orange-50 border border-orange-200 rounded-2xl p-4">
                <p className="text-base font-bold text-orange-700 mb-1">⚠️ 痛みが出る角度について</p>
                <p className="text-slate-700 text-sm leading-relaxed">
                  {painAngle}度 あたりから痛みが出ています。<br />
                  無理に曲げず、<strong className="text-orange-700">痛みが出る前の角度</strong>で止めるようにしましょう。
                </p>
              </div>
            )}

            {/* Advice */}
            <div className="bg-slate-50 rounded-2xl p-4">
              <p className="text-sm font-bold text-slate-700 mb-2">📋 スタッフからのひと言</p>
              <p className="text-sm text-slate-600 leading-relaxed">
                {toNormal !== null && toNormal <= 0
                  ? '目標角度に到達しました！この状態を維持するためにセルフケアを続けましょう。'
                  : diffFromFirst !== null && diffFromFirst > 0
                  ? `最初から${diffFromFirst}度改善しています。この調子で続けましょう！`
                  : '毎回の測定で変化を記録しています。無理をせず、コツコツ続けることが大切です。'
                }
              </p>
            </div>
          </div>
        ) : (
          <div className="text-center py-12 text-slate-400">
            <p className="text-lg">まだ測定データがありません</p>
            <p className="text-sm mt-2">最初の測定を行いましょう</p>
          </div>
        )}
      </div>

      {/* Print styles */}
      <style jsx global>{`
        @media print {
          body > * { display: none; }
          .print-area { display: block !important; }
          @page { margin: 1cm; }
        }
      `}</style>
    </div>
  )
}
