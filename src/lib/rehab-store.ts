import type { User, RehabCase, VideoComment, EvaluationResult, SavedAnnotation, ChatMessage, PersonMarker, AISummary, ExerciseProgram, ROMSession, DiscussionSession } from '@/types/rehab'
import { MOCK_CASES, MOCK_COMMENTS, MOCK_EVALUATIONS, MOCK_USERS } from './rehab-data'
import { deleteVideoBlob } from './video-db'

const MOCK_CREDENTIALS: Record<string, string> = {
  'user-001': 'rehab2026',
}

const STORE_VERSION = '6' // サービス転換：型拡張

const KEYS = {
  cases: 'rehabCases',
  comments: 'rehabComments',
  evaluations: 'rehabEvals',
  annotations: 'rehabAnnotations',
  chat: 'rehabChat',
  markers: 'rehabMarkers',
  aiSummaries: 'rehabAISummaries',
  exercisePrograms: 'rehabExercisePrograms',
  romSessions:        'rehabROMSessions',
  discussions:        'rehabDiscussions',
  user: 'rehabUser',
  initialized: 'rehabInitialized',
  version: 'rehabVersion',
} as const

function get<T>(key: string): T[] {
  if (typeof window === 'undefined') return []
  try {
    return JSON.parse(localStorage.getItem(key) ?? '[]') as T[]
  } catch {
    return []
  }
}

function set<T>(key: string, data: T[]): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(key, JSON.stringify(data))
}

export function initStore(): void {
  if (typeof window === 'undefined') return
  const alreadyInit = localStorage.getItem(KEYS.initialized)
  const savedVersion = localStorage.getItem(KEYS.version)

  if (alreadyInit && savedVersion === STORE_VERSION) return // 最新バージョン済み

  if (alreadyInit && savedVersion !== STORE_VERSION) {
    // バージョンアップ: ユーザー・コメント・症例を最新データで上書き
    localStorage.setItem(KEYS.cases, JSON.stringify(MOCK_CASES))
    localStorage.setItem(KEYS.comments, JSON.stringify(MOCK_COMMENTS))
    localStorage.removeItem('rehabUser') // 古いログイン情報をクリア
    localStorage.setItem(KEYS.version, STORE_VERSION)
    return
  }

  // 初回: 全データを投入
  localStorage.setItem(KEYS.cases, JSON.stringify(MOCK_CASES))
  localStorage.setItem(KEYS.comments, JSON.stringify(MOCK_COMMENTS))
  localStorage.setItem(KEYS.evaluations, JSON.stringify(MOCK_EVALUATIONS))
  localStorage.setItem(KEYS.initialized, '1')
  localStorage.setItem(KEYS.version, STORE_VERSION)
}

// Auth — returns true on success, false if credentials are wrong
export function login(userId: string, password: string): boolean {
  const expected = MOCK_CREDENTIALS[userId]
  if (!expected || password !== expected) return false
  const user = MOCK_USERS.find((u) => u.id === userId)
  if (!user) return false
  localStorage.setItem(KEYS.user, JSON.stringify(user))
  return true
}

export function logout(): void {
  localStorage.removeItem(KEYS.user)
}

// QRログイン用トークン（30分有効）
// フォーマット: userId~expires~nonce（URLセーフ、localStorage不要）
export function generateQRToken(): string {
  const userId = 'user-001'
  const expires = Date.now() + 30 * 60 * 1000
  const nonce = Math.random().toString(36).slice(2, 8)
  return `${userId}~${expires}~${nonce}`
}

export function loginWithQRToken(token: string): boolean {
  if (typeof window === 'undefined') return false
  try {
    const parts = token.split('~')
    if (parts.length < 2) return false
    const userId = parts[0]
    const expires = parseInt(parts[1], 10)
    if (!userId || isNaN(expires) || Date.now() > expires) return false
    const user = MOCK_USERS.find((u) => u.id === userId)
    if (!user) return false
    localStorage.setItem(KEYS.user, JSON.stringify(user))
    return true
  } catch { return false }
}

export function getCurrentUser(): User | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(KEYS.user)
    return raw ? (JSON.parse(raw) as User) : null
  } catch {
    return null
  }
}

// Cases
export function getCases(): RehabCase[] {
  return get<RehabCase>(KEYS.cases)
}

export function getCase(id: string): RehabCase | undefined {
  return getCases().find((c) => c.id === id)
}

export function saveCase(c: RehabCase): void {
  const cases = getCases()
  const idx = cases.findIndex((x) => x.id === c.id)
  if (idx >= 0) cases[idx] = c
  else cases.unshift(c)
  set(KEYS.cases, cases)
}

export function updateDeliveryStatus(caseId: string, status: import('@/types/rehab').DeliveryStatus): void {
  const cases = getCases()
  const c = cases.find((x) => x.id === caseId)
  if (!c) return
  c.deliveryStatus = status
  c.updatedAt = new Date().toISOString()
  set(KEYS.cases, cases)
}

