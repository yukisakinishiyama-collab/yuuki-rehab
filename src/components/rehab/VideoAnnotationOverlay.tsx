'use client'

import { useRef, useState, useEffect, useCallback } from 'react'
import type { AnnotationShape, AnnotationPoint, AnnotationTool, SavedAnnotation } from '@/types/rehab'
import { getCurrentUser, saveAnnotation, generateId, deleteAnnotation } from '@/lib/rehab-store'
import {
  Minus, Circle, ArrowRight, Pencil, Trash2, Undo2,
  Type, Save, X, BookmarkPlus, Eye, EyeOff,
} from 'lucide-react'

// ── Drawing helpers ──────────────────────────────────────────────────────────

function normPt(e: React.MouseEvent, canvas: HTMLCanvasElement): AnnotationPoint {
  const r = canvas.getBoundingClientRect()
  return {
    x: (e.clientX - r.left) / r.width,
    y: (e.clientY - r.top) / r.height,
  }
}

function toCanvas(p: AnnotationPoint, w: number, h: number) {
  return { x: p.x * w, y: p.y * h }
}

const COLORS = ['#ef4444', '#3b82f6', '#f59e0b', '#22c55e', '#ffffff', '#a855f7', '#f97316']

function renderShape(
  ctx: CanvasRenderingContext2D,
  shape: AnnotationShape,
  w: number,
  h: number,
  previewPt?: AnnotationPoint,
) {
  const pts = shape.points.map((p) => toCanvas(p, w, h))
  const all = previewPt ? [...pts, toCanvas(previewPt, w, h)] : pts

  ctx.strokeStyle = shape.color
  ctx.fillStyle = shape.color
  ctx.lineWidth = 2.5
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.shadowColor = 'rgba(0,0,0,0.5)'
  ctx.shadowBlur = 3

  if (shape.tool === 'free') {
    if (all.length < 2) return
    ctx.beginPath()
    ctx.moveTo(all[0].x, all[0].y)
    all.slice(1).forEach((p) => ctx.lineTo(p.x, p.y))
    ctx.stroke()
    return
  }

  if (all.length < 2) return

  if (shape.tool === 'line') {
    const [a, b] = [all[0], all[all.length - 1]]
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke()
    return
  }

  if (shape.tool === 'arrow') {
    const [a, b] = [all[0], all[all.length - 1]]
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke()
    const angle = Math.atan2(b.y - a.y, b.x - a.x)
    const len = 14
    ctx.beginPath()
    ctx.moveTo(b.x, b.y)
    ctx.lineTo(b.x - len * Math.cos(angle - 0.4), b.y - len * Math.sin(angle - 0.4))
    ctx.lineTo(b.x - len * Math.cos(angle + 0.4), b.y - len * Math.sin(angle + 0.4))
    ctx.closePath(); ctx.fill()
    return
  }

  if (shape.tool === 'circle') {
    const [a, b] = [all[0], all[all.length - 1]]
    const rx = Math.abs(b.x - a.x) / 2, ry = Math.abs(b.y - a.y) / 2
    ctx.beginPath()
    ctx.ellipse((a.x + b.x) / 2, (a.y + b.y) / 2, Math.max(rx, 1), Math.max(ry, 1), 0, 0, Math.PI * 2)
    ctx.stroke()
    return
  }

  if (shape.tool === 'angle') {
    if (all.length < 2) return
    ctx.beginPath(); ctx.moveTo(all[0].x, all[0].y)
    all.forEach((p) => ctx.lineTo(p.x, p.y))
    ctx.stroke()

    // Angle label at vertex (2nd point)
    if (all.length >= 3) {
      const [a, b, c] = [all[0], all[1], all[2]]
      const v1 = { x: a.x - b.x, y: a.y - b.y }
      const v2 = { x: c.x - b.x, y: c.y - b.y }
      const dot = v1.x * v2.x + v1.y * v2.y
      const mag = Math.sqrt(v1.x ** 2 + v1.y ** 2) * Math.sqrt(v2.x ** 2 + v2.y ** 2)
      if (mag > 0) {
        const deg = Math.round((Math.acos(Math.min(1, Math.max(-1, dot / mag))) * 180) / Math.PI)
        ctx.shadowBlur = 0
        ctx.font = 'bold 15px sans-serif'
        ctx.fillStyle = '#fff'
        ctx.fillText(`${deg}°`, b.x + 6, b.y - 6)
        ctx.fillStyle = shape.color
        ctx.fillText(`${deg}°`, b.x + 5, b.y - 7)
      }
    }
    return
  }

  if (shape.tool === 'text' && shape.text) {
    const [a] = all
    ctx.shadowBlur = 0
    ctx.font = 'bold 15px sans-serif'
    ctx.fillStyle = 'rgba(0,0,0,0.6)'
    ctx.fillText(shape.text, a.x + 1, a.y + 1)
    ctx.fillStyle = shape.color
    ctx.fillText(shape.text, a.x, a.y)
  }
}

