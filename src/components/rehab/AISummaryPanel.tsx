'use client'

import { useState, useEffect } from 'react'
import type { VideoComment, PersonMarker, AISummary, ExpertOpinion } from '@/types/rehab'
import {
  getAISummaries, saveAISummary, deleteAISummary,
  getCurrentUser, generateId,
} from '@/lib/rehab-store'
import {
  Sparkles, AlertTriangle, Loader, Film,
  FileText, Target, Trash2, ChevronDown, ChevronUp, Clock, Users,
} from 'lucide-react'

interface Props {
  videoId: string
  caseId: string
  comments: VideoComment[]
  movementType?: string
  videoSrc?: string | null
  caseInfo?: {
    diagnosis?: string
    age?: number
  }
  personMarker?: PersonMarker | null
}

const PROMPT_PRESETS = [
  {
    label: '汎用フォーム解析',
    prompt: `あなたは動画を根拠に動作解析を行うAIです。

重要な前提:
- 痛みがなくても解析してください。
- 傷病名がなくても解析してください。
- 診断や治療の断定ではなく、動画から確認できる動作の特徴・課題・改善候補を評価してください。
- 入力情報が不足している場合は、推測で決めつけず「不明」と明記してください。

目的: スポーツフォーム改善
対象: 動画内の主対象者
注目タイミング: 動画全体。特に姿勢が大きく変化する局面
気になるところ: 動画から目立つ動作の癖、左右差、不安定さ、改善余地をAI側で抽出する。

依頼:
1. 動画内で確認できる事実と、推測を分けて記述してください。
2. 痛みや傷病名がなくても、気になる動作を起点に評価してください。
3. 動作を「準備局面」「主要動作」「終了・フォロー局面」に分けて観察してください。
4. 以下の専門家の視点から、それぞれ独立した意見を出してください。
   - バイオメカニクス専門家
   - 理学療法士
   - 競技コーチ
5. 各専門家の意見には「良い点」「気になる点」「改善提案」「追加で確認したい情報」を含めてください。
6. 医療・治療判断が必要な場合は断定せず、専門職への相談が必要な範囲を明記してください。
7. 最後に、優先度の高い改善アクションを3つに絞って提示してください。

出力形式:
- 総合所見
- 気になるところへの評価
- 専門家別レビュー（バイオメカニクス・理学療法士・競技コーチ）
- 優先改善アクション3つ
- 動画だけでは判断できない点
- 追加で入力・撮影するとよい情報`,
  },
  {
    label: '投球動作解析',
    prompt: `あなたは動画を根拠に動作解析を行うAIです。

目的: スポーツフォーム改善（投球動作）
対象: 投球動作を行う選手
注目タイミング: 踏み込みからリリース直後
背景情報: 肩・肘の負担を減らしながら球速を上げたい。競技歴・撮影角度は動画から推定する。

依頼:
1. 動画内で確認できる事実と推測を分けて記述してください。
2. 動作を「ワインドアップ」「コッキング」「アクセラレーション」「フォロースルー」に分けて観察してください。
3. バイオメカニクス専門家・理学療法士・ピッチングコーチの視点でそれぞれ「良い点」「課題」「改善提案」を記述してください。
4. 優先改善アクションを3つ提示してください。

出力形式:
- 総合所見
- 局面別観察
- 専門家別レビュー
- 優先改善アクション3つ
- 動画だけでは判断できない点
- 次に撮影すべき角度・条件`,
  },
  {
    label: '簡易動作観察',
    prompt: `あなたは動画から動作を簡易分析するAIです。

前提:
- 症状の登録はありません。
- 傷病名や診断名の登録はありません。
- 患者情報・症例情報・競技歴などの登録もありません。
- 動画だけを根拠に、見えている動作を観察してください。
- 医療診断や治療方針を断定せず、動作上の特徴・気になる点・改善候補として表現してください。
- 不明な情報は推測で埋めず、「動画だけでは不明」と明記してください。

利用者が気になっている点:
指定なし。動画から目立つ姿勢、左右差、タイミング、安定性、ぎこちなさ、危険動作、改善余地をAIが抽出する。

依頼:
1. 動画全体を見て、まず何の動作に見えるかを簡潔に説明してください。
2. 姿勢、左右差、重心移動、タイミング、安定性、可動域、力み、スピード変化を観察してください。
3. 痛みや傷病名がない前提で、予防・パフォーマンス・安全性の観点からコメントしてください。
4. 動画から確認できる事実と、推測を分けてください。
5. 必要であれば、次に撮影するとよい角度や追加情報を提案してください。

出力形式:
- 動画から見える動作の概要
- 良い点
- 気になる点
- 改善の方向性
- 自宅・練習で確認できる簡単なチェック
- 動画だけでは判断できない点
- 次に追加するとよい情報・撮影条件`,
  },
  {
    label: 'リハビリ進捗評価',
    prompt: `あなたは運動器リハビリテーションの専門AIです。

目的: リハビリ進捗確認・復帰判断の補助
注目ポイント: 左右対称性、代償動作の有無、荷重時の安定性

依頼:
1. 動画から確認できる事実と推測を明確に分けてください。
2. 以下の観点で評価してください。
   - 関節アライメント（膝・股・足）
   - 筋力・安定性の左右差
   - 代償動作の有無
   - 動作の流暢性・スムーズさ
3. 理学療法士・整形外科医の視点から独立した意見を出してください。
4. 競技復帰・日常生活復帰への見解（段階的基準）を示してください。

出力形式:
- 総合所見
- 観察項目別評価
- 専門家別レビュー
- 復帰に向けた推奨ステップ
- 追加評価が必要な項目`,
  },
]

