'use client'

/**
 * OverallEvaluation
 * 症例に紐づく全評価データ（チェックリスト・ROM・AIディスカッション）を
 * 統合し、総合評価ダッシュボードとAI総合レポートを表示するコンポーネント。
 */

import { useState, useEffect, useRef } from 'react'
import type { RehabCase, EvaluationResult, ROMSession, AISummary, DiscussionSession } from '@/types/rehab'
import { MOVEMENT_TYPE_LABELS } from '@/types/rehab'
import {
  getAllEvaluations,
  getROMSessions,
  getAISummaries,
  getDiscussionSessions,
} from '@/lib/rehab-store'
import {
  BarChart2, AlertTriangle, Activity, Video,
  Sparkles, Loader2, ClipboardList, TrendingUp,
  ChevronDown, ChevronUp,
} from 'lucide-react'

interface Props {
  case_: RehabCase
}

// ── 集計型 ────────────────────────────────────────────────────────────────────
interface AggregatedData {
  totalVideos: number
  totalEvals: number
  totalROMSessions: number
  severityCounts: { severe: number; moderate: number; mild: number }
  topIssues: Array<{ label: string; movementType: string; count: number; severity: string }>
  movementCoverage: string[]
  romSummary: Array<{ joint: string; side: string; avgMax: number; avgMin: number; avgRange: number }>
  checklistIssues: Array<{ movementType: string; label: string; severity: string; note?: string; frequency: number }>
  aiSummaries: string[]
  overallNotes: string[]
  discussionHighlights: string[]
}

