'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import type { CaseVideo } from '@/types/rehab'
import { MOVEMENT_TYPE_LABELS, VIDEO_DIRECTION_LABELS } from '@/types/rehab'
import { getVideoUrl, saveVideoUrl } from '@/lib/rehab-store'
import { getBlobUrlFromDB } from '@/lib/video-db'
import {
  Play, Pause, RotateCcw, Link2, Link2Off,
  ChevronLeft, ChevronRight, Volume2, VolumeX,
} from 'lucide-react'

interface Props {
  videos: CaseVideo[]
}

async function loadVideoSrc(videoId: string): Promise<string | null> {
  const cached = getVideoUrl(videoId)
  if (cached) return cached
  const url = await getBlobUrlFromDB(videoId)
  if (url) saveVideoUrl(videoId, url)
  return url
}

interface PlayerState {
  playing: boolean
  currentTime: number
  duration: number
  muted: boolean
  speed: number
}

const SPEEDS = [0.25, 0.5, 1, 1.5, 2]

export default function VideoCompare({ videos }: Props) {
  const [leftId, setLeftId] = useState(videos[0]?.id ?? '')
  const [rightId, setRightId] = useState(videos[1]?.id ?? videos[0]?.id ?? '')
  const [leftSrc, setLeftSrc] = useState<string | null>(null)
  const [rightSrc, setRightSrc] = useState<string | null>(null)
  const [synced, setSynced] = useState(false)
  const [leftState, setLeftState] = useState<PlayerState>({ playing: false, currentTime: 0, duration: 0, muted: true, speed: 1 })
  const [rightState, setRightState] = useState<PlayerState>({ playing: false, currentTime: 0, duration: 0, muted: true, speed: 1 })
  const leftRef = useRef<HTMLVideoElement>(null)
  const rightRef = useRef<HTMLVideoElement>(null)
  const syncingRef = useRef(false)

  useEffect(() => {
    if (leftId) loadVideoSrc(leftId).then(setLeftSrc)
  }, [leftId])

  useEffect(() => {
    if (rightId) loadVideoSrc(rightId).then(setRightSrc)
  }, [rightId])

  // Sync utilities
  const syncRight = useCallback((time: number) => {
    if (!synced || !rightRef.current || syncingRef.current) return
    syncingRef.current = true
    rightRef.current.currentTime = time
    setTimeout(() => { syncingRef.current = false }, 50)
  }, [synced])

  const syncLeft = useCallback((time: number) => {
    if (!synced || !leftRef.current || syncingRef.current) return
    syncingRef.current = true
    leftRef.current.currentTime = time
    setTimeout(() => { syncingRef.current = false }, 50)
  }, [synced])

  // Left video handlers
  function handleLeftPlay() {
    setLeftState(s => ({ ...s, playing: true }))
    if (synced && rightRef.current) {
      rightRef.current.currentTime = leftRef.current?.currentTime ?? 0
      rightRef.current.play()
    }
  }
  function handleLeftPause() {
    setLeftState(s => ({ ...s, playing: false }))
    if (synced && rightRef.current) rightRef.current.pause()
  }
  function handleLeftTimeUpdate() {
    if (!leftRef.current) return
    setLeftState(s => ({ ...s, currentTime: leftRef.current!.currentTime }))
    if (synced && !syncingRef.current) syncRight(leftRef.current.currentTime)
  }
  function handleLeftLoaded() {
    if (!leftRef.current) return
    setLeftState(s => ({ ...s, duration: leftRef.current!.duration }))
  }

  // Right video handlers
  function handleRightPlay() {
    setRightState(s => ({ ...s, playing: true }))
    if (synced && leftRef.current) {
      leftRef.current.currentTime = rightRef.current?.currentTime ?? 0
      leftRef.current.play()
    }
  }
  function handleRightPause() {
    setRightState(s => ({ ...s, playing: false }))
    if (synced && leftRef.current) leftRef.current.pause()
  }
  function handleRightTimeUpdate() {
    if (!rightRef.current) return
    setRightState(s => ({ ...s, currentTime: rightRef.current!.currentTime }))
    if (synced && !syncingRef.current) syncLeft(rightRef.current.currentTime)
  }
  function handleRightLoaded() {
    if (!rightRef.current) return
    setRightState(s => ({ ...s, duration: rightRef.current!.duration }))
  }

  function togglePlay(side: 'left' | 'right') {
    const vid = side === 'left' ? leftRef.current : rightRef.current
    if (!vid) return
    if (vid.paused) { vid.play() } else { vid.pause() }
  }

  function seek(side: 'left' | 'right', delta: number) {
    const vid = side === 'left' ? leftRef.current : rightRef.current
    if (!vid) return
    const newTime = Math.max(0, Math.min(vid.duration, vid.currentTime + delta))
    vid.currentTime = newTime
    if (synced) {
      const other = side === 'left' ? rightRef.current : leftRef.current
      if (other) other.currentTime = newTime
    }
  }

  function reset(side: 'left' | 'right') {
    const vid = side === 'left' ? leftRef.current : rightRef.current
    if (!vid) return
    vid.pause(); vid.currentTime = 0
    if (synced) {
      const other = side === 'left' ? rightRef.current : leftRef.current
      if (other) { other.pause(); other.currentTime = 0 }
    }
  }

  function setSpeed(side: 'left' | 'right', speed: number) {
    const vid = side === 'left' ? leftRef.current : rightRef.current
    if (!vid) return
    vid.playbackRate = speed
    if (side === 'left') setLeftState(s => ({ ...s, speed }))
    else setRightState(s => ({ ...s, speed }))
    if (synced) {
      const other = side === 'left' ? rightRef.current : leftRef.current
      if (other) other.playbackRate = speed
    }
  }

  function toggleMute(side: 'left' | 'right') {
    const vid = side === 'left' ? leftRef.current : rightRef.current
    if (!vid) return
    vid.muted = !vid.muted
    if (side === 'left') setLeftState(s => ({ ...s, muted: vid.muted }))
    else setRightState(s => ({ ...s, muted: vid.muted }))
  }

  function handleSeekBar(side: 'left' | 'right', value: number) {
    const vid = side === 'left' ? leftRef.current : rightRef.current
    const dur = side === 'left' ? leftState.duration : rightState.duration
    if (!vid || !dur) return
    const newTime = value * dur
    vid.currentTime = newTime
    if (synced) {
      const other = side === 'left' ? rightRef.current : leftRef.current
      if (other) other.currentTime = newTime
    }
  }

  function formatTime(s: number) {
    const m = Math.floor(s / 60)
    const sec = Math.floor(s % 60)
    return `${m}:${String(sec).padStart(2, '0')}`
  }

  if (videos.length === 0) {
    return (
      <div className="text-center py-16 text-gray-400">
        <p className="text-sm">動画が登録されていません</p>
        <p className="text-xs mt-1">動画アップロードタブから動画を登録してください</p>
      </div>
    )
  }

  if (videos.length === 1) {
    return (
      <div className="text-center py-16 text-gray-400">
        <p className="text-sm">比較には2本以上の動画が必要です</p>
        <p className="text-xs mt-1">動画アップロードタブからもう1本登録してください</p>
      </div>
    )
  }

  const videoOptions = videos.map(v => ({ id: v.id, label: v.label, type: v.movementType, dir: v.direction }))

  return (
    <div className="space-y-4">
      {/* Sync toggle */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <h2 className="font-semibold text-gray-900 text-sm">動画比較</h2>
          <span className="text-xs text-gray-400">2本の動画を並べて分析</span>
        </div>
        <button
          onClick={() => setSynced(!synced)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
            synced
              ? 'bg-[#1e3a5f] text-white border-[#1e3a5f] shadow-sm'
              : 'bg-white text-gray-600 border-gray-200 hover:border-[#0d9488] hover:text-[#0d9488]'
          }`}
        >
          {synced ? <Link2 className="w-3.5 h-3.5" /> : <Link2Off className="w-3.5 h-3.5" />}
          {synced ? '同期ON — 連動して再生' : '同期OFF — 独立再生'}
        </button>
      </div>

      {/* Two-column video grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {(['left', 'right'] as const).map((side) => {
          const videoId = side === 'left' ? leftId : rightId
          const src = side === 'left' ? leftSrc : rightSrc
          const state = side === 'left' ? leftState : rightState
          const vidRef = side === 'left' ? leftRef : rightRef
          const setId = side === 'left' ? setLeftId : setRightId
          const label = side === 'left' ? 'A' : 'B'
          const accentColor = side === 'left' ? 'from-[#1e3a5f]' : 'from-[#0d6e68]'

          const selectedVideo = videos.find(v => v.id === videoId)

          return (
            <div key={side} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              {/* Video header */}
              <div className={`bg-gradient-to-r ${accentColor} to-[#0d9488]/80 px-3 py-2 flex items-center gap-2`}>
                <span className="w-6 h-6 bg-white/20 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0">{label}</span>
                <select
                  value={videoId}
                  onChange={(e) => setId(e.target.value)}
                  className="flex-1 bg-transparent text-white text-xs font-medium focus:outline-none cursor-pointer"
                >
                  {videoOptions.map(v => (
                    <option key={v.id} value={v.id} className="text-gray-900 bg-white">
                      {v.label} ({MOVEMENT_TYPE_LABELS[v.type]} · {VIDEO_DIRECTION_LABELS[v.dir]})
                    </option>
                  ))}
                </select>
              </div>

              {/* Video element */}
              <div className="relative bg-black aspect-video">
                {src ? (
                  <video
                    ref={vidRef}
                    src={src}
                    className="w-full h-full object-contain"
                    muted
                    playsInline
                    onPlay={side === 'left' ? handleLeftPlay : handleRightPlay}
                    onPause={side === 'left' ? handleLeftPause : handleRightPause}
                    onTimeUpdate={side === 'left' ? handleLeftTimeUpdate : handleRightTimeUpdate}
                    onLoadedMetadata={side === 'left' ? handleLeftLoaded : handleRightLoaded}
                  />
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-white/50 gap-2">
                    <div className="text-3xl">🎥</div>
                    <p className="text-xs">動画を読み込み中...</p>
                  </div>
                )}

                {/* Time overlay */}
                {state.duration > 0 && (
                  <div className="absolute bottom-2 right-2 bg-black/60 text-white text-xs px-1.5 py-0.5 rounded font-mono">
                    {formatTime(state.currentTime)} / {formatTime(state.duration)}
                  </div>
                )}
              </div>

              {/* Seek bar */}
              <div className="px-3 pt-2">
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.001}
                  value={state.duration ? state.currentTime / state.duration : 0}
                  onChange={(e) => handleSeekBar(side, parseFloat(e.target.value))}
                  className="w-full h-1.5 accent-[#0d9488] cursor-pointer"
                />
              </div>

              {/* Controls */}
              <div className="px-3 py-2 flex items-center gap-1.5 flex-wrap">
                {/* Play/Pause */}
                <button
                  onClick={() => togglePlay(side)}
                  className="w-8 h-8 rounded-lg bg-[#1e3a5f] hover:bg-[#0d9488] text-white flex items-center justify-center transition-colors"
                >
                  {state.playing
                    ? <Pause className="w-3.5 h-3.5" />
                    : <Play className="w-3.5 h-3.5 ml-0.5" />}
                </button>

                {/* Frame step */}
                <button
                  onClick={() => seek(side, -1/30)}
                  title="-1フレーム"
                  className="w-7 h-7 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 flex items-center justify-center transition-colors"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => seek(side, 1/30)}
                  title="+1フレーム"
                  className="w-7 h-7 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 flex items-center justify-center transition-colors"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>

                {/* Reset */}
                <button
                  onClick={() => reset(side)}
                  className="w-7 h-7 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 flex items-center justify-center transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>

                {/* Mute */}
                <button
                  onClick={() => toggleMute(side)}
                  className="w-7 h-7 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 flex items-center justify-center transition-colors"
                >
                  {state.muted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                </button>

                {/* Speed */}
                <div className="ml-auto flex items-center gap-1">
                  {SPEEDS.map(s => (
                    <button
                      key={s}
                      onClick={() => setSpeed(side, s)}
                      className={`text-[10px] px-1.5 py-0.5 rounded font-medium transition-colors ${
                        state.speed === s
                          ? 'bg-[#0d9488] text-white'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {s}x
                    </button>
                  ))}
                </div>
              </div>

              {/* Video info chips */}
              {selectedVideo && (
                <div className="px-3 pb-3 flex gap-1.5 flex-wrap">
                  <span className="text-[10px] px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full">
                    {MOVEMENT_TYPE_LABELS[selectedVideo.movementType]}
                  </span>
                  <span className="text-[10px] px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full">
                    {VIDEO_DIRECTION_LABELS[selectedVideo.direction]}
                  </span>
                  <span className="text-[10px] px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full">
                    {selectedVideo.uploadedAt.slice(0, 10)}
                  </span>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Sync indicator */}
      {synced && (
        <div className="flex items-center justify-center gap-2 text-xs text-[#0d9488] bg-teal-50 border border-teal-200 rounded-lg py-2">
          <Link2 className="w-3.5 h-3.5" />
          同期モード：片方を操作すると、もう一方も連動します
        </div>
      )}
    </div>
  )
}
