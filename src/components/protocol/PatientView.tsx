'use client'

import { useState, useMemo } from 'react'
import type { Protocol, Assessment, ProtocolPatient } from '@/types/protocol'
import MilestonePanel from './MilestonePanel'
import ProgressChart from './ProgressChart'
import { Eye, EyeOff, Star, ShieldAlert, Flame, Sprout, Activity, Dumbbell, Trophy, Printer } from 'lucide-react'

interface Props {
  patient: ProtocolPatient
  protocol: Protocol
  assessments: Assessment[]
}

const SIMPLE_WORDS: Record<string, string> = {
  'ROM': '関節の動く範囲',
  'LSI': '左右の筋力バランス',
  'MMT': '筋力テスト',
  'NRS': '痛みのレベル',
  'SLR': '脚上げ運動',
  'CKC': '足をつけた状態での運動',
  'ADL': '日常生活動作',
  '神経筋コントロール': '脳と筋肉の連携',
  '固有受容感覚': '体の位置感覚',
  '急性期': 'けがや手術の直後の時期',
  '回復期': '少しずつ回復している時期',
  '機能改善期': '筋力や動きを鍛える時期',
  '競技復帰期': 'スポーツに戻るための準備期間',
}

function simplify(text: string): string {
  let result = text
  for (const [term, plain] of Object.entries(SIMPLE_WORDS)) {
    result = result.replace(new RegExp(term, 'g'), `${term}(${plain})`)
  }
  return result
}

type IconComponent = React.ComponentType<{ className?: string }>

const PHASE_ENCOURAGEMENT: Record<number, { msg: string; Icon: IconComponent }> = {
  0: { msg: '回復のスタートです！毎日少しずつ積み上げましょう。', Icon: Sprout },
  1: { msg: 'よく頑張っています！少しずつ体が回復しています。',  Icon: Activity },
  2: { msg: 'いい調子です！筋力もついてきています。',            Icon: Dumbbell },
  3: { msg: 'ゴールが見えてきました！もうひと頑張り！',          Icon: Trophy },
}

