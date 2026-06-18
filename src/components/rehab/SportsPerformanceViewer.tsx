'use client'

/**
 * スポーツパフォーマンス解析ビューワー
 *
 * 機能:
 *  - アップロード動画から最大6人の骨格を同時追跡（heavy model + GPU優先）
 *  - EMA 平滑化による高精度追跡
 *  - スピード・加速度 / ジャンプ高・滞空時間 / 左右非対称 / 疲労兆候 の計測
 *  - 人物ごとに色分けされた骨格オーバーレイ
 */

import { useRef, useState, useCallback, useEffect } from 'react'
import {
  Upload, Play, Pause, RotateCcw, Users,
  Zap, Activity, TrendingUp, AlertTriangle,
  ChevronRight, Loader2,
} from 'lucide-react'

import {
  initSportsMode,
  detectSportsFrame,
  drawSportsPoseOverlay,
} from '@/lib/pose-analyzer'
import { updateTracks, resetTracks }         from '@/lib/multi-tracker'
import { recordFrame, computeAllMetrics, resetMetrics } from '@/lib/sports-metrics'
import type { TrackedPerson }  from '@/lib/multi-tracker'
import type { PersonMetrics, JumpEvent }  from '@/lib/sports-metrics'

// ── 定数 ────────────────────────────────────────────────────────────────────

/** 解析時の処理フレームレート (fps) */
const ANALYSIS_FPS = 10
const FRAME_INTERVAL_SEC = 1 / ANALYSIS_FPS

// ── 補助 UI コンポーネント ───────────────────────────────────────────────────

/** スピードスパークライン（SVG） */
function SpeedSparkline({ data, color }: { data: number[]; color: string }) {
  if (data.length < 2) return null
  const max  = Math.max(...data, 0.1)
  const W = 200, H = 40
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * W
    const y = H - (v / max) * H
    return `${x},${y}`
  }).join(' ')
  return (
    <svg width={W} height={H} className="w-full h-auto overflow-visible">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <polyline points={`0,${H} ${pts} ${W},${H}`} fill={color} fillOpacity="0.12" stroke="none" />
    </svg>
  )
}

/** ゲージバー */
function GaugeBar({ value, max, color, label }: { value: number; max: number; color: string; label: string }) {
  const pct = Math.min(100, Math.round((value / max) * 100))
  return (
    <div>
      <div className="flex justify-between text-xs text-gray-500 mb-1">
        <span>{label}</span><span className="font-medium text-gray-700">{value}</span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-300" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
    </div>
  )
}

/** ジャンプイベントカード */
function JumpCard({ event, idx }: { event: JumpEvent; idx: number }) {
  return (
    <div className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2 text-sm">
      <span className="text-gray-500">#{idx + 1} {event.startT.toFixed(1)}s</span>
      <span className="font-medium">{event.airTimeSec.toFixed(2)}s 滞空</span>
      <span className="font-bold text-[#0d9488]">{event.heightCm} cm</span>
    </div>
  )
}

