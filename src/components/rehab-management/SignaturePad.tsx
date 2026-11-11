'use client'
/**
 * 指で書く署名欄（タブレット・スマホ・マウス）
 * 書き終えるたびに PNG（data:image/png;base64,…）を onChange で返す。「書き直す」で消す。
 *
 * 2026-11-11 の見直し（「同意書を記入してもらっても登録できない」）:
 * - 書けたかどうかを欄の上に出す（「✓ 署名を受け付けました」）。まだなら、押したときに赤い枠で知らせる（missing）
 * - setPointerCapture が使えない端末でも書けるように（失敗しても書く処理は続ける）
 * - 画面を回す・幅が変わると、書いた線を残したまま大きさを合わせ直す
 */
import { useEffect, useRef, useState } from 'react'

export default function SignaturePad({
  id,
  label,
  onChange,
  height = 150,
  missing = false,
}: {
  /** 「まだのもの」から飛んでくるための目印 */
  id?: string
  label: string
  onChange: (dataUrl: string | null) => void
  height?: number
  /** 署名して完了するを押したのに、まだ書いていない */
  missing?: boolean
}) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawing = useRef(false)
  const last = useRef<{ x: number; y: number } | null>(null)
  const [empty, setEmpty] = useState(true)

  // 大きさを合わせる（画面の細かさに合わせて、線がにじまないように）。幅が変わったら線を残して合わせ直す
  useEffect(() => {
    const canvas = canvasRef.current
    const wrap = wrapRef.current
    if (!canvas || !wrap) return
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const setup = (ctx: CanvasRenderingContext2D) => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.lineWidth = 2.6
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.strokeStyle = '#0f172a'
      ctx.fillStyle = '#0f172a'
    }
    const fit = () => {
      const width = wrap.clientWidth
      if (width <= 0) return
      const w = Math.round(width * dpr)
      const h = Math.round(height * dpr)
      if (canvas.width === w && canvas.height === h) return
      // いま書いてある線を写しておく
      let keep: HTMLCanvasElement | null = null
      if (canvas.width > 0 && canvas.height > 0) {
        keep = document.createElement('canvas')
        keep.width = canvas.width
        keep.height = canvas.height
        keep.getContext('2d')?.drawImage(canvas, 0, 0)
      }
      canvas.width = w
      canvas.height = h
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      if (keep) ctx.drawImage(keep, 0, 0)
      setup(ctx)
    }
    fit()
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() => fit())
    ro.observe(wrap)
    return () => ro.disconnect()
  }, [height])

  function point(e: React.PointerEvent<HTMLCanvasElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  function down(e: React.PointerEvent<HTMLCanvasElement>) {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    e.preventDefault()
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      // つかめない端末でも、書く処理はそのまま続ける
    }
    drawing.current = true
    last.current = point(e)
    const ctx = canvasRef.current?.getContext('2d')
    if (ctx && last.current) {
      ctx.beginPath()
      ctx.arc(last.current.x, last.current.y, 1.2, 0, Math.PI * 2)
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
    if (!canvas || canvas.width === 0 || canvas.height === 0) return null
    const scale = Math.min(1, 900 / canvas.width)
    const out = document.createElement('canvas')
    out.width = Math.max(1, Math.round(canvas.width * scale))
    out.height = Math.max(1, Math.round(canvas.height * scale))
    const ctx = out.getContext('2d')
    if (!ctx) return null
    ctx.drawImage(canvas, 0, 0, out.width, out.height)
    const url = out.toDataURL('image/png')
    return url.startsWith('data:image/png;base64,') ? url : null
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

  const frame = missing && empty ? 'border-red-500 bg-red-50/40' : empty ? 'border-slate-300 bg-white' : 'border-teal-600 bg-white'

  return (
    <div id={id} className="scroll-mt-24">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-bold text-slate-700">
          {label}
          {empty ? (
            <span className={`ml-2 text-xs font-bold ${missing ? 'text-red-700' : 'text-slate-500'}`}>{missing ? '← まだ書かれていません' : '（まだ）'}</span>
          ) : (
            <span className="ml-2 text-xs font-bold text-teal-700">✓ 署名を受け付けました</span>
          )}
        </span>
        <button
          type="button"
          onClick={clear}
          className="min-h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-700 hover:bg-slate-50"
        >
          書き直す
        </button>
      </div>
      <div ref={wrapRef} className={`relative overflow-hidden rounded-xl border-2 border-dashed ${frame}`}>
        <canvas
          ref={canvasRef}
          aria-label={`${label}（指やペンで書いてください）`}
          className="block touch-none select-none"
          style={{ height }}
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerCancel={up}
          onLostPointerCapture={up}
          onPointerLeave={up}
          onContextMenu={(e) => e.preventDefault()}
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
