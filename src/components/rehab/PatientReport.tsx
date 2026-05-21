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

// ── 部位キーワード定義 ──────────────────────────────────────────────────────
type BodyRegion =
  | 'head' | 'neck' | 'shoulder_l' | 'shoulder_r'
  | 'elbow_l' | 'elbow_r' | 'wrist_l' | 'wrist_r'
  | 'chest' | 'abdomen' | 'lower_back'
  | 'hip_l' | 'hip_r' | 'knee_l' | 'knee_r'
  | 'ankle_l' | 'ankle_r' | 'foot_l' | 'foot_r'
  | 'trunk' | 'pelvis'

const REGION_LABELS: Record<BodyRegion, string> = {
  head: '頭部', neck: '頸部',
  shoulder_l: '左肩', shoulder_r: '右肩',
  elbow_l: '左肘', elbow_r: '右肘',
  wrist_l: '左手首', wrist_r: '右手首',
  chest: '胸部', abdomen: '腹部', lower_back: '腰部',
  hip_l: '左股関節', hip_r: '右股関節',
  knee_l: '左膝', knee_r: '右膝',
  ankle_l: '左足首', ankle_r: '右足首',
  foot_l: '左足部', foot_r: '右足部',
  trunk: '体幹', pelvis: '骨盤',
}

// テキストから部位を抽出
function detectRegions(text: string): BodyRegion[] {
  const found = new Set<BodyRegion>()
  const t = text
  if (/頭|頭部/.test(t)) found.add('head')
  if (/頸|首|頚/.test(t)) found.add('neck')
  if (/左肩|左の肩/.test(t)) found.add('shoulder_l')
  if (/右肩|右の肩/.test(t)) found.add('shoulder_r')
  if (/肩(?!甲)/.test(t) && !found.has('shoulder_l') && !found.has('shoulder_r')) { found.add('shoulder_l'); found.add('shoulder_r') }
  if (/左肘|左の肘/.test(t)) found.add('elbow_l')
  if (/右肘|右の肘/.test(t)) found.add('elbow_r')
  if (/肘/.test(t) && !found.has('elbow_l') && !found.has('elbow_r')) { found.add('elbow_l'); found.add('elbow_r') }
  if (/左手首|左手関節/.test(t)) found.add('wrist_l')
  if (/右手首|右手関節/.test(t)) found.add('wrist_r')
  if (/手首|手関節/.test(t) && !found.has('wrist_l') && !found.has('wrist_r')) { found.add('wrist_l'); found.add('wrist_r') }
  if (/胸|胸郭|胸椎/.test(t)) found.add('chest')
  if (/腹|体幹|コア|trunk|core/.test(t)) { found.add('abdomen'); found.add('trunk') }
  if (/腰|腰部|腰椎|腰背/.test(t)) found.add('lower_back')
  if (/骨盤/.test(t)) found.add('pelvis')
  if (/体幹|幹/.test(t)) found.add('trunk')
  if (/左股|左の股|左ヒップ/.test(t)) found.add('hip_l')
  if (/右股|右の股|右ヒップ/.test(t)) found.add('hip_r')
  if (/股関節|ヒップ/.test(t) && !found.has('hip_l') && !found.has('hip_r')) { found.add('hip_l'); found.add('hip_r') }
  if (/左膝|左の膝/.test(t)) found.add('knee_l')
  if (/右膝|右の膝/.test(t)) found.add('knee_r')
  if (/膝/.test(t) && !found.has('knee_l') && !found.has('knee_r')) { found.add('knee_l'); found.add('knee_r') }
  if (/左足首|左足関節/.test(t)) found.add('ankle_l')
  if (/右足首|右足関節/.test(t)) found.add('ankle_r')
  if (/足首|足関節/.test(t) && !found.has('ankle_l') && !found.has('ankle_r')) { found.add('ankle_l'); found.add('ankle_r') }
  if (/左足部|左足底/.test(t)) found.add('foot_l')
  if (/右足部|右足底/.test(t)) found.add('foot_r')
  if (/足部|足底|足裏/.test(t) && !found.has('foot_l') && !found.has('foot_r')) { found.add('foot_l'); found.add('foot_r') }
  return [...found]
}

