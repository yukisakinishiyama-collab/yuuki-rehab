'use client'

import { useState, useEffect, useRef } from 'react'
import type { RehabCase, VideoComment, EvaluationResult, AISummary } from '@/types/rehab'
import { MOVEMENT_TYPE_LABELS } from '@/types/rehab'
import { getComments, getAllEvaluations, getAISummaries } from '@/lib/rehab-store'
import { Printer, Share2, Copy, Check, ChevronDown, ChevronUp, Bot } from 'lucide-react'

interface Props { case_: RehabCase }

// ── AI所見テキストをセクション別に解析 ────────────────────────────────────────
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

  // ## 見出しで分割
  const chunks = text.split(/\n(?=##\s)/)
  for (const chunk of chunks) {
    const lines = chunk.trim().split('\n')
    const heading = lines[0].replace(/^#+\s*/, '').trim()
    const body = lines.slice(1).join('\n').trim()
    if (!heading) continue

    result.rawSections.push({ heading, body })

    // 箇条書きや段落から意味ある行を抽出
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
      // 分類できないセクションはキーワードで判定
      const lower = body.toLowerCase()
      if (/リスク|危険|注意|再受傷/.test(lower)) result.risks.push(...items)
      else if (/改善|推奨|運動/.test(lower)) result.improvements.push(...items)
      else result.observations.push(...items)
    }
  }
  return result
}

// AI由来スコアを推定（問題数・リスク数から）
function scoreFromAI(parsed: AIParsed): number {
  const issues = parsed.problems.length + parsed.risks.length * 1.5
  const positive = parsed.observations.filter((s) => /良好|できて|安定|適切|正常/.test(s)).length
  return Math.max(20, Math.min(95, Math.round(80 - issues * 6 + positive * 4)))
}

// ── LINE icon ─────────────────────────────────────────────────────────────────
function LineIcon() {
  return (
    <svg viewBox="0 0 48 48" className="w-5 h-5 fill-current" xmlns="http://www.w3.org/2000/svg">
      <path d="M24 4C13 4 4 11.8 4 21.4c0 8.2 6.6 15.1 15.7 16.8l1.3 6.8 5.8-5.4c.4 0 .8.1 1.2.1 11 0 20-7.8 20-17.4S35 4 24 4zm-8 22H12v-9h2v7h2v2zm4 0h-2v-9h2v9zm8 0h-2l-4-6v6h-2v-9h2l4 6v-6h2v9zm6-7h-3v2h3v2h-3v2h3v2h-5v-9h5v1z" />
    </svg>
  )
}

// ── スコアゲージ（半円） ────────────────────────────────────────────────────────
function ScoreGauge({ score, size = 130 }: { score: number; size?: number }) {
  const r = size * 0.38
  const cx = size / 2
  const cy = size * 0.55
  const color = score >= 75 ? '#22c55e' : score >= 50 ? '#f59e0b' : score >= 30 ? '#f97316' : '#ef4444'
  const label = score >= 75 ? '良好' : score >= 50 ? '要注意' : score >= 30 ? '要改善' : '要精査'
  const trackD = `M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`
  function arcPath(pct: number) {
    const ang = pct * Math.PI
    const ex = cx - r * Math.cos(ang)
    const ey = cy - r * Math.sin(ang)
    return `M ${cx - r} ${cy} A ${r} ${r} 0 ${pct > 0.5 ? 1 : 0} 1 ${ex} ${ey}`
  }
  return (
    <svg width={size} height={size * 0.65} viewBox={`0 0 ${size} ${size * 0.65}`} style={{ overflow: 'visible' }}>
      <path d={trackD} fill="none" stroke="#e5e7eb" strokeWidth={size * 0.08} strokeLinecap="round" />
      <path d={arcPath(score / 100)} fill="none" stroke={color} strokeWidth={size * 0.08} strokeLinecap="round" />
      <text x={cx} y={cy - 4} textAnchor="middle" fontSize={size * 0.22} fontWeight="700" fill={color}>{score}</text>
      <text x={cx} y={cy + 12} textAnchor="middle" fontSize={size * 0.1} fill="#6b7280">/ 100</text>
      <text x={cx} y={cy + 26} textAnchor="middle" fontSize={size * 0.11} fontWeight="600" fill={color}>{label}</text>
    </svg>
  )
}

// ── レーダーチャート ────────────────────────────────────────────────────────────
function RadarChart({ data }: { data: { label: string; value: number }[] }) {
  const size = 170; const cx = size / 2; const cy = size / 2; const r = 58; const n = data.length
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
        return <polygon key={lv} points={pts} fill="none" stroke="#e5e7eb" strokeWidth={0.8} />
      })}
      {data.map((_, i) => { const end = pt(i, r); return <line key={i} x1={cx} y1={cy} x2={end.x} y2={end.y} stroke="#d1d5db" strokeWidth={0.8} /> })}
      <polygon points={dataPolygon} fill="rgba(13,148,136,0.18)" stroke="#0d9488" strokeWidth={2} strokeLinejoin="round" />
      {data.map((d, i) => { const p = pt(i, r * (d.value / 100)); return <circle key={i} cx={p.x} cy={p.y} r={3} fill="#0d9488" /> })}
      {data.map((d, i) => { const p = pt(i, r + 16); return <text key={i} x={p.x} y={p.y} textAnchor="middle" dominantBaseline="middle" fontSize={9} fill="#374151" fontWeight="500">{d.label}</text> })}
    </svg>
  )
}

