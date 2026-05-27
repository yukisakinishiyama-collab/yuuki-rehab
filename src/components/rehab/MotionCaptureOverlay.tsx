'use client'

/**
 * MotionCaptureOverlay
 * 動画再生中にリアルタイムで骨格検出・ROM表示を行うキャンバスオーバーレイ。
 * VideoPlayer の映像エリア内に absolute 配置で重ねて使う。
 */

import { useRef, useEffect, useState, useCallback } from 'react'
import type { ROMItem } from '@/lib/pose-analyzer'

interface Props {
  videoRef: React.RefObject<HTMLVideoElement | null>
  active: boolean
}

const SIDE_LABEL: Record<string, string> = { front: '📷 正面', side: '📷 側面', unknown: '📷 判定中' }
const SIDE_COLOR: Record<string, string> = { front: '#2563eb', side: '#7c3aed', unknown: '#6b7280' }

export default function MotionCaptureOverlay({ videoRef, active }: Props) {
  const canvasRef   = useRef<HTMLCanvasElement>(null)
  const rafRef      = useRef<number | null>(null)
  const readyRef    = useRef(false)        // initVideoMode完了フラグ

  const [romItems,  setRomItems]  = useState<ROMItem[]>([])
  const [poseSide,  setPoseSide]  = useState<'front' | 'side' | 'unknown'>('unknown')
  const [detected,  setDetected]  = useState(false)
  const [loading,   setLoading]   = useState(false)

  // ── RAF ループ（アクティブ中のみ走る） ──────────────────────────────────
  const loop = useCallback(() => {
    const video  = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas || !readyRef.current) {
      rafRef.current = requestAnimationFrame(loop)
      return
    }

    // キャンバスサイズを動画に合わせる
    if (canvas.width  !== video.videoWidth)  canvas.width  = video.videoWidth  || 640
    if (canvas.height !== video.videoHeight) canvas.height = video.videoHeight || 360

    const ctx = canvas.getContext('2d')
    if (!ctx) { rafRef.current = requestAnimationFrame(loop); return }

    ctx.clearRect(0, 0, canvas.width, canvas.height)

    // 停止中でも最後の骨格を薄く残す（再生中のみ更新）
    if (!video.paused && !video.ended && video.readyState >= 2) {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { detectPoseForVideoSync, drawPoseOverlay } = require('@/lib/pose-analyzer') as typeof import('@/lib/pose-analyzer')
      const result = detectPoseForVideoSync(video, performance.now())

      if (result.detected) {
        drawPoseOverlay(ctx, result.landmarks, result.romItems, canvas.width, canvas.height)
        setDetected(true)
        setRomItems(result.romItems)
        setPoseSide(result.poseSide)
      } else {
        setDetected(false)
      }
    }

    rafRef.current = requestAnimationFrame(loop)
  }, [videoRef])

  // ── active 切り替え時の初期化・クリーンアップ ─────────────────────────
  useEffect(() => {
    if (!active) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      rafRef.current = null
      readyRef.current = false
      // キャンバスをクリア
      const ctx = canvasRef.current?.getContext('2d')
      if (ctx && canvasRef.current) ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height)
      setRomItems([])
      setDetected(false)
      return
    }

    // 初期化してからループ開始
    setLoading(true)
    ;(async () => {
      const { initVideoMode } = await import('@/lib/pose-analyzer')
      await initVideoMode()
      readyRef.current = true
      setLoading(false)
      rafRef.current = requestAnimationFrame(loop)
    })()

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
  }, [active, loop])

  // 表示するROMアイテム（上位4件）
  const topItems = romItems.slice(0, 4)

  return (
    <>
      {/* 骨格描画キャンバス */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full pointer-events-none"
        style={{ objectFit: 'contain' }}
      />

      {/* ステータス・ROMパネル */}
      {active && (
        <div className="absolute top-2 left-2 flex flex-col gap-1.5 pointer-events-none" style={{ maxWidth: '180px' }}>
          {/* ローディング */}
          {loading && (
            <div className="flex items-center gap-1.5 bg-black/70 text-white text-xs px-2.5 py-1.5 rounded-lg backdrop-blur-sm">
              <span className="animate-spin inline-block w-3 h-3 border-2 border-white border-t-transparent rounded-full" />
              AIモデル読込中...
            </div>
          )}

          {/* カメラ方向バッジ */}
          {!loading && (
            <div
              className="flex items-center gap-1 text-white text-xs font-bold px-2.5 py-1 rounded-full shadow"
              style={{ background: SIDE_COLOR[poseSide] + 'cc', backdropFilter: 'blur(4px)' }}
            >
              {SIDE_LABEL[poseSide]}
              <span className="text-white/70 font-normal ml-0.5">AI自動判定</span>
            </div>
          )}

          {/* 検出なし */}
          {!loading && !detected && (
            <div className="bg-black/60 text-gray-300 text-xs px-2.5 py-1 rounded-lg backdrop-blur-sm">
              人物を検出中...
            </div>
          )}

          {/* ROMアイテム */}
          {!loading && detected && topItems.map((item) => {
            const isNormal = item.value >= item.normalMin && item.value <= item.normalMax
            const color = isNormal ? '#22c55e' : item.value > item.normalMax * 1.5 ? '#ef4444' : '#f59e0b'
            const sideTag = item.side === 'L' ? '左' : item.side === 'R' ? '右' : ''
            return (
              <div
                key={item.key}
                className="bg-black/70 text-white text-xs px-2 py-1 rounded-lg backdrop-blur-sm leading-tight"
              >
                <span className="text-gray-300">{sideTag}{item.label.replace(/左|右/, '')}</span>
                <br />
                <span className="font-bold" style={{ color }}>{item.direction}</span>
                <span className="text-gray-400 ml-1 text-[10px]">
                  {isNormal ? '✓' : '△'}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </>
  )
}
