'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { savePersonMarker, deletePersonMarker } from '@/lib/rehab-store'
import type { PersonMarker } from '@/types/rehab'
import { Target, Trash2, X, MousePointer2, Eye, EyeOff } from 'lucide-react'

interface Props {
  videoId: string
  marker: PersonMarker | null
  onMarkerChange: (m: PersonMarker | null) => void
}

interface DragState {
  active: boolean
  startX: number
  startY: number
  curX: number
  curY: number
}

const MARKER_COLOR = '#facc15'

export default function PersonMarkerLayer({ videoId, marker, onMarkerChange }: Props) {
  const [editMode, setEditMode] = useState(false)
  const [visible, setVisible] = useState(true)
  const [drag, setDrag] = useState<DragState>({ active: false, startX: 0, startY: 0, curX: 0, curY: 0 })
  const containerRef = useRef<HTMLDivElement>(null)

  // ─── 座標変換（コンテナの % で返す）────────────────────────────────
  function toPercent(clientX: number, clientY: number) {
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return { x: 0, y: 0 }
    return {
      x: Math.max(0, Math.min(1, (clientX - rect.left) / rect.width)),
      y: Math.max(0, Math.min(1, (clientY - rect.top) / rect.height)),
    }
  }

  // ─── マウスイベント（描画モード時のみ）──────────────────────────────
  function handleMouseDown(e: React.MouseEvent) {
    if (!editMode) return
    e.preventDefault()
    e.stopPropagation()
    const { x, y } = toPercent(e.clientX, e.clientY)
    setDrag({ active: true, startX: x, startY: y, curX: x, curY: y })
  }

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!drag.active) return
    e.preventDefault()
    const { x, y } = toPercent(e.clientX, e.clientY)
    setDrag(d => ({ ...d, curX: x, curY: y }))
  }, [drag.active]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleMouseUp = useCallback((e: MouseEvent) => {
    if (!drag.active) return
    const { x, y } = toPercent(e.clientX, e.clientY)
    const rx = Math.min(drag.startX, x)
    const ry = Math.min(drag.startY, y)
    const rw = Math.abs(x - drag.startX)
    const rh = Math.abs(y - drag.startY)

    if (rw > 0.04 && rh > 0.04) {
      const m: PersonMarker = {
        videoId, x: rx, y: ry, width: rw, height: rh,
        label: '対象者', color: MARKER_COLOR,
      }
      savePersonMarker(m)
      onMarkerChange(m)
      setEditMode(false)
    }
    setDrag(d => ({ ...d, active: false }))
  }, [drag, videoId, onMarkerChange]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!drag.active) return
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [drag.active, handleMouseMove, handleMouseUp])

  // ─── タッチ対応 ─────────────────────────────────────────────────────
  function handleTouchStart(e: React.TouchEvent) {
    if (!editMode) return
    e.preventDefault()
    const t = e.touches[0]
    const { x, y } = toPercent(t.clientX, t.clientY)
    setDrag({ active: true, startX: x, startY: y, curX: x, curY: y })
  }

  function handleTouchMove(e: React.TouchEvent) {
    if (!drag.active) return
    e.preventDefault()
    const t = e.touches[0]
    const { x, y } = toPercent(t.clientX, t.clientY)
    setDrag(d => ({ ...d, curX: x, curY: y }))
  }

  function handleTouchEnd(e: React.TouchEvent) {
    if (!drag.active) return
    e.preventDefault()
    const t = e.changedTouches[0]
    const { x, y } = toPercent(t.clientX, t.clientY)
    const rx = Math.min(drag.startX, x)
    const ry = Math.min(drag.startY, y)
    const rw = Math.abs(x - drag.startX)
    const rh = Math.abs(y - drag.startY)
    if (rw > 0.04 && rh > 0.04) {
      const m: PersonMarker = {
        videoId, x: rx, y: ry, width: rw, height: rh,
        label: '対象者', color: MARKER_COLOR,
      }
      savePersonMarker(m)
      onMarkerChange(m)
      setEditMode(false)
    }
    setDrag(d => ({ ...d, active: false }))
  }

  function handleDelete() {
    deletePersonMarker(videoId)
    onMarkerChange(null)
  }

  const previewRect = drag.active ? {
    x: Math.min(drag.startX, drag.curX),
    y: Math.min(drag.startY, drag.curY),
    w: Math.abs(drag.curX - drag.startX),
    h: Math.abs(drag.curY - drag.startY),
  } : null

  return (
    // ★ 通常時は pointer-events: none → ビデオプレイヤーへ素通し
    // ★ 描画モード時だけ pointer-events: auto でドラッグを受け取る
    <div className="absolute inset-0" style={{ pointerEvents: 'none' }}>

      {/* ── 描画モード用オーバーレイ（editMode時だけ存在）──────────── */}
      {editMode && (
        <div
          ref={containerRef}
          onMouseDown={handleMouseDown}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          className="absolute inset-0 z-30"
          style={{
            cursor: 'crosshair',
            userSelect: 'none',
            pointerEvents: 'auto',        // ← 描画中だけイベント受取
            touchAction: 'none',
            background: 'rgba(0,0,0,0.18)',
          }}
        >
          {/* ドラッグ中のプレビューボックス */}
          {previewRect && previewRect.w > 0.01 && previewRect.h > 0.01 && (
            <MarkerBox
              x={previewRect.x} y={previewRect.y}
              width={previewRect.w} height={previewRect.h}
              label="対象者" color={MARKER_COLOR}
              showDelete={false}
            />
          )}

          {/* 操作ガイド */}
          <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-black/70 text-white text-xs px-3 py-1.5 rounded-full flex items-center gap-1.5 select-none">
            <MousePointer2 className="w-3.5 h-3.5 text-yellow-300" />
            対象者をドラッグで囲んでください
          </div>

          {/* キャンセルボタン */}
          <button
            onMouseDown={(e) => e.stopPropagation()}
            onClick={() => setEditMode(false)}
            className="absolute top-2 right-2 w-7 h-7 bg-white/20 hover:bg-white/40 text-white rounded-full flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ── 既存マーカー表示（visible時のみ・pointer-events は最小限）─── */}
      {marker && visible && (
        <div
          className="absolute inset-0 z-20"
          style={{ pointerEvents: 'none' }}
        >
          <MarkerBox
            x={marker.x} y={marker.y}
            width={marker.width} height={marker.height}
            label={marker.label} color={marker.color}
            showDelete={!editMode}
            onDelete={handleDelete}
          />
        </div>
      )}

      {/* ── コントロールボタン（常に最前面・クリック可能）─────────── */}
      <div
        className="absolute bottom-2 left-2 z-40 flex items-center gap-1.5"
        style={{ pointerEvents: 'auto' }}   // ← ボタンだけイベント受取
      >
        {!editMode && (
          <>
            <button
              onClick={() => setEditMode(true)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold shadow-md transition-all ${
                marker
                  ? 'bg-yellow-400 text-gray-900 hover:bg-yellow-300'
                  : 'bg-black/50 text-white hover:bg-black/70 backdrop-blur-sm'
              }`}
            >
              <Target className="w-3.5 h-3.5" />
              {marker ? '🎯 対象者設定済み' : '対象者マーカー'}
            </button>
            {marker && (
              <>
                {/* 表示/非表示トグル */}
                <button
                  onClick={() => setVisible(v => !v)}
                  className={`w-6 h-6 text-white rounded-full flex items-center justify-center shadow transition-colors ${
                    visible ? 'bg-yellow-500/80 hover:bg-yellow-400' : 'bg-black/50 hover:bg-black/70'
                  }`}
                  title={visible ? 'マーカーを非表示' : 'マーカーを表示'}
                >
                  {visible ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                </button>
                {/* 削除ボタン */}
                <button
                  onClick={handleDelete}
                  className="w-6 h-6 bg-red-500/80 hover:bg-red-600 text-white rounded-full flex items-center justify-center shadow transition-colors"
                  title="マーカーを削除"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}

// ─── マーカーボックス描画コンポーネント ────────────────────────────────────
function MarkerBox({
  x, y, width, height, label, color, showDelete, onDelete,
}: {
  x: number; y: number; width: number; height: number
  label: string; color: string; showDelete: boolean; onDelete?: () => void
}) {
  return (
    <div
      className="absolute"
      style={{
        left:   `${x * 100}%`,
        top:    `${y * 100}%`,
        width:  `${width  * 100}%`,
        height: `${height * 100}%`,
        pointerEvents: 'none',
      }}
    >
      {/* グロー枠 */}
      <div
        className="absolute inset-0"
        style={{ boxShadow: `inset 0 0 0 3px ${color}, 0 0 14px 2px ${color}60` }}
      />

      {/* コーナーハンドル */}
      {[
        { cls: 'top-0 left-0',   b: 'border-t border-l' },
        { cls: 'top-0 right-0',  b: 'border-t border-r' },
        { cls: 'bottom-0 left-0',b: 'border-b border-l' },
        { cls: 'bottom-0 right-0',b:'border-b border-r' },
      ].map(({ cls, b }, i) => (
        <div
          key={i}
          className={`absolute w-3.5 h-3.5 ${cls} ${b}`}
          style={{ borderColor: color, borderWidth: 3 }}
        />
      ))}

      {/* ラベル（削除ボタン付き） */}
      <div
        className="absolute flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold"
        style={{
          top: '-22px', left: 0,
          background: color, color: '#111',
          pointerEvents: showDelete ? 'auto' : 'none',
        }}
      >
        <Target className="w-2.5 h-2.5 flex-shrink-0" />
        <span>{label}</span>
        {showDelete && onDelete && (
          <button
            onClick={(e) => { e.stopPropagation(); onDelete() }}
            className="ml-1 opacity-70 hover:opacity-100"
          >
            <Trash2 className="w-2.5 h-2.5" />
          </button>
        )}
      </div>
    </div>
  )
}