export function addVideoToCase(caseId: string, video: RehabCase['videos'][0]): void {
  const cases = getCases()
  const c = cases.find((x) => x.id === caseId)
  if (!c) return
  c.videos.push(video)
  c.updatedAt = new Date().toISOString()
  set(KEYS.cases, cases)
}

export function removeVideoFromCase(caseId: string, videoId: string): void {
  const cases = getCases()
  const c = cases.find((x) => x.id === caseId)
  if (!c) return
  c.videos = c.videos.filter((v) => v.id !== videoId)
  c.updatedAt = new Date().toISOString()
  set(KEYS.cases, cases)
  // 関連コメント・評価・アノテーションも削除
  set(KEYS.comments, get<VideoComment>(KEYS.comments).filter((cm) => cm.videoId !== videoId))
  set(KEYS.evaluations, get<EvaluationResult>(KEYS.evaluations).filter((e) => e.videoId !== videoId))
  set(KEYS.annotations, get<SavedAnnotation>(KEYS.annotations).filter((a) => a.videoId !== videoId))
  // blob URLもキャッシュから削除
  _videoUrlCache.delete(videoId)
  try { sessionStorage.removeItem(`rehabVideo_${videoId}`) } catch {}
  // IndexedDBからも削除（非同期・エラーは無視）
  deleteVideoBlob(videoId).catch(() => {})
}

// Comments
export function getComments(videoId: string): VideoComment[] {
  return get<VideoComment>(KEYS.comments).filter((c) => c.videoId === videoId)
}

// 動画のコメントがない場合に同じ症例の全コメントを返す（専門家パネル用）
export function getCommentsFallback(videoId: string, caseId: string): VideoComment[] {
  const all = get<VideoComment>(KEYS.comments)
  const byVideo = all.filter((c) => c.videoId === videoId)
  if (byVideo.length > 0) return byVideo
  return all.filter((c) => c.caseId === caseId)
}

export function saveComment(comment: VideoComment): void {
  const comments = get<VideoComment>(KEYS.comments)
  const idx = comments.findIndex((c) => c.id === comment.id)
  if (idx >= 0) comments[idx] = comment
  else comments.push(comment)
  set(KEYS.comments, comments)
}

export function addReply(
  commentId: string,
  reply: VideoComment['replies'][0],
): void {
  const comments = get<VideoComment>(KEYS.comments)
  const comment = comments.find((c) => c.id === commentId)
  if (!comment) return
  comment.replies.push(reply)
  set(KEYS.comments, comments)
}

export function toggleReaction(
  commentId: string,
  reaction: VideoComment['reactions'][0],
): void {
  const comments = get<VideoComment>(KEYS.comments)
  const comment = comments.find((c) => c.id === commentId)
  if (!comment) return
  const idx = comment.reactions.findIndex(
    (r) => r.type === reaction.type && r.userId === reaction.userId,
  )
  if (idx >= 0) comment.reactions.splice(idx, 1)
  else comment.reactions.push(reaction)
  set(KEYS.comments, comments)
}

// Evaluations
export function getEvaluation(caseId: string, videoId: string): EvaluationResult | undefined {
  return get<EvaluationResult>(KEYS.evaluations).find(
    (e) => e.caseId === caseId && e.videoId === videoId,
  )
}

export function saveEvaluation(eval_: EvaluationResult): void {
  const evals = get<EvaluationResult>(KEYS.evaluations)
  const idx = evals.findIndex((e) => e.id === eval_.id)
  if (idx >= 0) evals[idx] = eval_
  else evals.push(eval_)
  set(KEYS.evaluations, evals)
}

export function getAllEvaluations(caseId: string): EvaluationResult[] {
  return get<EvaluationResult>(KEYS.evaluations).filter((e) => e.caseId === caseId)
}

// Video URL cache — module-level Map survives Next.js client-side navigation
// (only lost on hard page reload, which is unavoidable without a real backend)
const _videoUrlCache = new Map<string, string>()

export function saveVideoUrl(videoId: string, url: string): void {
  if (typeof window === 'undefined') return
  _videoUrlCache.set(videoId, url)
  try {
    sessionStorage.setItem(`rehabVideo_${videoId}`, url)
  } catch {
    // sessionStorage quota exceeded - ignore
  }
}

export function getVideoUrl(videoId: string): string | null {
  if (typeof window === 'undefined') return null
  // Check in-memory first (fastest, survives SPA navigation)
  const cached = _videoUrlCache.get(videoId)
  if (cached) return cached
  // Fall back to sessionStorage (also works within same tab session)
  const stored = sessionStorage.getItem(`rehabVideo_${videoId}`)
  if (stored) {
    _videoUrlCache.set(videoId, stored) // warm the in-memory cache
    return stored
  }
  return null
}

