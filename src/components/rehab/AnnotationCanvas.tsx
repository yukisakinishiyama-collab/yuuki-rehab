'use client'

import { useRef, useState, useEffect, useCallback } from 'react'
import { Minus, Circle, ArrowRight, Pencil, Trash2, Undo2, Move } from 'lucide-react'

type Tool = 'none' | 'line' | 'angle' | 'arrow' | 'circle' | 'free'

interface Point { x: number; y: number }

interface Annotation {
  id: string
  tool: Tool
  color: string
  points: Point[]
}

const COLORS = ['#ef4444', '#3b82f6', '#f59e0b', '#22c55e', '#ffffff', '#a855f7']

function drawAnnotation(ctx: CanvasRenderingContext2D, ann: Annotation, preview?: Point) {
  ctx.strokeStyle = ann.color
  ctx.lineWidth = 2.5
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  const pts = preview ? [...ann.points, preview] : ann.points

  if (ann.tool === 'free') {
    if (pts.length < 2) return
    ctx.beginPath()
    ctx.moveTo(pts[0].x, pts[0].y)
    pts.slice(1).forEach((p) => ctx.lineTo(p.x, p.y))
    ctx.stroke()
    return
  }

  if (pts.length < 2) return

  if (ann.tool === 'line') {
    ctx.beginPath()
    ctx.moveTo(pts[0].x, pts[0].y)
    ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y)
    ctx.stroke()
    return
  }

  if (ann.tool === 'arrow') {
    const [a, b] = [pts[0], pts[pts.length - 1]]
    ctx.beginPath()
    ctx.moveTo(a.x, a.y)
    ctx.lineTo(b.x, b.y)
    ctx.stroke()
    // Arrowhead
    const angle = Math.atan2(b.y - a.y, b.x - a.x)
    const len = 14
    ctx.beginPath()
    ctx.moveTo(b.x, b.y)
    ctx.lineTo(b.x - len * Math.cos(angle - 0.4), b.y - len * Math.sin(angle - 0.4))
    ctx.lineTo(b.x - len * Math.cos(angle + 0.4), b.y - len * Math.sin(angle + 0.4))
    ctx.closePath()
    ctx.fillStyle = ann.color
    ctx.fill()
    return
  }

  if (ann.tool === 'circle') {
    const [a, b] = [pts[0], pts[pts.length - 1]]
    const rx = Math.abs(b.x - a.x) / 2
    const ry = Math.abs(b.y - a.y) / 2
    ctx.beginPath()
    ctx.ellipse(
      (a.x + b.x) / 2, (a.y + b.y) / 2,
      Math.max(rx, 1), Math.max(ry, 1),
      0, 0, Math.PI * 2,
    )
    ctx.stroke()
    return
  }

  if (ann.tool === 'angle' && pts.length >= 3) {
    const [a, b, c] = [pts[0], pts[1], pts[2]]
    ctx.beginPath()
    ctx.moveTo(a.x, a.y)
    ctx.lineTo(b.x, b.y)
    ctx.lineTo(c.x, c.y)
    ctx.stroke()
    // Angle label
    const v1 = { x: a.x - b.x, y: a.y - b.y }
    const v2 = { x: c.x - b.x, y: c.y - b.y }
    const dot = v1.x * v2.x + v1.y * v2.y
    const mag1 = Math.sqrt(v1.x ** 2 + v1.y ** 2)
    const mag2 = Math.sqrt(v2.x ** 2 + v2.y ** 2)
    if (mag1 > 0 && mag2 > 0) {
      const deg = Math.round((Math.acos(Math.min(1, Math.max(-1, dot / (mag1 * mag2)))) * 180) / Math.PI)
      ctx.fillStyle = ann.color
      ctx.font = 'bold 14px sans-serif'
      ctx.fillText(`${deg}°`, b.x + 8, b.y - 8)
    }
  }
}

