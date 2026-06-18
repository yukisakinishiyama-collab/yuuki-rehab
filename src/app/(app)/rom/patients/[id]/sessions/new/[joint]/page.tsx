'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Save, ChevronDown, ChevronUp, AlertTriangle, Smartphone } from 'lucide-react'
import { getPatient, saveSession, getNextSessionNumber, getSessionsByPatient } from '@/lib/rom-store'
import { JOINT_CONFIGS, POSITION_LABELS, END_FEEL_LABELS, JOINT_LABELS } from '@/types/rom'
import type { JointType, ROMRecord, ROMSession, EndFeelType, MeasurementPositionType, SideType } from '@/types/rom'
import SensorROMModal from '@/components/rom/SensorROMModal'

interface DirState {
  aromR: string
  promR: string
  painR: boolean
  painAngleR: string
  aromL: string
  promL: string
  painL: boolean
  painAngleL: string
  endFeel: EndFeelType
  compensatoryMotion: string
  memo: string
  expanded: boolean
}

function initDirState(): DirState {
  return {
    aromR: '', promR: '', painR: false, painAngleR: '',
    aromL: '', promL: '', painL: false, painAngleL: '',
    endFeel: 'none', compensatoryMotion: '', memo: '', expanded: true,
  }
}

const inputNum = 'w-20 px-2.5 py-2 border border-slate-200 rounded-xl text-center text-base font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-400 bg-white'
const inputSm = 'w-full px-3 py-2 border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-400 bg-white'