// ── ボディマップ SVG ─────────────────────────────────────────────────────────
// SVG座標での各部位の中心と半径 (cx, cy, rx, ry)
const REGION_SHAPES: Record<BodyRegion, { cx: number; cy: number; rx: number; ry: number }> = {
  head:       { cx: 60, cy: 22,  rx: 14, ry: 14 },
  neck:       { cx: 60, cy: 42,  rx: 7,  ry: 7  },
  chest:      { cx: 60, cy: 72,  rx: 22, ry: 16 },
  abdomen:    { cx: 60, cy: 97,  rx: 18, ry: 10 },
  lower_back: { cx: 60, cy: 115, rx: 18, ry: 10 },
  trunk:      { cx: 60, cy: 90,  rx: 22, ry: 25 },
  pelvis:     { cx: 60, cy: 130, rx: 20, ry: 10 },
  shoulder_l: { cx: 30, cy: 62,  rx: 10, ry: 10 },
  shoulder_r: { cx: 90, cy: 62,  rx: 10, ry: 10 },
  elbow_l:    { cx: 18, cy: 90,  rx: 8,  ry: 8  },
  elbow_r:    { cx: 102,cy: 90,  rx: 8,  ry: 8  },
  wrist_l:    { cx: 10, cy: 115, rx: 7,  ry: 7  },
  wrist_r:    { cx: 110,cy: 115, rx: 7,  ry: 7  },
  hip_l:      { cx: 42, cy: 145, rx: 12, ry: 10 },
  hip_r:      { cx: 78, cy: 145, rx: 12, ry: 10 },
  knee_l:     { cx: 42, cy: 180, rx: 10, ry: 10 },
  knee_r:     { cx: 78, cy: 180, rx: 10, ry: 10 },
  ankle_l:    { cx: 42, cy: 215, rx: 8,  ry: 8  },
  ankle_r:    { cx: 78, cy: 215, rx: 8,  ry: 8  },
  foot_l:     { cx: 40, cy: 232, rx: 10, ry: 6  },
  foot_r:     { cx: 80, cy: 232, rx: 10, ry: 6  },
}

function BodyMap({ highlighted, severity = 'problem' }: { highlighted: BodyRegion[]; severity?: 'problem' | 'risk' | 'positive' }) {
  const color = severity === 'risk' ? '#ef4444' : severity === 'positive' ? '#16a34a' : '#f59e0b'
  const fill  = severity === 'risk' ? 'rgba(239,68,68,0.25)' : severity === 'positive' ? 'rgba(22,163,74,0.2)' : 'rgba(245,158,11,0.25)'

  return (
    <svg viewBox="0 0 120 250" width="90" height="190" style={{ display: 'block' }}>
      {/* 人体シルエット */}
      {/* 頭 */}
      <circle cx="60" cy="22" r="14" fill="#e5e7eb" stroke="#d1d5db" strokeWidth="1" />
      {/* 首 */}
      <rect x="54" y="35" width="12" height="12" rx="4" fill="#e5e7eb" stroke="#d1d5db" strokeWidth="1" />
      {/* 胴体 */}
      <rect x="38" y="50" width="44" height="90" rx="8" fill="#e5e7eb" stroke="#d1d5db" strokeWidth="1" />
      {/* 左腕 */}
      <rect x="20" y="54" width="18" height="70" rx="7" fill="#e5e7eb" stroke="#d1d5db" strokeWidth="1" />
      {/* 右腕 */}
      <rect x="82" y="54" width="18" height="70" rx="7" fill="#e5e7eb" stroke="#d1d5db" strokeWidth="1" />
      {/* 左手 */}
      <ellipse cx="29" cy="130" rx="9" ry="7" fill="#e5e7eb" stroke="#d1d5db" strokeWidth="1" />
      {/* 右手 */}
      <ellipse cx="91" cy="130" rx="9" ry="7" fill="#e5e7eb" stroke="#d1d5db" strokeWidth="1" />
      {/* 左脚 */}
      <rect x="39" y="140" width="20" height="85" rx="8" fill="#e5e7eb" stroke="#d1d5db" strokeWidth="1" />
      {/* 右脚 */}
      <rect x="61" y="140" width="20" height="85" rx="8" fill="#e5e7eb" stroke="#d1d5db" strokeWidth="1" />
      {/* 左足 */}
      <ellipse cx="49" cy="230" rx="12" ry="6" fill="#e5e7eb" stroke="#d1d5db" strokeWidth="1" />
      {/* 右足 */}
      <ellipse cx="71" cy="230" rx="12" ry="6" fill="#e5e7eb" stroke="#d1d5db" strokeWidth="1" />

      {/* ハイライト */}
      {highlighted.map((region) => {
        const s = REGION_SHAPES[region]
        if (!s) return null
        return (
          <ellipse
            key={region}
            cx={s.cx} cy={s.cy} rx={s.rx} ry={s.ry}
            fill={fill}
            stroke={color}
            strokeWidth="2.5"
            strokeDasharray="3 1.5"
          />
        )
      })}
    </svg>
  )
}

