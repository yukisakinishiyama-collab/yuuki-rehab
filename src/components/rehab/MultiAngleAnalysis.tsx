'use client'

/**
 * MultiAngleAnalysis
 * 正面・側面など複数アングルの動画を同時再生し、各アングルで骨格解析を行いながら
 * リアルタイムで角度差を比較。比較結果をそのままAI専門家にインラインで相談できる。
 */

import { useState, useRef, useEffect } from 'react'
import dynamic from 'next/dynamic'
import type { RehabCase, CaseVideo } from '@/types/rehab'
import { MOVEMENT_TYPE_LABELS, VIDEO_DIRECTION_LABELS, DISCUSSION_EXPERTS } from '@/types/rehab'
import { getVideoUrl, saveVideoUrl, getDiscussionSessions, saveDiscussionSession, generateId, getAllEvaluations, getAISummaries, getROMSessions } from '@/lib/rehab-store'
import { getBlobUrlFromDB } from '@/lib/video-db'
import type { ROMItem } from '@/lib/pose-analyzer'
import {
  Play, Pause, RotateCcw, Link2, Link2Off,
  Scan, ChevronLeft, ChevronRight, Plus, Minus,
  Activity, MessageSquareDot, Send, Loader2, X,
  Sparkles,
} from 'lucide-react'

const MotionCaptureOverlay = dynamic(() => import('./MotionCaptureOverlay'), { ssr: false })

// ── 定数 ─────────────────────────────────────────────────────────────────────
const MAX_PANELS = 4
const SPEEDS = [0.25, 0.5, 1, 1.5, 2]

const DIRECTION_BADGE: Record<string, { label: string; color: string }> = {
  front: { label: '正面', color: 'bg-blue-500' },
  side:  { label: '側面', color: 'bg-purple-500' },
  rear:  { label: '後方', color: 'bg-orange-500' },
  other: { label: 'その他', color: 'bg-gray-500' },
}

const PANEL_ACCENT = [
  'from-[#1e3a5f]',
  'from-[#5b21b6]',
  'from-[#b45309]',
  'from-[#065f46]',
]

// ── 1パネル分のコンポーネント ─────────────────────────────────────────────────
interface PanelProps {
  index:        number
  videos:       CaseVideo[]
  selectedId:   string
  onChangeId:   (id: string) => void
  videoRef:     React.RefObject<HTMLVideoElement | null>
  poseActive:   boolean
  onTogglePose: () => void
  romItems:     ROMItem[]
  onROMUpdate:  (items: ROMItem[]) => void
  onTimeUpdate: (time: number) => void
}

