'use client'
// ──────────────────────────────────────────────
// 患者詳細ページ（タブ構成）
// ──────────────────────────────────────────────
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type {
  Patient, Evaluation, ROMRecord, StrengthRecord,
  SpecialTestRecord, SOAPNote, Exercise, PatientExercise, ProgressRecord, RehabPlan,
  SpecialTestResult, QuickMemo, Intake,
} from '@/types/patient'
import { BODY_REGION_LABELS, PHASE_LABELS, PHASE_SHORT_LABELS } from '@/types/patient'
const SIDE_LABELS_SHORT: Record<string, string> = { right: '右', left: '左', bilateral: '両側', na: '' }
const NRS_COLOR = (n: number) => n >= 7 ? 'text-red-600' : n >= 4 ? 'text-yellow-600' : 'text-green-600'
import BodyMap from './BodyMap'
import {
  getEvaluations, getROMRecords, getStrengthRecords, getSpecialTests,
  getSOAPNotes, getExercises, getPatientExercises, savePatientExercise,
  deletePatientExercise, getProgressRecords, getRehabPlans,
  getQuickMemos, saveQuickMemo, deleteQuickMemo, getIntakes,
} from '@/lib/patient-store'
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
import ExerciseCard from './ExerciseCard'
import PatientExplanationSheet from './PatientExplanationSheet'
import IntakeForm from './IntakeForm'
import ReferralLetterModal from './ReferralLetterModal'
import { nanoid } from 'nanoid'

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
        <span className="text-sm font-semibold text-gray-700">🗒️ メモを追加</span>
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
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-400">Ctrl+Enter で保存</span>
          <div className="flex items-center gap-3">
            {saved && <span className="text-teal-600 text-sm">✓ 保存しました</span>}
            <button
              type="button"
              onClick={handleSave}
              disabled={!content.trim()}
              className="px-4 py-1.5 bg-teal-600 text-white text-sm font-medium rounded-lg hover:bg-teal-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              保存
            </button>
          </div>
        </div>
      </div>

      {/* 月別タイムライン */}
      {totalEntries === 0 ? (
        <p className="text-center text-sm text-gray-400 py-8">まだ記録がありません</p>
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-gray-400 px-1">
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
                      <span className="text-xs text-gray-400 bg-gray-100 rounded-full px-2 py-0.5">
                        📝 {monthMemos.length}
                      </span>
                    )}
                    {monthTests.length > 0 && (
                      <span className="text-xs text-purple-500 bg-purple-50 rounded-full px-2 py-0.5">
                        🔍 {monthTests.length}
                      </span>
                    )}
                    <span className="text-gray-400 text-xs ml-1">{collapsed ? '▶' : '▼'}</span>
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
                              <p className="text-[10px] text-gray-400 mt-0.5">📝 メモ</p>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">{memo.content}</p>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleDelete(memo.id)}
                              className="flex-shrink-0 text-gray-300 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100 text-lg leading-none mt-0.5"
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
                              <p className="text-[10px] text-purple-400 mt-0.5">🔍 テスト</p>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-800">
                                {t.testName}
                                <span className="ml-1.5 text-xs text-gray-400 font-normal">{BODY_REGION_LABELS[t.bodyRegion]}</span>
                              </p>
                              <div className="flex flex-wrap gap-1 mt-1">
                                {(['rightResult', 'leftResult', 'result'] as const).map((key, i) => (
                                  <span key={key} className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${ST_RESULT_COLOR[t[key]]}`}>
                                    {['右', '左', '総合'][i]}:{ST_RESULT_LABEL[t[key]]}
                                  </span>
                                ))}
                              </div>
                              {(t.apprehension || t.clickSound || t.limitation) && (
                                <p className="text-[10px] text-orange-600 mt-1">
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
  const nrsColor = note.painToday >= 7 ? 'text-red-600' : note.painToday >= 4 ? 'text-yellow-600' : 'text-green-600'
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
            <span className="text-xs text-gray-400 truncate flex-1 hidden md:block">
              ✓ {note.improvements}
            </span>
          )}
          <span className={`text-gray-400 text-xs transition-transform duration-200 flex-shrink-0 ${open ? 'rotate-180' : ''}`}>
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
              <span className="w-5 h-5 rounded-full bg-blue-500 text-white text-[10px] font-bold flex items-center justify-center">S</span>
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
                        <span className="text-[10px] text-gray-400 truncate max-w-[80px]">{c.diagnosisLabel}</span>
                      )}
                    </div>
                    <div className="flex items-baseline gap-1">
                      <span className={`text-xl font-bold ${NRS_COLOR(c.nrs)}`}>{c.nrs}</span>
                      <span className="text-[10px] text-gray-400">/10</span>
                    </div>
                    {c.symptoms.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {c.symptoms.map(s => (
                          <span key={s} className="text-[10px] bg-teal-50 text-teal-700 border border-teal-200 rounded-full px-1.5 py-0.5">
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
              <span className="w-5 h-5 rounded-full bg-green-500 text-white text-[10px] font-bold flex items-center justify-center">O</span>
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
                  <p className="text-gray-400 font-medium mb-1.5">スペシャルテスト</p>
                  <div className="flex flex-wrap gap-1.5">
                    {note.soapSpecialTests.map((t, i) => (
                      <span
                        key={i}
                        className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full border font-medium ${SOAP_RESULT_COLORS[t.result]}`}
                      >
                        <span className="text-gray-400 font-normal text-[10px]">{t.joint.replace('関節', '').replace('・手指', '')}</span>
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
              <span className="w-5 h-5 rounded-full bg-amber-500 text-white text-[10px] font-bold flex items-center justify-center">A</span>
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
              <span className="w-5 h-5 rounded-full bg-purple-500 text-white text-[10px] font-bold flex items-center justify-center">P</span>
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
      <p className="text-gray-400 font-medium mb-0.5">{label}</p>
      <p className="text-gray-700 whitespace-pre-wrap">{value}</p>
    </div>
  )
}

