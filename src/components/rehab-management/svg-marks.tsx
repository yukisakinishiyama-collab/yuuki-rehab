'use client'
// ──────────────────────────────────────────────
// SVG の図に直接描くマーク（ペンの線・×印・消しゴム）
// 解剖図（AnatomyMap）と人体図（BodyMap）で共用。
// 座標は図そのものの座標（viewBox の px）で持つ。左右反転して出す図は mirror=true で x を戻す。
// ──────────────────────────────────────────────
import { useRef, useState, type PointerEvent as ReactPointerEvent, type RefObject } from 'react'
import type { AnatomyViewMarks } from '@/lib/anatomy/types'

export type MarkTool = 'zone' | 'pen' | 'pin' | 'erase'
export const MARK_TOOL_LABELS: Record<MarkTool, string> = { zone: '部位を押す', pen: 'ペン', pin: '×印', erase: '消しゴム' }
export const MARK_COLOR = '#dc2626'
export const EMPTY_MARKS: AnatomyViewMarks = { pins: [], strokes: [] }
export const viewHasMarks = (m?: AnatomyViewMarks) => Boolean(m && (m.pins.length > 0 || m.strokes.length > 0))
export const markCount = (m?: AnatomyViewMarks) => (m ? m.pins.length + m.strokes.length : 0)

export function useSvgMarks({ svgRef, width, height, mirror = false, marks, onChange, tool, markScale = 1 }: {
  svgRef: RefObject<SVGSVGElement | null>
  width: number
  height: number
  mirror?: boolean
  marks: AnatomyViewMarks
  onChange?: (next: AnatomyViewMarks) => void
  tool: MarkTool
  /** 小さな図では印を大きめに（人体図は 2） */
  markScale?: number
}) {
  const drawing = useRef<Array<[number, number]> | null>(null)
  const [liveStroke, setLiveStroke] = useState<Array<[number, number]> | null>(null)
  const pinR = (width / 45) * markScale
  const drawMode = Boolean(onChange) && tool !== 'zone'

  /** 画面の座標 → 図の座標 */
  function toPoint(e: ReactPointerEvent): [number, number] | null {
    const svg = svgRef.current
    const ctm = svg?.getScreenCTM()
    if (!svg || !ctm) return null
    const pt = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse())
    const x = mirror ? width - pt.x : pt.x
    return [Math.round(Math.max(0, Math.min(width, x))), Math.round(Math.max(0, Math.min(height, pt.y)))]
  }

  function onPointerDown(e: ReactPointerEvent) {
    if (!drawMode || !onChange) return
    const p = toPoint(e)
    if (!p) return
    e.preventDefault()
    if (tool === 'pin') {
      onChange({ ...marks, pins: [...marks.pins, p] })
      return
    }
    if (tool === 'erase') {
      const r = pinR * 1.6
      const near = (q: [number, number]) => Math.hypot(q[0] - p[0], q[1] - p[1]) <= r
      const pinIdx = marks.pins.findIndex(near)
      if (pinIdx >= 0) { onChange({ ...marks, pins: marks.pins.filter((_, i) => i !== pinIdx) }); return }
      const strokeIdx = marks.strokes.findIndex(st => st.some(near))
      if (strokeIdx >= 0) onChange({ ...marks, strokes: marks.strokes.filter((_, i) => i !== strokeIdx) })
      return
    }
    ;(e.currentTarget as Element).setPointerCapture?.(e.pointerId)
    drawing.current = [p]
    setLiveStroke([p])
  }

  function onPointerMove(e: ReactPointerEvent) {
    if (!drawing.current) return
    const p = toPoint(e)
    if (!p) return
    const last = drawing.current[drawing.current.length - 1]
    if (Math.hypot(p[0] - last[0], p[1] - last[1]) < width / 300) return
    drawing.current.push(p)
    setLiveStroke([...drawing.current])
  }

  function onPointerUp() {
    if (!drawing.current || !onChange) return
    const stroke = drawing.current
    drawing.current = null
    setLiveStroke(null)
    // 点だけの線は小さな丸として残す
    onChange({ ...marks, strokes: [...marks.strokes, stroke.length === 1 ? [stroke[0], [stroke[0][0] + 1, stroke[0][1]]] : stroke] })
  }

  function undo() {
    if (!onChange) return
    if (marks.strokes.length > 0) onChange({ ...marks, strokes: marks.strokes.slice(0, -1) })
    else if (marks.pins.length > 0) onChange({ ...marks, pins: marks.pins.slice(0, -1) })
  }

  function clear() {
    onChange?.(EMPTY_MARKS)
  }

  return {
    drawMode,
    liveStroke,
    undo,
    clear,
    handlers: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel: onPointerUp },
    svgStyle: { userSelect: 'none' as const, touchAction: drawMode ? ('none' as const) : ('auto' as const), cursor: drawMode ? 'crosshair' : undefined },
  }
}

