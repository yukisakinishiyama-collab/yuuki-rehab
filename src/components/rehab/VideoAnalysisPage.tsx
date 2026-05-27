'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import Link from 'next/link'
import {
  getCase, getVideoUrl, getAnnotations, saveVideoUrl,
  getComments, getPersonMarker,
} from '@/lib/rehab-store'
import { getBlobUrlFromDB } from '@/lib/video-db'
import type { RehabCase, CaseVideo, SavedAnnotation, VideoComment, PersonMarker } from '@/types/rehab'
import { MOVEMENT_TYPE_LABELS, VIDEO_DIRECTION_LABELS } from '@/types/rehab'
import VideoPlayer from './VideoPlayer'
import CommentPanel from './CommentPanel'
import EvaluationChecklist from './EvaluationChecklist'
import SpecialistReviewPanel from './SpecialistReviewPanel'
import SpecialistChat from './SpecialistChat'
import PersonMarkerLayer from './PersonMarkerLayer'
import DynamicROMPanel from './DynamicROMPanel'
import { ArrowLeft, Layers, MessageSquare, ClipboardList, Info, Users, MessageSquareDot, Activity } from 'lucide-react'
import type { ROMItem } from '@/lib/pose-analyzer'

interface Props {
  caseId: string
  videoId: string
}

type Panel = 'comments' | 'chat' | 'specialists' | 'evaluation' | 'annotation' | 'rom'

