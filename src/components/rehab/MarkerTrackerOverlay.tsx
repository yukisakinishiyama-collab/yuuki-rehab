'use client'

/**
 * MarkerTrackerOverlay
 * カラーシールを使ったリアルタイム関節角度追跡オーバーレイ。
 * VideoPlayer の映像エリア内に absolute 配置で重ねて使う。
 */

import { useRef, useEffect, useCallback } from 'react'
import type { MarkerConfig, MarkerAngle, DetectedMarker } from '@/lib/color-marker-tracker'
import { detectMarkers, calcMarkerAngles, drawMarkers } from '@/lib/color-marker-tracker'

interface Props {
  videoRef:   React.RefObject<HTMLVideoElement | null>
  active:     boolean
  configs:    MarkerConfig[]
  onAngles?:  (angles: MarkerAngle[], detected: DetectedMarker[]) => void
}

export default function MarkerTrackerOverlay({ videoRef, active, configs, onAngles }: Props) {
  const canvasRef   = useRef<HTMLCanvasElement>(null)
  const offscreenRef = useRef<HTMLCanvasElement | null>(null)
  const rafRef      = useRef<number | null>(null)

  const loop = useCallback(() => {
    const video   = videoRef.current
    const canvas  = canvasRef.current
    if (!video || !canvas) { rafRef.current = requestAnimationFrame(loop); return }

    // オフスクリーンキャンバス（色検出用）
    if (!offscreenRef.current) {
      offscreenRef.current = document.createElement('canvas')
    }

    const W = video.videoWidth  || 640
    const H = video.videoHeight || 360
    canvas.width  = W
    canvas.height = H

    const ctx = canvas.getContext('2d')
    if (!ctx) { rafRef.current = requestAnimationFrame(loop); return }
    ctx.clearRect(0, 0, W, H)

    if (!video.paused && !video.ended && video.readyState >= 2 && configs.length > 0) {
      const detected = detectMarkers(video, offscreenRef.current, configs)
      const angles   = calcMarkerAngles(detected)
      drawMarkers(ctx, detected, angles, W, H)
      onAngles?.(angles, detected)
    }

    rafRef.current = requestAnimationFrame(loop)
  }, [videoRef, configs, onAngles])

  useEffect(() => {
    if (!active) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      rafRef.current = null
      const ctx = canvasRef.current?.getContext('2d')
      if (ctx && canvasRef.current) ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height)
      return
    }
    rafRef.current = requestAnimationFrame(loop)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
  }, [active, loop])

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none"
      style={{ objectFit: 'contain' }}
    />
  )
}
