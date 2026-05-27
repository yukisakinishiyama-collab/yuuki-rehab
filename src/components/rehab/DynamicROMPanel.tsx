'use client'

/**
 * DynamicROMPanel — 動的ROM計測パネル
 *
 * 機能:
 *  1. MediaPipe 骨格検出の角度データをリアルタイム表示
 *  2. 記録ボタンで動画タイムスタンプ付きデータを蓄積
 *  3. SVGグラフで時系列ROM変化を可視化
 *  4. 最大ROM・最小ROM・可動域（Range）を自動算出
 *  5. 左右対称スコアを表示
 *  6. 保存した計測セッションを一覧表示
 */

import { useState, useRef, useCallback, useEffect } from 'react'
import type { ROMItem } from '@/lib/pose-analyzer'
import type { ROMSession, ROMSample } from '@/types/rehab'
import { getROMSessions, saveROMSession, deleteROMSession, generateId, getCurrentUser } from '@/lib/rehab-store'
import {
  Activity, Circle, Square, Trash2, ChevronDown, ChevronUp,
  TrendingUp, ArrowLeftRight, AlertCircle, Info,
} from 'lucide-react'

// ── カラーパレット（関節ごと） ─────────────────────────────────────────────────
const JOINT_COLORS: Record<string, string> = {
  leftKnee:     '#3b82f6',
  rightKnee:    '#ef4444',
  leftHip:      '#8b5cf6',
  rightHip:     '#f97316',
  leftAnkle:    '#06b6d4',
  rightAnkle:   '#ec4899',
  trunkAngle:   '#22c55e',
  leftElbow:    '#84cc16',
  rightElbow:   '#eab308',
}

// ── 統計計算 ──────────────────────────────────────────────────────────────────
interface JointStats {
  key:       string
  label:     string
  side:      string
  color:     string
  max:       number
  min:       number
  range:     number
  avg:       number
  samples:   { t: number; v: number }[]
}

function calcStats(samples: ROMSample[], selectedKeys: string[]): JointStats[] {
  if (samples.length === 0) return []
  const statsMap = new Map<string, JointStats>()

  for (const sample of samples) {
    for (const [key, ang] of Object.entries(sample.angles)) {
      if (selectedKeys.length > 0 && !selectedKeys.includes(key)) continue
      if (!statsMap.has(key)) {
        statsMap.set(key, {
          key, label: ang.label, side: ang.side,
          color: JOINT_COLORS[key] ?? '#94a3b8',
          max: -Infinity, min: Infinity, range: 0, avg: 0,
          samples: [],
        })
      }
      const s = statsMap.get(key)!
      s.samples.push({ t: sample.t, v: ang.value })
      if (ang.value > s.max) s.max = ang.value
      if (ang.value < s.min) s.min = ang.value
    }
  }

  for (const s of statsMap.values()) {
    s.range = s.max - s.min
    s.avg   = s.samples.reduce((a, b) => a + b.v, 0) / s.samples.length
    s.max   = Math.round(s.max)
    s.min   = Math.round(s.min)
    s.range = Math.round(s.range)
    s.avg   = Math.round(s.avg)
  }

  return [...statsMap.values()].sort((a, b) => b.range - a.range)
}

// ── 左右対称スコア ─────────────────────────────────────────────────────────────
function symmetryScore(stats: JointStats[]): { score: number; detail: string } {
  const pairs = [
    ['leftKnee', 'rightKnee'],
    ['leftHip',  'rightHip'],
    ['leftAnkle','rightAnkle'],
  ]
  const diffs: number[] = []
  for (const [lk, rk] of pairs) {
    const l = stats.find((s) => s.key === lk)
    const r = stats.find((s) => s.key === rk)
    if (l && r && l.range > 0 && r.range > 0) {
      diffs.push(Math.abs(l.range - r.range) / Math.max(l.range, r.range))
    }
  }
  if (diffs.length === 0) return { score: -1, detail: 'データ不足' }
  const avg = diffs.reduce((a, b) => a + b, 0) / diffs.length
  const score = Math.round((1 - avg) * 100)
  const detail = score >= 90 ? '良好' : score >= 75 ? 'やや非対称' : '左右差あり'
  return { score, detail }
}

// ── SVGグラフ ─────────────────────────────────────────────────────────────────
interface GraphProps {
  stats:       JointStats[]
  duration:    number       // 秒
  currentTime: number       // 動画の現在時刻（秒）
  startTime:   number       // 計測開始時刻（秒）
  onSeek:      (t: number) => void
}

