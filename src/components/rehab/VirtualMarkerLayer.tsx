'use client'

/**
 * VirtualMarkerLayer
 * 動画上をクリックしてマーカーを配置し、
 * テンプレートマッチング（SSD最小化）で自動追跡する。
 *
 * 使い方:
 *  1. 動画を一時停止
 *  2. 追跡したい関節を選択して動画上をクリック → マーカー配置
 *  3. 再生するとマーカーが自動追跡し、角度をリアルタイム表示
 */

import { useRef, useEffect, useCallback, useState } from 'react'
import { Trash2 } from 'lucide-react'
import type { DetectedMarker, MarkerAngle } from '@/lib/color-marker-tracker'
import { calcMarkerAngles, drawMarkers, JOINT_OPTIONS } from '@/lib/color-marker-tracker'

// ── テンプレートマッチングパラメータ ─────────────────────────────────────────
const PATCH_HALF = 12   // パッチ半径（ピクセル）: パッチサイズ = (2*12+1)^2 = 625px
const SEARCH_R   = 28   // 探索半径（ピクセル）

// ── マーカー色セット ──────────────────────────────────────────────────────────
const VM_COLORS = ['#ef4444', '#3b82f6', '#22c55e', '#f59e0b', '#a855f7', '#06b6d4']

// ── 型定義 ────────────────────────────────────────────────────────────────────
interface VirtualMarker {
  id:       string
  label:    string
  joint:    string
  x:        number         // 正規化座標 0-1
  y:        number
  pixelX:   number         // 動画ピクセル座標
  pixelY:   number
  cssColor: string
  patch:    Float32Array | null  // グレースケール テンプレートパッチ
}

interface Props {
  videoRef:  React.RefObject<HTMLVideoElement | null>
  active:    boolean
  onAngles?: (angles: MarkerAngle[], detected: DetectedMarker[]) => void
}

// ── ヘルパー関数 ──────────────────────────────────────────────────────────────

/** 指定座標周辺のグレースケールパッチを抽出 */
function extractGrayPatch(
  data: Uint8ClampedArray, width: number, height: number,
  cx: number, cy: number,
): Float32Array {
  const s = PATCH_HALF * 2 + 1
  const out = new Float32Array(s * s)
  let i = 0
  for (let dy = -PATCH_HALF; dy <= PATCH_HALF; dy++) {
    for (let dx = -PATCH_HALF; dx <= PATCH_HALF; dx++) {
      const ix = Math.max(0, Math.min(width  - 1, Math.round(cx + dx)))
      const iy = Math.max(0, Math.min(height - 1, Math.round(cy + dy)))
      const p  = (iy * width + ix) * 4
      out[i++] = 0.299 * data[p] + 0.587 * data[p + 1] + 0.114 * data[p + 2]
    }
  }
  return out
}

/** テンプレートマッチング（SSD最小化）で次フレームの位置を探索 */
function findBestMatch(
  data: Uint8ClampedArray, width: number, height: number,
  patch: Float32Array, cx: number, cy: number,
): { px: number; py: number } {
  const S = PATCH_HALF * 2 + 1
  let bestSSD = Infinity, bestX = cx, bestY = cy

  for (let dy = -SEARCH_R; dy <= SEARCH_R; dy++) {
    for (let dx = -SEARCH_R; dx <= SEARCH_R; dx++) {
      const tx = Math.round(cx + dx)
      const ty = Math.round(cy + dy)
      if (tx < PATCH_HALF || tx >= width  - PATCH_HALF ||
          ty < PATCH_HALF || ty >= height - PATCH_HALF) continue

      let ssd = 0, earlyExit = false
      for (let oy = -PATCH_HALF; oy <= PATCH_HALF && !earlyExit; oy++) {
        for (let ox = -PATCH_HALF; ox <= PATCH_HALF; ox++) {
          const p = ((ty + oy) * width + (tx + ox)) * 4
          const g = 0.299 * data[p] + 0.587 * data[p + 1] + 0.114 * data[p + 2]
          const d = g - patch[(oy + PATCH_HALF) * S + (ox + PATCH_HALF)]
          ssd += d * d
          if (ssd >= bestSSD) { earlyExit = true; break }
        }
      }
      if (!earlyExit && ssd < bestSSD) { bestSSD = ssd; bestX = tx; bestY = ty }
    }
  }
  return { px: bestX, py: bestY }
}