// ── 問診票サマリーカード ────────────────────────────────────
function IntakeCard({
  intake, onReferral, onProtocol,
}: {
  intake: Intake
  onReferral?: () => void
  onProtocol?: () => void
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
          <span className={`text-gray-400 text-xs transition-transform duration-200 flex-shrink-0 ${open ? 'rotate-180' : ''}`}>
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
          {onProtocol && (
            <button
              type="button"
              onClick={onProtocol}
              title="プロトコルを作成"
              className="px-2.5 py-1.5 bg-teal-600 text-white text-xs font-medium rounded-lg hover:bg-teal-700 transition-colors shadow-sm whitespace-nowrap"
            >
              📋 プロトコル
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
                  <p className="text-[10px] text-gray-400 mb-1">推奨テスト</p>
                  <div className="flex flex-wrap gap-1">
                    {intake.aiSuggestedTests.map((t, i) => (
                      <span key={i} className="text-xs px-2 py-0.5 bg-teal-50 text-teal-700 border border-teal-200 rounded-full">{t}</span>
                    ))}
                  </div>
                </div>
              )}
              {intake.aiDifferentials && intake.aiDifferentials.length > 0 && (
                <div>
                  <p className="text-[10px] text-gray-400 mb-1">鑑別診断</p>
                  <ul className="text-xs text-gray-600 space-y-0.5">
                    {intake.aiDifferentials.map((d, i) => <li key={i}>• {d}</li>)}
                  </ul>
                </div>
              )}
              {intake.aiProtocol && (
                <div className="bg-green-50 border border-green-100 rounded-lg p-2">
                  <p className="text-[10px] text-gray-400 mb-0.5">推奨プロトコル</p>
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

type TabKey = 'intake' | 'overview' | 'plan' | 'evaluation' | 'soap' | 'memo' | 'rom' | 'strength' | 'special' | 'progress' | 'exercises' | 'explanation'

interface Props {
  patient: Patient
}

export default function PatientDetail({ patient }: Props) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<TabKey>('intake')
  const [evaluations, setEvaluations] = useState<Evaluation[]>([])
  const [romRecords, setRomRecords] = useState<ROMRecord[]>([])
  const [strengthRecords, setStrengthRecords] = useState<StrengthRecord[]>([])
  const [specialTests, setSpecialTests] = useState<SpecialTestRecord[]>([])
  const [soapNotes, setSoapNotes] = useState<SOAPNote[]>([])
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [patientExercises, setPatientExercises] = useState<PatientExercise[]>([])
  const [progressRecords, setProgressRecords] = useState<ProgressRecord[]>([])
  const [rehabPlans, setRehabPlans] = useState<RehabPlan[]>([])
  const [quickMemos, setQuickMemos] = useState<QuickMemo[]>([])
  const [intakes, setIntakes] = useState<Intake[]>([])
  const [showReferralModal, setShowReferralModal] = useState(false)
  const [selectedIntake, setSelectedIntake] = useState<Intake | null>(null)
  const [selectedSoap, setSelectedSoap] = useState<SOAPNote | null>(null)

  useEffect(() => {
    reload()
  }, [patient.id])

  function reload() {
    setEvaluations(getEvaluations(patient.id))
    setRomRecords(getROMRecords(patient.id))
    setStrengthRecords(getStrengthRecords(patient.id))
    setSpecialTests(getSpecialTests(patient.id))
    setSoapNotes(getSOAPNotes(patient.id).sort((a, b) => b.visitDate.localeCompare(a.visitDate)))
    setExercises(getExercises())
    setPatientExercises(getPatientExercises(patient.id))
    setProgressRecords(getProgressRecords(patient.id))
    setRehabPlans(getRehabPlans(patient.id).sort((a, b) => a.phase - b.phase))
    setQuickMemos(getQuickMemos(patient.id).sort((a, b) => b.memoDate.localeCompare(a.memoDate)))
    setIntakes(getIntakes(patient.id).sort((a, b) => b.intakeDate.localeCompare(a.intakeDate)))
  }

  // 問診票データからプロトコル作成ページへのURLを生成
  function buildProtocolUrl(intake: Intake): string {
    const BODY_REGION_TO_JOINT: Record<string, string> = {
      fkl: '膝関節', fkr: '膝関節', bkl: '膝関節', bkr: '膝関節',
      fsl: '肩関節', fsr: '肩関節', bsl: '肩関節', bsr: '肩関節',
      fhil: '股関節', fhir: '股関節', bgl: '股関節', bgr: '股関節',
      fal: '足関節', far: '足関節', bhal: '足関節', bher: '足関節',
      fab: '腰部', blb: '腰部', fn: '頚部', bn: '頚部',
      fel: '肘関節', fer: '肘関節', bel: '肘関節', ber: '肘関節',
      fhdl: '手関節・手指', fhdr: '手関節・手指',
    }
    const JOINT_NAME_TO_KEY: Record<string, string> = {
      '膝関節': 'knee', '肩関節': 'shoulder', '股関節': 'hip',
      '足関節': 'ankle', '肘関節': 'elbow', '手関節・手指': 'hand',
      '腰部': 'spine', '頚部': 'spine',
    }
    const jointNames = [...new Set(intake.painLocations.map(l => BODY_REGION_TO_JOINT[l]).filter(Boolean))]
    const jointKey = jointNames[0] ? (JOINT_NAME_TO_KEY[jointNames[0]] ?? 'other') : ''
    const notesParts: string[] = []
    if (intake.chiefComplaint) notesParts.push(intake.chiefComplaint)
    if (intake.importantGoal) notesParts.push(`目標: ${intake.importantGoal}`)
    if (intake.therapistNotes) notesParts.push(`施術者メモ: ${intake.therapistNotes}`)
    const params = new URLSearchParams()
    if (intake.suspectedDiagnosis) params.set('diagnosis', intake.suspectedDiagnosis)
    if (jointKey) params.set('joint', jointKey)
    if (intake.sportsActivity) params.set('sport', intake.sportsActivity)
    if (intake.injuryDate) params.set('eventDate', intake.injuryDate)
    if (notesParts.length) params.set('notes', notesParts.join('\n'))
    return `/protocols/new?${params.toString()}`
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

  const retentionRisk = calculateRetentionRisk({
    daysSinceLastVisit: getDaysSinceLastVisit(patient.updatedAt),
    recommendedIntervalDays: 7,
    cancelCount: 0,
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

  // ── 運動割り当て ──
  function handleAssignExercise(exerciseId: string) {
    const pe: PatientExercise = {
      id: nanoid(),
      patientId: patient.id,
      exerciseId,
      assignedDate: new Date().toISOString().split('T')[0],
      status: 'active',
      adherenceRate: 0,
      painAfterExercise: null,
      memo: '',
    }
    savePatientExercise(pe)
    reload()
  }

  function handleRemoveExercise(patientExerciseId: string) {
    deletePatientExercise(patientExerciseId)
    reload()
  }

  const assignedExerciseIds = new Set(patientExercises.filter(pe => pe.status === 'active').map(pe => pe.exerciseId))

  const TABS: { key: TabKey; label: string; icon: string; badge?: number }[] = [
    { key: 'intake', label: '問診票', icon: '📋', badge: intakes.length || undefined },
    { key: 'overview', label: '概要', icon: '👁' },
    { key: 'plan', label: 'リハビリ計画', icon: '📅', badge: rehabPlans.length || undefined },
    { key: 'evaluation', label: '初回評価', icon: '🩺' },
    { key: 'soap', label: 'SOAPカルテ', icon: '📝' },
    { key: 'memo', label: '簡易メモ', icon: '🗒️', badge: quickMemos.length || undefined },
    { key: 'rom', label: 'ROM', icon: '📐' },
    { key: 'strength', label: '筋力', icon: '💪' },
    { key: 'special', label: 'スペシャルテスト', icon: '🔍' },
    { key: 'progress', label: '進捗', icon: '📈' },
    { key: 'exercises', label: '運動メニュー', icon: '🏃' },
    { key: 'explanation', label: '患者説明', icon: '📄' },
  ]

  return (
    <div className="space-y-0">
      {/* ヘッダーカード */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm mb-4 overflow-hidden">
        <div className="px-6 pt-5 pb-4">
          <button
            onClick={() => router.back()}
            className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-gray-700 mb-3 transition-colors"
          >
            ← 患者一覧に戻る
          </button>
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <h1 className="text-xl font-semibold text-gray-900">{patient.name}</h1>
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                <span className="text-sm text-gray-400">{patient.kana}</span>
                <Badge color="teal">{BODY_REGION_LABELS[patient.bodyRegion]}</Badge>
                {patient.diagnosisLabel && <Badge color="gray">{patient.diagnosisLabel}</Badge>}
                <RetentionRiskBadge level={retentionRisk.level} />
                <button
                  type="button"
                  onClick={() => setShowReferralModal(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-300 text-gray-700 text-xs font-medium rounded-lg hover:border-teal-400 hover:text-teal-700 transition-colors shadow-sm"
                >
                  📄 紹介状・報告書
                </button>
                <Link
                  href={`/patients/${patient.id}/return-criteria`}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 border border-emerald-300 text-emerald-700 text-xs font-medium rounded-lg hover:bg-emerald-100 transition-colors shadow-sm"
                >
                  🏆 復帰基準テスト
                </Link>
              </div>
            </div>
            {improvementScore && (
              <div className="flex flex-col items-center flex-shrink-0">
                <ProgressGauge score={improvementScore.total} size={72} />
                <span className="text-xs text-gray-400 mt-1">改善スコア</span>
              </div>
            )}
          </div>
          {latestSoap && (
            <div className="mt-4 max-w-lg">
              <PhaseStepper currentPhase={currentPhase} />
            </div>
          )}
        </div>

        {/* タブバー */}
        <div className="px-1 overflow-x-auto border-t border-gray-100">
          <div className="flex min-w-max">
            {TABS.map(tab => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`relative px-3.5 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                  activeTab === tab.key
                    ? 'border-teal-600 text-teal-700'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab.icon} {tab.label}
                {tab.badge != null && tab.badge > 0 && (
                  <span className="ml-1 bg-teal-500 text-white text-[10px] font-bold rounded-full px-1.5 py-0.5">
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
                    onProtocol={() => router.push(buildProtocolUrl(intake))}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── 概要タブ ── */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* 患者メッセージ（施術者向け参考）*/}
            {patientMessage && (
              <Card>
                <CardContent className="pt-5">
                  <div className="bg-teal-50 rounded-xl p-4">
                    <p className="text-sm font-bold text-teal-800 mb-2">📣 患者様への今日のメッセージ</p>
                    <p className="text-sm text-teal-700">{patientMessage.encouragementMessage}</p>
                    <p className="text-sm text-teal-600 mt-2">{patientMessage.phaseExplanation}</p>
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
                    <ul className="text-xs text-red-500 space-y-1">
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
                        <span className="text-green-500 mt-0.5">✓</span>
                        {latestSoap.improvements}
                      </li>
                    )}
                    {romRecords.length > 0 && (
                      <li className="flex items-start gap-2 text-sm text-gray-700">
                        <span className="text-green-500 mt-0.5">✓</span>
                        ROM測定が {romRecords.length}件記録されています
                      </li>
                    )}
                    {strengthRecords.length > 0 && (
                      <li className="flex items-start gap-2 text-sm text-gray-700">
                        <span className="text-green-500 mt-0.5">✓</span>
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
                      <p className={`font-bold text-lg ${latestSoap.painToday >= 7 ? 'text-red-600' : latestSoap.painToday >= 4 ? 'text-yellow-600' : 'text-green-600'}`}>
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

        {/* ── リハビリ計画タブ ── */}
        {activeTab === 'plan' && (
          <div className="space-y-4">
            {rehabPlans.length === 0 ? (
              <Card>
                <CardContent className="py-10 text-center">
                  <p className="text-gray-400 text-sm mb-2">リハビリ計画がまだありません</p>
                  <p className="text-gray-400 text-xs">「プロトコル立案」でプロトコルを作成し、「カルテへ反映」ボタンで追加できます</p>
                </CardContent>
              </Card>
            ) : (
              <>
                <div className="flex items-center gap-2 px-1">
                  <span className="text-sm font-medium text-gray-700">{rehabPlans.length}フェーズのリハビリ計画</span>
                  <span className="text-xs text-gray-400">（プロトコルから反映）</span>
                </div>
                {rehabPlans.map((plan, i) => (
                  <Card key={plan.id}>
                    <CardHeader>
                      <div className="flex items-center gap-3">
                        <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${
                          i === 0 ? 'bg-teal-100 text-teal-700' : 'bg-gray-100 text-gray-600'
                        }`}>
                          {plan.phase}
                        </span>
                        <div>
                          <SectionTitle>{plan.mainProblem || PHASE_SHORT_LABELS[plan.phase]}</SectionTitle>
                          <p className="text-xs text-gray-400 mt-0.5">{PHASE_LABELS[plan.phase]}</p>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                        {plan.shortTermGoal && (
                          <div>
                            <p className="text-xs font-medium text-gray-400 mb-1">短期ゴール</p>
                            <p className="text-gray-700 bg-green-50 rounded-lg p-2 text-xs">{plan.shortTermGoal}</p>
                          </div>
                        )}
                        {plan.midTermGoal && (
                          <div>
                            <p className="text-xs font-medium text-gray-400 mb-1">中期ゴール</p>
                            <p className="text-gray-700 bg-blue-50 rounded-lg p-2 text-xs">{plan.midTermGoal}</p>
                          </div>
                        )}
                        {plan.longTermGoal && (
                          <div className="md:col-span-2">
                            <p className="text-xs font-medium text-gray-400 mb-1">長期ゴール</p>
                            <p className="text-gray-700 bg-purple-50 rounded-lg p-2 text-xs">{plan.longTermGoal}</p>
                          </div>
                        )}
                        {plan.recommendedFrequency && (
                          <div className="md:col-span-2">
                            <p className="text-xs font-medium text-gray-400 mb-1">運動メニュー</p>
                            <p className="text-gray-700 text-xs">{plan.recommendedFrequency}</p>
                          </div>
                        )}
                        {plan.precautions && (
                          <div className="md:col-span-2">
                            <p className="text-xs font-medium text-gray-400 mb-1">進行基準</p>
                            <p className="text-gray-700 bg-amber-50 rounded-lg p-2 text-xs">{plan.precautions}</p>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </>
            )}
          </div>
        )}

        {/* ── 初回評価タブ ── */}
        {activeTab === 'evaluation' && (
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
                            <span className={`font-medium text-sm ${ev.painNrs >= 7 ? 'text-red-600' : ev.painNrs >= 4 ? 'text-yellow-600' : 'text-green-600'}`}>
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
                  <span className="text-xs text-gray-400">{soapNotes.length}件</span>
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

        {/* ── ROM タブ ── */}
        {activeTab === 'rom' && (
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
                                <span className={`text-xs font-bold ${pct && pct < 70 ? 'text-red-600' : pct && pct < 90 ? 'text-yellow-600' : 'text-green-600'}`}>
                                  {r.activeRom ?? '—'}{r.unit === 'deg' ? '°' : 'cm'}
                                </span>
                              </td>
                              <td className="py-2 text-right text-xs">{r.passiveRom ?? '—'}</td>
                              <td className="py-2 text-right text-xs text-gray-400">{r.normalValue}{r.unit === 'deg' ? '°' : 'cm'}</td>
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
        {activeTab === 'strength' && (
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
                              <span className="font-bold text-teal-600 text-sm">{r.mmt !== null ? r.mmt : '—'}</span>
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
        {activeTab === 'special' && (
          <div className="space-y-6">
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
                            <span className="ml-2 text-gray-400">{BODY_REGION_LABELS[t.bodyRegion]}</span>
                            <span className="ml-2 text-gray-400">{t.measuredDate}</span>
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
                        {(t.apprehension || t.clickSound || t.limitation) && (
                          <div className="flex gap-1.5 mt-1.5">
                            {t.apprehension && <span className="px-1.5 py-0.5 bg-orange-50 text-orange-700 rounded text-[10px]">不安感あり</span>}
                            {t.clickSound && <span className="px-1.5 py-0.5 bg-orange-50 text-orange-700 rounded text-[10px]">クリック音</span>}
                            {t.limitation && <span className="px-1.5 py-0.5 bg-orange-50 text-orange-700 rounded text-[10px]">可動域制限</span>}
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
        {activeTab === 'progress' && (
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

        {/* ── 運動メニュータブ ── */}
        {activeTab === 'exercises' && (
          <div className="space-y-6">
            {/* 処方中の運動 */}
            {patientExercises.filter(pe => pe.status === 'active').length > 0 && (
              <div>
                <h3 className="text-sm font-bold text-gray-700 mb-3">処方中の運動</h3>
                <div className="space-y-3">
                  {patientExercises.filter(pe => pe.status === 'active').map(pe => {
                    const exercise = exercises.find(e => e.id === pe.exerciseId)
                    if (!exercise) return null
                    return (
                      <ExerciseCard
                        key={pe.id}
                        exercise={exercise}
                        patientExercise={pe}
                        onRemove={handleRemoveExercise}
                      />
                    )
                  })}
                </div>
              </div>
            )}

            {/* 追加可能な運動 */}
            <div>
              <h3 className="text-sm font-bold text-gray-700 mb-3">追加できる運動</h3>
              <div className="space-y-3">
                {exercises
                  .filter(e => e.bodyRegion === patient.bodyRegion || e.bodyRegion === 'lumbar')
                  .filter(e => !assignedExerciseIds.has(e.id))
                  .map(exercise => (
                    <ExerciseCard
                      key={exercise.id}
                      exercise={exercise}
                      onAssign={handleAssignExercise}
                    />
                  ))}
              </div>
            </div>
          </div>
        )}

        {/* ── 患者説明タブ ── */}
        {activeTab === 'explanation' && (
          <PatientExplanationSheet
            patient={patient}
            evaluation={latestEval}
            soapNote={latestSoap}
            improvementScore={improvementScore?.total ?? 0}
            currentPhase={currentPhase}
            romRecords={romRecords}
            strengthRecords={strengthRecords}
            patientExercises={patientExercises}
            exercises={exercises}
          />
        )}
      </div>

      {/* 紹介状・報告書 フローティングボタン（常時表示） */}
      <button
        type="button"
        onClick={() => setShowReferralModal(true)}
        style={{ position: 'fixed', bottom: '24px', right: '24px', zIndex: 9999 }}
        className="flex items-center gap-2 px-4 py-3 bg-teal-600 text-white text-sm font-bold rounded-full shadow-2xl hover:bg-teal-700 transition-colors"
      >
        📄 紹介状・報告書
      </button>

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
