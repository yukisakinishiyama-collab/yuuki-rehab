'use client'
// ──────────────────────────────────────────────
// カルテ（患者さん1人分）
// タブ: SOAPカルテ（最初に開く）・概要・評価・測定・問診票・簡易メモ・キャンセル
// ──────────────────────────────────────────────
import { useState, useEffect } from 'react'
import Link from 'next/link'
import type {
  Patient, Evaluation, ROMRecord, StrengthRecord,
  SpecialTestRecord, SOAPNote, ProgressRecord,
  SpecialTestResult, QuickMemo, Intake, CancellationRecord,
} from '@/types/patient'
import { BODY_REGION_LABELS } from '@/types/patient'
const SIDE_LABELS_SHORT: Record<string, string> = { right: '右', left: '左', bilateral: '両側', na: '' }
const NRS_COLOR = (n: number) => n >= 7 ? 'text-red-600' : n >= 4 ? 'text-yellow-700' : 'text-green-700'
import BodyMap from './BodyMap'
import {
  getEvaluations, getROMRecords, getStrengthRecords, getSpecialTests,
  getSOAPNotes, getProgressRecords,
  getQuickMemos, saveQuickMemo, deleteQuickMemo, getIntakes, getCancellations,
} from '@/lib/patient-store'
import { summarizeCancellations } from '@/lib/cancellation-utils'
import {
  calculateImprovementScore, calculateROMImprovement,
  calculateRetentionRisk, getDaysSinceLastVisit, generatePatientFriendlyMessage,
} from '@/lib/rehab-algorithms'
import { ProgressGauge, PhaseStepper, RetentionRiskBadge, Badge, Card, CardHeader, CardContent, SectionTitle } from './shared'
import { PainChart, ImprovementChart, ROMChart, StrengthChart, SpecialTestSummary, AdherenceChart } from './charts'
import EvaluationForm from './EvaluationForm'
import ROMInputForm from './ROMInputForm'
import StrengthInputForm from './StrengthInputForm'
import SpecialTestInputForm from './SpecialTestInputForm'
import SOAPForm from './SOAPForm'
import IntakeForm from './IntakeForm'
import CancellationTab from './CancellationTab'
import VoiceInputButton from '@/components/rehab/VoiceInputButton'
import GoalsProblemsCard from './GoalsProblemsCard'
import PatientProfileCard from './PatientProfileCard'
import { isFeatureEnabled } from '@/lib/feature-flags'
import ReferralLetterModal from './ReferralLetterModal'
import { nanoid } from 'nanoid'
import { getAssessments as getReturnAssessments } from '@/lib/return-criteria-store'
import type { ReturnCriteriaAssessment } from '@/types/return-criteria'

// ── 月次カルテ印刷 ────────────────────────────────────────────
function printMonthlyChart(
  patient: Patient,
  memos: QuickMemo[],
  tests: SpecialTestRecord[],
  yearMonth: string,
) {
  const [year, month] = yearMonth.split('-')
  const title = `リハビリ経過メモ — ${patient.name} — ${year}年${month}月`
  const printDate = new Date().toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' })

  const resultLabel = (r: string) =>
    r === 'positive' ? '陽性' : r === 'suspicious' ? '疑陽性' : r === 'negative' ? '陰性' : '不可'
  const resultColor = (r: string) =>
    r === 'positive' ? 'color:#b91c1c' : r === 'suspicious' ? 'color:#92400e' : r === 'negative' ? 'color:#166534' : 'color:#6b7280'

  // メモとテストを日付順に統合
  type Entry = { date: string; kind: 'memo'; memo: QuickMemo } | { date: string; kind: 'test'; test: SpecialTestRecord }
  const entries: Entry[] = [
    ...memos.map(m => ({ date: m.memoDate, kind: 'memo' as const, memo: m })),
    ...tests.map(t => ({ date: t.measuredDate, kind: 'test' as const, test: t })),
  ].sort((a, b) => a.date.localeCompare(b.date))

  const rows = entries.map(e => {
    const d = new Date(e.date)
    const label = d.toLocaleDateString('ja-JP', { month: 'long', day: 'numeric', weekday: 'short' })
    if (e.kind === 'memo') {
      const escaped = e.memo.content.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\n/g,'<br>')
      return `<tr><td class="date">${label}</td><td class="kind memo">📝 メモ</td><td class="content">${escaped}</td></tr>`
    } else {
      const t = e.test
      const right = `右:<span style="${resultColor(t.rightResult)}">${resultLabel(t.rightResult)}</span>`
      const left = `左:<span style="${resultColor(t.leftResult)}">${resultLabel(t.leftResult)}</span>`
      const total = `総合:<span style="${resultColor(t.result)};font-weight:bold">${resultLabel(t.result)}</span>`
      const flags = [t.apprehension && '不安感', t.clickSound && 'クリック音', t.limitation && '可動域制限'].filter(Boolean).join('・')
      const memo = t.memo ? `<br><span style="color:#6b7280;font-size:9pt">${t.memo.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</span>` : ''
      return `<tr><td class="date">${label}</td><td class="kind test">🔍 テスト</td><td class="content">${t.testName}（${BODY_REGION_LABELS[t.bodyRegion]}）<br>${right} &nbsp; ${left} &nbsp; ${total}${flags ? `<br><span style="color:#92400e;font-size:9pt">${flags}</span>` : ''}${memo}</td></tr>`
    }
  }).join('')

  const html = `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<title>${title}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: "Hiragino Sans", "Noto Sans JP", "Yu Gothic", sans-serif;
    font-size: 11pt; color: #1a1a2e; padding: 20mm 18mm; }
  header { border-bottom: 2px solid #0d9488; padding-bottom: 10px; margin-bottom: 16px; }
  h1 { font-size: 15pt; font-weight: bold; color: #0d9488; }
  .meta { display: flex; gap: 24px; margin-top: 8px; font-size: 9.5pt; color: #555; flex-wrap: wrap; }
  .meta span { display: flex; gap: 4px; }
  .meta strong { color: #1a1a2e; }
  table { width: 100%; border-collapse: collapse; margin-top: 8px; }
  th { background: #f0fdfa; color: #0d9488; font-size: 9pt; font-weight: bold;
    text-align: left; padding: 6px 10px; border: 1px solid #ccece9; }
  td { vertical-align: top; padding: 8px 10px; border: 1px solid #e5e7eb; font-size: 10.5pt; }
  td.date { white-space: nowrap; width: 110px; color: #374151; font-weight: 600; background: #f9fafb; }
  td.kind { white-space: nowrap; width: 72px; font-size: 9pt; color: #6b7280; background: #fafafa; }
  td.kind.test { color: #7c3aed; }
  td.content { line-height: 1.7; color: #1f2937; }
  footer { margin-top: 20px; padding-top: 10px; border-top: 1px solid #e5e7eb;
    font-size: 8.5pt; color: #9ca3af; display: flex; justify-content: space-between; }
  @media print { body { padding: 15mm 14mm; } @page { margin: 0; size: A4; } }
</style>
</head>
<body>
<header>
  <h1>🗒️ リハビリ経過カルテ</h1>
  <div class="meta">
    <span><strong>患者名：</strong>${patient.name}</span>
    <span><strong>対象月：</strong>${year}年${parseInt(month)}月</span>
    ${patient.diagnosisLabel ? `<span><strong>診断：</strong>${patient.diagnosisLabel}</span>` : ''}
    <span><strong>メモ：</strong>${memos.length}件</span>
    <span><strong>テスト：</strong>${tests.length}件</span>
  </div>
</header>
<table>
  <thead><tr><th style="width:110px">日付</th><th style="width:72px">種別</th><th>内容</th></tr></thead>
  <tbody>${rows}</tbody>
</table>
<footer>
  <span>印刷日：${printDate}</span>
  <span>ゆうき整骨院 — リハビリ管理システム</span>
</footer>
<script>window.onload = () => { window.print(); }<\/script>
</body>
</html>`

  const w = window.open('', '_blank', 'width=900,height=700')
  if (w) { w.document.write(html); w.document.close() }
}

// ── 簡易メモタブ ────────────────────────────────────────────
const ST_RESULT_LABEL: Record<string, string> = {
  positive: '陽性', negative: '陰性', suspicious: '疑陽性', unable: '不可',
}
const ST_RESULT_COLOR: Record<string, string> = {
  positive: 'bg-red-100 text-red-700',
  negative: 'bg-green-100 text-green-700',
  suspicious: 'bg-yellow-100 text-yellow-700',
  unable: 'bg-gray-100 text-gray-500',
}