// ── データ集計 ────────────────────────────────────────────────────────────────
function aggregate(case_: RehabCase): AggregatedData {
  const evals: EvaluationResult[] = getAllEvaluations(case_.id)
  const videos = case_.videos

  // ROM セッション（全動画分）
  const allROMSessions: ROMSession[] = videos.flatMap((v) => getROMSessions(v.id))

  // AI サマリー（全動画分）
  const allAISummaries: AISummary[] = videos.flatMap((v) => getAISummaries(v.id))

  // ディスカッション
  const discussions: DiscussionSession[] = getDiscussionSessions(case_.id)

  // 重症度カウント
  const severityCounts = { severe: 0, moderate: 0, mild: 0 }
  const issueMap = new Map<string, { label: string; movementType: string; severity: string; note?: string; count: number }>()

  for (const ev of evals) {
    const mtLabel = MOVEMENT_TYPE_LABELS[ev.movementType] ?? ev.movementType
    for (const item of ev.items) {
      if (!item.checked || !item.severity || item.severity === 'none') continue
      if (item.severity === 'severe') severityCounts.severe++
      else if (item.severity === 'moderate') severityCounts.moderate++
      else if (item.severity === 'mild') severityCounts.mild++

      const key = `${ev.movementType}:${item.key}`
      const existing = issueMap.get(key)
      if (existing) {
        existing.count++
        // 重症度は最悪値を保持
        if (item.severity === 'severe') existing.severity = 'severe'
        else if (item.severity === 'moderate' && existing.severity !== 'severe') existing.severity = 'moderate'
      } else {
        issueMap.set(key, {
          label: item.label,
          movementType: mtLabel,
          severity: item.severity,
          note: item.note || undefined,
          count: 1,
        })
      }
    }
  }

  // 頻出問題 TOP
  const topIssues = Array.from(issueMap.values())
    .sort((a, b) => {
      const sevOrder = { severe: 0, moderate: 1, mild: 2 }
      const sevDiff = (sevOrder[a.severity as keyof typeof sevOrder] ?? 3) - (sevOrder[b.severity as keyof typeof sevOrder] ?? 3)
      if (sevDiff !== 0) return sevDiff
      return b.count - a.count
    })
    .slice(0, 10)

  // チェックリスト全問題
  const checklistIssues = Array.from(issueMap.values()).map((v) => ({
    movementType: v.movementType,
    label: v.label,
    severity: v.severity,
    note: v.note,
    frequency: v.count,
  }))

  // 動作種別カバレッジ
  const movementCoverage = [...new Set(evals.map((e) => MOVEMENT_TYPE_LABELS[e.movementType] ?? e.movementType))]

  // ROM サマリー（関節別平均）
  const romAccum = new Map<string, { joint: string; side: string; maxSum: number; minSum: number; rangeSum: number; count: number }>()
  for (const session of allROMSessions) {
    for (const sample of session.samples) {
      for (const [key, angle] of Object.entries(sample.angles)) {
        const mapKey = `${key}_${angle.side}`
        const existing = romAccum.get(mapKey)
        if (existing) {
          existing.maxSum += angle.value
          existing.minSum += angle.value
          existing.rangeSum += angle.value
          existing.count++
        } else {
          romAccum.set(mapKey, {
            joint: angle.label,
            side: angle.side,
            maxSum: angle.value,
            minSum: angle.value,
            rangeSum: angle.value,
            count: 1,
          })
        }
      }
    }
  }
  // ROM セッションのサマリーデータを使用（サンプル単位ではなくセッション単位で集計）
  const romSessionAccum = new Map<string, { joint: string; side: string; maxSum: number; minSum: number; rangeSum: number; count: number }>()
  for (const session of allROMSessions) {
    // セッション内の最大・最小を計算
    const jointData = new Map<string, { maxVals: number[]; minVals: number[]; label: string; side: string }>()
    for (const sample of session.samples) {
      for (const [key, angle] of Object.entries(sample.angles)) {
        const mapKey = `${key}_${angle.side}`
        const existing = jointData.get(mapKey)
        if (existing) {
          existing.maxVals.push(angle.value)
          existing.minVals.push(angle.value)
        } else {
          jointData.set(mapKey, {
            label: angle.label,
            side: angle.side,
            maxVals: [angle.value],
            minVals: [angle.value],
          })
        }
      }
    }
    for (const [mapKey, data] of jointData.entries()) {
      const max = Math.round(Math.max(...data.maxVals))
      const min = Math.round(Math.min(...data.minVals))
      const range = max - min
      const existing = romSessionAccum.get(mapKey)
      if (existing) {
        existing.maxSum += max
        existing.minSum += min
        existing.rangeSum += range
        existing.count++
      } else {
        romSessionAccum.set(mapKey, {
          joint: data.label,
          side: data.side,
          maxSum: max,
          minSum: min,
          rangeSum: range,
          count: 1,
        })
      }
    }
  }

  const romSummary = Array.from(romSessionAccum.values()).map((v) => ({
    joint: v.joint,
    side: v.side,
    avgMax: Math.round(v.maxSum / v.count),
    avgMin: Math.round(v.minSum / v.count),
    avgRange: Math.round(v.rangeSum / v.count),
  }))

  // AI サマリーテキスト
  const aiSummaries = allAISummaries.map((s) => s.summary).filter(Boolean)

  // 評価者メモ
  const overallNotes = evals.map((e) => e.overallNote).filter(Boolean)

  // ディスカッション要点（専門家の最初の発言を抜粋）
  const discussionHighlights = discussions
    .flatMap((d) => d.messages.filter((m) => m.role === 'expert'))
    .slice(0, 5)
    .map((m) => `[${m.expertName}] ${m.text.slice(0, 120)}...`)

  return {
    totalVideos: videos.length,
    totalEvals: evals.length,
    totalROMSessions: allROMSessions.length,
    severityCounts,
    topIssues,
    movementCoverage,
    romSummary,
    checklistIssues,
    aiSummaries,
    overallNotes,
    discussionHighlights,
  }
}

// ── Markdown簡易レンダラー ────────────────────────────────────────────────────
function ReportContent({ text }: { text: string }) {
  const lines = text.split('\n')
  const elements: React.ReactNode[] = []
  let inList = false
  let listItems: React.ReactNode[] = []

  function flushList() {
    if (listItems.length > 0) {
      elements.push(<ul key={`ul-${elements.length}`} className="list-none space-y-1 pl-0 mb-3">{listItems}</ul>)
      listItems = []
      inList = false
    }
  }

  lines.forEach((line, i) => {
    if (line.startsWith('## ')) {
      flushList()
      elements.push(
        <h3 key={i} className="text-base font-bold text-gray-900 mt-5 mb-2 pb-1 border-b border-gray-200 flex items-center gap-2">
          {line.replace('## ', '')}
        </h3>
      )
    } else if (line.startsWith('### ')) {
      flushList()
      elements.push(
        <h4 key={i} className="text-sm font-semibold text-gray-700 mt-3 mb-1">
          {line.replace('### ', '')}
        </h4>
      )
    } else if (line.startsWith('・') || line.startsWith('- ') || line.match(/^\d+\./)) {
      inList = true
      const content = line.replace(/^・|^- |\d+\.\s*/, '')
      listItems.push(
        <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
          <span className="mt-1 w-1.5 h-1.5 rounded-full bg-gray-400 flex-shrink-0" />
          <span>{content}</span>
        </li>
      )
    } else if (line.trim() === '') {
      flushList()
      elements.push(<div key={i} className="h-1" />)
    } else {
      flushList()
      elements.push(<p key={i} className="text-sm text-gray-700 leading-relaxed mb-1">{line}</p>)
    }
  })
  flushList()

  return <div className="space-y-0.5">{elements}</div>
}

