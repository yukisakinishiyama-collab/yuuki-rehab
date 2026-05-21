'use client'

import { useEffect, useState } from 'react'
import type { VideoComment, User, UserRole, PersonMarker } from '@/types/rehab'
import { ROLE_LABELS, COMMENT_TYPE_LABELS } from '@/types/rehab'
import { MOCK_USERS } from '@/lib/rehab-data'
import { getCommentsFallback, getCurrentUser, saveComment, generateId } from '@/lib/rehab-store'
import { getCase } from '@/lib/rehab-store'
import { Users, CheckCircle, Clock, Sparkles, MessageSquare, ChevronDown, ChevronUp, Music2 } from 'lucide-react'
import AISummaryPanel from './AISummaryPanel'

interface Props {
  caseId: string
  videoId: string
  movementType?: string
  videoSrc?: string | null
  personMarker?: PersonMarker | null
}

// Role → accent color
export const ROLE_COLORS: Record<UserRole, { border: string; bg: string; text: string; badge: string }> = {
  admin:   { border: 'border-teal-500',  bg: 'bg-teal-50',   text: 'text-teal-800',   badge: 'bg-teal-100 text-teal-800' },
  pt:      { border: 'border-teal-500',  bg: 'bg-teal-50',   text: 'text-teal-800',   badge: 'bg-teal-100 text-teal-800' },
  doctor:  { border: 'border-blue-500',  bg: 'bg-blue-50',   text: 'text-blue-800',   badge: 'bg-blue-100 text-blue-800' },
  trainer: { border: 'border-orange-500',bg: 'bg-orange-50', text: 'text-orange-800', badge: 'bg-orange-100 text-orange-800' },
  viewer:  { border: 'border-gray-400',  bg: 'bg-gray-50',   text: 'text-gray-700',   badge: 'bg-gray-100 text-gray-700' },
  // ダンス専門家
  ballet_coach:     { border: 'border-pink-500',    bg: 'bg-pink-50',    text: 'text-pink-800',    badge: 'bg-pink-100 text-pink-800' },
  jazz_coach:       { border: 'border-violet-500',  bg: 'bg-violet-50',  text: 'text-violet-800',  badge: 'bg-violet-100 text-violet-800' },
  hiphop_coach:     { border: 'border-yellow-500',  bg: 'bg-yellow-50',  text: 'text-yellow-800',  badge: 'bg-yellow-100 text-yellow-800' },
  breakdance_coach: { border: 'border-red-500',     bg: 'bg-red-50',     text: 'text-red-800',     badge: 'bg-red-100 text-red-800' },
}

const ROLE_ICONS: Record<UserRole, string> = {
  admin: '👩‍⚕️', pt: '🦾', doctor: '🩺', trainer: '🏋️', viewer: '👁️',
  ballet_coach: '🩰', jazz_coach: '🎷', hiphop_coach: '🎤', breakdance_coach: '💪',
}

interface SpecialistStatus {
  user: User
  commentCount: number
  lastCommentAt: string | null
  role: UserRole
  isAssigned: boolean
  isReviewer: boolean
}

interface CommonFinding {
  comment: VideoComment
  agreeCount: number
  agreeNames: string[]
}