// テキストから部位ラベルバッジを生成
function RegionBadges({ text, color }: { text: string; color: string }) {
  const regions = detectRegions(text)
  if (regions.length === 0) return null
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '6px' }}>
      {regions.map((r) => (
        <span key={r} style={{ fontSize: '10px', fontWeight: '600', color, background: `${color}15`, border: `1px solid ${color}40`, borderRadius: '999px', padding: '1px 7px' }}>
          📍 {REGION_LABELS[r]}
        </span>
      ))}
    </div>
  )
}

// ── AI解析 ────────────────────────────────────────────────────────────────────
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

function ScoreBadge({ score }: { score: number }) {
  const color = score >= 75 ? '#16a34a' : score >= 50 ? '#d97706' : score >= 30 ? '#ea580c' : '#dc2626'
  const bg    = score >= 75 ? '#f0fdf4' : score >= 50 ? '#fffbeb' : score >= 30 ? '#fff7ed' : '#fef2f2'
  const label = score >= 75 ? '良好' : score >= 50 ? '要注意' : score >= 30 ? '要改善' : '要精査'
  const r = 52, cx = 70, cy = 70
  const circ = 2 * Math.PI * r
  const dash  = circ * (score / 100)
  const gap   = circ - dash
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <svg width="140" height="140" viewBox="0 0 140 140">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#e5e7eb" strokeWidth="10" />
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth="10" strokeLinecap="round"
          strokeDasharray={`${dash} ${gap}`} strokeDashoffset={circ * 0.25} />
        <circle cx={cx} cy={cy} r="42" fill={bg} />
        <text x={cx} y={cy - 8} textAnchor="middle" fontSize="28" fontWeight="800" fill={color}>{score}</text>
        <text x={cx} y={cy + 8} textAnchor="middle" fontSize="11" fill="#9ca3af">/ 100</text>
        <text x={cx} y={cy + 24} textAnchor="middle" fontSize="12" fontWeight="700" fill={color}>{label}</text>
      </svg>
      <p style={{ fontSize: '11px', color: '#9ca3af', marginTop: '-4px' }}>総合評価スコア</p>
    </div>
  )
}

function StatCard({ value, label, color, bg, icon }: { value: number; label: string; color: string; bg: string; icon: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', borderRadius: '16px', padding: '10px 8px', gap: '3px', backgroundColor: bg }}>
      <span style={{ fontSize: '18px' }}>{icon}</span>
      <span style={{ fontSize: '22px', fontWeight: '900', color, lineHeight: 1 }}>{value}</span>
      <span style={{ fontSize: '10px', color: '#6b7280', fontWeight: '500', textAlign: 'center', lineHeight: 1.2 }}>{label}</span>
    </div>
  )
}

function SeverityBar({ label, severity, note }: { label: string; severity: string; note?: string }) {
  const levels: Record<string, number> = { none: 0, mild: 1, moderate: 2, severe: 3 }
  const colors = ['#d1d5db', '#fbbf24', '#f97316', '#ef4444']
  const lbls = ['なし', '軽度', '中等度', '重度']
  const lv = levels[severity] ?? 0
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 0', borderBottom: '1px solid #f9fafb' }}>
      <span style={{ fontSize: '11px', color: '#4b5563', width: '120px', flexShrink: 0, lineHeight: 1.3 }}>{label}</span>
      <div style={{ display: 'flex', gap: '2px', flexShrink: 0 }}>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} style={{ width: '18px', height: '8px', borderRadius: '3px', backgroundColor: i <= lv ? colors[lv] : '#e5e7eb' }} />
        ))}
      </div>
      <span style={{ fontSize: '11px', fontWeight: '700', width: '44px', color: lv > 0 ? colors[lv] : '#9ca3af' }}>{lbls[lv]}</span>
      {note && <span style={{ fontSize: '10px', color: '#9ca3af', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{note}</span>}
    </div>
  )
}

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

