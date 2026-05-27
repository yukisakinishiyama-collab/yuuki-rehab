'use client'

import { useRef, useState, useEffect, useCallback } from 'react'
import type { VideoComment, SavedAnnotation } from '@/types/rehab'
import {
  Play, Pause, SkipBack, SkipForward,
  Volume2, VolumeX, Maximize, PenLine, Scan, CircleDot, Crosshair,
} from 'lucide-react'
import VideoAnnotationOverlay from './VideoAnnotationOverlay'
import MotionCaptureOverlay from './MotionCaptureOverlay'
import MarkerTrackerOverlay from './MarkerTrackerOverlay'
import MarkerSetupPanel from './MarkerSetupPanel'
import VirtualMarkerLayer from './VirtualMarkerLayer'
import type { MarkerConfig } from '@/lib/color-marker-tracker'
import type { ROMItem } from '@/lib/pose-analyzer'

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
  /** 映像エリア上に重ねる追加オーバーレイ（PersonMarkerLayerなど） */
  videoOverlay?: React.ReactNode
  /** MediaPipe ROMデータ受け取りコールバック（動的ROM計測用） */
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
  const [annotationActive,   setAnnotationActive]   = useState(false)
  const [motionCapture,      setMotionCapture]      = useState(false)
  const [markerActive,       setMarkerActive]       = useState(false)
  const [showMarkerSetup,    setShowMarkerSetup]    = useState(false)
  const [markerConfigs,      setMarkerConfigs]      = useState<MarkerConfig[]>([])
  const [virtualMarkerActive, setVirtualMarkerActive] = useState(false)
  const [scrubbing,  setScrubbing]  = useState(false)

  // Expose seekTo for parent
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

  // ── タイムライン：クリック＋ドラッグ両対応 ──────────────────────────
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

  const handleScrubUp = useCallback(() => {
    setScrubbing(false)
  }, [])

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

  return (
    <div className="bg-black rounded-xl overflow-hidden select-none">
      {/* ── 映像エリア ── */}
      <div className="relative aspect-video w-full">
        <video
          ref={videoRef}
          src={src}
          className="w-full h-full object-contain"
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={() => setDuration(videoRef.current?.duration ?? 0)}
          onEnded={() => setPlaying(false)}
          onClick={() => { if (!annotationActive) togglePlay() }}
        />

        {/* アノテーションオーバーレイ */}
        <VideoAnnotationOverlay
          videoId={videoId}
          caseId={caseId}
          currentTime={currentTime}
          savedAnnotations={savedAnnotations}
          onSaved={onAnnotationSaved}
          active={annotationActive}
        />

        {/* MediaPipeリアルタイム骨格 */}
        <MotionCaptureOverlay
          videoRef={videoRef}
          active={motionCapture}
          onROM={onROM ? (items) => onROM(items, videoRef.current?.currentTime ?? 0) : undefined}
        />

        {/* カラーマーカー追跡 */}
        <MarkerTrackerOverlay videoRef={videoRef} active={markerActive} configs={markerConfigs} />

        {/* マーカー設定パネル */}
        {showMarkerSetup && (
          <MarkerSetupPanel
            configs={markerConfigs}
            onChange={(cfg) => { setMarkerConfigs(cfg); setMarkerActive(cfg.length > 0) }}
            onClose={() => setShowMarkerSetup(false)}
          />
        )}

        {/* 仮想マーカー追跡（クリック配置 + テンプレートマッチング） */}
        <VirtualMarkerLayer videoRef={videoRef} active={virtualMarkerActive} />

        {/* 外部から渡された追加オーバーレイ（PersonMarkerLayerなど） */}
        {videoOverlay}
      </div>

      {/* ── コントロールバー ── */}
      <div className="bg-[#111827] px-4 py-3 space-y-2">
        {/* タイムライン（クリック＋ドラッグシーク） */}
        <div className="relative">
          <div
            ref={timelineRef}
            className={`relative h-2.5 bg-gray-700 rounded-full group ${scrubbing ? 'cursor-grabbing' : 'cursor-pointer'}`}
            onMouseDown={handleTimelineDown}
            onTouchStart={handleTimelineDown}
          >
            {/* 進捗バー */}
            <div
              className="absolute inset-y-0 left-0 bg-[#0d9488] rounded-full pointer-events-none"
              style={{ width: `${progress}%` }}
            />
            {/* コメントマーカー */}
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
            {/* アノテーションマーカー */}
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
            {/* サムネイル（ドラッグ中は大きく） */}
            <div
              className={`absolute top-1/2 rounded-full bg-white shadow z-20 pointer-events-none transition-transform ${scrubbing ? 'w-4.5 h-4.5 scale-125' : 'w-3.5 h-3.5 group-hover:scale-110'}`}
              style={{ left: `${progress}%`, transform: `translate(-50%, -50%) ${scrubbing ? 'scale(1.25)' : ''}` }}
            />
          </div>
        </div>

        {/* ボタン行 */}
        <div className="flex items-center gap-2">
          {/* フレーム戻る */}
          <button
            onClick={() => frame(-1)}
            className="text-gray-400 hover:text-white transition-colors p-1"
            title="1フレーム戻る (←)"
          >
            <SkipBack className="w-4 h-4" />
          </button>

          {/* 再生/一時停止 */}
          <button
            onClick={togglePlay}
            className="w-9 h-9 bg-[#0d9488] hover:bg-[#0b8276] rounded-full flex items-center justify-center text-white transition-colors shadow-md"
          >
            {playing
              ? <Pause className="w-4 h-4" />
              : <Play  className="w-4 h-4 ml-0.5" />}
          </button>

          {/* フレーム進む */}
          <button
            onClick={() => frame(1)}
            className="text-gray-400 hover:text-white transition-colors p-1"
            title="1フレーム進む (→)"
          >
            <SkipForward className="w-4 h-4" />
          </button>

          {/* 時間表示 */}
          <span className="text-gray-300 text-xs font-mono ml-1">
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>

          <div className="flex-1" />

          {/* 再生速度 */}
          <div className="flex items-center gap-0.5">
            {SPEEDS.map((s) => (
              <button
                key={s}
                onClick={() => setPlaybackSpeed(s)}
                className={`px-1.5 py-0.5 rounded text-xs font-medium transition-colors ${
                  speed === s ? 'bg-[#0d9488] text-white' : 'text-gray-400 hover:text-white'
                }`}
              >
                {s}x
              </button>
            ))}
          </div>

          {/* 音量 */}
          <button onClick={toggleMute} className="text-gray-400 hover:text-white ml-2 transition-colors">
            {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
          <input
            type="range" min={0} max={1} step={0.05}
            value={muted ? 0 : volume}
            onChange={(e) => handleVolumeChange(Number(e.target.value))}
            className="w-16 accent-[#0d9488]"
          />

          {/* MediaPipe骨格トグル */}
          <button
            onClick={() => setMotionCapture((v) => !v)}
            title={motionCapture ? '骨格表示をOFF' : '骨格リアルタイム表示をON'}
            className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium ml-1 transition-colors ${
              motionCapture ? 'bg-teal-500 text-white' : 'text-gray-400 hover:text-white hover:bg-white/10'
            }`}
          >
            <Scan className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">骨格</span>
          </button>

          {/* カラーマーカートグル */}
          <button
            onClick={() => {
              if (markerConfigs.length === 0) {
                setShowMarkerSetup(true)   // 未設定なら設定画面へ
              } else {
                setMarkerActive((v) => !v) // 設定済みならON/OFF
              }
            }}
            onContextMenu={(e) => { e.preventDefault(); setShowMarkerSetup(true) }} // 右クリックで設定画面
            title={markerActive ? 'マーカー追跡をOFF（右クリックで設定）' : 'カラーマーカー追跡をON（右クリックで設定）'}
            className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium ml-1 transition-colors ${
              markerActive ? 'bg-orange-500 text-white' : 'text-gray-400 hover:text-white hover:bg-white/10'
            }`}
          >
            <CircleDot className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">
              {markerConfigs.length > 0 ? `マーカー(${markerConfigs.length})` : 'マーカー'}
            </span>
          </button>

          {/* 仮想マーカー追跡トグル */}
          <button
            onClick={() => setVirtualMarkerActive((v) => !v)}
            title={virtualMarkerActive ? '仮想マーカー追跡をOFF' : '動画上にマーカーを配置して追跡（一時停止してクリック）'}
            className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium ml-1 transition-colors ${
              virtualMarkerActive
                ? 'bg-purple-500 text-white'
                : 'text-gray-400 hover:text-white hover:bg-white/10'
            }`}
          >
            <Crosshair className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">仮想M</span>
          </button>

          {/* 描き込みトグル */}
          <button
            onClick={() => setAnnotationActive((v) => !v)}
            title={annotationActive ? '描き込みモードをOFF' : '描き込みモードをON'}
            className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium ml-1 transition-colors ${
              annotationActive
                ? 'bg-amber-500 text-white'
                : 'text-gray-400 hover:text-white hover:bg-white/10'
            }`}
          >
            <PenLine className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">描き込み</span>
          </button>

          {/* フルスクリーン */}
          <button
            onClick={() => videoRef.current?.requestFullscreen()}
            className="text-gray-400 hover:text-white ml-1 transition-colors"
          >
            <Maximize className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
