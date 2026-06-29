'use client'
// ──────────────────────────────────────────────
// アウトカムスコア入力・管理ページ
// ──────────────────────────────────────────────
import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, Save, Trash2, ChevronDown, ChevronUp, Info } from 'lucide-react'
import { getPatient } from '@/lib/patient-store'
import { getScores, getScoresByType, saveScore, deleteScore } from '@/lib/outcome-score-store'
import { SCORE_DEFS, REGION_SCORES } from '@/data/outcome-score-defs'
import type { ScoreId, OutcomeScoreRecord } from '@/types/outcome-scores'
import type { Patient, BodyRegion } from '@/types/patient'
import { BODY_REGION_LABELS } from '@/types/patient'

// 表示名とアイコン（部位別タブ）
const REGION_TABS: { id: BodyRegion; label: string; icon: string }[] = [
  { id: 'knee',     label: '膝関節',   icon: '🦵' },
  { id: 'shoulder', label: '肩関節',   icon: '💪' },
  { id: 'ankle',    label: '足関節',   icon: '🦶' },
  { id: 'hip',      label: '股関節',   icon: '🚶' },
  { id: 'lumbar',   label: '腰部',     icon: '🧍' },
  { id: 'cervical', label: '頚部',     icon: '🔄' },
  { id: 'elbow',    label: '肘・腕・手', icon: '✋' },
]