function DiffBadge({ arom, normalValue, prevArom }: { arom: number | null; normalValue: number; prevArom: number | null }) {
  if (arom === null) return null
  const diff = prevArom !== null ? arom - prevArom : null
  const pct = normalValue > 0 ? Math.round((arom / normalValue) * 100) : null

  return (
    <div className="flex items-center gap-2 mt-1 flex-wrap">
      {diff !== null && (
        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${diff >= 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
          {diff >= 0 ? `↑+${diff}°` : `↓${diff}°`}
        </span>
      )}
      {pct !== null && (
        <span className={`text-xs px-2 py-0.5 rounded-full ${pct >= 80 ? 'bg-green-50 text-green-600' : pct >= 50 ? 'bg-yellow-50 text-yellow-700' : 'bg-red-50 text-red-600'}`}>
          正常値の{pct}%
        </span>
      )}
    </div>
  )
}

interface SideMeasureInputsProps {
  label?: string
  side: string
  arom: string
  prom: string
  hasPain: boolean
  painAngle: string
  normalValue: number
  prevArom: number | null
  onChange: (field: string, val: string | boolean) => void
  onSensor?: () => void
}

function SideMeasureInputs({
  label, side, arom, prom, hasPain, painAngle, normalValue, prevArom, onChange, onSensor,
}: SideMeasureInputsProps) {
  return (
    <div className="space-y-2">
      {label && <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{label}</p>}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-slate-500 w-14">AROM</span>
          <input
            type="number"
            inputMode="numeric"
            placeholder="—"
            value={arom}
            onChange={(e) => onChange(`arom${side}`, e.target.value)}
            className={inputNum}
          />
          <span className="text-sm text-slate-500">°</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-slate-500 w-14">PROM</span>
          <input
            type="number"
            inputMode="numeric"
            placeholder="—"
            value={prom}
            onChange={(e) => onChange(`prom${side}`, e.target.value)}
            className={inputNum}
          />
          <span className="text-sm text-slate-500">°</span>
        </div>

        {/* センサー計測ボタン */}
        {onSensor && (
          <button
            type="button"
            onClick={onSensor}
            title="スマホセンサーで計測"
            className="flex items-center gap-1.5 px-3 py-2 bg-teal-50 hover:bg-teal-100 text-teal-700 border border-teal-200 rounded-xl text-xs font-semibold transition-all"
          >
            <Smartphone className="w-3.5 h-3.5" />
            センサー
          </button>
        )}

        <DiffBadge
          arom={arom !== '' ? Number(arom) : null}
          normalValue={normalValue}
          prevArom={prevArom}
        />
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <button
          type="button"
          onClick={() => onChange(`pain${side}`, !hasPain)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
            hasPain ? 'bg-orange-100 text-orange-700 border border-orange-300' : 'bg-slate-100 text-slate-600 border border-slate-200'
          }`}
        >
          <AlertTriangle className="w-3.5 h-3.5" />
          {hasPain ? '疼痛あり' : '疼痛なし'}
        </button>
        {hasPain && (
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-slate-500">出現角度</span>
            <input
              type="number"
              inputMode="numeric"
              placeholder="—"
              value={painAngle}
              onChange={(e) => onChange(`painAngle${side}`, e.target.value)}
              className={inputNum}
            />
            <span className="text-sm text-slate-500">°</span>
          </div>
        )}
      </div>
    </div>
  )
}

interface SensorTarget {
  direction: string
  sideKey: 'R' | 'L'
}

export default function ROMeasurePage() {
  const { id, joint } = useParams<{ id: string; joint: string }>()
  const router = useRouter()
  const jointType = joint as JointType
  const config = JOINT_CONFIGS[jointType]

  const [patientName, setPatientName] = useState('')
  const [selectedSide, setSelectedSide] = useState<SideType>(config?.bilateral ? 'none' : 'right')
  const [position, setPosition] = useState<MeasurementPositionType>(config?.defaultPosition ?? 'supine')
  const [measuredBy, setMeasuredBy] = useState('')
  const [overallNote, setOverallNote] = useState('')
  const [dirStates, setDirStates] = useState<Record<string, DirState>>({})
  const [prevAROMs, setPrevAROMs] = useState<Record<string, { right: number | null; left: number | null; none: number | null }>>({})
  const [sensorTarget, setSensorTarget] = useState<SensorTarget | null>(null)

  useEffect(() => {
    const patient = getPatient(id)
    if (patient) setPatientName(patient.name)

    const init: Record<string, DirState> = {}
    config?.directions.forEach((d) => { init[d.label] = initDirState() })
    setDirStates(init)

    const prevSessions = getSessionsByPatient(id).filter((s) => s.joint === jointType)
    if (prevSessions.length > 0) {
      const prev = prevSessions[0]
      const prevMap: typeof prevAROMs = {}
      config?.directions.forEach((d) => {
        const recR = prev.records.find((r) => r.direction === d.label && r.side === 'right')
        const recL = prev.records.find((r) => r.direction === d.label && r.side === 'left')
        const recN = prev.records.find((r) => r.direction === d.label && r.side === 'none')
        prevMap[d.label] = { right: recR?.arom ?? null, left: recL?.arom ?? null, none: recN?.arom ?? null }
      })
      setPrevAROMs(prevMap)
    }
  }, [id, jointType, config])

  function updateDir(dirLabel: string, field: string, val: string | boolean) {
    setDirStates((prev) => ({
      ...prev,
      [dirLabel]: { ...prev[dirLabel], [field]: val },
    }))
  }

  function handleSensorConfirm(angle: number) {
    if (!sensorTarget) return
    updateDir(sensorTarget.direction, `arom${sensorTarget.sideKey}`, String(angle))
    setSensorTarget(null)
  }

  function buildRecords(): ROMRecord[] {
    const records: ROMRecord[] = []
    config.directions.forEach((d) => {
      const s = dirStates[d.label]
      if (!s) return

      const makeRecord = (side: 'right' | 'left' | 'none', aromStr: string, promStr: string, hasPain: boolean, painAngleStr: string): ROMRecord => ({
        id: `rec-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        direction: d.label,
        side,
        position,
        arom: aromStr !== '' ? Number(aromStr) : null,
        prom: promStr !== '' ? Number(promStr) : null,
        normalValue: d.normalValue,
        hasPain,
        painAngle: hasPain && painAngleStr !== '' ? Number(painAngleStr) : null,
        painNote: '',
        endFeel: s.endFeel,
        compensatoryMotion: s.compensatoryMotion,
        memo: s.memo,
      })

      if (d.sideFixed) {
        const isRight = d.sideFixed === 'right'
        records.push(makeRecord(d.sideFixed, isRight ? s.aromR : s.aromL, isRight ? s.promR : s.promL, isRight ? s.painR : s.painL, isRight ? s.painAngleR : s.painAngleL))
      } else if (config.bilateral) {
        records.push(makeRecord('none', s.aromR, s.promR, s.painR, s.painAngleR))
      } else if (selectedSide === 'both') {
        records.push(makeRecord('right', s.aromR, s.promR, s.painR, s.painAngleR))
        records.push(makeRecord('left', s.aromL, s.promL, s.painL, s.painAngleL))
      } else {
        const isRight = selectedSide === 'right'
        records.push(makeRecord(selectedSide as 'right' | 'left', isRight ? s.aromR : s.aromL, isRight ? s.promR : s.promL, isRight ? s.painR : s.painL, isRight ? s.painAngleR : s.painAngleL))
      }
    })
    return records
  }

  function handleSave() {
    const records = buildRecords()
    const session: ROMSession = {
      id: `rs-${Date.now()}`,
      patientId: id,
      measuredAt: new Date().toISOString(),
      measuredBy: measuredBy.trim() || '未入力',
      sessionNumber: getNextSessionNumber(id),
      joint: jointType,
      records,
      overallNote: overallNote.trim(),
    }
    saveSession(session)
    router.push(`/rom/patients/${id}`)
  }

  if (!config) return <div className="text-center py-20 text-slate-500">無効な関節です</div>

  return (
    <div className="max-w-xl mx-auto pb-10">
      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <Link href={`/rom/patients/${id}/sessions/new`} className="p-2 rounded-xl hover:bg-slate-100 text-slate-500 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-slate-800">{JOINT_LABELS[jointType]} ROM測定</h1>
          <p className="text-xs text-slate-500">{patientName}</p>
        </div>
      </div>

      {/* 基本設定 */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 mb-4 space-y-3">
        {!config.bilateral && (
          <div>
            <p className="text-xs font-medium text-slate-600 mb-2">測定側</p>
            <div className="flex gap-2">
              {(['right', 'left', 'both'] as SideType[]).map((s) => (
                <button
                  key={s}
                  onClick={() => setSelectedSide(s)}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all border ${
                    selectedSide === s
                      ? 'bg-teal-600 text-white border-teal-600'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-teal-400'
                  }`}
                >
                  {s === 'right' ? '右' : s === 'left' ? '左' : '両側'}
                </button>
              ))}
            </div>
          </div>
        )}

        <div>
          <p className="text-xs font-medium text-slate-600 mb-2">測定肢位</p>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(POSITION_LABELS) as MeasurementPositionType[]).map((pos) => (
              <button
                key={pos}
                onClick={() => setPosition(pos)}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all border ${
                  position === pos
                    ? 'bg-slate-700 text-white border-slate-700'
                    : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'
                }`}
              >
                {POSITION_LABELS[pos]}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="text-xs font-medium text-slate-600 mb-2">測定者</p>
          <input
            type="text"
            placeholder="氏名または資格"
            value={measuredBy}
            onChange={(e) => setMeasuredBy(e.target.value)}
            className={`${inputSm} max-w-xs`}
          />
        </div>

        {/* センサー説明バナー */}
        <div className="flex items-center gap-2 bg-teal-50 border border-teal-100 rounded-xl px-3 py-2">
          <Smartphone className="w-4 h-4 text-teal-600 flex-shrink-0" />
          <p className="text-xs text-teal-700">
            <span className="font-semibold">センサーボタン</span>で、スマホを体に当てて角度を自動計測できます
          </p>
        </div>
      </div>

      {/* 各方向の測定 */}
      <div className="space-y-3">
        {config.directions.map((d) => {
          const s = dirStates[d.label]
          if (!s) return null

          const isSideFixed = !!d.sideFixed
          const isBilateral = config.bilateral && !d.sideFixed
          const showBoth = !isSideFixed && !isBilateral && selectedSide === 'both'
          const showLeft = !isSideFixed && !isBilateral && selectedSide === 'left'
          const useLeft = (d.sideFixed === 'left') || showLeft

          const prevR = prevAROMs[d.label]?.right ?? null
          const prevL = prevAROMs[d.label]?.left ?? null
          const prevN = prevAROMs[d.label]?.none ?? null
          const prevAromForR = isBilateral ? prevN : prevR

          return (
            <div key={d.label} className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
              <button
                type="button"
                onClick={() => updateDir(d.label, 'expanded', !s.expanded)}
                className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-slate-50"
              >
                <div className="flex items-center gap-3">
                  <span className="text-base font-bold text-slate-800">{d.label}</span>
                  <span className="text-xs text-slate-400">基準値 {d.normalValue}°</span>
                  {/* 入力済みインジケーター */}
                  {((useLeft ? s.aromL : s.aromR) !== '') && (
                    <span className="text-xs bg-teal-100 text-teal-700 px-2 py-0.5 rounded-full">
                      {useLeft ? s.aromL : s.aromR}°
                    </span>
                  )}
                </div>
                {s.expanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
              </button>

              {s.expanded && (
                <div className="px-4 pb-4 space-y-4 border-t border-slate-100">
                  <div className="pt-3">
                    {showBoth ? (
                      <div className="space-y-4">
                        <div className="pb-3 border-b border-slate-100">
                          <SideMeasureInputs
                            label="右（Right）" side="R"
                            arom={s.aromR} prom={s.promR} hasPain={s.painR} painAngle={s.painAngleR}
                            normalValue={d.normalValue} prevArom={prevR}
                            onChange={(f, v) => updateDir(d.label, f, v)}
                            onSensor={() => setSensorTarget({ direction: d.label, sideKey: 'R' })}
                          />
                        </div>
                        <SideMeasureInputs
                          label="左（Left）" side="L"
                          arom={s.aromL} prom={s.promL} hasPain={s.painL} painAngle={s.painAngleL}
                          normalValue={d.normalValue} prevArom={prevL}
                          onChange={(f, v) => updateDir(d.label, f, v)}
                          onSensor={() => setSensorTarget({ direction: d.label, sideKey: 'L' })}
                        />
                      </div>
                    ) : useLeft ? (
                      <SideMeasureInputs
                        side="L" arom={s.aromL} prom={s.promL} hasPain={s.painL} painAngle={s.painAngleL}
                        normalValue={d.normalValue} prevArom={prevL}
                        onChange={(f, v) => updateDir(d.label, f, v)}
                        onSensor={() => setSensorTarget({ direction: d.label, sideKey: 'L' })}
                      />
                    ) : (
                      <SideMeasureInputs
                        side="R" arom={s.aromR} prom={s.promR} hasPain={s.painR} painAngle={s.painAngleR}
                        normalValue={d.normalValue} prevArom={prevAromForR}
                        onChange={(f, v) => updateDir(d.label, f, v)}
                        onSensor={() => setSensorTarget({ direction: d.label, sideKey: 'R' })}
                      />
                    )}
                  </div>

                  {/* エンドフィール */}
                  <div>
                    <p className="text-xs font-medium text-slate-600 mb-1.5">エンドフィール</p>
                    <select
                      value={s.endFeel}
                      onChange={(e) => updateDir(d.label, 'endFeel', e.target.value)}
                      className={`${inputSm} max-w-xs`}
                    >
                      {(Object.keys(END_FEEL_LABELS) as EndFeelType[]).map((ef) => (
                        <option key={ef} value={ef}>{END_FEEL_LABELS[ef]}</option>
                      ))}
                    </select>
                  </div>

                  {/* 代償動作 */}
                  <div>
                    <p className="text-xs font-medium text-slate-600 mb-1.5">代償動作</p>
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {config.compensatoryOptions.map((opt) => (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => updateDir(d.label, 'compensatoryMotion', s.compensatoryMotion === opt ? '' : opt)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all border ${
                            s.compensatoryMotion === opt
                              ? 'bg-amber-100 text-amber-800 border-amber-300'
                              : 'bg-white text-slate-600 border-slate-200 hover:border-amber-300'
                          }`}
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                    <input
                      type="text"
                      placeholder="その他（自由入力）"
                      value={s.compensatoryMotion}
                      onChange={(e) => updateDir(d.label, 'compensatoryMotion', e.target.value)}
                      className={`${inputSm} max-w-xs`}
                    />
                  </div>

                  {/* メモ */}
                  <div>
                    <p className="text-xs font-medium text-slate-600 mb-1.5">メモ</p>
                    <textarea
                      rows={2}
                      placeholder="気づいたことを記録"
                      value={s.memo}
                      onChange={(e) => updateDir(d.label, 'memo', e.target.value)}
                      className={`${inputSm} resize-none`}
                    />
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* セッションメモ */}
      <div className="mt-4 bg-white rounded-2xl border border-slate-200 p-4">
        <p className="text-xs font-medium text-slate-600 mb-2">総合メモ</p>
        <textarea
          rows={3}
          placeholder="セッション全体のメモ・特記事項"
          value={overallNote}
          onChange={(e) => setOverallNote(e.target.value)}
          className={`${inputSm} resize-none`}
        />
      </div>

      {/* 保存 */}
      <button
        onClick={handleSave}
        className="mt-5 w-full flex items-center justify-center gap-2 bg-teal-600 hover:bg-teal-700 text-white font-bold py-4 rounded-2xl transition-colors shadow-md text-base"
      >
        <Save className="w-5 h-5" />
        測定結果を保存する
      </button>

      {/* センサー計測モーダル */}
      {sensorTarget && (
        <SensorROMModal
          joint={jointType}
          direction={sensorTarget.direction}
          onConfirm={handleSensorConfirm}
          onClose={() => setSensorTarget(null)}
        />
      )}
    </div>
  )
}