function QuickMemoTab({ patient, memos, specialTests, onUpdate }: {
  patient: Patient
  memos: QuickMemo[]
  specialTests: SpecialTestRecord[]
  onUpdate: () => void
}) {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [content, setContent] = useState('')
  const [saved, setSaved] = useState(false)
  const [collapsedMonths, setCollapsedMonths] = useState<Set<string>>(new Set())
  // 音声入力の認識途中テキスト（確定前のプレビュー表示用）
  const [voiceInterim, setVoiceInterim] = useState('')

  // メモとテストを月別に統合
  type Entry =
    | { kind: 'memo'; date: string; data: QuickMemo }
    | { kind: 'test'; date: string; data: SpecialTestRecord }

  const byMonth: Record<string, Entry[]> = {}
  for (const m of memos) {
    const ym = m.memoDate.slice(0, 7)
    if (!byMonth[ym]) byMonth[ym] = []
    byMonth[ym].push({ kind: 'memo', date: m.memoDate, data: m })
  }
  for (const t of specialTests) {
    const ym = t.measuredDate.slice(0, 7)
    if (!byMonth[ym]) byMonth[ym] = []
    byMonth[ym].push({ kind: 'test', date: t.measuredDate, data: t })
  }
  const months = Object.keys(byMonth).sort((a, b) => b.localeCompare(a))
  const totalEntries = memos.length + specialTests.length

  function toggleMonth(ym: string) {
    setCollapsedMonths(prev => {
      const next = new Set(prev)
      next.has(ym) ? next.delete(ym) : next.add(ym)
      return next
    })
  }

  function handleSave() {
    if (!content.trim()) return
    saveQuickMemo({
      id: nanoid(),
      patientId: patient.id,
      memoDate: date,
      content: content.trim(),
      createdAt: new Date().toISOString(),
    })
    setContent('')
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
    onUpdate()
  }

  function handleDelete(id: string) {
    deleteQuickMemo(id)
    onUpdate()
  }

  function formatMonthLabel(ym: string) {
    const [y, m] = ym.split('-')
    return `${y}年${parseInt(m)}月`
  }

  return (
    <div className="space-y-4">
      {/* 入力エリア */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-semibold text-gray-700">🗒️ メモを追加</span>
          <VoiceInputButton
            onText={text => setContent(prev => (prev ? `${prev}${prev.endsWith('\n') ? '' : '\n'}${text}` : text))}
            onInterim={setVoiceInterim}
          />
        </div>
        <div className="flex items-center gap-3">
          <label className="text-xs text-gray-500 whitespace-nowrap">日付</label>
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-teal-400"
          />
        </div>
        <textarea
          value={content}
          onChange={e => setContent(e.target.value)}
          placeholder="例：患者さんから「昨日は痛みが少なかった」と報告あり。膝の腫脹やや改善。次回ROM再計測予定。"
          rows={4}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-teal-400 resize-none"
          onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleSave() }}
        />
        {voiceInterim && (
          <p className="text-xs text-gray-500 italic px-1">🎤 {voiceInterim}…</p>
        )}
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-500">Ctrl+Enter で保存</span>
          <div className="flex items-center gap-3">
            {saved && <span className="text-teal-700 text-sm">✓ 保存しました</span>}
            <button
              type="button"
              onClick={handleSave}
              disabled={!content.trim()}
              className="px-4 py-1.5 bg-teal-700 text-white text-sm font-medium rounded-lg hover:bg-teal-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              保存
            </button>
          </div>
        </div>
      </div>

      {/* 月別タイムライン */}
      {totalEntries === 0 ? (
        <p className="text-center text-sm text-gray-500 py-8">まだ記録がありません</p>
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-gray-500 px-1">
            メモ {memos.length}件 · テスト {specialTests.length}件 · {months.length}ヶ月分
          </p>

          {months.map(ym => {
            const entries = byMonth[ym].sort((a, b) => b.date.localeCompare(a.date))
            const monthMemos = entries.filter(e => e.kind === 'memo').map(e => e.data as QuickMemo)
            const monthTests = entries.filter(e => e.kind === 'test').map(e => e.data as SpecialTestRecord)
            const collapsed = collapsedMonths.has(ym)

            return (
              <div key={ym} className="border border-gray-200 rounded-xl overflow-hidden bg-white shadow-sm">
                {/* 月ヘッダー */}
                <div className="flex items-center gap-2 px-4 py-2.5 bg-gray-50 border-b border-gray-100">
                  <button
                    type="button"
                    onClick={() => toggleMonth(ym)}
                    className="flex items-center gap-2 flex-1 text-left"
                  >
                    <span className="text-sm font-bold text-teal-700">{formatMonthLabel(ym)}</span>
                    {monthMemos.length > 0 && (
                      <span className="text-xs text-gray-500 bg-gray-100 rounded-full px-2 py-0.5">
                        📝 {monthMemos.length}
                      </span>
                    )}
                    {monthTests.length > 0 && (
                      <span className="text-xs text-purple-600 bg-purple-50 rounded-full px-2 py-0.5">
                        🔍 {monthTests.length}
                      </span>
                    )}
                    <span className="text-gray-500 text-xs ml-1">{collapsed ? '▶' : '▼'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => printMonthlyChart(patient, monthMemos, monthTests, ym)}
                    className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-teal-600
                      border border-gray-200 hover:border-teal-300 rounded-lg px-2.5 py-1
                      transition-colors bg-white"
                    title="この月をカルテとして印刷"
                  >
                    🖨️ カルテ印刷
                  </button>
                </div>

                {/* エントリ一覧（折りたたみ） */}
                {!collapsed && (
                  <div className="divide-y divide-gray-50">
                    {entries.map(entry => {
                      const d = new Date(entry.date)
                      const dayLabel = d.toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric', weekday: 'short' })

                      if (entry.kind === 'memo') {
                        const memo = entry.data as QuickMemo
                        return (
                          <div key={memo.id} className="flex gap-3 px-4 py-3 group hover:bg-gray-50 transition-colors">
                            <div className="flex-shrink-0 w-16">
                              <p className="text-xs font-semibold text-teal-700">{dayLabel}</p>
                              <p className="text-xs text-gray-500 mt-0.5">📝 メモ</p>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">{memo.content}</p>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleDelete(memo.id)}
                              className="flex-shrink-0 text-gray-500 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100 text-lg leading-none mt-0.5"
                              title="削除"
                            >×</button>
                          </div>
                        )
                      } else {
                        const t = entry.data as SpecialTestRecord
                        return (
                          <div key={t.id} className="flex gap-3 px-4 py-3 bg-purple-50/30">
                            <div className="flex-shrink-0 w-16">
                              <p className="text-xs font-semibold text-purple-600">{dayLabel}</p>
                              <p className="text-xs text-purple-600 mt-0.5">🔍 テスト</p>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-800">
                                {t.testName}
                                <span className="ml-1.5 text-xs text-gray-500 font-normal">{BODY_REGION_LABELS[t.bodyRegion]}</span>
                              </p>
                              <div className="flex flex-wrap gap-1 mt-1">
                                {(['rightResult', 'leftResult', 'result'] as const).map((key, i) => (
                                  <span key={key} className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${ST_RESULT_COLOR[t[key]]}`}>
                                    {['右', '左', '総合'][i]}:{ST_RESULT_LABEL[t[key]]}
                                  </span>
                                ))}
                              </div>
                              {(t.faberDistanceRight != null || t.faberDistanceLeft != null) && (
                                <p className="text-xs text-blue-600 mt-1">
                                  床→脛骨粗面: 右 {t.faberDistanceRight ?? '-'}cm / 左 {t.faberDistanceLeft ?? '-'}cm
                                </p>
                              )}
                              {(t.apprehension || t.clickSound || t.limitation) && (
                                <p className="text-xs text-orange-700 mt-1">
                                  {[t.apprehension && '不安感', t.clickSound && 'クリック音', t.limitation && '可動域制限'].filter(Boolean).join(' · ')}
                                </p>
                              )}
                              {t.memo && <p className="text-xs text-gray-500 mt-1">{t.memo}</p>}
                            </div>
                          </div>
                        )
                      }
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

const SOAP_RESULT_COLORS: Record<SpecialTestResult, string> = {
  positive: 'bg-red-100 text-red-700 border-red-200',
  negative: 'bg-green-100 text-green-700 border-green-200',
  suspicious: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  unable: 'bg-gray-100 text-gray-500 border-gray-200',
}
const SOAP_RESULT_SYMBOL: Record<SpecialTestResult, string> = {
  positive: '+', negative: '−', suspicious: '±', unable: '?',
}

// ── SOAPカルテ展開カード ────────────────────────────────────
function SOAPNoteCard({ note, onReferral }: { note: SOAPNote; onReferral?: () => void }) {
  const [open, setOpen] = useState(false)
  const nrsColor = note.painToday >= 7 ? 'text-red-600' : note.painToday >= 4 ? 'text-yellow-700' : 'text-green-700'
  const adherenceLabel = note.homeExerciseAdherence === 'done' ? '✅ 実施' : note.homeExerciseAdherence === 'partial' ? '⚠️ 一部' : '❌ 未実施'

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden bg-white shadow-sm">
      {/* ヘッダー行（展開ボタン＋アクションボタン） */}
      <div className="flex items-center gap-2 pr-3 hover:bg-gray-50 transition-colors">
        <button
          type="button"
          onClick={() => setOpen(o => !o)}
          className="flex-1 flex items-center gap-3 px-4 py-3 text-left min-w-0"
        >
          <span className="w-7 h-7 rounded-full bg-teal-50 border border-teal-200 text-teal-700 text-xs font-bold flex items-center justify-center flex-shrink-0">
            {note.visitNumber}
          </span>
          <span className="text-sm font-medium text-gray-700 w-24 flex-shrink-0">{note.visitDate}</span>
          <span className={`text-sm font-bold ${nrsColor} w-14 flex-shrink-0`}>NRS {note.painToday}</span>
          <span className="text-xs bg-teal-50 border border-teal-200 text-teal-700 rounded-full px-2 py-0.5 flex-shrink-0">
            Phase {note.currentPhase}
          </span>
          <span className="text-xs text-gray-500 flex-shrink-0 hidden sm:block">{adherenceLabel}</span>
          {note.improvements && (
            <span className="text-xs text-gray-500 truncate flex-1 hidden md:block">
              ✓ {note.improvements}
            </span>
          )}
          <span className={`text-gray-500 text-xs transition-transform duration-200 flex-shrink-0 ${open ? 'rotate-180' : ''}`}>
            ▼
          </span>
        </button>

        {/* 常時表示のアクションボタン */}
        {onReferral && (
          <button
            type="button"
            onClick={onReferral}
            title="この経過から紹介状・報告書を作成"
            className="flex-shrink-0 px-2.5 py-1.5 bg-white border border-gray-200 text-gray-600 text-xs font-medium rounded-lg hover:border-teal-400 hover:text-teal-700 transition-colors shadow-sm whitespace-nowrap"
          >
            📄 紹介状
          </button>
        )}
      </div>

      {/* 展開コンテンツ */}
      {open && (
        <div className="border-t border-gray-100 px-4 py-4 space-y-4 bg-gray-50/50">

          {/* S: 主観的情報 */}
          <section>
            <div className="flex items-center gap-1.5 mb-2">
              <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center">S</span>
              <span className="text-xs font-semibold text-blue-700">主観的情報（患者の訴え）</span>
            </div>

            {/* 複数部位・疾患ごとのNRS */}
            {note.complaints && note.complaints.length > 0 && (
              <div className="mb-3 flex flex-wrap gap-2">
                {note.complaints.map(c => (
                  <div key={c.id} className="bg-white border border-gray-200 rounded-xl px-3 py-2 min-w-[140px] shadow-sm">
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className="text-xs font-semibold text-gray-700">
                        {BODY_REGION_LABELS[c.bodyRegion]}
                        {c.side !== 'na' && `（${SIDE_LABELS_SHORT[c.side]}）`}
                      </span>
                      {c.diagnosisLabel && (
                        <span className="text-xs text-gray-500 truncate max-w-[80px]">{c.diagnosisLabel}</span>
                      )}
                    </div>
                    <div className="flex items-baseline gap-1">
                      <span className={`text-xl font-bold ${NRS_COLOR(c.nrs)}`}>{c.nrs}</span>
                      <span className="text-xs text-gray-500">/10</span>
                    </div>
                    {c.symptoms.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {c.symptoms.map(s => (
                          <span key={s} className="text-xs bg-teal-50 text-teal-700 border border-teal-200 rounded-full px-1.5 py-0.5">
                            {s}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {note.painLocations && note.painLocations.length > 0 && (
              <div className="mb-3">
                <p className="text-xs text-gray-500 font-medium mb-1">この日の痛み部位</p>
                <BodyMap selected={note.painLocations} onChange={() => {}} readOnly />
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              {note.changeFromLast && <Row label="前回からの変化" value={note.changeFromLast} />}
              {note.adlDifficulty && <Row label="日常生活の困り事" value={note.adlDifficulty} />}
              {note.patientConcern && <Row label="患者の不安" value={note.patientConcern} />}
              {note.patientGoalToday && <Row label="本日の目標" value={note.patientGoalToday} />}
              <Row label="自宅運動" value={adherenceLabel} />
            </div>
          </section>

          {/* O: 客観的情報 */}
          <section>
            <div className="flex items-center gap-1.5 mb-2">
              <span className="w-5 h-5 rounded-full bg-green-700 text-white text-xs font-bold flex items-center justify-center">O</span>
              <span className="text-xs font-semibold text-green-700">客観的情報（検査・観察）</span>
            </div>
            {note.treatmentAreas && note.treatmentAreas.length > 0 && (
              <div className="mb-3">
                <p className="text-xs text-gray-500 font-medium mb-1">施術部位</p>
                <BodyMap selected={note.treatmentAreas} onChange={() => {}} readOnly />
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              {note.romFindings && <Row label="ROM所見" value={note.romFindings} />}
              {note.strengthFindings && <Row label="筋力所見" value={note.strengthFindings} />}
              {note.soapSpecialTests && note.soapSpecialTests.length > 0 && (
                <div className="sm:col-span-2 rounded-lg border border-gray-100 bg-white p-2">
                  <p className="text-gray-500 font-medium mb-1.5">スペシャルテスト</p>
                  <div className="flex flex-wrap gap-1.5">
                    {note.soapSpecialTests.map((t, i) => (
                      <span
                        key={i}
                        className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full border font-medium ${SOAP_RESULT_COLORS[t.result]}`}
                      >
                        <span className="text-gray-500 font-normal text-xs">{t.joint.replace('関節', '').replace('・手指', '')}</span>
                        {t.testName.replace(/ test| sign/i, '')}
                        <span className="font-bold">{SOAP_RESULT_SYMBOL[t.result]}</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {note.specialTestFindings && <Row label="テスト補足" value={note.specialTestFindings} className="sm:col-span-2" />}
              {note.tenderness && <Row label="圧痛" value={note.tenderness} />}
              {note.gait && <Row label="歩行" value={note.gait} />}
              {note.singleLegStance && <Row label="片脚立位" value={note.singleLegStance} />}
              {note.squat && <Row label="スクワット" value={note.squat} />}
              {(note.swelling || note.heat) && (
                <Row label="腫脹・熱感" value={[note.swelling && '腫脹あり', note.heat && '熱感あり'].filter(Boolean).join('　')} />
              )}
              {note.therapistObservation && <Row label="施術者観察" value={note.therapistObservation} className="sm:col-span-2" />}
            </div>
          </section>

          {/* A: 評価・分析 */}
          <section>
            <div className="flex items-center gap-1.5 mb-2">
              <span className="w-5 h-5 rounded-full bg-amber-500 text-amber-950 text-xs font-bold flex items-center justify-center">A</span>
              <span className="text-xs font-semibold text-amber-700">評価・分析</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              {note.improvements && <Row label="改善したこと" value={note.improvements} highlight="green" />}
              {note.remainingIssues && <Row label="残存課題" value={note.remainingIssues} highlight="amber" />}
              {note.priorityIssue && <Row label="優先課題" value={note.priorityIssue} />}
            </div>
          </section>

          {/* P: 計画 */}
          <section>
            <div className="flex items-center gap-1.5 mb-2">
              <span className="w-5 h-5 rounded-full bg-purple-600 text-white text-xs font-bold flex items-center justify-center">P</span>
              <span className="text-xs font-semibold text-purple-700">計画</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              {note.treatmentToday && <Row label="本日の治療内容" value={note.treatmentToday} />}
              {note.homeExercise && <Row label="自宅運動指示" value={note.homeExercise} highlight="purple" />}
              {note.nextGoal && <Row label="次回目標" value={note.nextGoal} highlight="blue" />}
              {note.forbiddenMovements && <Row label="禁忌動作" value={note.forbiddenMovements} highlight="red" />}
              {note.recommendedFrequency && <Row label="来院頻度" value={note.recommendedFrequency} />}
              {note.nextReassessment && <Row label="再評価予定" value={note.nextReassessment} />}
            </div>
          </section>

        </div>
      )}
    </div>
  )
}

function Row({ label, value, highlight, className = '' }: {
  label: string
  value: string
  highlight?: 'green' | 'amber' | 'blue' | 'purple' | 'red' | 'teal'
  className?: string
}) {
  const bg = highlight === 'green' ? 'bg-green-50 border-green-100' :
    highlight === 'amber' ? 'bg-amber-50 border-amber-100' :
    highlight === 'blue' ? 'bg-blue-50 border-blue-100' :
    highlight === 'purple' ? 'bg-purple-50 border-purple-100' :
    highlight === 'red' ? 'bg-red-50 border-red-100' :
    highlight === 'teal' ? 'bg-teal-50 border-teal-100' :
    'bg-white border-gray-100'
  return (
    <div className={`rounded-lg border p-2 ${bg} ${className}`}>
      <p className="text-gray-500 font-medium mb-0.5">{label}</p>
      <p className="text-gray-700 whitespace-pre-wrap">{value}</p>
    </div>
  )
}

// ── 問診票サマリーカード ────────────────────────────────────
function IntakeCard({
  intake, onReferral,
}: {
  intake: Intake
  onReferral?: () => void
}) {
  const [open, setOpen] = useState(false)

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden bg-white shadow-sm">
      {/* ヘッダー行（展開ボタン＋アクションボタン） */}
      <div className="flex items-center gap-2 pr-3 hover:bg-gray-50 transition-colors">
        {/* 展開トリガー（行の大部分） */}
        <button
          type="button"
          onClick={() => setOpen(o => !o)}
          className="flex-1 flex items-center gap-3 px-4 py-3 text-left min-w-0"
        >
          <span className="text-sm font-medium text-gray-700 w-28 flex-shrink-0">{intake.intakeDate}</span>
          <span className="text-sm text-gray-600 flex-1 truncate">{intake.chiefComplaint}</span>
          {intake.suspectedDiagnosis && (
            <span className="text-xs bg-teal-50 border border-teal-200 text-teal-700 rounded-full px-2 py-0.5 flex-shrink-0 hidden sm:inline">
              {intake.suspectedDiagnosis}
            </span>
          )}
          {intake.aiSuggestedTests && intake.aiSuggestedTests.length > 0 && (
            <span className="text-xs bg-purple-50 border border-purple-200 text-purple-700 rounded-full px-2 py-0.5 flex-shrink-0 hidden md:inline">
              🤖 AI分析済
            </span>
          )}
          <span className={`text-gray-500 text-xs transition-transform duration-200 flex-shrink-0 ${open ? 'rotate-180' : ''}`}>
            ▼
          </span>
        </button>

        {/* 常時表示のアクションボタン */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {onReferral && (
            <button
              type="button"
              onClick={onReferral}
              title="紹介状・報告書を作成"
              className="px-2.5 py-1.5 bg-white border border-gray-200 text-gray-600 text-xs font-medium rounded-lg hover:border-teal-400 hover:text-teal-700 transition-colors shadow-sm whitespace-nowrap"
            >
              📄 紹介状
            </button>
          )}
        </div>
      </div>

      {/* 展開コンテンツ */}
      {open && (
        <div className="border-t border-gray-100 px-4 py-4 space-y-3 bg-gray-50/50">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            {intake.chiefComplaint && <Row label="主訴" value={intake.chiefComplaint} />}
            {intake.injuryMechanism && <Row label="受傷機転" value={intake.injuryMechanism} />}
            {intake.painNrs > 0 && <Row label="痛みNRS" value={`${intake.painNrs}/10`} />}
            {intake.painCharacter.length > 0 && <Row label="痛みの性状" value={intake.painCharacter.join('、')} />}
            {intake.importantGoal && <Row label="取り戻したい動作" value={intake.importantGoal} highlight="blue" />}
            {intake.suspectedDiagnosis && <Row label="疑い診断" value={intake.suspectedDiagnosis} highlight="teal" />}
          </div>
          {/* AI分析結果 */}
          {(intake.aiSuggestedTests || intake.aiDifferentials || intake.aiProtocol) && (
            <div className="mt-2 space-y-2">
              <p className="text-xs font-semibold text-purple-700">🤖 AI分析結果</p>
              {intake.aiSuggestedTests && intake.aiSuggestedTests.length > 0 && (
                <div>
                  <p className="text-xs text-gray-500 mb-1">推奨テスト</p>
                  <div className="flex flex-wrap gap-1">
                    {intake.aiSuggestedTests.map((t, i) => (
                      <span key={i} className="text-xs px-2 py-0.5 bg-teal-50 text-teal-700 border border-teal-200 rounded-full">{t}</span>
                    ))}
                  </div>
                </div>
              )}
              {intake.aiDifferentials && intake.aiDifferentials.length > 0 && (
                <div>
                  <p className="text-xs text-gray-500 mb-1">鑑別診断</p>
                  <ul className="text-xs text-gray-600 space-y-0.5">
                    {intake.aiDifferentials.map((d, i) => <li key={i}>• {d}</li>)}
                  </ul>
                </div>
              )}
              {intake.aiProtocol && (
                <div className="bg-green-50 border border-green-100 rounded-lg p-2">
                  <p className="text-xs text-gray-500 mb-0.5">推奨プロトコル</p>
                  <p className="text-xs text-green-800">{intake.aiProtocol}</p>
                </div>
              )}
            </div>
          )}

        </div>
      )}
    </div>
  )
}

type TabKey = 'soap' | 'overview' | 'eval' | 'intake' | 'memo' | 'cancel'
/** 「評価・測定」の中の切り替え */
type EvalKey = 'evaluation' | 'rom' | 'strength' | 'special' | 'progress'
const EVAL_TABS: { key: EvalKey; label: string }[] = [
  { key: 'evaluation', label: '初回評価' },
  { key: 'rom', label: 'ROM' },
  { key: 'strength', label: '筋力' },
  { key: 'special', label: 'スペシャルテスト' },
  { key: 'progress', label: '経過グラフ' },
]

interface Props {
  patient: Patient
}

export default function PatientDetail({ patient }: Props) {
  const [activeTab, setActiveTab] = useState<TabKey>('soap')
  const [evalTab, setEvalTab] = useState<EvalKey>('evaluation')
  const [evaluations, setEvaluations] = useState<Evaluation[]>([])
  const [romRecords, setRomRecords] = useState<ROMRecord[]>([])
  const [strengthRecords, setStrengthRecords] = useState<StrengthRecord[]>([])
  const [specialTests, setSpecialTests] = useState<SpecialTestRecord[]>([])
  const [soapNotes, setSoapNotes] = useState<SOAPNote[]>([])
  const [progressRecords, setProgressRecords] = useState<ProgressRecord[]>([])
  const [quickMemos, setQuickMemos] = useState<QuickMemo[]>([])
  const [intakes, setIntakes] = useState<Intake[]>([])
  const [cancellations, setCancellations] = useState<CancellationRecord[]>([])
  const [showReferralModal, setShowReferralModal] = useState(false)
  const [selectedIntake, setSelectedIntake] = useState<Intake | null>(null)
  const [selectedSoap, setSelectedSoap] = useState<SOAPNote | null>(null)
  const [returnAssessments, setReturnAssessments] = useState<ReturnCriteriaAssessment[]>([])

  useEffect(() => {
    reload()
  }, [patient.id])

  function reload() {
    setEvaluations(getEvaluations(patient.id))
    setRomRecords(getROMRecords(patient.id))
    setStrengthRecords(getStrengthRecords(patient.id))
    setSpecialTests(getSpecialTests(patient.id))
    setSoapNotes(getSOAPNotes(patient.id).sort((a, b) => b.visitDate.localeCompare(a.visitDate)))
    setProgressRecords(getProgressRecords(patient.id))
    setQuickMemos(getQuickMemos(patient.id).sort((a, b) => b.memoDate.localeCompare(a.memoDate)))
    setIntakes(getIntakes(patient.id).sort((a, b) => b.intakeDate.localeCompare(a.intakeDate)))
    setCancellations(getCancellations(patient.id))
    setReturnAssessments(getReturnAssessments(patient.id))
  }

  // ── 算出値 ──
  const latestEval = evaluations.at(-1)
  const firstEval = evaluations[0]
  const latestSoap = soapNotes[0]
  const currentPhase = latestSoap?.currentPhase ?? 1

  const romImprovement = firstEval
    ? calculateROMImprovement(firstEval.painNrs, latestEval?.painNrs ?? null, latestEval?.painNrs ?? null, 10)
    : null

  const improvementScore = latestEval
    ? calculateImprovementScore({
        initialPain: firstEval?.painNrs ?? 10,
        currentPain: latestSoap?.painToday ?? latestEval.painNrs,
        romImprovementRate: 20,
        strengthImprovementRate: 15,
        specialTestImproved: false,
        functionalScore: 40,
        homeExerciseAdherence: latestSoap?.homeExerciseAdherence === 'done' ? 100 : latestSoap?.homeExerciseAdherence === 'partial' ? 50 : 0,
        visitContinuity: 80,
        patientSubjective: 60,
      })
    : null

  // キャンセル累計（ヘッダー表示・離脱リスク算出に使用）
  const cancelSummary = summarizeCancellations(cancellations)

  const retentionRisk = calculateRetentionRisk({
    daysSinceLastVisit: getDaysSinceLastVisit(patient.updatedAt),
    recommendedIntervalDays: 7,
    cancelCount: cancelSummary.total,
    totalVisits: soapNotes.length,
    painChange: firstEval ? (latestSoap?.painToday ?? 5) - firstEval.painNrs : 0,
    romImprovementRate: 15,
    strengthImprovementRate: 15,
    homeExerciseAdherence: latestSoap?.homeExerciseAdherence === 'done' ? 100 : 50,
    hasEconomicConcern: false,
    hasGoalUnclear: false,
    hasExplanationInsufficient: false,
  })

  const patientMessage = improvementScore
    ? generatePatientFriendlyMessage({
        phase: currentPhase,
        painNrs: latestSoap?.painToday ?? latestEval?.painNrs ?? 5,
        initialPainNrs: firstEval?.painNrs ?? 8,
        romImprovementRate: 15,
        strengthImprovementRate: 10,
        improvementScore: improvementScore.total,
        nextGoal: latestSoap?.nextGoal ?? '',
      })
    : null

  // ── グラフデータ ──
  const painChartData = soapNotes.map(n => ({ date: n.visitDate, nrs: n.painToday })).reverse()
  const progressChartData = progressRecords.map(r => ({ date: r.recordDate, score: r.improvementScore }))
  const adherenceData = soapNotes.slice(0, 10).map(n => ({
    date: n.visitDate,
    rate: n.homeExerciseAdherence === 'done' ? 100 : n.homeExerciseAdherence === 'partial' ? 50 : 0,
  })).reverse()

  // ── ROM グラフデータ（最初の動作） ──
  const romMovements = [...new Set(romRecords.map(r => r.movement))].slice(0, 4)

  const TABS: { key: TabKey; label: string; badge?: number }[] = [
    { key: 'soap', label: 'SOAPカルテ', badge: soapNotes.length || undefined },
    { key: 'overview', label: '概要' },
    { key: 'eval', label: '評価・測定' },
    { key: 'intake', label: '問診票', badge: intakes.length || undefined },
    { key: 'memo', label: '簡易メモ', badge: quickMemos.length || undefined },
    { key: 'cancel', label: 'キャンセル', badge: cancelSummary.total || undefined },
  ]

  return (
    <div className="space-y-0">
      {/* ヘッダー（お名前・大事な数字・よく使うボタン・タブ） */}
      <div className="mb-4 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="px-4 pb-4 pt-4 sm:px-6">
          <Link
            href="/patients"
            className="inline-flex items-center gap-1 text-sm font-medium text-slate-500 transition-colors hover:text-slate-800"
          >
            ← カルテ一覧
          </Link>
          <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              {patient.kana && <p className="text-sm text-slate-500">{patient.kana}</p>}
              <h1 className="text-2xl font-black tracking-tight text-slate-900">{patient.name}</h1>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <Badge color="teal">{BODY_REGION_LABELS[patient.bodyRegion]}</Badge>
                {patient.diagnosisLabel && <Badge color="gray">{patient.diagnosisLabel}</Badge>}
                <RetentionRiskBadge level={retentionRisk.level} />
                {/* キャンセル累計（0件のときは表示しない）。押すとキャンセルタブへ */}
                {cancelSummary.total > 0 && (
                  <button
                    type="button"
                    onClick={() => setActiveTab('cancel')}
                    title={`予約日前 ${cancelSummary.advance} / 当日 ${cancelSummary.same_day} / 無断 ${cancelSummary.no_show}`}
                    className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold transition-colors ${
                      cancelSummary.no_show > 0
                        ? 'border border-red-200 bg-red-50 text-red-700 hover:bg-red-100'
                        : 'border border-orange-200 bg-orange-50 text-orange-700 hover:bg-orange-100'
                    }`}
                  >
                    キャンセル {cancelSummary.total}回
                    <span className="font-medium tabular-nums">
                      （前{cancelSummary.advance}・当{cancelSummary.same_day}・無{cancelSummary.no_show}）
                    </span>
                  </button>
                )}
              </div>
            </div>
            {improvementScore && (
              <div className="flex shrink-0 flex-col items-center">
                <ProgressGauge score={improvementScore.total} size={72} />
                <span className="mt-1 text-xs text-slate-500">改善スコア</span>
              </div>
            )}
          </div>

          {/* 大事な数字 */}
          <dl className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              { label: '来院回数（SOAP）', value: `${soapNotes.length}回` },
              { label: '最後の記録', value: latestSoap?.visitDate || '—' },
              {
                label: '最新の痛み（NRS）',
                value: latestSoap ? `${latestSoap.painToday} / 10` : '—',
                tone: latestSoap ? NRS_COLOR(latestSoap.painToday) : '',
              },
              { label: '初回来院', value: patient.firstVisitDate || '—' },
            ].map(f => (
              <div key={f.label} className="min-w-0 rounded-xl bg-slate-50 px-3 py-2">
                <dt className="text-xs font-bold text-slate-500">{f.label}</dt>
                <dd className={`mt-0.5 truncate text-base font-black ${f.tone || 'text-slate-900'}`}>{f.value}</dd>
              </div>
            ))}
          </dl>

          {latestSoap && (
            <div className="mt-4 max-w-lg">
              <PhaseStepper currentPhase={currentPhase} />
            </div>
          )}

          {/* よく使うボタン */}
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('soap')}
              className="rounded-xl bg-teal-700 px-4 py-2 text-sm font-bold text-white shadow-sm transition-colors hover:bg-teal-800"
            >
              今日のSOAPを書く
            </button>
            <button
              type="button"
              onClick={() => setShowReferralModal(true)}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 transition-colors hover:border-teal-400 hover:text-teal-800"
            >
              紹介状・報告書
            </button>
            <Link
              href={`/patients/${patient.id}/return-criteria`}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 transition-colors hover:border-teal-400 hover:text-teal-800"
            >
              復帰基準テスト
            </Link>
            <Link
              href={`/patients/${patient.id}/outcome-scores`}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 transition-colors hover:border-teal-400 hover:text-teal-800"
            >
              アウトカム評価
            </Link>
          </div>
        </div>

        {/* タブ */}
        <div className="overflow-x-auto border-t border-slate-100 px-1" role="group" aria-label="カルテの内容">
          <div className="flex min-w-max">
            {TABS.map(tab => (
              <button
                key={tab.key}
                type="button"
                aria-pressed={activeTab === tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`relative whitespace-nowrap border-b-2 px-4 py-3 text-sm font-bold transition-colors ${
                  activeTab === tab.key
                    ? 'border-teal-600 text-teal-800'
                    : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-800'
                }`}
              >
                {tab.label}
                {tab.badge != null && tab.badge > 0 && (
                  <span className="ml-1.5 rounded-full bg-slate-100 px-1.5 py-0.5 text-xs font-bold text-slate-600 tabular-nums">
                    {tab.badge}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* コンテンツ */}
      <div className="max-w-5xl mx-auto">

        {/* ── 問診票タブ ── */}
        {activeTab === 'intake' && (
          <div className="space-y-4">
            <IntakeForm patientId={patient.id} onSaved={reload} />
            {intakes.length > 0 && (
              <div className="space-y-2">
                <SectionTitle>過去の問診票</SectionTitle>
                {intakes.map(intake => (
                  <IntakeCard
                    key={intake.id}
                    intake={intake}
                    onReferral={() => {
                      setSelectedIntake(intake)
                      setShowReferralModal(true)
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── 概要タブ ── */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* 基本情報と保険証（NOAHから取り込んだ方）。情報が無い方には出さない */}
            <PatientProfileCard patient={patient} />
            {/* 目標と課題（NextGen v2.0・説明モードの表示元）
                key=patient.id で患者切替時に必ず読み直す（別患者のデータ混入防止） */}
            {isFeatureEnabled('goalsProblems') && (
              <GoalsProblemsCard key={patient.id} patient={patient} />
            )}
            {/* 患者メッセージ（施術者向け参考）*/}
            {patientMessage && (
              <Card>
                <CardContent className="pt-5">
                  <div className="bg-teal-50 rounded-xl p-4">
                    <p className="text-sm font-bold text-teal-800 mb-2">📣 患者様への今日のメッセージ</p>
                    <p className="text-sm text-teal-700">{patientMessage.encouragementMessage}</p>
                    <p className="text-sm text-teal-700 mt-2">{patientMessage.phaseExplanation}</p>
                    {patientMessage.nextGoalMessage && (
                      <p className="text-sm text-teal-800 font-medium mt-2">🎯 {patientMessage.nextGoalMessage}</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* 離脱リスクが高い場合の提案 */}
            {retentionRisk.level === 'high' && (
              <Card>
                <CardContent className="pt-5">
                  <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                    <p className="text-sm font-bold text-red-700 mb-2">⚠️ 離脱リスクが高い状態です</p>
                    <p className="text-sm text-red-600 mb-2">{retentionRisk.recommendedAction}</p>
                    <ul className="text-xs text-red-600 space-y-1">
                      {retentionRisk.reasons.map((r, i) => <li key={i}>• {r}</li>)}
                    </ul>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* 基本情報 */}
            <Card>
              <CardHeader><SectionTitle>患者基本情報</SectionTitle></CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                  <div><span className="text-gray-500">主訴</span><p className="font-medium">{patient.mainComplaint}</p></div>
                  <div><span className="text-gray-500">初回来院</span><p className="font-medium">{patient.firstVisitDate}</p></div>
                  <div><span className="text-gray-500">来院回数</span><p className="font-medium">{soapNotes.length}回</p></div>
                  <div><span className="text-gray-500">診断</span><p className="font-medium">{patient.diagnosisLabel}</p></div>
                  <div><span className="text-gray-500">発症日</span><p className="font-medium">{patient.onsetDate}</p></div>
                  <div><span className="text-gray-500">担当者メモ</span><p className="font-medium text-xs">{patient.therapistNotes || 'なし'}</p></div>
                </div>
              </CardContent>
            </Card>

            {/* できるようになったこと */}
            {soapNotes.length > 0 && (
              <Card>
                <CardHeader><SectionTitle>できるようになったこと</SectionTitle></CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {latestSoap?.improvements && (
                      <li className="flex items-start gap-2 text-sm text-gray-700">
                        <span className="text-green-700 mt-0.5">✓</span>
                        {latestSoap.improvements}
                      </li>
                    )}
                    {romRecords.length > 0 && (
                      <li className="flex items-start gap-2 text-sm text-gray-700">
                        <span className="text-green-700 mt-0.5">✓</span>
                        ROM測定が {romRecords.length}件記録されています
                      </li>
                    )}
                    {strengthRecords.length > 0 && (
                      <li className="flex items-start gap-2 text-sm text-gray-700">
                        <span className="text-green-700 mt-0.5">✓</span>
                        筋力測定が {strengthRecords.length}件記録されています
                      </li>
                    )}
                  </ul>
                </CardContent>
              </Card>
            )}

            {/* 次の目標 */}
            {latestSoap?.nextGoal && (
              <Card>
                <CardHeader><SectionTitle>次の目標</SectionTitle></CardHeader>
                <CardContent>
                  <p className="text-sm text-gray-700 bg-blue-50 rounded-lg p-3">{latestSoap.nextGoal}</p>
                </CardContent>
              </Card>
            )}

            {/* 最新SOAP概要 */}
            {latestSoap && (
              <Card>
                <CardHeader><SectionTitle>最新カルテ概要（{latestSoap.visitDate}）</SectionTitle></CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-500">痛みNRS</span>
                      <p className={`font-bold text-lg ${latestSoap.painToday >= 7 ? 'text-red-600' : latestSoap.painToday >= 4 ? 'text-yellow-700' : 'text-green-700'}`}>
                        {latestSoap.painToday} / 10
                      </p>
                    </div>
                    <div>
                      <span className="text-gray-500">自宅運動</span>
                      <p className="font-medium">{latestSoap.homeExerciseAdherence === 'done' ? '✅ 実施できた' : latestSoap.homeExerciseAdherence === 'partial' ? '⚠️ 一部実施' : '❌ 未実施'}</p>
                    </div>
                  </div>
                  {latestSoap.changeFromLast && (
                    <p className="mt-2 text-xs text-gray-600 bg-gray-50 rounded p-2">{latestSoap.changeFromLast}</p>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* ── 評価・測定タブ（初回評価・ROM・筋力・スペシャルテスト・経過グラフ） ── */}
        {activeTab === 'eval' && (
          <div className="mb-4 flex flex-wrap gap-1.5" role="group" aria-label="評価・測定の切り替え">
            {EVAL_TABS.map(t => (
              <button
                key={t.key}
                type="button"
                aria-pressed={evalTab === t.key}
                onClick={() => setEvalTab(t.key)}
                className={`rounded-full px-3.5 py-1.5 text-sm font-bold transition-colors ${
                  evalTab === t.key ? 'bg-teal-700 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        )}
        {activeTab === 'eval' && evalTab === 'evaluation' && (
          <div className="space-y-6">
            {evaluations.length > 0 && (
              <Card>
                <CardHeader><SectionTitle>評価履歴</SectionTitle></CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {evaluations.map(ev => (
                      <div key={ev.id} className="py-3 border-b border-gray-50 last:border-0">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-gray-600 text-sm">{ev.evaluationDate}</span>
                          <div className="flex items-center gap-2">
                            <span className={`font-medium text-sm ${ev.painNrs >= 7 ? 'text-red-600' : ev.painNrs >= 4 ? 'text-yellow-700' : 'text-green-700'}`}>
                              NRS: {ev.painNrs}
                            </span>
                            {ev.painDuration && (
                              <Badge color={ev.painDuration === 'chronic' ? 'red' : ev.painDuration === 'subacute' ? 'yellow' : 'teal'}>
                                {ev.painDuration === 'chronic' ? '慢性' : ev.painDuration === 'subacute' ? '亜急性' : '急性'}
                              </Badge>
                            )}
                          </div>
                          <div className="flex gap-1">
                            {ev.swelling && <Badge color="blue">腫脹</Badge>}
                            {ev.numbness && <Badge color="red">しびれ</Badge>}
                            {ev.nightPain && <Badge color="red">夜間痛</Badge>}
                            {ev.centralSensitization && <Badge color="purple">中枢感作</Badge>}
                          </div>
                        </div>
                        {ev.painLocations && ev.painLocations.length > 0 && (
                          <div className="mt-2">
                            <BodyMap selected={ev.painLocations} onChange={() => {}} readOnly />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
            <EvaluationForm patientId={patient.id} onSaved={reload} />
          </div>
        )}

        {/* ── SOAPカルテタブ ── */}
        {activeTab === 'soap' && (
          <div className="space-y-4">
            {/* 新規カルテ入力 */}
            <SOAPForm patientId={patient.id} onSaved={reload} />

            {/* 過去カルテ一覧（アコーディオン） */}
            {soapNotes.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 px-1 pt-2">
                  <SectionTitle>過去のカルテ</SectionTitle>
                  <span className="text-xs text-gray-500">{soapNotes.length}件</span>
                </div>
                {soapNotes.map(note => (
                  <SOAPNoteCard
                    key={note.id}
                    note={note}
                    onReferral={() => {
                      setSelectedSoap(note)
                      setSelectedIntake(null)
                      setShowReferralModal(true)
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── 簡易メモ タブ ── */}
        {activeTab === 'memo' && (
          <QuickMemoTab
            patient={patient}
            memos={quickMemos}
            specialTests={specialTests}
            onUpdate={reload}
          />
        )}

        {/* ── キャンセルタブ ── */}
        {activeTab === 'cancel' && (
          <CancellationTab
            patientId={patient.id}
            records={cancellations}
            visitCount={soapNotes.length}
            onUpdate={reload}
          />
        )}

        {/* ── ROM タブ ── */}
        {activeTab === 'eval' && evalTab === 'rom' && (
          <div className="space-y-6">
            {romRecords.length > 0 && (
              <Card>
                <CardHeader><SectionTitle>ROM記録一覧</SectionTitle></CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-100">
                          <th className="text-left py-2 text-gray-500 font-medium text-xs">日付</th>
                          <th className="text-left py-2 text-gray-500 font-medium text-xs">部位</th>
                          <th className="text-left py-2 text-gray-500 font-medium text-xs">動作</th>
                          <th className="text-right py-2 text-gray-500 font-medium text-xs">自動</th>
                          <th className="text-right py-2 text-gray-500 font-medium text-xs">他動</th>
                          <th className="text-right py-2 text-gray-500 font-medium text-xs">正常値</th>
                          <th className="text-center py-2 text-gray-500 font-medium text-xs">痛み</th>
                        </tr>
                      </thead>
                      <tbody>
                        {romRecords.map(r => {
                          const imp = calculateROMImprovement(null, null, r.activeRom, r.normalValue)
                          const pct = imp.normalRatio ? Math.round(imp.normalRatio) : null
                          return (
                            <tr key={r.id} className="border-b border-gray-50 hover:bg-gray-50">
                              <td className="py-2 text-xs">{r.measuredDate}</td>
                              <td className="py-2 text-xs">{BODY_REGION_LABELS[r.bodyRegion]}</td>
                              <td className="py-2 text-xs font-medium">{r.movement}</td>
                              <td className="py-2 text-right">
                                <span className={`text-xs font-bold ${pct && pct < 70 ? 'text-red-600' : pct && pct < 90 ? 'text-yellow-700' : 'text-green-700'}`}>
                                  {r.activeRom ?? '—'}{r.unit === 'deg' ? '°' : 'cm'}
                                </span>
                              </td>
                              <td className="py-2 text-right text-xs">{r.passiveRom ?? '—'}</td>
                              <td className="py-2 text-right text-xs text-gray-500">{r.normalValue}{r.unit === 'deg' ? '°' : 'cm'}</td>
                              <td className="py-2 text-center">{r.pain ? '⚠' : '—'}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}
            {romMovements.length > 0 && (
              <Card>
                <CardHeader><SectionTitle>ROM推移グラフ</SectionTitle></CardHeader>
                <CardContent>
                  {romMovements.map(movement => {
                    const data = romRecords
                      .filter(r => r.movement === movement)
                      .map(r => ({ date: r.measuredDate, active: r.activeRom, passive: r.passiveRom }))
                    const firstRecord = romRecords.find(r => r.movement === movement)
                    return (
                      <div key={movement} className="mb-4">
                        <p className="text-xs font-medium text-gray-600 mb-1">{movement}</p>
                        <ROMChart data={data} movement={movement} normalValue={firstRecord?.normalValue} />
                      </div>
                    )
                  })}
                </CardContent>
              </Card>
            )}
            <ROMInputForm patientId={patient.id} onSaved={reload} />
          </div>
        )}

        {/* ── 筋力タブ ── */}
        {activeTab === 'eval' && evalTab === 'strength' && (
          <div className="space-y-6">
            {strengthRecords.length > 0 && (
              <Card>
                <CardHeader><SectionTitle>筋力記録一覧</SectionTitle></CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-100">
                          <th className="text-left py-2 text-gray-500 font-medium text-xs">日付</th>
                          <th className="text-left py-2 text-gray-500 font-medium text-xs">動作</th>
                          <th className="text-center py-2 text-gray-500 font-medium text-xs">患側</th>
                          <th className="text-center py-2 text-gray-500 font-medium text-xs">MMT</th>
                          <th className="text-center py-2 text-gray-500 font-medium text-xs">HHD</th>
                          <th className="text-center py-2 text-gray-500 font-medium text-xs">痛み</th>
                        </tr>
                      </thead>
                      <tbody>
                        {strengthRecords.map(r => (
                          <tr key={r.id} className="border-b border-gray-50 hover:bg-gray-50">
                            <td className="py-2 text-xs">{r.measuredDate}</td>
                            <td className="py-2 text-xs font-medium">{r.movement}</td>
                            <td className="py-2 text-center text-xs">{r.side === 'right' ? '右' : r.side === 'left' ? '左' : r.side}</td>
                            <td className="py-2 text-center">
                              <span className="font-bold text-teal-700 text-sm">{r.mmt !== null ? r.mmt : '—'}</span>
                            </td>
                            <td className="py-2 text-center text-xs">{r.hhdValue !== null ? `${r.hhdValue} ${r.unit}` : '—'}</td>
                            <td className="py-2 text-center">{r.pain ? '⚠' : '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}
            <StrengthInputForm patientId={patient.id} onSaved={reload} />
          </div>
        )}

        {/* ── スペシャルテストタブ ── */}
        {activeTab === 'eval' && evalTab === 'special' && (
          <div className="space-y-6">

            {/* ── アウトカムスコアへのショートカット ── */}
            <Card>
              <CardContent className="py-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold text-gray-800">📊 部位別アウトカムスコア</p>
                    <p className="text-xs text-gray-500 mt-0.5">Lysholm / IKDC / ASES / ODI / CAIT / HHS など13種類のスコアを入力・追跡</p>
                  </div>
                  <Link
                    href={`/patients/${patient.id}/outcome-scores`}
                    className="flex items-center gap-1.5 px-3 py-2 bg-teal-700 text-white text-xs font-semibold rounded-lg hover:bg-teal-800 transition-colors whitespace-nowrap flex-shrink-0"
                  >
                    スコア入力 →
                  </Link>
                </div>
              </CardContent>
            </Card>

            {/* ── 機能評価・競技復帰 セクション ── */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between gap-3">
                  <SectionTitle>🏆 機能評価・競技復帰テスト</SectionTitle>
                  <Link
                    href={`/patients/${patient.id}/return-criteria`}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-700 text-white text-xs font-semibold rounded-lg hover:bg-emerald-800 transition-colors whitespace-nowrap"
                  >
                    評価ページへ →
                  </Link>
                </div>
              </CardHeader>
              <CardContent>
                {returnAssessments.length === 0 ? (
                  <div className="text-center py-6 bg-emerald-50 rounded-xl border border-emerald-100">
                    <p className="text-sm font-medium text-emerald-700">まだ復帰基準テストが実施されていません</p>
                    <p className="text-xs text-emerald-700 mt-1 max-w-xs mx-auto">
                      {({
                        hip: 'Harris Hip Score / RSI / 片脚立位・ステップダウン / LEFS',
                        shoulder: 'ASES肩スコア / RSI / 座位ショットパット・Y-Balance / 上肢機能質問紙',
                        ankle: 'CAIT / RSI / Y-Balance・Figure-8ホップ / LEFS',
                        lumbar: 'ODI / RSI / サイドブリッジ保持テスト / LEFS',
                      } as Record<string, string>)[patient.bodyRegion]
                        ?? 'Lysholm / ACL-RSI / 4-Hop Test Battery / LEFS'}
                      {' '}を実施して定量的な復帰判定を行いましょう
                    </p>
                    <Link
                      href={`/patients/${patient.id}/return-criteria`}
                      className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-700 text-white text-sm font-semibold rounded-lg hover:bg-emerald-800 transition-colors"
                    >
                      🏆 復帰基準テストを実施する
                    </Link>
                  </div>
                ) : (() => {
                  const latest = returnAssessments[0]
                  const VERDICT = {
                    cleared:     { label: '✅ 復帰可能', bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', num: 'text-emerald-700' },
                    conditional: { label: '⚠️ 条件付き',  bg: 'bg-amber-50',   border: 'border-amber-200',   text: 'text-amber-700',   num: 'text-amber-700'   },
                    not_ready:   { label: '🔴 未達',      bg: 'bg-red-50',     border: 'border-red-200',     text: 'text-red-700',     num: 'text-red-600'     },
                  }[latest.verdict]
                  return (
                    <div>
                      <div className={`rounded-xl border p-4 ${VERDICT.bg} ${VERDICT.border}`}>
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className={`text-base font-bold ${VERDICT.text}`}>{VERDICT.label}</div>
                            <div className="text-xs text-gray-500 mt-0.5">
                              {latest.assessmentDate} · {latest.type === 'sport' ? '競技復帰判定' : '日常生活復帰判定'}
                            </div>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <div className={`text-3xl font-bold ${VERDICT.num}`}>{latest.scores.composite}</div>
                            <div className="text-xs text-gray-500">/ 100点</div>
                          </div>
                        </div>
                        <div className="grid grid-cols-4 gap-2 mt-3">
                          {(({
                            knee:     [{ label: 'Lysholm', note: '症状' }, { label: 'ACL-RSI', note: '心理' }, { label: '4-Hop', note: 'LSI' }, { label: 'LEFS', note: '日常' }],
                            hip:      [{ label: 'HHS',     note: '症状' }, { label: 'RSI',     note: '心理' }, { label: '機能',   note: 'LSI' }, { label: 'LEFS', note: '日常' }],
                            shoulder: [{ label: 'ASES',    note: '症状' }, { label: 'RSI',     note: '心理' }, { label: '機能',   note: 'LSI' }, { label: '上肢',  note: '日常' }],
                            ankle:    [{ label: 'CAIT',    note: '症状' }, { label: 'RSI',     note: '心理' }, { label: '機能',   note: 'LSI' }, { label: 'LEFS', note: '日常' }],
                            lumbar:   [{ label: 'ODI',     note: '症状' }, { label: 'RSI',     note: '心理' }, { label: '機能',   note: 'LSI' }, { label: 'LEFS', note: '日常' }],
                          } as const)[latest.region] ?? [
                                { label: 'Lysholm', note: '症状' }, { label: 'ACL-RSI', note: '心理' }, { label: '4-Hop', note: 'LSI' }, { label: 'LEFS', note: '日常' },
                              ]).map((item, i) => ({
                            ...item,
                            score: [latest.scores.symptom, latest.scores.psychological, latest.scores.functional, latest.scores.daily][i],
                            icon: ['🦵', '🧠', '🏃', '🚶'][i],
                          })).map(item => (
                            <div key={item.label} className="text-center bg-white/70 rounded-lg py-2 px-1">
                              <div className="text-lg leading-none">{item.icon}</div>
                              <div className={`text-sm font-bold mt-0.5 ${
                                item.score >= 80 ? 'text-emerald-700' :
                                item.score >= 65 ? 'text-amber-700' : 'text-red-600'
                              }`}>{item.score}</div>
                              <div className="text-xs text-gray-500 leading-tight">{item.label}</div>
                              <div className="text-xs text-gray-500">{item.note}</div>
                            </div>
                          ))}
                        </div>
                        {latest.notes && (
                          <p className="text-xs text-gray-600 mt-2 bg-white/60 rounded-lg px-3 py-2">{latest.notes}</p>
                        )}
                      </div>
                      {returnAssessments.length > 1 && (
                        <p className="text-xs text-gray-500 text-center mt-2">
                          過去 {returnAssessments.length} 件の評価 — 詳細・履歴は評価ページで確認できます
                        </p>
                      )}
                    </div>
                  )
                })()}
              </CardContent>
            </Card>

            {/* ── 以下 通常スペシャルテスト ── */}
            {specialTests.length > 0 && (
              <Card>
                <CardHeader><SectionTitle>テスト結果</SectionTitle></CardHeader>
                <CardContent>
                  <SpecialTestSummary tests={specialTests.map(t => ({ name: t.testName, result: t.result }))} />
                  <div className="mt-4 space-y-2">
                    {specialTests.map(t => (
                      <div key={t.id} className="text-xs border border-gray-100 rounded-lg p-3">
                        <div className="flex items-start justify-between gap-2 flex-wrap">
                          <div>
                            <span className="font-medium text-gray-800">{t.testName}</span>
                            <span className="ml-2 text-gray-500">{BODY_REGION_LABELS[t.bodyRegion]}</span>
                            <span className="ml-2 text-gray-500">{t.measuredDate}</span>
                          </div>
                          <div className="flex gap-1.5 flex-wrap">
                            {(['rightResult', 'leftResult', 'result'] as const).map((key, i) => {
                              const val = t[key]
                              const label = ['右', '左', '総合'][i]
                              const color = val === 'positive' ? 'bg-red-100 text-red-700' : val === 'suspicious' ? 'bg-yellow-100 text-yellow-700' : val === 'unable' ? 'bg-gray-100 text-gray-500' : 'bg-green-100 text-green-700'
                              const text = val === 'positive' ? '陽性' : val === 'suspicious' ? '疑陽性' : val === 'negative' ? '陰性' : '不可'
                              return (
                                <span key={key} className={`px-2 py-0.5 rounded-full ${color}`}>
                                  {label}:{text}
                                </span>
                              )
                            })}
                          </div>
                        </div>
                        {(t.faberDistanceRight != null || t.faberDistanceLeft != null) && (
                          <p className="text-xs text-blue-600 mt-1.5">
                            床→脛骨粗面: 右 {t.faberDistanceRight ?? '-'}cm / 左 {t.faberDistanceLeft ?? '-'}cm
                          </p>
                        )}
                        {(t.apprehension || t.clickSound || t.limitation) && (
                          <div className="flex gap-1.5 mt-1.5">
                            {t.apprehension && <span className="px-1.5 py-0.5 bg-orange-50 text-orange-700 rounded text-xs">不安感あり</span>}
                            {t.clickSound && <span className="px-1.5 py-0.5 bg-orange-50 text-orange-700 rounded text-xs">クリック音</span>}
                            {t.limitation && <span className="px-1.5 py-0.5 bg-orange-50 text-orange-700 rounded text-xs">可動域制限</span>}
                          </div>
                        )}
                        {t.memo && <p className="mt-1.5 text-gray-600">{t.memo}</p>}
                        {t.patientFriendlyExplanation && (
                          <p className="mt-1.5 text-gray-600 bg-blue-50 rounded p-2">{t.patientFriendlyExplanation}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
            <SpecialTestInputForm patientId={patient.id} onSaved={reload} />
          </div>
        )}

        {/* ── 進捗タブ ── */}
        {activeTab === 'eval' && evalTab === 'progress' && (
          <div className="space-y-6">
            {improvementScore && (
              <Card>
                <CardHeader><SectionTitle>改善スコア</SectionTitle></CardHeader>
                <CardContent>
                  <div className="flex items-center gap-6">
                    <ProgressGauge score={improvementScore.total} size={120} />
                    <div className="space-y-2">
                      <p className="font-bold text-gray-800">{improvementScore.label}</p>
                      <div className="text-xs text-gray-600 space-y-1">
                        <p>痛み改善: {improvementScore.painScore}/25</p>
                        <p>ROM改善: {improvementScore.romScore}/20</p>
                        <p>筋力改善: {improvementScore.strengthScore}/20</p>
                        <p>機能改善: {improvementScore.functionalScore}/15</p>
                        <p>自宅運動: {improvementScore.adherenceScore}/5</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader><SectionTitle>痛みNRS推移</SectionTitle></CardHeader>
              <CardContent>
                <PainChart data={painChartData} />
              </CardContent>
            </Card>

            {progressRecords.length > 0 && (
              <Card>
                <CardHeader><SectionTitle>改善スコア推移</SectionTitle></CardHeader>
                <CardContent>
                  <ImprovementChart data={progressChartData} />
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader><SectionTitle>自宅運動実施率</SectionTitle></CardHeader>
              <CardContent>
                <AdherenceChart data={adherenceData} />
              </CardContent>
            </Card>
          </div>
        )}


      </div>

      {/* 紹介状・報告書モーダル */}
      {showReferralModal && (
        <ReferralLetterModal
          patient={patient}
          intakes={intakes}
          soapNotes={soapNotes}
          selectedIntake={selectedIntake ?? undefined}
          selectedSoap={selectedSoap ?? undefined}
          onClose={() => {
            setShowReferralModal(false)
            setSelectedIntake(null)
            setSelectedSoap(null)
          }}
        />
      )}

    </div>
  )
}
