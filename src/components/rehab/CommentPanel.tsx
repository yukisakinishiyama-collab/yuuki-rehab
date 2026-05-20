'use client'

import { useState, useEffect } from 'react'
import type { VideoComment, CommentType } from '@/types/rehab'
import { COMMENT_TYPE_LABELS } from '@/types/rehab'
import { getComments, saveComment, getCurrentUser, generateId } from '@/lib/rehab-store'
import CommentItem from './CommentItem'
import { MessageSquare, Plus } from 'lucide-react'

interface Props {
  videoId: string
  caseId: string
  currentTime: number
  onSeek: (t: number) => void
}

const COMMENT_TYPES: CommentType[] = ['problem', 'improvement', 'risk', 'positive', 'suggestion']

const TYPE_COLORS: Record<CommentType, string> = {
  problem: 'border-red-300 bg-red-50 text-red-800',
  improvement: 'border-blue-300 bg-blue-50 text-blue-800',
  risk: 'border-orange-300 bg-orange-50 text-orange-800',
  positive: 'border-green-300 bg-green-50 text-green-800',
  suggestion: 'border-purple-300 bg-purple-50 text-purple-800',
}

function formatTime(s: number) {
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${String(sec).padStart(2, '0')}`
}

export default function CommentPanel({ videoId, caseId, currentTime, onSeek }: Props) {
  const user = getCurrentUser()
  const [comments, setComments] = useState<VideoComment[]>([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ text: '', type: 'problem' as CommentType, timestamp: 0 })

  function load() {
    setComments(getComments(videoId).sort((a, b) => a.timestamp - b.timestamp))
  }

  useEffect(() => { load() }, [videoId])

  function openForm() {
    setForm({ text: '', type: 'problem', timestamp: currentTime })
    setShowForm(true)
  }

  function submitComment() {
    if (!user || !form.text.trim()) return
    const comment: VideoComment = {
      id: generateId('comment'),
      videoId,
      caseId,
      timestamp: form.timestamp,
      text: form.text.trim(),
      type: form.type,
      authorId: user.id,
      authorName: user.name,
      authorRole: user.role,
      createdAt: new Date().toISOString(),
      replies: [],
      reactions: [],
    }
    saveComment(comment)
    setShowForm(false)
    setForm({ text: '', type: 'problem', timestamp: 0 })
    load()
  }

  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-[#0d9488]" />
          <h3 className="font-semibold text-gray-900">コメント</h3>
          {comments.length > 0 && (
            <span className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full">
              {comments.length}
            </span>
          )}
        </div>
        <button
          onClick={openForm}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-[#0d9488] hover:bg-[#0b8276] text-white text-xs font-medium rounded-lg transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          コメント追加
        </button>
      </div>

      {/* Add comment form */}
      {showForm && (
        <div className="mb-4 bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">タイムスタンプ:</span>
            <code className="text-xs font-mono bg-white border border-gray-200 px-2 py-0.5 rounded text-[#0d9488]">
              {formatTime(form.timestamp)}
            </code>
            <button
              onClick={() => setForm({ ...form, timestamp: currentTime })}
              className="text-xs text-gray-400 hover:text-gray-700 underline"
            >
              現在位置に更新
            </button>
          </div>

          <div className="flex gap-1.5 flex-wrap">
            {COMMENT_TYPES.map((t) => (
              <button
                key={t}
                onClick={() => setForm({ ...form, type: t })}
                className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                  form.type === t ? TYPE_COLORS[t] : 'border-gray-200 text-gray-500 hover:border-gray-300'
                }`}
              >
                {COMMENT_TYPE_LABELS[t]}
              </button>
            ))}
          </div>

          <textarea
            rows={3}
            value={form.text}
            onChange={(e) => setForm({ ...form, text: e.target.value })}
            placeholder="所見・コメントを入力..."
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0d9488] resize-none"
          />

          <div className="flex justify-end gap-2">
            <button
              onClick={() => setShowForm(false)}
              className="px-3 py-1.5 text-xs text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              キャンセル
            </button>
            <button
              onClick={submitComment}
              disabled={!form.text.trim()}
              className="px-3 py-1.5 text-xs text-white bg-[#0d9488] hover:bg-[#0b8276] rounded-lg transition-colors disabled:opacity-50"
            >
              投稿
            </button>
          </div>
        </div>
      )}

      {/* Comment list */}
      <div className="space-y-3 pr-1">
        {comments.length === 0 ? (
          <div className="text-center py-10 text-gray-400">
            <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p className="text-sm">まだコメントがありません</p>
            <p className="text-xs mt-1">動画を再生しながらコメントを追加してください</p>
          </div>
        ) : (
          comments.map((c) => (
            <CommentItem key={c.id} comment={c} onSeek={onSeek} onRefresh={load} />
          ))
        )}
      </div>
    </div>
  )
}
