'use client'

import { useState, useRef, useEffect } from 'react'
import type { Protocol, ProtocolPatient, ProtocolChatMessage } from '@/types/protocol'
import { JOINT_LABELS } from '@/types/protocol'
import { appendChatMessage, clearChat } from '@/lib/protocol-store'
import { Send, Loader2, Bot, Trash2, AlertCircle, Sparkles } from 'lucide-react'

interface Props {
  protocol: Protocol
  patient: ProtocolPatient
  onUpdate: () => void
  /** タブ切替時に自動送信する質問（用語選択ポップアップなどからの連携用） */
  initialQuestion?: string
  onQuestionConsumed?: () => void
}

// プロトコル全体をAIに渡すコンテキスト文字列へ変換
function serializeProtocol(protocol: Protocol, patient: ProtocolPatient): string {
  const lines: string[] = []
  lines.push(`タイトル: ${protocol.title}`)

  const pt: string[] = []
  if (patient.age) pt.push(`${patient.age}歳`)
  if (patient.diagnosis) pt.push(patient.diagnosis)
  if (patient.joint) pt.push(JOINT_LABELS[patient.joint])
  if (patient.sport) pt.push(`競技: ${patient.sport}`)
  if (pt.length) lines.push(`患者: ${pt.join(' / ')}`)
  if (patient.concerns) lines.push(`患者の悩み: ${patient.concerns}`)

  lines.push(`現在のフェーズ: ${protocol.currentPhaseIndex + 1}（${protocol.phases[protocol.currentPhaseIndex]?.title ?? ''}）`)
  lines.push('')

  protocol.phases.forEach((ph, i) => {
    lines.push(`--- フェーズ${i + 1}: ${ph.title}${ph.durationWeeks ? `（${ph.durationWeeks}）` : ''} ---`)
    if (ph.goals.length) lines.push(`目標: ${ph.goals.join('、')}`)
    if (ph.exercises.length) {
      lines.push(`エクササイズ: ${ph.exercises.map(e => e.name + (e.dose ? `（${e.dose}）` : '')).join('、')}`)
    }
    if (ph.advanceCriteria.length) {
      lines.push(`移行基準: ${ph.advanceCriteria.map(c =>
        `${c.label}${c.target ? `[目標:${c.target}]` : ''}${c.met ? '✓達成' : '未達成'}`
      ).join('、')}`)
    }
    if (ph.precautions.length) lines.push(`注意事項: ${ph.precautions.join('、')}`)
    if (ph.redFlags.length) lines.push(`中止基準: ${ph.redFlags.join('、')}`)
  })

  if (protocol.consensusNotes) {
    lines.push('')
    lines.push(`合意事項: ${protocol.consensusNotes}`)
  }
  return lines.join('\n')
}