// ── 重症度バー ─────────────────────────────────────────────────────────────────
function SeverityBar({ label, severity, note }: { label: string; severity: string; note?: string }) {
  const levels: Record<string, number> = { none: 0, mild: 1, moderate: 2, severe: 3 }
  const colors = ['#d1d5db', '#fbbf24', '#f97316', '#ef4444']
  const lbls = ['なし', '軽度', '中等度', '重度']
  const lv = levels[severity] ?? 0
  return (
    <div className="flex items-center gap-2 py-0.5">
      <span className="text-[10px] text-gray-600 w-32 flex-shrink-0 leading-tight">{label}</span>
      <div className="flex gap-0.5 flex-shrink-0">
        {[0, 1, 2, 3].map((i) => <div key={i} className="w-4 h-2.5 rounded-sm" style={{ backgroundColor: i <= lv ? colors[lv] : '#e5e7eb' }} />)}
      </div>
      <span className="text-[10px] font-medium" style={{ color: lv > 0 ? colors[lv] : '#9ca3af' }}>{lbls[lv]}</span>
      {note && <span className="text-[10px] text-gray-400 truncate max-w-[100px]">{note}</span>}
    </div>
  )
}

// ── カテゴリバッジ ─────────────────────────────────────────────────────────────
function CategoryBadge({ count, label, color, bg, icon }: { count: number; label: string; color: string; bg: string; icon: string }) {
  return (
    <div className={`flex flex-col items-center justify-center rounded-xl p-2 ${bg} border`} style={{ borderColor: `${color}40` }}>
      <span className="text-lg leading-none mb-0.5">{icon}</span>
      <span className="text-xl font-bold" style={{ color }}>{count}</span>
      <span className="text-[10px] font-medium text-gray-500 leading-tight text-center">{label}</span>
    </div>
  )
}

