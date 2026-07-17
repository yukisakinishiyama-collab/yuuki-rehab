'use client'

// リハビリがんばりレポート
// 患者に手渡しできるA4印刷用の評価レポート。回復の可視化とほめ言葉で
// 「リハビリを続けたくなる」ことを目的とした患者向けデザイン。

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { Protocol, ProtocolPatient, Assessment, Milestone } from '@/types/protocol'
import {
  getProtocolById, getPatientById, getAssessmentsByProtocol,
  getMilestones, initMilestones, updateProtocol,
} from '@/lib/protocol-store'
import {
  computeMetricChanges, overallProgress, daysSinceStart, generatePraise,
  type MetricChange,
} from '@/lib/progress-utils'
import {
  JourneyIllustration, ProgressRing, EffortStamp, CheeringBuddy,
} from '@/components/protocol/RehabIllustrations'
import ProgressChart from '@/components/protocol/ProgressChart'
import {
  ArrowLeft, Printer, TrendingUp, TrendingDown, Minus, Star,
  Target, CalendarDays, ClipboardCheck, Trophy, MessageCircleHeart,
} from 'lucide-react'

// 変化の方向アイコンと色
function ChangeArrow({ change }: { change: MetricChange }) {
  const up = change.delta > 0
  if (change.judgment === 'improved') {
    const Icon = up ? TrendingUp : TrendingDown
    return <Icon className="w-4 h-4 text-teal-600" />
  }
  if (change.judgment === 'worsened') {
    const Icon = up ? TrendingUp : TrendingDown
    return <Icon className="w-4 h-4 text-amber-500" />
  }
  if (change.delta === 0) return <Minus className="w-4 h-4 text-slate-400" />
  const Icon = up ? TrendingUp : TrendingDown
  return <Icon className="w-4 h-4 text-slate-400" />
}