// ── Component ────────────────────────────────────────────────────────────────

interface Props {
  videoId: string
  caseId: string
  currentTime: number
  savedAnnotations: SavedAnnotation[]
  onSaved: () => void
  active: boolean
}

const TOOLS: Array<{ key: AnnotationTool; icon: React.ElementType; label: string }> = [
  { key: 'line', icon: Minus, label: '直線' },
  { key: 'angle', icon: () => <span className="text-xs font-bold leading-none">∠</span>, label: '角度' },
  { key: 'arrow', icon: ArrowRight, label: '矢印' },
  { key: 'circle', icon: Circle, label: '円' },
  { key: 'free', icon: Pencil, label: 'フリー' },
  { key: 'text', icon: Type, label: 'テキスト' },
]

const SNAP_RADIUS = 0.5  // seconds: show saved annotation within ±0.5s

export default function VideoAnnotationOverlay({
  videoId, caseId, currentTime, savedAnnotations, onSaved, active,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [tool, setTool] = useState<AnnotationTool>('arrow')
  const [color, setColor] = useState('#ef4444')
  const [shapes, setShapes] = useState<AnnotationShape[]>([])
  const [current, setCurrent] = useState<AnnotationShape | null>(null)
  const [mousePos, setMousePos] = useState<AnnotationPoint | null>(null)
  const [showSaveForm, setShowSaveForm] = useState(false)
  const [saveLabel, setSaveLabel] = useState('')
  const [textInput, setTextInput] = useState('')
  const [showSaved, setShowSaved] = useState(true)
  const [highlightedId, setHighlightedId] = useState<string | null>(null)

  // Which saved annotation is near current time?
  const nearbyAnnotation = savedAnnotations.find(
    (a) => Math.abs(a.timestamp - currentTime) <= SNAP_RADIUS,
  )

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const { width: w, height: h } = canvas

    ctx.clearRect(0, 0, w, h)

    // Show nearby saved annotation shapes (ghost, 40% opacity)
    if (showSaved && nearbyAnnotation && nearbyAnnotation.id !== highlightedId) {
      ctx.globalAlpha = 0.45
      nearbyAnnotation.shapes.forEach((s) => renderShape(ctx, s, w, h))
      ctx.globalAlpha = 1
    }
    // Show highlighted saved annotation (100%)
    if (showSaved && highlightedId) {
      const ann = savedAnnotations.find((a) => a.id === highlightedId)
      if (ann) ann.shapes.forEach((s) => renderShape(ctx, s, w, h))
    }

    // Current drawing session
    shapes.forEach((s) => renderShape(ctx, s, w, h))
    if (current) renderShape(ctx, current, w, h, mousePos ?? undefined)
  }, [shapes, current, mousePos, nearbyAnnotation, savedAnnotations, showSaved, highlightedId])

  useEffect(() => { draw() }, [draw])

  // Sync canvas size to its rendered size
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ro = new ResizeObserver(() => {
      canvas.width = canvas.offsetWidth
      canvas.height = canvas.offsetHeight
      draw()
    })
    ro.observe(canvas)
    return () => ro.disconnect()
  }, [draw])

  function handleMouseDown(e: React.MouseEvent) {
    if (!active) return
    const canvas = canvasRef.current!
    const pos = normPt(e, canvas)

    if (tool === 'text') {
      // place text immediately
      const label = window.prompt('テキストを入力:', '') ?? ''
      if (!label) return
      setShapes((prev) => [...prev, {
        id: generateId('shape'),
        tool: 'text',
        color,
        points: [pos],
        text: label,
      }])
      return
    }

    if (tool === 'angle') {
      if (current && current.points.length === 1) {
        setCurrent({ ...current, points: [...current.points, pos] })
        return
      }
      if (current && current.points.length === 2) {
        setShapes((prev) => [...prev, { ...current, points: [...current.points, pos] }])
        setCurrent(null)
        return
      }
    }

    setCurrent({ id: generateId('shape'), tool, color, points: [pos] })
  }

  function handleMouseMove(e: React.MouseEvent) {
    if (!active) return
    const canvas = canvasRef.current!
    const pos = normPt(e, canvas)
    setMousePos(pos)
    if (current && tool === 'free') {
      setCurrent({ ...current, points: [...current.points, pos] })
    }
  }

  function handleMouseUp(e: React.MouseEvent) {
    if (!active || !current) return
    if (tool === 'angle') return
    const canvas = canvasRef.current!
    const pos = normPt(e, canvas)
    const finished: AnnotationShape = {
      ...current,
      points: tool === 'free' ? current.points : [...current.points, pos],
    }
    if (finished.points.length >= 2 || tool === 'free') {
      setShapes((prev) => [...prev, finished])
    }
    setCurrent(null)
  }

  function handleSave() {
    if (shapes.length === 0) return
    const user = getCurrentUser()
    if (!user) return
    const ann: SavedAnnotation = {
      id: generateId('ann'),
      videoId,
      caseId,
      timestamp: currentTime,
      label: saveLabel || `マーカー ${new Date().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}`,
      shapes,
      createdBy: user.id,
      createdByName: user.name,
      createdAt: new Date().toISOString(),
    }
    saveAnnotation(ann)
    setShapes([])
    setSaveLabel('')
    setShowSaveForm(false)
    onSaved()
  }

  function handleClear() { setShapes([]); setCurrent(null) }
  function handleUndo() {
    setShapes((prev) => prev.slice(0, -1))
    if (current) setCurrent(null)
  }

  const formatTime = (s: number) =>
    `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`

  return (
    <div className="absolute inset-0 pointer-events-none">
      {/* Canvas */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
        style={{
          cursor: active ? 'crosshair' : 'default',
          pointerEvents: active ? 'all' : 'none',
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={() => {
          setMousePos(null)
          if (current && tool !== 'angle' && tool !== 'free') setCurrent(null)
        }}
      />

      {/* Floating toolbar (only when active) */}
      {active && (
        <div
          className="absolute top-2 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-black/75 backdrop-blur-sm rounded-xl px-2 py-1.5 shadow-xl pointer-events-all"
          style={{ zIndex: 20 }}
        >
          {/* Tools */}
          {TOOLS.map(({ key, icon: Icon, label }) => (
            <button
              key={key}
              title={label}
              onClick={() => setTool(key)}
              className={`w-7 h-7 flex items-center justify-center rounded-lg text-xs transition-colors ${
                tool === key ? 'bg-[#0d9488] text-white' : 'text-gray-300 hover:bg-white/20'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
            </button>
          ))}

          <div className="w-px h-5 bg-white/20 mx-1" />

          {/* Colors */}
          {COLORS.map((c) => (
            <button
              key={c}
              onClick={() => setColor(c)}
              className="w-5 h-5 rounded-full border-2 transition-transform flex-shrink-0"
              style={{
                backgroundColor: c,
                borderColor: color === c ? '#fff' : 'transparent',
                transform: color === c ? 'scale(1.3)' : 'scale(1)',
              }}
            />
          ))}

          <div className="w-px h-5 bg-white/20 mx-1" />

          {/* Undo / Clear */}
          <button
            onClick={handleUndo}
            title="元に戻す"
            className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-300 hover:bg-white/20 transition-colors"
          >
            <Undo2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleClear}
            title="クリア"
            className="w-7 h-7 flex items-center justify-center rounded-lg text-red-400 hover:bg-red-900/40 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>

          <div className="w-px h-5 bg-white/20 mx-1" />

          {/* Save */}
          <button
            onClick={() => shapes.length > 0 && setShowSaveForm(true)}
            title="マーカーとして保存"
            disabled={shapes.length === 0}
            className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium transition-colors ${
              shapes.length > 0
                ? 'bg-amber-500 hover:bg-amber-400 text-white'
                : 'text-gray-500 cursor-not-allowed'
            }`}
          >
            <BookmarkPlus className="w-3.5 h-3.5" />
            保存
          </button>
        </div>
      )}

      {/* Save form popup */}
      {showSaveForm && (
        <div
          className="absolute top-14 left-1/2 -translate-x-1/2 bg-white rounded-xl shadow-2xl p-4 w-72 pointer-events-all"
          style={{ zIndex: 30 }}
        >
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-semibold text-gray-900 text-sm flex items-center gap-1.5">
              <BookmarkPlus className="w-4 h-4 text-amber-500" />
              マーカーを保存
            </h4>
            <button onClick={() => setShowSaveForm(false)}>
              <X className="w-4 h-4 text-gray-400 hover:text-gray-600" />
            </button>
          </div>
          <div className="text-xs text-gray-500 mb-2">
            タイムスタンプ: <code className="font-mono bg-gray-100 px-1 rounded">{formatTime(currentTime)}</code>
            　描き込み: {shapes.length}個の図形
          </div>
          <input
            type="text"
            autoFocus
            value={saveLabel}
            onChange={(e) => setSaveLabel(e.target.value)}
            placeholder="例：右膝外反の確認ポイント"
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400 mb-3"
            onKeyDown={(e) => { if (e.key === 'Enter') handleSave() }}
          />
          <div className="flex gap-2">
            <button
              onClick={() => setShowSaveForm(false)}
              className="flex-1 px-3 py-2 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              キャンセル
            </button>
            <button
              onClick={handleSave}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-sm bg-amber-500 hover:bg-amber-400 text-white font-medium rounded-lg transition-colors"
            >
              <Save className="w-3.5 h-3.5" />
              保存
            </button>
          </div>
        </div>
      )}

      {/* Saved annotation badge (bottom-left of video) */}
      {savedAnnotations.length > 0 && (
        <div
          className="absolute bottom-14 left-2 flex flex-col gap-1 pointer-events-all"
          style={{ zIndex: 10 }}
        >
          {savedAnnotations.map((ann) => {
            const isNear = Math.abs(ann.timestamp - currentTime) <= SNAP_RADIUS
            const isHighlighted = highlightedId === ann.id
            return (
              <button
                key={ann.id}
                onClick={() => setHighlightedId(isHighlighted ? null : ann.id)}
                className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs transition-all ${
                  isHighlighted
                    ? 'bg-amber-400 text-white shadow-lg scale-105'
                    : isNear
                    ? 'bg-amber-500/80 text-white'
                    : 'bg-black/50 text-gray-300 hover:bg-black/70'
                }`}
              >
                <span className="text-amber-300 font-mono">{formatTime(ann.timestamp)}</span>
                <span className="max-w-32 truncate">{ann.label}</span>
                {isHighlighted && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      deleteAnnotation(ann.id)
                      setHighlightedId(null)
                      onSaved()
                    }}
                    className="ml-1 text-red-300 hover:text-red-100"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