export default function ProtocolChat({ protocol, patient, onUpdate, initialQuestion, onQuestionConsumed }: Props) {
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [confirmClear, setConfirmClear] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const messages: ProtocolChatMessage[] = protocol.aiChat ?? []

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length, loading])

  // 用語選択ポップアップなどから渡された質問を自動送信
  // StrictMode等によるeffect二重実行での重複送信をrefで防止
  const consumedQuestionRef = useRef<string | null>(null)
  useEffect(() => {
    const q = initialQuestion?.trim()
    if (q && consumedQuestionRef.current !== q) {
      consumedQuestionRef.current = q
      sendMessage(q)
      onQuestionConsumed?.()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialQuestion])

  async function sendMessage(text: string) {
    const q = text.trim()
    if (!q || loading) return

    setInput('')
    setError('')
    // 先にユーザーメッセージを保存して表示
    appendChatMessage(protocol.id, { role: 'user', content: q })
    onUpdate()
    setLoading(true)

    try {
      const history = [...messages, { role: 'user' as const, content: q }]
        .map(m => ({ role: m.role, content: m.content }))
      const res = await fetch('/api/protocol-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: history,
          protocolContext: serializeProtocol(protocol, patient),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'エラーが発生しました')
      appendChatMessage(protocol.id, { role: 'assistant', content: data.answer })
      onUpdate()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'エラーが発生しました')
    } finally {
      setLoading(false)
    }
  }

  function handleClear() {
    clearChat(protocol.id)
    setConfirmClear(false)
    onUpdate()
  }

  const suggestions = [
    '現在のフェーズの進行は妥当ですか？',
    'エクササイズの代替案を提案してください',
    '負荷を下げたい場合の調整方法は？',
    '移行基準の評価方法を具体的に教えて',
    'この患者で特に注意すべき点は？',
  ]

  return (
    <div className="flex flex-col bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">

      {/* ヘッダー */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100 bg-gradient-to-r from-teal-50/60 to-white">
        <div className="w-9 h-9 rounded-xl bg-teal-100 flex items-center justify-center flex-shrink-0">
          <Bot className="w-4.5 h-4.5 text-teal-600" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-bold text-slate-800 font-display">AI相談 — このプロトコルについて質問・議論</h3>
          <p className="text-xs text-slate-400 truncate">
            プロトコルの全内容を把握したAIと多ターンで相談できます
          </p>
        </div>
        {messages.length > 0 && (
          confirmClear ? (
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className="text-xs text-red-500">履歴を削除？</span>
              <button onClick={handleClear}
                className="text-xs font-semibold text-white bg-red-500 px-2.5 py-1 rounded-lg hover:bg-red-600 transition-colors">
                削除
              </button>
              <button onClick={() => setConfirmClear(false)}
                className="text-xs text-slate-400 hover:text-slate-600">取消</button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmClear(true)}
              className="p-1.5 rounded-lg text-slate-300 hover:text-red-400 hover:bg-red-50 transition-colors flex-shrink-0"
              title="会話履歴を削除"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )
        )}
      </div>

      {/* 会話エリア */}
      <div className="overflow-y-auto px-5 py-4 space-y-4 min-h-[280px] max-h-[55vh]">
        {messages.length === 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm text-slate-500 font-body">
              <Sparkles className="w-3.5 h-3.5 text-teal-500" />
              こんな質問ができます：
            </div>
            <div className="flex flex-wrap gap-2">
              {suggestions.map(s => (
                <button
                  key={s}
                  onClick={() => sendMessage(s)}
                  disabled={loading}
                  className="text-xs bg-teal-50 text-teal-700 border border-teal-200
                    px-3 py-1.5 rounded-full hover:bg-teal-100 transition-colors font-body
                    disabled:opacity-50 text-left"
                >
                  {s}
                </button>
              ))}
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mt-2">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-3.5 h-3.5 text-amber-600 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-amber-700">
                  AIの回答は臨床意思決定の参考情報です。荷重開始・スポーツ復帰などの最終判断は有資格の医療者が行ってください。
                </p>
              </div>
            </div>
          </div>
        )}

        {messages.map(msg => (
          <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {msg.role === 'assistant' && (
              <div className="w-6 h-6 rounded-full bg-teal-100 flex items-center justify-center mr-2 mt-0.5 flex-shrink-0">
                <Bot className="w-3 h-3 text-teal-600" />
              </div>
            )}
            <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm font-body whitespace-pre-wrap leading-relaxed ${
              msg.role === 'user'
                ? 'bg-[--color-primary] text-white rounded-tr-sm'
                : 'bg-slate-50 text-slate-700 border border-slate-100 rounded-tl-sm'
            }`}>
              {msg.content}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="w-6 h-6 rounded-full bg-teal-100 flex items-center justify-center mr-2 flex-shrink-0">
              <Bot className="w-3 h-3 text-teal-600" />
            </div>
            <div className="bg-slate-50 border border-slate-100 rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-2">
              <Loader2 className="w-4 h-4 text-teal-500 animate-spin" />
              <span className="text-xs text-slate-400">プロトコルを確認しながら回答中...</span>
            </div>
          </div>
        )}

        {error && (
          <div className="text-xs text-red-500 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
            {error}
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* 入力エリア */}
      <div className="px-5 py-4 border-t border-slate-100 bg-slate-50/50">
        <div className="flex gap-2 items-end">
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault()
                sendMessage(input)
              }
            }}
            placeholder="プロトコルについて質問・相談（Shift+Enterで改行）"
            rows={2}
            disabled={loading}
            className="flex-1 text-sm border border-slate-200 rounded-xl px-4 py-2.5 resize-none
              focus:outline-none focus:ring-2 focus:ring-teal-500/40 focus:border-teal-400
              disabled:opacity-50 font-body placeholder:text-slate-300 bg-white"
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || loading}
            className="p-2.5 bg-[--color-primary] text-white rounded-xl
              hover:bg-[--color-primary-hover] disabled:opacity-40
              transition-colors flex-shrink-0 mb-0.5"
            title="送信"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