function ROMGraph({ stats, duration, currentTime, startTime, onSeek }: GraphProps) {
  const W = 560, H = 180
  const PAD = { top: 12, right: 12, bottom: 28, left: 36 }
  const gW = W - PAD.left - PAD.right
  const gH = H - PAD.top  - PAD.bottom

  if (stats.length === 0 || duration <= 0) return (
    <div className="flex items-center justify-center h-28 text-gray-400 text-xs">
      計測データがありません
    </div>
  )

  const allVals = stats.flatMap((s) => s.samples.map((p) => p.v))
  const yMin = Math.min(0, ...allVals) - 5
  const yMax = Math.max(10, ...allVals) + 5
  const xScale = (t: number) => ((t - startTime) / duration) * gW + PAD.left
  const yScale = (v: number) => H - PAD.bottom - ((v - yMin) / (yMax - yMin)) * gH

  const gridY = [0, 30, 60, 90, 120, 150].filter((v) => v >= yMin && v <= yMax)
  const gridXCount = Math.min(6, Math.ceil(duration))
  const gridXStep  = duration / gridXCount

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full cursor-crosshair"
      style={{ height: '160px' }}
      onClick={(e) => {
        const rect = e.currentTarget.getBoundingClientRect()
        const rx = (e.clientX - rect.left) / rect.width * W
        const t  = ((rx - PAD.left) / gW) * duration + startTime
        onSeek(Math.max(startTime, Math.min(startTime + duration, t)))
      }}
    >
      {/* 背景 */}
      <rect x={PAD.left} y={PAD.top} width={gW} height={gH} fill="#f8fafc" rx={4} />

      {/* Y グリッド線 */}
      {gridY.map((v) => (
        <g key={v}>
          <line
            x1={PAD.left} y1={yScale(v)} x2={PAD.left + gW} y2={yScale(v)}
            stroke="#e2e8f0" strokeWidth={1}
          />
          <text x={PAD.left - 4} y={yScale(v) + 4} textAnchor="end" fontSize={9} fill="#94a3b8">{v}°</text>
        </g>
      ))}

      {/* X グリッド線（秒） */}
      {[...Array(gridXCount + 1)].map((_, i) => {
        const t = startTime + i * gridXStep
        const x = xScale(t)
        return (
          <g key={i}>
            <line x1={x} y1={PAD.top} x2={x} y2={PAD.top + gH} stroke="#e2e8f0" strokeWidth={1} />
            <text x={x} y={H - PAD.bottom + 10} textAnchor="middle" fontSize={9} fill="#94a3b8">
              {t.toFixed(1)}s
            </text>
          </g>
        )
      })}

      {/* 軸 */}
      <line x1={PAD.left} y1={PAD.top} x2={PAD.left} y2={PAD.top + gH} stroke="#cbd5e1" strokeWidth={1.5} />
      <line x1={PAD.left} y1={PAD.top + gH} x2={PAD.left + gW} y2={PAD.top + gH} stroke="#cbd5e1" strokeWidth={1.5} />

      {/* 0° 線（強調） */}
      {yMin < 0 && 0 < yMax && (
        <line x1={PAD.left} y1={yScale(0)} x2={PAD.left + gW} y2={yScale(0)}
          stroke="#94a3b8" strokeWidth={1} strokeDasharray="3,3" />
      )}

      {/* データライン */}
      {stats.map((s) => {
        if (s.samples.length < 2) return null
        const pts = s.samples
          .map((p) => `${xScale(p.t).toFixed(1)},${yScale(p.v).toFixed(1)}`)
          .join(' ')
        return (
          <g key={s.key}>
            <polyline points={pts} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" />
            {/* Max点 */}
            {(() => {
              const maxP = s.samples.reduce((a, b) => b.v > a.v ? b : a)
              return (
                <g>
                  <circle cx={xScale(maxP.t)} cy={yScale(maxP.v)} r={4} fill={s.color} />
                  <text x={xScale(maxP.t)} y={yScale(maxP.v) - 6} textAnchor="middle" fontSize={9} fill={s.color} fontWeight="bold">
                    {Math.round(maxP.v)}°
                  </text>
                </g>
              )
            })()}
          </g>
        )
      })}

      {/* 現在時刻カーソル */}
      {currentTime >= startTime && currentTime <= startTime + duration && (
        <line
          x1={xScale(currentTime)} y1={PAD.top}
          x2={xScale(currentTime)} y2={PAD.top + gH}
          stroke="#f59e0b" strokeWidth={2} strokeDasharray="4,2"
        />
      )}
    </svg>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// メインコンポーネント
// ─────────────────────────────────────────────────────────────────────────────
interface Props {
  videoId:     string
  caseId:      string
  romItems:    ROMItem[]      // 最新のMediaPipe ROM（VideoPlayer から）
  currentTime: number         // 動画の現在時刻
  onSeek:      (t: number) => void
  isMediaPipeActive: boolean
}

const SAMPLE_INTERVAL_MS = 150   // 記録間隔（150ms ≈ 6~7fps）

export default function DynamicROMPanel({
  videoId, caseId, romItems, currentTime, onSeek, isMediaPipeActive,
}: Props) {
  const [recording,       setRecording]       = useState(false)
  const [sessions,        setSessions]        = useState<ROMSession[]>([])
  const [selectedSession, setSelectedSession] = useState<ROMSession | null>(null)
  const [expandedId,      setExpandedId]      = useState<string | null>(null)
  const [selectedJoints,  setSelectedJoints]  = useState<string[]>([])

  const samplesRef    = useRef<ROMSample[]>([])
  const startTimeRef  = useRef<number>(0)
  const lastSampleRef = useRef<number>(0)
  const sessionCountRef = useRef<number>(0)

  useEffect(() => {
    const s = getROMSessions(videoId)
    setSessions(s)
    if (s.length > 0) setSelectedSession(s[0])
  }, [videoId])

  // ── リアルタイム記録 ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!recording || romItems.length === 0) return
    const now = Date.now()
    if (now - lastSampleRef.current < SAMPLE_INTERVAL_MS) return
    lastSampleRef.current = now

    const angles: ROMSample['angles'] = {}
    for (const item of romItems) {
      const key = item.key
      angles[key] = { value: item.value, direction: item.direction, label: item.label, side: item.side }
    }
    samplesRef.current.push({ t: currentTime, angles })
  }, [romItems, currentTime, recording])

  // ── 記録開始 ──────────────────────────────────────────────────────────────
  function startRecording() {
    samplesRef.current = []
    startTimeRef.current = currentTime
    lastSampleRef.current = 0
    setRecording(true)
  }

  // ── 記録停止 & 保存 ────────────────────────────────────────────────────────
  function stopRecording() {
    setRecording(false)
    const samples = samplesRef.current
    if (samples.length < 2) return

    sessionCountRef.current += 1
    const user = getCurrentUser()
    const endT = samples[samples.length - 1].t
    const session: ROMSession = {
      id:            generateId('rom'),
      caseId,
      videoId,
      label:         `ROM計測 #${sessionCountRef.current}`,
      samples,
      durationSec:   endT - startTimeRef.current,
      startTime:     startTimeRef.current,
      createdAt:     new Date().toISOString(),
      createdByName: user?.name ?? 'スタッフ',
      source:        'mediapipe',
    }
    saveROMSession(session)
    const updated = getROMSessions(videoId)
    setSessions(updated)
    setSelectedSession(session)
  }

  function handleDelete(id: string) {
    if (!confirm('この計測セッションを削除しますか？')) return
    deleteROMSession(id)
    const updated = getROMSessions(videoId)
    setSessions(updated)
    setSelectedSession(updated[0] ?? null)
  }

  // ── 表示するJointを切り替え ────────────────────────────────────────────────
  function toggleJoint(key: string) {
    setSelectedJoints((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    )
  }

  // ── 選択中セッションの統計 ────────────────────────────────────────────────
  const selStats = selectedSession
    ? calcStats(selectedSession.samples, selectedJoints)
    : []
  const symScore = symmetryScore(selStats)

  // ── リアルタイム角度（最新ROMItems） ─────────────────────────────────────
  const liveAngles = romItems.slice(0, 8)

  return (
    <div className="flex flex-col gap-4 h-full">
      {/* ── MediaPipe 未起動の案内 ────────────────────────────────────────── */}
      {!isMediaPipeActive && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
          <div className="text-xs text-amber-800 leading-relaxed">
            <p className="font-semibold mb-0.5">骨格（Scan）をONにしてください</p>
            <p>動画プレイヤー下の <strong>「骨格」ボタン</strong> をONにするとリアルタイムROM計測が開始します。</p>
          </div>
        </div>
      )}

      {/* ── リアルタイムROM表示 ───────────────────────────────────────────── */}
      {isMediaPipeActive && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-gray-700 flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-teal-500" />
              リアルタイムROM
            </p>
            {recording && (
              <span className="flex items-center gap-1 text-xs text-red-500 font-semibold animate-pulse">
                <Circle className="w-2.5 h-2.5 fill-red-500" />
                記録中
              </span>
            )}
          </div>

          {liveAngles.length === 0 ? (
            <p className="text-xs text-gray-400 py-2">人物を検出中...</p>
          ) : (
            <div className="grid grid-cols-2 gap-1.5">
              {liveAngles.map((item) => {
                const isNormal = item.value >= item.normalMin && item.value <= item.normalMax
                const pct = Math.max(0, Math.min(100,
                  ((item.value - item.normalMin) / (item.normalMax - item.normalMin + 1)) * 100
                ))
                const color = isNormal ? '#22c55e' : item.value > item.normalMax * 1.2 ? '#ef4444' : '#f59e0b'
                const sideLabel = item.side === 'L' ? '左' : item.side === 'R' ? '右' : ''
                return (
                  <div key={item.key} className="bg-gray-50 rounded-lg p-2 border border-gray-100">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] text-gray-500">{sideLabel}{item.label.replace(/左|右/,'')}</span>
                      <span className="text-xs font-bold" style={{ color }}>{item.direction}</span>
                    </div>
                    {/* バーゲージ */}
                    <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${pct}%`, background: color }}
                      />
                    </div>
                    <div className="flex justify-between mt-0.5 text-[9px] text-gray-400">
                      <span>{item.normalMin}°</span>
                      <span>{isNormal ? '✓ 正常域' : '△ 要注意'}</span>
                      <span>{item.normalMax}°</span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* 記録ボタン */}
          <div className="mt-3 flex gap-2">
            {!recording ? (
              <button
                onClick={startRecording}
                disabled={liveAngles.length === 0}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-red-500 hover:bg-red-600 disabled:opacity-40 text-white text-xs font-semibold rounded-lg transition-colors"
              >
                <Circle className="w-3 h-3 fill-white" />
                記録開始
              </button>
            ) : (
              <button
                onClick={stopRecording}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-gray-700 hover:bg-gray-800 text-white text-xs font-semibold rounded-lg transition-colors"
              >
                <Square className="w-3 h-3 fill-white" />
                記録停止・保存
              </button>
            )}
          </div>
          <p className="text-[10px] text-gray-400 mt-1 text-center">
            動画を再生しながら「記録開始」→ 計測したい動作を行ったら「記録停止」
          </p>
        </div>
      )}

      <div className="border-t border-gray-100" />

      {/* ── 保存済みセッション ────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto min-h-0 space-y-3">
        {sessions.length === 0 ? (
          <div className="text-center py-6 text-gray-400">
            <TrendingUp className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p className="text-xs">計測データがありません</p>
            <p className="text-[10px] mt-0.5">骨格をONにして記録を開始してください</p>
          </div>
        ) : (
          <>
            {/* セッション選択 */}
            <div className="flex gap-1.5 flex-wrap">
              {sessions.map((s, i) => (
                <button
                  key={s.id}
                  onClick={() => setSelectedSession(s)}
                  className={`text-[10px] px-2 py-1 rounded-lg font-medium border transition-colors ${
                    selectedSession?.id === s.id
                      ? 'bg-[#1e3a5f] text-white border-[#1e3a5f]'
                      : 'text-gray-600 border-gray-300 hover:border-teal-400'
                  }`}
                >
                  #{i + 1} {s.durationSec.toFixed(1)}s
                </button>
              ))}
            </div>

            {selectedSession && selStats.length > 0 && (
              <div className="space-y-3">
                {/* ── グラフ ── */}
                <div className="bg-white rounded-xl border border-gray-200 p-3">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold text-gray-700 flex items-center gap-1.5">
                      <TrendingUp className="w-3.5 h-3.5 text-blue-500" />
                      ROM時系列グラフ
                    </p>
                    <button
                      onClick={() => handleDelete(selectedSession.id)}
                      className="text-gray-300 hover:text-red-400 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* 関節フィルター */}
                  <div className="flex flex-wrap gap-1 mb-2">
                    {selStats.map((s) => {
                      const active = selectedJoints.length === 0 || selectedJoints.includes(s.key)
                      return (
                        <button
                          key={s.key}
                          onClick={() => toggleJoint(s.key)}
                          className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full border transition-colors"
                          style={{
                            borderColor: active ? s.color : '#e2e8f0',
                            background:  active ? s.color + '22' : 'transparent',
                            color:       active ? s.color : '#94a3b8',
                          }}
                        >
                          <span className="w-2 h-2 rounded-full" style={{ background: s.color }} />
                          {s.side === 'L' ? '左' : s.side === 'R' ? '右' : ''}{s.label.replace(/左|右/,'')}
                        </button>
                      )
                    })}
                  </div>

                  <ROMGraph
                    stats={selStats.filter((s) =>
                      selectedJoints.length === 0 || selectedJoints.includes(s.key)
                    )}
                    duration={selectedSession.durationSec}
                    startTime={selectedSession.startTime}
                    currentTime={currentTime}
                    onSeek={onSeek}
                  />
                  <p className="text-[9px] text-gray-400 text-center mt-1">
                    グラフをクリックで動画をシーク
                  </p>
                </div>

                {/* ── 統計サマリー ── */}
                <div className="bg-white rounded-xl border border-gray-200 p-3">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold text-gray-700">ROM統計</p>
                    {/* 左右対称スコア */}
                    {symScore.score >= 0 && (
                      <div className="flex items-center gap-1.5">
                        <ArrowLeftRight className="w-3 h-3 text-purple-500" />
                        <span className="text-xs font-bold" style={{
                          color: symScore.score >= 90 ? '#22c55e' : symScore.score >= 75 ? '#f59e0b' : '#ef4444',
                        }}>
                          対称{symScore.score}%
                        </span>
                        <span className="text-[10px] text-gray-400">{symScore.detail}</span>
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    {selStats.slice(0, 6).map((s) => (
                      <div key={s.key} className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: s.color }} />
                        <span className="text-[10px] text-gray-600 w-20 flex-shrink-0 truncate">
                          {s.side === 'L' ? '左' : s.side === 'R' ? '右' : ''}{s.label.replace(/左|右/,'')}
                        </span>
                        {/* バー表示（可動域） */}
                        <div className="flex-1 flex items-center gap-1.5">
                          <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full"
                              style={{
                                marginLeft: `${Math.max(0, (s.min / 180) * 100)}%`,
                                width:      `${Math.max(2, (s.range / 180) * 100)}%`,
                                background: s.color,
                              }}
                            />
                          </div>
                          <span className="text-[10px] font-semibold text-gray-700 w-12 text-right flex-shrink-0">
                            {s.min}°–{s.max}°
                          </span>
                        </div>
                        <span
                          className="text-[10px] font-bold w-10 text-right flex-shrink-0"
                          style={{ color: s.color }}
                        >
                          {s.range}°
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="mt-2 pt-2 border-t border-gray-100 flex gap-3 text-[10px] text-gray-400">
                    <span>■ バー = 可動範囲</span>
                    <span className="font-bold text-gray-500">右端数値 = 可動域</span>
                  </div>
                </div>

                {/* ── 追加分析：最大ROM検出フレーム ── */}
                <div className="bg-white rounded-xl border border-gray-200 p-3">
                  <p className="text-xs font-semibold text-gray-700 mb-2 flex items-center gap-1.5">
                    <span className="text-amber-500">★</span>
                    最大ROM検出フレーム
                  </p>
                  <div className="space-y-1.5">
                    {selStats.slice(0, 4).map((s) => {
                      const maxSample = s.samples.reduce((a, b) => b.v > a.v ? b : a)
                      return (
                        <button
                          key={s.key}
                          onClick={() => onSeek(maxSample.t)}
                          className="w-full flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-gray-50 transition-colors text-left border border-transparent hover:border-gray-200"
                        >
                          <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: s.color }} />
                          <span className="text-[10px] text-gray-600 flex-1">
                            {s.side === 'L' ? '左' : s.side === 'R' ? '右' : ''}{s.label.replace(/左|右/,'')}
                          </span>
                          <span className="text-[10px] font-mono text-gray-400">{maxSample.t.toFixed(2)}s</span>
                          <span className="text-xs font-bold" style={{ color: s.color }}>
                            {Math.round(maxSample.v)}°
                          </span>
                          <span className="text-[10px] text-teal-500">→ シーク</span>
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* ── セッション情報 ── */}
                <div className="bg-gray-50 rounded-xl p-2.5 text-[10px] text-gray-400 flex justify-between">
                  <span>{selectedSession.label}</span>
                  <span>{new Date(selectedSession.createdAt).toLocaleString('ja-JP', {
                    month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit',
                  })}</span>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