export default function AnnotationCanvas({ width, height }: { width: number; height: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [tool, setTool] = useState<Tool>('none')
  const [color, setColor] = useState('#ef4444')
  const [annotations, setAnnotations] = useState<Annotation[]>([])
  const [current, setCurrent] = useState<Annotation | null>(null)
  const [mousePos, setMousePos] = useState<Point | null>(null)

  const redraw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    annotations.forEach((a) => drawAnnotation(ctx, a))
    if (current) drawAnnotation(ctx, current, mousePos ?? undefined)
  }, [annotations, current, mousePos])

  useEffect(() => { redraw() }, [redraw])

  function getPos(e: React.MouseEvent): Point {
    const rect = canvasRef.current!.getBoundingClientRect()
    const scaleX = canvasRef.current!.width / rect.width
    const scaleY = canvasRef.current!.height / rect.height
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    }
  }

  function handleMouseDown(e: React.MouseEvent) {
    if (tool === 'none') return
    const pos = getPos(e)
    if (tool === 'angle' && current && current.points.length === 1) {
      setCurrent({ ...current, points: [...current.points, pos] })
      return
    }
    if (tool === 'angle' && current && current.points.length === 2) {
      const finished: Annotation = { ...current, points: [...current.points, pos] }
      setAnnotations((prev) => [...prev, finished])
      setCurrent(null)
      return
    }
    const newAnn: Annotation = {
      id: `ann-${Date.now()}`,
      tool,
      color,
      points: [pos],
    }
    setCurrent(newAnn)
  }

  function handleMouseMove(e: React.MouseEvent) {
    const pos = getPos(e)
    setMousePos(pos)
    if (!current) return
    if (tool === 'free') {
      setCurrent({ ...current, points: [...current.points, pos] })
    }
  }

  function handleMouseUp(e: React.MouseEvent) {
    if (!current) return
    const pos = getPos(e)
    if (tool === 'angle') return // handled in mousedown
    const finished: Annotation = {
      ...current,
      points: tool === 'free' ? current.points : [...current.points, pos],
    }
    if (finished.points.length >= 2 || tool === 'free') {
      setAnnotations((prev) => [...prev, finished])
    }
    setCurrent(null)
  }

  const TOOLS: Array<{ key: Tool; icon: React.ElementType; label: string }> = [
    { key: 'none', icon: Move, label: '選択なし' },
    { key: 'line', icon: Minus, label: '直線' },
    { key: 'angle', icon: () => <span className="text-xs font-bold">∠</span>, label: '角度' },
    { key: 'arrow', icon: ArrowRight, label: '矢印' },
    { key: 'circle', icon: Circle, label: '円' },
    { key: 'free', icon: Pencil, label: 'フリー' },
  ]

  return (
    <div className="space-y-2">
      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
          {TOOLS.map(({ key, icon: Icon, label }) => (
            <button
              key={key}
              title={label}
              onClick={() => setTool(key)}
              className={`w-7 h-7 flex items-center justify-center rounded transition-colors ${
                tool === key ? 'bg-[#1e3a5f] text-white' : 'text-gray-600 hover:bg-gray-200'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1">
          {COLORS.map((c) => (
            <button
              key={c}
              onClick={() => setColor(c)}
              className="w-5 h-5 rounded-full border-2 transition-transform"
              style={{
                backgroundColor: c,
                borderColor: color === c ? '#374151' : '#d1d5db',
                transform: color === c ? 'scale(1.25)' : 'scale(1)',
              }}
            />
          ))}
        </div>
        <div className="ml-auto flex gap-1">
          <button
            onClick={() => setAnnotations((prev) => prev.slice(0, -1))}
            title="元に戻す"
            className="flex items-center gap-1 px-2 py-1 text-xs text-gray-600 bg-gray-100 hover:bg-gray-200 rounded transition-colors"
          >
            <Undo2 className="w-3.5 h-3.5" />
            元に戻す
          </button>
          <button
            onClick={() => setAnnotations([])}
            title="すべてクリア"
            className="flex items-center gap-1 px-2 py-1 text-xs text-red-600 bg-red-50 hover:bg-red-100 rounded transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            クリア
          </button>
        </div>
      </div>

      {/* Canvas */}
      <div className="relative rounded-lg overflow-hidden" style={{ cursor: tool === 'none' ? 'default' : 'crosshair' }}>
        <canvas
          ref={canvasRef}
          width={width}
          height={height}
          className="w-full"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={() => { setMousePos(null); if (current && tool !== 'angle') { setAnnotations((prev) => [...prev, current]); setCurrent(null) } }}
        />
      </div>
    </div>
  )
}