/** 疲労ラベル */
function FatigueLabel({ label }: { label: PersonMetrics['fatigueLabel'] }) {
  const cls = label === '良好'
    ? 'bg-green-100 text-green-800'
    : label === '注意'
    ? 'bg-yellow-100 text-yellow-800'
    : 'bg-red-100 text-red-800'
  return <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${cls}`}>{label}</span>
}

// ── メインコンポーネント ──────────────────────────────────────────────────────

type Status = 'idle' | 'loadingModel' | 'ready' | 'analyzing' | 'done'

export default function SportsPerformanceViewer() {
  // refs
  const videoRef  = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef    = useRef<number>(0)
  const lastTRef  = useRef<number>(-1)
  const frameStoreRef = useRef<{ t: number; persons: TrackedPerson[] }[]>([])

  // state
  const [videoUrl,    setVideoUrl]    = useState<string | null>(null)
  const [status,      setStatus]      = useState<Status>('idle')
  const [progress,    setProgress]    = useState(0)
  const [tracks,      setTracks]      = useState<TrackedPerson[]>([])
  const [selectedId,  setSelectedId]  = useState<number | null>(null)
  const [metrics,     setMetrics]     = useState<Map<number, PersonMetrics>>(new Map())
  const [isPlaying,   setIsPlaying]   = useState(false)
  const [modelError,  setModelError]  = useState<string | null>(null)

  // クリーンアップ
  useEffect(() => () => {
    cancelAnimationFrame(rafRef.current)
    if (videoUrl) URL.revokeObjectURL(videoUrl)
  }, [videoUrl])

  // ── ファイル選択 ────────────────────────────────────────────────────────
  const handleFile = useCallback((file: File) => {
    if (!file.type.startsWith('video/')) return
    cancelAnimationFrame(rafRef.current)
    if (videoUrl) URL.revokeObjectURL(videoUrl)
    const url = URL.createObjectURL(file)
    setVideoUrl(url)
    setStatus('ready')
    setProgress(0)
    setTracks([])
    setSelectedId(null)
    setMetrics(new Map())
    frameStoreRef.current = []
    resetTracks()
    resetMetrics()
  }, [videoUrl])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }, [handleFile])

  // ── 骨格オーバーレイ描画 ─────────────────────────────────────────────────
  const drawOverlay = useCallback((persons: TrackedPerson[]) => {
    const canvas = canvasRef.current
    const video  = videoRef.current
    if (!canvas || !video) return

    canvas.width  = video.videoWidth  || 640
    canvas.height = video.videoHeight || 360

    const ctx = canvas.getContext('2d')!
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    const W = canvas.width, H = canvas.height

    for (const person of persons) {
      if (person.lostFrames > 0) continue

      // 骨格描画
      drawSportsPoseOverlay(ctx, person.landmarks, person.color, W, H)

      // 人物 ID ラベル（頭の上）
      const nose = person.landmarks[0]
      if (nose && (nose.visibility ?? 1) > 0.3) {
        const x = nose.x * W, y = nose.y * H - 12
        const label = `P${person.id + 1}`
        ctx.font        = 'bold 13px sans-serif'
        ctx.strokeStyle = 'rgba(0,0,0,0.75)'
        ctx.lineWidth   = 3.5
        ctx.strokeText(label, x - 7, y)
        ctx.fillStyle   = person.color
        ctx.fillText(label, x - 7, y)
      }

      // 選択中はハイライトリング（腰中点）
      if (selectedId === person.id) {
        const { centroid } = person
        ctx.save()
        ctx.strokeStyle = person.color
        ctx.lineWidth   = 3
        ctx.globalAlpha = 0.7
        ctx.beginPath()
        ctx.arc(centroid.x * W, centroid.y * H, 22, 0, Math.PI * 2)
        ctx.stroke()
        ctx.restore()
      }
    }
  }, [selectedId])

  // ── キャンバスクリック → 人物選択 ────────────────────────────────────────
  const handleCanvasClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas || tracks.length === 0) return
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width  / rect.width
    const scaleY = canvas.height / rect.height
    const cx = (e.clientX - rect.left) * scaleX / canvas.width
    const cy = (e.clientY - rect.top)  * scaleY / canvas.height

    // 最近傍の人物を選択
    let bestId = -1, bestDist = 0.15
    for (const p of tracks) {
      if (p.lostFrames > 0) continue
      const d = Math.hypot(p.centroid.x - cx, p.centroid.y - cy)
      if (d < bestDist) { bestDist = d; bestId = p.id }
    }
    setSelectedId(bestId >= 0 ? bestId : null)
  }, [tracks])

  // ── 解析ループ ───────────────────────────────────────────────────────────
  const startAnalysis = useCallback(async () => {
    const video = videoRef.current
    if (!video || !videoUrl) return

    setModelError(null)
    setStatus('loadingModel')
    setProgress(0)
    setTracks([])
    setMetrics(new Map())
    frameStoreRef.current = []
    resetTracks()
    resetMetrics()
    lastTRef.current = -1

    try {
      await initSportsMode()
    } catch (err) {
      setModelError('モデルの読み込みに失敗しました。ネットワーク接続を確認してください。')
      setStatus('ready')
      return
    }

    setStatus('analyzing')
    video.currentTime = 0

    await new Promise<void>((resolve) => {
      const onSeeked = () => { video.removeEventListener('seeked', onSeeked); resolve() }
      video.addEventListener('seeked', onSeeked)
    })

    await video.play()
    setIsPlaying(true)

    const loop = () => {
      const v = videoRef.current
      if (!v) return

      if (v.ended || (v.paused && v.currentTime >= v.duration - 0.05)) {
        // 解析完了
        v.pause()
        setIsPlaying(false)
        const finalMetrics = computeAllMetrics()
        setMetrics(finalMetrics)
        setStatus('done')
        cancelAnimationFrame(rafRef.current)
        return
      }

      const now = v.currentTime
      if (now - lastTRef.current >= FRAME_INTERVAL_SEC) {
        lastTRef.current = now

        const result  = detectSportsFrame(v, now * 1000)
        const tracked = updateTracks(result.persons)
        recordFrame(tracked, now)

        // フレームストア（再生時のオーバーレイ復元用）
        frameStoreRef.current.push({ t: now, persons: tracked.map((p) => ({ ...p })) })

        setTracks([...tracked])
        setProgress(Math.round((now / v.duration) * 100))
        drawOverlay(tracked)
      }

      rafRef.current = requestAnimationFrame(loop)
    }

    rafRef.current = requestAnimationFrame(loop)
  }, [videoUrl, drawOverlay])

  // ── 解析完了後の再生オーバーレイ ────────────────────────────────────────
  useEffect(() => {
    if (status !== 'done') return
    const video = videoRef.current
    if (!video) return

    const onTimeUpdate = () => {
      const store = frameStoreRef.current
      if (store.length === 0) return
      const t = video.currentTime
      // 二分探索で最近傍フレームを探す
      let lo = 0, hi = store.length - 1
      while (lo < hi) {
        const mid = (lo + hi + 1) >> 1
        store[mid].t <= t ? (lo = mid) : (hi = mid - 1)
      }
      drawOverlay(store[lo].persons)
    }

    video.addEventListener('timeupdate', onTimeUpdate)
    return () => video.removeEventListener('timeupdate', onTimeUpdate)
  }, [status, drawOverlay])

  // 再描画: selectedId が変わったら現在のフレームを再描画
  useEffect(() => {
    if (tracks.length > 0) drawOverlay(tracks)
  }, [selectedId]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── 再生コントロール ─────────────────────────────────────────────────────
  const togglePlay = useCallback(() => {
    const v = videoRef.current
    if (!v) return
    if (v.paused) { v.play(); setIsPlaying(true) }
    else          { v.pause(); setIsPlaying(false) }
  }, [])

  const resetAll = useCallback(() => {
    cancelAnimationFrame(rafRef.current)
    const v = videoRef.current
    if (v) { v.pause(); v.currentTime = 0 }
    setIsPlaying(false)
    setStatus('ready')
    setProgress(0)
    setTracks([])
    setMetrics(new Map())
    frameStoreRef.current = []
    resetTracks()
    resetMetrics()
    const canvas = canvasRef.current
    if (canvas) canvas.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height)
  }, [])

  // ── 選択中人物の指標 ─────────────────────────────────────────────────────
  const activePersonIds = Array.from(metrics.keys()).sort()
  const activePerson    = selectedId !== null ? metrics.get(selectedId) : null

  // ── レンダリング ─────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">

      {/* ── アップロードゾーン ─────────────────────────────────────────── */}
      {!videoUrl && (
        <div
          className="border-2 border-dashed border-gray-200 rounded-2xl p-12 text-center
            hover:border-[#0d9488] hover:bg-teal-50/30 transition-colors cursor-pointer"
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          onClick={() => document.getElementById('sports-video-input')?.click()}
        >
          <Upload className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-600 font-medium">動画をドラッグ＆ドロップ</p>
          <p className="text-sm text-gray-400 mt-1">または クリックして選択（MP4・MOV・WebM）</p>
          <input
            id="sports-video-input"
            type="file"
            accept="video/*"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
          />
        </div>
      )}

      {videoUrl && (
        <div className="flex flex-col lg:flex-row gap-4">

          {/* ── 左: 動画 + キャンバス ──────────────────────────────────── */}
          <div className="flex-1 min-w-0 space-y-3">

            {/* 動画 + キャンバスオーバーレイ */}
            <div className="relative bg-black rounded-xl overflow-hidden aspect-video">
              <video
                ref={videoRef}
                src={videoUrl}
                className="w-full h-full object-contain"
                playsInline
                muted
              />
              <canvas
                ref={canvasRef}
                className="absolute inset-0 w-full h-full object-contain pointer-events-auto cursor-crosshair"
                onClick={handleCanvasClick}
              />

              {/* 解析中プログレスバー */}
              {status === 'analyzing' && (
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/30">
                  <div
                    className="h-full bg-[#0d9488] transition-all"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              )}

              {/* モデル読み込み中 */}
              {status === 'loadingModel' && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 text-white">
                  <Loader2 className="w-8 h-8 animate-spin mb-2" />
                  <p className="text-sm font-medium">高精度モデルを読み込み中...</p>
                  <p className="text-xs text-white/60 mt-1">初回は25MB のダウンロードが発生します</p>
                </div>
              )}
            </div>

            {/* エラー */}
            {modelError && (
              <p className="text-sm text-red-600 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />{modelError}
              </p>
            )}

            {/* コントロールバー */}
            <div className="flex items-center gap-3 flex-wrap">
              {status === 'ready' && (
                <button
                  onClick={startAnalysis}
                  className="flex items-center gap-2 px-5 py-2.5 bg-[#0d9488] hover:bg-[#0b8276]
                    text-white font-semibold rounded-xl text-sm transition-colors"
                >
                  <Activity className="w-4 h-4" />
                  解析開始
                </button>
              )}

              {status === 'analyzing' && (
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Loader2 className="w-4 h-4 animate-spin text-[#0d9488]" />
                  解析中 {progress}%
                </div>
              )}

              {status === 'done' && (
                <button
                  onClick={togglePlay}
                  className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700
                    text-white rounded-xl text-sm transition-colors"
                >
                  {isPlaying
                    ? <><Pause className="w-4 h-4" />一時停止</>
                    : <><Play  className="w-4 h-4" />再生</>
                  }
                </button>
              )}

              {(status === 'analyzing' || status === 'done') && (
                <button
                  onClick={resetAll}
                  className="flex items-center gap-2 px-4 py-2 border border-gray-200
                    hover:bg-gray-50 rounded-xl text-sm text-gray-600 transition-colors"
                >
                  <RotateCcw className="w-4 h-4" />
                  リセット
                </button>
              )}

              {/* 別の動画を選択 */}
              {status !== 'analyzing' && status !== 'loadingModel' && (
                <button
                  onClick={() => document.getElementById('sports-video-input2')?.click()}
                  className="text-sm text-[#0d9488] hover:underline"
                >
                  別の動画を選択
                  <input
                    id="sports-video-input2"
                    type="file"
                    accept="video/*"
                    className="hidden"
                    onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
                  />
                </button>
              )}

              {/* 検出人数バッジ */}
              {tracks.filter((t) => t.lostFrames === 0).length > 0 && (
                <span className="flex items-center gap-1.5 px-3 py-1 bg-gray-100 rounded-full text-xs text-gray-600 ml-auto">
                  <Users className="w-3.5 h-3.5" />
                  {tracks.filter((t) => t.lostFrames === 0).length} 人検出中
                </span>
              )}
            </div>

            {/* 操作ヒント */}
            {status === 'done' && (
              <p className="text-xs text-gray-400">
                ヒント: 骨格をクリックすると右パネルにその人物の指標が表示されます
              </p>
            )}
          </div>

          {/* ── 右: 指標パネル ─────────────────────────────────────────── */}
          <div className="w-full lg:w-72 xl:w-80 flex-shrink-0">

            {/* 解析待ち */}
            {status === 'ready' && (
              <div className="bg-gray-50 rounded-2xl p-6 text-center text-gray-400 h-full flex flex-col items-center justify-center gap-2">
                <Zap className="w-8 h-8" />
                <p className="text-sm font-medium">「解析開始」を押すと<br />パフォーマンス指標が表示されます</p>
              </div>
            )}

            {/* 解析中・完了 */}
            {(status === 'analyzing' || status === 'done') && (
              <div className="space-y-3">

                {/* 人物選択タブ */}
                {activePersonIds.length > 0 && (
                  <div className="flex gap-2 flex-wrap">
                    {activePersonIds.map((id) => {
                      const m = metrics.get(id)!
                      return (
                        <button
                          key={id}
                          onClick={() => setSelectedId(selectedId === id ? null : id)}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold
                            border-2 transition-all ${selectedId === id
                              ? 'text-white shadow-sm'
                              : 'bg-white text-gray-600 border-gray-200 hover:border-current'}`}
                          style={selectedId === id
                            ? { backgroundColor: m.color, borderColor: m.color }
                            : { borderColor: m.color, color: m.color }}
                        >
                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: m.color }} />
                          P{id + 1}
                        </button>
                      )
                    })}
                    {selectedId !== null && (
                      <button
                        onClick={() => setSelectedId(null)}
                        className="text-xs text-gray-400 hover:text-gray-600 px-2"
                      >
                        解除
                      </button>
                    )}
                  </div>
                )}

                {/* 人物選択前の全体サマリ */}
                {selectedId === null && activePersonIds.length > 0 && (
                  <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-2">
                    <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide mb-3">
                      全体サマリ
                    </p>
                    {activePersonIds.map((id) => {
                      const m = metrics.get(id)!
                      return (
                        <button
                          key={id}
                          onClick={() => setSelectedId(id)}
                          className="w-full flex items-center justify-between p-2 rounded-xl
                            hover:bg-gray-50 transition-colors text-left"
                        >
                          <div className="flex items-center gap-2">
                            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: m.color }} />
                            <span className="text-sm font-medium">P{id + 1}</span>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-gray-500">
                            <span>最大速度 <b className="text-gray-700">{m.peakSpeed}</b></span>
                            <span>左右差 <b className="text-gray-700">{m.avgAsymmetryDeg}°</b></span>
                            <FatigueLabel label={m.fatigueLabel} />
                          </div>
                          <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0" />
                        </button>
                      )
                    })}
                  </div>
                )}

                {/* 選択人物の詳細指標 */}
                {activePerson && (
                  <div className="space-y-3">

                    {/* ── スピード ──────────────────────────────── */}
                    <div className="bg-white rounded-2xl border border-gray-100 p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <Zap className="w-4 h-4 text-[#f59e0b]" />
                        <span className="text-xs font-semibold text-gray-700 uppercase tracking-wide">スピード</span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 mb-3">
                        {[
                          { label: '現在', val: activePerson.currentSpeed },
                          { label: 'ピーク', val: activePerson.peakSpeed },
                          { label: '平均', val: activePerson.avgSpeed },
                        ].map(({ label, val }) => (
                          <div key={label} className="text-center">
                            <div className="text-lg font-bold text-gray-800">{val}</div>
                            <div className="text-xs text-gray-400">{label}</div>
                          </div>
                        ))}
                      </div>
                      <SpeedSparkline
                        data={activePerson.speedHistory.map((s) => s.speed)}
                        color={activePerson.color}
                      />
                    </div>

                    {/* ── ジャンプ ──────────────────────────────── */}
                    <div className="bg-white rounded-2xl border border-gray-100 p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <TrendingUp className="w-4 h-4 text-[#3b82f6]" />
                        <span className="text-xs font-semibold text-gray-700 uppercase tracking-wide">ジャンプ</span>
                        <span className="ml-auto text-xs font-bold text-gray-800">
                          {activePerson.jumpCount} 回
                        </span>
                      </div>
                      {activePerson.jumpCount === 0 ? (
                        <p className="text-xs text-gray-400 text-center py-2">ジャンプ動作は検出されませんでした</p>
                      ) : (
                        <div className="space-y-2">
                          <div className="grid grid-cols-2 gap-2 mb-2">
                            <div className="bg-gray-50 rounded-xl p-2 text-center">
                              <div className="text-lg font-bold text-[#3b82f6]">{activePerson.avgJumpHeightCm}<span className="text-xs font-normal ml-0.5">cm</span></div>
                              <div className="text-xs text-gray-400">平均</div>
                            </div>
                            <div className="bg-gray-50 rounded-xl p-2 text-center">
                              <div className="text-lg font-bold text-[#3b82f6]">{activePerson.maxJumpHeightCm}<span className="text-xs font-normal ml-0.5">cm</span></div>
                              <div className="text-xs text-gray-400">最大</div>
                            </div>
                          </div>
                          <div className="space-y-1.5 max-h-28 overflow-y-auto">
                            {activePerson.jumpEvents.slice(0, 5).map((ev, i) => (
                              <JumpCard key={i} event={ev} idx={i} />
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* ── 左右差（フォーム） ────────────────────── */}
                    <div className="bg-white rounded-2xl border border-gray-100 p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <Activity className="w-4 h-4 text-[#22c55e]" />
                        <span className="text-xs font-semibold text-gray-700 uppercase tracking-wide">左右差</span>
                        <span className="ml-auto text-xs text-gray-500">
                          平均 <b className="text-gray-700">{activePerson.avgAsymmetryDeg}°</b>
                        </span>
                      </div>
                      <div className="space-y-2.5">
                        {Object.entries(activePerson.perJointAsymmetry).map(([label, deg]) => (
                          <GaugeBar
                            key={label}
                            label={label}
                            value={deg}
                            max={20}
                            color={deg > 10 ? '#ef4444' : deg > 5 ? '#f59e0b' : '#22c55e'}
                          />
                        ))}
                        {Object.keys(activePerson.perJointAsymmetry).length === 0 && (
                          <p className="text-xs text-gray-400 text-center py-2">データ収集中...</p>
                        )}
                      </div>
                    </div>

                    {/* ── 疲労指数 ──────────────────────────────── */}
                    <div className="bg-white rounded-2xl border border-gray-100 p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <AlertTriangle className="w-4 h-4 text-[#a855f7]" />
                        <span className="text-xs font-semibold text-gray-700 uppercase tracking-wide">疲労兆候</span>
                        <div className="ml-auto"><FatigueLabel label={activePerson.fatigueLabel} /></div>
                      </div>
                      <div className="relative h-3 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${activePerson.fatigueScore}%`,
                            background: activePerson.fatigueScore < 30
                              ? '#22c55e'
                              : activePerson.fatigueScore < 60
                              ? '#f59e0b'
                              : '#ef4444',
                          }}
                        />
                      </div>
                      <div className="flex justify-between text-xs text-gray-400 mt-1">
                        <span>良好</span>
                        <span>{activePerson.fatigueScore} / 100</span>
                        <span>高疲労</span>
                      </div>
                      <p className="text-xs text-gray-400 mt-2">
                        ※ 動画前半→後半の非対称性増大から推定
                      </p>
                    </div>

                  </div>
                )}

                {/* データなし */}
                {activePersonIds.length === 0 && status === 'analyzing' && (
                  <div className="bg-gray-50 rounded-2xl p-6 text-center text-gray-400 text-sm">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                    人物を検出中...
                  </div>
                )}

              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
