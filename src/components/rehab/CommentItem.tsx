'use client'

import { useState } from 'react'
import type { VideoComment, ReactionType } from '@/types/rehab'
import { COMMENT_TYPE_LABELS, COMMENT_TYPE_COLORS, ROLE_LABELS } from '@/types/rehab'
import { addReply, toggleReaction, getCurrentUser, generateId } from '@/lib/rehab-store'
import { MessageSquare, ThumbsUp, AlertTriangle, Star, ChevronDown, ChevronUp } from 'lucide-react'
import { ROLE_COLORS } from './SpecialistReviewPanel'

const ROLE_ICONS: Record<string, string> = {
  admin: '👩‍⚕️', pt: '🦾', doctor: '🩺', trainer: '🏋️', viewer: '👁️',
  ballet_coach: '🩰', jazz_coach: '🎷', hiphop_coach: '🎤', breakdance_coach: '💪',
}

interface Props {
  comment: VideoComment
  onSeek: (t: number) => void
  onRefresh: () => void
}

function formatTime(s: number) {
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${String(sec).padStart(2, '0')}`
}

const REACTION_CONFIG: Array<{
  type: ReactionType
  icon: React.ElementType
  label: string
  activeClass: string
}> = [
  { type: 'agree', icon: ThumbsUp, label: '同意', activeClass: 'text-blue-600 bg-blue-50' },
  { type: 'review', icon: AlertTriangle, label: '要検討', activeClass: 'text-yellow-600 bg-yellow-50' },
  { type: 'important', icon: Star, label: '重要', activeClass: 'text-red-600 bg-red-50' },
]

export default function CommentItem({ comment, onSeek, onRefresh }: Props) {
  const user = getCurrentUser()
  const [replyText, setReplyText] = useState('')
  const [showReplies, setShowReplies] = useState(false)
  const [showReplyForm, setShowReplyForm] = useState(false)

  function handleReaction(type: ReactionType) {
    if (!user) return
    toggleReaction(comment.id, { type, userId: user.id, userName: user.name })
    onRefresh()
  }

  function handleReply() {
    if (!user || !replyText.trim()) return
    addReply(comment.id, {
      id: generateId('reply'),
      commentId: comment.id,
      text: replyText.trim(),
      authorId: user.id,
      authorName: user.name,
      createdAt: new Date().toISOString(),
    })
    setReplyText('')
    setShowReplyForm(false)
    setShowReplies(true)
    onRefresh()
  }

  const roleColors = ROLE_COLORS[comment.authorRole]

  return (
    <div className={`rounded-xl border-l-4 ${roleColors.border} bg-white shadow-sm p-4`}>
      <div className="flex items-start gap-3">
        {/* Role avatar */}
        <div className={`flex-shrink-0 w-8 h-8 rounded-full ${roleColors.bg} flex items-center justify-center text-base`}>
          {ROLE_ICONS[comment.authorRole] ?? '👤'}
        </div>
        <div className="flex-1 min-w-0">
          {/* Author + meta */}
          <div className="flex items-center gap-2 flex-wrap mb-2">
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${roleColors.badge}`}>
              {comment.authorName}
            </span>
            <span className={`text-xs px-1.5 py-0.5 rounded-full border ${roleColors.badge}`}>
              {ROLE_LABELS[comment.authorRole]}
            </span>
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${COMMENT_TYPE_COLORS[comment.type]}`}>
              {COMMENT_TYPE_LABELS[comment.type]}
            </span>
            <button
              onClick={() => onSeek(comment.timestamp)}
              className="text-xs font-mono bg-gray-100 hover:bg-gray-200 px-1.5 py-0.5 rounded transition-colors"
            >
              ▶ {formatTime(comment.timestamp)}
            </button>
            <span className="text-xs text-gray-400 ml-auto">{comment.createdAt.slice(0, 10)}</span>
          </div>
          <p className="text-sm leading-relaxed text-gray-800">{comment.text}</p>

          {/* Reactions */}
          <div className="flex items-center gap-1.5 mt-3">
            {REACTION_CONFIG.map(({ type, icon: Icon, label, activeClass }) => {
              const myReaction = comment.reactions.some(
                (r) => r.type === type && r.userId === user?.id,
              )
              const count = comment.reactions.filter((r) => r.type === type).length
              return (
                <button
                  key={type}
                  onClick={() => handleReaction(type)}
                  title={label}
                  className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border transition-colors ${
                    myReaction ? activeClass + ' border-current' : 'border-current/30 opacity-60 hover:opacity-100'
                  }`}
                >
                  <Icon className="w-3 h-3" />
                  {count > 0 && <span>{count}</span>}
                </button>
              )
            })}
            <button
              onClick={() => setShowReplyForm(!showReplyForm)}
              className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border border-current/30 opacity-60 hover:opacity-100 ml-1 transition-colors"
            >
              <MessageSquare className="w-3 h-3" />
              返信
            </button>
            {comment.replies.length > 0 && (
              <button
                onClick={() => setShowReplies(!showReplies)}
                className="flex items-center gap-1 px-2 py-0.5 text-xs opacity-60 hover:opacity-100 ml-auto"
              >
                {showReplies ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                返信 {comment.replies.length}件
              </button>
            )}
          </div>

          {/* Replies */}
          {showReplies && comment.replies.length > 0 && (
            <div className="mt-3 space-y-2 pl-3 border-l-2 border-gray-200">
              {comment.replies.map((r) => (
                <div key={r.id} className="bg-gray-50 rounded-lg p-2">
                  <div className="text-xs font-semibold text-gray-700">{r.authorName}</div>
                  <div className="text-sm text-gray-700 mt-0.5">{r.text}</div>
                </div>
              ))}
            </div>
          )}

          {/* Reply form */}
          {showReplyForm && (
            <div className="mt-3 flex gap-2">
              <input
                type="text"
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder="返信を入力..."
                className="flex-1 px-3 py-1.5 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-[#0d9488]"
                onKeyDown={(e) => { if (e.key === 'Enter') handleReply() }}
              />
              <button
                onClick={handleReply}
                className="px-3 py-1.5 text-xs font-medium bg-[#0d9488] hover:bg-[#0b8276] text-white rounded-lg transition-colors"
              >
                送信
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