function printPatientSheet(
  patient: ProtocolPatient,
  protocol: Protocol,
  simpleMode: boolean,
  daysSince: number | null,
) {
  const phase = protocol.phases[protocol.currentPhaseIndex]
  const nextPhase = protocol.phases[protocol.currentPhaseIndex + 1]
  const today = new Date().toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })
  const progressPct = Math.round(((protocol.currentPhaseIndex + 0.5) / protocol.phases.length) * 100)

  const txt = (t: string) => simpleMode ? (() => {
    let r = t
    for (const [term, plain] of Object.entries(SIMPLE_WORDS)) r = r.replace(new RegExp(term, 'g'), `${term}(${plain})`)
    return r
  })() : t

  const goalsHtml = phase?.goals.map(g =>
    `<li><span class="star">★</span>${txt(g)}</li>`
  ).join('') ?? ''

  const exercisesHtml = phase?.exercises.map((ex, i) =>
    `<div class="exercise-row">
      <span class="ex-num">${i + 1}</span>
      <div>
        <div class="ex-name">${ex.name}</div>
        ${ex.dose ? `<div class="ex-dose">${ex.dose}</div>` : ''}
        <div class="check-row"><span class="check-box"></span><span class="check-box"></span><span class="check-box"></span><span class="check-box"></span><span class="check-box"></span><span class="check-box"></span><span class="check-box"></span></div>
      </div>
    </div>`
  ).join('') ?? ''

  const redFlagsHtml = (phase?.redFlags ?? []).length > 0
    ? `<div class="section red-section">
        <div class="section-title red-title">⚠️ こんなときはすぐ相談を</div>
        <ul class="flags-list">${phase!.redFlags.map(r => `<li>${r}</li>`).join('')}</ul>
      </div>`
    : ''

  const encourageMessages = [
    '回復のスタートです！毎日少しずつ積み上げましょう。',
    'よく頑張っています！少しずつ体が回復しています。',
    'いい調子です！筋力もついてきています。',
    'ゴールが見えてきました！もうひと頑張り！',
  ]
  const encourage = encourageMessages[protocol.currentPhaseIndex] ?? 'よく頑張っています！'

  // プログレスバー（テキストドット）
  const dots = protocol.phases.map((_, i) =>
    `<span class="dot ${i < protocol.currentPhaseIndex ? 'done' : i === protocol.currentPhaseIndex ? 'current' : 'future'}"></span>`
  ).join('')

  const html = `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<title>リハビリシート — ${patient.name ?? '患者さん'}</title>
<style>
  @page { size: A4; margin: 15mm 15mm 18mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: "Hiragino Sans", "Noto Sans JP", "Yu Gothic", sans-serif;
    font-size: 11pt; color: #1a202c; background: #fff;
  }

  /* ── ヘッダー ── */
  .header {
    display: flex; align-items: flex-start; justify-content: space-between;
    border-bottom: 3px solid #0d9488; padding-bottom: 10px; margin-bottom: 14px;
  }
  .clinic-name { font-size: 13pt; font-weight: bold; color: #0d9488; }
  .clinic-sub  { font-size: 8pt; color: #64748b; margin-top: 1px; }
  .header-right { text-align: right; }
  .patient-name { font-size: 16pt; font-weight: bold; color: #1a202c; }
  .header-date  { font-size: 8pt; color: #64748b; margin-top: 2px; }

  /* ── 励ましバナー ── */
  .encourage {
    background: linear-gradient(135deg, #fffbeb, #fef3c7);
    border: 1.5px solid #f59e0b; border-radius: 10px;
    padding: 9px 14px; margin-bottom: 12px;
    display: flex; align-items: center; gap: 8px;
  }
  .encourage-icon { font-size: 18pt; }
  .encourage-text { font-size: 11pt; font-weight: bold; color: #92400e; }

  /* ── フェーズバナー ── */
  .phase-banner {
    background: linear-gradient(135deg, #0f172a, #134e4a);
    color: white; border-radius: 10px; padding: 12px 16px; margin-bottom: 12px;
  }
  .phase-label { font-size: 8pt; color: rgba(255,255,255,0.55); letter-spacing: 0.12em; text-transform: uppercase; }
  .phase-title { font-size: 15pt; font-weight: bold; margin-top: 2px; }
  .phase-days  { font-size: 9pt; color: rgba(255,255,255,0.75); margin-top: 4px; }
  .progress-row { display: flex; align-items: center; gap: 10px; margin-top: 10px; }
  .progress-bar-wrap { flex: 1; height: 7px; background: rgba(255,255,255,0.15); border-radius: 99px; overflow: hidden; }
  .progress-bar { height: 100%; background: #2dd4bf; border-radius: 99px; }
  .progress-text { font-size: 9pt; color: rgba(255,255,255,0.8); white-space: nowrap; }
  .dots { display: flex; gap: 5px; margin-top: 6px; }
  .dot { width: 8px; height: 8px; border-radius: 50%; }
  .dot.done    { background: #2dd4bf; }
  .dot.current { background: #ffffff; }
  .dot.future  { background: rgba(255,255,255,0.2); }

  /* ── セクション共通 ── */
  .section { border: 1.5px solid #e2e8f0; border-radius: 10px; padding: 12px 14px; margin-bottom: 12px; }
  .section-title {
    font-size: 8pt; font-weight: bold; color: #475569;
    text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 8px;
  }

  /* ── 目標 ── */
  .goals-list { list-style: none; display: flex; flex-direction: column; gap: 5px; }
  .goals-list li { display: flex; align-items: flex-start; gap: 6px; font-size: 11pt; color: #1a202c; }
  .star { color: #f59e0b; font-size: 10pt; flex-shrink: 0; margin-top: 1px; }

  /* ── エクササイズ ── */
  .exercise-row { display: flex; gap: 10px; align-items: flex-start; margin-bottom: 9px; }
  .ex-num {
    width: 22px; height: 22px; border-radius: 50%;
    background: #ccfbf1; color: #0d9488; font-size: 10pt; font-weight: bold;
    display: flex; align-items: center; justify-content: center; flex-shrink: 0;
  }
  .ex-name { font-size: 11pt; font-weight: bold; color: #1a202c; }
  .ex-dose { font-size: 9pt; color: #64748b; margin-top: 1px; }
  .check-row { display: flex; gap: 5px; margin-top: 5px; }
  .check-box {
    width: 18px; height: 18px; border: 1.5px solid #cbd5e1; border-radius: 4px;
  }

  /* ── 2カラムレイアウト ── */
  .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 12px; }

  /* ── 次の段階 ── */
  .next-phase {
    font-size: 9pt; color: #64748b; margin-top: 6px; padding-top: 6px;
    border-top: 1px dashed #e2e8f0;
  }

  /* ── 赤旗 ── */
  .red-section { border-color: #fecaca; background: #fff5f5; }
  .red-title   { color: #b91c1c; }
  .flags-list  { list-style: none; display: flex; flex-direction: column; gap: 4px; }
  .flags-list li { font-size: 10pt; color: #7f1d1d; padding-left: 10px; position: relative; }
  .flags-list li::before { content: "·"; position: absolute; left: 0; font-weight: bold; color: #ef4444; }

  /* ── メモ欄 ── */
  .memo-area {
    border: 1.5px solid #e2e8f0; border-radius: 10px; padding: 10px 14px; margin-bottom: 12px;
  }
  .memo-line { height: 24px; border-bottom: 1px solid #f1f5f9; }

  /* ── フッター ── */
  .footer {
    position: fixed; bottom: 0; left: 0; right: 0;
    padding: 6px 15mm; display: flex; justify-content: space-between; align-items: center;
    border-top: 1px solid #e2e8f0; font-size: 8pt; color: #94a3b8;
  }
</style>
</head>
<body>

<!-- ヘッダー -->
<div class="header">
  <div>
    <div class="clinic-name">ゆうき整骨院</div>
    <div class="clinic-sub">リハビリテーション指導シート</div>
  </div>
  <div class="header-right">
    <div class="patient-name">${patient.name ?? '患者さん'}</div>
    <div class="header-date">${today}</div>
    ${daysSince !== null ? `<div class="header-date">受傷・手術から ${daysSince} 日目</div>` : ''}
  </div>
</div>

<!-- 励ましメッセージ -->
<div class="encourage">
  <div class="encourage-icon">🌱</div>
  <div class="encourage-text">${encourage}</div>
</div>

<!-- フェーズバナー -->
<div class="phase-banner">
  <div class="phase-label">今いる段階</div>
  <div class="phase-title">${txt(phase?.title ?? '')}</div>
  ${phase?.durationWeeks ? `<div class="phase-days">期間の目安：${phase.durationWeeks}</div>` : ''}
  <div class="progress-row">
    <div class="progress-bar-wrap"><div class="progress-bar" style="width:${progressPct}%"></div></div>
    <div class="progress-text">フェーズ ${protocol.currentPhaseIndex + 1} / ${protocol.phases.length}</div>
  </div>
  <div class="dots">${dots}</div>
</div>

<!-- 2カラム：目標 + エクササイズ -->
<div class="two-col">
  <!-- 今の目標 -->
  <div class="section" style="margin-bottom:0;">
    <div class="section-title">⭐ 今の目標</div>
    <ul class="goals-list">${goalsHtml}</ul>
    ${nextPhase ? `<div class="next-phase">次の段階：${txt(nextPhase.title)}</div>` : ''}
  </div>

  <!-- エクササイズチェック欄 -->
  <div class="section" style="margin-bottom:0;">
    <div class="section-title">🏃 今取り組む運動（毎回チェック✓）</div>
    ${exercisesHtml}
  </div>
</div>

${redFlagsHtml}

<!-- メモ欄 -->
<div class="memo-area">
  <div class="section-title" style="margin-bottom:6px;">📝 担当者からのメモ・次回来院日</div>
  <div class="memo-line"></div>
  <div class="memo-line"></div>
  <div class="memo-line"></div>
</div>

<!-- フッター -->
<div class="footer">
  <span>ゆうき整骨院 — リハビリテーション指導シート</span>
  <span>${patient.name ?? ''} / ${today}</span>
</div>

<script>window.onload = () => window.print()</script>
</body>
</html>`

  const w = window.open('', '_blank')
  if (!w) return
  w.document.write(html)
  w.document.close()
}