function VideoPanel({
  index, videos, selectedId, onChangeId, videoRef,
  poseActive, onTogglePose, romItems, onROMUpdate, onTimeUpdate,
}: PanelProps) {
  const [src, setSrc] = useState<string | null>(null)

  useEffect(() => {
    if (!selectedId) return
    setSrc(null)
    const cached = getVideoUrl(selectedId)
    if (cached) { setSrc(cached); return }
    getBlobUrlFromDB(selectedId).then((url) => {
      if (url) { saveVideoUrl(selectedId, url); setSrc(url) }
    })
  }, [selectedId])

  const selectedVideo = videos.find((v) => v.id === selectedId)
  const accent = PANEL_ACCENT[index % PANEL_ACCENT.length]
  const dirBadge = DIRECTION_BADGE[selectedVideo?.direction ?? ''] ?? { label: '不明', color: 'bg-gray-500' }

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm flex flex-col">
      {/* ヘッダー */}
      <div className={`bg-gradient-to-r ${accent} to-[#0d9488]/70 px-3 py-2 flex items-center gap-2`}>
        <span className="w-5 h-5 bg-white/20 rounded-full text-xs text-white font-bold flex items-center justify-center flex-shrink-0">
          {index + 1}
        </span>
        <select
          value={selectedId}
          onChange={(e) => onChangeId(e.target.value)}
          className="flex-1 min-w-0 bg-transparent text-white text-xs font-medium focus:outline-none cursor-pointer"
        >
          {videos.map((v) => (
            <option key={v.id} value={v.id} className="text-gray-900 bg-white">
              {VIDEO_DIRECTION_LABELS[v.direction]} – {v.label}（{MOVEMENT_TYPE_LABELS[v.movementType]}）
            </option>
          ))}
        </select>
      </div>

      {/* 映像エリア */}
      <div className="relative bg-black aspect-video">
        {src ? (
          <video
            ref={videoRef as React.RefObject<HTMLVideoElement>}
            src={src}
            className="w-full h-full object-contain"
            muted
            playsInline
            onTimeUpdate={() => onTimeUpdate(videoRef.current?.currentTime ?? 0)}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-white/40 text-xs">
            動画を読み込み中...
          </div>
        )}

        {/* 骨格オーバーレイ */}
        {poseActive && src && (
          <div className="absolute inset-0 pointer-events-none">
            <MotionCaptureOverlay
              videoRef={videoRef as React.RefObject<HTMLVideoElement | null>}
              active={poseActive}
              onROM={onROMUpdate}
            />
          </div>
        )}

        {/* 方向バッジ */}
        <div className="absolute top-2 left-2">
          <span className={`px-2 py-0.5 rounded-full text-xs text-white font-medium ${dirBadge.color}`}>
            {dirBadge.label}
          </span>
        </div>

        {/* 骨格トグル */}
        {src && (
          <button
            onClick={onTogglePose}
            className={`absolute bottom-2 right-2 flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium transition-all ${
              poseActive ? 'bg-[#0d9488] text-white shadow-lg' : 'bg-black/50 text-white/70 hover:bg-black/70'
            }`}
          >
            <Scan className="w-3 h-3" />
            骨格
          </button>
        )}
      </div>

      {/* ROM データ */}
      {poseActive && romItems.length > 0 && (
        <div className="px-3 py-2 bg-gray-50 border-t border-gray-100">
          <div className="grid grid-cols-2 gap-x-2 gap-y-0.5">
            {romItems.slice(0, 6).map((item) => (
              <div key={item.key} className="flex items-center justify-between text-xs">
                <span className="text-gray-500 truncate">{item.label}</span>
                <span className={`font-semibold ml-1 flex-shrink-0 ${
                  item.side === 'L' ? 'text-blue-600' :
                  item.side === 'R' ? 'text-red-600' : 'text-gray-700'
                }`}>
                  {item.value}°
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {!poseActive && (
        <div className="px-3 py-2 text-xs text-gray-400 text-center bg-gray-50 border-t border-gray-100">
          「骨格」ボタンで解析を開始
        </div>
      )}
    </div>
  )
}

// ── Markdownレンダラー（簡易） ─────────────────────────────────────────────────
function ChatContent({ text }: { text: string }) {
  return (
    <div className="text-sm text-gray-800 leading-relaxed space-y-1">
      {text.split('\n').map((line, i) => {
        if (line.startsWith('## ')) {
          return <p key={i} className="font-bold text-gray-900 mt-2">{line.replace('## ', '')}</p>
        }
        if (line.startsWith('### ')) {
          return <p key={i} className="font-semibold text-gray-800 mt-1">{line.replace('### ', '')}</p>
        }
        if (line.startsWith('・') || line.startsWith('- ') || /^\d+\./.test(line)) {
          return (
            <div key={i} className="flex items-start gap-1.5">
              <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-gray-400 flex-shrink-0" />
              <span>{line.replace(/^・|^- |\d+\.\s*/, '')}</span>
            </div>
          )
        }
        if (line.trim() === '') return <div key={i} className="h-1" />
        return <p key={i}>{line}</p>
      })}
    </div>
  )
}

// ── メインコンポーネント ──────────────────────────────────────────────────────
interface Props {
  case_:  RehabCase
  videos: CaseVideo[]
}

// チャットメッセージ（ローカル）
interface LocalMsg {
  id:          string
  role:        'user' | 'expert'
  expertId?:   string
  expertName?: string
  expertColor?: string
  text:        string
}

export default function MultiAngleAnalysis({ case_, videos }: Props) {
  // ── 4つの動画Ref（Hooksルール: 固定数） ────────────────────────────────────
  const videoRef0 = useRef<HTMLVideoElement | null>(null)
  const videoRef1 = useRef<HTMLVideoElement | null>(null)
  const videoRef2 = useRef<HTMLVideoElement | null>(null)
  const videoRef3 = useRef<HTMLVideoElement | null>(null)
  const allRefs   = [videoRef0, videoRef1, videoRef2, videoRef3] as React.RefObject<HTMLVideoElement | null>[]
  const syncingRef = useRef(false)
  const chatBottomRef = useRef<HTMLDivElement>(null)

  // ── 映像・解析状態 ──────────────────────────────────────────────────────────
  const [panelCount, setPanelCount]         = useState(() => Math.min(2, videos.length))
  const [synced, setSynced]                 = useState(true)
  const [globalSpeed, setGlobalSpeedState]  = useState(1)
  const [allPlaying, setAllPlaying]         = useState(false)
  const [poseActiveMap, setPoseActiveMap]   = useState<Record<number, boolean>>({})
  const [romMap, setRomMap]                 = useState<Record<number, ROMItem[]>>({})
  const [selectedIds, setSelectedIds]       = useState<string[]>(() => {
    const dirs: (CaseVideo['direction'])[] = ['front', 'side', 'rear', 'other']
    const result: string[] = []
    for (const dir of dirs) {
      const v = videos.find((v) => v.direction === dir)
      if (v && !result.includes(v.id)) result.push(v.id)
      if (result.length >= 4) break
    }
    for (const v of videos) {
      if (result.length >= 4) break
      if (!result.includes(v.id)) result.push(v.id)
    }
    return result
  })

  // ── インラインチャット状態 ──────────────────────────────────────────────────
  const [chatOpen,       setChatOpen]       = useState(false)
  const [chatMessages,   setChatMessages]   = useState<LocalMsg[]>([])
  const [userInput,      setUserInput]      = useState('')
  const [selectedExpert, setSelectedExpert] = useState<'ortho' | 'pt' | 'at'>('pt')
  const [streaming,      setStreaming]      = useState(false)
  const [streamingText,  setStreamingText]  = useState('')

  // ── パネル数変更 ────────────────────────────────────────────────────────────
  function changePanelCount(next: number) {
    setPanelCount(next)
    setSelectedIds((prev) => {
      const updated = [...prev]
      while (updated.length < next) {
        const unused = videos.find((v) => !updated.includes(v.id))
        updated.push(unused?.id ?? videos[0]?.id ?? '')
      }
      return updated
    })
  }

  // 再生状態の定期確認
  useEffect(() => {
    const id = setInterval(() => {
      const anyPlaying = allRefs.slice(0, panelCount).some((r) => r.current && !r.current.paused)
      setAllPlaying(anyPlaying)
    }, 250)
    return () => clearInterval(id)
  }, [panelCount])

  // チャット自動スクロール
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatMessages, streamingText])

  // ── 同期処理 ────────────────────────────────────────────────────────────────
  function handleTimeUpdate(panelIdx: number, time: number) {
    if (!synced || syncingRef.current) return
    syncingRef.current = true
    for (let i = 0; i < panelCount; i++) {
      if (i === panelIdx) continue
      const vid = allRefs[i].current
      if (vid && Math.abs(vid.currentTime - time) > 0.12) vid.currentTime = time
    }
    setTimeout(() => { syncingRef.current = false }, 60)
  }

  // ── 一括コントロール ────────────────────────────────────────────────────────
  function toggleAllPlay() {
    if (allPlaying) allRefs.slice(0, panelCount).forEach((r) => r.current?.pause())
    else             allRefs.slice(0, panelCount).forEach((r) => r.current?.play())
  }
  function seekAll(delta: number) {
    allRefs.slice(0, panelCount).forEach((r) => {
      const v = r.current
      if (v) v.currentTime = Math.max(0, Math.min(v.duration || 0, v.currentTime + delta))
    })
  }
  function resetAll() {
    allRefs.slice(0, panelCount).forEach((r) => {
      const v = r.current
      if (v) { v.pause(); v.currentTime = 0 }
    })
  }
  function setSpeedAll(speed: number) {
    allRefs.slice(0, panelCount).forEach((r) => { if (r.current) r.current.playbackRate = speed })
    setGlobalSpeedState(speed)
  }

  // ── 多角度解析データ → 構造化テキスト ──────────────────────────────────────
  function buildMultiAngleContext(): string {
    const lines: string[] = []
    lines.push('【多角度同時解析データ】')

    // 各アングルのROM
    activePanelIndices.forEach((i) => {
      const vid = videos.find((v) => v.id === selectedIds[i])
      const dirLabel = DIRECTION_BADGE[vid?.direction ?? '']?.label ?? `映像${i + 1}`
      lines.push(`\n▼ ${dirLabel}アングル`)
      const items = romMap[i] ?? []
      if (items.length === 0) {
        lines.push('  （解析データなし）')
      } else {
        items.forEach((r) => {
          lines.push(`  ${r.label}：${r.value}°（${r.side === 'L' ? '左' : r.side === 'R' ? '右' : '中央'}）`)
        })
      }
    })

    // 角度差
    if (activePanelIndices.length >= 2 && allROMKeys.length > 0) {
      lines.push('\n【アングル間の角度差（最大差）】')
      allROMKeys.forEach((key) => {
        const vals = activePanelIndices
          .map((i) => romMap[i]?.find((r) => r.key === key)?.value ?? null)
          .filter((v): v is number => v !== null)
        if (vals.length >= 2) {
          const diff = Math.max(...vals) - Math.min(...vals)
          const label = activePanelIndices
            .flatMap((i) => romMap[i] ?? [])
            .find((r) => r.key === key)?.label ?? key
          const flag = diff > 10 ? '🔴要精査' : diff > 5 ? '🟡注意' : '🟢正常範囲'
          lines.push(`  ${label}：差 ${diff}°  ${flag}`)
        }
      })
    }

    return lines.join('\n')
  }

  // ── 構造化データ（討論APIに渡す） ──────────────────────────────────────────
  function buildStructuredData() {
    const evals = getAllEvaluations(case_.id)
    const checklistIssues = evals.flatMap((ev) =>
      ev.items
        .filter((it) => it.checked && it.severity && it.severity !== 'none')
        .map((it) => ({
          movementType: MOVEMENT_TYPE_LABELS[ev.movementType] ?? ev.movementType,
          label: it.label,
          severity: it.severity,
          note: it.note || undefined,
        }))
    )

    const allROMSessions = case_.videos.flatMap((v) => getROMSessions(v.id))
    const romData: Array<{ label: string; max: number; min: number; range: number; side: string }> = []
    const romAccum = new Map<string, { label: string; side: string; vals: number[] }>()
    for (const session of allROMSessions) {
      for (const sample of session.samples) {
        for (const angle of Object.values(sample.angles)) {
          const key = `${angle.label}_${angle.side}`
          const ex = romAccum.get(key)
          if (ex) ex.vals.push(angle.value)
          else romAccum.set(key, { label: angle.label, side: angle.side, vals: [angle.value] })
        }
      }
    }
    romAccum.forEach(({ label, side, vals }) => {
      const max = Math.round(Math.max(...vals))
      const min = Math.round(Math.min(...vals))
      romData.push({ label, max, min, range: max - min, side })
    })

    const aiSummaries = case_.videos.flatMap((v) => getAISummaries(v.id)).map((s) => s.summary)
    const overallNotes = evals.map((e) => e.overallNote).filter(Boolean)

    return {
      caseInfo: {
        diagnosis: case_.diagnosis,
        injuredPart: case_.injuredPart,
        age: case_.age,
        gender: case_.gender,
        sport: case_.sport,
        status: case_.status,
        postOpDays: case_.postOpDays,
        evaluationPurpose: case_.evaluationPurpose,
      },
      checklistIssues,
      romData,
      problemComments: [],
      aiSummary: aiSummaries[0] ?? '',
      overallNotes,
    }
  }

  // ── AI送信 ──────────────────────────────────────────────────────────────────
  async function sendMessage() {
    const text = userInput.trim()
    if (!text || streaming) return

    const multiAngleCtx = buildMultiAngleContext()
    const fullText = activePanelIndices.length > 0
      ? `${multiAngleCtx}\n\n---\n${text}`
      : text

    const userMsg: LocalMsg = { id: generateId('cm'), role: 'user', text: fullText }
    const nextMessages = [...chatMessages, userMsg]
    setChatMessages(nextMessages)
    setUserInput('')
    setStreaming(true)
    setStreamingText('')

    const expert = DISCUSSION_EXPERTS.find((e) => e.id === selectedExpert)!

    // API用メッセージ履歴
    const apiMessages = nextMessages.map((m) => ({
      role: m.role === 'user' ? ('user' as const) : ('assistant' as const),
      content: m.role === 'user' ? m.text : `[${m.expertName ?? '専門家'}として]\n${m.text}`,
    }))

    try {
      const res = await fetch('/api/discussion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          expertId: selectedExpert,
          messages: apiMessages,
          structuredData: buildStructuredData(),
        }),
      })

      if (!res.ok) throw new Error('API error')

      let full = ''
      const reader = res.body!.getReader()
      const decoder = new TextDecoder()
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value, { stream: true })
        full += chunk
        setStreamingText(full)
      }

      const expertMsg: LocalMsg = {
        id: generateId('cm'),
        role: 'expert',
        expertId: selectedExpert,
        expertName: expert.name,
        expertColor: expert.color,
        text: full,
      }
      setChatMessages((prev) => [...prev, expertMsg])
      setStreamingText('')
    } catch {
      setChatMessages((prev) => [
        ...prev,
        { id: generateId('cm'), role: 'expert', expertName: 'エラー', expertColor: '#dc2626', text: 'エラーが発生しました。APIキーをご確認ください。' },
      ])
    } finally {
      setStreaming(false)
    }
  }

  // ── ROM比較テーブル用 ────────────────────────────────────────────────────────
  const activePanelIndices = Array.from({ length: panelCount }, (_, i) => i).filter((i) => poseActiveMap[i])
  const allROMKeys = Array.from(
    new Set(activePanelIndices.flatMap((i) => (romMap[i] ?? []).map((r) => r.key)))
  )
  const hasComparisonData = activePanelIndices.length >= 2 && allROMKeys.length > 0

  if (videos.length === 0) {
    return (
      <div className="text-center py-16 text-gray-400">
        <p className="text-sm">動画が登録されていません</p>
        <p className="text-xs mt-1">「動画追加」タブから動画をアップロードしてください</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">

      {/* ── 一括コントロールバー ───────────────────────────────────────────── */}
      <div className="bg-[#1e3a5f] rounded-xl px-4 py-3 flex items-center gap-2 flex-wrap">
        <button onClick={toggleAllPlay} className="w-9 h-9 rounded-lg bg-white/20 hover:bg-white/30 text-white flex items-center justify-center">
          {allPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
        </button>
        <button onClick={() => seekAll(-1 / 30)} className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-white flex items-center justify-center">
          <ChevronLeft className="w-4 h-4" />
        </button>
        <button onClick={() => seekAll(1 / 30)} className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-white flex items-center justify-center">
          <ChevronRight className="w-4 h-4" />
        </button>
        <button onClick={resetAll} className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-white flex items-center justify-center">
          <RotateCcw className="w-3.5 h-3.5" />
        </button>

        <div className="flex items-center gap-1">
          {SPEEDS.map((s) => (
            <button key={s} onClick={() => setSpeedAll(s)}
              className={`text-[11px] px-2 py-1 rounded font-medium transition-colors ${globalSpeed === s ? 'bg-[#0d9488] text-white' : 'bg-white/10 text-white/80 hover:bg-white/20'}`}>
              {s}x
            </button>
          ))}
        </div>

        <button onClick={() => setSynced(!synced)}
          className={`ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${synced ? 'bg-[#0d9488] text-white border-[#0d9488]' : 'bg-white/10 text-white/70 border-white/20 hover:bg-white/20'}`}>
          {synced ? <Link2 className="w-3.5 h-3.5" /> : <Link2Off className="w-3.5 h-3.5" />}
          {synced ? '同期 ON' : '同期 OFF'}
        </button>

        <div className="flex items-center gap-1.5 text-white">
          <span className="text-xs text-white/60">画面数</span>
          <button onClick={() => changePanelCount(Math.max(2, panelCount - 1))} disabled={panelCount <= 2}
            className="w-6 h-6 rounded bg-white/10 hover:bg-white/20 flex items-center justify-center disabled:opacity-30">
            <Minus className="w-3 h-3" />
          </button>
          <span className="text-sm font-bold w-4 text-center">{panelCount}</span>
          <button onClick={() => changePanelCount(Math.min(MAX_PANELS, panelCount + 1))} disabled={panelCount >= Math.min(MAX_PANELS, videos.length)}
            className="w-6 h-6 rounded bg-white/10 hover:bg-white/20 flex items-center justify-center disabled:opacity-30">
            <Plus className="w-3 h-3" />
          </button>
        </div>
      </div>

      {synced && (
        <div className="flex items-center justify-center gap-2 text-xs text-[#0d9488] bg-teal-50 border border-teal-200 rounded-lg py-1.5">
          <Link2 className="w-3.5 h-3.5" />
          時刻同期中 — どの映像を操作しても全て連動します
        </div>
      )}

      {/* ── 映像グリッド ─────────────────────────────────────────────────── */}
      <div className={`grid gap-4 ${panelCount <= 2 ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-2'}`}>
        {Array.from({ length: panelCount }).map((_, i) => (
          <VideoPanel
            key={i}
            index={i}
            videos={videos}
            selectedId={selectedIds[i] ?? videos[0]?.id ?? ''}
            onChangeId={(id) => {
              const next = [...selectedIds]
              next[i] = id
              setSelectedIds(next)
            }}
            videoRef={allRefs[i]}
            poseActive={poseActiveMap[i] ?? false}
            onTogglePose={() => setPoseActiveMap((prev) => ({ ...prev, [i]: !prev[i] }))}
            romItems={romMap[i] ?? []}
            onROMUpdate={(items) => setRomMap((prev) => ({ ...prev, [i]: items }))}
            onTimeUpdate={(t) => handleTimeUpdate(i, t)}
          />
        ))}
      </div>

      {/* ── 角度差比較テーブル ──────────────────────────────────────────── */}
      {hasComparisonData && (
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 bg-gray-50 border-b border-gray-100">
            <Activity className="w-4 h-4 text-indigo-600" />
            <span className="text-sm font-semibold text-gray-700">アングル別リアルタイム角度比較</span>
            <span className="ml-auto text-xs text-gray-400">{activePanelIndices.length}アングル解析中</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-xs text-gray-500 bg-gray-50/50">
                  <th className="text-left py-2 px-4 font-medium">関節</th>
                  {activePanelIndices.map((i) => {
                    const vid = videos.find((v) => v.id === selectedIds[i])
                    const badge = DIRECTION_BADGE[vid?.direction ?? ''] ?? { label: `映像${i + 1}`, color: '' }
                    return (
                      <th key={i} className="text-right py-2 px-3 font-medium">
                        <span className={`px-1.5 py-0.5 rounded text-white text-[10px] ${badge.color}`}>{badge.label}</span>
                      </th>
                    )
                  })}
                  <th className="text-right py-2 px-4 font-medium text-indigo-700">最大差</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {allROMKeys.map((key) => {
                  const vals = activePanelIndices.map((i) => romMap[i]?.find((r) => r.key === key)?.value ?? null)
                  const numericVals = vals.filter((v): v is number => v !== null)
                  const maxDiff = numericVals.length >= 2 ? Math.max(...numericVals) - Math.min(...numericVals) : null
                  const labelStr = activePanelIndices.flatMap((i) => romMap[i] ?? []).find((r) => r.key === key)?.label ?? key
                  const diffColor = maxDiff == null ? '' : maxDiff > 10 ? 'text-red-600 bg-red-50' : maxDiff > 5 ? 'text-amber-600 bg-amber-50' : 'text-green-600 bg-green-50'
                  return (
                    <tr key={key} className="hover:bg-gray-50">
                      <td className="py-2 px-4 text-gray-700 font-medium">{labelStr}</td>
                      {vals.map((v, idx) => (
                        <td key={idx} className="py-2 px-3 text-right font-semibold text-gray-800">
                          {v !== null ? `${v}°` : <span className="text-gray-300">—</span>}
                        </td>
                      ))}
                      <td className={`py-2 px-4 text-right font-bold ${diffColor}`}>
                        {maxDiff !== null ? `${maxDiff}°` : <span className="text-gray-300">—</span>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div className="flex items-center gap-4 px-4 py-2 text-xs text-gray-500 border-t border-gray-100">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-400 inline-block" />10°超 → 要精査</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />5〜10° → 注意</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-400 inline-block" />5°以内 → 正常範囲</span>
            <span className="ml-auto text-gray-400">※ 2D映像解析のため参考値</span>
          </div>
        </div>
      )}

      {/* ── AIに相談ボタン ────────────────────────────────────────────────── */}
      {!chatOpen && (
        <button
          onClick={() => setChatOpen(true)}
          className="w-full flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-medium rounded-xl text-sm transition-all shadow-sm"
        >
          <MessageSquareDot className="w-4 h-4" />
          この解析結果についてAI専門家に相談する
          {hasComparisonData && (
            <span className="px-2 py-0.5 bg-white/20 rounded-full text-xs">
              角度差データ付き
            </span>
          )}
        </button>
      )}

      {/* ── インラインAIチャット ──────────────────────────────────────────── */}
      {chatOpen && (
        <div className="bg-white border border-indigo-200 rounded-xl shadow-sm overflow-hidden">
          {/* チャットヘッダー */}
          <div className="flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-indigo-600 to-purple-600">
            <Sparkles className="w-4 h-4 text-white" />
            <span className="text-sm font-semibold text-white flex-1">AI専門家に相談</span>

            {/* 専門家選択 */}
            <div className="flex items-center gap-1">
              {DISCUSSION_EXPERTS.filter((e) => e.id !== 'all').map((e) => (
                <button
                  key={e.id}
                  onClick={() => setSelectedExpert(e.id as 'ortho' | 'pt' | 'at')}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all border ${
                    selectedExpert === e.id
                      ? 'bg-white text-indigo-700 border-white shadow-sm'
                      : 'bg-white/20 text-white border-white/30 hover:bg-white/30'
                  }`}
                >
                  {e.emoji} {e.name}
                </button>
              ))}
            </div>

            <button onClick={() => setChatOpen(false)} className="w-6 h-6 flex items-center justify-center text-white/70 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* データ使用通知 */}
          {hasComparisonData && chatMessages.length === 0 && (
            <div className="px-4 py-2.5 bg-indigo-50 border-b border-indigo-100 text-xs text-indigo-700 flex items-center gap-2">
              <Activity className="w-3.5 h-3.5 flex-shrink-0" />
              {activePanelIndices.length}アングルのROMデータが自動で添付されます。角度差や左右差について質問してください。
            </div>
          )}

          {/* メッセージ一覧 */}
          <div className="px-4 py-3 space-y-3 max-h-96 overflow-y-auto">
            {chatMessages.length === 0 && (
              <div className="space-y-2">
                <p className="text-xs text-gray-500 text-center">よくある質問：</p>
                {[
                  '角度差の臨床的な意味を教えてください',
                  'この数値からリハビリのポイントを教えてください',
                  '競技復帰の判断基準を教えてください',
                ].map((q) => (
                  <button
                    key={q}
                    onClick={() => setUserInput(q)}
                    className="w-full text-left text-xs px-3 py-2 bg-gray-50 hover:bg-indigo-50 hover:text-indigo-700 border border-gray-200 hover:border-indigo-200 rounded-lg transition-colors"
                  >
                    {q}
                  </button>
                ))}
              </div>
            )}

            {chatMessages.map((msg) => (
              <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {msg.role === 'expert' && (
                  <div className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold mr-2 mt-0.5"
                    style={{ backgroundColor: msg.expertColor ?? '#6b7280' }}>
                    {DISCUSSION_EXPERTS.find((e) => e.id === msg.expertId)?.emoji ?? '🤖'}
                  </div>
                )}
                <div className={`max-w-[80%] rounded-xl px-3 py-2 ${
                  msg.role === 'user'
                    ? 'bg-indigo-600 text-white text-sm'
                    : 'bg-gray-50 border border-gray-200'
                }`}>
                  {msg.role === 'expert' && (
                    <p className="text-[10px] font-semibold mb-1" style={{ color: msg.expertColor }}>
                      {msg.expertName}
                    </p>
                  )}
                  {msg.role === 'user'
                    ? <p className="text-sm whitespace-pre-wrap">{msg.text}</p>
                    : <ChatContent text={msg.text} />
                  }
                </div>
              </div>
            ))}

            {/* ストリーミング中 */}
            {streaming && (
              <div className="flex justify-start">
                <div className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold mr-2 mt-0.5"
                  style={{ backgroundColor: DISCUSSION_EXPERTS.find((e) => e.id === selectedExpert)?.color ?? '#6b7280' }}>
                  {DISCUSSION_EXPERTS.find((e) => e.id === selectedExpert)?.emoji}
                </div>
                <div className="max-w-[80%] bg-gray-50 border border-gray-200 rounded-xl px-3 py-2">
                  <p className="text-[10px] font-semibold mb-1" style={{ color: DISCUSSION_EXPERTS.find((e) => e.id === selectedExpert)?.color }}>
                    {DISCUSSION_EXPERTS.find((e) => e.id === selectedExpert)?.name}
                  </p>
                  {streamingText
                    ? <ChatContent text={streamingText} />
                    : <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                  }
                </div>
              </div>
            )}
            <div ref={chatBottomRef} />
          </div>

          {/* 入力エリア */}
          <div className="px-4 py-3 border-t border-gray-100 flex gap-2">
            <input
              type="text"
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }}
              placeholder="質問を入力（Enter で送信）"
              disabled={streaming}
              className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400 disabled:opacity-60"
            />
            <button
              onClick={sendMessage}
              disabled={!userInput.trim() || streaming}
              className="w-9 h-9 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white flex items-center justify-center transition-colors disabled:opacity-50"
            >
              {streaming
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : <Send className="w-4 h-4" />
              }
            </button>
          </div>
        </div>
      )}

      {/* 解析ガイド（骨格未使用時） */}
      {activePanelIndices.length === 0 && (
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-sm text-blue-700">
          <p className="font-semibold mb-1">💡 多角度解析の使い方</p>
          <ol className="space-y-1 text-xs list-decimal list-inside text-blue-600">
            <li>各パネルで正面・側面など方向が異なる動画を選択</li>
            <li>各パネルの「骨格」ボタンをONにして解析開始</li>
            <li>2つ以上でONにすると角度差の比較表が表示されます</li>
            <li>「AIに相談」ボタンで比較データを添付して専門家に質問</li>
          </ol>
        </div>
      )}
      {activePanelIndices.length === 1 && (
        <p className="text-center text-sm text-gray-400">
          もう1つのパネルでも「骨格」をONにすると角度差の比較表が表示されます
        </p>
      )}
    </div>
  )
}