// ── 発見事項カード（ボディマップ付き） ────────────────────────────────────────
function FindingCard({
  items, type, title, subtitle, icon, fromAI,
}: {
  items: { text: string; fromAI: boolean }[]
  type: 'positive' | 'problem' | 'risk' | 'improvement'
  title: string
  subtitle: string
  icon: string
  fromAI: boolean
}) {
  const cfg = {
    positive:    { bg: '#f0fdf4', border: '#bbf7d0', accent: '#16a34a', text: '#14532d', markerColor: '#16a34a', severity: 'positive' as const },
    problem:     { bg: '#fffbeb', border: '#fde68a', accent: '#d97706', text: '#78350f', markerColor: '#d97706', severity: 'problem' as const },
    risk:        { bg: '#fef2f2', border: '#fecaca', accent: '#dc2626', text: '#7f1d1d', markerColor: '#dc2626', severity: 'risk' as const },
    improvement: { bg: '#eff6ff', border: '#bfdbfe', accent: '#2563eb', text: '#1e3a8a', markerColor: '#2563eb', severity: 'problem' as const },
  }[type]

  // 全テキストから部位を集約
  const allRegions = [...new Set(items.flatMap((x) => detectRegions(x.text)))]

  return (
    <section>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
        <div style={{ width: '4px', height: '24px', borderRadius: '999px', background: cfg.accent, flexShrink: 0 }} />
        <h3 style={{ fontSize: '13px', fontWeight: '800', color: '#111827', margin: 0 }}>{icon} {title}</h3>
        <p style={{ fontSize: '11px', color: '#9ca3af', margin: 0 }}>{subtitle}</p>
        {fromAI && <span style={{ fontSize: '10px', color: '#7c3aed', background: '#faf5ff', border: '1px solid #e9d5ff', padding: '1px 6px', borderRadius: '999px', flexShrink: 0 }}><Bot style={{ display: 'inline', width: '10px', height: '10px' }} /> AI所見</span>}
      </div>

      <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
        {/* ボディマップ（部位が検出された場合のみ表示） */}
        {allRegions.length > 0 && (
          <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
            <BodyMap highlighted={allRegions} severity={cfg.severity} />
            <p style={{ fontSize: '9px', color: '#9ca3af', textAlign: 'center', margin: 0, lineHeight: 1.4 }}>指摘部位</p>
          </div>
        )}

        {/* 発見事項リスト */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {items.map((x, i) => {
            const regions = detectRegions(x.text)
            return (
              <div key={i} style={{ background: cfg.bg, border: `1px solid ${cfg.border}`, borderRadius: '12px', padding: '10px 12px' }}>
                {/* 部位バッジ */}
                {regions.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '6px' }}>
                    {regions.map((r) => (
                      <span key={r} style={{ fontSize: '10px', fontWeight: '700', color: cfg.accent, background: `${cfg.accent}18`, border: `1px solid ${cfg.accent}35`, borderRadius: '999px', padding: '1px 8px' }}>
                        📍 {REGION_LABELS[r]}
                      </span>
                    ))}
                  </div>
                )}
                <p style={{ fontSize: '13px', color: cfg.text, lineHeight: '1.65', margin: 0 }}>{x.text}</p>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}

// ── 優先アクションカード ───────────────────────────────────────────────────────
function ActionCard({ num, text, type, fromAI }: { num: number; text: string; type: 'problem' | 'risk' | 'improvement'; fromAI?: boolean }) {
  const cfg = {
    risk:        { bg: '#fef2f2', border: '#fecaca', circle: '#dc2626', text: '#7f1d1d' },
    problem:     { bg: '#fffbeb', border: '#fde68a', circle: '#d97706', text: '#78350f' },
    improvement: { bg: '#eff6ff', border: '#bfdbfe', circle: '#2563eb', text: '#1e3a8a' },
  }[type]
  const regions = detectRegions(text)
  return (
    <div style={{ background: cfg.bg, border: `1px solid ${cfg.border}`, borderRadius: '12px', padding: '12px 14px', display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
      <div style={{ width: '26px', height: '26px', borderRadius: '50%', background: cfg.circle, color: '#fff', fontSize: '12px', fontWeight: '900', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{num}</div>
      <div style={{ flex: 1 }}>
        {regions.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '5px' }}>
            {regions.map((r) => (
              <span key={r} style={{ fontSize: '10px', fontWeight: '700', color: cfg.circle, background: `${cfg.circle}15`, border: `1px solid ${cfg.circle}30`, borderRadius: '999px', padding: '1px 7px' }}>
                📍 {REGION_LABELS[r]}
              </span>
            ))}
          </div>
        )}
        <p style={{ fontSize: '13px', color: cfg.text, lineHeight: '1.65', margin: 0 }}>{text}</p>
        {fromAI && <span style={{ fontSize: '10px', color: '#7c3aed', marginTop: '4px', display: 'inline-block' }}>AIより</span>}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
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
  const aiParsed = latestAI ? parseAISummary(latestAI.summary) : null
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
      {/* ── ツールバー ── */}
      <div className="no-print" style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '20px', padding: '12px 16px', background: '#fff', borderRadius: '16px', border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Share2 style={{ width: '16px', height: '16px', color: '#0d9488' }} />
          <span style={{ fontSize: '13px', fontWeight: '700', color: '#111827' }}>患者様向け説明レポート</span>
          {hasAI && !hasManual && (
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: '#7c3aed', background: '#faf5ff', border: '1px solid #e9d5ff', padding: '2px 8px', borderRadius: '999px' }}>
              <Bot style={{ width: '12px', height: '12px' }} />AI所見から自動生成
            </span>
          )}
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button onClick={handleLine} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', background: '#06C755', color: '#fff', fontWeight: '600', borderRadius: '8px', fontSize: '13px', border: 'none', cursor: 'pointer' }}>
            <LineIcon />LINEで送る
          </button>
          <button onClick={handleCopy} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', background: copied ? '#16a34a' : '#fff', color: copied ? '#fff' : '#374151', fontWeight: '600', borderRadius: '8px', fontSize: '13px', border: '1px solid #e5e7eb', cursor: 'pointer' }}>
            {copied ? <Check style={{ width: '14px', height: '14px' }} /> : <Copy style={{ width: '14px', height: '14px' }} />}
            {copied ? 'コピーしました' : 'コピー'}
          </button>
          <button onClick={handlePrint} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', background: '#111827', color: '#fff', fontWeight: '600', borderRadius: '8px', fontSize: '13px', border: 'none', cursor: 'pointer' }}>
            <Printer style={{ width: '14px', height: '14px' }} />印刷
          </button>
        </div>
      </div>

      {/* ── レポート本体 ── */}
      <div id="patient-report-body" style={{ background: '#fff', borderRadius: '16px', overflow: 'hidden', border: '1px solid #f3f4f6', boxShadow: '0 1px 8px rgba(0,0,0,0.07)' }}>

        {/* ヘッダー */}
        <div style={{ background: 'linear-gradient(135deg, #0f2744 0%, #0d9488 100%)', padding: '28px 32px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px' }}>
            <div>
              <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: '6px', margin: '0 0 6px' }}>Motion Analysis Report</p>
              <h1 style={{ color: '#fff', fontSize: '22px', fontWeight: '800', letterSpacing: '0.04em', margin: '0 0 4px' }}>動作分析レポート</h1>
              <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '13px', margin: 0 }}>患者様ご説明用</p>
            </div>
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '11px', margin: '0 0 4px' }}>{now}</p>
              <p style={{ color: '#5eead4', fontSize: '14px', fontWeight: '700', letterSpacing: '0.05em', margin: 0 }}>YUUKI MOTION LAB</p>
            </div>
          </div>
          <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid rgba(255,255,255,0.15)', display: 'flex', flexWrap: 'wrap', gap: '24px' }}>
            {[{ label: '診断名', value: c.diagnosis }, { label: '評価部位', value: c.injuredPart }, { label: '評価目的', value: c.evaluationPurpose }].map(({ label, value }) => (
              <div key={label}>
                <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.12em', margin: '0 0 3px' }}>{label}</p>
                <p style={{ color: '#fff', fontSize: '13px', fontWeight: '600', margin: 0 }}>{value}</p>
              </div>
            ))}
          </div>
        </div>

        <div style={{ padding: '28px 32px', display: 'flex', flexDirection: 'column', gap: '28px' }}>

          {/* ① スコア */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '24px', background: '#f9fafb', borderRadius: '16px', padding: '20px', flexWrap: 'wrap' }}>
            <ScoreBadge score={score} />
            <div style={{ flex: 1, minWidth: '200px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
                <StatCard value={displayPositive.length} label="良好な点" color="#16a34a" bg="#f0fdf4" icon="✅" />
                <StatCard value={displayProblems.length} label="気になる点" color="#d97706" bg="#fffbeb" icon="⚠️" />
                <StatCard value={displayImprov.length} label="改善提案" color="#2563eb" bg="#eff6ff" icon="🎯" />
                <StatCard value={displayRisks.length} label="注意事項" color="#dc2626" bg="#fef2f2" icon="🔴" />
              </div>
              {c.videos.length > 0 && (
                <div>
                  <p style={{ fontSize: '10px', color: '#9ca3af', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 6px' }}>評価した動作</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {c.videos.map((v) => (
                      <span key={v.id} style={{ fontSize: '11px', padding: '3px 10px', background: '#fff', border: '1px solid #e5e7eb', color: '#4b5563', borderRadius: '999px' }}>
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
            <div style={{ textAlign: 'center', padding: '48px 16px', color: '#9ca3af', border: '2px dashed #e5e7eb', borderRadius: '16px' }}>
              <p style={{ fontSize: '13px', fontWeight: '600', margin: '0 0 6px' }}>データがまだ記録されていません</p>
              <p style={{ fontSize: '12px', margin: 0 }}>動画分析ページで「AI解析」を実行するか、コメント・評価を入力してください</p>
            </div>
          )}

          {hasContent && (
            <>
              {/* ② グラフ */}
              {(radarData.length >= 3 || severeItems.length > 0) && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
                  {radarData.length >= 3 && (
                    <div style={{ background: '#fff', border: '1px solid #f3f4f6', borderRadius: '16px', padding: '20px', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
                      <p style={{ fontSize: '11px', fontWeight: '700', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 12px' }}>動作別評価バランス</p>
                      <div style={{ display: 'flex', justifyContent: 'center' }}><RadarChart data={radarData} /></div>
                      <p style={{ fontSize: '10px', color: '#9ca3af', textAlign: 'center', margin: '4px 0 0' }}>外側ほど良好 / 内側ほど改善が必要</p>
                    </div>
                  )}
                  {severeItems.length > 0 && (
                    <div style={{ background: '#fff', border: '1px solid #f3f4f6', borderRadius: '16px', padding: '20px', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
                      <p style={{ fontSize: '11px', fontWeight: '700', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 12px' }}>チェックポイント別重症度</p>
                      {severeItems.slice(0, 10).map((it, i) => <SeverityBar key={i} label={it.label} severity={it.severity} note={it.note} />)}
                    </div>
                  )}
                </div>
              )}

              {/* ③ 良好な点 */}
              {displayPositive.length > 0 && (
                <FindingCard items={displayPositive} type="positive" title="良好な点" subtitle="現在できていること" icon="✅" fromAI={displayPositive[0].fromAI} />
              )}

              {/* ④ 優先改善アクション */}
              {priorityItems.length > 0 && (
                <section>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                    <div style={{ width: '4px', height: '24px', borderRadius: '999px', background: '#2563eb', flexShrink: 0 }} />
                    <h3 style={{ fontSize: '13px', fontWeight: '800', color: '#111827', margin: 0 }}>🎯 優先改善アクション</h3>
                    <p style={{ fontSize: '11px', color: '#9ca3af', margin: 0 }}>今すぐ意識してほしいこと</p>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {priorityItems.map((item, i) => <ActionCard key={i} num={i + 1} text={item.text} type={item.type} fromAI={item.fromAI} />)}
                  </div>
                </section>
              )}

              {/* ⑤ 気になる動作 */}
              {displayProblems.length > 0 && (
                <FindingCard items={displayProblems} type="problem" title="気になる動作の特徴" subtitle="専門家・AIが観察した課題" icon="⚠️" fromAI={displayProblems[0].fromAI} />
              )}

              {/* ⑥ 注意事項 */}
              {displayRisks.length > 0 && (
                <FindingCard items={displayRisks} type="risk" title="重要な注意事項" subtitle="再受傷・悪化を防ぐために" icon="🔴" fromAI={displayRisks[0].fromAI} />
              )}

              {/* ⑦ AI所見全文（画面のみ） */}
              {latestAI && (
                <div className="no-print">
                  <button onClick={() => setExpandAIRaw(!expandAIRaw)}
                    style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', background: '#faf5ff', border: '1px solid #e9d5ff', borderRadius: '16px', padding: '12px 16px', cursor: 'pointer', textAlign: 'left' }}>
                    <Bot style={{ width: '16px', height: '16px', color: '#7c3aed', flexShrink: 0 }} />
                    <span style={{ fontSize: '13px', fontWeight: '700', color: '#5b21b6', flex: 1 }}>AI所見全文（{latestAI.createdAt.slice(0, 10)}）</span>
                    {expandAIRaw ? <ChevronUp style={{ width: '16px', height: '16px', color: '#a78bfa' }} /> : <ChevronDown style={{ width: '16px', height: '16px', color: '#a78bfa' }} />}
                  </button>
                  {expandAIRaw && (
                    <div style={{ marginTop: '8px', background: '#faf5ff', border: '1px solid #e9d5ff', borderRadius: '16px', padding: '20px' }}>
                      <p style={{ fontSize: '11px', color: '#a78bfa', margin: '0 0 12px' }}>※AIによる参考情報。最終判断は専門家が行います。</p>
                      <p style={{ fontSize: '12px', color: '#374151', lineHeight: '1.8', whiteSpace: 'pre-line', margin: 0 }}>{latestAI.summary}</p>
                    </div>
                  )}
                </div>
              )}

              {/* ⑧ 印刷版AI全文 */}
              {latestAI && (
                <div className="hidden print:block">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                    <div style={{ width: '4px', height: '24px', borderRadius: '999px', background: '#7c3aed' }} />
                    <h3 style={{ fontSize: '13px', fontWeight: '800', color: '#111827', margin: 0 }}>🤖 AI動作解析所見（詳細）</h3>
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

          {/* フッター */}
          <div style={{ borderTop: '1px solid #f3f4f6', paddingTop: '20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {hasAI && !hasManual && (
              <div style={{ background: '#faf5ff', border: '1px solid #e9d5ff', borderRadius: '12px', padding: '12px 16px', display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                <Bot style={{ width: '16px', height: '16px', color: '#7c3aed', flexShrink: 0, marginTop: '1px' }} />
                <p style={{ fontSize: '11px', color: '#5b21b6', lineHeight: '1.6', margin: 0 }}>
                  このレポートはAI動作解析所見（{latestAI?.createdAt.slice(0, 10)}）を元に自動生成されています。
                </p>
              </div>
            )}
            <div style={{ background: '#f9fafb', borderRadius: '12px', padding: '16px', display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
              <span style={{ fontSize: '20px', flexShrink: 0 }}>📋</span>
              <div>
                <p style={{ fontSize: '11px', fontWeight: '700', color: '#374151', margin: '0 0 4px' }}>ご注意事項</p>
                <p style={{ fontSize: '10px', color: '#6b7280', lineHeight: '1.7', margin: 0 }}>
                  本レポートは動作分析システムによる補助情報として作成されたものです。記載内容は確定的な診断・治療方針を示すものではありません。治療方針・競技復帰の最終判断は担当医師・理学療法士の指示に従ってください。
                </p>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 4px' }}>
              <p style={{ fontSize: '10px', color: '#9ca3af', margin: 0 }}>YUUKI MOTION LAB 動作解析サービス</p>
              <p style={{ fontSize: '10px', color: '#9ca3af', margin: 0 }}>{now} 作成</p>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #patient-report-body, #patient-report-body * { visibility: visible !important; }
          #patient-report-body {
            position: fixed !important; top: 0 !important; left: 0 !important;
            width: 100% !important; background: #ffffff !important;
            box-shadow: none !important; border: none !important; border-radius: 0 !important;
            overflow: visible !important;
          }
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          .no-print { display: none !important; visibility: hidden !important; }
          .hidden.print\\:block { display: block !important; visibility: visible !important; }
        }
        @page { size: A4; margin: 10mm 12mm; }
      `}</style>
    </>
  )
}
