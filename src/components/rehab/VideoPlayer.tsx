'use client'

import { useRef, useState, useEffect, useCallback } from 'react'
import type { VideoComment, SavedAnnotation } from '@/types/rehab'
import {
  Play, Pause, SkipBack, SkipForward,
  Volume2, VolumeX, Maximize, PenLine,
} from 'lucide-react'
import VideoAnnotationOverlay from './VideoAnnotationOverlay'

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
}

export default function VideoPlayer({
  src, comments, onTimeUpdate, onSeekTo,
  videoId, caseId, savedAnnotations, onAnnotationSaved,
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [playing, setPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [speed, setSpeed] = useState(1)
  const [muted, setMuted] = useState(false)
  const [volume, setVolume] = useState(1)
  const [annotationActive, setAnnotationActive] = useState(false)

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
    else { v.pause(); setPlaying(false) }
  }

  function seek(t: number) {
    if (!videoRef.current) return
    videoRef.current.currentTime = Math.max(0, Math.min(duration, t))
  }

  function frame(delta: number) {
    if (!videoRef.current) return
    videoRef.current.pause()
    setPlaying(false)
    seek(currentTime + delta * FRAME)
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
    const m = Math.floor(s / 60)
    const sec = Math.floor(s % 60)
    const ms = Math.floor((s % 1) * 100)
    return `${m}:${String(sec).padStart(2, '0')}.${String(ms).padStart(2, '0')}`
  }

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0

  // Comment marker positions
  const markers = comments.map((c) => ({
    id: c.id,
    type: c.type,
    pct: duration > 0 ? (c.timestamp / duration) * 100 : 0,
  }))

  const markerColors: Record<string, string> = {
    problem: '#ef4444',
    improvement: '#3b82f6',
    risk: '#f97316',
    positive: '#22c55e',
    suggestion: '#a855f7',
  }

  return (
    <div className="bg-black rounded-xl overflow-hidden select-none">
      {/* Video + overlay wrapper */}
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
        <VideoAnnotationOverlay
          videoId={videoId}
          caseId={caseId}
          currentTime={currentTime}
          savedAnnotations={savedAnnotations}
          onSaved={onAnnotationSaved}
          active={annotationActive}
        />
      </div>

      {/* Controls */}
      <div className="bg-[#111827] px-4 py-3 space-y-2">
        {/* Timeline */}
        <div className="relative">
          <div
            className="relative h-2 bg-gray-700 rounded-full cursor-pointer group"
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect()
              const pct = (e.clientX - rect.left) / rect.width
              seek(pct * duration)
            }}
          >
            <div
              className="absolute inset-y-0 left-0 bg-[#0d9488] rounded-full"
              style={{ width: `${progress}%` }}
            />
            {/* Comment markers */}
            {markers.map((m) => (
              <div
                key={m.id}
                className="absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full border-2 border-[#111827] z-10"
                style={{
                  left: `${m.pct}%`,
                  backgroundColor: markerColors[m.type] ?? '#888',
                  transform: 'translate(-50%, -50%)',
                }}
                title={m.type}
              />
            ))}
            {/* Annotation markers (diamonds) */}
            {savedAnnotations.map((ann) => {
              const pct = duration > 0 ? (ann.timestamp / duration) * 100 : 0
              return (
                <div
                  key={ann.id}
                  className="absolute z-10 text-amber-400 leading-none"
                  style={{
                    left: `${pct}%`,
                    top: '50%',
                    transform: 'translate(-50%, -50%) rotate(45deg)',
                    width: 8,
                    height: 8,
                    backgroundColor: '#f59e0b',
                    border: '2px solid #111827',
                    borderRadius: 1,
                  }}
                  title={ann.label}
                />
              )
            })}
            {/* Thumb */}
            <div
              className="absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full bg-white shadow group-hover:scale-110 transition-transform z-20"
              style={{ left: `${progress}%`, transform: 'translate(-50%, -50%)' }}
            />
          </div>
        </div>

        {/* Buttons row */}
        <div className="flex items-center gap-2">
          {/* Frame back */}
          <button
            onClick={() => frame(-1)}
            className="text-gray-400 hover:text-white transition-colors p-1"
            title="1フレーム戻る"
          >
            <SkipBack className="w-4 h-4" />
          </button>

          {/* Play/Pause */}
          <button
            onClick={togglePlay}
            className="w-8 h-8 bg-[#0d9488] hover:bg-[#0b8276] rounded-full flex items-center justify-center text-white transition-colors"
          >
            {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
          </button>

          {/* Frame forward */}
          <button
            onClick={() => frame(1)}
            className="text-gray-400 hover:text-white transition-colors p-1"
            title="1フレーム進む"
          >
            <SkipForward className="w-4 h-4" />
          </button>

          {/* Time */}
          <span className="text-gray-300 text-xs font-mono ml-1">
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>

          <div className="flex-1" />

          {/* Speed */}
          <div className="flex items-center gap-1">
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

          {/* Volume */}
          <button onClick={toggleMute} className="text-gray-400 hover:text-white ml-2 transition-colors">
            {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={muted ? 0 : volume}
            onChange={(e) => handleVolumeChange(Number(e.target.value))}
            className="w-16 accent-[#0d9488]"
          />

          {/* Annotation toggle */}
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

          {/* Fullscreen */}
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
