'use client'

/**
 * ExerciseProgramPanel
 * 症例データを元に15分の運動プログラムをAIが生成。
 * 各種目にYouTube検索ボタンと動画URL埋め込みを提供。
 */

import { useState, useEffect } from 'react'
import type { RehabCase, ExerciseProgram, ExerciseItem } from '@/types/rehab'
import {
  EXERCISE_PHASE_LABELS,
  EXERCISE_PHASE_COLORS,
} from '@/types/rehab'
import {
  getExercisePrograms, saveExerciseProgram, deleteExerciseProgram, generateId, getCurrentUser,
} from '@/lib/rehab-store'
import {
  Dumbbell, Sparkles, ExternalLink, Clock, RotateCcw,
  ChevronDown, ChevronUp, Trash2, Link2, X, AlertCircle, Play,
  CheckCircle2, Timer, Film,
} from 'lucide-react'

interface Props {
  case_: RehabCase
  evaluationSummary?: string  // 動画解析・評価の要約（任意）
}

// ── YouTube URL → embed URL 変換 ─────────────────────────────────────────────
function parseYouTubeUrl(url: string): string | null {
  try {
    const u = new URL(url)
    // https://www.youtube.com/watch?v=VIDEO_ID
    if (u.hostname.includes('youtube.com')) {
      const v = u.searchParams.get('v')
      if (v) return `https://www.youtube-nocookie.com/embed/${v}?rel=0`
    }
    // https://youtu.be/VIDEO_ID
    if (u.hostname === 'youtu.be') {
      const v = u.pathname.replace('/', '')
      if (v) return `https://www.youtube-nocookie.com/embed/${v}?rel=0`
    }
  } catch { /* ignore */ }
  return null
}

// ── 総時間計算 ────────────────────────────────────────────────────────────────
function totalTimeSec(exercises: ExerciseItem[]): number {
  return exercises.reduce((s, e) => {
    const sets = e.sets ?? 1
    return s + e.durationSec * sets + (e.restSec ?? 0) * (sets - 1)
  }, 0)
}

function fmtMin(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = Math.round(sec % 60)
  return s === 0 ? `${m}分` : `${m}分${s}秒`
}

// ── フェーズ区切りラベル ──────────────────────────────────────────────────────
const PHASE_ORDER = ['warmup', 'main', 'cooldown'] as const