const COLOR_MAP = {
  green:  { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', badge: 'bg-emerald-100 text-emerald-700' },
  yellow: { bg: 'bg-amber-50',   border: 'border-amber-200',   text: 'text-amber-700',   badge: 'bg-amber-100 text-amber-700' },
  orange: { bg: 'bg-orange-50',  border: 'border-orange-200',  text: 'text-orange-700',  badge: 'bg-orange-100 text-orange-700' },
  red:    { bg: 'bg-red-50',     border: 'border-red-200',     text: 'text-red-700',     badge: 'bg-red-100 text-red-700' },
} as const

export default function OutcomeScoresPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: patientId } = use(params)
  const router = useRouter()
  const [patient, setPatient] = useState<Patient | null>(null)
  const [activeRegion, setActiveRegion] = useState<BodyRegion>('knee')
  const [selectedScoreId, setSelectedScoreId] = useState<ScoreId>('lysholm')
  const [answers, setAnswers] = useState<Record<string, number>>({})
  const [scoreDate, setScoreDate] = useState(new Date().toISOString().split('T')[0])
  const [notes, setNotes] = useState('')
  const [history, setHistory] = useState<OutcomeScoreRecord[]>([])
  const [saving, setSaving] = useState(false)
  const [savedId, setSavedId] = useState<string | null>(null)
  const [expandedHistory, setExpandedHistory] = useState<string | null>(null)
  const [showInfo, setShowInfo] = useState(false)

  useEffect(() => {
    const p = getPatient(patientId)
    if (!p) { router.replace('/patients'); return }
    setPatient(p)
    // 患者の主訴部位に合わせてデフォルトタブを設定
    const r = p.bodyRegion as BodyRegion
    const tabExists = REGION_TABS.find(t => t.id === r)
    if (tabExists) setActiveRegion(r)
  }, [patientId, router])

  useEffect(() => {
    setHistory(getScores(patientId))
  }, [patientId])

  // 部位変更時にスコアをリセット
  useEffect(() => {
    const scores = REGION_SCORES[activeRegion] ?? []
    if (scores.length > 0) setSelectedScoreId(scores[0])
    setAnswers({})
  }, [activeRegion])

  // スコア変更時に回答をリセット
  useEffect(() => {
    setAnswers({})
  }, [selectedScoreId])

  const scoreDef = SCORE_DEFS[selectedScoreId]
  const result = (() => {
    const answered = scoreDef.items.filter(item => answers[item.id] !== undefined)
    if (answered.length === 0) return null
    return scoreDef.calculate(answers)
  })()

  const historyForScore = history.filter(h => h.scoreId === selectedScoreId)

  function handleSave() {
    if (!result) return
    setSaving(true)
    const rec = saveScore({
      patientId,
      scoreId: selectedScoreId,
      scoreDate,
      answers,
      totalScore: result.total,
      interpretation: result.interp,
      interpretationColor: result.color,
      notes,
    })
    setSavedId(rec.id)
    setHistory(getScores(patientId))
    setTimeout(() => setSavedId(null), 2500)
    setSaving(false)
  }

  function handleDelete(id: string) {
    if (!confirm('この記録を削除しますか？')) return
    deleteScore(id)
    setHistory(getScores(patientId))
  }

  if (!patient) return null

  const regionScoreIds = REGION_SCORES[activeRegion] ?? []

  return (
    <div className="max-w-4xl mx-auto space-y-4">

      {/* ヘッダー */}
      <div className="flex items-center gap-3">
        <Link href={`/patients/${patientId}`} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-800 transition-colors">
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-lg font-bold text-gray-900">アウトカムスコア</h1>
          <p className="text-sm text-gray-500">{patient.name} さん</p>
        </div>
      </div>

      {/* 部位タブ */}
      <div className="flex gap-1.5 flex-wrap">
        {REGION_TABS.map(tab => {
          const hasScores = (REGION_SCORES[tab.id] ?? []).length > 0
          if (!hasScores) return null
          const isPatientRegion = patient.bodyRegion === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => setActiveRegion(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                activeRegion === tab.id
                  ? 'bg-teal-600 text-white shadow-sm'
                  : 'bg-white text-gray-600 border border-gray-200 hover:border-teal-300 hover:text-teal-700'
              } ${isPatientRegion ? 'ring-2 ring-teal-400 ring-offset-1' : ''}`}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
              {isPatientRegion && (
                <span className={`text-[10px] px-1 rounded ${activeRegion === tab.id ? 'bg-white/20 text-white' : 'bg-teal-100 text-teal-700'}`}>主</span>
              )}
            </button>
          )
        })}
      </div>

      {/* スコア選択 */}
      {regionScoreIds.length === 0 ? (
        <div className="bg-gray-50 rounded-xl p-6 text-center text-gray-400 text-sm">この部位に対応するスコアはありません</div>
      ) : (
        <div className="flex gap-2 flex-wrap">
          {regionScoreIds.map(sid => {
            const def = SCORE_DEFS[sid]
            const cnt = history.filter(h => h.scoreId === sid).length
            return (
              <button
                key={sid}
                onClick={() => setSelectedScoreId(sid)}
                className={`flex flex-col items-start px-4 py-2.5 rounded-xl border text-left transition-all ${
                  selectedScoreId === sid
                    ? 'bg-teal-600 text-white border-teal-600 shadow-sm'
                    : 'bg-white text-gray-700 border-gray-200 hover:border-teal-300'
                }`}
              >
                <div className="font-bold text-sm">{def.shortName}</div>
                <div className={`text-[11px] mt-0.5 ${selectedScoreId === sid ? 'text-teal-100' : 'text-gray-400'}`}>
                  {cnt > 0 ? `${cnt}回記録済み` : '未記録'}
                </div>
              </button>
            )
          })}
        </div>
      )}

      {/* メインエリア */}
      {regionScoreIds.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

          {/* 左：フォーム */}
          <div className="lg:col-span-2 space-y-4">
            {/* スコア情報 */}
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h2 className="font-bold text-gray-900">{scoreDef.fullName}</h2>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {scoreDef.higherIsBetter ? '↑高いほど良好' : '↓低いほど良好'} · 最大{scoreDef.maxScore}{scoreDef.unit} · 出典：{scoreDef.reference}
                  </p>
                </div>
                <button onClick={() => setShowInfo(v => !v)} className="text-gray-400 hover:text-teal-600 transition-colors">
                  <Info className="w-4 h-4" />
                </button>
              </div>
              {showInfo && (
                <div className="mt-3 p-3 bg-teal-50 rounded-lg border border-teal-100">
                  <p className="text-xs text-teal-700 font-medium mb-1">判定基準</p>
                  <div className="flex flex-wrap gap-2">
                    {scoreDef.thresholds.map(th => (
                      <span key={th.label} className={`text-xs px-2 py-0.5 rounded-full ${COLOR_MAP[th.color].badge}`}>
                        {th.label}（{th.min}〜{th.max}{scoreDef.unit}）
                      </span>
                    ))}
                  </div>
                </div>
              )}
              <div className="mt-3 flex items-center gap-3">
                <div>
                  <label className="text-xs text-gray-500 font-medium">評価日</label>
                  <input type="date" value={scoreDate} onChange={e => setScoreDate(e.target.value)}
                    className="mt-0.5 block px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500" />
                </div>
              </div>
            </div>

            {/* 質問フォーム */}
            <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
              {scoreDef.items.map((item, idx) => (
                <div key={item.id} className="p-4">
                  <div className="flex items-start gap-3">
                    <span className="text-xs font-bold text-gray-400 mt-0.5 flex-shrink-0 w-5">{idx + 1}</span>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-800 leading-snug">{item.question}</p>
                      {item.hint && <p className="text-xs text-gray-400 mt-0.5">{item.hint}</p>}
                      <div className="mt-2.5">
                        {item.type === 'radio' && item.options && (
                          <div className="space-y-1.5">
                            {item.options.map(opt => (
                              <label key={opt.value} className={`flex items-center gap-2.5 p-2 rounded-lg border cursor-pointer transition-all ${
                                answers[item.id] === opt.value
                                  ? 'bg-teal-50 border-teal-300 shadow-sm'
                                  : 'border-gray-100 hover:border-gray-200 hover:bg-gray-50'
                              }`}>
                                <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${
                                  answers[item.id] === opt.value
                                    ? 'border-teal-500 bg-teal-500'
                                    : 'border-gray-300'
                                }`}>
                                  {answers[item.id] === opt.value && (
                                    <div className="w-1.5 h-1.5 rounded-full bg-white" />
                                  )}
                                </div>
                                <span className={`text-sm leading-snug ${answers[item.id] === opt.value ? 'text-teal-800 font-medium' : 'text-gray-700'}`}>
                                  {opt.label}
                                  {scoreDef.higherIsBetter
                                    ? <span className="ml-1 text-xs text-gray-400">（{opt.value}点）</span>
                                    : null
                                  }
                                </span>
                                <input type="radio" className="sr-only"
                                  checked={answers[item.id] === opt.value}
                                  onChange={() => setAnswers(a => ({ ...a, [item.id]: opt.value }))} />
                              </label>
                            ))}
                          </div>
                        )}
                        {item.type === 'slider' && (
                          <div className="space-y-2">
                            <div className="flex items-center gap-3">
                              <input type="range"
                                min={item.min ?? 0} max={item.max ?? 10} step={1}
                                value={answers[item.id] ?? item.min ?? 0}
                                onChange={e => setAnswers(a => ({ ...a, [item.id]: Number(e.target.value) }))}
                                className="flex-1 accent-teal-600" />
                              <span className="w-10 text-center font-bold text-teal-700 bg-teal-50 rounded-lg px-2 py-1 text-sm">
                                {answers[item.id] ?? item.min ?? 0}
                              </span>
                            </div>
                            <div className="flex justify-between text-xs text-gray-400">
                              <span>{item.min ?? 0}</span>
                              <span>{item.max ?? 10}{item.unit ? ` ${item.unit}` : ''}</span>
                            </div>
                          </div>
                        )}
                        {item.type === 'number' && (
                          <div className="flex items-center gap-2">
                            <input type="number"
                              min={item.min} max={item.max}
                              value={answers[item.id] ?? ''}
                              onChange={e => setAnswers(a => ({ ...a, [item.id]: Number(e.target.value) }))}
                              className="w-24 px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500" />
                            {item.unit && <span className="text-sm text-gray-500">{item.unit}</span>}
                          </div>
                        )}
                      </div>
                    </div>
                    {/* 回答済みチェック */}
                    {answers[item.id] !== undefined && (
                      <span className="text-teal-500 text-lg flex-shrink-0">✓</span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* メモ */}
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <label className="text-xs font-medium text-gray-500">施術者メモ（任意）</label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={2}
                placeholder="特記事項・臨床所見・次回目標など"
                className="mt-1 w-full px-3 py-2 text-sm border border-gray-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
          </div>

          {/* 右：結果 + 履歴 */}
          <div className="space-y-4">
            {/* リアルタイム結果 */}
            <div className="bg-white rounded-xl border border-gray-200 p-4 sticky top-4">
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">スコア結果</h3>
              {result ? (
                <div className={`rounded-xl border p-4 ${COLOR_MAP[result.color].bg} ${COLOR_MAP[result.color].border}`}>
                  <div className="text-center">
                    <div className={`text-4xl font-bold ${COLOR_MAP[result.color].text}`}>
                      {result.total}
                    </div>
                    <div className="text-sm text-gray-500 mt-0.5">/ {scoreDef.maxScore}{scoreDef.unit}</div>
                    <div className={`mt-2 text-sm font-bold ${COLOR_MAP[result.color].text}`}>{result.interp}</div>
                  </div>
                  {result.subscores && Object.keys(result.subscores).length > 0 && (
                    <div className="mt-3 pt-3 border-t border-white/50 space-y-1.5">
                      {Object.entries(result.subscores).map(([k, v]) => (
                        <div key={k} className="flex justify-between text-xs">
                          <span className="text-gray-600">{k}</span>
                          <span className={`font-bold ${COLOR_MAP[result.color].text}`}>{v}点</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-300">
                  <div className="text-4xl mb-2">📋</div>
                  <p className="text-sm">回答すると自動計算されます</p>
                </div>
              )}
              <div className="mt-4 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">
                    {scoreDef.items.filter(i => answers[i.id] !== undefined).length} / {scoreDef.items.length} 項目回答済み
                  </span>
                </div>
                <button
                  onClick={handleSave}
                  disabled={!result || saving}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-teal-600 text-white text-sm font-semibold rounded-xl hover:bg-teal-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Save className="w-4 h-4" />
                  {saving ? '保存中...' : 'この評価を保存'}
                </button>
                {savedId && (
                  <p className="text-center text-xs text-emerald-600 font-medium">✓ 保存しました</p>
                )}
              </div>
            </div>

            {/* 判定基準 */}
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">判定基準</h3>
              <div className="space-y-1.5">
                {scoreDef.thresholds.map(th => (
                  <div key={th.label} className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs ${
                    result && result.color === th.color ? `${COLOR_MAP[th.color].bg} ${COLOR_MAP[th.color].border} border font-bold` : 'text-gray-500'
                  }`}>
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                      th.color === 'green' ? 'bg-emerald-500' :
                      th.color === 'yellow' ? 'bg-amber-400' :
                      th.color === 'orange' ? 'bg-orange-500' : 'bg-red-500'
                    }`} />
                    <span>{th.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 過去の記録 */}
      {historyForScore.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <h3 className="text-sm font-bold text-gray-700">
              📈 {scoreDef.shortName} 過去の記録（{historyForScore.length}件）
            </h3>
          </div>
          <div className="divide-y divide-gray-100">
            {historyForScore.map(rec => {
              const c = COLOR_MAP[rec.interpretationColor]
              const isExpanded = expandedHistory === rec.id
              return (
                <div key={rec.id}>
                  <div
                    className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 cursor-pointer"
                    onClick={() => setExpandedHistory(isExpanded ? null : rec.id)}
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-700">{rec.scoreDate}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${c.badge}`}>
                          {rec.totalScore}{scoreDef.unit} · {rec.interpretation}
                        </span>
                      </div>
                      {rec.notes && (
                        <p className="text-xs text-gray-400 mt-0.5 truncate">{rec.notes}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        onClick={e => { e.stopPropagation(); handleDelete(rec.id) }}
                        className="p-1 text-gray-300 hover:text-red-500 transition-colors rounded"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                      {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                    </div>
                  </div>
                  {isExpanded && (
                    <div className="px-4 pb-4 bg-gray-50">
                      {rec.subscores && Object.keys(rec.subscores).length > 0 && (
                        <div className="grid grid-cols-3 gap-2 mb-3">
                          {Object.entries(rec.subscores).map(([k, v]) => (
                            <div key={k} className="bg-white rounded-lg border border-gray-200 p-2 text-center">
                              <div className="text-xs text-gray-500">{k}</div>
                              <div className="text-base font-bold text-teal-700">{v}</div>
                            </div>
                          ))}
                        </div>
                      )}
                      {rec.notes && (
                        <p className="text-xs text-gray-600 bg-white rounded-lg border border-gray-200 p-2">{rec.notes}</p>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* トレンドグラフ（簡易バーチャート） */}
          {historyForScore.length > 1 && (
            <div className="px-4 py-4 border-t border-gray-100">
              <h4 className="text-xs font-bold text-gray-500 mb-3">スコア推移</h4>
              <div className="flex items-end gap-2 h-16">
                {[...historyForScore].reverse().map((rec, i) => {
                  const pct = (rec.totalScore / scoreDef.maxScore) * 100
                  const effPct = scoreDef.higherIsBetter ? pct : 100 - pct
                  const c = rec.interpretationColor
                  return (
                    <div key={rec.id} className="flex-1 flex flex-col items-center gap-1">
                      <span className="text-[9px] text-gray-400 font-bold">{rec.totalScore}</span>
                      <div className="w-full rounded-t-sm" style={{
                        height: `${Math.max(4, effPct * 0.5)}px`,
                        backgroundColor: c === 'green' ? '#10b981' : c === 'yellow' ? '#f59e0b' : c === 'orange' ? '#f97316' : '#ef4444'
                      }} />
                      <span className="text-[9px] text-gray-400 truncate w-full text-center">
                        {rec.scoreDate.slice(5)}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 全スコア一覧 */}
      {history.length > 0 && historyForScore.length === 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-700">
          このスコアの記録はありません。他のスコアは {history.length} 件記録されています。
        </div>
      )}

    </div>
  )
}
