'use client'

/**
 * Kinovea 風 計測ツールオーバーレイ
 *
 * 動画の上に重ねる計測レイヤー:
 *  - キャリブレーション: 既知の長さの線を引き実寸 (cm) を入力 → px→cm 変換
 *  - 距離計測: ドラッグで線を引き px / cm 表示
 *  - ストップウォッチ: 1回目クリック=開始時刻、2回目=停止時刻。動画時間に連動
 *  - ポイント追跡: クリックした点をテンプレートマッチングで自動追従し軌跡＋速度を表示
 *  - グリッド: 10分割グリッド＋中心線
 */

import { useRef, useState, useEffect, useCallback } from 'react'
import {
  Ruler, MoveHorizontal, Timer, LocateFixed, Grid3x3, Trash2, X,
} from 'lucide-react'
import {
  getContentRect, elementToContent, contentToElement,
  pixelDistance, distanceCm, trajectorySpeedCmPerSec, formatElapsed,
  PointTracker,
} from '@/lib/kinovea-tools'
import type {
  NormPoint, Calibration, DistanceMeasure, StopwatchState, TrajPoint,
} from '@/lib/kinovea-tools'

type Tool = 'none' | 'calibrate' | 'distance' | 'stopwatch' | 'track'

interface Props {
  videoRef: React.RefObject<HTMLVideoElement | null>
  active:   boolean
}