/** 描いたマークの描画（図の座標の <g> の中に置く） */
export function MarksLayer({ marks, liveStroke, width, markScale = 1 }: { marks: AnatomyViewMarks; liveStroke: Array<[number, number]> | null; width: number; markScale?: number }) {
  const pinR = (width / 45) * markScale
  const penW = (width / 110) * markScale
  const path = (pts: Array<[number, number]>) => pts.map(([x, y]) => `${x},${y}`).join(' ')
  return (
    <g pointerEvents="none" data-svg-marks>
      {marks.strokes.map((st, i) => (
        <polyline key={`s-${i}`} points={path(st)} fill="none" stroke={MARK_COLOR} strokeWidth={penW} strokeLinecap="round" strokeLinejoin="round" opacity={0.9} />
      ))}
      {liveStroke && <polyline points={path(liveStroke)} fill="none" stroke={MARK_COLOR} strokeWidth={penW} strokeLinecap="round" strokeLinejoin="round" opacity={0.7} />}
      {marks.pins.map(([x, y], i) => (
        <g key={`p-${i}`} stroke={MARK_COLOR} strokeWidth={penW * 1.2} strokeLinecap="round">
          <circle cx={x} cy={y} r={pinR} fill="rgba(220,38,38,0.12)" />
          <line x1={x - pinR * 0.6} y1={y - pinR * 0.6} x2={x + pinR * 0.6} y2={y + pinR * 0.6} />
          <line x1={x - pinR * 0.6} y1={y + pinR * 0.6} x2={x + pinR * 0.6} y2={y - pinR * 0.6} />
        </g>
      ))}
    </g>
  )
}

/** 道具の切り替え・戻す・消す */
export function MarkToolbar({ tool, onTool, hasMarks, onUndo, onClear, clearLabel = 'この向きのマークを消す', zoneLabel }: {
  tool: MarkTool
  onTool: (t: MarkTool) => void
  hasMarks: boolean
  onUndo: () => void
  onClear: () => void
  clearLabel?: string
  /** 「部位を押す」の言い換え（人体図では「部位をタップ」） */
  zoneLabel?: string
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5 px-1">
      <span className="text-xs text-gray-500">道具：</span>
      {(Object.keys(MARK_TOOL_LABELS) as MarkTool[]).map(t => (
        <button
          key={t}
          type="button"
          onClick={() => onTool(t)}
          aria-pressed={tool === t}
          className={`px-2.5 py-1 text-xs rounded-full border max-lg:min-h-10 ${tool === t ? (t === 'zone' ? 'bg-teal-700 text-white border-teal-700' : 'bg-red-600 text-white border-red-600') : 'bg-white text-gray-600 border-gray-200 hover:border-teal-300'}`}
        >
          {t === 'zone' && zoneLabel ? zoneLabel : MARK_TOOL_LABELS[t]}
        </button>
      ))}
      {hasMarks && (
        <>
          <button type="button" onClick={onUndo} className="ml-auto px-2.5 py-1 text-xs rounded-full border border-gray-200 bg-white text-gray-600 hover:border-teal-300 max-lg:min-h-10">ひとつ戻す</button>
          <button type="button" onClick={onClear} className="px-2.5 py-1 text-xs rounded-full border border-gray-200 bg-white text-gray-600 hover:border-red-300 hover:text-red-700 max-lg:min-h-10">{clearLabel}</button>
        </>
      )}
    </div>
  )
}

export function markHint(tool: MarkTool): string {
  return tool === 'pen' ? '指やペンで図の上をなぞると赤い線を描けます' : tool === 'pin' ? '押した場所に ×印 を置きます' : 'マークを押すと消えます'
}