// ─────────────────────────────────────────────────────────────────────────────
// ExerciseCard: 1種目カード
// ─────────────────────────────────────────────────────────────────────────────
function ExerciseCard({
  ex, index, onVideoUrlChange,
}: {
  ex: ExerciseItem
  index: number
  onVideoUrlChange: (id: string, url: string) => void
}) {
  const [open,         setOpen]         = useState(false)
  const [showUrlInput, setShowUrlInput] = useState(false)
  const [urlInput,     setUrlInput]     = useState(ex.customVideoUrl ?? '')
  const [embedUrl,     setEmbedUrl]     = useState<string | null>(
    ex.customVideoUrl ? parseYouTubeUrl(ex.customVideoUrl) : null
  )

  const phaseLabel = EXERCISE_PHASE_LABELS[ex.phase]
  const phaseColor = EXERCISE_PHASE_COLORS[ex.phase]

  const ytSearchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(ex.youtubeQuery)}`
  const sets = ex.sets ?? 1
  const estSec = ex.durationSec * sets + (ex.restSec ?? 0) * (sets - 1)

  function handleUrlApply() {
    const parsed = parseYouTubeUrl(urlInput)
    if (urlInput && !parsed) {
      alert('有効なYouTube URLを入力してください\n例: https://www.youtube.com/watch?v=XXXXXXX')
      return
    }
    setEmbedUrl(parsed)
    onVideoUrlChange(ex.id, urlInput)
    setShowUrlInput(false)
  }

  function handleUrlClear() {
    setUrlInput('')
    setEmbedUrl(null)
    onVideoUrlChange(ex.id, '')
    setShowUrlInput(false)
  }

  const steps = ex.instruction.split('\n').filter(Boolean)

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden bg-white shadow-sm">
      {/* ヘッダー行 */}
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors select-none"
        onClick={() => setOpen((v) => !v)}
      >
        {/* 番号バッジ */}
        <div className="w-7 h-7 rounded-full bg-[#1e3a5f] text-white text-xs font-bold flex items-center justify-center flex-shrink-0">
          {index + 1}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-gray-900 text-sm">{ex.name}</span>
            <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${phaseColor}`}>
              {phaseLabel}
            </span>
          </div>
          <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-500">
            <span className="flex items-center gap-1">
              <Timer className="w-3 h-3" />
              {fmtMin(estSec)}
            </span>
            {ex.sets && ex.reps && (
              <span>{ex.sets}セット × {ex.reps}</span>
            )}
            {!ex.sets && ex.reps && <span>{ex.reps}</span>}
          </div>
        </div>

        {/* 動画あり表示 */}
        {embedUrl && (
          <div className="flex-shrink-0">
            <Film className="w-4 h-4 text-red-500" />
          </div>
        )}

        {open ? <ChevronUp className="w-4 h-4 text-gray-400 flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />}
      </div>

      {/* 展開コンテンツ */}
      {open && (
        <div className="border-t border-gray-100 px-4 py-4 space-y-4 bg-gray-50/50">
          {/* 目的 */}
          <div className="flex items-start gap-2 p-3 bg-blue-50 rounded-lg border border-blue-100">
            <CheckCircle2 className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-xs font-semibold text-blue-700 mb-0.5">この運動の目的</p>
              <p className="text-xs text-blue-900 leading-relaxed">{ex.purpose}</p>
            </div>
          </div>

          {/* 手順 */}
          <div>
            <p className="text-xs font-semibold text-gray-700 mb-2">実施方法</p>
            <ol className="space-y-1.5">
              {steps.map((step, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-gray-700">
                  <span className="w-4 h-4 rounded-full bg-[#1e3a5f] text-white text-[9px] flex items-center justify-center flex-shrink-0 mt-0.5">
                    {i + 1}
                  </span>
                  <span className="leading-relaxed">{step.replace(/^ステップ\d+[:：]\s*/, '')}</span>
                </li>
              ))}
            </ol>
          </div>

          {/* セット・時間詳細 */}
          <div className="grid grid-cols-3 gap-2 text-center">
            {ex.sets && (
              <div className="bg-white rounded-lg border border-gray-200 py-2 px-1">
                <p className="text-lg font-bold text-[#1e3a5f]">{ex.sets}</p>
                <p className="text-[10px] text-gray-500">セット</p>
              </div>
            )}
            {ex.reps && (
              <div className="bg-white rounded-lg border border-gray-200 py-2 px-1">
                <p className="text-lg font-bold text-[#1e3a5f]">{ex.reps}</p>
                <p className="text-[10px] text-gray-500">回数・時間</p>
              </div>
            )}
            {ex.restSec && (
              <div className="bg-white rounded-lg border border-gray-200 py-2 px-1">
                <p className="text-lg font-bold text-gray-500">{ex.restSec}</p>
                <p className="text-[10px] text-gray-500">秒（休憩）</p>
              </div>
            )}
          </div>

          {/* 注意事項 */}
          {ex.caution && (
            <div className="flex items-start gap-2 p-3 bg-amber-50 rounded-lg border border-amber-100">
              <AlertCircle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-amber-800 leading-relaxed">{ex.caution}</p>
            </div>
          )}

          {/* YouTube 動画エリア */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-gray-700">動画で確認</p>

            {/* 埋め込み動画 */}
            {embedUrl && (
              <div className="relative rounded-lg overflow-hidden aspect-video bg-black">
                <iframe
                  src={embedUrl}
                  className="w-full h-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  title={ex.name}
                />
                <button
                  onClick={handleUrlClear}
                  className="absolute top-2 right-2 bg-black/70 text-white rounded-full p-1 hover:bg-red-600 transition-colors"
                  title="動画を削除"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* ボタン行 */}
            <div className="flex flex-wrap gap-2">
              {/* YouTube検索（ワンクリック） */}
              <a
                href={ytSearchUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-medium rounded-lg transition-colors"
              >
                <Film className="w-3.5 h-3.5" />
                YouTubeで検索
                <ExternalLink className="w-3 h-3" />
              </a>

              {/* URL貼り付けで埋め込み */}
              {!embedUrl && (
                <button
                  onClick={() => setShowUrlInput((v) => !v)}
                  className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 text-gray-600 hover:border-teal-500 hover:text-teal-600 text-xs font-medium rounded-lg transition-colors"
                >
                  <Link2 className="w-3.5 h-3.5" />
                  動画URLを貼り付けて埋め込む
                </button>
              )}
            </div>

            {/* URL入力フォーム */}
            {showUrlInput && !embedUrl && (
              <div className="flex gap-2 items-center">
                <input
                  type="url"
                  placeholder="https://www.youtube.com/watch?v=..."
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  className="flex-1 text-xs border border-gray-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-teal-500"
                  onKeyDown={(e) => e.key === 'Enter' && handleUrlApply()}
                />
                <button
                  onClick={handleUrlApply}
                  className="px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white text-xs rounded-lg transition-colors"
                >
                  適用
                </button>
                <button
                  onClick={() => setShowUrlInput(false)}
                  className="p-1.5 text-gray-400 hover:text-gray-600"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            <p className="text-[10px] text-gray-400 leading-snug">
              💡 YouTubeで「{ex.youtubeQuery}」を検索すると方法を動画で確認できます。
              気に入った動画のURLをコピーして「URLを貼り付け」ボタンから埋め込むこともできます。
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// メインコンポーネント
// ─────────────────────────────────────────────────────────────────────────────
export default function ExerciseProgramPanel({ case_, evaluationSummary }: Props) {
  const [programs, setPrograms] = useState<ExerciseProgram[]>([])
  const [selected, setSelected] = useState<ExerciseProgram | null>(null)
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')

  function reload() {
    const ps = getExercisePrograms(case_.id)
    setPrograms(ps)
    if (ps.length > 0 && !selected) setSelected(ps[0])
  }

  useEffect(() => { reload() }, [case_.id])  // eslint-disable-line react-hooks/exhaustive-deps

  // ── AI でプログラム生成 ──────────────────────────────────────────────────
  async function handleGenerate() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/exercise-program', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          caseData: {
            diagnosis:         case_.diagnosis,
            injuredPart:       case_.injuredPart,
            age:               case_.age,
            gender:            case_.gender,
            postOpDays:        case_.postOpDays,
            evaluationPurpose: case_.evaluationPurpose,
            sport:             case_.sport,
            status:            case_.status,
          },
          evaluationSummary,
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        const detail = json?.detail ?? json?.error ?? 'APIエラー'
        throw new Error(detail)
      }
      const { program } = json
      if (!program) throw new Error('APIからプログラムデータが返りませんでした')
      if (!Array.isArray(program.exercises) || program.exercises.length === 0) {
        throw new Error('運動リストが空です（AI応答の形式エラー）')
      }

      const user = getCurrentUser()
      const saved: ExerciseProgram = {
        id:            generateId('ep'),
        caseId:        case_.id,
        createdAt:     new Date().toISOString(),
        targetArea:    program.targetArea ?? '',
        goal:          program.goal ?? '',
        totalMinutes:  program.totalMinutes ?? 15,
        exercises:     program.exercises.map((e: Omit<ExerciseItem, 'id'> & { id?: string }, i: number) => ({
          ...e,
          id: e.id ?? `ex${i + 1}`,
        })),
        generalNotes:  program.generalNotes ?? '',
        createdByName: user?.name ?? 'スタッフ',
      }
      saveExerciseProgram(saved)
      setSelected(saved)
      reload()
    } catch (e) {
      const msg = e instanceof Error ? e.message : '不明なエラー'
      setError(`生成に失敗しました: ${msg}`)
      console.error('[ExerciseProgram]', e)
    } finally {
      setLoading(false)
    }
  }

  // ── 動画URL変更 ──────────────────────────────────────────────────────────
  function handleVideoUrlChange(exerciseId: string, url: string) {
    if (!selected) return
    const updated: ExerciseProgram = {
      ...selected,
      exercises: selected.exercises.map((e) =>
        e.id === exerciseId ? { ...e, customVideoUrl: url || undefined } : e
      ),
    }
    saveExerciseProgram(updated)
    setSelected(updated)
    setPrograms(programs.map((p) => p.id === updated.id ? updated : p))
  }

  // ── プログラム削除 ──────────────────────────────────────────────────────
  function handleDelete(id: string) {
    if (!confirm('このプログラムを削除しますか？')) return
    deleteExerciseProgram(id)
    const rest = programs.filter((p) => p.id !== id)
    setPrograms(rest)
    setSelected(rest[0] ?? null)
  }

  // ── フェーズごとに種目を分類 ──────────────────────────────────────────────
  function exercisesByPhase(exercises: ExerciseItem[]) {
    return PHASE_ORDER.map((phase) => ({
      phase,
      items: exercises.filter((e) => e.phase === phase),
    })).filter((g) => g.items.length > 0)
  }

  return (
    <div className="space-y-6">
      {/* ── ヘッダー ── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <Dumbbell className="w-5 h-5 text-teal-600" />
            推奨運動プログラム（15分）
          </h2>
          <p className="text-sm text-gray-500 mt-0.5">
            AIが診断・評価データをもとに自宅でできる個別プログラムを作成します
          </p>
        </div>

        <button
          onClick={handleGenerate}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-700 disabled:opacity-60 text-white text-sm font-semibold rounded-xl transition-colors shadow-sm"
        >
          {loading ? (
            <><RotateCcw className="w-4 h-4 animate-spin" />生成中...</>
          ) : (
            <><Sparkles className="w-4 h-4" />AIでプログラムを生成</>
          )}
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* ── 生成中のスケルトン ── */}
      {loading && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 animate-pulse space-y-4">
          <div className="h-4 bg-gray-200 rounded w-1/3" />
          <div className="h-3 bg-gray-200 rounded w-2/3" />
          <div className="grid grid-cols-3 gap-3">
            {[...Array(3)].map((_, i) => <div key={i} className="h-20 bg-gray-100 rounded-xl" />)}
          </div>
          <div className="space-y-2">
            {[...Array(4)].map((_, i) => <div key={i} className="h-12 bg-gray-100 rounded-xl" />)}
          </div>
          <p className="text-xs text-gray-400 text-center pt-2">
            AIが {case_.diagnosis} の診断データを解析してプログラムを作成しています...
          </p>
        </div>
      )}

      {/* ── 過去のプログラム選択タブ ── */}
      {programs.length > 0 && !loading && (
        <>
          {programs.length > 1 && (
            <div className="flex gap-2 flex-wrap">
              {programs.map((p, i) => (
                <button
                  key={p.id}
                  onClick={() => setSelected(p)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
                    selected?.id === p.id
                      ? 'bg-[#1e3a5f] text-white border-[#1e3a5f]'
                      : 'bg-white text-gray-600 border-gray-300 hover:border-teal-400'
                  }`}
                >
                  <Dumbbell className="w-3 h-3" />
                  プログラム {i + 1}
                  <span className="opacity-70 text-[10px]">
                    {new Date(p.createdAt).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' })}
                  </span>
                </button>
              ))}
            </div>
          )}

          {selected && (
            <div className="space-y-5">
              {/* ── プログラムサマリーカード ── */}
              <div className="bg-gradient-to-br from-[#1e3a5f] to-[#0d9488] rounded-2xl p-5 text-white shadow-lg">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Dumbbell className="w-5 h-5 text-teal-300" />
                      <span className="text-teal-200 text-xs font-medium">推奨運動プログラム</span>
                    </div>
                    <h3 className="font-bold text-lg leading-tight mb-1">{selected.targetArea}</h3>
                    <p className="text-teal-100 text-sm mb-3">{selected.goal}</p>

                    {/* タイムライン */}
                    <div className="flex items-center gap-3 flex-wrap">
                      <div className="flex items-center gap-1.5 bg-white/10 rounded-lg px-3 py-1.5">
                        <Clock className="w-4 h-4 text-teal-300" />
                        <span className="text-sm font-semibold">
                          {fmtMin(totalTimeSec(selected.exercises))}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 bg-white/10 rounded-lg px-3 py-1.5">
                        <Play className="w-4 h-4 text-teal-300" />
                        <span className="text-sm font-semibold">{selected.exercises.length}種目</span>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => handleDelete(selected.id)}
                    className="text-white/40 hover:text-red-300 transition-colors flex-shrink-0 p-1"
                    title="このプログラムを削除"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {/* フェーズ内訳 */}
                <div className="mt-4 grid grid-cols-3 gap-2">
                  {PHASE_ORDER.map((phase) => {
                    const items  = selected.exercises.filter((e) => e.phase === phase)
                    const secSum = items.reduce((s, e) => s + e.durationSec * (e.sets ?? 1), 0)
                    return (
                      <div key={phase} className="bg-white/10 rounded-xl p-2.5 text-center">
                        <p className="text-[10px] text-teal-200 mb-0.5">{EXERCISE_PHASE_LABELS[phase]}</p>
                        <p className="text-white font-bold text-sm">{items.length}種目</p>
                        <p className="text-teal-300 text-[10px]">{fmtMin(secSum)}</p>
                      </div>
                    )
                  })}
                </div>

                {/* 全体的な注意事項 */}
                {selected.generalNotes && (
                  <div className="mt-3 bg-white/10 rounded-xl px-3 py-2.5">
                    <p className="text-[10px] text-teal-200 mb-1 font-semibold">📝 全体的な注意事項</p>
                    <p className="text-teal-50 text-xs leading-relaxed">{selected.generalNotes}</p>
                  </div>
                )}
              </div>

              {/* ── 種目リスト ── */}
              {exercisesByPhase(selected.exercises).map(({ phase, items }) => (
                <div key={phase}>
                  {/* フェーズ見出し */}
                  <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border mb-3 ${EXERCISE_PHASE_COLORS[phase]}`}>
                    {EXERCISE_PHASE_LABELS[phase]}
                  </div>

                  <div className="space-y-3">
                    {items.map((ex, i) => (
                      <ExerciseCard
                        key={ex.id}
                        ex={ex}
                        index={selected.exercises.indexOf(ex)}
                        onVideoUrlChange={handleVideoUrlChange}
                      />
                    ))}
                  </div>
                </div>
              ))}

              {/* ── 作成情報 ── */}
              <p className="text-xs text-gray-400 text-right">
                作成: {selected.createdByName} ·{' '}
                {new Date(selected.createdAt).toLocaleDateString('ja-JP', {
                  year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit',
                })}
              </p>
            </div>
          )}
        </>
      )}

      {/* ── 空状態 ── */}
      {programs.length === 0 && !loading && (
        <div className="bg-white rounded-2xl border-2 border-dashed border-gray-200 p-12 text-center">
          <div className="w-16 h-16 bg-teal-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <Dumbbell className="w-8 h-8 text-teal-400" />
          </div>
          <h3 className="font-semibold text-gray-800 mb-2">運動プログラムを作成しましょう</h3>
          <p className="text-sm text-gray-500 max-w-sm mx-auto mb-6 leading-relaxed">
            「AIでプログラムを生成」ボタンを押すと、{case_.diagnosis}の診断データをもとに
            15分で完了できる個別運動プログラムを自動作成します。<br />
            各種目にはYouTube検索リンクと動画埋め込み機能があります。
          </p>
          <button
            onClick={handleGenerate}
            disabled={loading}
            className="inline-flex items-center gap-2 px-6 py-3 bg-teal-600 hover:bg-teal-700 text-white font-semibold rounded-xl transition-colors shadow-sm"
          >
            <Sparkles className="w-5 h-5" />
            AIでプログラムを生成
          </button>

          {/* 機能説明 */}
          <div className="grid grid-cols-3 gap-3 mt-8 max-w-md mx-auto text-left">
            {[
              { icon: '🤖', title: 'AI自動生成', desc: '診断・評価データから個別プログラムを作成' },
              { icon: '▶️', title: 'YouTube連携', desc: '各種目のやり方を動画で即確認' },
              { icon: '📌', title: '動画埋め込み', desc: 'URLを貼るだけでその場で再生可能' },
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