// ── メインコンポーネント ──────────────────────────────────────────────────────
export default function OverallEvaluation({ case_ }: Props) {
  const [data, setData] = useState<AggregatedData | null>(null)
  const [showDetails, setShowDetails] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [report, setReport] = useState('')
  const [reportDone, setReportDone] = useState(false)
  const reportRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setData(aggregate(case_))
  }, [case_])

  async function generateReport() {
    if (!data) return
    setGenerating(true)
    setReport('')
    setReportDone(false)

    const body = {
      caseInfo: {
        diagnosis: case_.diagnosis,
        injuredPart: case_.injuredPart,
        age: case_.age,
        gender: case_.gender,
        sport: case_.sport,
        status: case_.status,
        postOpDays: case_.postOpDays,
        evaluationPurpose: case_.evaluationPurpose,
      },
      evaluationSummary: {
        totalVideos: data.totalVideos,
        totalEvals: data.totalEvals,
        totalROMSessions: data.totalROMSessions,
        severityCounts: data.severityCounts,
        topIssues: data.topIssues,
        movementCoverage: data.movementCoverage,
      },
      romSummary: data.romSummary,
      checklistIssues: data.checklistIssues,
      aiSummaries: data.aiSummaries,
      overallNotes: data.overallNotes,
      discussionHighlights: data.discussionHighlights,
    }

    try {
      const res = await fetch('/api/overall-eval', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        let detail = `HTTPステータス: ${res.status}`
        try {
          const errJson = await res.json()
          detail = `${detail}\n詳細: ${errJson.detail ?? errJson.error ?? JSON.stringify(errJson)}`
        } catch { /* JSON解析失敗は無視 */ }
        throw new Error(detail)
      }
      const reader = res.body!.getReader()
      const decoder = new TextDecoder()
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        setReport((prev) => prev + decoder.decode(value, { stream: true }))
        // 自動スクロール
        setTimeout(() => {
          reportRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
        }, 50)
      }
      setReportDone(true)
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err)
      console.error('[OverallEvaluation error]', errMsg)
      setReport(`エラーが発生しました。\n\n${errMsg}`)
    } finally {
      setGenerating(false)
    }
  }

  if (!data) return null

  const totalIssues = data.severityCounts.severe + data.severityCounts.moderate + data.severityCounts.mild
  const hasData = data.totalEvals > 0 || data.totalROMSessions > 0

  return (
    <div className="space-y-6">
      {/* ── ページヘッダー ─────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <BarChart2 className="w-5 h-5 text-indigo-600" />
            総合評価ダッシュボード
          </h2>
          <p className="text-sm text-gray-500 mt-0.5">
            全評価データを統合した包括的な臨床評価
          </p>
        </div>
        <button
          onClick={generateReport}
          disabled={generating || !hasData}
          className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-xl text-sm transition-colors disabled:opacity-50 shadow-sm"
        >
          {generating
            ? <Loader2 className="w-4 h-4 animate-spin" />
            : <Sparkles className="w-4 h-4" />
          }
          {generating ? 'AI生成中...' : 'AI総合評価レポート生成'}
        </button>
      </div>

      {/* ── サマリーカード ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          icon={<Video className="w-5 h-5 text-teal-600" />}
          label="動画数"
          value={data.totalVideos}
          unit="件"
          bg="bg-teal-50"
        />
        <StatCard
          icon={<ClipboardList className="w-5 h-5 text-blue-600" />}
          label="評価実施"
          value={data.totalEvals}
          unit="回"
          bg="bg-blue-50"
        />
        <StatCard
          icon={<AlertTriangle className="w-5 h-5 text-red-500" />}
          label="問題点"
          value={totalIssues}
          unit="件"
          bg="bg-red-50"
          sub={data.severityCounts.severe > 0 ? `重度 ${data.severityCounts.severe}件` : undefined}
          subColor="text-red-600"
        />
        <StatCard
          icon={<Activity className="w-5 h-5 text-purple-600" />}
          label="ROM計測"
          value={data.totalROMSessions}
          unit="回"
          bg="bg-purple-50"
        />
      </div>

      {/* データなし警告 */}
      {!hasData && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-700">
          <p className="font-semibold mb-1">まだ評価データがありません</p>
          <p>動画を解析して評価チェックリストを記録すると、ここに総合評価が表示されます。</p>
        </div>
      )}

      {hasData && (
        <>
          {/* ── 重症度分布 + 頻出問題 ───────────────────────────────────── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* 重症度分布 */}
            <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
              <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-gray-500" />
                重症度分布
              </h3>
              <div className="space-y-3">
                <SeverityBar
                  label="🔴 重度"
                  count={data.severityCounts.severe}
                  total={totalIssues}
                  color="bg-red-500"
                  textColor="text-red-700"
                />
                <SeverityBar
                  label="🟡 中等度"
                  count={data.severityCounts.moderate}
                  total={totalIssues}
                  color="bg-amber-400"
                  textColor="text-amber-700"
                />
                <SeverityBar
                  label="🟢 軽度"
                  count={data.severityCounts.mild}
                  total={totalIssues}
                  color="bg-green-500"
                  textColor="text-green-700"
                />
              </div>
              {data.movementCoverage.length > 0 && (
                <div className="mt-4 pt-3 border-t border-gray-100">
                  <p className="text-xs text-gray-500 mb-1.5">評価動作種別</p>
                  <div className="flex flex-wrap gap-1">
                    {data.movementCoverage.map((m) => (
                      <span key={m} className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full text-xs">
                        {m}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* 頻出問題 TOP */}
            <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
              <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-gray-500" />
                頻出問題 TOP {Math.min(data.topIssues.length, 5)}
              </h3>
              {data.topIssues.length === 0 ? (
                <p className="text-sm text-gray-400">問題点なし</p>
              ) : (
                <ol className="space-y-2">
                  {data.topIssues.slice(0, 5).map((issue, i) => {
                    const sevColor =
                      issue.severity === 'severe' ? 'bg-red-100 text-red-700' :
                      issue.severity === 'moderate' ? 'bg-amber-100 text-amber-700' :
                      'bg-green-100 text-green-700'
                    return (
                      <li key={i} className="flex items-start gap-2">
                        <span className="w-5 h-5 flex-shrink-0 rounded-full bg-gray-200 text-gray-600 text-xs flex items-center justify-center font-bold">
                          {i + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${sevColor}`}>
                              {issue.severity === 'severe' ? '重度' : issue.severity === 'moderate' ? '中等度' : '軽度'}
                            </span>
                            <span className="text-xs text-gray-500">{issue.movementType}</span>
                            {issue.count > 1 && (
                              <span className="text-xs text-indigo-600 font-medium">×{issue.count}</span>
                            )}
                          </div>
                          <p className="text-sm text-gray-800 mt-0.5 truncate">{issue.label}</p>
                        </div>
                      </li>
                    )
                  })}
                </ol>
              )}
            </div>
          </div>

          {/* ── ROM サマリー ─────────────────────────────────────────────── */}
          {data.romSummary.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
              <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <Activity className="w-4 h-4 text-gray-500" />
                ROM計測サマリー（全セッション平均）
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-gray-500 border-b border-gray-100">
                      <th className="text-left py-1.5 pr-3 font-medium">関節</th>
                      <th className="text-right py-1.5 px-2 font-medium">側</th>
                      <th className="text-right py-1.5 px-2 font-medium">最大</th>
                      <th className="text-right py-1.5 px-2 font-medium">最小</th>
                      <th className="text-right py-1.5 pl-2 font-medium">可動域</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {data.romSummary.map((r, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="py-1.5 pr-3 text-gray-800">{r.joint}</td>
                        <td className="py-1.5 px-2 text-right">
                          <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                            r.side === '左' ? 'bg-blue-100 text-blue-700' :
                            r.side === '右' ? 'bg-red-100 text-red-700' :
                            'bg-gray-100 text-gray-600'
                          }`}>
                            {r.side}
                          </span>
                        </td>
                        <td className="py-1.5 px-2 text-right text-gray-700">{r.avgMax}°</td>
                        <td className="py-1.5 px-2 text-right text-gray-700">{r.avgMin}°</td>
                        <td className="py-1.5 pl-2 text-right font-semibold text-indigo-600">{r.avgRange}°</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-gray-400 mt-2">※ 2D映像解析のため参考値。3Dバイオメカニクスとの差異に注意。</p>
            </div>
          )}

          {/* ── 全問題項目（折りたたみ） ─────────────────────────────────── */}
          {data.checklistIssues.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
              <button
                onClick={() => setShowDetails(!showDetails)}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
              >
                <span className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                  <ClipboardList className="w-4 h-4 text-gray-500" />
                  全問題項目一覧（{data.checklistIssues.length}件）
                </span>
                {showDetails
                  ? <ChevronUp className="w-4 h-4 text-gray-400" />
                  : <ChevronDown className="w-4 h-4 text-gray-400" />
                }
              </button>
              {showDetails && (
                <div className="px-4 pb-4 border-t border-gray-100">
                  <div className="mt-3 space-y-1.5">
                    {[...data.checklistIssues]
                      .sort((a, b) => {
                        const order = { severe: 0, moderate: 1, mild: 2 }
                        return (order[a.severity as keyof typeof order] ?? 3) - (order[b.severity as keyof typeof order] ?? 3)
                      })
                      .map((issue, i) => {
                        const sevStyle =
                          issue.severity === 'severe' ? 'bg-red-100 text-red-700 border-red-200' :
                          issue.severity === 'moderate' ? 'bg-amber-100 text-amber-700 border-amber-200' :
                          'bg-green-100 text-green-700 border-green-200'
                        return (
                          <div key={i} className="flex items-start gap-2 py-1.5 border-b border-gray-50 last:border-0">
                            <span className={`px-1.5 py-0.5 rounded border text-xs font-medium flex-shrink-0 ${sevStyle}`}>
                              {issue.severity === 'severe' ? '重度' : issue.severity === 'moderate' ? '中等度' : '軽度'}
                            </span>
                            <span className="text-xs text-gray-500 flex-shrink-0 min-w-[60px]">{issue.movementType}</span>
                            <span className="text-sm text-gray-800 flex-1">{issue.label}</span>
                            {issue.frequency > 1 && (
                              <span className="text-xs text-indigo-600 font-medium flex-shrink-0">×{issue.frequency}</span>
                            )}
                          </div>
                        )
                      })
                    }
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* ── AI総合評価レポート ─────────────────────────────────────────── */}
      {(report || generating) && (
        <div className="bg-white border border-indigo-200 rounded-xl shadow-sm overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 bg-indigo-50 border-b border-indigo-200">
            <Sparkles className="w-4 h-4 text-indigo-600" />
            <span className="text-sm font-semibold text-indigo-800">AI総合評価レポート</span>
            {generating && (
              <Loader2 className="w-3.5 h-3.5 text-indigo-500 animate-spin ml-auto" />
            )}
            {reportDone && (
              <span className="ml-auto text-xs text-indigo-500">生成完了</span>
            )}
          </div>
          <div className="p-5" ref={reportRef}>
            {report
              ? <ReportContent text={report} />
              : <div className="flex items-center gap-2 text-sm text-gray-400">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  生成中...
                </div>
            }
          </div>
        </div>
      )}

      {/* データなし + 生成前の誘導テキスト */}
      {hasData && !report && !generating && (
        <div className="text-center py-6 text-sm text-gray-400">
          <Sparkles className="w-8 h-8 mx-auto mb-2 text-indigo-300" />
          <p>「AI総合評価レポート生成」ボタンを押すと、</p>
          <p>全評価データを統合した臨床レポートが自動作成されます。</p>
        </div>
      )}
    </div>
  )
}

// ── サブコンポーネント ─────────────────────────────────────────────────────────

function StatCard({
  icon, label, value, unit, bg, sub, subColor,
}: {
  icon: React.ReactNode
  label: string
  value: number
  unit: string
  bg: string
  sub?: string
  subColor?: string
}) {
  return (
    <div className={`${bg} rounded-xl p-4 border border-white`}>
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className="text-xs text-gray-500">{label}</span>
      </div>
      <p className="text-2xl font-bold text-gray-900">
        {value}
        <span className="text-sm font-normal text-gray-500 ml-1">{unit}</span>
      </p>
      {sub && <p className={`text-xs mt-0.5 font-medium ${subColor ?? 'text-gray-500'}`}>{sub}</p>}
    </div>
  )
}

function SeverityBar({
  label, count, total, color, textColor,
}: {
  label: string
  count: number
  total: number
  color: string
  textColor: string
}) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className={`text-sm font-medium ${textColor}`}>{label}</span>
        <span className="text-sm font-semibold text-gray-700">{count}件 <span className="text-xs text-gray-400">({pct}%)</span></span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full ${color} rounded-full transition-all duration-500`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}