// 動画から等間隔でフレームを抽出してbase64 JPEGを返す（高精度版）
async function extractFrames(
  videoSrc: string,
  count = 12,
  marker?: PersonMarker | null,
): Promise<string[]> {
  return new Promise((resolve) => {
    const video = document.createElement('video')
    video.src = videoSrc
    video.crossOrigin = 'anonymous'
    video.muted = true
    video.preload = 'auto'

    video.onloadedmetadata = async () => {
      const duration = video.duration
      if (!duration || !isFinite(duration) || duration < 0.1) { resolve([]); return }

      const canvas = document.createElement('canvas')
      canvas.width = 720
      canvas.height = 404
      const ctx = canvas.getContext('2d')
      if (!ctx) { resolve([]); return }

      const frames: string[] = []
      const startOffset = duration * 0.05
      const endOffset   = duration * 0.95
      const effectiveDuration = endOffset - startOffset

      for (let i = 0; i < count; i++) {
        const time = startOffset + (effectiveDuration / (count - 1)) * i
        await new Promise<void>((res) => {
          video.currentTime = time
          const onSeeked = () => { video.removeEventListener('seeked', onSeeked); res() }
          video.addEventListener('seeked', onSeeked)
          setTimeout(res, 1500)
        })

        ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

        if (marker) {
          const mx = marker.x * canvas.width
          const my = marker.y * canvas.height
          const mw = marker.width  * canvas.width
          const mh = marker.height * canvas.height

          ctx.shadowColor = marker.color
          ctx.shadowBlur = 10
          ctx.strokeStyle = marker.color
          ctx.lineWidth = 3
          ctx.setLineDash([])
          ctx.strokeRect(mx, my, mw, mh)

          ctx.shadowBlur = 0
          const cs = 12
          ctx.lineWidth = 4
          const corners: Array<[number, number, number, number, number, number]> = [
            [mx, my,      mx + cs, my,      mx, my + cs],
            [mx + mw, my, mx+mw-cs,my,      mx+mw, my+cs],
            [mx, my+mh,   mx+cs, my+mh,     mx, my+mh-cs],
            [mx+mw,my+mh, mx+mw-cs,my+mh,  mx+mw, my+mh-cs],
          ]
          corners.forEach(([x1,y1,x2,y2,x3,y3]) => {
            ctx.beginPath(); ctx.moveTo(x2,y2); ctx.lineTo(x1,y1); ctx.lineTo(x3,y3); ctx.stroke()
          })

          const labelText = `▶ ${marker.label} (AI分析対象)`
          ctx.font = 'bold 13px sans-serif'
          const tw = ctx.measureText(labelText).width
          ctx.fillStyle = marker.color
          ctx.fillRect(mx, my - 22, tw + 10, 20)
          ctx.fillStyle = '#1a1a1a'
          ctx.fillText(labelText, mx + 5, my - 7)
          ctx.shadowBlur = 0
        }

        const dataUrl = canvas.toDataURL('image/jpeg', 0.82)
        frames.push(dataUrl.split(',')[1])
      }

      video.src = ''
      resolve(frames)
    }

    video.onerror = () => resolve([])
    video.load()
  })
}