export function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

// Saved Annotations
export function getAnnotations(videoId: string): SavedAnnotation[] {
  return get<SavedAnnotation>(KEYS.annotations)
    .filter((a) => a.videoId === videoId)
    .sort((a, b) => a.timestamp - b.timestamp)
}

export function saveAnnotation(ann: SavedAnnotation): void {
  const anns = get<SavedAnnotation>(KEYS.annotations)
  const idx = anns.findIndex((a) => a.id === ann.id)
  if (idx >= 0) anns[idx] = ann
  else anns.push(ann)
  set(KEYS.annotations, anns)
}

export function deleteAnnotation(id: string): void {
  const anns = get<SavedAnnotation>(KEYS.annotations).filter((a) => a.id !== id)
  set(KEYS.annotations, anns)
}

// ── Specialist Chat ─────────────────────────────────────────────────────────

export function getChatMessages(caseId: string, videoId?: string): ChatMessage[] {
  const all = get<ChatMessage>(KEYS.chat)
  return all
    .filter((m) => m.caseId === caseId && (videoId ? m.videoId === videoId : true))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
}

export function addChatMessage(msg: ChatMessage): void {
  const all = get<ChatMessage>(KEYS.chat)
  all.push(msg)
  set(KEYS.chat, all)
}

export function deleteChatMessage(id: string): void {
  set(KEYS.chat, get<ChatMessage>(KEYS.chat).filter((m) => m.id !== id))
}

// ── Person Marker ────────────────────────────────────────────────────────────

export function getPersonMarker(videoId: string): PersonMarker | null {
  return get<PersonMarker>(KEYS.markers).find((m) => m.videoId === videoId) ?? null
}

export function savePersonMarker(marker: PersonMarker): void {
  const all = get<PersonMarker>(KEYS.markers).filter((m) => m.videoId !== marker.videoId)
  all.push(marker)
  set(KEYS.markers, all)
}

export function deletePersonMarker(videoId: string): void {
  set(KEYS.markers, get<PersonMarker>(KEYS.markers).filter((m) => m.videoId !== videoId))
}

// ── AI Summaries ─────────────────────────────────────────────────────────────

export function getAISummaries(videoId: string): AISummary[] {
  return get<AISummary>(KEYS.aiSummaries)
    .filter((s) => s.videoId === videoId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt)) // 新しい順
}

export function saveAISummary(summary: AISummary): void {
  const all = get<AISummary>(KEYS.aiSummaries)
  all.push(summary)
  set(KEYS.aiSummaries, all)
}

export function deleteAISummary(id: string): void {
  set(KEYS.aiSummaries, get<AISummary>(KEYS.aiSummaries).filter((s) => s.id !== id))
}

// ── Exercise Programs ─────────────────────────────────────────────────────────

export function getExercisePrograms(caseId: string): ExerciseProgram[] {
  return get<ExerciseProgram>(KEYS.exercisePrograms)
    .filter((p) => p.caseId === caseId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export function saveExerciseProgram(program: ExerciseProgram): void {
  const all = get<ExerciseProgram>(KEYS.exercisePrograms)
  const idx = all.findIndex((p) => p.id === program.id)
  if (idx >= 0) all[idx] = program
  else all.push(program)
  set(KEYS.exercisePrograms, all)
}

export function deleteExerciseProgram(id: string): void {
  set(KEYS.exercisePrograms, get<ExerciseProgram>(KEYS.exercisePrograms).filter((p) => p.id !== id))
}

// ── ROM Sessions ──────────────────────────────────────────────────────────────

export function getROMSessions(videoId: string): ROMSession[] {
  return get<ROMSession>(KEYS.romSessions)
    .filter((s) => s.videoId === videoId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export function saveROMSession(session: ROMSession): void {
  const all = get<ROMSession>(KEYS.romSessions)
  const idx = all.findIndex((s) => s.id === session.id)
  if (idx >= 0) all[idx] = session
  else all.push(session)
  set(KEYS.romSessions, all)
}

export function deleteROMSession(id: string): void {
  set(KEYS.romSessions, get<ROMSession>(KEYS.romSessions).filter((s) => s.id !== id))
}

// ── AI評価ディスカッション ────────────────────────────────────────────────────

export function getDiscussionSessions(caseId: string): DiscussionSession[] {
  return get<DiscussionSession>(KEYS.discussions)
    .filter((s) => s.caseId === caseId)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

export function saveDiscussionSession(session: DiscussionSession): void {
  const all = get<DiscussionSession>(KEYS.discussions)
  const idx = all.findIndex((s) => s.id === session.id)
  if (idx >= 0) all[idx] = session
  else all.push(session)
  set(KEYS.discussions, all)
}

export function deleteDiscussionSession(id: string): void {
  set(KEYS.discussions, get<DiscussionSession>(KEYS.discussions).filter((s) => s.id !== id))
}
