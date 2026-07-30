'use client'

/**
 * Kinovea 風 計測ツールオーバーレイ
 *
 * 動画の上に重ねる計測レイヤー:
 *  - 選択: 既存の計測（線の端点・ストップウォッチ・追跡点）をドラッグで修正
 *  - キャリブレーション: 既知の長さの線を引き実寸 (cm) を入力 → px→cm 変換
 *  - 距離計測: ドラッグで線を引き px / cm 表示
 *  - ストップウォッチ: 1回目クリック=開始時刻、2回目=停止時刻。動画時間に連動
 *  - ポイント追跡: クリックした点を ZNCC テンプレートマッチングで自動追従し軌跡＋速度を表示
 *  - グリッド: 10分割グリッド＋中心線
 *  - 拡大鏡: 端点ドラッグ中は 3.5 倍ルーペ＋十字線で正確な点指定を支援
 *  - Esc でツール解除
 */

import { useRef, useState, useEffect, useCallback } from 'react'
import {
  MousePointer2, Ruler, MoveHorizontal, Timer, LocateFixed, Grid3x3, Undo2, Trash2, X,
} from 'lucide-react'
import {
  getContentRect, elementToContent, contentToElement,
  pixelDistance, distanceCm, trajectorySpeedCmPerSec, formatElapsed,
  PointTracker,
} from '@/lib/kinovea-tools'
import type {
  NormPoint, Calibration, DistanceMeasure, StopwatchState, TrajPoint, ContentRect,
} from '@/lib/kinovea-tools'

type Tool = 'none' | 'select' | 'calibrate' | 'distance' | 'stopwatch' | 'track'

/** 選択ツールでドラッグ中の編集対象 */
type EditTarget =
  | { kind: 'calib-a' } | { kind: 'calib-b' }
  | { kind: 'dist-a'; id: string } | { kind: 'dist-b'; id: string }
  | { kind: 'stopwatch' }
  | { kind: 'track' }

