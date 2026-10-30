'use client'
/**
 * 経営相談（AIチャット）— 院長のみ・経営メニュー（隠しモード）の中
 *
 * 院の集計の数字（売上・来院・予約・PDCA・目標）を AI に渡して、チャットで相談する。
 * 患者さんの個人情報は渡さない。渡している数字は「AIに渡している数字」でそのまま見られる。
 * 1往復ごとに Anthropic の API の料金がかかる（数円〜十数円ほどの目安）。
 */
import { useEffect, useRef, useState, type FormEvent } from 'react'
import Link from 'next/link'
import { Eye, EyeOff, RefreshCcw, Send, Sparkles, Trash2 } from 'lucide-react'
import { useMarketingRole } from '@/lib/marketing/use-role'

interface Msg {
  role: 'user' | 'assistant'
  text: string
  at: string
}

const GOAL_KEY = 'keiei:goal'

const STARTERS = [
  '今月の売上は目標に届きそう？足りないなら、何を優先すればいい？',
  '来院が少ない曜日に人を増やすには、費用をかけずに何ができる？',
  '自費の割合を上げたい。今の内訳を見て、無理のない進め方は？',
  '先月来られて今月まだ来ていない方が多い。声かけの考え方を教えて',
  'いま動いているPDCAは続ける？直す？数字から判断して',
]

function readGoal(): number | null {
  try {
    const v = Number(window.localStorage.getItem(GOAL_KEY))
    return Number.isFinite(v) && v > 0 ? v : null
  } catch {
    return null
  }
}

function timeLabel(iso: string): string {
  const d = new Date(iso)
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export default function KeieiChatPage() {
  const { isAdmin } = useMarketingRole()
  const [messages, setMessages] = useState<Msg[] | null>(null)
  const [context, setContext] = useState('')
  const [ai, setAi] = useState<boolean | null>(null)
  const [showContext, setShowContext] = useState(false)
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  const load = () => {
    const goal = readGoal()
    return fetch(`/api/marketing/keiei/chat${goal ? `?goal=${goal}` : ''}`, { cache: 'no-store' })
      .then((r) => r.json())
      .then((d: { ok?: boolean; messages?: Msg[]; context?: string; ai?: boolean; error?: string }) => {
        if (!d.ok) throw new Error(d.error ?? '読み込めませんでした')
        setMessages(d.messages ?? [])
        setContext(d.context ?? '')
        setAi(Boolean(d.ai))
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : '読み込めませんでした'))
  }

  useEffect(() => {
    void load()
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' })
  }, [messages, busy])

  const send = async (text: string) => {
    const t = text.trim()
    if (!t || busy) return
    setError('')
    setBusy(true)
    setInput('')
    const now = new Date().toISOString()
    setMessages((m) => [...(m ?? []), { role: 'user', text: t, at: now }])
    try {
      const res = await fetch('/api/marketing/keiei/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: t, goal: readGoal() }),
      })
      const d = (await res.json()) as { ok?: boolean; reply?: Msg; error?: string }
      if (!res.ok || !d.ok || !d.reply) throw new Error(d.error ?? `HTTP ${res.status}`)
      setMessages((m) => [...(m ?? []), d.reply!])
    } catch (e) {
      setError(e instanceof Error ? e.message : '返事を作れませんでした')
    } finally {
      setBusy(false)
    }
  }

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    void send(input)
  }

  const clear = async () => {
    if (!window.confirm('これまでの会話を消して、新しく始めますか？')) return
    await fetch('/api/marketing/keiei/chat', { method: 'DELETE' })
    setMessages([])
  }

  if (!isAdmin) {
    return <p className="text-sm text-slate-600">この画面は院長だけが使えます。</p>
  }

  return (
    <div className="flex h-[calc(100dvh-20rem)] min-h-[480px] flex-col gap-3 md:h-[calc(100dvh-9rem)]">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-black text-slate-900">
            <Sparkles className="h-5 w-5 text-teal-700" />
            経営相談（AI）
          </h1>
          <p className="text-xs text-slate-500">
            売上・来院・予約・PDCA・目標の集計を見たうえで答えます。患者さんの名前などは渡しません。1往復ごとにAIの利用料（数円〜十数円ほど）がかかります。
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <button type="button" onClick={() => setShowContext((v) => !v)} className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 max-lg:min-h-10">
            {showContext ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            AIに渡している数字
          </button>
          <button type="button" onClick={() => void load()} className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 max-lg:min-h-10 max-lg:justify-center max-lg:min-w-10" title="数字を取り直す">
            <RefreshCcw className="h-3.5 w-3.5" />
          </button>
          <button type="button" onClick={clear} className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 max-lg:min-h-10">
            <Trash2 className="h-3.5 w-3.5" />
            新しく始める
          </button>
        </div>
      </div>

      {showContext && (
        <pre className="max-h-60 overflow-auto whitespace-pre-wrap rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs leading-relaxed text-slate-700">{context || '（読み込み中…）'}</pre>
      )}

      {ai === false && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">AI の設定（ANTHROPIC_API_KEY）が無いため、返事はできません。数字の確認だけできます。</p>
      )}

      <div className="flex-1 overflow-y-auto rounded-xl border border-slate-200 bg-white p-3">
        {messages === null ? (
          <p className="text-sm text-slate-500">読み込み中…</p>
        ) : messages.length === 0 ? (
          <div className="space-y-3">
            <p className="text-sm text-slate-600">何でも聞いてください。たとえば：</p>
            <div className="flex flex-wrap gap-2">
              {STARTERS.map((s) => (
                <button key={s} type="button" onClick={() => void send(s)} disabled={busy || ai === false} className="rounded-full border border-teal-200 bg-teal-50 px-3 py-1.5 text-left text-xs font-medium text-teal-800 hover:bg-teal-100 disabled:opacity-50 max-lg:min-h-10">
                  {s}
                </button>
              ))}
            </div>
            <p className="text-xs text-slate-500">
              目標の金額は<Link href="/marketing/sales/goal" className="underline">月の目標への道すじ</Link>で入れたものを使います。
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {messages.map((m, i) => (
              <div key={`${m.at}-${i}`} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${m.role === 'user' ? 'bg-teal-700 text-white' : 'bg-slate-100 text-slate-900'}`}>
                  {m.text}
                  <div className={`mt-1 text-xs ${m.role === 'user' ? 'text-teal-100' : 'text-slate-500'}`}>{timeLabel(m.at)}</div>
                </div>
              </div>
            ))}
            {busy && (
              <div className="flex justify-start">
                <div className="rounded-2xl bg-slate-100 px-3.5 py-2.5 text-sm text-slate-500">数字を見て考えています…</div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {error && <p className="text-xs text-red-700">{error}</p>}

      <form onSubmit={onSubmit} className="flex items-end gap-2">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) void send(input)
          }}
          rows={2}
          placeholder="相談したいことを書く（Ctrl+Enter で送る）"
          className="min-h-[44px] flex-1 resize-y rounded-xl border border-slate-300 px-3 py-2 text-sm"
          disabled={busy || ai === false}
        />
        <button type="submit" disabled={busy || !input.trim() || ai === false} className="inline-flex h-11 items-center gap-1 rounded-xl bg-teal-700 px-4 text-sm font-bold text-white disabled:opacity-50">
          <Send className="h-4 w-4" />
          送る
        </button>
      </form>
    </div>
  )
}
