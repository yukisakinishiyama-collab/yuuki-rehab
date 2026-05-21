'use client'

import { useState, useEffect, useRef } from 'react'
import { getChatMessages, addChatMessage, deleteChatMessage, getCurrentUser, generateId } from '@/lib/rehab-store'
import type { ChatMessage } from '@/types/rehab'
import { ROLE_LABELS } from '@/types/rehab'
import { Send, Trash2, MessageSquareDot, Link2 } from 'lucide-react'

interface Props {
  caseId: string
  videoId: string
  videoLabel?: string
}

const ROLE_COLORS: Record<string, string> = {
  admin:             'bg-[#1e3a5f] text-white',
  pt:                'bg-teal-600 text-white',
  doctor:            'bg-indigo-600 text-white',
  trainer:           'bg-orange-500 text-white',
  ballet_coach:      'bg-pink-500 text-white',
  jazz_coach:        'bg-purple-500 text-white',
  hiphop_coach:      'bg-yellow-500 text-gray-900',
  breakdance_coach:  'bg-red-600 text-white',
  viewer:            'bg-gray-400 text-white',
}

function initials(name: string): string {
  return name.split(/\s+/).map(n => n[0]).join('').slice(0, 2)
}

export default function SpecialistChat({ caseId, videoId, videoLabel }: Props) {
  const currentUser = getCurrentUser()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [text, setText] = useState('')
  const [linkVideo, setLinkVideo] = useState(true)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  function load() {
    // 動画リンクON時は動画固有 + ケース共通の両方を取得してマージ
    const vidMsgs = getChatMessages(caseId, videoId)
    const caseMsgs = getChatMessages(caseId, undefined).filter(m => !m.videoId)
    const merged = [...vidMsgs, ...caseMsgs].sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    // dedup
    const seen = new Set<string>()
    setMessages(merged.filter(m => { if (seen.has(m.id)) return false; seen.add(m.id); return true }))
  }

  useEffect(() => {
    load()
  }, [caseId, videoId])

  // Auto-scroll to bottom when new message arrives
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  function handleSend() {
    if (!text.trim() || !currentUser) return
    const msg: ChatMessage = {
      id: generateId('chat'),
      caseId,
      videoId: linkVideo ? videoId : undefined,
      text: text.trim(),
      authorId: currentUser.id,
      authorName: currentUser.name,
      authorRole: currentUser.role,
      createdAt: new Date().toISOString(),
      mentions: [],
    }
    addChatMessage(msg)
    setText('')
    load()
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  function handleDelete(id: string) {
    deleteChatMessage(id)
    load()
  }

  function formatTime(iso: string) {
    const d = new Date(iso)
    const today = new Date()
    const isToday = d.toDateString() === today.toDateString()
    if (isToday) {
      return d.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })
    }
    return d.toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  const isOwn = (msg: ChatMessage) => msg.authorId === currentUser?.id

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header */}
      <div className="flex items-center justify-between pb-2 mb-2 border-b border-gray-100">
        <div className="flex items-center gap-1.5">
          <MessageSquareDot className="w-4 h-4 text-[#0d9488]" />
          <span className="text-xs font-semibold text-gray-700">専門家チャット</span>
          <span className="text-[10px] text-gray-400 bg-gray-100 rounded-full px-2 py-0.5">
            {messages.length}件
          </span>
        </div>
        {/* Link to video toggle */}
        <button
          onClick={() => setLinkVideo(!linkVideo)}
          className={`flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border transition-colors ${
            linkVideo
              ? 'bg-teal-50 border-teal-300 text-teal-700'
              : 'bg-gray-50 border-gray-200 text-gray-500'
          }`}
          title={linkVideo ? 'この動画に紐づけて送信' : 'ケース全体に送信'}
        >
          <Link2 className="w-3 h-3" />
          {linkVideo ? '動画に紐づけ' : '全体'}
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-3 pr-1 min-h-0">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-gray-400 text-xs text-center gap-2">
            <MessageSquareDot className="w-7 h-7 opacity-30" />
            <p>専門家間のチャットはここに表示されます</p>
            <p className="text-gray-300">下のボックスからメッセージを送信してください</p>
          </div>
        ) : (
          messages.map((msg) => {
            const own = isOwn(msg)
            const avatarColor = ROLE_COLORS[msg.authorRole] ?? 'bg-gray-400 text-white'
            return (
              <div key={msg.id} className={`flex items-end gap-2 group ${own ? 'flex-row-reverse' : ''}`}>
                {/* Avatar */}
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 ${avatarColor}`}>
                  {initials(msg.authorName)}
                </div>

                {/* Bubble */}
                <div className={`max-w-[75%] ${own ? 'items-end' : 'items-start'} flex flex-col gap-0.5`}>
                  {/* Name + role */}
                  {!own && (
                    <div className="flex items-center gap-1.5 px-0.5">
                      <span className="text-[10px] font-semibold text-gray-700">{msg.authorName}</span>
                      <span className="text-[9px] text-gray-400">{ROLE_LABELS[msg.authorRole]}</span>
                      {msg.videoId && (
                        <span className="text-[9px] bg-teal-50 text-teal-600 px-1.5 rounded-full border border-teal-200">
                          動画
                        </span>
                      )}
                    </div>
                  )}

                  <div className={`relative rounded-2xl px-3 py-2 text-xs leading-relaxed shadow-sm ${
                    own
                      ? 'bg-[#1e3a5f] text-white rounded-br-md'
                      : 'bg-gray-100 text-gray-800 rounded-bl-md'
                  }`}>
                    {/* Message text - preserve newlines */}
                    <p className="whitespace-pre-wrap break-words">{msg.text}</p>

                    {/* Delete button (own messages only, on hover) */}
                    {own && (
                      <button
                        onClick={() => handleDelete(msg.id)}
                        className="absolute -top-1.5 -left-1.5 w-4 h-4 bg-red-500 hover:bg-red-600 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                      >
                        <Trash2 className="w-2.5 h-2.5" />
                      </button>
                    )}
                  </div>

                  <span className={`text-[9px] text-gray-400 px-0.5 ${own ? 'text-right' : ''}`}>
                    {formatTime(msg.createdAt)}
                  </span>
                </div>
              </div>
            )
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="mt-3 border-t border-gray-100 pt-3">
        {!currentUser ? (
          <p className="text-xs text-gray-400 text-center">ログインしてチャットに参加してください</p>
        ) : (
          <div className="flex gap-2 items-end">
            <textarea
              ref={inputRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="メッセージを入力… (Enter で送信 / Shift+Enter で改行)"
              rows={2}
              className="flex-1 text-xs px-3 py-2 border border-gray-200 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-[#0d9488] focus:border-transparent leading-relaxed"
            />
            <button
              onClick={handleSend}
              disabled={!text.trim()}
              className="w-9 h-9 bg-[#0d9488] hover:bg-[#0b8276] disabled:bg-gray-200 text-white rounded-xl flex items-center justify-center transition-colors flex-shrink-0"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
