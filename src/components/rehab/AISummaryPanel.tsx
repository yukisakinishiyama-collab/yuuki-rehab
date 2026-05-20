'use client'

import { useState } from 'react'
import type { VideoComment } from '@/types/rehab'
import { Sparkles, AlertTriangle, Loader, RefreshCw, Film, FileText } from 'lucide-react'

interface Props {
  comments: VideoComment[]
  movementType?: string
  videoSrc?: string | null
  caseInfo?: {
    diagnosis?: string
    age?: number
  }
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

// 動画から等間隔でフレームを抽出してbase64 JPEGを返す
async function extractFrames(videoSrc: string, count = 5): Promise<string[]> {
  return new Promise((resolve) => {
    const video = document.createElement('video')
    video.src = videoSrc
    video.crossOrigin = 'anonymous'
    video.muted = true

    video.onloadedmetadata = async () => {
      const duration = video.duration
      if (!duration || !isFinite(duration)) { resolve([]); return }

      const canvas = document.createElement('canvas')
      canvas.width = 640
      canvas.height = 360
      const ctx = canvas.getContext('2d')
      if (!ctx) { resolve([]); return }

      const frames: string[] = []

      for (let i = 0; i < count; i++) {
        const time = (duration / (count + 1)) * (i + 1)
        await new Promise<void>((res) => {
          video.currentTime = time
          video.onseeked = () => res()
          setTimeout(res, 1000) // タイムアウト保険
        })
        ctx.drawImage(video, 0, 0, 640, 360)
        const dataUrl = canvas.toDataURL('image/jpeg', 0.75)
        frames.push(dataUrl.split(',')[1]) // base64部分のみ
      }

      video.src = ''
      resolve(frames)
    }

    video.onerror = () => resolve([])
    video.load()
  })
}

export default function AISummaryPanel({ comments, movementType, videoSrc, caseInfo }: Props) {
  const [generated, setGenerated] = useState(false)
  const [loading, setLoading] = useState(false)
  const [loadingStep, setLoadingStep] = useState('')
  const [summary, setSummary] = useState('')
  const [frameCount, setFrameCount] = useState(0)
  const [error, setError] = useState('')
  const [customPrompt, setCustomPrompt] = useState('')
  const [showPromptInput, setShowPromptInput] = useState(false)

  async function handleGenerate() {
    setLoading(true)
    setError('')
    setSummary('')
    setFrameCount(0)

    let frames: string[] = []

    // 動画がある場合はフレームを抽出
    if (videoSrc) {
      setLoadingStep('動画からフレームを抽出中...')
      try {
        frames = await extractFrames(videoSrc, 5)
      } catch {
        frames = []
      }
    }

    setLoadingStep('Claude AIが動作を分析中...')

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
          customPrompt: customPrompt.trim() || undefined,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error ?? 'エラーが発生しました')
        setLoading(false)
        return
      }