export default function VideoAnalysisPage({ caseId, videoId }: Props) {
  const [case_, setCase] = useState<RehabCase | null>(null)
  const [video, setVideo] = useState<CaseVideo | null>(null)
  const [videoSrc, setVideoSrc] = useState<string | null>(null)
  const [currentTime, setCurrentTime] = useState(0)
  const [comments, setComments] = useState<VideoComment[]>([])
  const [savedAnnotations, setSavedAnnotations] = useState<SavedAnnotation[]>([])
  const [panel, setPanel] = useState<Panel>('rom')
  const [personMarker, setPersonMarker] = useState<PersonMarker | null>(null)
  const [latestROM,    setLatestROM]    = useState<ROMItem[]>([])
  const [motionActive, setMotionActive] = useState(false)
  const seekRef = useRef<((t: number) => void) | null>(null)

  useEffect(() => {
    const c = getCase(caseId)
    setCase(c ?? null)
    if (c) {
      const v = c.videos.find((x) => x.id === videoId)
      setVideo(v ?? null)

      // まずキャッシュ → なければIndexedDB
      const cached = getVideoUrl(videoId)
      if (cached) {
        setVideoSrc(cached)
      } else {
        getBlobUrlFromDB(videoId).then((url) => {
          if (url) { saveVideoUrl(videoId, url); setVideoSrc(url) }
        })
      }
    }
    loadComments()
    loadAnnotations()
    setPersonMarker(getPersonMarker(videoId))
  }, [caseId, videoId])

  function loadComments() { setComments(getComments(videoId)) }
  function loadAnnotations() { setSavedAnnotations(getAnnotations(videoId)) }

  const handleSeek = useCallback((t: number) => { seekRef.current?.(t) }, [])

  if (!case_ || !video) {
    return (
      <div className="text-center py-20 text-gray-400">
        <p>動画が見つかりません</p>
        <Link href={`/cases/${caseId}`} className="text-[#0d9488] hover:underline text-sm mt-2 inline-block">
          症例詳細へ戻る
        </Link>
      </div>
    )
  }

  const PANELS: Array<{ key: Panel; icon: React.ElementType; label: string }> = [
    { key: 'rom',        icon: Activity,         label: '📐 ROM' },
    { key: 'comments',   icon: MessageSquare,    label: 'コメント' },
    { key: 'chat',       icon: MessageSquareDot, label: 'チャット' },
    { key: 'specialists',icon: Users,            label: '専門家' },
    { key: 'evaluation', icon: ClipboardList,    label: '評価' },
    { key: 'annotation', icon: Layers,           label: '描き込み' },
  ]

  return (
    <div className="max-w-screen-xl mx-auto">
      {/* Breadcrumb */}
      <div className="mb-4 flex items-center gap-2 text-sm text-gray-500">
        <Link href="/cases" className="hover:text-gray-800">症例一覧</Link>
        <span>/</span>
        <Link href={`/cases/${caseId}`} className="hover:text-gray-800">
          {case_.patientName ?? case_.anonymousId}
        </Link>
        <span>/</span>
        <span className="text-gray-800 font-medium truncate">{video.label}</span>
      </div>

      {/* Video info bar */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-4 py-3 mb-4 flex items-center gap-4 flex-wrap">
        <Link href={`/cases/${caseId}`} className="text-gray-400 hover:text-gray-700">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <div className="font-semibold text-gray-900">{video.label}</div>
          <div className="flex items-center gap-3 text-xs text-gray-500 mt-0.5">
            <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full">
              {MOVEMENT_TYPE_LABELS[video.movementType]}
            </span>
            <span>{VIDEO_DIRECTION_LABELS[video.direction]}</span>
            <span>{video.uploadedAt.slice(0, 10)}</span>
            {personMarker && (
              <span className="flex items-center gap-1 px-2 py-0.5 bg-yellow-50 text-yellow-700 rounded-full border border-yellow-200">
                🎯 対象者マーカー設定済み
              </span>
            )}
          </div>
        </div>
        <div className="ml-auto flex items-center gap-1 text-xs text-gray-500">
          <Info className="w-3.5 h-3.5" />
          {case_.diagnosis} · {case_.patientName ?? case_.anonymousId}
        </div>
      </div>

      {/* Main layout: video + panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Video column */}
        <div className="lg:col-span-2 space-y-4">
          {videoSrc ? (
            <VideoPlayer
              src={videoSrc}
              comments={comments}
              onTimeUpdate={setCurrentTime}
              onSeekTo={(fn) => { seekRef.current = fn }}
              videoId={videoId}
              caseId={caseId}
              savedAnnotations={savedAnnotations}
              onAnnotationSaved={loadAnnotations}
              onROM={(items, _t) => {
                setLatestROM(items)
                // 骨格がアクティブかどうかを推定（itemsが来ていればactive）
                if (items.length > 0) setMotionActive(true)
              }}
              videoOverlay={
                <PersonMarkerLayer
                  videoId={videoId}
                  marker={personMarker}
                  onMarkerChange={setPersonMarker}
                />
              }
            />
          ) : (
            <div className="aspect-video bg-gradient-to-br from-[#1e3a5f] to-[#0d2a47] rounded-xl flex flex-col items-center justify-center text-white px-6 text-center">
              <div className="text-4xl mb-3">🎥</div>
              <p className="text-sm font-medium">動画を読み込み中...</p>
              <p className="text-xs text-blue-200 mt-1 leading-relaxed max-w-xs">
                動画が表示されない場合は再アップロードしてください
              </p>
              <div className="flex gap-2 mt-4">
                <Link
                  href={`/cases/${caseId}?tab=upload`}
                  className="px-4 py-2 bg-[#0d9488] rounded-lg text-sm hover:bg-[#0b8276] transition-colors"
                >
                  ↑ 動画をアップロード
                </Link>
                <Link
                  href={`/cases/${caseId}`}
                  className="px-4 py-2 bg-white/10 rounded-lg text-sm hover:bg-white/20 transition-colors"
                >
                  症例詳細へ
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* Panel column */}
        <div
          className="flex flex-col bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden"
          style={{ minHeight: '500px', maxHeight: '85vh', position: 'sticky', top: '1rem' }}
        >
          {/* Panel tabs — scrollable on small screens */}
          <div className="flex border-b border-gray-100 overflow-x-auto">
            {PANELS.map(({ key, icon: Icon, label }) => (
              <button
                key={key}
                onClick={() => setPanel(key)}
                className={`flex-shrink-0 flex items-center justify-center gap-1 px-2 py-3 text-[11px] font-medium transition-colors whitespace-nowrap ${
                  panel === key
                    ? 'text-[#0d9488] border-b-2 border-[#0d9488] bg-teal-50/50'
                    : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto p-4 flex flex-col min-h-0">
            {panel === 'rom' && (
              <DynamicROMPanel
                videoId={videoId}
                caseId={caseId}
                romItems={latestROM}
                currentTime={currentTime}
                onSeek={handleSeek}
                isMediaPipeActive={motionActive}
              />
            )}

            {panel === 'comments' && (
              <CommentPanel
                videoId={videoId}
                caseId={caseId}
                currentTime={currentTime}
                onSeek={handleSeek}
              />
            )}

            {panel === 'chat' && (
              <SpecialistChat
                caseId={caseId}
                videoId={videoId}
                videoLabel={video.label}
              />
            )}

            {panel === 'specialists' && (
              <SpecialistReviewPanel
                caseId={caseId}
                videoId={videoId}
                movementType={video.movementType}
                videoSrc={videoSrc}
                personMarker={personMarker}
              />
            )}

            {panel === 'annotation' && (
              <div className="h-full flex flex-col">
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-3 text-sm text-amber-800">
                  <p className="font-semibold mb-1 flex items-center gap-1.5">
                    <Layers className="w-4 h-4" />
                    描き込みモードの使い方
                  </p>
                  <ol className="list-decimal list-inside space-y-0.5 text-xs text-amber-700">
                    <li>動画プレイヤー下の <strong>「描き込み」</strong> ボタンをONにする</li>
                    <li>ツールバーから線・角度・矢印・円などを選ぶ</li>
                    <li>動画上でドラッグして描く</li>
                    <li>「保存」でタイムスタンプ付きマーカーとして保存</li>
                  </ol>
                </div>
                {savedAnnotations.length === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center text-gray-400 text-sm">
                    <Layers className="w-8 h-8 mb-2 opacity-30" />
                    <p>まだ保存されたマーカーはありません</p>
                  </div>
                ) : (
                  <div className="flex-1 overflow-y-auto space-y-2">
                    <p className="text-xs text-gray-500 font-medium mb-2">保存済みマーカー ({savedAnnotations.length}件)</p>
                    {savedAnnotations.map((ann) => (
                      <div key={ann.id} className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-mono text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">
                            ◆ {Math.floor(ann.timestamp / 60)}:{String(Math.floor(ann.timestamp % 60)).padStart(2, '0')}
                          </span>
                          <span className="text-xs text-gray-400">{ann.shapes.length}図形</span>
                        </div>
                        <p className="text-sm font-medium text-gray-800 truncate">{ann.label}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{ann.createdByName} · {ann.createdAt.slice(0, 10)}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {panel === 'evaluation' && (
              <EvaluationChecklist
                caseId={caseId}
                videoId={videoId}
                movementType={video.movementType}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