// ── 合議サマリーセクション表示 ────────────────────────────────────────────
function SummaryView({ text }: { text: string }) {
  const sections = text.split(/\n(?=##\s)/)
  return (
    <div className="space-y-2.5">
      {sections.map((section, i) => {
        const lines = section.trim().split('\n')
        const firstLine = lines[0].replace(/^#+\s*/, '')
        const body = lines.slice(1).join('\n').trim()

        const color =
          firstLine.includes('リスク') ? 'text-orange-700 border-orange-200 bg-orange-50' :
          firstLine.includes('問題') ? 'text-red-700 border-red-200 bg-red-50' :
          firstLine.includes('介入') || firstLine.includes('推奨') ? 'text-blue-700 border-blue-200 bg-blue-50' :
          firstLine.includes('復帰') ? 'text-green-700 border-green-200 bg-green-50' :
          firstLine.includes('注目') || firstLine.includes('着眼') ? 'text-purple-700 border-purple-200 bg-purple-50' :
          firstLine.includes('注意') ? 'text-yellow-700 border-yellow-200 bg-yellow-50' :
          firstLine.includes('動作特徴') || firstLine.includes('合意') ? 'text-teal-700 border-teal-200 bg-teal-50' :
          'text-gray-800 border-gray-200 bg-white'

        if (!firstLine && !body) return null
        return (
          <div key={i} className={`rounded-lg p-2.5 border ${color}`}>
            {firstLine && <h4 className="text-xs font-bold mb-1.5">{firstLine}</h4>}
            <div className="text-xs text-gray-700 leading-relaxed whitespace-pre-line">{body || firstLine}</div>
          </div>
        )
      })}
    </div>
  )
}

// ── 専門家意見カード ────────────────────────────────────────────────────────
function ExpertCard({ expert }: { expert: ExpertOpinion }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="rounded-lg border overflow-hidden" style={{ borderColor: expert.color + '55' }}>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-3 py-2 text-left transition-colors hover:opacity-90"
        style={{ backgroundColor: expert.color + '15' }}
      >
        {/* カラードット */}
        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: expert.color }} />
        <div className="flex-1 min-w-0">
          <span className="text-xs font-bold" style={{ color: expert.color }}>{expert.name}</span>
          <span className="text-xs text-gray-500 ml-1.5">{expert.role}</span>
        </div>
        {open ? <ChevronUp className="w-3.5 h-3.5 text-gray-400" /> : <ChevronDown className="w-3.5 h-3.5 text-gray-400" />}
      </button>
      {open && (
        <div className="px-3 py-2.5 bg-white border-t" style={{ borderColor: expert.color + '33' }}>
          <p className="text-xs text-gray-700 leading-relaxed whitespace-pre-line">{expert.opinion}</p>
        </div>
      )}
    </div>
  )
}

