'use client'

import { useState, useEffect } from 'react'
import type { RehabCase, VideoComment, EvaluationResult, AISummary } from '@/types/rehab'
import { MOVEMENT_TYPE_LABELS } from '@/types/rehab'
import { getComments, getAllEvaluations, getAISummaries } from '@/lib/rehab-store'
import { Printer, Share2, Copy, Check, ChevronDown, ChevronUp, Bot } from 'lucide-react'

interface Props { case_: RehabCase }

interface AIParsed {
  observations: string[]
  problems: string[]
  risks: string[]
  improvements: string[]
  recovery: string[]
  rawSections: { heading: string; body: string }[]
}

function parseAISummary(text: string): AIParsed {
  const result: AIParsed = { observations: [], problems: [], risks: [], improvements: [], recovery: [], rawSections: [] }
  if (!text) return result
  const chunks = text.split(/\n(?=##\s)/)
  for (const chunk of chunks) {
    const lines = chunk.trim().split('\n')
    const heading = lines[0].replace(/^#+\s*/, '').trim()
    const body = lines.slice(1).join('\n').trim()
    if (!heading) continue
    result.rawSections.push({ heading, body })
    const items = body
      .split('\n')
      .map((l) => l.replace(/^[-・*＊#>\s]+/, '').replace(/\*\*/g, '').trim())
      .filter((l) => l.length > 8 && !l.startsWith('##'))
      .slice(0, 4)
    if (/観察|所見|overview|動作確認/.test(heading)) result.observations.push(...items)
    else if (/問題|課題|気になる|特徴/.test(heading)) result.problems.push(...items)
    else if (/リスク|怪我|合併|予測|注意/.test(heading)) result.risks.push(...items)
    else if (/介入|推奨|改善|アドバイス|提案|トレーニング|エクサ/.test(heading)) result.improvements.push(...items)
    else if (/復帰|見解|ゴール/.test(heading)) result.recovery.push(...items)
    else {
      const lower = body.toLowerCase()
      if (/リスク|危険|注意|再受傷/.test(lower)) result.risks.push(...items)
      else if (/改善|推奨|運動/.test(lower)) result.improvements.push(...items)
      else result.observations.push(...items)
    }
  }
  return result
}

function scoreFromAI(parsed: AIParsed): number {
  const issues = parsed.problems.length + parsed.risks.length * 1.5
  const positive = parsed.observations.filter((s) => /良好|できて|安定|適切|正常/.test(s)).length
  return Math.max(20, Math.min(95, Math.round(80 - issues * 6 + positive * 4)))
}

function computeScore(comments: VideoComment[], evals: EvaluationResult[]): number {
  let score = 80
  const sevWeight: Record<string, number> = { severe: 15, moderate: 8, mild: 3, none: 0 }
  evals.forEach((ev) => ev.items.forEach((it) => { if (it.checked) score -= (sevWeight[it.severity] ?? 0) }))
  score -= comments.filter((c) => c.type === 'risk').length * 8
  score -= comments.filter((c) => c.type === 'problem').length * 4
  score += comments.filter((c) => c.type === 'positive').length * 3
  return Math.max(5, Math.min(100, Math.round(score)))
}

function LineIcon() {
  return (
    <svg viewBox="0 0 48 48" className="w-4 h-4 fill-current" xmlns="http://www.w3.org/2000/svg">
      <path d="M24 4C13 4 4 11.8 4 21.4c0 8.2 6.6 15.1 15.7 16.8l1.3 6.8 5.8-5.4c.4 0 .8.1 1.2.1 11 0 20-7.8 20-17.4S35 4 24 4zm-8 22H12v-9h2v7h2v2zm4 0h-2v-9h2v9zm8 0h-2l-4-6v6h-2v-9h2l4 6v-6h2v9zm6-7h-3v2h3v2h-3v2h3v2h-5v-9h5v1z" />
    </svg>
  )
}

// スコアリング表示（バッジ形式）
function ScoreBadge({ score }: { score: number }) {
  const color = score >= 75 ? '#16a34a' : score >= 50 ? '#d97706' : score >= 30 ? '#ea580c' : '#dc2626'
  const bg    = score >= 75 ? '#f0fdf4' : score >= 50 ? '#fffbeb' : score >= 30 ? '#fff7ed' : '#fef2f2'
  const label = score >= 75 ? '良好' : score >= 50 ? '要注意' : score >= 30 ? '要改善' : '要精査'
  const pct   = score / 100
  const r = 52, cx = 70, cy = 70
  const circ = 2 * Math.PI * r
  const dash  = circ * pct
  const gap   = circ - dash
  return (
    <div className="flex flex-col items-center">
      <svg width="140" height="140" viewBox="0 0 140 140">
        {/* 背景リング */}
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#e5e7eb" strokeWidth="10" />
        {/* 進捗リング */}
        <circle
          cx={cx} cy={cy} r={r}
          fill="none"
          stroke={color}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${gap}`}
          strokeDashoffset={circ * 0.25}
          transform="rotate(0 70 70)"
          style={{ transition: 'stroke-dasharray 0.8s ease' }}
        />
        {/* 内側背景 */}
        <circle cx={cx} cy={cy} r="42" fill={bg} />
        {/* スコア数値 */}
        <text x={cx} y={cy - 8} textAnchor="middle" fontSize="28" fontWeight="800" fill={color}>{score}</text>
        <text x={cx} y={cy + 8} textAnchor="middle" fontSize="11" fill="#9ca3af">/ 100</text>
        <text x={cx} y={cy + 24} textAnchor="middle" fontSize="12" fontWeight="700" fill={color}>{label}</text>
      </svg>
      <p className="text-xs text-gray-500 -mt-1">総合評価スコア</p>
    </div>
  )
}

// レーダーチャート
function RadarChart({ data }: { data: { label: string; value: number }[] }) {
  const size = 180; const cx = size / 2; const cy = size / 2; const r = 65; const n = data.length
  if (n < 3) return null
  function pt(i: number, radius: number) {
    const angle = (i / n) * 2 * Math.PI - Math.PI / 2
    return { x: cx + radius * Math.cos(angle), y: cy + radius * Math.sin(angle) }
  }
  const dataPolygon = data.map((d, i) => { const p = pt(i, r * (d.value / 100)); return `${p.x},${p.y}` }).join(' ')
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {[0.25, 0.5, 0.75, 1.0].map((lv) => {
        const pts = data.map((_, i) => { const p = pt(i, r * lv); return `${p.x},${p.y}` }).join(' ')
        return <polygon key={lv} points={pts} fill="none" stroke="#f0f0f0" strokeWidth="1" />
      })}
      {data.map((_, i) => { const end = pt(i, r); return <line key={i} x1={cx} y1={cy} x2={end.x} y2={end.y} stroke="#e5e7eb" strokeWidth="1" /> })}
      <polygon points={dataPolygon} fill="rgba(13,148,136,0.12)" stroke="#0d9488" strokeWidth="2.5" strokeLinejoin="round" />
      {data.map((d, i) => { const p = pt(i, r * (d.value / 100)); return <circle key={i} cx={p.x} cy={p.y} r="4" fill="#0d9488" /> })}
      {data.map((d, i) => { const p = pt(i, r + 18); return <text key={i} x={p.x} y={p.y} textAnchor="middle" dominantBaseline="middle" fontSize="9.5" fill="#4b5563" fontWeight="500">{d.label}</text> })}
    </svg>
  )
}

// 重症度バー
function SeverityBar({ label, severity, note }: { label: string; severity: string; note?: string }) {
  const levels: Record<string, number> = { none: 0, mild: 1, moderate: 2, severe: 3 }
  const colors = ['#d1d5db', '#fbbf24', '#f97316', '#ef4444']
  const lbls = ['なし', '軽度', '中等度', '重度']
  const lv = levels[severity] ?? 0
  return (
    <div className="flex items-center gap-2 py-1 border-b border-gray-50 last:border-0">
      <span className="text-xs text-gray-600 w-36 flex-shrink-0 leading-tight">{label}</span>
      <div className="flex gap-0.5 flex-shrink-0">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="w-5 h-2 rounded-sm" style={{ backgroundColor: i <= lv ? colors[lv] : '#e5e7eb' }} />
        ))}
      </div>
      <span className="text-xs font-semibold w-12" style={{ color: lv > 0 ? colors[lv] : '#9ca3af' }}>{lbls[lv]}</span>
      {note && <span className="text-xs text-gray-400 truncate">{note}</span>}
    </div>
  )
}

// ステータス数値カード
function StatCard({ value, label, color, bg, icon }: { value: number; label: string; color: string; bg: string; icon: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl p-3 gap-1" style={{ backgroundColor: bg }}>
      <span className="text-xl">{icon}</span>
      <span className="text-2xl font-black" style={{ color }}>{value}</span>
      <span className="text-xs text-gray-500 font-medium text-center leading-tight">{label}</span>
    </div>
  )
}

export default function PatientReport({ case_: c }: Props) {
  const [allComments, setAllComments] = useState<VideoComment[]>([])
  const [allEvals, setAllEvals] = useState<EvaluationResult[]>([])
  const [aiSummaries, setAiSummaries] = useState<AISummary[]>([])
  const [copied, setCopied] = useState(false)
  const [expandAIRaw, setExpandAIRaw] = useState(false)

  const now = new Date().toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' })

  useEffect(() => {
    const comments: VideoComment[] = []
    const summaries: AISummary[] = []
    c.videos.forEach((v) => {
      comments.push(...getComments(v.id))
      summaries.push(...getAISummaries(v.id))
    })
    setAllComments(comments)
    setAllEvals(getAllEvaluations(c.id))
    summaries.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    setAiSummaries(summaries)
  }, [c])

  const problemComments  = allComments.filter((cm) => cm.type === 'problem')
  const riskComments     = allComments.filter((cm) => cm.type === 'risk')
  const improvComments   = allComments.filter((cm) => cm.type === 'improvement')
  const positiveComments = allComments.filter((cm) => cm.type === 'positive')
  const hasManual = allComments.length > 0 || allEvals.length > 0

  const latestAI = aiSummaries[0] ?? null
  const aiParsed: AIParsed | null = latestAI ? parseAISummary(latestAI.summary) : null
  const hasAI = !!aiParsed && (
    aiParsed.problems.length + aiParsed.risks.length + aiParsed.improvements.length + aiParsed.observations.length > 0
  )

  const score = hasManual
    ? computeScore(allComments, allEvals)
    : hasAI ? scoreFromAI(aiParsed!) : 80

  const displayPositive = positiveComments.length > 0
    ? positiveComments.map((cm) => ({ text: cm.text, fromAI: false }))
    : (aiParsed?.observations ?? []).filter((s) => /良好|できて|安定|適切|正常|維持/.test(s)).map((s) => ({ text: s, fromAI: true }))

  const displayProblems = problemComments.length > 0
    ? problemComments.map((cm) => ({ text: cm.text, fromAI: false }))
    : (aiParsed?.problems ?? []).map((s) => ({ text: s, fromAI: true }))

  const displayRisks = riskComments.length > 0
    ? riskComments.map((cm) => ({ text: cm.text, fromAI: false }))
    : (aiParsed?.risks ?? []).map((s) => ({ text: s, fromAI: true }))

  const displayImprov = improvComments.length > 0
    ? improvComments.map((cm) => ({ text: cm.text, fromAI: false }))
    : [
        ...(aiParsed?.improvements ?? []),
        ...(aiParsed?.recovery ?? []),
      ].map((s) => ({ text: s, fromAI: true }))

  const priorityItems: { text: string; type: 'risk' | 'problem' | 'improvement'; fromAI: boolean }[] = [
    ...displayRisks.slice(0, 2).map((x) => ({ ...x, type: 'risk' as const })),
    ...displayProblems.slice(0, 2).map((x) => ({ ...x, type: 'problem' as const })),
    ...displayImprov.slice(0, 2).map((x) => ({ ...x, type: 'improvement' as const })),
  ].slice(0, 5)

  const severeItems = allEvals.flatMap((ev) =>
    ev.items.filter((it) => it.checked && it.severity !== '' && it.severity !== 'none').map((it) => ({ ...it }))
  )

  const movTypes = [...new Set(c.videos.map((v) => v.movementType))]
  const radarData = movTypes.slice(0, 6).map((mt) => {
    const vid = c.videos.find((v) => v.movementType === mt)
    if (!vid) return { label: MOVEMENT_TYPE_LABELS[mt] ?? mt, value: 70 }
    const rel = allComments.filter((cm) => cm.videoId === vid.id)
    const neg = rel.filter((cm) => cm.type === 'problem' || cm.type === 'risk').length
    const pos = rel.filter((cm) => cm.type === 'positive').length
    const aiProb = aiParsed ? aiParsed.problems.length + aiParsed.risks.length : 0
    const val = hasManual
      ? Math.max(20, Math.min(100, 100 - neg * 18 + pos * 10))
      : Math.max(20, Math.min(95, 80 - aiProb * 5))
    return { label: MOVEMENT_TYPE_LABELS[mt] ?? mt, value: val }
  })

  const hasContent = hasManual || hasAI

  function buildShareText() {
    const lines = [
      `【動作分析レポート】${now}`,
      `診断: ${c.diagnosis} / ${c.injuredPart}`,
      `総合スコア: ${score}/100`,
      '',
    ]
    if (displayPositive.length) {
      lines.push('✅ 良好な点')
      displayPositive.forEach((x) => lines.push(`・${x.text}`))
      lines.push('')
    }
    if (priorityItems.length) {
      lines.push('🎯 優先改善アクション')
      priorityItems.forEach((item, i) => lines.push(`${i + 1}. ${item.text}`))
      lines.push('')
    }
    if (displayRisks.length) {
      lines.push('🔴 注意事項')
      displayRisks.forEach((x) => lines.push(`▲ ${x.text}`))
      lines.push('')
    }
    lines.push('※本レポートは動作分析の補助情報です。治療方針は担当専門家の指示に従ってください。')
    lines.push('YUUKI MOTION LAB 動作解析サービス')
    return lines.join('\n')
  }

  function handleCopy() {
    navigator.clipboard.writeText(buildShareText()).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2500) })
  }
  function handleLine() {
    window.open(`https://social-plugins.line.me/lineit/share?url=&text=${encodeURIComponent(buildShareText())}`, '_blank', 'noopener,noreferrer,width=600,height=500')
  }
  function handlePrint() { window.print() }

  return (
    <>
      {/* ── ツールバー（印刷非表示） ── */}
      <div className="no-print flex items-center gap-2 flex-wrap mb-5 p-3 bg-white rounded-2xl border border-gray-200 shadow-sm">
        <div className="flex items-center gap-2">
          <Share2 className="w-4 h-4 text-[#0d9488]" />
          <span className="text-sm font-bold text-gray-800">患者様向け説明レポート</span>
          {hasAI && !hasManual && (
            <span className="flex items-center gap-1 text-xs text-purple-600 bg-purple-50 border border-purple-100 px-2 py-0.5 rounded-full">
              <Bot className="w-3 h-3" />AI所見から自動生成
            </span>
          )}
        </div>
        <div className="ml-auto flex gap-2 flex-wrap">
          <button onClick={handleLine} className="flex items-center gap-1.5 px-3 py-1.5 bg-[#06C755] hover:bg-[#05a847] text-white font-medium rounded-lg text-sm transition-colors">
            <LineIcon />LINEで送る
          </button>
          <button onClick={handleCopy} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${copied ? 'bg-green-500 text-white border-green-500' : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'}`}>
            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? 'コピーしました' : 'コピー'}
          </button>
          <button onClick={handlePrint} className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-900 hover:bg-gray-700 text-white rounded-lg text-sm font-medium transition-colors">
            <Printer className="w-3.5 h-3.5" />印刷
          </button>
        </div>
      </div>

      {/* ── レポート本体 ── */}
      <div id="patient-report-body" className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100">

        {/* ヘッダー */}
        <div style={{ background: 'linear-gradient(135deg, #0f2744 0%, #0d9488 100%)', padding: '28px 32px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px' }}>
            <div>
              <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: '6px' }}>
                Motion Analysis Report
              </p>
              <h1 style={{ color: '#ffffff', fontSize: '22px', fontWeight: '800', letterSpacing: '0.05em', margin: 0 }}>
                動作分析レポート
              </h1>
              <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: '13px', marginTop: '4px' }}>患者様ご説明用</p>
            </div>
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: '11px', marginBottom: '4px' }}>{now}</p>
              <p style={{ color: '#5eead4', fontSize: '14px', fontWeight: '700', letterSpacing: '0.05em' }}>YUUKI MOTION LAB</p>
            </div>
          </div>

          {/* 患者情報バー */}
          <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid rgba(255,255,255,0.15)', display: 'flex', flexWrap: 'wrap', gap: '24px' }}>
            {[
              { label: '診断名', value: c.diagnosis },
              { label: '評価部位', value: c.injuredPart },
              { label: '評価目的', value: c.evaluationPurpose },
            ].map(({ label, value }) => (
              <div key={label}>
                <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: '3px' }}>{label}</p>
                <p style={{ color: '#ffffff', fontSize: '13px', fontWeight: '600', margin: 0 }}>{value}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="p-6 sm:p-8 space-y-6">

          {/* ── ① スコアエリア ── */}
          <div className="flex flex-col sm:flex-row items-center gap-6 bg-gray-50 rounded-2xl p-5">
            <ScoreBadge score={score} />
            <div className="flex-1 w-full space-y-3">
              <div className="grid grid-cols-4 gap-2">
                <StatCard value={displayPositive.length}  label="良好な点"  color="#16a34a" bg="#f0fdf4" icon="✅" />
                <StatCard value={displayProblems.length}  label="気になる点" color="#d97706" bg="#fffbeb" icon="⚠️" />
                <StatCard value={displayImprov.length}    label="改善提案"  color="#2563eb" bg="#eff6ff" icon="🎯" />
                <StatCard value={displayRisks.length}     label="注意事項"  color="#dc2626" bg="#fef2f2" icon="🔴" />
              </div>
              {c.videos.length > 0 && (
                <div>
                  <p className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-1.5">評価した動作</p>
                  <div className="flex flex-wrap gap-1.5">
                    {c.videos.map((v) => (
                      <span key={v.id} className="text-xs px-2.5 py-1 bg-white border border-gray-200 text-gray-600 rounded-full shadow-sm">
                        {MOVEMENT_TYPE_LABELS[v.movementType]} — {v.label}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* データなし */}
          {!hasContent && (
            <div className="text-center py-12 text-gray-400 border-2 border-dashed border-gray-200 rounded-2xl">
              <p className="text-sm font-semibold mb-1">データがまだ記録されていません</p>
              <p className="text-xs">動画分析ページで「AI解析」を実行するか、コメント・評価を入力してください</p>
            </div>
          )}

          {hasContent && (
            <>
              {/* ── ② グラフエリア ── */}
              {(radarData.length >= 3 || severeItems.length > 0) && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {radarData.length >= 3 && (
                    <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
                      <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">動作別評価バランス</p>
                      <div className="flex justify-center"><RadarChart data={radarData} /></div>
                      <p className="text-xs text-gray-400 text-center mt-1">外側ほど良好 / 内側ほど改善が必要</p>
                    </div>
                  )}
                  {severeItems.length > 0 && (
                    <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
                      <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">チェックポイント別重症度</p>
                      <div className="divide-y divide-gray-50">
                        {severeItems.slice(0, 10).map((it, i) => <SeverityBar key={i} label={it.label} severity={it.severity} note={it.note} />)}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ── ③ 良好な点 ── */}
              {displayPositive.length > 0 && (
                <section>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-1 h-6 bg-green-500 rounded-full" />
                    <h3 className="text-sm font-bold text-gray-900">✅ 良好な点</h3>
                    <p className="text-xs text-gray-400">現在できていること</p>
                    {displayPositive[0].fromAI && <span className="flex items-center gap-1 text-xs text-purple-500 bg-purple-50 border border-purple-100 px-2 py-0.5 rounded-full"><Bot className="w-2.5 h-2.5" />AI所見</span>}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {displayPositive.map((x, i) => (
                      <div key={i} style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '12px', padding: '12px 14px', display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                        <span style={{ width: '20px', height: '20px', borderRadius: '50%', background: '#16a34a', color: '#fff', fontSize: '11px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '1px' }}>✓</span>
                        <p style={{ fontSize: '13px', color: '#14532d', lineHeight: '1.6', margin: 0 }}>{x.text}</p>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* ── ④ 優先改善アクション ── */}
              {priorityItems.length > 0 && (
                <section>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-1 h-6 bg-blue-500 rounded-full" />
                    <h3 className="text-sm font-bold text-gray-900">🎯 優先改善アクション</h3>
                    <p className="text-xs text-gray-400">今すぐ意識してほしいこと</p>
                  </div>
                  <div className="space-y-2">
                    {priorityItems.map((item, i) => {
                      const cfg = {
                        risk:        { bg: '#fef2f2', border: '#fecaca', circle: '#dc2626', text: '#7f1d1d' },
                        problem:     { bg: '#fffbeb', border: '#fde68a', circle: '#d97706', text: '#78350f' },
                        improvement: { bg: '#eff6ff', border: '#bfdbfe', circle: '#2563eb', text: '#1e3a8a' },
                      }[item.type]
                      return (
                        <div key={i} style={{ background: cfg.bg, border: `1px solid ${cfg.border}`, borderRadius: '12px', padding: '12px 14px', display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                          <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: cfg.circle, color: '#fff', fontSize: '11px', fontWeight: '800', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{i + 1}</div>
                          <p style={{ fontSize: '13px', color: cfg.text, lineHeight: '1.6', margin: 0, flex: 1 }}>{item.text}</p>
                          {item.fromAI && <span style={{ fontSize: '10px', color: '#7c3aed', background: '#f5f3ff', border: '1px solid #ddd6fe', padding: '2px 6px', borderRadius: '999px', flexShrink: 0, whiteSpace: 'nowrap' }}>AI</span>}
                        </div>
                      )
                    })}
                  </div>
                </section>
              )}

              {/* ── ⑤ 気になる動作 ── */}
              {displayProblems.length > 0 && (
                <section>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-1 h-6 bg-amber-500 rounded-full" />
                    <h3 className="text-sm font-bold text-gray-900">⚠️ 気になる動作の特徴</h3>
                    <p className="text-xs text-gray-400">専門家・AIが観察した課題</p>
                  </div>
                  <div className="space-y-2">
                    {displayProblems.map((x, i) => (
                      <div key={i} style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '12px', padding: '12px 14px', display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                        <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#f59e0b', flexShrink: 0, marginTop: '5px' }} />
                        <p style={{ fontSize: '13px', color: '#78350f', lineHeight: '1.6', margin: 0 }}>{x.text}</p>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* ── ⑥ 注意事項 ── */}
              {displayRisks.length > 0 && (
                <section>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-1 h-6 bg-red-500 rounded-full" />
                    <h3 className="text-sm font-bold text-gray-900">🔴 重要な注意事項</h3>
                    <p className="text-xs text-gray-400">再受傷・悪化を防ぐために</p>
                  </div>
                  <div className="space-y-2">
                    {displayRisks.map((x, i) => (
                      <div key={i} style={{ background: '#fef2f2', border: '1px solid #fecaca', borderLeft: '4px solid #ef4444', borderRadius: '0 12px 12px 0', padding: '12px 14px', display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                        <span style={{ color: '#dc2626', fontWeight: '700', fontSize: '14px', flexShrink: 0 }}>▲</span>
                        <p style={{ fontSize: '13px', color: '#7f1d1d', lineHeight: '1.6', fontWeight: '500', margin: 0 }}>{x.text}</p>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* ── ⑦ AI所見全文（画面のみ・折りたたみ） ── */}
              {latestAI && (
                <div className="no-print">
                  <button onClick={() => setExpandAIRaw(!expandAIRaw)}
                    className="flex items-center gap-2 w-full bg-purple-50 border border-purple-200 rounded-2xl px-4 py-3 text-left hover:bg-purple-100 transition-colors">
                    <Bot className="w-4 h-4 text-purple-500 flex-shrink-0" />
                    <span className="text-sm font-bold text-purple-800 flex-1">AI所見全文（{latestAI.createdAt.slice(0, 10)}）</span>
                    {expandAIRaw ? <ChevronUp className="w-4 h-4 text-purple-400" /> : <ChevronDown className="w-4 h-4 text-purple-400" />}
                  </button>
                  {expandAIRaw && (
                    <div className="mt-2 bg-purple-50 border border-purple-200 rounded-2xl p-5">
                      <p className="text-xs text-purple-400 mb-3">※AIによる参考情報。最終判断は専門家が行います。</p>
                      <p className="text-xs text-gray-700 leading-relaxed whitespace-pre-line">{latestAI.summary}</p>
                    </div>
                  )}
                </div>
              )}

              {/* ── ⑧ 印刷版AI全文 ── */}
              {latestAI && (
                <div className="hidden print:block">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-1 h-6 bg-purple-500 rounded-full" />
                    <h3 className="text-sm font-bold text-gray-900">🤖 AI動作解析所見（詳細）</h3>
                  </div>
                  <div style={{ background: '#faf5ff', border: '1px solid #e9d5ff', borderRadius: '12px', padding: '16px' }}>
                    <p style={{ fontSize: '11px', color: '#4b5563', lineHeight: '1.8', whiteSpace: 'pre-line', margin: 0 }}>
                      {latestAI.summary.slice(0, 1200)}{latestAI.summary.length > 1200 ? '…' : ''}
                    </p>
                  </div>
                </div>
              )}
            </>
          )}

          {/* ── フッター ── */}
          <div style={{ borderTop: '1px solid #f3f4f6', paddingTop: '20px' }}>
            {hasAI && !hasManual && (
              <div style={{ background: '#faf5ff', border: '1px solid #e9d5ff', borderRadius: '12px', padding: '12px 16px', marginBottom: '12px', display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                <Bot className="w-4 h-4 text-purple-500 flex-shrink-0 mt-0.5" />
                <p style={{ fontSize: '11px', color: '#5b21b6', lineHeight: '1.6', margin: 0 }}>
                  このレポートはAI動作解析所見（{latestAI?.createdAt.slice(0, 10)}）を元に自動生成されています。
                </p>
              </div>
            )}
            <div style={{ background: '#f9fafb', borderRadius: '12px', padding: '16px', display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
              <span style={{ fontSize: '20px', flexShrink: 0 }}>📋</span>
              <div>
                <p style={{ fontSize: '11px', fontWeight: '700', color: '#374151', marginBottom: '4px' }}>ご注意事項</p>
                <p style={{ fontSize: '10px', color: '#6b7280', lineHeight: '1.7', margin: 0 }}>
                  本レポートは動作分析システムによる補助情報として作成されたものです。記載内容は確定的な診断・治療方針を示すものではありません。治療方針・競技復帰の最終判断は担当医師・理学療法士の指示に従ってください。
                </p>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px', padding: '0 4px' }}>
              <p style={{ fontSize: '10px', color: '#9ca3af', margin: 0 }}>YUUKI MOTION LAB 動作解析サービス</p>
              <p style={{ fontSize: '10px', color: '#9ca3af', margin: 0 }}>{now} 作成</p>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        /* ── 印刷スタイル ── */
        @media print {
          /* すべての要素を非表示にしてからレポートだけ表示 */
          body * {
            visibility: hidden !important;
          }
          #patient-report-body,
          #patient-report-body * {
            visibility: visible !important;
          }
          #patient-report-body {
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            width: 100% !important;
            background: #ffffff !important;
            box-shadow: none !important;
            border: none !important;
            border-radius: 0 !important;
            overflow: visible !important;
          }
          /* 背景色を強制印刷 */
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          /* 印刷非表示クラス */
          .no-print {
            display: none !important;
            visibility: hidden !important;
          }
          /* 印刷専用表示 */
          .hidden.print\\:block {
            display: block !important;
            visibility: visible !important;
          }
        }
        @page {
          size: A4;
          margin: 10mm 12mm;
        }
      `}</style>
    </>
  )
}
