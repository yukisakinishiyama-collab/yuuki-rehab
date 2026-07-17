'use client'

// リハビリがんばりレポート
// 患者に手渡しできるA4印刷用の評価レポート。回復の可視化とほめ言葉で
// 「リハビリを続けたくなる」ことを目的とした患者向けデザイン。
// 雑誌の誌面のようなエディトリアル調のレイアウトで、印刷時も配色を保持する。

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
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
  JourneyIllustration, ProgressRing, EffortStamp,
} from '@/components/protocol/RehabIllustrations'
import ProgressChart from '@/components/protocol/ProgressChart'
import {
  ArrowLeft, Printer, TrendingUp, TrendingDown, Minus, Star,
  Target, CalendarDays, ClipboardCheck, MessageCircleHeart,
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

// エディトリアル調の番号付きセクション見出し
function SectionHeader({ no, title, accent = '#0d9488' }: { no: string; title: string; accent?: string }) {
  return (
    <div className="flex items-baseline gap-2.5 mb-3">
      <span className="metric text-xl font-bold leading-none" style={{ color: accent }}>{no}</span>
      <h2 className="text-[15px] font-bold text-slate-800 font-display tracking-wide">{title}</h2>
      <div className="flex-1 border-t border-slate-200 translate-y-[-3px]" />
    </div>
  )
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
      {/* 印刷用スタイル: アプリのサイドバー等を隠し、A4で配色ごと綺麗に出力する */}
      <style>{`
        @media print {
          @page { size: A4; margin: 9mm 10mm; }
          aside, header { display: none !important; }
          [class*="ml-56"] { margin-left: 0 !important; }
          main { padding: 0 !important; }
          body { background: white !important; }
          .report-section { break-inside: avoid; }
          #ganbari-report {
            border: none !important; box-shadow: none !important;
            border-radius: 0 !important; padding: 0 !important;
          }
          #ganbari-report, #ganbari-report * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
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
      <div id="ganbari-report" className="bg-white rounded-3xl border border-slate-200 shadow-sm
        overflow-hidden text-slate-800">

        {/* カバーバンド（グラデーションはTailwindクラスを使わずinline指定
            — globals.cssの印刷時グラデーション無効化ルールを回避するため） */}
        <div className="report-section relative overflow-hidden px-7 pt-7 pb-6"
          style={{ background: 'linear-gradient(135deg, #115e59 0%, #0d9488 55%, #14b8a6 100%)' }}>
          {/* 装飾サークル */}
          <div className="absolute -right-10 -top-14 w-44 h-44 rounded-full"
            style={{ background: 'rgba(255,255,255,0.07)' }} />
          <div className="absolute right-24 -bottom-16 w-36 h-36 rounded-full"
            style={{ background: 'rgba(255,255,255,0.05)' }} />
          <svg className="absolute left-5 bottom-4 opacity-40" width="70" height="26" viewBox="0 0 70 26">
            {[0, 1, 2, 3, 4].map(i => (
              <circle key={i} cx={6 + i * 14} cy={13} r="2.2" fill="white" opacity={0.28 + i * 0.14} />
            ))}
          </svg>

          <div className="relative flex items-center justify-between gap-5">
            <div className="min-w-0">
              <div className="text-[10px] font-bold tracking-[0.3em] font-display mb-2"
                style={{ color: 'rgba(255,255,255,0.65)' }}>
                YUUKI SEIKOTSUIN — REHAB REPORT
              </div>
              <h1 className="text-[26px] font-bold text-white font-display leading-tight mb-3">
                リハビリがんばりレポート
              </h1>
              <div className="flex items-center gap-2.5 flex-wrap">
                <span className="text-base font-bold text-white font-display bg-white/15
                  rounded-full px-4 py-1.5 backdrop-blur-sm">
                  {patient.name ?? '匿名患者'} 様
                </span>
                {patient.diagnosis && (
                  <span className="text-[11px] font-medium rounded-full px-3 py-1.5"
                    style={{ background: 'rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.85)' }}>
                    {patient.diagnosis}
                  </span>
                )}
              </div>
              <div className="text-[10px] mt-3 tracking-wider" style={{ color: 'rgba(255,255,255,0.55)' }}>
                発行日 {today}
              </div>
            </div>

            {/* Canva生成イラストを白カードに載せて少し傾ける */}
            <div className="flex-shrink-0 bg-white rounded-2xl p-2 shadow-lg rotate-2">
              <Image
                src="/illustrations/rehab-cheer.png"
                alt="スタッフが患者のリハビリを応援するイラスト"
                width={1200}
                height={851}
                priority
                className="h-[104px] w-auto rounded-xl"
              />
            </div>
          </div>
        </div>

        <div className="px-7 py-6">

          {/* 01 回復の旅 */}
          <div className="report-section mb-6">
            <SectionHeader no="01" title="回復の旅 — いまここまで来ました" />
            <div className="rounded-2xl border border-teal-100 px-3 pt-3 pb-1"
              style={{ background: 'linear-gradient(180deg, #f0f9ff 0%, #ffffff 80%)' }}>
              <JourneyIllustration
                phaseCount={protocol.phases.length}
                currentPhaseIndex={protocol.currentPhaseIndex}
                criteriaPct={criteriaPct}
              />
            </div>
            <div className="flex flex-wrap gap-1.5 mt-2.5">
              {protocol.phases.map((ph, i) => {
                const done = i < protocol.currentPhaseIndex
                const active = i === protocol.currentPhaseIndex
                return (
                  <span key={ph.id} className={`text-[10px] px-2.5 py-1 rounded-full border font-semibold ${
                    done   ? 'bg-teal-600 border-teal-600 text-white' :
                    active ? 'bg-teal-50 border-teal-400 text-teal-700' :
                             'bg-white border-slate-200 text-slate-400'
                  }`}>
                    {i + 1}. {ph.title}{active && ' ◀ いまここ'}
                  </span>
                )
              })}
            </div>
          </div>

          {/* 02 数字で見る回復 */}
          <div className="report-section mb-6">
            <SectionHeader no="02" title="数字で見るがんばり" />
            <div className="grid grid-cols-4 gap-2.5">
              <div className="flex flex-col items-center justify-center rounded-2xl border border-teal-100
                bg-teal-50/50 py-3">
                <ProgressRing pct={progressPct} size={100} label="プログラム" />
              </div>
              {[
                { Icon: CalendarDays,   value: `${days}`,                unit: '日', label: 'リハビリ継続', tint: '#0ea5e9', bg: '#f0f9ff', border: '#e0f2fe' },
                { Icon: ClipboardCheck, value: `${assessments.length}`,  unit: '回', label: '評価・記録',   tint: '#0d9488', bg: '#f0fdfa', border: '#ccfbf1' },
                { Icon: Star,           value: `${achievedMs.length}`,   unit: `/${milestones.length}`, label: 'できたこと', tint: '#f59e0b', bg: '#fffbeb', border: '#fef3c7' },
              ].map(({ Icon, value, unit, label, tint, bg, border }) => (
                <div key={label} className="flex flex-col items-center justify-center rounded-2xl py-3 gap-1.5"
                  style={{ background: bg, border: `1px solid ${border}` }}>
                  <div className="w-8 h-8 rounded-full flex items-center justify-center"
                    style={{ background: 'white', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
                    <Icon className="w-4 h-4" style={{ color: tint }} />
                  </div>
                  <div className="metric text-[22px] font-bold text-slate-900 leading-none">
                    {value}<span className="text-[11px] text-slate-400 ml-0.5">{unit}</span>
                  </div>
                  <div className="text-[10px] text-slate-500 font-semibold">{label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* 03 できるようになったこと（スタンプラリー風: 全マイルストーンを表示） */}
          <div className="report-section mb-6">
            <SectionHeader no="03" title="できるようになったこと — スタンプラリー" accent="#f59e0b" />
            {milestones.length === 0 ? (
              <p className="text-xs text-slate-400 bg-slate-50 rounded-2xl border border-slate-100 px-4 py-3">
                これから一つずつ「できた！」を増やしていきましょう。
              </p>
            ) : (
              <>
                <div className="grid grid-cols-4 gap-2.5 mt-3">
                  {milestones.map((m, idx) => {
                    const isNext = !m.achieved && milestones.findIndex(x => !x.achieved) === idx
                    return (
                      <div key={m.id}
                        className="relative flex flex-col items-center rounded-2xl px-1.5 pt-4 pb-2.5 text-center"
                        style={m.achieved
                          ? { background: '#fef3c7', border: '2px solid #f59e0b' }
                          : isNext
                            ? { background: '#fff7ed', border: '2px dashed #fb923c' }
                            : { background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                        {/* 達成チェックバッジ */}
                        {m.achieved && (
                          <span className="absolute -top-2 -right-1.5 w-5 h-5 rounded-full flex items-center
                            justify-center shadow-sm" style={{ background: '#f59e0b' }}>
                            <svg width="10" height="10" viewBox="0 0 10 10">
                              <path d="M1.5,5 L4,7.5 L8.5,2.5" fill="none" stroke="white"
                                strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          </span>
                        )}
                        {/* つぎの目標バッジ */}
                        {isNext && (
                          <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 text-[8px] font-bold
                            text-white px-2 py-0.5 rounded-full whitespace-nowrap shadow-sm"
                            style={{ background: '#fb923c' }}>
                            つぎはこれ！
                          </span>
                        )}
                        {/* スタンプ円 */}
                        <span className="w-11 h-11 rounded-full flex items-center justify-center text-[20px] mb-1.5"
                          style={m.achieved
                            ? { background: 'linear-gradient(135deg, #fbbf24, #f59e0b)', boxShadow: '0 2px 6px rgba(245,158,11,0.4)' }
                            : { background: 'white', border: '2px dashed #cbd5e1' }}>
                          <span style={m.achieved ? undefined : { filter: 'grayscale(1)', opacity: 0.35 }}>
                            {m.icon ?? '⭐'}
                          </span>
                        </span>
                        <span className={`text-[10px] font-bold leading-tight ${
                          m.achieved ? 'text-amber-900' : isNext ? 'text-orange-800' : 'text-slate-400'
                        }`}>
                          {m.label}
                        </span>
                        <span className="metric text-[9px] font-semibold mt-0.5"
                          style={{ color: m.achieved && m.date ? '#d97706' : 'transparent' }}>
                          {m.achieved && m.date
                            ? `${new Date(m.date).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' })} 達成`
                            : '·'}
                        </span>
                      </div>
                    )
                  })}
                </div>
                <p className="text-[11px] font-bold text-amber-700 mt-2.5 text-center">
                  {milestones.length}個のうち {achievedMs.length}個 達成！
                  {achievedMs.length > 0 && ' この調子で進んでいきましょう'}
                </p>
              </>
            )}
          </div>

          {/* 04 からだの変化 */}
          <div className="report-section mb-6">
            <SectionHeader no="04" title="からだの変化（初回 → 最新）" />
            {changes.length === 0 ? (
              <p className="text-xs text-slate-400 bg-slate-50 rounded-2xl border border-slate-100 px-4 py-3">
                評価が2回以上記録されると、からだの変化がここに表示されます。
              </p>
            ) : (
              <>
                <div className="grid grid-cols-3 gap-2 mb-3">
                  {changes.map(c => (
                    <div key={c.key} className="relative rounded-xl px-3.5 py-2.5 overflow-hidden"
                      style={c.judgment === 'improved'
                        ? { background: '#f0fdfa', border: '1px solid #99f6e4' }
                        : c.judgment === 'worsened'
                          ? { background: '#fffbeb', border: '1px solid #fde68a' }
                          : { background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                      {c.judgment === 'improved' && (
                        <span className="absolute top-0 right-0 text-[8px] font-bold text-white px-2 py-0.5
                          rounded-bl-lg tracking-wider" style={{ background: '#0d9488' }}>
                          改善
                        </span>
                      )}
                      <div className="text-[10px] text-slate-500 font-semibold mb-1">{c.info.shortLabel}</div>
                      <div className="flex items-baseline gap-1.5">
                        <span className="metric text-xs text-slate-400 line-through decoration-slate-300">
                          {c.first}{c.info.unit}
                        </span>
                        <ChangeArrow change={c} />
                        <span className="metric text-lg font-bold text-slate-900">
                          {c.latest}<span className="text-[10px] font-semibold text-slate-500">{c.info.unit}</span>
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
                {assessments.length >= 2 && (
                  <div className="rounded-2xl border border-slate-100 p-3">
                    <ProgressChart assessments={assessments} />
                  </div>
                )}
              </>
            )}
          </div>

          {/* 05 がんばりポイント + スタンプ */}
          <div className="report-section relative overflow-hidden rounded-2xl px-6 py-5 mb-6"
            style={{ background: 'linear-gradient(120deg, #fffbeb 0%, #fff7ed 60%, #ffffff 100%)', border: '1px solid #fde68a' }}>
            {/* 引用符風の装飾 */}
            <span className="absolute -top-3 left-4 text-[64px] leading-none font-serif select-none"
              style={{ color: 'rgba(245,158,11,0.18)' }}>“</span>
            <div className="relative flex items-center gap-5">
              <div className="flex-1">
                <h2 className="text-[15px] font-bold text-amber-900 font-display tracking-wide mb-2.5">
                  今回のがんばりポイント
                </h2>
                <ul className="space-y-2">
                  {praise.points.map((pt, i) => (
                    <li key={i} className="flex items-start gap-2 text-[13px] text-slate-700 leading-snug">
                      <Star className="w-3.5 h-3.5 text-amber-500 flex-shrink-0 mt-0.5" fill="currentColor" />
                      {pt}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="flex-shrink-0">
                <EffortStamp grade={praise.grade} size={116} />
              </div>
            </div>
          </div>

          {/* 05 つぎの目標（チケット風） */}
          <div className="report-section mb-6">
            <SectionHeader no="05" title="つぎの目標" accent="#f97316" />
            <div className="rounded-2xl px-5 py-4 space-y-2.5"
              style={{ background: '#fff7ed', border: '2px dashed #fdba74' }}>
              {nextMilestone && (
                <div className="flex items-center gap-3">
                  <span className="w-9 h-9 rounded-full bg-white shadow-sm flex items-center justify-center
                    text-lg flex-shrink-0">
                    {nextMilestone.icon ?? '🎯'}
                  </span>
                  <div>
                    <div className="text-[9px] font-bold text-orange-400 tracking-[0.2em] font-display">NEXT GOAL</div>
                    <div className="text-[15px] font-bold text-orange-900 font-display">{nextMilestone.label}</div>
                  </div>
                </div>
              )}
              {unmetCriteria.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pl-12">
                  {unmetCriteria.slice(0, 4).map((c, i) => (
                    <span key={i} className="text-[11px] bg-white text-orange-800 rounded-full px-3 py-1
                      font-medium" style={{ border: '1px solid #fed7aa' }}>
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

          {/* 06 スタッフより（吹き出し風） */}
          <div className="report-section mb-5">
            <SectionHeader no="06" title="担当スタッフより" accent="#fb7185" />
            {/* 画面: 編集可能テキストエリア */}
            <div className="no-print">
              <textarea
                value={comment}
                onChange={e => setComment(e.target.value)}
                onBlur={saveComment}
                rows={3}
                placeholder="患者様へのメッセージを入力（印刷に反映されます。空欄の場合は手書き用の罫線が印刷されます）"
                className="w-full text-sm border border-slate-200 rounded-2xl px-4 py-3 leading-relaxed
                  focus:outline-none focus:ring-2 focus:ring-teal-500/40 focus:border-teal-400
                  placeholder:text-slate-300"
              />
              <div className="text-right text-[10px] text-teal-600 h-4">
                {savedFlash && '✓ 保存しました'}
              </div>
            </div>
            {/* 印刷: メッセージ吹き出し or 手書き用罫線 */}
            <div className="hidden print:block relative">
              <div className="rounded-2xl px-5 py-4 min-h-[76px]"
                style={{ background: '#fff1f2', border: '1px solid #fecdd3' }}>
                {comment.trim() ? (
                  <p className="text-[13px] leading-relaxed whitespace-pre-wrap text-slate-700">{comment}</p>
                ) : (
                  <div className="space-y-6 pt-4">
                    <div style={{ borderBottom: '1px solid #fecdd3' }} />
                    <div style={{ borderBottom: '1px solid #fecdd3' }} />
                  </div>
                )}
              </div>
              <MessageCircleHeart className="absolute -top-2.5 right-5 w-5 h-5 text-rose-300 bg-white rounded-full" />
            </div>
          </div>

          {/* フッター */}
          <div className="report-section pt-4 flex items-end justify-between gap-4"
            style={{ borderTop: '2px solid #0d9488' }}>
            <div className="text-[9px] text-slate-400 leading-relaxed max-w-[380px]">
              本レポートは経過の共有を目的としたものであり、医療行為・診断を代替しません。
              体調に変化があるときは無理をせず、スタッフ・医師にご相談ください。
            </div>
            <div className="text-right flex-shrink-0">
              <div className="flex items-center justify-end gap-1.5">
                <span className="w-5 h-5 rounded-md flex items-center justify-center text-[10px]
                  font-bold text-white font-display" style={{ background: '#0d9488' }}>ゆ</span>
                <span className="text-[12px] font-bold text-slate-700 font-display tracking-wide">ゆうき整骨院</span>
              </div>
              <div className="metric text-[10px] text-slate-400 mt-0.5">TEL 083-265-4545</div>
            </div>
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
