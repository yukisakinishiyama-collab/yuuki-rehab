'use client'

import { useState, useRef, useEffect } from 'react'
import { Search, X, Loader2, BookOpen, AlertCircle } from 'lucide-react'

interface Props {
  onClose: () => void
  protocolContext?: string
  initialQuery?: string
}

interface Message {
  role: 'user' | 'assistant'
  text: string
}

export default function ProtocolSearchModal({ onClose, protocolContext, initialQuery }: Props) {
  const [query, setQuery] = useState(initialQuery ?? '')
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  // initialQueryがあれば開いた瞬間に自動検索
  useEffect(() => {
    if (initialQuery?.trim()) {
      sendQuery(initialQuery.trim())
    } else {
      inputRef.current?.focus()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function sendQuery(q: string) {
    if (!q || loading) return
    setQuery('')
    setError('')
    setMessages(prev => [...prev, { role: 'user', text: q }])
    setLoading(true)
    try {
      const res = await fetch('/api/protocol-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q, context: protocolContext }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'エラーが発生しました')
      setMessages(prev => [...prev, { role: 'assistant', text: data.answer }])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'エラーが発生しました')
    } finally {
      setLoading(false)
    }
  }

  function handleSearch(e?: React.FormEvent) {
    e?.preventDefault()
    sendQuery(query.trim())
  }

  const suggestions = [
    'SLRとは何ですか？',
    'CKCとOKCの違いは？',
    'ACL術後の荷重開始時期',
    'VMOを鍛えるエクササイズ',
  ]

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-lg sm:rounded-2xl shadow-2xl flex flex-col max-h-[90dvh] sm:max-h-[80vh]">

        {/* ヘッダー */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100 flex-shrink-0">
          <div className="w-8 h-8 rounded-xl bg-teal-50 flex items-center justify-center">
            <Search className="w-4 h-4 text-teal-600" />
          </div>
          <div className="flex-1">
            <h3 className="text-base font-bold text-slate-800 font-display">プロトコル用語を調べる</h3>
            <p className="text-xs text-slate-400">分からない用語・概念をAIに質問できます</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 会話エリア */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {messages.length === 0 && (
            <div className="space-y-3">
              <p className="text-sm text-slate-500 font-body">よくある質問から選ぶ：</p>
              <div className="flex flex-wrap gap-2">
                {suggestions.map(s => (
                  <button
                    key={s}
                    onClick={() => { setQuery(s); inputRef.current?.focus() }}
                    className="text-xs bg-teal-50 text-teal-700 border border-teal-200
                      px-3 py-1.5 rounded-full hover:bg-teal-100 transition-colors font-body"
                  >
                    {s}
                  </button>
                ))}
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mt-2">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-3.5 h-3.5 text-amber-600 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-amber-700">
                    AIの回答は参考情報です。最終的な臨床判断は有資格者が行ってください。
                  </p>
                </div>
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {msg.role === 'assistant' && (
                <div className="w-6 h-6 rounded-full bg-teal-100 flex items-center justify-center mr-2 mt-0.5 flex-shrink-0">
                  <BookOpen className="w-3 h-3 text-teal-600" />
                </div>
              )}
              <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm font-body whitespace-pre-wrap ${
                msg.role === 'user'
                  ? 'bg-[--color-primary] text-white rounded-tr-sm'
                  : 'bg-slate-50 text-slate-700 border border-slate-100 rounded-tl-sm'
              }`}>
                {msg.text}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex justify-start">
              <div className="w-6 h-6 rounded-full bg-teal-100 flex items-center justify-center mr-2 flex-shrink-0">
                <BookOpen className="w-3 h-3 text-teal-600" />
              </div>
              <div className="bg-slate-50 border border-slate-100 rounded-2xl rounded-tl-sm px-4 py-3">
                <Loader2 className="w-4 h-4 text-teal-500 animate-spin" />
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
        <form onSubmit={handleSearch} className="px-5 py-4 border-t border-slate-100 flex-shrink-0">
          <div className="flex gap-2">
            <input
              ref={inputRef}
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="例：SLRとは？ CKCエクササイズの目的は？"
              disabled={loading}
              className="flex-1 text-sm border border-slate-200 rounded-xl px-4 py-2.5
                focus:outline-none focus:ring-2 focus:ring-teal-500/40 focus:border-teal-400
                disabled:opacity-50 font-body placeholder:text-slate-300"
            />
            <button
              type="submit"
              disabled={!query.trim() || loading}
              className="p-2.5 bg-[--color-primary] text-white rounded-xl
                hover:bg-[--color-primary-hover] disabled:opacity-40
                transition-colors flex-shrink-0"
            >
              <Search className="w-4 h-4" />
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