// ── コンポーネント ────────────────────────────────────────────────────────────
export default function VirtualMarkerLayer({ videoRef, active, onAngles }: Props) {
  const canvasRef    = useRef<HTMLCanvasElement>(null)
  const offscreenRef = useRef<HTMLCanvasElement | null>(null)
  const markersRef   = useRef<VirtualMarker[]>([])   // RAF内で直接書き換えるmutableなref
  const rafRef       = useRef<number | null>(null)

  const [markers,  setMarkers]  = useState<VirtualMarker[]>([])  // UIパネル表示用
  const [isPaused, setIsPaused] = useState(true)                  // クリック配置制御用
  const [selJoint, setSelJoint] = useState(JOINT_OPTIONS[8].key) // 既定: LEFT_KNEE

  // ── markersRef と state の同期 ─────────────────────────────────────────────
  useEffect(() => { markersRef.current = markers }, [markers])

  // ── 動画の再生/一時停止イベントを監視 ──────────────────────────────────────
  useEffect(() => {
    const v = videoRef.current
    if (!v) return
    const onPlay  = () => setIsPaused(false)
    const onPause = () => setIsPaused(true)
    v.addEventListener('play',  onPlay)
    v.addEventListener('pause', onPause)
    setIsPaused(v.paused)
    return () => {
      v.removeEventListener('play',  onPlay)
      v.removeEventListener('pause', onPause)
    }
  }, [videoRef])

  // ── RAF 追跡ループ ─────────────────────────────────────────────────────────
  const loop = useCallback(() => {
    const video  = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) { rafRef.current = requestAnimationFrame(loop); return }

    if (!offscreenRef.current) offscreenRef.current = document.createElement('canvas')
    const W = video.videoWidth  || 640
    const H = video.videoHeight || 360
    canvas.width  = W
    canvas.height = H

    const ctx = canvas.getContext('2d')
    if (!ctx) { rafRef.current = requestAnimationFrame(loop); return }
    ctx.clearRect(0, 0, W, H)

    const current = markersRef.current
    if (current.length > 0) {

      // 再生中 → テンプレートマッチングで追跡
      if (!video.paused && !video.ended && video.readyState >= 2) {
        offscreenRef.current.width  = W
        offscreenRef.current.height = H
        const offCtx = offscreenRef.current.getContext('2d', { willReadFrequently: true })
        if (offCtx) {
          offCtx.drawImage(video, 0, 0, W, H)
          const { data } = offCtx.getImageData(0, 0, W, H)
          // マーカーを追跡してrefを直接更新（Reactステートは変更しない）
          for (const m of current) {
            if (!m.patch) continue
            const { px, py } = findBestMatch(data, W, H, m.patch, m.pixelX, m.pixelY)
            m.pixelX = px
            m.pixelY = py
            m.x      = px / W
            m.y      = py / H
            m.patch  = extractGrayPatch(data, W, H, px, py)  // 適応的テンプレート更新
          }
        }
      }

      // キャンバスへ描画
      const detected: DetectedMarker[] = current.map((m) => ({
        joint: m.joint, label: m.label,
        x: m.x, y: m.y, pixelX: m.pixelX, pixelY: m.pixelY,
        count: 100, cssColor: m.cssColor,
      }))
      const angles = calcMarkerAngles(detected)
      drawMarkers(ctx, detected, angles, W, H)
      onAngles?.(angles, detected)
    }

    rafRef.current = requestAnimationFrame(loop)
  }, [videoRef, onAngles])

  useEffect(() => {
    if (!active) {
      if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null }
      const ctx = canvasRef.current?.getContext('2d')
      if (ctx && canvasRef.current) ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height)
      return
    }
    rafRef.current = requestAnimationFrame(loop)
    return () => {
      if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null }
    }
  }, [active, loop])

  // ── クリックでマーカーを配置 ───────────────────────────────────────────────
  function handleOverlayClick(e: React.MouseEvent<HTMLDivElement>) {
    e.stopPropagation()   // 動画クリック再生をキャンセル
    const video = videoRef.current
    if (!video || video.readyState < 2) return

    const rect = e.currentTarget.getBoundingClientRect()
    const W = video.videoWidth  || 640
    const H = video.videoHeight || 360

    // object-contain のレターボックスを考慮した座標変換
    const cW = rect.width, cH = rect.height
    const vAR = W / H, cAR = cW / cH
    let dW: number, dH: number, oX: number, oY: number
    if (cAR > vAR) { dH = cH; dW = cH * vAR; oX = (cW - dW) / 2; oY = 0 }
    else           { dW = cW; dH = cW / vAR;  oX = 0;             oY = (cH - dH) / 2 }

    const cx = e.clientX - rect.left
    const cy = e.clientY - rect.top
    if (cx < oX || cx > oX + dW || cy < oY || cy > oY + dH) return

    const nx = (cx - oX) / dW
    const ny = (cy - oY) / dH
    const px = nx * W
    const py = ny * H

    // 現フレームのパッチを取得
    if (!offscreenRef.current) offscreenRef.current = document.createElement('canvas')
    offscreenRef.current.width  = W
    offscreenRef.current.height = H
    const offCtx = offscreenRef.current.getContext('2d', { willReadFrequently: true })
    if (!offCtx) return
    offCtx.drawImage(video, 0, 0, W, H)
    const { data } = offCtx.getImageData(0, 0, W, H)
    const patch = extractGrayPatch(data, W, H, px, py)

    const jo    = JOINT_OPTIONS.find((j) => j.key === selJoint)
    const color = VM_COLORS[markers.length % VM_COLORS.length]

    const nm: VirtualMarker = {
      id: `vm${Date.now()}`,
      label:    jo?.label ?? selJoint,
      joint:    selJoint,
      x: nx, y: ny, pixelX: px, pixelY: py,
      cssColor: color,
      patch,
    }
    const updated = [...markers, nm]
    setMarkers(updated)
    markersRef.current = updated
  }

  function removeMarker(id: string) {
    const updated = markers.filter((m) => m.id !== id)
    setMarkers(updated)
    markersRef.current = updated
  }

  if (!active) return null

  return (
    <>
      {/* 描画キャンバス（常にpointer-events-none） */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full pointer-events-none"
        style={{ objectFit: 'contain' }}
      />

      {/* 一時停止中のみクリック配置オーバーレイを表示 */}
      {isPaused && (
        <div
          className="absolute inset-0 cursor-crosshair z-10"
          onClick={handleOverlayClick}
        />
      )}

      {/* コントロールパネル */}
      <div className="absolute top-2 right-2 z-20 bg-black/85 backdrop-blur-sm rounded-xl p-3 text-xs text-white w-52 space-y-2 border border-purple-500/30">
        {/* タイトル */}
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
          <span className="font-bold text-purple-300 text-[11px]">仮想マーカー追跡</span>
        </div>

        {/* 状態表示 */}
        {isPaused ? (
          <p className="text-gray-400 text-[10px] leading-snug">
            ⏸ 一時停止中 — 関節を選択してクリックで配置
          </p>
        ) : (
          <p className="text-teal-400 text-[10px]">▶ 追跡中（テンプレートマッチング）</p>
        )}

        {/* 関節選択 */}
        <div>
          <p className="text-gray-500 text-[10px] mb-0.5">次に配置する関節</p>
          <select
            value={selJoint}
            onChange={(e) => setSelJoint(e.target.value)}
            className="w-full bg-[#1f2937] border border-white/10 text-white text-[10px] rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-purple-500"
          >
            {JOINT_OPTIONS.map((j) => (
              <option key={j.key} value={j.key}>{j.label}</option>
            ))}
          </select>
        </div>

        {/* 配置済みマーカー一覧 */}
        {markers.length > 0 && (
          <div className="space-y-1 max-h-36 overflow-y-auto">
            <p className="text-gray-500 text-[10px]">配置済み ({markers.length})</p>
            {markers.map((m, i) => (
              <div key={m.id} className="flex items-center gap-1.5 py-0.5">
                <div
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0 border border-white/20"
                  style={{ background: m.cssColor }}
                />
                <span className="flex-1 text-[10px] truncate text-gray-200">{i + 1}. {m.label}</span>
                <button
                  onClick={() => removeMarker(m.id)}
                  className="text-gray-600 hover:text-red-400 transition-colors"
                  title="削除"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}
            <button
              onClick={() => { setMarkers([]); markersRef.current = [] }}
              className="text-[10px] text-gray-600 hover:text-red-400 transition-colors pt-0.5"
            >
              全て削除
            </button>
          </div>
        )}

        {/* ヒント */}
        {markers.length === 0 && (
          <p className="text-gray-600 text-[9px] leading-snug">
            💡 膝・股関節・足首の3点を配置すると角度が自動計算されます
          </p>
        )}
      </div>
    </>
  )
}