export default function AISummaryPanel({
  videoId, caseId, comments, movementType, videoSrc, caseInfo, personMarker,
}: Props) {
  const [savedList, setSavedList] = useState<AISummary[]>([])
  const [expandedId, setExpandedId] = useState<string | null>(null)

  // 生成フォーム用ステート
  const [generating, setGenerating] = useState(false)
  const [loadingStep, setLoadingStep] = useState('')
  const [error, setError] = useState('')
  const [customPrompt, setCustomPrompt] = useState('')
  const [showPromptInput, setShowPromptInput] = useState(false)
  const [showForm, setShowForm] = useState(false)

  // 保存済みサマリーをロード
  function loadSaved() {
    setSavedList(getAISummaries(videoId))
  }

  useEffect(() => {
    loadSaved()
  }, [videoId]) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleGenerate() {
    setGenerating(true)
    setError('')

    let frames: string[] = []
    if (videoSrc) {
      setLoadingStep('動画からフレームを抽出中...')
      try { frames = await extractFrames(videoSrc, 12, personMarker) } catch { frames = [] }
    }

    const isMultiExpert = !customPrompt.trim()
    setLoadingStep(isMultiExpert
      ? '専門家5名が並列解析中... (整形外科医・PT・AT・バイオメカニクス・柔道整復師)'
      : 'Claude AIが動作を分析中...')

    try {
      const res = await fetch('/api/ai-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          movementType: movementType ?? 'other',
          comments,
          evaluation: null,
          caseInfo,
          frames,
          personMarker: personMarker ?? undefined,
          customPrompt: customPrompt.trim() || undefined,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error ?? 'エラーが発生しました')
        return
      }

      if (isMultiExpert) setLoadingStep('合議結論を生成中...')

      // 自動保存
      const currentUser = getCurrentUser()
      const newSummary: AISummary = {
        id: generateId('ai'),
        videoId,
        caseId,
        summary: data.summary,
        experts: data.experts?.length > 0 ? data.experts : undefined,
        frameCount: data.frameCount ?? 0,
        customPrompt: customPrompt.trim() || undefined,
        createdAt: new Date().toISOString(),
        createdByName: currentUser?.name ?? '不明',
      }
      saveAISummary(newSummary)
      loadSaved()
      setExpandedId(newSummary.id) // 最新を自動展開
      setShowForm(false)
      setCustomPrompt('')
    } catch {
      setError('通信エラーが発生しました')
    } finally {
      setGenerating(false)
      setLoadingStep('')
    }
  }

  function handleDelete(id: string) {
    deleteAISummary(id)
    loadSaved()
    if (expandedId === id) setExpandedId(null)
  }

  return (
    <div className="space-y-3">

      {/* ── 保存済みサマリー一覧 ── */}
      {savedList.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
            保存済みAI所見 ({savedList.length}件)
          </p>
          {savedList.map((s) => (
            <div key={s.id} className="border border-purple-200 rounded-xl overflow-hidden">
              {/* ヘッダー行 */}
              <div className="flex items-center gap-2 px-3 py-2 bg-purple-50">
                <Clock className="w-3.5 h-3.5 text-purple-400 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-xs text-purple-700 font-medium">
                      {new Date(s.createdAt).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </span>
                    {s.experts && s.experts.length > 0 && (
                      <span className="flex items-center gap-0.5 text-xs bg-indigo-100 text-indigo-600 px-1.5 py-0 rounded-full font-semibold">
                        <Users className="w-2.5 h-2.5" /> カンファレンス
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-purple-400">
                    {s.createdByName}
                    {s.frameCount > 0 && ` · 動画${s.frameCount}フレーム解析`}
                    {s.customPrompt && ' · カスタム指示'}
                  </span>
                </div>
                {/* 展開/折りたたみ */}
                <button
                  onClick={() => setExpandedId(expandedId === s.id ? null : s.id)}
                  className="text-purple-500 hover:text-purple-700 p-1"
                  title={expandedId === s.id ? '折りたたむ' : '展開する'}
                >
                  {expandedId === s.id
                    ? <ChevronUp className="w-3.5 h-3.5" />
                    : <ChevronDown className="w-3.5 h-3.5" />}
                </button>
                {/* 削除ボタン */}
                <button
                  onClick={() => {
                    if (confirm('このAI所見を削除しますか？')) handleDelete(s.id)
                  }}
                  className="text-gray-300 hover:text-red-500 p-1 transition-colors"
                  title="削除"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* 展開時：本文 */}
              {expandedId === s.id && (
                <div className="px-3 pb-3 pt-2 space-y-2.5">
                  <div className="flex items-start gap-2 bg-yellow-50 border border-yellow-200 rounded-lg p-2.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-yellow-600 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-yellow-800 leading-relaxed">
                      AIによる補助的分析です。最終的な診断・判断は専門家が行ってください。
                    </p>
                  </div>

                  {/* 解析情報バッジ */}
                  <div className="flex items-center gap-2 flex-wrap">
                    {s.experts && s.experts.length > 0 && (
                      <span className="flex items-center gap-1 text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-semibold">
                        <Users className="w-3 h-3" /> カンファレンス ({s.experts.length}名合議)
                      </span>
                    )}
                    {s.frameCount > 0 && (
                      <span className="flex items-center gap-1 text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                        <Film className="w-3 h-3" /> 動画{s.frameCount}フレーム解析
                      </span>
                    )}
                    {s.customPrompt && (
                      <span className="flex items-center gap-1 text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">
                        <FileText className="w-3 h-3" /> カスタム指示
                      </span>
                    )}
                  </div>

                  {/* 合議結論 */}
                  {s.experts && s.experts.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-indigo-700 mb-1.5 flex items-center gap-1">
                        <Users className="w-3.5 h-3.5" /> カンファレンス合議結論
                      </p>
                      <SummaryView text={s.summary} />
                    </div>
                  )}
                  {(!s.experts || s.experts.length === 0) && (
                    <SummaryView text={s.summary} />
                  )}

                  {/* 専門家別意見（折りたたみ） */}
                  {s.experts && s.experts.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-gray-500 mb-1.5 flex items-center gap-1">
                        各専門家の意見（タップで展開）
                      </p>
                      <div className="space-y-1.5">
                        {s.experts.map((expert) => (
                          <ExpertCard key={expert.id} expert={expert} />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── 生成フォーム ── */}
      {!showForm && !generating && (
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 w-full justify-center py-2.5 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <Sparkles className="w-4 h-4" />
          {savedList.length > 0 ? '再解析する（新規生成）' : 'Claude AIで動作を解析'}
        </button>
      )}

      {showForm && !generating && (
        <div className="border border-purple-200 rounded-xl bg-purple-50/50 p-3 space-y-3">
          <p className="text-xs font-semibold text-purple-700">新しいAI所見を生成</p>

          {/* 解析条件バッジ */}
          <div className="flex flex-col gap-1.5">
            <div className={`flex items-center gap-2 text-xs rounded-lg px-3 py-2 ${videoSrc ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-gray-50 text-gray-400 border border-gray-200'}`}>
              <Film className="w-3.5 h-3.5 flex-shrink-0" />
              {videoSrc ? '動画あり — フレームを高精度画像解析（12枚）' : '動画なし — テキスト情報のみで分析'}
            </div>
            {personMarker && (
              <div className="flex items-center gap-2 text-xs rounded-lg px-3 py-2 bg-yellow-50 text-yellow-800 border border-yellow-300">
                <Target className="w-3.5 h-3.5 flex-shrink-0" />
                対象者マーカー設定済み — AIが対象人物を確実に識別して解析
              </div>
            )}
            <div className={`flex items-center gap-2 text-xs rounded-lg px-3 py-2 ${comments.length > 0 ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'bg-gray-50 text-gray-400 border border-gray-200'}`}>
              <FileText className="w-3.5 h-3.5 flex-shrink-0" />
              {comments.length > 0 ? `専門家コメント ${comments.length}件を参照` : '専門家コメントなし'}
            </div>
          </div>

          {/* カスタムプロンプト */}
          <div>
            <button
              onClick={() => setShowPromptInput(!showPromptInput)}
              className="text-xs text-purple-600 hover:text-purple-800 underline"
            >
              {showPromptInput ? '▲ 分析指示を閉じる' : '▼ 分析指示を入力する（任意）'}
            </button>
            {showPromptInput && (
              <div className="mt-2 space-y-2">
                <div className="flex flex-wrap gap-1.5">
                  {PROMPT_PRESETS.map((preset) => (
                    <button
                      key={preset.label}
                      onClick={() => setCustomPrompt(preset.prompt)}
                      className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                        customPrompt === preset.prompt
                          ? 'bg-purple-600 text-white border-purple-600'
                          : 'border-purple-300 text-purple-700 hover:bg-purple-50'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
                <textarea
                  rows={8}
                  value={customPrompt}
                  onChange={(e) => setCustomPrompt(e.target.value)}
                  placeholder="分析の目的・注目ポイント・出力形式などを自由に入力してください"
                  className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400 resize-none leading-relaxed"
                />
                {customPrompt.trim() && (
                  <button onClick={() => setCustomPrompt('')} className="text-xs text-gray-400 hover:text-gray-600">
                    クリア
                  </button>
                )}
              </div>
            )}
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-xs text-red-700 font-medium mb-1">エラーが発生しました</p>
              <p className="text-xs text-red-600 break-all">{error}</p>
            </div>
          )}

          {/* デフォルトモードの説明 */}
          {!customPrompt.trim() && (
            <div className="flex items-center gap-1.5 text-xs text-indigo-600 bg-indigo-50 border border-indigo-200 rounded-lg px-3 py-2">
              <Users className="w-3.5 h-3.5 flex-shrink-0" />
              指示なしの場合：整形外科医・PT・AT・バイオメカニクス・柔道整復師の5名が並列解析し、合議結論を生成します
            </div>
          )}

          <div className="flex gap-2">
            <button
              onClick={handleGenerate}
              className="flex-1 flex items-center gap-2 justify-center py-2.5 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-lg transition-colors"
            >
              {customPrompt.trim() ? <Sparkles className="w-4 h-4" /> : <Users className="w-4 h-4" />}
              {customPrompt.trim() ? 'カスタム指示でAI解析' : '5名カンファレンス解析を実行'}
            </button>
            <button
              onClick={() => { setShowForm(false); setError(''); setCustomPrompt('') }}
              className="px-3 py-2.5 text-sm text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              キャンセル
            </button>
          </div>
        </div>
      )}

      {/* ── 生成中 ── */}
      {generating && (
        <div className="flex flex-col items-center gap-3 py-6 text-purple-700 border border-purple-200 rounded-xl bg-purple-50">
          <Loader className="w-5 h-5 animate-spin" />
          <div className="text-center px-4">
            <p className="text-sm font-medium">{loadingStep || 'Claude AIが分析中...'}</p>
            {!customPrompt.trim() && (
              <div className="mt-2 flex flex-wrap justify-center gap-1.5">
                {[
                  { label: '整形外科医', color: '#dc2626' },
                  { label: 'PT', color: '#2563eb' },
                  { label: 'AT', color: '#16a34a' },
                  { label: 'バイオメカニクス', color: '#7c3aed' },
                  { label: '柔道整復師', color: '#d97706' },
                ].map((e) => (
                  <span key={e.label} className="text-xs px-2 py-0.5 rounded-full text-white font-medium" style={{ backgroundColor: e.color }}>
                    {e.label}
                  </span>
                ))}
              </div>
            )}
          </div>
          <p className="text-xs text-purple-400">生成完了後、自動的に保存されます</p>
        </div>
      )}
    </div>
  )
}