export default function PatientView({ patient, protocol, assessments }: Props) {
  const [simpleMode, setSimpleMode] = useState(true)
  const currentPhase = protocol.phases[protocol.currentPhaseIndex]
  const encourage = PHASE_ENCOURAGEMENT[protocol.currentPhaseIndex] ?? { msg: 'よく頑張っています！', Icon: Activity }
  const progressPct = Math.round(((protocol.currentPhaseIndex + 0.5) / protocol.phases.length) * 100)
  // 受傷・手術からの経過日数（レンダー毎に呼ばれないよう useMemo で安定化）
  const daysSince = useMemo(() => {
    if (!patient.eventDate) return null
    // eslint-disable-next-line react-hooks/purity
    return Math.floor((Date.now() - new Date(patient.eventDate).getTime()) / 86400000)
  }, [patient.eventDate])

  function text(t: string) {
    return simpleMode ? simplify(t) : t
  }

  return (
    <div className="max-w-lg mx-auto space-y-4 font-body">
      {/* やさしい言葉切替 + 印刷ボタン */}
      <div className="flex items-center justify-between bg-[--color-surface-card] rounded-xl border border-slate-200 px-4 py-3 shadow-sm gap-3">
        <div className="flex items-center gap-2 flex-1">
          {simpleMode
            ? <Eye className="w-4 h-4 text-[--color-primary]" />
            : <EyeOff className="w-4 h-4 text-slate-400" />
          }
          <span className="text-sm font-semibold text-[--color-text-primary] font-display">
            やさしい言葉モード
          </span>
        </div>
        <button
          role="switch"
          aria-checked={simpleMode}
          onClick={() => setSimpleMode(v => !v)}
          className={`relative w-11 h-6 rounded-full transition-colors duration-200 focus-visible:ring-2
            focus-visible:ring-[--color-primary] focus-visible:ring-offset-2 flex-shrink-0
            ${simpleMode ? 'bg-[--color-primary]' : 'bg-slate-300'}`}
        >
          <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform duration-200
            ${simpleMode ? 'translate-x-5' : 'translate-x-0.5'}`} />
        </button>

        {/* 印刷ボタン */}
        <button
          onClick={() => printPatientSheet(patient, protocol, simpleMode, daysSince)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-teal-600 text-white text-xs font-semibold
            rounded-lg hover:bg-teal-700 transition-colors shadow-sm flex-shrink-0 font-display"
          title="リハビリシートを印刷"
        >
          <Printer className="w-3.5 h-3.5" />
          印刷
        </button>
      </div>

      {/* ヒーローバナー */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[--color-navy] via-[--color-navy-800] to-teal-900 p-5 text-white">
        {/* 装飾 */}
        <div className="absolute -right-8 -top-8 w-40 h-40 rounded-full bg-white/5" />
        <div className="absolute right-4 bottom-0 w-20 h-20 rounded-full bg-[--color-primary]/20" />

        <div className="relative">
          <div className="text-xs text-white/60 font-display uppercase tracking-widest mb-1">
            リハビリプロトコル
          </div>
          <div className="text-2xl font-bold font-display mb-0.5">
            {patient.name ?? '患者さん'} のリハビリ
          </div>
          <div className="text-sm text-white/80 font-body">{text(protocol.title)}</div>

          {daysSince !== null && (
            <div className="flex items-center gap-2 mt-3 bg-white/10 rounded-xl px-3 py-2 w-fit">
              <Flame className="w-4 h-4 text-[--color-accent]" />
              <span className="text-sm font-body">
                受傷 / 手術から
                <strong className="metric ml-1.5 text-white">
                  {daysSince} 日目
                </strong>
              </span>
            </div>
          )}
        </div>
      </div>

      {/* 励ましメッセージ */}
      <div className="flex items-center gap-3 bg-gradient-to-r from-orange-50 to-amber-50
        border border-[--color-accent-mid]/40 rounded-xl px-4 py-3.5">
        <div className="w-9 h-9 rounded-lg bg-[--color-accent]/10 flex items-center justify-center flex-shrink-0">
          <encourage.Icon className="w-5 h-5 text-[--color-accent]" />
        </div>
        <p className="text-sm text-orange-900 font-body leading-relaxed">{encourage.msg}</p>
      </div>

      {/* 現在のフェーズカード */}
      {currentPhase && (
        <div className="bg-[--color-surface-card] rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
          {/* フェーズヘッダー */}
          <div className="flex items-start gap-3">
            <span className="w-8 h-8 rounded-full bg-[--color-primary] text-white flex items-center
              justify-center text-sm font-bold flex-shrink-0 font-display">
              {currentPhase.order}
            </span>
            <div>
              <div className="text-[10px] text-[--color-text-muted] font-display uppercase tracking-widest">
                今いる段階
              </div>
              <div className="font-bold text-[--color-text-primary] font-display text-base leading-tight">
                {text(currentPhase.title)}
              </div>
            </div>
          </div>

          {/* 目標リスト */}
          {currentPhase.goals.length > 0 && (
            <div>
              <div className="text-xs font-bold text-[--color-text-secondary] font-display uppercase tracking-widest mb-2">
                今の目標
              </div>
              <ul className="space-y-1.5">
                {currentPhase.goals.map((g, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-[--color-text-primary] font-body">
                    <Star className="w-3.5 h-3.5 text-[--color-accent] flex-shrink-0 mt-0.5" />
                    {text(g)}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* 全体プログレス */}
          <div className="bg-[--color-surface-raised] rounded-xl px-4 py-3">
            <div className="flex justify-between text-xs text-[--color-text-secondary] mb-2 font-body">
              <span>全体の進み具合</span>
              <span className="metric font-semibold">
                フェーズ {protocol.currentPhaseIndex + 1} / {protocol.phases.length}
              </span>
            </div>
            <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-[--color-primary] to-[--color-primary-mid] rounded-full transition-all duration-700"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            {/* フェーズドット */}
            <div className="flex justify-between mt-1.5 px-0.5">
              {protocol.phases.map((_, i) => (
                <div key={i} className={`w-1.5 h-1.5 rounded-full transition-all ${
                  i < protocol.currentPhaseIndex
                    ? 'bg-[--color-primary]'
                    : i === protocol.currentPhaseIndex
                      ? 'bg-[--color-primary] scale-125'
                      : 'bg-slate-200'
                }`} />
              ))}
            </div>
          </div>

          {protocol.phases[protocol.currentPhaseIndex + 1] && (
            <div className="text-xs text-[--color-text-muted] font-body">
              次の段階：{text(protocol.phases[protocol.currentPhaseIndex + 1].title)}
            </div>
          )}
        </div>
      )}

      {/* エクササイズ */}
      {currentPhase && currentPhase.exercises.length > 0 && (
        <div className="bg-[--color-surface-card] rounded-2xl border border-slate-200 p-5 shadow-sm">
          <div className="text-xs font-bold text-[--color-text-secondary] font-display uppercase tracking-widest mb-3">
            今取り組む運動
          </div>
          <div className="space-y-2">
            {currentPhase.exercises.slice(0, 5).map((ex, i) => (
              <div key={i} className="flex items-center gap-3 bg-[--color-surface-raised] rounded-xl px-3 py-2.5">
                <span className="w-6 h-6 rounded-full bg-[--color-primary-light] text-[--color-primary-hover]
                  flex items-center justify-center text-xs font-bold flex-shrink-0 metric">
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-[--color-text-primary] font-display">{ex.name}</div>
                  {ex.dose && <div className="metric text-xs text-[--color-text-muted]">{ex.dose}</div>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 進捗グラフ */}
      {assessments.length > 0 && (
        <div className="bg-[--color-surface-card] rounded-2xl border border-slate-200 p-5 shadow-sm">
          <div className="text-xs font-bold text-[--color-text-secondary] font-display uppercase tracking-widest mb-3">
            回復の記録
          </div>
          <ProgressChart assessments={assessments} />
        </div>
      )}

      {/* マイルストーン */}
      <div className="bg-[--color-surface-card] rounded-2xl border border-slate-200 p-5 shadow-sm">
        <div className="text-xs font-bold text-[--color-text-secondary] font-display uppercase tracking-widest mb-3">
          目標マイルストーン
        </div>
        <MilestonePanel patientId={patient.id} simpleMode />
      </div>

      {/* 赤旗 */}
      {currentPhase && currentPhase.redFlags.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4">
          <div className="flex items-center gap-2 text-sm font-bold text-red-700 font-display mb-2">
            <ShieldAlert className="w-4 h-4" />こんなときはすぐ相談を
          </div>
          <ul className="space-y-1">
            {currentPhase.redFlags.map((r, i) => (
              <li key={i} className="text-sm text-red-800 font-body flex items-start gap-1.5">
                <span className="text-red-400 font-bold flex-shrink-0">·</span>
                {r}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 免責 */}
      <div className="text-xs text-[--color-text-muted] text-center pb-4 font-body">
        このページはリハビリの支援情報です。最終判断は担当の先生・療法士に相談してください。
      </div>
    </div>
  )
}