const HIT_RADIUS = 14  // 端点ヒット判定半径 (表示px)

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

  // ドラッグ中の新規線（距離・キャリブレーション共用）
  const dragRef = useRef<{ a: NormPoint; b: NormPoint } | null>(null)
  // 選択ツールでの編集ドラッグ対象
  const editRef = useRef<EditTarget | null>(null)
  // ルーペ・十字線用の現在カーソル位置（コンテンツ正規化座標）
  const cursorRef = useRef<NormPoint | null>(null)

  // ── 座標変換ヘルパー ──────────────────────────────────────────────────────

  const getRect = useCallback((): ContentRect | null => {
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

  // ── 選択ツール: ヒットテスト ──────────────────────────────────────────────

  const hitTest = useCallback((e: React.PointerEvent): EditTarget | null => {
    const el = containerRef.current
    const rect = getRect()
    if (!el || !rect) return null
    const box = el.getBoundingClientRect()
    const ex = e.clientX - box.left
    const ey = e.clientY - box.top
    const near = (p: NormPoint) => {
      const q = contentToElement(p, rect)
      return Math.hypot(q.x - ex, q.y - ey) <= HIT_RADIUS
    }
    // 手前に描画されるものから優先的に判定
    if (trackPoint) {
      const last = trajRef.current.length > 0 ? trajRef.current[trajRef.current.length - 1].p : trackPoint
      if (near(last)) return { kind: 'track' }
    }
    if (stopwatch && near(stopwatch.pos)) return { kind: 'stopwatch' }
    for (let i = distances.length - 1; i >= 0; i--) {
      if (near(distances[i].a)) return { kind: 'dist-a', id: distances[i].id }
      if (near(distances[i].b)) return { kind: 'dist-b', id: distances[i].id }
    }
    if (calibration) {
      if (near(calibration.a)) return { kind: 'calib-a' }
      if (near(calibration.b)) return { kind: 'calib-b' }
    }
    return null
  }, [getRect, trackPoint, stopwatch, distances, calibration])

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

    // 端点編集ハンドル（選択ツール時のみ）
    const drawHandle = (p: NormPoint, color: string) => {
      const q = contentToElement(p, rect)
      ctx.save()
      ctx.fillStyle = 'rgba(255,255,255,0.9)'
      ctx.strokeStyle = color
      ctx.lineWidth = 2
      ctx.fillRect(q.x - 5, q.y - 5, 10, 10)
      ctx.strokeRect(q.x - 5, q.y - 5, 10, 10)
      ctx.restore()
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

    // ── ドラッグ中プレビュー（新規線） ──
    if (dragRef.current) {
      const { a, b } = dragRef.current
      const color = tool === 'calibrate' ? '#22c55e' : '#f59e0b'
      const cm = distanceCm(a, b, calibration, vw, vh)
      const px = Math.round(pixelDistance(a, b, vw, vh))
      const label = tool === 'calibrate'
        ? `${px} px`
        : cm !== null ? `${cm.toFixed(1)} cm` : `${px} px`
      drawLine(a, b, color, label)
    }

    // ── 選択ツールのハンドル ──
    if (tool === 'select') {
      if (calibration) { drawHandle(calibration.a, '#22c55e'); drawHandle(calibration.b, '#22c55e') }
      for (const d of distances) { drawHandle(d.a, '#f59e0b'); drawHandle(d.b, '#f59e0b') }
      if (stopwatch) drawHandle(stopwatch.pos, '#ffffff')
      if (trackPoint) {
        const last = trajRef.current.length > 0 ? trajRef.current[trajRef.current.length - 1].p : trackPoint
        drawHandle(last, '#22d3ee')
      }
    }

    // ── 軌跡（低信頼区間はオレンジで区別） ──
    const traj = trajRef.current
    if (traj.length > 0) {
      const visible = traj.filter((pt) => pt.t <= t + 0.05)
      if (visible.length > 1) {
        ctx.lineWidth = 2
        ctx.shadowColor = 'rgba(0,0,0,0.5)'
        ctx.shadowBlur = 2
        for (let i = 1; i < visible.length; i++) {
          const a = contentToElement(visible[i - 1].p, rect)
          const b = contentToElement(visible[i].p, rect)
          const lowConf = (visible[i].conf ?? 1) < 0.4
          ctx.strokeStyle = lowConf ? '#fb923c' : '#22d3ee'
          ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke()
        }
        ctx.shadowBlur = 0
      }
      if (visible.length > 0) {
        const last = visible[visible.length - 1]
        const p = contentToElement(last.p, rect)
        ctx.fillStyle = (last.conf ?? 1) < 0.4 ? '#fb923c' : '#22d3ee'
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

    // ── 拡大鏡ルーペ（端点ドラッグ中） ──
    const cur = cursorRef.current
    if (cur && (dragRef.current || editRef.current) && v.videoWidth > 0) {
      const ZOOM = 3.5
      const SRC = 36                    // 取り込み元サイズ (動画px)
      const R = (SRC * ZOOM) / 2        // ルーペ半径 (表示px)
      const cp = contentToElement(cur, rect)
      // カーソルの右上に表示、はみ出すなら反転
      let lx = cp.x + R + 24
      let ly = cp.y - R - 24
      if (lx + R > canvas.width)  lx = cp.x - R - 24
      if (ly - R < 0)             ly = cp.y + R + 24
      const sx = Math.min(Math.max(cur.x * vw - SRC / 2, 0), vw - SRC)
      const sy = Math.min(Math.max(cur.y * vh - SRC / 2, 0), vh - SRC)

      ctx.save()
      ctx.beginPath()
      ctx.arc(lx, ly, R, 0, Math.PI * 2)
      ctx.clip()
      ctx.imageSmoothingEnabled = false  // ピクセル単位の確認をしやすく
      ctx.drawImage(v, sx, sy, SRC, SRC, lx - R, ly - R, R * 2, R * 2)
      // ルーペ内十字線（カーソル位置 = ルーペ中心とは限らないので実位置に描く）
      const cxIn = lx - R + (cur.x * vw - sx) * ZOOM
      const cyIn = ly - R + (cur.y * vh - sy) * ZOOM
      ctx.strokeStyle = 'rgba(34,211,238,0.9)'
      ctx.lineWidth = 1
      ctx.beginPath(); ctx.moveTo(cxIn - R, cyIn); ctx.lineTo(cxIn + R, cyIn); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(cxIn, cyIn - R); ctx.lineTo(cxIn, cyIn + R); ctx.stroke()
      ctx.restore()
      // 枠
      ctx.strokeStyle = 'rgba(255,255,255,0.9)'
      ctx.lineWidth = 2
      ctx.beginPath(); ctx.arc(lx, ly, R, 0, Math.PI * 2); ctx.stroke()
    }

    ctx.restore()
  }, [videoRef, getRect, grid, calibration, pendingCalib, distances, stopwatch, tool, trackPoint])

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
            const next = trackerRef.current.track(v, prev, t)
            traj.push({ t, p: next, conf: trackerRef.current.lastConfidence })
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
      dragRef.current = null   // 非アクティブ化時にドラッグ状態を解除
      editRef.current = null
      cursorRef.current = null
    }
  }, [active, draw, trackPoint, videoRef])

  // 非アクティブ化で入力中ダイアログを解除（render時調整パターン）
  const [prevActive, setPrevActive] = useState(active)
  if (active !== prevActive) {
    setPrevActive(active)
    if (!active && pendingCalib) setPendingCalib(null)
  }

  // ── Esc キーでツール解除 ──────────────────────────────────────────────────

  useEffect(() => {
    if (!active) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        dragRef.current = null
        editRef.current = null
        setPendingCalib(null)
        setTool('none')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [active])

  // ── 追跡の再初期化（追跡点の設置・移動で共用） ────────────────────────────

  const restartTracking = useCallback((p: NormPoint) => {
    const v = videoRef.current
    if (!v || v.videoWidth === 0) return
    if (!trackerRef.current) trackerRef.current = new PointTracker()
    trackerRef.current.reset()
    if (trackerRef.current.init(v, p)) {
      trajRef.current = [{ t: v.currentTime, p, conf: 1 }]
      lastTrackT.current = v.currentTime
      setTrackPoint(p)
    }
  }, [videoRef])

  // ── ポインタ操作 ─────────────────────────────────────────────────────────

  function handlePointerDown(e: React.PointerEvent) {
    if (tool === 'none') return
    const p = eventToContent(e)
    if (!p) return
    e.preventDefault()
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    cursorRef.current = p

    if (tool === 'select') {
      editRef.current = hitTest(e)
      return
    }

    if (tool === 'calibrate' || tool === 'distance') {
      dragRef.current = { a: p, b: p }
      return
    }

    if (tool === 'stopwatch') {
      const v = videoRef.current
      if (!v) return
      if (!stopwatch || stopwatch.endT !== null) {
        setStopwatch({ startT: v.currentTime, endT: null, pos: p })   // 新規開始
      } else {
        setStopwatch({ ...stopwatch, endT: Math.max(v.currentTime, stopwatch.startT) })  // 停止
      }
      return
    }

    if (tool === 'track') {
      restartTracking(p)
      return
    }
  }

  function handlePointerMove(e: React.PointerEvent) {
    const p = eventToContent(e)
    if (!p) return
    cursorRef.current = p

    if (dragRef.current) {
      dragRef.current = { ...dragRef.current, b: p }
      return
    }

    const edit = editRef.current
    if (edit) {
      switch (edit.kind) {
        case 'calib-a':
          setCalibration((c) => c ? { ...c, a: p } : c); break
        case 'calib-b':
          setCalibration((c) => c ? { ...c, b: p } : c); break
        case 'dist-a':
          setDistances((ds) => ds.map((d) => d.id === edit.id ? { ...d, a: p } : d)); break
        case 'dist-b':
          setDistances((ds) => ds.map((d) => d.id === edit.id ? { ...d, b: p } : d)); break
        case 'stopwatch':
          setStopwatch((s) => s ? { ...s, pos: p } : s); break
        case 'track':
          break  // 追跡点は pointerup で再初期化（ドラッグ中の再学習を避ける）
      }
    }
  }

  function handlePointerUp(e: React.PointerEvent) {
    const p = eventToContent(e)

    const edit = editRef.current
    if (edit) {
      editRef.current = null
      // 離した位置を最終位置として確定する
      // （move イベントが release 座標まで届かない環境があるため）
      if (p) {
        switch (edit.kind) {
          case 'calib-a':  setCalibration((c) => c ? { ...c, a: p } : c); break
          case 'calib-b':  setCalibration((c) => c ? { ...c, b: p } : c); break
          case 'dist-a':   setDistances((ds) => ds.map((d) => d.id === edit.id ? { ...d, a: p } : d)); break
          case 'dist-b':   setDistances((ds) => ds.map((d) => d.id === edit.id ? { ...d, b: p } : d)); break
          case 'stopwatch': setStopwatch((s) => s ? { ...s, pos: p } : s); break
          case 'track':    restartTracking(p); break
        }
      }
      cursorRef.current = null
      return
    }

    const drag = dragRef.current
    if (!drag) { cursorRef.current = null; return }
    dragRef.current = null
    cursorRef.current = null
    const end = p ?? drag.b  // 離した位置を終点として採用
    const vw = videoRef.current?.videoWidth ?? 0
    const vh = videoRef.current?.videoHeight ?? 0
    if (pixelDistance(drag.a, end, vw, vh) < 5) return  // 短すぎる線は無視

    if (tool === 'calibrate') {
      setPendingCalib({ a: drag.a, b: end })
      setCalibInput('')
    } else if (tool === 'distance') {
      setDistances((prev) => [...prev, { id: `dist-${Date.now()}`, a: drag.a, b: end }])
    }
  }

  function confirmCalibration() {
    const len = parseFloat(calibInput)
    if (!pendingCalib || !Number.isFinite(len) || len <= 0) return
    setCalibration({ a: pendingCalib.a, b: pendingCalib.b, lengthCm: len })
    setPendingCalib(null)
    setTool('distance')  // 校正後はそのまま距離計測へ
  }

  /** 直前の操作を取り消す（距離→追跡→ストップウォッチの順に消す） */
  function undoLast() {
    if (distances.length > 0) { setDistances((prev) => prev.slice(0, -1)); return }
    if (trackPoint) { setTrackPoint(null); trajRef.current = []; trackerRef.current?.reset(); return }
    if (stopwatch) { setStopwatch(null); return }
    if (calibration) setCalibration(null)
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
    editRef.current = null
  }

  if (!active) return null

  const TOOLS: Array<{ key: Tool; icon: React.ElementType; label: string; title: string }> = [
    { key: 'select',    icon: MousePointer2,  label: '選択', title: '既存の計測点をドラッグで修正' },
    { key: 'calibrate', icon: Ruler,          label: '校正', title: '既知の長さで実寸校正' },
    { key: 'distance',  icon: MoveHorizontal, label: '距離', title: '距離を計測' },
    { key: 'stopwatch', icon: Timer,          label: '計時', title: '区間タイムを計測' },
    { key: 'track',     icon: LocateFixed,    label: '追跡', title: '点を自動追跡し軌跡・速度を表示' },
  ]

  return (
    <div ref={containerRef} className="absolute inset-0 z-30">
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full touch-none"
        style={{
          cursor: tool === 'none' ? 'default' : tool === 'select' ? 'grab' : 'crosshair',
          pointerEvents: 'auto',
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      />

      {/* ── ツールバー（左上） ── */}
      <div className="absolute top-2 left-2 flex flex-col gap-1 z-40">
        {TOOLS.map(({ key, icon: Icon, label, title }) => (
          <button
            key={key}
            onClick={() => setTool(tool === key ? 'none' : key)}
            title={`${title}（Escで解除）`}
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
          onClick={undoLast}
          title="直前の計測を取り消す"
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold shadow-lg backdrop-blur-sm bg-black/75 text-gray-200 hover:bg-gray-600 hover:text-white border border-white/20 transition-all"
        >
          <Undo2 className="w-3.5 h-3.5" />
          戻す
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
            {tool === 'select'    && '計測点・追跡点・タイマーをドラッグで移動'}
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
