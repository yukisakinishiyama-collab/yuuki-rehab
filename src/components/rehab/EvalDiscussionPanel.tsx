'use client'

/**
 * EvalDiscussionPanel
 * 評価データを構造化してAI専門家（整形外科医・PT・AT）に送信し、
 * ストリーミングでリアルタイムにディスカッションするUI。
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import type { RehabCase, DiscussionSession, DiscussionMessage } from '@/types/rehab'
import { DISCUSSION_EXPERTS } from '@/types/rehab'
import {
  getDiscussionSessions, saveDiscussionSession, deleteDiscussionSession,
  generateId, getAllEvaluations, getAISummaries,
  getCommentsFallback, getROMSessions,
} from '@/lib/rehab-store'
import { MOVEMENT_TYPE_LABELS } from '@/types/rehab'
import {
  Send, Plus, Trash2, MessageSquareDot,
  AlertCircle, Loader2, ChevronDown, ChevronUp,
  Users, ClipboardList, Activity, BarChart2,
} from 'lucide-react'

interface Props {
  case_: RehabCase
}

// ── 構造化評価データの型 ─────────────────────────────────────────────────────
interface StructuredData {
  caseInfo: {
    diagnosis: string
    injuredPart: string
    age: number
    gender: string
    sport?: string
    status: string
    postOpDays?: number
    evaluationPurpose: string
  }
  checklistIssues: Array<{
    movementType: string
    label: string
    severity: string
    note?: string
  }>
  romData: Array<{
    label: string
    max: number
    min: number
    range: number
    side: string
  }>
  problemComments: string[]
  aiSummary: string
  overallNotes: string[]
}

// ── 評価データを構造化して収集 ───────────────────────────────────────────────
function collectStructuredData(case_: RehabCase): StructuredData {
  const evaluations = getAllEvaluations(case_.id)
  const allComments: ReturnType<typeof getCommentsFallback> = []
  const allSummaries: ReturnType<typeof getAISummaries>    = []
  const allROM: ReturnType<typeof getROMSessions>          = []

  for (const v of case_.videos) {
    allComments.push(...getCommentsFallback(v.id, case_.id))
    allSummaries.push(...getAISummaries(v.id))
    allROM.push(...getROMSessions(v.id))
  }

  const comments  = [...new Map(allComments.map((c) => [c.id, c])).values()]
  const summaries = [...new Map(allSummaries.map((s) => [s.id, s])).values()]

  // チェックリスト問題項目（重症度順）
  const checklistIssues = evaluations.flatMap((ev) =>
    ev.items
      .filter((it) => it.checked && (it.severity === 'moderate' || it.severity === 'severe'))
      .map((it) => ({
        movementType: MOVEMENT_TYPE_LABELS[ev.movementType as keyof typeof MOVEMENT_TYPE_LABELS] ?? ev.movementType,
        label:    it.label,
        severity: it.severity ?? 'mild',
        note:     it.note,
      }))
  ).sort((a, b) => {
    const order = { severe: 0, moderate: 1, mild: 2 }
    return (order[a.severity as keyof typeof order] ?? 3) - (order[b.severity as keyof typeof order] ?? 3)
  })

  // 問題コメント
  const problemComments = comments
    .filter((c) => c.type === 'problem' || c.type === 'risk')
    .map((c) => c.text)

  // 評価者メモ
  const overallNotes = evaluations
    .filter((e) => e.overallNote)
    .map((e) => e.overallNote as string)

  // AI要旨（最新1件）
  const aiSummary = summaries[0]
    ? [
        summaries[0].summary?.slice(0, 400),
        ...(summaries[0].experts?.slice(0, 3).map((e) => `[${e.name}] ${e.opinion.slice(0, 200)}`) ?? []),
      ].filter(Boolean).join('\n')
    : ''

  // ROM集計（動的計測）
  const romMap = new Map<string, { max: number; min: number; label: string; side: string }>()
  for (const sess of allROM) {
    for (const s of sess.samples) {
      for (const [key, ang] of Object.entries(s.angles)) {
        const cur = romMap.get(key) ?? { max: -Infinity, min: Infinity, label: ang.label, side: ang.side }
        if (ang.value > cur.max) cur.max = ang.value
        if (ang.value < cur.min) cur.min = ang.value
        romMap.set(key, cur)
      }
    }
  }
  const romData = [...romMap.values()]
    .filter((r) => r.max !== -Infinity)
    .map((r) => ({
      label: r.label,
      max:   Math.round(r.max),
      min:   Math.round(r.min),
      range: Math.round(r.max - r.min),
      side:  r.side,
    }))

  return {
    caseInfo: {
      diagnosis:         case_.diagnosis,
      injuredPart:       case_.injuredPart,
      age:               case_.age,
      gender:            case_.gender,
      sport:             case_.sport,
      status:            case_.status,
      postOpDays:        case_.postOpDays,
      evaluationPurpose: case_.evaluationPurpose,
    },
    checklistIssues,
    romData,
    problemComments,
    aiSummary,
    overallNotes,
  }
}

// ── メッセージバブル ───────────────────────────────────────────────────────────
function MessageBubble({ msg }: { msg: DiscussionMessage }) {
  const isUser = msg.role === 'user'

  // Markdown風の見出しをHTMLに変換（## → <h3>）
  const formatText = (text: string) => {
    return text
      .split('\n')
      .map((line, i) => {
        if (line.startsWith('## ')) return <h3 key={i} className="font-bold text-gray-900 mt-3 mb-1 text-sm border-b border-gray-200 pb-0.5">{line.slice(3)}</h3>
        if (line.startsWith('### ')) return <h4 key={i} className="font-semibold text-gray-800 mt-2 mb-0.5 text-xs">{line.slice(4)}</h4>
        if (line.startsWith('・') || line.startsWith('- ')) return <li key={i} className="ml-3 text-sm list-disc">{line.slice(1).trim()}</li>
        if (line === '') return <div key={i} className="h-1" />
        return <p key={i} className="text-sm leading-relaxed">{line}</p>
      })
  }

  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      <div
        className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0 mt-0.5 shadow"
        style={{ backgroundColor: isUser ? '#1e3a5f' : (msg.expertColor ?? '#6b7280') }}
      >
        {isUser ? '施' : (msg.expertName?.[0] ?? 'A')}
      </div>

      <div className={`max-w-[82%] flex flex-col gap-1 ${isUser ? 'items-end' : 'items-start'}`}>
        <span className="text-[10px] text-gray-500 px-1">
          {isUser ? '施術者' : msg.expertName}
          <span className="ml-2 text-gray-400">
            {new Date(msg.createdAt).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}
          </span>
        </span>

        <div
          className={`rounded-2xl px-4 py-3 ${
            isUser
              ? 'bg-[#1e3a5f] text-white rounded-tr-sm text-sm leading-relaxed'
              : 'bg-white border border-gray-200 text-gray-800 rounded-tl-sm shadow-sm'
          }`}
        >
          {isUser
            ? <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.text}</p>
            : <div className="space-y-0.5">{formatText(msg.text)}</div>
          }
        </div>
      </div>
    </div>
  )
}

// ── データ状況バッジ ──────────────────────────────────────────────────────────
function DataBadge({ icon: Icon, label, count, color }: {
  icon: React.ElementType; label: string; count: number; color: string
}) {
  const hasData = count > 0
  return (
    <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs ${
      hasData ? `border-${color}-200 bg-${color}-50 text-${color}-700` : 'border-gray-200 bg-gray-50 text-gray-400'
    }`}>
      <Icon className="w-3.5 h-3.5" />
      <span className="font-semibold">{count}</span>
      <span>{label}</span>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// メインコンポーネント
// ─────────────────────────────────────────────────────────────────────────────
export default function EvalDiscussionPanel({ case_ }: Props) {
  const [sessions,       setSessions]       = useState<DiscussionSession[]>([])
  const [activeSession,  setActiveSession]  = useState<DiscussionSession | null>(null)
  const [selectedExpert, setSelectedExpert] = useState<string>('pt')
  const [inputText,      setInputText]      = useState('')
  const [streaming,      setStreaming]       = useState(false)
  const [streamingText,  setStreamingText]  = useState('')
  const [streamingName,  setStreamingName]  = useState('')
  const [streamingColor, setStreamingColor] = useState('#6b7280')
  const [error,          setError]          = useState('')
  const [structuredData, setStructuredData] = useState<StructuredData | null>(null)
  const [showData,       setShowData]       = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef  = useRef<HTMLTextAreaElement>(null)
  const abortRef  = useRef<AbortController | null>(null)

  useEffect(() => {
    setStructuredData(collectStructuredData(case_))
    const ss = getDiscussionSessions(case_.id)
    setSessions(ss)
    if (ss.length > 0) setActiveSession(ss[0])
  }, [case_.id])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [activeSession?.messages, streamingText])

  function createSession() {
    const now = new Date().toISOString()
    const sess: DiscussionSession = {
      id:        generateId('disc'),
      caseId:    case_.id,
      title:     `ディスカッション #${sessions.length + 1}`,
      messages:  [],
      createdAt: now,
      updatedAt: now,
    }
    saveDiscussionSession(sess)
    const updated = getDiscussionSessions(case_.id)
    setSessions(updated)
    setActiveSession(sess)
    setInputText('')
  }

  function deleteSession(id: string) {
    if (!confirm('このディスカッションを削除しますか？')) return
    deleteDiscussionSession(id)
    const updated = getDiscussionSessions(case_.id)
    setSessions(updated)
    setActiveSession(updated[0] ?? null)
  }

  const handleSend = useCallback(async () => {
    if (!inputText.trim() || streaming || !structuredData) return
    if (!activeSession) { createSession(); return }

    const userMsg: DiscussionMessage = {
      id:        generateId('dmsg'),
      caseId:    case_.id,
      role:      'user',
      text:      inputText.trim(),
      createdAt: new Date().toISOString(),
    }

    const experts = selectedExpert === 'all'
      ? DISCUSSION_EXPERTS.filter((e) => e.id !== 'all')
      : DISCUSSION_EXPERTS.filter((e) => e.id === selectedExpert)

    let currentSession: DiscussionSession = {
      ...activeSession,
      messages:  [...activeSession.messages, userMsg],
      updatedAt: new Date().toISOString(),
    }
    saveDiscussionSession(currentSession)
    setActiveSession({ ...currentSession })
    setInputText('')
    setError('')
    setStreaming(true)

    for (const expert of experts) {
      setStreamingText('')
      setStreamingName(expert.name)
      setStreamingColor(expert.color)

      // 会話履歴を構築（この専門家との対話のみ or 全履歴）
      const apiMessages = currentSession.messages.map((m) => ({
        role:    m.role === 'user' ? 'user' as const : 'assistant' as const,
        content: m.role === 'expert'
          ? (experts.length > 1 ? `[${m.expertName}として]\n${m.text}` : m.text)
          : m.text,
      }))

      try {
        abortRef.current = new AbortController()
        const res = await fetch('/api/discussion', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          signal:  abortRef.current.signal,
          body: JSON.stringify({
            expertId:      expert.id,
            messages:      apiMessages,
            structuredData,
          }),
        })

        if (!res.ok) {
          const json = await res.json()
          throw new Error(json.error ?? 'APIエラー')
        }

        const reader = res.body!.getReader()
        const decoder = new TextDecoder()
        let fullText = ''
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          fullText += decoder.decode(value, { stream: true })
          setStreamingText(fullText)
        }

        const expertMsg: DiscussionMessage = {
          id:          generateId('dmsg'),
          caseId:      case_.id,
          role:        'expert',
          expertId:    expert.id,
          expertName:  expert.name,
          expertColor: expert.color,
          text:        fullText,
          createdAt:   new Date().toISOString(),
        }
        currentSession = {
          ...currentSession,
          messages:  [...currentSession.messages, expertMsg],
          updatedAt: new Date().toISOString(),
        }
        saveDiscussionSession(currentSession)
        setActiveSession({ ...currentSession })
        setStreamingText('')
      } catch (e) {
        if ((e as Error).name === 'AbortError') break
        setError(`${expert.name}の応答に失敗: ${(e as Error).message}`)
      }
    }

    setStreaming(false)
    setStreamingText('')
    setTimeout(() => inputRef.current?.focus(), 50)
  }, [inputText, streaming, activeSession, selectedExpert, structuredData, case_]) // eslint-disable-line react-hooks/exhaustive-deps

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
  }

  const sd = structuredData
  const issueCount   = sd?.checklistIssues.length ?? 0
  const commentCount = sd?.problemComments.length ?? 0
  const romCount     = sd?.romData.length ?? 0
  const hasAI        = !!sd?.aiSummary

  // クイック質問（ステータス別）
  const quickQuestions = case_.status === 'preReturn' ? [
    '復帰判断に必要な最終確認事項は？',
    '競技復帰後の再受傷リスクと対策は？',
    '段階的復帰プロトコルを教えてください',
  ] : case_.postOpDays != null ? [
    `術後${case_.postOpDays}日目として現在の回復段階をどう評価しますか？`,
    'この時期に優先すべきリハビリは何ですか？',
    'この評価から何か懸念される点はありますか？',
  ] : [
    'この評価結果から最も懸念されるリスクは？',
    '優先的に介入すべき問題点を教えてください',
    'どのような検査・評価が追加で必要ですか？',
  ]

  return (
    <div className="flex flex-col gap-4" style={{ minHeight: '640px' }}>

      {/* ── ヘッダー ── */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <Users className="w-5 h-5 text-purple-600" />
            AI専門家ディスカッション
          </h2>
          <p className="text-sm text-gray-500 mt-0.5">
            評価データを参照して整形外科医・PT・ATが回答します
          </p>
        </div>
        <button
          onClick={createSession}
          className="flex items-center gap-1.5 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold rounded-xl transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" />新規ディスカッション
        </button>
      </div>

      {/* ── 評価データ状況 ── */}
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-3">
        <button
          onClick={() => setShowData((v) => !v)}
          className="w-full flex items-center justify-between text-sm font-medium text-gray-700"
        >
          <span className="flex items-center gap-2">
            <BarChart2 className="w-4 h-4 text-purple-500" />
            AIに渡す評価データ
          </span>
          <div className="flex items-center gap-2">
            <div className="flex gap-1.5">
              {[
                { label: 'チェック', count: issueCount,   color: issueCount > 0 ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-400' },
                { label: 'コメント', count: commentCount, color: commentCount > 0 ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-400' },
                { label: 'ROM',      count: romCount,     color: romCount > 0 ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-400' },
                { label: 'AI要旨',   count: hasAI ? 1 : 0, color: hasAI ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-400' },
              ].map((b) => (
                <span key={b.label} className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${b.color}`}>
                  {b.label} {b.count}
                </span>
              ))}
            </div>
            {showData ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </div>
        </button>

        {showData && sd && (
          <div className="mt-3 space-y-3">
            {sd.checklistIssues.length > 0 && (
              <div>
                <p className="text-[11px] font-semibold text-gray-600 mb-1 flex items-center gap-1">
                  <ClipboardList className="w-3.5 h-3.5" /> 問題あり項目
                </p>
                <div className="space-y-1">
                  {sd.checklistIssues.map((it, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                        it.severity === 'severe' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'
                      }`}>
                        {it.severity === 'severe' ? '重度' : '中等度'}
                      </span>
                      <span className="text-gray-700">{it.movementType} / {it.label}</span>
                      {it.note && <span className="text-gray-400">→ {it.note}</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {sd.romData.length > 0 && (
              <div>
                <p className="text-[11px] font-semibold text-gray-600 mb-1 flex items-center gap-1">
                  <Activity className="w-3.5 h-3.5" /> ROM計測
                </p>
                <div className="grid grid-cols-2 gap-1">
                  {sd.romData.map((r, i) => (
                    <div key={i} className="text-xs text-gray-600 bg-white border border-gray-200 rounded px-2 py-1">
                      <span className="font-medium">{r.label}</span>
                      <span className="text-gray-400 ml-2">最大{r.max}° / 可動域{r.range}°</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── セッションタブ ── */}
      {sessions.length > 1 && (
        <div className="flex gap-2 flex-wrap">
          {sessions.map((s) => (
            <button
              key={s.id}
              onClick={() => setActiveSession(s)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                activeSession?.id === s.id
                  ? 'bg-purple-600 text-white border-purple-600'
                  : 'bg-white text-gray-600 border-gray-300 hover:border-purple-400'
              }`}
            >
              <MessageSquareDot className="w-3 h-3" />
              {s.title}
              <button
                onClick={(e) => { e.stopPropagation(); deleteSession(s.id) }}
                className="ml-1 opacity-40 hover:opacity-100"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </button>
          ))}
        </div>
      )}

      {/* ── チャット ── */}
      {activeSession ? (
        <div className="flex flex-col flex-1 bg-gray-50 rounded-2xl border border-gray-200 overflow-hidden" style={{ minHeight: '400px' }}>

          {/* メッセージ */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {activeSession.messages.length === 0 && !streaming && (
              <div className="flex flex-col items-center justify-center py-10 text-gray-400">
                <Users className="w-10 h-10 mb-3 opacity-30" />
                <p className="font-medium text-sm text-gray-500">専門家に質問してください</p>
                <p className="text-xs mt-1 text-center text-gray-400 max-w-xs">
                  評価データをAIが自動的に参照して回答します
                </p>
                <div className="mt-5 flex flex-col gap-2 w-full max-w-sm">
                  {quickQuestions.map((q) => (
                    <button
                      key={q}
                      onClick={() => setInputText(q)}
                      className="w-full text-left px-4 py-2.5 bg-white border border-gray-200 text-gray-700 text-xs rounded-xl hover:border-purple-400 hover:bg-purple-50 transition-colors"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {activeSession.messages.map((msg) => (
              <MessageBubble key={msg.id} msg={msg} />
            ))}

            {/* ストリーミング中 */}
            {streaming && (streamingText ? (
              <div className="flex gap-3">
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0 mt-0.5 shadow animate-pulse"
                  style={{ backgroundColor: streamingColor }}
                >
                  {streamingName[0]}
                </div>
                <div className="max-w-[82%] flex flex-col gap-1">
                  <span className="text-[10px] text-gray-500 px-1">
                    {streamingName}
                    <span className="ml-2 text-purple-400 animate-pulse">● 回答中...</span>
                  </span>
                  <div className="bg-white border border-purple-200 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm text-gray-800 whitespace-pre-wrap text-sm leading-relaxed">
                    {streamingText}
                    <span className="inline-block w-1.5 h-4 bg-purple-400 ml-0.5 animate-pulse rounded-sm align-middle" />
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex gap-3 items-center">
                <div className="w-9 h-9 rounded-full bg-gray-200 animate-pulse flex-shrink-0" />
                <div className="bg-white border border-gray-200 rounded-2xl px-4 py-3 flex items-center gap-2 text-gray-400 text-sm shadow-sm">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  評価データを参照して回答を作成中...
                </div>
              </div>
            ))}

            <div ref={bottomRef} />
          </div>

          {error && (
            <div className="flex items-center gap-2 mx-4 mb-2 px-3 py-2 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700">
              <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />{error}
            </div>
          )}

          {/* 入力エリア */}
          <div className="border-t border-gray-200 bg-white p-3 space-y-2">
            {/* 専門家選択 */}
            <div className="flex gap-1.5 flex-wrap">
              {DISCUSSION_EXPERTS.map((e) => (
                <button
                  key={e.id}
                  onClick={() => setSelectedExpert(e.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                    selectedExpert === e.id
                      ? 'text-white shadow-sm scale-105 border-transparent'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
                  }`}
                  style={selectedExpert === e.id ? { backgroundColor: e.color } : {}}
                >
                  {e.emoji} {e.name}
                </button>
              ))}
            </div>

            <div className="flex gap-2 items-end">
              <textarea
                ref={inputRef}
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={
                  selectedExpert === 'all'
                    ? '全専門家に質問する…（Enter で送信、Shift+Enter で改行）'
                    : `${DISCUSSION_EXPERTS.find((e) => e.id === selectedExpert)?.name}に質問する…`
                }
                disabled={streaming}
                rows={2}
                className="flex-1 resize-none text-sm border border-gray-300 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-400 disabled:opacity-50"
              />
              <button
                onClick={handleSend}
                disabled={!inputText.trim() || streaming}
                className="flex-shrink-0 w-10 h-10 bg-purple-600 hover:bg-purple-700 disabled:opacity-40 text-white rounded-xl flex items-center justify-center transition-colors shadow-sm"
              >
                {streaming ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-[10px] text-gray-400">
              ※ AI回答は参考情報です。最終的な臨床判断は担当者が行ってください
            </p>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border-2 border-dashed border-gray-200 p-12 text-center">
          <div className="w-16 h-16 bg-purple-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <Users className="w-8 h-8 text-purple-400" />
          </div>
          <h3 className="font-semibold text-gray-800 mb-2">AI専門家とディスカッションを始めましょう</h3>
          <p className="text-sm text-gray-500 max-w-sm mx-auto mb-6 leading-relaxed">
            整形外科医・理学療法士・アスレティックトレーナーが
            評価データをもとに専門的見解を提供します
          </p>
          <button
            onClick={createSession}
            className="inline-flex items-center gap-2 px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-xl shadow-sm"
          >
            <Plus className="w-5 h-5" />ディスカッションを開始
          </button>
          <div className="grid grid-cols-3 gap-3 mt-8 max-w-md mx-auto text-left">
            {[
              { icon: '🏥', title: '整形外科医', desc: '鑑別診断・復帰判断・精査提案' },
              { icon: '🦴', title: '理学療法士', desc: 'Phase別リハビリ・進段基準' },
              { icon: '💪', title: 'ATトレーナー', desc: 'S&C・現場対応・競技復帰' },
            ].map((f) => (
              <div key={f.title} className="bg-gray-50 rounded-xl p-3">
                <div className="text-lg mb-1">{f.icon}</div>
                <p className="text-xs font-semibold text-gray-700 mb-0.5">{f.title}</p>
                <p className="text-[10px] text-gray-500 leading-snug">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
