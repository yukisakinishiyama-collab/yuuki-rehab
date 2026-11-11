'use client'
/**
 * 指で書く署名欄（タブレット・スマホ・マウス）
 * 書き終えるたびに PNG（data:image/png;base64,…）を onChange で返す。「書き直す」で消す。
 */
import { useEffect, useRef, useState } from 'react'

export default function SignaturePad({
  label,
  onChange,
  height = 150,
}: {
  label: string
  onChange: (dataUrl: string | null) => void
  height?: number
}) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawing = useRef(false)
  const last = useRef<{ x: number; y: number } | null>(null)
  const [empty, setEmpty] = useState(true)

  // 大きさを合わせる（画面の細かさに合わせて、線がにじまないように）
  useEffect(() => {
    const canvas = canvasRef.current
    const wrap = wrapRef.current
    if (!canvas || !wrap) return
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const width = wrap.clientWidth
    canvas.width = Math.round(width * dpr)
    canvas.height = Math.round(height * dpr)
    canvas.style.width = `${width}px`
    canvas.style.height = `${height}px`
    const ctx = canvas.getContext('2d')
    if (ctx) {
      ctx.scale(dpr, dpr)
      ctx.lineWidth = 2.6
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.strokeStyle = '#0f172a'
    }
  }, [height])

  function point(e: React.PointerEvent<HTMLCanvasElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  function down(e: React.PointerEvent<HTMLCanvasElement>) {
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    drawing.current = true
    last.current = point(e)
    const ctx = canvasRef.current?.getContext('2d')
    if (ctx && last.current) {
      ctx.beginPath()
      ctx.arc(last.current.x, last.current.y, 1.2, 0, Math.PI * 2)
      ctx.fillStyle = '#0f172a'
      ctx.fill()
    }
  }

  function move(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return
    e.preventDefault()
    const ctx = canvasRef.current?.getContext('2d')
    const p = point(e)
    if (ctx && last.current) {
      ctx.beginPath()
      ctx.moveTo(last.current.x, last.current.y)
      ctx.lineTo(p.x, p.y)
      ctx.stroke()
    }
    last.current = p
  }

  function up() {
    if (!drawing.current) return
    drawing.current = false
    last.current = null
    setEmpty(false)
    onChange(exportPng())
  }

  /** 横幅を最大900pxに縮めて PNG にする（保存の大きさを抑える） */
  function exportPng(): string | null {
    const canvas = canvasRef.current
    if (!canvas) return null
    const scale = Math.min(1, 900 / canvas.width)
    const out = document.createElement('canvas')
    out.width = Math.round(canvas.width * scale)
    out.height = Math.round(canvas.height * scale)
    const ctx = out.getContext('2d')
    if (!ctx) return null
    ctx.drawImage(canvas, 0, 0, out.width, out.height)
    return out.toDataURL('image/png')
  }

  function clear() {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (canvas && ctx) {
      ctx.save()
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.restore()
    }
    setEmpty(true)
    onChange(null)
  }

  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <span className="text-sm font-bold text-slate-700">{label}</span>
        <button
          type="button"
          onClick={clear}
          className="min-h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-700 hover:bg-slate-50"
        >
          書き直す
        </button>
      </div>
      <div ref={wrapRef} className="relative overflow-hidden rounded-xl border-2 border-dashed border-slate-300 bg-white">
        <canvas
          ref={canvasRef}
          aria-label={`${label}（指やペンで書いてください）`}
          className="block touch-none"
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerCancel={up}
          onPointerLeave={up}
        />
        {empty && (
          <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-slate-500">
            ここに指やペンで署名してください
          </span>
        )}
        <span className="pointer-events-none absolute bottom-6 left-4 right-4 border-b border-slate-200" aria-hidden />
      </div>
    </div>
  )
}