      setSummary(data.summary)
      setFrameCount(data.frameCount ?? 0)
      setGenerated(true)
    } catch {
      setError('通信エラーが発生しました')
    } finally {
      setLoading(false)
      setLoadingStep('')
    }
  }

  function handleReset() {
    setGenerated(false)
    setSummary('')
    setError('')
    setFrameCount(0)
    setShowPromptInput(false)
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center gap-3 py-6 text-purple-700">
        <Loader className="w-5 h-5 animate-spin" />
        <div className="text-center">
          <p className="text-sm font-medium">{loadingStep || 'Claude AIが分析中...'}</p>
          {videoSrc && (
            <p className="text-xs text-purple-400 mt-1">動画フレームを画像解析しています</p>
          )}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-3">
        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
          <p className="text-xs text-red-700 font-medium mb-1">エラーが発生しました</p>
          <p className="text-xs text-red-600 break-all">{error}</p>
        </div>
        <button onClick={handleReset} className="flex items-center gap-1.5 text-xs text-purple-500 hover:text-purple-700">
          <RefreshCw className="w-3 h-3" /> 再試行
        </button>
      </div>
    )
  }

  if (!generated) {
    return (
      <div className="space-y-3">
        <div className="flex flex-col gap-1.5">
          <div className={`flex items-center gap-2 text-xs rounded-lg px-3 py-2 ${videoSrc ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-gray-50 text-gray-400 border border-gray-200'}`}>
            <Film className="w-3.5 h-3.5 flex-shrink-0" />
            {videoSrc ? '動画あり — フレームを画像解析（5枚）' : '動画なし — テキスト情報のみで分析'}
          </div>
          <div className={`flex items-center gap-2 text-xs rounded-lg px-3 py-2 ${comments.length > 0 ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'bg-gray-50 text-gray-400 border border-gray-200'}`}>
            <FileText className="w-3.5 h-3.5 flex-shrink-0" />
            {comments.length > 0 ? `専門家コメント ${comments.length}件を参照` : '専門家コメントなし'}
          </div>
        </div>

        {/* カスタムプロンプト入力 */}
        <div>
          <button
            onClick={() => setShowPromptInput(!showPromptInput)}
            className="text-xs text-purple-600 hover:text-purple-800 underline"
          >
            {showPromptInput ? '▲ 分析指示を閉じる' : '▼ 分析指示を入力する（任意）'}
          </button>
          {showPromptInput && (
            <div className="mt-2 space-y-2">
              {/* プリセットボタン */}
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
                <button
                  onClick={() => setCustomPrompt('')}
                  className="text-xs text-gray-400 hover:text-gray-600"
                >
                  クリア
                </button>
              )}
            </div>
          )}
        </div>

        <button
          onClick={handleGenerate}
          className="flex items-center gap-2 w-full justify-center py-2.5 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <Sparkles className="w-4 h-4" />
          {customPrompt.trim() ? 'カスタム指示でAI解析' : 'Claude AIで動作を解析'}
        </button>
      </div>
    )
  }

  // セクションに分割して表示
  const sections = summary.split(/\n(?=##\s)/)

  return (
    <div className="space-y-3">
      {/* 解析情報バッジ */}
      <div className="flex items-center gap-2 flex-wrap">
        {frameCount > 0 && (
          <span className="flex items-center gap-1 text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
            <Film className="w-3 h-3" /> 動画{frameCount}フレームを画像解析
          </span>
        )}
        {comments.length > 0 && (
          <span className="flex items-center gap-1 text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
            <FileText className="w-3 h-3" /> コメント{comments.length}件参照
          </span>
        )}
      </div>

      <div className="flex items-start gap-2 bg-yellow-50 border border-yellow-200 rounded-lg p-2.5">
        <AlertTriangle className="w-3.5 h-3.5 text-yellow-600 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-yellow-800 leading-relaxed">
          AIによる補助的分析です。最終的な診断・判断は専門家が行ってください。
        </p>
      </div>

      <div className="space-y-2.5">
        {sections.map((section, i) => {
          const lines = section.trim().split('\n')
          const firstLine = lines[0].replace(/^#+\s*/, '')
          const body = lines.slice(1).join('\n').trim()

          const color =
            firstLine.includes('リスク') ? 'text-orange-700 border-orange-200 bg-orange-50' :
            firstLine.includes('問題') ? 'text-red-700 border-red-200 bg-red-50' :
            firstLine.includes('介入') || firstLine.includes('トレーニング') ? 'text-blue-700 border-blue-200 bg-blue-50' :
            firstLine.includes('復帰') ? 'text-green-700 border-green-200 bg-green-50' :
            firstLine.includes('観察') ? 'text-purple-700 border-purple-200 bg-purple-50' :
            'text-gray-800 border-gray-200 bg-white'

          if (!firstLine && !body) return null

          return (
            <div key={i} className={`rounded-lg p-2.5 border ${color}`}>
              {firstLine && (
                <h4 className="text-xs font-bold mb-1.5">{firstLine}</h4>
              )}
              <div className="text-xs text-gray-700 leading-relaxed whitespace-pre-line">{body || firstLine}</div>
            </div>
          )
        })}
      </div>

      <button
        onClick={handleReset}
        className="flex items-center gap-1.5 text-xs text-purple-500 hover:text-purple-700 underline"
      >
        <RefreshCw className="w-3 h-3" /> 再解析する
      </button>
    </div>
  )
}