// ── 優先アクションカード ───────────────────────────────────────────────────────
function ActionCard({ num, text, type, fromAI }: { num: number; text: string; type: 'problem' | 'risk' | 'improvement'; fromAI?: boolean }) {
  const colors = {
    problem: { bg: 'bg-amber-50', border: 'border-amber-200', circle: 'bg-amber-500', text: 'text-amber-900' },
    risk:    { bg: 'bg-red-50',   border: 'border-red-200',   circle: 'bg-red-500',   text: 'text-red-900' },
    improvement: { bg: 'bg-blue-50', border: 'border-blue-200', circle: 'bg-blue-500', text: 'text-blue-900' },
  }
  const c = colors[type]
  return (
    <div className={`flex items-start gap-3 rounded-xl border p-3 ${c.bg} ${c.border}`}>
      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 mt-0.5 ${c.circle}`}>{num}</div>
      <div className="flex-1">
        <p className={`text-sm leading-relaxed ${c.text}`}>{text}</p>
        {fromAI && <span className="inline-flex items-center gap-0.5 text-[10px] text-purple-500 mt-1"><Bot className="w-2.5 h-2.5" />AI所見より</span>}
      </div>
    </div>
  )
}

// ── セクションタイトル ─────────────────────────────────────────────────────────
function SectionTitle({ color, icon, title, subtitle, fromAI }: { color: string; icon: string; title: string; subtitle: string; fromAI?: boolean }) {
  const bars: Record<string, string> = { green: 'bg-green-500', amber: 'bg-amber-500', blue: 'bg-blue-500', red: 'bg-red-500', purple: 'bg-purple-500' }
  return (
    <div className="flex items-center gap-2.5">
      <div className={`w-1 h-8 rounded-full flex-shrink-0 ${bars[color] ?? 'bg-gray-400'}`} />
      <div>
        <div className="flex items-center gap-2">
          <span className="text-base leading-none">{icon}</span>
          <h3 className="text-sm font-bold text-gray-900">{title}</h3>
          {fromAI && (
            <span className="inline-flex items-center gap-1 text-[10px] text-purple-500 bg-purple-50 border border-purple-200 px-1.5 py-0.5 rounded-full">
              <Bot className="w-2.5 h-2.5" />AI所見より
            </span>
          )}
        </div>
        <p className="text-[11px] text-gray-500 ml-6">{subtitle}</p>
      </div>
    </div>
  )
}

// ── スコア計算（手動コメント） ─────────────────────────────────────────────────
function computeScore(comments: VideoComment[], evals: EvaluationResult[]): number {
  let score = 80
  const sevWeight: Record<string, number> = { severe: 15, moderate: 8, mild: 3, none: 0 }
  evals.forEach((ev) => ev.items.forEach((it) => { if (it.checked) score -= (sevWeight[it.severity] ?? 0) }))
  score -= comments.filter((c) => c.type === 'risk').length * 8
  score -= comments.filter((c) => c.type === 'problem').length * 4
  score += comments.filter((c) => c.type === 'positive').length * 3
  return Math.max(5, Math.min(100, Math.round(score)))
}

// ═══════════════════════════════════════════════════════════════════════════════
export default function PatientReport({ case_: c }: Props) {
  const [allComments, setAllComments] = useState<VideoComment[]>([])
  const [allEvals, setAllEvals] = useState<EvaluationResult[]>([])
  const [aiSummaries, setAiSummaries] = useState<AISummary[]>([])
  const [copied, setCopied] = useState(false)
  const [expandAIRaw, setExpandAIRaw] = useState(false)
  const reportRef = useRef<HTMLDivElement>(null)

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

  // 手動コメント分類
  const problemComments  = allComments.filter((cm) => cm.type === 'problem')
  const riskComments     = allComments.filter((cm) => cm.type === 'risk')
  const improvComments   = allComments.filter((cm) => cm.type === 'improvement')
  const positiveComments = allComments.filter((cm) => cm.type === 'positive')
  const hasManual = allComments.length > 0 || allEvals.length > 0

  // AI所見を解析
  const latestAI = aiSummaries[0] ?? null
  const aiParsed: AIParsed | null = latestAI ? parseAISummary(latestAI.summary) : null
  const hasAI = !!aiParsed && (
    aiParsed.problems.length + aiParsed.risks.length + aiParsed.improvements.length + aiParsed.observations.length > 0
  )

  // スコア
  const score = hasManual
    ? computeScore(allComments, allEvals)
    : hasAI ? scoreFromAI(aiParsed!) : 80

  // 表示用コンテンツ（手動 > AI）
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

  // 優先アクション
  const priorityItems: { text: string; type: 'risk' | 'problem' | 'improvement'; fromAI: boolean }[] = [
    ...displayRisks.slice(0, 2).map((x) => ({ ...x, type: 'risk' as const })),
    ...displayProblems.slice(0, 2).map((x) => ({ ...x, type: 'problem' as const })),
    ...displayImprov.slice(0, 2).map((x) => ({ ...x, type: 'improvement' as const })),
  ].slice(0, 5)

  // 重症度バー
  const severeItems = allEvals.flatMap((ev) =>
    ev.items.filter((it) => it.checked && it.severity !== '' && it.severity !== 'none').map((it) => ({ ...it }))
  )

  // レーダーチャート
  const movTypes = [...new Set(c.videos.map((v) => v.movementType))]
  const radarData = movTypes.slice(0, 6).map((mt) => {
    const vid = c.videos.find((v) => v.movementType === mt)
    if (!vid) return { label: MOVEMENT_TYPE_LABELS[mt] ?? mt, value: 70 }
    const rel = allComments.filter((cm) => cm.videoId === vid.id)
    const neg = rel.filter((cm) => cm.type === 'problem' || cm.type === 'risk').length
    const pos = rel.filter((cm) => cm.type === 'positive').length
    // AIから推定
    const aiProb = aiParsed ? aiParsed.problems.length + aiParsed.risks.length : 0
    const val = hasManual
      ? Math.max(20, Math.min(100, 100 - neg * 18 + pos * 10))
      : Math.max(20, Math.min(95, 80 - aiProb * 5))
    return { label: MOVEMENT_TYPE_LABELS[mt] ?? mt, value: val }
  })

  const hasContent = hasManual || hasAI

  // ── 共有テキスト ──
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
    if (hasAI && !hasManual) lines.push('※上記はAI動作解析所見を元に作成されています。')
    lines.push('※本レポートは動作分析の補助情報です。治療方針は担当専門家の指示に従ってください。')
    lines.push('YUUKI REHAB 動作分析システム')
    return lines.join('\n')
  }

  function handleCopy() {
    navigator.clipboard.writeText(buildShareText()).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2500) })
  }
  function handleLine() {
    window.open(`https://social-plugins.line.me/lineit/share?url=&text=${encodeURIComponent(buildShareText())}`, '_blank', 'noopener,noreferrer,width=600,height=500')
  }
  function handlePrint() { window.print() }

  // ═══════════════════════════════════════════════════════════════════════════
  return (
    <>
      {/* ── ツールバー ── */}
      <div className="no-print flex items-center gap-3 flex-wrap mb-5 p-3 bg-gray-50 rounded-xl border border-gray-200">
        <div className="flex items-center gap-2">
          <Share2 className="w-4 h-4 text-[#0d9488]" />
          <span className="text-sm font-semibold text-gray-800">患者様向け説明レポート</span>
          {hasAI && !hasManual && (
            <span className="flex items-center gap-1 text-xs text-purple-600 bg-purple-50 border border-purple-200 px-2 py-0.5 rounded-full">
              <Bot className="w-3 h-3" />AI所見から自動生成
            </span>
          )}
        </div>
        <div className="ml-auto flex gap-2 flex-wrap">
          <button onClick={handleLine} className="flex items-center gap-2 px-4 py-2 bg-[#06C755] hover:bg-[#05a847] text-white font-medium rounded-lg text-sm transition-colors">
            <LineIcon />LINEで送る
          </button>
          <button onClick={handleCopy} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${copied ? 'bg-green-500 text-white border-green-500' : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'}`}>
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            {copied ? 'コピーしました' : 'テキストをコピー'}
          </button>
          <button onClick={handlePrint} className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 rounded-lg text-sm font-medium transition-colors">
            <Printer className="w-4 h-4" />A4印刷
          </button>
        </div>
      </div>

      {/* ── レポート本体 ── */}
      <div ref={reportRef} id="patient-report-body" className="print-page bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">

        {/* ヘッダー */}
        <div className="bg-gradient-to-r from-[#1e3a5f] to-[#0d9488] px-6 py-5 text-white print:px-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[10px] text-white/60 uppercase tracking-[0.15em] mb-1">Motion Analysis Report</p>
              <h1 className="text-xl font-bold tracking-wide">動作分析レポート</h1>
              <p className="text-white/80 text-sm mt-0.5">患者様ご説明用</p>
            </div>
            <div className="text-right flex-shrink-0">
              <p className="text-white/70 text-xs">{now}</p>
              <p className="text-white font-semibold text-sm mt-0.5">YUUKI REHAB</p>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-4 border-t border-white/20 pt-3">
            <div><p className="text-white/60 text-[10px] uppercase tracking-wide">診断名</p><p className="text-white font-semibold text-sm">{c.diagnosis}</p></div>
            <div><p className="text-white/60 text-[10px] uppercase tracking-wide">評価部位</p><p className="text-white font-semibold text-sm">{c.injuredPart}</p></div>
            <div className="flex-1"><p className="text-white/60 text-[10px] uppercase tracking-wide">評価目的</p><p className="text-white text-sm">{c.evaluationPurpose}</p></div>
          </div>
        </div>

        <div className="p-6 space-y-6 print:p-8">

          {/* ── ① 総合スコア ── */}
          <div className="flex flex-col sm:flex-row items-center gap-5 bg-gray-50 rounded-2xl p-4 print:flex-row">
            <div className="flex flex-col items-center flex-shrink-0">
              <ScoreGauge score={score} size={130} />
              <p className="text-xs text-gray-500 mt-1">総合評価スコア</p>
              {hasAI && !hasManual && (
                <p className="text-[10px] text-purple-400 flex items-center gap-0.5 mt-0.5"><Bot className="w-2.5 h-2.5" />AI推定値</p>
              )}
            </div>
            <div className="flex-1 w-full">
              <div className="grid grid-cols-4 gap-2">
                <CategoryBadge count={displayPositive.length} label="良好な点" color="#22c55e" bg="bg-green-50" icon="✅" />
                <CategoryBadge count={displayProblems.length} label="気になる点" color="#f59e0b" bg="bg-amber-50" icon="⚠️" />
                <CategoryBadge count={displayImprov.length} label="改善提案" color="#3b82f6" bg="bg-blue-50" icon="🎯" />
                <CategoryBadge count={displayRisks.length} label="注意事項" color="#ef4444" bg="bg-red-50" icon="🔴" />
              </div>
              <div className="mt-3">
                <p className="text-[10px] text-gray-400 mb-1.5 font-medium uppercase tracking-wide">評価した動作</p>
                <div className="flex flex-wrap gap-1.5">
                  {c.videos.map((v) => (
                    <span key={v.id} className="text-[11px] px-2 py-0.5 bg-white border border-gray-200 text-gray-600 rounded-full">
                      {MOVEMENT_TYPE_LABELS[v.movementType]} — {v.label}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* データなし */}
          {!hasContent && (
            <div className="text-center py-10 text-gray-400 border-2 border-dashed border-gray-200 rounded-xl">
              <p className="text-sm font-medium mb-1">データがまだ記録されていません</p>
              <p className="text-xs">動画分析ページで「AI解析」を実行するか、「コメント」「評価」を入力してください</p>
            </div>
          )}

          {hasContent && (
            <>
              {/* ── ② グラフエリア ── */}
              {(radarData.length >= 3 || severeItems.length > 0) && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 print:grid-cols-2">
                  {radarData.length >= 3 && (
                    <div className="bg-white border border-gray-100 rounded-xl p-4">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">動作別評価バランス</p>
                      <div className="flex justify-center"><RadarChart data={radarData} /></div>
                      <p className="text-[10px] text-gray-400 text-center mt-1">外側ほど良好 / 内側ほど改善が必要</p>
                    </div>
                  )}
                  {severeItems.length > 0 && (
                    <div className="bg-white border border-gray-100 rounded-xl p-4">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">チェックポイント別重症度</p>
                      <div className="space-y-1.5">
                        {severeItems.slice(0, 10).map((it, i) => <SeverityBar key={i} label={it.label} severity={it.severity} note={it.note} />)}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ── ③ 良好な点 ── */}
              {displayPositive.length > 0 && (
                <div>
                  <SectionTitle color="green" icon="✅" title="良好な点" subtitle="現在できていること" fromAI={displayPositive[0].fromAI} />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2 print:grid-cols-2">
                    {displayPositive.map((x, i) => (
                      <div key={i} className="flex items-start gap-2.5 bg-green-50 border border-green-100 rounded-xl p-3">
                        <span className="w-5 h-5 rounded-full bg-green-500 text-white text-xs flex items-center justify-center flex-shrink-0 mt-0.5">✓</span>
                        <p className="text-sm text-green-900 leading-relaxed">{x.text}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ── ④ 優先改善アクション ── */}
              {priorityItems.length > 0 && (
                <div>
                  <SectionTitle color="blue" icon="🎯" title="優先改善アクション" subtitle="今すぐ意識してほしいこと" fromAI={priorityItems[0].fromAI} />
                  <div className="space-y-2 mt-2">
                    {priorityItems.map((item, i) => <ActionCard key={i} num={i + 1} text={item.text} type={item.type} fromAI={item.fromAI} />)}
                  </div>
                </div>
              )}

              {/* ── ⑤ 気になる動作 ── */}
              {displayProblems.length > 0 && (
                <div>
                  <SectionTitle color="amber" icon="⚠️" title="気になる動作の特徴" subtitle="専門家・AIが観察した課題" fromAI={displayProblems[0].fromAI} />
                  <div className="space-y-2 mt-2">
                    {displayProblems.map((x, i) => (
                      <div key={i} className="flex items-start gap-2.5 bg-amber-50 border border-amber-100 rounded-xl p-3">
                        <span className="w-2 h-2 rounded-full bg-amber-400 flex-shrink-0 mt-1.5" />
                        <p className="text-sm text-amber-900 leading-relaxed">{x.text}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ── ⑥ 注意事項 ── */}
              {displayRisks.length > 0 && (
                <div>
                  <SectionTitle color="red" icon="🔴" title="重要な注意事項" subtitle="再受傷・悪化を防ぐために" fromAI={displayRisks[0].fromAI} />
                  <div className="space-y-2 mt-2">
                    {displayRisks.map((x, i) => (
                      <div key={i} className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl p-3.5">
                        <span className="text-red-500 font-bold text-sm flex-shrink-0 mt-0.5">▲</span>
                        <p className="text-sm text-red-900 leading-relaxed font-medium">{x.text}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ── ⑦ AI所見全文（折りたたみ・画面のみ） ── */}
              {latestAI && (
                <div className="no-print">
                  <button onClick={() => setExpandAIRaw(!expandAIRaw)}
                    className="flex items-center gap-2 w-full bg-purple-50 border border-purple-200 rounded-xl px-4 py-3 text-left hover:bg-purple-100 transition-colors">
                    <Bot className="w-4 h-4 text-purple-500 flex-shrink-0" />
                    <span className="text-sm font-semibold text-purple-800 flex-1">
                      AI所見全文（{latestAI.createdAt.slice(0, 10)}）
                    </span>
                    {expandAIRaw ? <ChevronUp className="w-4 h-4 text-purple-400" /> : <ChevronDown className="w-4 h-4 text-purple-400" />}
                  </button>
                  {expandAIRaw && (
                    <div className="mt-2 bg-purple-50 border border-purple-200 rounded-xl p-4">
                      <p className="text-xs text-purple-500 mb-2">※AIによる参考情報。最終判断は専門家が行います。</p>
                      <p className="text-xs text-gray-700 leading-relaxed whitespace-pre-line">{latestAI.summary}</p>
                    </div>
                  )}
                </div>
              )}

              {/* ── ⑧ 印刷版AI全文 ── */}
              {latestAI && (
                <div className="hidden print:block">
                  <SectionTitle color="purple" icon="🤖" title="AI動作解析所見（詳細）" subtitle="参考情報" />
                  <div className="mt-2 bg-purple-50 border border-purple-200 rounded-xl p-4">
                    <p className="text-xs text-gray-700 leading-relaxed whitespace-pre-line">{latestAI.summary.slice(0, 1000)}{latestAI.summary.length > 1000 ? '…' : ''}</p>
                  </div>
                </div>
              )}
            </>
          )}

          {/* ── フッター ── */}
          <div className="border-t border-gray-100 pt-4">
            {hasAI && !hasManual && (
              <div className="bg-purple-50 border border-purple-200 rounded-xl p-3 mb-3 flex items-start gap-2">
                <Bot className="w-4 h-4 text-purple-500 flex-shrink-0 mt-0.5" />
                <p className="text-[11px] text-purple-700 leading-relaxed">
                  このレポートはAI動作解析所見（{latestAI?.createdAt.slice(0, 10)}）を元に自動生成されています。
                  専門家によるコメント・評価チェックリストが入力されると、より詳細な内容に更新されます。
                </p>
              </div>
            )}
            <div className="bg-gray-50 rounded-xl p-4 flex gap-4 items-start">
              <div className="text-2xl flex-shrink-0">📋</div>
              <div>
                <p className="text-xs font-semibold text-gray-700 mb-1">ご注意事項</p>
                <p className="text-[11px] text-gray-500 leading-relaxed">
                  本レポートは動作分析システムによる補助情報として作成されたものです。記載内容は確定的な診断・治療方針を示すものではありません。
                  治療方針・競技復帰の最終判断は担当医師・理学療法士の指示に従ってください。
                </p>
              </div>
            </div>
            <div className="flex items-center justify-between mt-3 px-1">
              <p className="text-[10px] text-gray-400">YUUKI REHAB 動作分析システム</p>
              <p className="text-[10px] text-gray-400">{now} 作成</p>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @media print {
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          body > * { display: none !important; }
          .no-print { display: none !important; }
          #patient-report-body { display: block !important; box-shadow: none !important; border: none !important; border-radius: 0 !important; }
          .hidden.print\\:block { display: block !important; }
        }
        @page { size: A4; margin: 12mm 14mm; }
      `}</style>
    </>
  )
}
