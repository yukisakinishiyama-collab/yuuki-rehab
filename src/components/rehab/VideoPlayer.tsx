'use client'

import { useRef, useState, useEffect, useCallback } from 'react'
import dynamic from 'next/dynamic'
import type { VideoComment, SavedAnnotation } from '@/types/rehab'
import {
  Play, Pause, SkipBack, SkipForward,
  Volume2, VolumeX, Maximize, PenLine, Scan, CircleDot, Crosshair, Box,
} from 'lucide-react'
import VideoAnnotationOverlay from './VideoAnnotationOverlay'
import MotionCaptureOverlay from './MotionCaptureOverlay'
import MarkerTrackerOverlay from './MarkerTrackerOverlay'
import MarkerSetupPanel from './MarkerSetupPanel'
import VirtualMarkerLayer from './VirtualMarkerLayer'
import type { MarkerConfig } from '@/lib/color-marker-tracker'
import type { ROMItem, Landmark } from '@/lib/pose-analyzer'

// Three.js は SSR 非対応のため dynamic import
const Skeleton3DView = dynamic(() => import('./Skeleton3DView'), { ssr: false })

const SPEEDS = [0.25, 0.5, 1, 1.5, 2]
const FRAME = 1 / 30

interface Props {
  src: string
  comments: VideoComment[]
  onTimeUpdate: (t: number) => void
  onSeekTo?: (fn: (t: number) => void) => void
  videoId: string
  caseId: string
  savedAnnotations: SavedAnnotation[]
  onAnnotationSaved: () => void
  videoOverlay?: React.ReactNode
  onROM?: (items: ROMItem[], videoTime: number) => void
}

