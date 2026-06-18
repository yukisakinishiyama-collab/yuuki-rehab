'use client'

import { useMemo } from 'react'
import type { Assessment } from '@/types/protocol'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ReferenceLine,
} from 'recharts'

interface Threshold {
  key: string       /* メトリクスキー (例: rom_flex) */
  value: number     /* 移行基準値 */
  label: string     /* 表示ラベル (例: "ROM目標") */
}

interface Props {
  assessments: Assessment[]
  metricKeys?: string[]
  /** フェーズ移行基準値をグラフ上に参照線として表示 */
  thresholds?: Threshold[]
}

/* ──────────────────────────────────────
   臨床計測台帳パレット（v2 §1.1 遵守）
   紫・インジゴを排除。トークンに対応する
   色を使用（ライト/ダーク共通）。
────────────────────────────────────── */
const METRIC_COLORS: Record<string, string> = {
  pain:     '#ef4444',  /* 疼痛: red-500   = --color-danger  */
  nrs:      '#ef4444',  /* NRS: 同上                         */
  rom_flex: '#0d9488',  /* ROM屈曲: teal-600 = --color-primary */
  rom_ext:  '#0284c7',  /* ROM伸展: sky-600  (臨床的な青)      */
  lsi:      '#10b981',  /* LSI: emerald-500 = --color-success */
  mmt:      '#f97316',  /* MMT: orange-500  = --color-accent  */
  swelling: '#78716c',  /* 腫脹: stone-500  (中性・臨床的)    */
}

const METRIC_LABELS: Record<string, string> = {
  pain:     '疼痛(NRS)',
  nrs:      '疼痛(NRS)',
  rom_flex: 'ROM屈曲(°)',
  rom_ext:  'ROM伸展(°)',
  lsi:      'LSI(%)',
  mmt:      'MMT',
  swelling: '腫脹(cm)',
}

/* フォールバック：紫・インジゴを除外 */
const FALLBACK_COLORS = ['#0d9488', '#0284c7', '#f97316', '#ec4899', '#10b981', '#0ea5e9']

function getColor(key: string, index: number): string {
  return METRIC_COLORS[key.toLowerCase()] ?? FALLBACK_COLORS[index % FALLBACK_COLORS.length]
}

function getLabel(key: string): string {
  return METRIC_LABELS[key.toLowerCase()] ?? key
}

/* ──────────────────────────────────────
   カスタムツールチップ
   CSS カスタムプロパティ使用でダークモード対応
────────────────────────────────────── */
function CustomTooltip({ active, payload, label }: {
  active?: boolean
  payload?: Array<{ name: string; value: number; color: string }>
  label?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: 'var(--color-surface-card)',
      border: '1px solid rgba(148,163,184,0.3)',
      borderRadius: '12px',
      boxShadow: '0 4px 12px rgba(0,0,0,0.10)',
      padding: '10px 14px',
      minWidth: '148px',
    }}>
      {/* 日付ラベル */}
      <div style={{
        fontSize: '10px',
        fontWeight: 700,
        color: 'var(--color-text-muted)',
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        marginBottom: '7px',
      }}>
        {label}
      </div>
      {payload.map((entry, i) => (
        <div key={i} style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          fontSize: '12px',
          marginBottom: i < payload.length - 1 ? '5px' : 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{
              width: '7px', height: '7px',
              borderRadius: '50%',
              background: entry.color,
              flexShrink: 0,
              display: 'inline-block',
            }} />
            <span style={{ color: 'var(--color-text-secondary)' }}>{getLabel(entry.name)}</span>
          </div>
          <span style={{
            fontFamily: 'var(--font-ibm-plex-mono, monospace)',
            fontVariantNumeric: 'tabular-nums',
            fontWeight: 600,
            color: 'var(--color-text-primary)',
            letterSpacing: '-0.01em',
          }}>
            {entry.value}
          </span>
        </div>
      ))}
    </div>
  )
}

/* ──────────────────────────────────────
   カスタム参照線ラベル（移行基準値）
────────────────────────────────────── */
function ThresholdLabel({ viewBox, label }: {
  viewBox?: { x?: number; y?: number; width?: number }
  label: string
}) {
  if (!viewBox) return null
  const x = (viewBox.x ?? 0) + (viewBox.width ?? 0) - 4
  const y = viewBox.y ?? 0
  return (
    <text
      x={x}
      y={y - 4}
      fill="#0d9488"
      fontSize={9}
      fontWeight={700}
      letterSpacing="0.05em"
      textAnchor="end"
      style={{ fontFamily: 'var(--font-ibm-plex-mono, monospace)', textTransform: 'uppercase' }}
    >
      {label}
    </text>
  )
}

export default function ProgressChart({ assessments, metricKeys, thresholds }: Props) {
  const { data, keys } = useMemo(() => {
    if (assessments.length === 0) return { data: [], keys: [] }

    const allKeys = metricKeys ?? Array.from(
      new Set(assessments.flatMap(a => Object.keys(a.metrics)))
    )

    const sorted = assessments
      .slice()
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(a => ({
        date: new Date(a.date).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' }),
        ...Object.fromEntries(allKeys.map(k => [k, a.metrics[k] ?? null])),
      }))

    return { data: sorted, keys: allKeys }
  }, [assessments, metricKeys])

  if (assessments.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-40 bg-[--color-surface-raised]
        rounded-xl border border-dashed border-slate-300">
        <p className="text-sm text-[--color-text-muted] font-body">
          評価データがありません。記録を追加してください。
        </p>
      </div>
    )
  }

  /* グラフに描画する参照線（表示するメトリクスキーと一致するもののみ） */
  const activeThresholds = thresholds?.filter(t => keys.includes(t.key)) ?? []

  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={data} margin={{ top: 16, right: 16, left: -8, bottom: 4 }}>
        {/* グリッド：水平線のみ、極細 */}
        <CartesianGrid
          strokeDasharray="3 3"
          stroke="rgba(148,163,184,0.18)"
          vertical={false}
        />

        {/* X軸 */}
        <XAxis
          dataKey="date"
          tick={{ fontSize: 11, fill: '#94a3b8' /* text-muted */ }}
          tickLine={false}
          axisLine={{ stroke: 'rgba(148,163,184,0.25)' }}
        />

        {/* Y軸 */}
        <YAxis
          tick={{ fontSize: 11, fill: '#94a3b8' /* text-muted */ }}
          tickLine={false}
          axisLine={false}
          width={32}
        />

        {/* ツールチップ（CSS変数でダークモード対応） */}
        <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'rgba(148,163,184,0.3)', strokeWidth: 1 }} />

        {/* 凡例 */}
        <Legend
          formatter={(value) => getLabel(value)}
          wrapperStyle={{ fontSize: '11px', color: '#64748b', paddingTop: '8px' }}
        />

        {/* 移行基準参照線 */}
        {activeThresholds.map(t => (
          <ReferenceLine
            key={`ref-${t.key}`}
            y={t.value}
            stroke="#0d9488"
            strokeDasharray="5 3"
            strokeWidth={1.5}
            strokeOpacity={0.6}
            label={<ThresholdLabel label={t.label} />}
          />
        ))}

        {/* データ折れ線 */}
        {keys.map((key, i) => (
          <Line
            key={key}
            type="monotone"
            dataKey={key}
            stroke={getColor(key, i)}
            strokeWidth={2.5}
            dot={{ r: 4, fill: getColor(key, i), strokeWidth: 2, stroke: 'var(--color-surface-card)' }}
            activeDot={{ r: 6, strokeWidth: 2, stroke: 'var(--color-surface-card)' }}
            connectNulls
            name={key}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  )
}