export default function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [protocol, setProtocol] = useState<Protocol | null>(null)
  const [patient, setPatient] = useState<ProtocolPatient | null>(null)
  const [assessments, setAssessments] = useState<Assessment[]>([])
  const [milestones, setMilestones] = useState<Milestone[]>([])
  const [comment, setComment] = useState('')
  const [savedFlash, setSavedFlash] = useState(false)

  useEffect(() => {
    const p = getProtocolById(id)
    if (!p) { router.replace('/protocols'); return }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setProtocol(p)
    setPatient(getPatientById(p.patientId))
    setAssessments(getAssessmentsByProtocol(id).sort((a, b) => a.date.localeCompare(b.date)))
    setMilestones(initMilestones(p.patientId))
    setComment(p.reportComment ?? '')
  }, [id, router])

  function saveComment() {
    if (!protocol) return
    updateProtocol(protocol.id, { reportComment: comment })
    setSavedFlash(true)
    setTimeout(() => setSavedFlash(false), 1500)
  }

  if (!protocol || !patient) return null

  const changes = computeMetricChanges(assessments)
  const progressPct = Math.round(overallProgress(protocol) * 100)
  const days = daysSinceStart(patient.eventDate, protocol.createdAt)
  const achievedMs = milestones.filter(m => m.achieved)
  const praise = generatePraise(changes, milestones, assessments.length)
  const currentPhase = protocol.phases[protocol.currentPhaseIndex]
  const criteriaPct = currentPhase && currentPhase.advanceCriteria.length > 0
    ? currentPhase.advanceCriteria.filter(c => c.met).length / currentPhase.advanceCriteria.length
    : 0
  const unmetCriteria = (currentPhase?.advanceCriteria ?? []).filter(c => !c.met)
  const nextMilestone = milestones.find(m => !m.achieved)
  const today = new Date().toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' })

  return (
    <div className="max-w-3xl mx-auto font-body">
      {/* 印刷用スタイル: アプリのサイドバー等を隠し、A4で綺麗に出力する */}
      <style>{`
        @media print {
          @page { size: A4; margin: 10mm 11mm; }
          aside, header { display: none !important; }
          [class*="ml-56"] { margin-left: 0 !important; }
          main { padding: 0 !important; }
          body { background: white !important; }
          .report-section { break-inside: avoid; }
          #ganbari-report {
            border: none !important; box-shadow: none !important;
            border-radius: 0 !important; padding: 0 !important;
          }
        }
      `}</style>

      {/* 画面用ツールバー */}
      <div className="no-print flex items-center justify-between mb-4">
        <Link
          href={`/protocols/${id}/progress`}
          className="flex items-center gap-1.5 text-sm text-[--color-text-secondary]
            hover:text-[--color-text-primary] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />進捗管理に戻る
        </Link>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400 hidden sm:inline">
            A4サイズで印刷して患者様にお渡しください
          </span>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[--color-primary] text-white
              text-sm font-bold font-display hover:bg-[--color-primary-hover] transition-colors shadow-sm"
          >
            <Printer className="w-4 h-4" />レポートを印刷
          </button>
        </div>
      </div>

      {/* ═══ レポート本体 ═══ */}
      <div id="ganbari-report" className="bg-white rounded-2xl border border-slate-200 shadow-sm p-7 text-slate-800">

        {/* ヘッダー */}
        <div className="report-section flex items-start justify-between border-b-2 border-teal-600 pb-4 mb-5">
          <div>
            <div className="text-[10px] font-bold text-teal-700 tracking-[0.25em] font-display mb-1">
              YUUKI SEIKOTSUIN REHAB REPORT
            </div>
            <h1 className="text-2xl font-bold text-slate-900 font-display leading-tight">
              リハビリがんばりレポート
            </h1>
            <div className="flex items-baseline gap-3 mt-2.5 flex-wrap">
              <span className="text-lg font-bold text-slate-900 font-display">
                {patient.name ?? '匿名患者'} 様
              </span>
              {patient.diagnosis && (
                <span className="text-xs text-slate-500">{patient.diagnosis}</span>
              )}
            </div>
            <div className="text-xs text-slate-400 mt-1">
              発行日: {today} ／ ゆうき整骨院
            </div>
          </div>
          <div className="flex-shrink-0">
            <CheeringBuddy size={92} />
          </div>
        </div>

        {/* 回復の旅 */}
        <div className="report-section mb-5">
          <h2 className="flex items-center gap-1.5 text-xs font-bold text-slate-500 font-display
            uppercase tracking-widest mb-2">
            <Trophy className="w-3.5 h-3.5 text-teal-600" />回復の旅 — いまここまで来ました
          </h2>
          <div className="bg-gradient-to-b from-sky-50/70 to-white rounded-xl border border-slate-100 px-3 pt-3 pb-1">
            <JourneyIllustration
              phaseCount={protocol.phases.length}
              currentPhaseIndex={protocol.currentPhaseIndex}
              criteriaPct={criteriaPct}
            />
          </div>
          {/* フェーズ凡例 */}
          <div className="flex flex-wrap gap-1.5 mt-2">
            {protocol.phases.map((ph, i) => {
              const done = i < protocol.currentPhaseIndex
              const active = i === protocol.currentPhaseIndex
              return (
                <span key={ph.id} className={`text-[10px] px-2 py-1 rounded-full border font-medium ${
                  done   ? 'bg-teal-600 border-teal-600 text-white' :
                  active ? 'bg-teal-50 border-teal-400 text-teal-700' :
                           'bg-white border-slate-200 text-slate-400'
                }`}>
                  {i + 1}. {ph.title}{active && '（いまここ）'}
                </span>
              )
            })}
          </div>
        </div>

        {/* 数字で見る回復 */}
        <div className="report-section grid grid-cols-4 gap-3 mb-6">
          <div className="flex flex-col items-center justify-center bg-slate-50 rounded-xl border border-slate-100 py-3">
            <ProgressRing pct={progressPct} size={104} label="プログラム" />
          </div>
          {[
            { Icon: CalendarDays,   value: `${days}`,                              unit: '日',  label: 'リハビリ継続' },
            { Icon: ClipboardCheck, value: `${assessments.length}`,                unit: '回',  label: '評価・記録' },
            { Icon: Star,           value: `${achievedMs.length}/${milestones.length}`, unit: '',  label: 'できたこと' },
          ].map(({ Icon, value, unit, label }) => (
            <div key={label} className="flex flex-col items-center justify-center bg-slate-50
              rounded-xl border border-slate-100 py-3 gap-1">
              <Icon className="w-4 h-4 text-teal-600" />
              <div className="metric text-2xl font-bold text-slate-900">
                {value}<span className="text-xs text-slate-400 ml-0.5">{unit}</span>
              </div>
              <div className="text-[10px] text-slate-500 font-medium">{label}</div>
            </div>
          ))}
        </div>

        {/* できるようになったこと */}
        <div className="report-section mb-6">
          <h2 className="flex items-center gap-1.5 text-xs font-bold text-slate-500 font-display
            uppercase tracking-widest mb-2">
            <Star className="w-3.5 h-3.5 text-amber-500" />できるようになったこと
          </h2>
          {achievedMs.length === 0 ? (
            <p className="text-xs text-slate-400 bg-slate-50 rounded-xl border border-slate-100 px-4 py-3">
              これから一つずつ「できた！」を増やしていきましょう。
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-1.5">
              {achievedMs.map(m => (
                <div key={m.id} className="flex items-center gap-2 bg-teal-50/70 border border-teal-100
                  rounded-lg px-3 py-2">
                  <span className="text-base leading-none">{m.icon ?? '⭐'}</span>
                  <span className="text-xs font-semibold text-teal-900 flex-1">{m.label}</span>
                  {m.date && (
                    <span className="metric text-[10px] text-teal-600">
                      {new Date(m.date).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' })}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* からだの変化 */}
        <div className="report-section mb-6">
          <h2 className="flex items-center gap-1.5 text-xs font-bold text-slate-500 font-display
            uppercase tracking-widest mb-2">
            <TrendingUp className="w-3.5 h-3.5 text-teal-600" />からだの変化（初回 → 最新）
          </h2>
          {changes.length === 0 ? (
            <p className="text-xs text-slate-400 bg-slate-50 rounded-xl border border-slate-100 px-4 py-3">
              評価が2回以上記録されると、からだの変化がここに表示されます。
            </p>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-1.5 mb-3">
                {changes.map(c => (
                  <div key={c.key} className={`rounded-lg border px-3 py-2 ${
                    c.judgment === 'improved' ? 'bg-teal-50/60 border-teal-100' :
                    c.judgment === 'worsened' ? 'bg-amber-50/60 border-amber-100' :
                                                'bg-slate-50 border-slate-100'
                  }`}>
                    <div className="text-[10px] text-slate-500 font-medium mb-0.5">{c.info.shortLabel}</div>
                    <div className="flex items-center gap-1.5">
                      <span className="metric text-sm text-slate-400">{c.first}{c.info.unit}</span>
                      <ChangeArrow change={c} />
                      <span className="metric text-base font-bold text-slate-900">{c.latest}{c.info.unit}</span>
                    </div>
                  </div>
                ))}
              </div>
              {assessments.length >= 2 && (
                <div className="border border-slate-100 rounded-xl p-3">
                  <ProgressChart assessments={assessments} />
                </div>
              )}
            </>
          )}
        </div>

        {/* がんばりポイント + スタンプ */}
        <div className="report-section flex items-center gap-4 bg-gradient-to-r from-amber-50/80 to-white
          border border-amber-100 rounded-2xl px-5 py-4 mb-6">
          <div className="flex-1">
            <h2 className="text-sm font-bold text-amber-900 font-display mb-2">
              今回のがんばりポイント
            </h2>
            <ul className="space-y-1.5">
              {praise.points.map((pt, i) => (
                <li key={i} className="flex items-start gap-2 text-[13px] text-slate-700 leading-snug">
                  <Star className="w-3.5 h-3.5 text-amber-500 flex-shrink-0 mt-0.5" fill="currentColor" />
                  {pt}
                </li>
              ))}
            </ul>
          </div>
          <div className="flex-shrink-0">
            <EffortStamp grade={praise.grade} size={118} />
          </div>
        </div>

        {/* つぎの目標 */}
        <div className="report-section mb-6">
          <h2 className="flex items-center gap-1.5 text-xs font-bold text-slate-500 font-display
            uppercase tracking-widest mb-2">
            <Target className="w-3.5 h-3.5 text-orange-500" />つぎの目標
          </h2>
          <div className="bg-orange-50/50 border border-orange-100 rounded-xl px-4 py-3 space-y-2">
            {nextMilestone && (
              <div className="flex items-center gap-2">
                <span className="text-base leading-none">{nextMilestone.icon ?? '🎯'}</span>
                <span className="text-sm font-bold text-orange-900 font-display">{nextMilestone.label}</span>
              </div>
            )}
            {unmetCriteria.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {unmetCriteria.slice(0, 4).map((c, i) => (
                  <span key={i} className="text-[11px] bg-white border border-orange-200 text-orange-800
                    rounded-full px-2.5 py-1">
                    {c.label}{c.target && `（${c.target}）`}
                  </span>
                ))}
              </div>
            )}
            {!nextMilestone && unmetCriteria.length === 0 && (
              <p className="text-xs text-slate-500">
                現在の目標はすべて達成しています。次のステップはスタッフと相談して決めましょう。
              </p>
            )}
          </div>
        </div>

        {/* スタッフより */}
        <div className="report-section mb-5">
          <h2 className="flex items-center gap-1.5 text-xs font-bold text-slate-500 font-display
            uppercase tracking-widest mb-2">
            <MessageCircleHeart className="w-3.5 h-3.5 text-rose-400" />担当スタッフより
          </h2>
          {/* 画面: 編集可能テキストエリア */}
          <div className="no-print">
            <textarea
              value={comment}
              onChange={e => setComment(e.target.value)}
              onBlur={saveComment}
              rows={3}
              placeholder="患者様へのメッセージを入力（印刷に反映されます。空欄の場合は手書き用の罫線が印刷されます）"
              className="w-full text-sm border border-slate-200 rounded-xl px-4 py-3 leading-relaxed
                focus:outline-none focus:ring-2 focus:ring-teal-500/40 focus:border-teal-400
                placeholder:text-slate-300"
            />
            <div className="text-right text-[10px] text-teal-600 h-4">
              {savedFlash && '✓ 保存しました'}
            </div>
          </div>
          {/* 印刷: メッセージ or 手書き用罫線 */}
          <div className="hidden print:block border border-slate-200 rounded-xl px-4 py-3 min-h-[72px]">
            {comment.trim() ? (
              <p className="text-[13px] leading-relaxed whitespace-pre-wrap">{comment}</p>
            ) : (
              <div className="space-y-6 pt-4">
                <div className="border-b border-slate-200" />
                <div className="border-b border-slate-200" />
              </div>
            )}
          </div>
        </div>

        {/* フッター */}
        <div className="report-section border-t border-slate-100 pt-3 flex items-end justify-between gap-4">
          <div className="text-[9px] text-slate-400 leading-relaxed">
            本レポートは経過の共有を目的としたものであり、医療行為・診断を代替しません。
            体調に変化があるときは無理をせず、スタッフ・医師にご相談ください。
          </div>
          <div className="text-right flex-shrink-0">
            <div className="text-[11px] font-bold text-slate-600 font-display">ゆうき整骨院</div>
            <div className="metric text-[10px] text-slate-400">TEL 083-265-4545</div>
          </div>
        </div>
      </div>

      {/* 画面下の補足 */}
      <p className="no-print text-center text-[11px] text-slate-400 mt-4 mb-8">
        スタッフからのメッセージは自動保存され、次回のレポートにも引き継がれます。
      </p>
    </div>
  )
}