export default function VideoPlayer({
  src, comments, onTimeUpdate, onSeekTo,
  videoId, caseId, savedAnnotations, onAnnotationSaved,
  videoOverlay, onROM,
}: Props) {
  const videoRef    = useRef<HTMLVideoElement>(null)
  const timelineRef = useRef<HTMLDivElement>(null)
  const [playing,    setPlaying]    = useState(false)
  const [currentTime,setCurrentTime]= useState(0)
  const [duration,   setDuration]   = useState(0)
  const [speed,      setSpeed]      = useState(1)
  const [muted,      setMuted]      = useState(false)
  const [volume,     setVolume]     = useState(1)
  const [annotationActive,    setAnnotationActive]    = useState(false)
  const [motionCapture,       setMotionCapture]       = useState(false)
  const [markerActive,        setMarkerActive]        = useState(false)
  const [showMarkerSetup,     setShowMarkerSetup]     = useState(false)
  const [markerConfigs,       setMarkerConfigs]       = useState<MarkerConfig[]>([])
  const [virtualMarkerActive, setVirtualMarkerActive] = useState(false)
  const [view3D,              setView3D]              = useState(false)
  const [worldLandmarks,      setWorldLandmarks]      = useState<Landmark[]>([])
  const [pose3dDetected,      setPose3dDetected]      = useState(false)
  const [latestROMItems,      setLatestROMItems]      = useState<ROMItem[]>([])
  const [scrubbing,  setScrubbing]  = useState(false)

  useEffect(() => {
    if (onSeekTo) {
      onSeekTo((t: number) => {
        if (videoRef.current) {
          videoRef.current.currentTime = t
          setCurrentTime(t)
        }
      })
    }
  }, [onSeekTo])

  const handleTimeUpdate = useCallback(() => {
    const t = videoRef.current?.currentTime ?? 0
    setCurrentTime(t)
    onTimeUpdate(t)
  }, [onTimeUpdate])

  function togglePlay() {
    const v = videoRef.current
    if (!v) return
    if (v.paused) { v.play(); setPlaying(true) }
    else          { v.pause(); setPlaying(false) }
  }

  function seekTo(t: number) {
    if (!videoRef.current) return
    videoRef.current.currentTime = Math.max(0, Math.min(duration, t))
  }

  function frame(delta: number) {
    if (!videoRef.current) return
    videoRef.current.pause()
    setPlaying(false)
    seekTo(currentTime + delta * FRAME)
  }

  function setPlaybackSpeed(s: number) {
    setSpeed(s)
    if (videoRef.current) videoRef.current.playbackRate = s
  }

  function toggleMute() {
    if (!videoRef.current) return
    videoRef.current.muted = !muted
    setMuted(!muted)
  }

  function handleVolumeChange(v: number) {
    setVolume(v)
    if (videoRef.current) videoRef.current.volume = v
  }

  function formatTime(s: number) {
    const m   = Math.floor(s / 60)
    const sec = Math.floor(s % 60)
    const ms  = Math.floor((s % 1) * 100)
    return `${m}:${String(sec).padStart(2,'0')}.${String(ms).padStart(2,'0')}`
  }

  function getTimelineRatio(clientX: number): number {
    const rect = timelineRef.current?.getBoundingClientRect()
    if (!rect) return 0
    return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
  }

  function handleTimelineDown(e: React.MouseEvent | React.TouchEvent) {
    e.preventDefault()
    setScrubbing(true)
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
    seekTo(getTimelineRatio(clientX) * duration)
  }

  const handleScrubMove = useCallback((e: MouseEvent | TouchEvent) => {
    if (!scrubbing) return
    e.preventDefault()
    const clientX = 'touches' in e
      ? (e as TouchEvent).touches[0]?.clientX ?? 0
      : (e as MouseEvent).clientX
    seekTo(getTimelineRatio(clientX) * duration)
  }, [scrubbing, duration]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleScrubUp = useCallback(() => { setScrubbing(false) }, [])

  useEffect(() => {
    if (!scrubbing) return
    window.addEventListener('mousemove', handleScrubMove)
    window.addEventListener('mouseup',   handleScrubUp)
    window.addEventListener('touchmove', handleScrubMove, { passive: false })
    window.addEventListener('touchend',  handleScrubUp)
    return () => {
      window.removeEventListener('mousemove', handleScrubMove)
      window.removeEventListener('mouseup',   handleScrubUp)
      window.removeEventListener('touchmove', handleScrubMove)
      window.removeEventListener('touchend',  handleScrubUp)
    }
  }, [scrubbing, handleScrubMove, handleScrubUp])

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0

  const markerColors: Record<string, string> = {
    problem:'#ef4444', improvement:'#3b82f6', risk:'#f97316',
    positive:'#22c55e', suggestion:'#a855f7',
  }

  // 3D ON 時は骨格も自動で ON
  function toggle3D() {
    const next = !view3D
    setView3D(next)
    if (next && !motionCapture) setMotionCapture(true)
  }

  return (
    <div className="bg-black rounded-xl overflow-hidden select-none">

      {/* ── 映像エリア ── */}
      <div className={`relative w-full ${view3D ? 'flex' : ''}`}>

        {/* 動画パネル */}
        <div
          className={`relative ${view3D ? 'w-1/2' : 'w-full aspect-video'}`}
          style={view3D ? { aspectRatio: '16/9' } : {}}
        >
          <video
            ref={videoRef}
            src={src}
            className="w-full h-full object-contain"
            onTimeUpdate={handleTimeUpdate}
            onLoadedMetadata={() => setDuration(videoRef.current?.duration ?? 0)}
            onEnded={() => setPlaying(false)}
            onClick={() => { if (!annotationActive) togglePlay() }}
          />

          <VideoAnnotationOverlay
            videoId={videoId}
            caseId={caseId}
            currentTime={currentTime}
            savedAnnotations={savedAnnotations}
            onSaved={onAnnotationSaved}
            active={annotationActive}
          />

          <MotionCaptureOverlay
            videoRef={videoRef}
            active={motionCapture}
            onROM={(items) => {
              setLatestROMItems(items)
              onROM?.(items, videoRef.current?.currentTime ?? 0)
            }}
            onWorld={(lms, det) => {
              setWorldLandmarks(lms)
              setPose3dDetected(det)
            }}
          />

          <MarkerTrackerOverlay videoRef={videoRef} active={markerActive} configs={markerConfigs} />

          {showMarkerSetup && (
            <MarkerSetupPanel
              configs={markerConfigs}
              onChange={(cfg) => { setMarkerConfigs(cfg); setMarkerActive(cfg.length > 0) }}
              onClose={() => setShowMarkerSetup(false)}
            />
          )}

          <VirtualMarkerLayer videoRef={videoRef} active={virtualMarkerActive} />

          {videoOverlay}

          {/* ── 動画右上フローティングボタン ── */}
          <div className="absolute top-2 right-2 flex flex-col gap-1.5 z-20">
            <button
              onClick={toggle3D}
              title={view3D ? '3Dビューを閉じる' : '3Dスケルトンビューを表示'}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold shadow-xl transition-all ${
                view3D
                  ? 'bg-indigo-500 text-white'
                  : 'bg-indigo-900/90 text-indigo-200 hover:bg-indigo-600 hover:text-white border border-indigo-400/60 backdrop-blur-sm'
              }`}
            >
              <Box className="w-4 h-4" />
              3D
            </button>

            <button
              onClick={() => setMotionCapture((v) => !v)}
              title={motionCapture ? '骨格表示をOFF' : '骨格リアルタイム表示をON'}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold shadow-xl transition-all ${
                motionCapture
                  ? 'bg-teal-500 text-white'
                  : 'bg-black/80 text-gray-300 hover:bg-teal-600 hover:text-white border border-white/20 backdrop-blur-sm'
              }`}
            >
              <Scan className="w-4 h-4" />
              骨格
            </button>
          </div>

          {view3D && (
            <div className="absolute bottom-2 left-2 bg-black/70 text-white text-[11px] px-2 py-1 rounded-lg pointer-events-none font-medium">
              🎥 オリジナル動画
            </div>
          )}
        </div>

        {/* 3Dスケルトンパネル */}
        {view3D && (
          <div className="w-1/2 bg-gray-950" style={{ aspectRatio: '16/9' }}>
            <Skeleton3DView
              worldLandmarks={worldLandmarks}
              romItems={latestROMItems}
              detected={pose3dDetected}
            />
          </div>
        )}
      </div>

      {/* ── コントロールバー ── */}
      <div className="bg-[#111827] px-4 py-3 space-y-2">

        {/* タイムライン */}
        <div className="relative">
          <div
            ref={timelineRef}
            className={`relative h-2.5 bg-gray-700 rounded-full group ${scrubbing ? 'cursor-grabbing' : 'cursor-pointer'}`}
            onMouseDown={handleTimelineDown}
            onTouchStart={handleTimelineDown}
          >
            <div
              className="absolute inset-y-0 left-0 bg-[#0d9488] rounded-full pointer-events-none"
              style={{ width: `${progress}%` }}
            />
            {comments.map((c) => {
              const pct = duration > 0 ? (c.timestamp / duration) * 100 : 0
              return (
                <div
                  key={c.id}
                  className="absolute top-1/2 w-2.5 h-2.5 rounded-full border-2 border-[#111827] z-10 pointer-events-none"
                  style={{
                    left: `${pct}%`,
                    backgroundColor: markerColors[c.type] ?? '#888',
                    transform: 'translate(-50%, -50%)',
                  }}
                />
              )
            })}
            {savedAnnotations.map((ann) => {
              const pct = duration > 0 ? (ann.timestamp / duration) * 100 : 0
              return (
                <div
                  key={ann.id}
                  className="absolute z-10 pointer-events-none"
                  style={{
                    left: `${pct}%`, top: '50%',
                    transform: 'translate(-50%, -50%) rotate(45deg)',
                    width: 8, height: 8,
                    backgroundColor: '#f59e0b',
                    border: '2px solid #111827', borderRadius: 1,
                  }}
                />
              )
            })}
            <div
              className={`absolute top-1/2 rounded-full bg-white shadow z-20 pointer-events-none transition-transform ${scrubbing ? 'scale-125' : 'w-3.5 h-3.5 group-hover:scale-110'}`}
              style={{ left: `${progress}%`, transform: `translate(-50%, -50%) ${scrubbing ? 'scale(1.25)' : ''}` }}
            />
          </div>
        </div>

        {/* ── 1行目: 再生コントロール ── */}
        <div className="flex items-center gap-2">
          <button onClick={() => frame(-1)} className="text-gray-400 hover:text-white p-1" title="1フレーム戻る">
            <SkipBack className="w-4 h-4" />
          </button>
          <button
            onClick={togglePlay}
            className="w-9 h-9 bg-[#0d9488] hover:bg-[#0b8276] rounded-full flex items-center justify-center text-white shadow-md flex-shrink-0"
          >
            {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
          </button>
          <button onClick={() => frame(1)} className="text-gray-400 hover:text-white p-1" title="1フレーム進む">
            <SkipForward className="w-4 h-4" />
          </button>
          <span className="text-gray-300 text-xs font-mono ml-1 flex-shrink-0">
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>
          <div className="flex-1" />
          <div className="flex items-center gap-0.5">
            {SPEEDS.map((s) => (
              <button
                key={s}
                onClick={() => setPlaybackSpeed(s)}
                className={`px-1.5 py-0.5 rounded text-xs font-medium ${speed === s ? 'bg-[#0d9488] text-white' : 'text-gray-400 hover:text-white'}`}
              >
                {s}x
              </button>
            ))}
          </div>
          <button onClick={toggleMute} className="text-gray-400 hover:text-white ml-1 flex-shrink-0">
            {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
          <input
            type="range" min={0} max={1} step={0.05}
            value={muted ? 0 : volume}
            onChange={(e) => handleVolumeChange(Number(e.target.value))}
            className="w-14 accent-[#0d9488] flex-shrink-0"
          />
          <button onClick={() => videoRef.current?.requestFullscreen()} className="text-gray-400 hover:text-white ml-1 flex-shrink-0">
            <Maximize className="w-4 h-4" />
          </button>
        </div>

        {/* ── 2行目: 解析ツール ── */}
        <div className="flex items-center gap-1.5 pt-1 border-t border-white/10">
          <span className="text-gray-500 text-[11px] mr-1">解析:</span>

          <button
            onClick={() => setMotionCapture((v) => !v)}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium ${motionCapture ? 'bg-teal-500 text-white' : 'bg-white/5 text-gray-400 hover:text-white hover:bg-white/10'}`}
          >
            <Scan className="w-3.5 h-3.5" />骨格
          </button>

          <button
            onClick={toggle3D}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold ${view3D ? 'bg-indigo-500 text-white' : 'bg-indigo-900/60 text-indigo-300 hover:bg-indigo-600 hover:text-white border border-indigo-600/50'}`}
          >
            <Box className="w-3.5 h-3.5" />3D
          </button>

          <button
            onClick={() => { if (markerConfigs.length === 0) setShowMarkerSetup(true); else setMarkerActive((v) => !v) }}
            onContextMenu={(e) => { e.preventDefault(); setShowMarkerSetup(true) }}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium ${markerActive ? 'bg-orange-500 text-white' : 'bg-white/5 text-gray-400 hover:text-white hover:bg-white/10'}`}
          >
            <CircleDot className="w-3.5 h-3.5" />
            {markerConfigs.length > 0 ? `マーカー(${markerConfigs.length})` : 'マーカー'}
          </button>

          <button
            onClick={() => setVirtualMarkerActive((v) => !v)}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium ${virtualMarkerActive ? 'bg-purple-500 text-white' : 'bg-white/5 text-gray-400 hover:text-white hover:bg-white/10'}`}
          >
            <Crosshair className="w-3.5 h-3.5" />仮想M
          </button>

          <button
            onClick={() => setAnnotationActive((v) => !v)}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium ${annotationActive ? 'bg-amber-500 text-white' : 'bg-white/5 text-gray-400 hover:text-white hover:bg-white/10'}`}
          >
            <PenLine className="w-3.5 h-3.5" />描き込み
          </button>
        </div>
      </div>
    </div>
  )
}
