'use client'

import { useState, useEffect } from 'react'
import type { RehabCase } from '@/types/rehab'
import { MOVEMENT_TYPE_LABELS, CASE_STATUS_LABELS, COMMENT_TYPE_LABELS } from '@/types/rehab'
import { MOCK_USERS } from '@/lib/rehab-data'
import { getComments, getAllEvaluations } from '@/lib/rehab-store'
import type { VideoComment, EvaluationResult } from '@/types/rehab'
import { Printer, FileText, AlertTriangle } from 'lucide-react'

interface Props {
  case_: RehabCase
}

export default function ReportView({ case_: c }: Props) {
  const [allComments, setAllComments] = useState<VideoComment[]>([])
  const [allEvals, setAllEvals] = useState<EvaluationResult[]>([])
  const now = new Date().toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' })

  useEffect(() => {
    const comments: VideoComment[] = []
    c.videos.forEach((v) => {
      comments.push(...getComments(v.id))
    })
    setAllComments(comments)
    setAllEvals(getAllEvaluations(c.id))
  }, [c])

  const problemComments = allComments.filter((cm) => cm.type === 'problem')
  const riskComments = allComments.filter((cm) => cm.type === 'risk')
  const positiveComments = allComments.filter((cm) => cm.type === 'positive')
  const improvementComments = allComments.filter((cm) => cm.type === 'improvement')

  const assignedNames = MOCK_USERS.filter((u) => c.assignedTo.includes(u.id)).map((u) => u.name)

  function handlePrint() {
    window.print()
  }

  return (
    <div>
      {/* Print button (hidden when printing) */}
      <div className="flex items-center justify-between mb-5 print:hidden">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-[#0d9488]" />
          <h2 className="font-semibold text-gray-900">動作分析レポート</h2>
        </div>
        <button
          onClick={handlePrint}
          className="flex items-center gap-2 px-4 py-2 bg-[#1e3a5f] hover:bg-[#162d4a] text-white text-sm font-medium rounded-xl transition-colors"
        >
          <Printer className="w-4 h-4" />
          PDF出力
        </button>
      </div>

      {/* Report body */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm print:shadow-none print:border-none" id="report-body">
        <div className="p-6 space-y-6">
          {/* Header */}
          <div className="flex items-start justify-between pb-4 border-b border-gray-200">
            <div>
              <div className="text-xs text-gray-400 mb-1">運動器リハビリテーション動作分析レポート</div>
              <h1 className="text-xl font-bold text-[#1e3a5f]">YUUKI REHAB</h1>
            </div>
            <div className="text-right text-sm text-gray-500">
              <div>作成日: {now}</div>
              <div>担当者: {assignedNames.join('・')}</div>
            </div>
          </div>

          {/* Patient info */}
          <section>
            <SectionTitle>1. 対象者情報</SectionTitle>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
              <InfoRow label="匿名ID" value={c.anonymousId} />
              {c.patientName && <InfoRow label="患者氏名" value={c.patientName} />}
              <InfoRow label="年齢" value={`${c.age}歳`} />
              <InfoRow label="性別" value={c.gender === 'male' ? '男性' : c.gender === 'female' ? '女性' : 'その他'} />
              <InfoRow label="診断名" value={c.diagnosis} />
              <InfoRow label="受傷部位" value={c.injuredPart} />
              {c.postOpDays != null && <InfoRow label="術後日数" value={`${c.postOpDays}日`} />}
              <InfoRow label="ステータス" value={CASE_STATUS_LABELS[c.status]} />
            </div>
          </section>

          {/* Purpose */}
          <section>
            <SectionTitle>2. 評価目的</SectionTitle>
            <p className="text-sm text-gray-700 leading-relaxed">{c.evaluationPurpose}</p>
          </section>

          {/* Videos */}
          <section>
            <SectionTitle>3. 分析動画一覧</SectionTitle>
            {c.videos.length === 0 ? (
              <p className="text-sm text-gray-400">動画が登録されていません</p>
            ) : (
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="text-left px-3 py-2 text-xs text-gray-500 font-semibold border border-gray-200">ラベル</th>
                    <th className="text-left px-3 py-2 text-xs text-gray-500 font-semibold border border-gray-200">動作種別</th>
                    <th className="text-left px-3 py-2 text-xs text-gray-500 font-semibold border border-gray-200">撮影方向</th>
                    <th className="text-left px-3 py-2 text-xs text-gray-500 font-semibold border border-gray-200">撮影日</th>
                  </tr>
                </thead>
                <tbody>
                  {c.videos.map((v) => (
                    <tr key={v.id} className="odd:bg-white even:bg-gray-50">
                      <td className="px-3 py-2 border border-gray-200">{v.label}</td>
                      <td className="px-3 py-2 border border-gray-200">{MOVEMENT_TYPE_LABELS[v.movementType]}</td>
                      <td className="px-3 py-2 border border-gray-200">{v.direction === 'front' ? '正面' : v.direction === 'side' ? '側面' : v.direction === 'rear' ? '後方' : 'その他'}</td>
                      <td className="px-3 py-2 border border-gray-200">{v.uploadedAt.slice(0, 10)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          {/* Evaluation results */}
          {allEvals.length > 0 && (
            <section>
              <SectionTitle>4. 動作評価チェックリスト結果</SectionTitle>
              {allEvals.map((ev) => {
                const checkedItems = ev.items.filter((i) => i.checked || i.severity !== '')
                return (
                  <div key={ev.id} className="mb-4">
                    <div className="font-medium text-gray-800 text-sm mb-2">
                      {MOVEMENT_TYPE_LABELS[ev.movementType]}（評価者: {ev.evaluatedByName}）
                    </div>
                    {checkedItems.length === 0 ? (
                      <p className="text-sm text-gray-400 ml-3">問題点なし</p>
                    ) : (
                      <ul className="space-y-1 ml-3">
                        {checkedItems.map((item) => (
                          <li key={item.key} className="text-sm flex items-start gap-2">
                            <span className="text-gray-400 mt-0.5">•</span>
                            <span>
                              <span className="font-medium">{item.label}</span>
                              {item.severity !== '' && item.severity !== 'none' && (
                                <span className={`ml-2 text-xs px-1.5 py-0.5 rounded ${
                                  item.severity === 'severe' ? 'bg-red-100 text-red-700' :
                                  item.severity === 'moderate' ? 'bg-orange-100 text-orange-700' :
                                  'bg-yellow-100 text-yellow-700'
                                }`}>
                                  {item.severity === 'mild' ? '軽度' : item.severity === 'moderate' ? '中等度' : '重度'}
                                </span>
                              )}
                              {item.note && <span className="text-gray-500 ml-2">— {item.note}</span>}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                    {ev.overallNote && (
                      <div className="mt-2 ml-3 p-3 bg-gray-50 rounded-lg text-sm text-gray-700">
                        <span className="font-medium text-gray-500 text-xs block mb-1">総合所見</span>
                        {ev.overallNote}
                      </div>
                    )}
                  </div>
                )
              })}
            </section>
          )}

          {/* Problems */}
          {problemComments.length > 0 && (
            <section>
              <SectionTitle>5. 問題点</SectionTitle>
              <ul className="space-y-2">
                {problemComments.map((cm) => (
                  <CommentListItem key={cm.id} comment={cm} />
                ))}
              </ul>
            </section>
          )}

          {/* Improvements */}
          {improvementComments.length > 0 && (
            <section>
              <SectionTitle>6. 改善点・推奨介入</SectionTitle>
              <ul className="space-y-2">
                {improvementComments.map((cm) => (
                  <CommentListItem key={cm.id} comment={cm} />
                ))}
              </ul>
            </section>
          )}

          {/* Positive */}
          {positiveComments.length > 0 && (
            <section>
              <SectionTitle>7. 良好な点</SectionTitle>
              <ul className="space-y-2">
                {positiveComments.map((cm) => (
                  <CommentListItem key={cm.id} comment={cm} />
                ))}
              </ul>
            </section>
          )}

          {/* Risks */}
          {riskComments.length > 0 && (
            <section>
              <SectionTitle>8. リスク評価</SectionTitle>
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <AlertTriangle className="w-4 h-4 text-red-600" />
                  <span className="text-sm font-semibold text-red-800">
                    以下はリスクコメントです。専門家による確認が必要な可能性があります。
                  </span>
                </div>
                <ul className="space-y-2">
                  {riskComments.map((cm) => (
                    <CommentListItem key={cm.id} comment={cm} />
                  ))}
                </ul>
              </div>
            </section>
          )}

          {/* Disclaimer */}
          <section className="border-t border-gray-200 pt-4">
            <p className="text-xs text-gray-400 leading-relaxed">
              ※ 本レポートは動作分析の補助ツールとして作成されたものです。記載内容は専門家による確認が必要な可能性があり、確定的な診断を示すものではありません。
              最終的な判断は担当医師・理学療法士が行ってください。個人情報は適切に管理してください。
            </p>
          </section>
        </div>
      </div>

      <style>{`
        @media print {
          body > * { display: none; }
          #report-body { display: block !important; }
        }
      `}</style>
    </div>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-sm font-bold text-[#1e3a5f] mb-3 pb-1.5 border-b border-gray-200">
      {children}
    </h2>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-gray-50 rounded-lg px-3 py-2">
      <div className="text-xs text-gray-400">{label}</div>
      <div className="font-medium text-gray-800 mt-0.5">{value}</div>
    </div>
  )
}

function CommentListItem({ comment }: { comment: VideoComment }) {
  function formatTime(s: number) {
    return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`
  }
  return (
    <li className="text-sm flex items-start gap-2">
      <span className="text-gray-400 mt-0.5 flex-shrink-0">•</span>
      <span>
        {comment.text}
        <span className="text-xs text-gray-400 ml-2">
          [{formatTime(comment.timestamp)}] {comment.authorName}
        </span>
      </span>
    </li>
  )
}