export default function SpecialistReviewPanel({ caseId, videoId, movementType, videoSrc, personMarker }: Props) {
  const currentUser = getCurrentUser()
  const [comments, setComments] = useState<VideoComment[]>([])
  const [statuses, setStatuses] = useState<SpecialistStatus[]>([])
  const [commonFindings, setCommonFindings] = useState<CommonFinding[]>([])
  const [caseInfo, setCaseInfo] = useState<{ diagnosis?: string; age?: number; sport?: string }>({})
  const [showAI, setShowAI] = useState(false)
  const [expandFindings, setExpandFindings] = useState(true)

  function load() {
    const cms = getCommentsFallback(videoId, caseId)
    setComments(cms)

    const c = getCase(caseId)
    if (!c) return

    setCaseInfo({ diagnosis: c.diagnosis, age: c.age })

    // Build specialist statuses from assigned + reviewers + anyone who commented
    const relevantIds = new Set([
      ...c.assignedTo,
      ...c.reviewers,
      ...cms.map((cm) => cm.authorId),
    ])

    const ss: SpecialistStatus[] = []
    for (const uid of relevantIds) {
      const user = MOCK_USERS.find((u) => u.id === uid)
      if (!user) continue
      const userComments = cms.filter((cm) => cm.authorId === uid)
      ss.push({
        user,
        role: user.role,
        commentCount: userComments.length,
        lastCommentAt: userComments.length > 0
          ? userComments.sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0].createdAt
          : null,
        isAssigned: c.assignedTo.includes(uid),
        isReviewer: c.reviewers.includes(uid),
      })
    }
    // Sort: commented first, then by role priority
    const rolePriority: Record<UserRole, number> = {
      doctor: 0, pt: 1, admin: 1, trainer: 2, viewer: 3,
      ballet_coach: 4, jazz_coach: 4, hiphop_coach: 4, breakdance_coach: 4,
    }
    ss.sort((a, b) => {
      if (a.commentCount > 0 && b.commentCount === 0) return -1
      if (b.commentCount > 0 && a.commentCount === 0) return 1
      return rolePriority[a.role] - rolePriority[b.role]
    })
    setStatuses(ss)

    // Common findings: comments with 1+ agree reactions, or mentioned by 2+ specialists
    const findings: CommonFinding[] = []
    for (const cm of cms) {
      const agrees = cm.reactions.filter((r) => r.type === 'agree')
      const importants = cm.reactions.filter((r) => r.type === 'important')
      const total = agrees.length + importants.length
      if (total >= 1) {
        const names = [...new Set([...agrees.map((r) => r.userName), ...importants.map((r) => r.userName)])]
        findings.push({ comment: cm, agreeCount: total, agreeNames: names })
      }
    }
    findings.sort((a, b) => b.agreeCount - a.agreeCount)
    setCommonFindings(findings)
  }

  useEffect(() => { load() }, [caseId, videoId])

  const totalCommented = statuses.filter((s) => s.commentCount > 0).length
  const totalSpecialists = statuses.length

  return (
    <div className="flex flex-col space-y-4 pr-1">

      {/* AI Summary — TOP, always visible first */}
      <div className="border border-purple-200 rounded-xl bg-purple-50">
        <button
          onClick={() => setShowAI(!showAI)}
          className="flex items-center gap-2 w-full px-3 py-2.5 text-left"
        >
          <Sparkles className="w-4 h-4 text-purple-600 flex-shrink-0" />
          <span className="text-sm font-semibold text-purple-800">AI所見サマリー</span>
          <span className="ml-1 text-xs text-purple-500">
            {comments.length > 0 ? `${comments.length}件` : 'コメントなし'}
          </span>
          <span className="ml-auto text-xs font-medium text-purple-600 bg-purple-100 px-2 py-0.5 rounded-full">
            {showAI ? '閉じる' : '生成・表示'}
          </span>
        </button>
        {showAI && (
          <div className="px-3 pb-3">
            <AISummaryPanel videoId={videoId} caseId={caseId} comments={comments} movementType={movementType} videoSrc={videoSrc} caseInfo={caseInfo} personMarker={personMarker} />
          </div>
        )}
      </div>

      {/* Header stats */}
      <div className="flex items-center gap-2">
        <Users className="w-4 h-4 text-[#0d9488]" />
        <h3 className="font-semibold text-gray-900 text-sm">専門家レビュー状況</h3>
        <span className="ml-auto text-xs text-gray-500">
          {totalCommented}/{totalSpecialists}名がコメント済み
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div
          className="h-full bg-[#0d9488] rounded-full transition-all"
          style={{ width: totalSpecialists > 0 ? `${(totalCommented / totalSpecialists) * 100}%` : '0%' }}
        />
      </div>

      {/* Specialist list */}
      {(() => {
        const DANCE_ROLES: UserRole[] = ['ballet_coach', 'jazz_coach', 'hiphop_coach', 'breakdance_coach']
        const medicalStatuses = statuses.filter((s) => !DANCE_ROLES.includes(s.role))
        const danceStatuses = statuses.filter((s) => DANCE_ROLES.includes(s.role))

        const renderCard = ({ user, role, commentCount, lastCommentAt, isAssigned, isReviewer }: typeof statuses[0]) => {
          const colors = ROLE_COLORS[role]
          const hasCommented = commentCount > 0
          return (
            <div
              key={user.id}
              className={`rounded-xl border-l-4 ${colors.border} ${hasCommented ? colors.bg : 'bg-gray-50 border-gray-200'} p-3 transition-colors`}
            >
              <div className="flex items-center gap-2">
                <span className="text-lg leading-none">{ROLE_ICONS[role]}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className={`text-sm font-semibold ${hasCommented ? colors.text : 'text-gray-600'}`}>
                      {user.name}
                    </span>
                    <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${colors.badge}`}>
                      {ROLE_LABELS[role]}
                    </span>
                    {isReviewer && (
                      <span className="text-xs px-1.5 py-0.5 rounded-full bg-purple-100 text-purple-700">
                        レビュー担当
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">{user.department}</div>
                </div>
                <div className="flex-shrink-0 text-right">
                  {hasCommented ? (
                    <div>
                      <div className="flex items-center gap-1 justify-end">
                        <CheckCircle className="w-3.5 h-3.5 text-green-500" />
                        <span className={`text-xs font-semibold ${colors.text}`}>{commentCount}件</span>
                      </div>
                      {lastCommentAt && (
                        <div className="text-xs text-gray-400 mt-0.5">{lastCommentAt.slice(0, 10)}</div>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 text-gray-400">
                      <Clock className="w-3.5 h-3.5" />
                      <span className="text-xs">未確認</span>
                    </div>
                  )}
                </div>
              </div>

              {hasCommented && (
                <div className="mt-2 space-y-1">
                  {comments
                    .filter((cm) => cm.authorId === user.id)
                    .slice(0, 2)
                    .map((cm) => (
                      <div key={cm.id} className="text-xs text-gray-600 bg-white/60 rounded px-2 py-1 leading-relaxed">
                        <span className={`font-medium ${colors.text} mr-1`}>
                          [{COMMENT_TYPE_LABELS[cm.type]}]
                        </span>
                        {cm.text.length > 60 ? cm.text.slice(0, 60) + '…' : cm.text}
                      </div>
                    ))}
                </div>
              )}
            </div>
          )
        }

        return (
          <>
            {/* 医療・リハビリスタッフ */}
            {medicalStatuses.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide flex items-center gap-1.5">
                  <Users className="w-3 h-3" /> 医療・リハビリスタッフ
                </p>
                {medicalStatuses.map(renderCard)}
              </div>
            )}

            {/* ダンス専門家 */}
            {danceStatuses.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide flex items-center gap-1.5">
                  <Music2 className="w-3 h-3" /> ダンス専門家
                </p>
                {danceStatuses.map(renderCard)}
              </div>
            )}
          </>
        )
      })()}

      {/* Common findings */}
      {commonFindings.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
          <button
            onClick={() => setExpandFindings(!expandFindings)}
            className="flex items-center gap-2 w-full text-left"
          >
            <MessageSquare className="w-4 h-4 text-amber-600 flex-shrink-0" />
            <span className="text-sm font-semibold text-amber-800">
              共通所見（複数名が指摘・同意）
            </span>
            <span className="ml-auto bg-amber-200 text-amber-800 text-xs font-bold px-1.5 py-0.5 rounded-full">
              {commonFindings.length}件
            </span>
            {expandFindings
              ? <ChevronUp className="w-3.5 h-3.5 text-amber-600" />
              : <ChevronDown className="w-3.5 h-3.5 text-amber-600" />
            }
          </button>

          {expandFindings && (
            <div className="mt-3 space-y-2">
              {commonFindings.map(({ comment, agreeCount, agreeNames }) => (
                <div key={comment.id} className="bg-white rounded-lg p-2.5 border border-amber-100">
                  <div className="flex items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                        <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-full ${ROLE_COLORS[comment.authorRole].badge}`}>
                          {comment.authorName} ({ROLE_LABELS[comment.authorRole]})
                        </span>
                        <span className="text-xs text-gray-400">
                          {formatTime(comment.timestamp)}
                        </span>
                      </div>
                      <p className="text-xs text-gray-700 leading-relaxed">{comment.text}</p>
                      <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                        <span className="text-xs text-amber-700 font-medium">同意・重要視:</span>
                        {agreeNames.map((name) => (
                          <span key={name} className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">
                            {name}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center">
                      <span className="text-xs font-bold text-amber-700">{agreeCount}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

    </div>
  )
}

function formatTime(s: number) {
  return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`
}