export default function KinoveaToolsOverlay({ videoRef, active }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef    = useRef<HTMLCanvasElement>(null)
  const rafRef       = useRef<number>(0)
  const trackerRef   = useRef<PointTracker | null>(null)
  const lastTrackT   = useRef<number>(-1)
  const trajRef      = useRef<TrajPoint[]>([])

  const [tool, setTool] = useState<Tool>('none')
  const [grid, setGrid] = useState(false)

  const [calibration, setCalibration] = useState<Calibration | null>(null)
  const [distances,   setDistances]   = useState<DistanceMeasure[]>([])
  const [stopwatch,   setStopwatch]   = useState<StopwatchState | null>(null)
  const [trackPoint,  setTrackPoint]  = useState<NormPoint | null>(null)

  // キャリブレーション作成途中の状態
  const [pendingCalib, setPendingCalib] = useState<{ a: NormPoint; b: NormPoint } | null>(null)
  const [calibInput,   setCalibInput]   = useState('')

  // ドラッグ中の線（距離・キャリブレーション共用）
  const dragRef = useRef<{ a: NormPoint; b: NormPoint } | null>(null)

  // ── 座標変換ヘルパー ──────────────────────────────────────────────────────

  const getRect = useCallback(() => {
    const el = containerRef.current
    const v  = videoRef.current
    if (!el || !v) return null
    return getContentRect(el.clientWidth, el.clientHeight, v.videoWidth, v.videoHeight)
  }, [videoRef])

  const eventToContent = useCallback((e: React.PointerEvent): NormPoint | null => {
    const el = containerRef.current
    if (!el) return null
    const rect = getRect()
    if (!rect) return null
    const box = el.getBoundingClientRect()
    return elementToContent(e.clientX - box.left, e.clientY - box.top, rect)
  }, [getRect])

  // ── 描画 ─────────────────────────────────────────────────────────────────

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    const el = containerRef.current
    const v  = videoRef.current
    if (!canvas || !el || !v) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    if (canvas.width !== el.clientWidth || canvas.height !== el.clientHeight) {
      canvas.width = el.clientWidth
      canvas.height = el.clientHeight
    }
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    const rect = getRect()
    if (!rect) return
    const vw = v.videoWidth, vh = v.videoHeight
    const t  = v.currentTime

    ctx.save()
    ctx.lineCap = 'round'

    // ── グリッド ──
    if (grid) {
      ctx.strokeStyle = 'rgba(255,255,255,0.35)'
      ctx.lineWidth = 1
      const N = 10
      for (let i = 1; i < N; i++) {
        const x = rect.left + (rect.width * i) / N
        const y = rect.top + (rect.height * i) / N
        ctx.beginPath(); ctx.moveTo(x, rect.top); ctx.lineTo(x, rect.top + rect.height); ctx.stroke()
        ctx.beginPath(); ctx.moveTo(rect.left, y); ctx.lineTo(rect.left + rect.width, y); ctx.stroke()
      }
      // 中心線を強調
      ctx.strokeStyle = 'rgba(163,230,53,0.7)'
      ctx.lineWidth = 1.5
      const cx = rect.left + rect.width / 2
      const cy = rect.top + rect.height / 2
      ctx.beginPath(); ctx.moveTo(cx, rect.top); ctx.lineTo(cx, rect.top + rect.height); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(rect.left, cy); ctx.lineTo(rect.left + rect.width, cy); ctx.stroke()
    }

    // 線＋ラベル描画ヘルパー
    const drawLine = (a: NormPoint, b: NormPoint, color: string, label?: string) => {
      const pa = contentToElement(a, rect)
      const pb = contentToElement(b, rect)
      ctx.strokeStyle = color
      ctx.lineWidth = 2.5
      ctx.shadowColor = 'rgba(0,0,0,0.6)'
      ctx.shadowBlur = 3
      ctx.beginPath(); ctx.moveTo(pa.x, pa.y); ctx.lineTo(pb.x, pb.y); ctx.stroke()
      // 端点
      for (const p of [pa, pb]) {
        ctx.fillStyle = color
        ctx.beginPath(); ctx.arc(p.x, p.y, 4, 0, Math.PI * 2); ctx.fill()
      }
      if (label) {
        const mx = (pa.x + pb.x) / 2, my = (pa.y + pb.y) / 2
        ctx.font = 'bold 13px sans-serif'
        ctx.shadowBlur = 0
        const tw = ctx.measureText(label).width
        ctx.fillStyle = 'rgba(0,0,0,0.7)'
        ctx.fillRect(mx + 6, my - 20, tw + 10, 19)
        ctx.fillStyle = color
        ctx.fillText(label, mx + 11, my - 6)
      }
      ctx.shadowBlur = 0
    }

    // ── キャリブレーション線 ──
    if (calibration) {
      drawLine(calibration.a, calibration.b, '#22c55e', `校正 ${calibration.lengthCm} cm`)
    }
    if (pendingCalib) {
      drawLine(pendingCalib.a, pendingCalib.b, '#22c55e')
    }

    // ── 距離計測線 ──
    for (const d of distances) {
      const cm = distanceCm(d.a, d.b, calibration, vw, vh)
      const label = cm !== null
        ? `${cm >= 100 ? (cm / 100).toFixed(2) + ' m' : cm.toFixed(1) + ' cm'}`
        : `${Math.round(pixelDistance(d.a, d.b, vw, vh))} px`
      drawLine(d.a, d.b, '#f59e0b', label)
    }

    // ── ドラッグ中プレビュー ──
    if (dragRef.current) {
      const { a, b } = dragRef.current
      const color = tool === 'calibrate' ? '#22c55e' : '#f59e0b'
      const cm = distanceCm(a, b, calibration, vw, vh)
      const label = tool === 'calibrate'
        ? undefined
        : cm !== null ? `${cm.toFixed(1)} cm` : `${Math.round(pixelDistance(a, b, vw, vh))} px`
      drawLine(a, b, color, label)
    }

    // ── 軌跡 ──
    const traj = trajRef.current
    if (traj.length > 0) {
      const visible = traj.filter((pt) => pt.t <= t + 0.05)
      if (visible.length > 1) {
        ctx.strokeStyle = '#22d3ee'
        ctx.lineWidth = 2
        ctx.shadowColor = 'rgba(0,0,0,0.5)'
        ctx.shadowBlur = 2
        ctx.beginPath()
        const p0 = contentToElement(visible[0].p, rect)
        ctx.moveTo(p0.x, p0.y)
        for (let i = 1; i < visible.length; i++) {
          const p = contentToElement(visible[i].p, rect)
          ctx.lineTo(p.x, p.y)
        }
        ctx.stroke()
        ctx.shadowBlur = 0
      }
      if (visible.length > 0) {
        const last = visible[visible.length - 1]
        const p = contentToElement(last.p, rect)
        ctx.fillStyle = '#22d3ee'
        ctx.strokeStyle = '#fff'
        ctx.lineWidth = 1.5
        ctx.beginPath(); ctx.arc(p.x, p.y, 6, 0, Math.PI * 2); ctx.fill(); ctx.stroke()

        // 速度表示（校正済みのとき）
        const speed = trajectorySpeedCmPerSec(visible, calibration, vw, vh)
        if (speed !== null) {
          const label = speed >= 100
            ? `${(speed / 100).toFixed(2)} m/s`
            : `${speed.toFixed(0)} cm/s`
          ctx.font = 'bold 13px sans-serif'
          const tw = ctx.measureText(label).width
          ctx.fillStyle = 'rgba(0,0,0,0.7)'
          ctx.fillRect(p.x + 10, p.y - 24, tw + 10, 19)
          ctx.fillStyle = '#22d3ee'
          ctx.fillText(label, p.x + 15, p.y - 10)
        }
      }
    }

    // ── ストップウォッチ ──
    if (stopwatch) {
      const elapsed = stopwatch.endT !== null
        ? Math.min(Math.max(t - stopwatch.startT, 0), stopwatch.endT - stopwatch.startT)
        : Math.max(t - stopwatch.startT, 0)
      const running = stopwatch.endT === null
      const label = `⏱ ${formatElapsed(elapsed)}`
      const p = contentToElement(stopwatch.pos, rect)
      ctx.font = 'bold 15px ui-monospace, monospace'
      const tw = ctx.measureText(label).width
      ctx.fillStyle = running ? 'rgba(220,38,38,0.85)' : 'rgba(0,0,0,0.75)'
      const bw = tw + 18, bh = 26
      const bx = Math.min(Math.max(p.x - bw / 2, rect.left), rect.left + rect.width - bw)
      const by = Math.min(Math.max(p.y - bh / 2, rect.top),  rect.top + rect.height - bh)
      ctx.beginPath()
      ctx.roundRect(bx, by, bw, bh, 6)
      ctx.fill()
      ctx.fillStyle = '#fff'
      ctx.fillText(label, bx + 9, by + 18)
    }

    ctx.restore()
  }, [videoRef, getRect, grid, calibration, pendingCalib, distances, stopwatch, tool])

  // ── rAF ループ: 追跡＋再描画 ──────────────────────────────────────────────

  useEffect(() => {
    if (!active) return
    let stopped = false

    const loop = () => {
      if (stopped) return
      const v = videoRef.current

      // ポイント追跡: 動画時間が進んだフレームごとに実行
      if (v && trackerRef.current && trackPoint && v.videoWidth > 0) {
        const t = v.currentTime
        if (Math.abs(t - lastTrackT.current) > 1 / 120) {
          if (t > lastTrackT.current) {
            const traj = trajRef.current
            const prev = traj.length > 0 ? traj[traj.length - 1].p : trackPoint
            const next = trackerRef.current.track(v, prev)
            traj.push({ t, p: next })
            // メモリ上限（約10分@30fps相当）
            if (traj.length > 18000) traj.splice(0, traj.length - 18000)
          }
          lastTrackT.current = t
        }
      }

      draw()
      rafRef.current = requestAnimationFrame(loop)
    }
    rafRef.current = requestAnimationFrame(loop)

    return () => {
      stopped = true
      cancelAnimationFrame(rafRef.current)
      dragRef.current = null  // 非アクティブ化時にドラッグ状態を解除
    }
  }, [active, draw, trackPoint, videoRef])

  // 非アクティブ化で入力中ダイアログを解除（render時調整パターン）
  const [prevActive, setPrevActive] = useState(active)
  if (active !== prevActive) {
    setPrevActive(active)
    if (!active && pendingCalib) setPendingCalib(null)
  }

  // ── ポインタ操作 ─────────────────────────────────────────────────────────

  function handlePointerDown(e: React.PointerEvent) {
    if (tool === 'none') return
    const p = eventToContent(e)
    if (!p) return
    e.preventDefault()
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)

    if (tool === 'calibrate' || tool === 'distance') {
      dragRef.current = { a: p, b: p }
      return
    }

    if (tool === 'stopwatch') {
      const v = videoRef.current
      if (!v) return
      if (!stopwatch || stopwatch.endT !== null) {
        // 新規開始
        setStopwatch({ startT: v.currentTime, endT: null, pos: p })
      } else {
        // 停止
        setStopwatch({ ...stopwatch, endT: Math.max(v.currentTime, stopwatch.startT) })
      }
      return
    }

    if (tool === 'track') {
      const v = videoRef.current
      if (!v || v.videoWidth === 0) return
      if (!trackerRef.current) trackerRef.current = new PointTracker()
      trackerRef.current.reset()
      const ok = trackerRef.current.init(v, p)
      if (ok) {
        trajRef.current = [{ t: v.currentTime, p }]
        lastTrackT.current = v.currentTime
        setTrackPoint(p)
      }
      return
    }
  }

  function handlePointerMove(e: React.PointerEvent) {
    if (!dragRef.current) return
    const p = eventToContent(e)
    if (!p) return
    dragRef.current = { ...dragRef.current, b: p }
  }

  function handlePointerUp() {
    const drag = dragRef.current
    if (!drag) return
    dragRef.current = null
    const vw = videoRef.current?.videoWidth ?? 0
    const vh = videoRef.current?.videoHeight ?? 0
    if (pixelDistance(drag.a, drag.b, vw, vh) < 5) return  // 短すぎる線は無視

    if (tool === 'calibrate') {
      setPendingCalib({ a: drag.a, b: drag.b })
      setCalibInput('')
    } else if (tool === 'distance') {
      setDistances((prev) => [...prev, { id: `dist-${Date.now()}`, a: drag.a, b: drag.b }])
    }
  }

  function confirmCalibration() {
    const len = parseFloat(calibInput)
    if (!pendingCalib || !Number.isFinite(len) || len <= 0) return
    setCalibration({ a: pendingCalib.a, b: pendingCalib.b, lengthCm: len })
    setPendingCalib(null)
    setTool('distance')  // 校正後はそのまま距離計測へ
  }

  function clearAll() {
    setCalibration(null)
    setDistances([])
    setStopwatch(null)
    setTrackPoint(null)
    trajRef.current = []
    trackerRef.current?.reset()
    setPendingCalib(null)
    dragRef.current = null
  }

  if (!active) return null

  const TOOLS: Array<{ key: Tool; icon: React.ElementType; label: string }> = [
    { key: 'calibrate', icon: Ruler,          label: '校正' },
    { key: 'distance',  icon: MoveHorizontal, label: '距離' },
    { key: 'stopwatch', icon: Timer,          label: '計時' },
    { key: 'track',     icon: LocateFixed,    label: '追跡' },
  ]

  return (
    <div ref={containerRef} className="absolute inset-0 z-30">
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full touch-none"
        style={{ cursor: tool === 'none' ? 'default' : 'crosshair', pointerEvents: 'auto' }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      />

      {/* ── ツールバー（左上） ── */}
      <div className="absolute top-2 left-2 flex flex-col gap-1 z-40">
        {TOOLS.map(({ key, icon: Icon, label }) => (
          <button
            key={key}
            onClick={() => setTool(tool === key ? 'none' : key)}
            title={label}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold shadow-lg backdrop-blur-sm transition-all ${
              tool === key
                ? 'bg-cyan-500 text-white'
                : 'bg-black/75 text-gray-200 hover:bg-cyan-700 hover:text-white border border-white/20'
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}

        <button
          onClick={() => setGrid((g) => !g)}
          title="グリッド表示"
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold shadow-lg backdrop-blur-sm transition-all ${
            grid
              ? 'bg-lime-500 text-white'
              : 'bg-black/75 text-gray-200 hover:bg-lime-700 hover:text-white border border-white/20'
          }`}
        >
          <Grid3x3 className="w-3.5 h-3.5" />
          格子
        </button>

        <button
          onClick={clearAll}
          title="計測をすべて消去"
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold shadow-lg backdrop-blur-sm bg-black/75 text-red-300 hover:bg-red-700 hover:text-white border border-white/20 transition-all"
        >
          <Trash2 className="w-3.5 h-3.5" />
          消去
        </button>
      </div>

      {/* ── ステータス表示（左下） ── */}
      <div className="absolute bottom-2 left-2 z-40 pointer-events-none space-y-1">
        {calibration && (
          <div className="bg-green-900/80 text-green-100 text-[11px] px-2 py-1 rounded-lg font-medium">
            📏 校正済み（{calibration.lengthCm} cm 基準）
          </div>
        )}
        {tool !== 'none' && (
          <div className="bg-black/70 text-white text-[11px] px-2 py-1 rounded-lg">
            {tool === 'calibrate' && '既知の長さ（例: 身長・マット幅）に沿ってドラッグ → 実寸を入力'}
            {tool === 'distance'  && `ドラッグで距離を計測${calibration ? '（cm 表示）' : '（px 表示・校正で cm 化）'}`}
            {tool === 'stopwatch' && (!stopwatch || stopwatch.endT !== null
              ? 'クリックで計時開始（動画時間に連動）'
              : 'クリックで計時停止')}
            {tool === 'track'     && '追跡したい点（足先・マーカーなど）をクリック → 再生で軌跡表示'}
          </div>
        )}
      </div>

      {/* ── キャリブレーション長さ入力ダイアログ ── */}
      {pendingCalib && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-2xl p-4 w-64 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-gray-800">実際の長さを入力</h4>
              <button onClick={() => setPendingCalib(null)} className="text-gray-400 hover:text-gray-600">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="0.1"
                step="0.1"
                autoFocus
                value={calibInput}
                onChange={(e) => setCalibInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') confirmCalibration() }}
                placeholder="例: 170"
                className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
              />
              <span className="text-sm text-gray-600 font-medium">cm</span>
            </div>
            <button
              onClick={confirmCalibration}
              disabled={!(parseFloat(calibInput) > 0)}
              className="w-full bg-cyan-600 hover:bg-cyan-700 disabled:bg-gray-300 text-white rounded-lg py-2 text-sm font-bold transition-colors"
            >
              校正する
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
