'use client'
// ──────────────────────────────────────────────
// 共通UIコンポーネント（リハビリ管理専用）
// ──────────────────────────────────────────────
import type { ReactNode } from 'react'
import type { RiskLevel, RehabPhase } from '@/types/patient'
import { PHASE_SHORT_LABELS, RISK_LABELS } from '@/types/patient'
import { cn } from '@/lib/utils'

// ── ProgressGauge（SVG円形ゲージ）──
export function ProgressGauge({ score, size = 120 }: { score: number; size?: number }) {
  const r = size * 0.38
  const cx = size / 2
  const cy = size / 2
  const circumference = 2 * Math.PI * r
  const progress = Math.max(0, Math.min(100, score))
  const dashOffset = circumference * (1 - progress / 100)
  const color = progress >= 70 ? '#0d9488' : progress >= 40 ? '#f59e0b' : '#94a3b8'

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={cx} cy={cy} r={r} stroke="#f1f5f9" strokeWidth={size * 0.08} fill="none" />
      <circle
        cx={cx} cy={cy} r={r}
        stroke={color} strokeWidth={size * 0.08} fill="none"
        strokeDasharray={`${circumference}`}
        strokeDashoffset={dashOffset}
        strokeLinecap="round"
        transform={`rotate(-90 ${cx} ${cy})`}
        style={{ transition: 'stroke-dashoffset 0.6s ease' }}
      />
      <text x={cx} y={cy} textAnchor="middle" dominantBaseline="central"
        fontSize={size * 0.22} fontWeight="700" fill={color}>
        {progress}
      </text>
      <text x={cx} y={cy + size * 0.2} textAnchor="middle"
        fontSize={size * 0.1} fill="#94a3b8">
        / 100
      </text>
    </svg>
  )
}

// ── PhaseStepper ──
export function PhaseStepper({ currentPhase }: { currentPhase: RehabPhase }) {
  const phases: RehabPhase[] = [1, 2, 3, 4, 5, 6]
  return (
    <div className="w-full">
      <div className="flex items-center">
        {phases.map((phase, idx) => {
          const isCompleted = phase < currentPhase
          const isCurrent = phase === currentPhase
          return (
            <div key={phase} className="flex items-center flex-1">
              <div className="flex flex-col items-center">
                <div className={cn(
                  'w-8 h-8 rounded-full border-2 flex items-center justify-center text-xs font-bold transition-colors',
                  isCompleted ? 'bg-teal-600 border-teal-600 text-white' :
                  isCurrent   ? 'bg-teal-600 border-teal-600 text-white ring-2 ring-teal-200 ring-offset-1' :
                                'bg-white border-gray-200 text-gray-400'
                )}>
                  {isCompleted ? '✓' : phase}
                </div>
                {isCurrent && (
                  <span className="text-[9px] text-teal-600 font-semibold mt-1 whitespace-nowrap">現在</span>
                )}
              </div>
              {idx < phases.length - 1 && (
                <div className={cn(
                  'flex-1 h-0.5 mx-1',
                  phase < currentPhase ? 'bg-teal-600' : 'bg-gray-200'
                )} />
              )}
            </div>
          )
        })}
      </div>
      <div className="mt-2 text-center">
        <span className="text-sm font-medium text-gray-700">{PHASE_SHORT_LABELS[currentPhase]}</span>
      </div>
    </div>
  )
}

// ── RetentionRiskBadge ──
export function RetentionRiskBadge({ level }: { level: RiskLevel }) {
  const styles: Record<RiskLevel, string> = {
    low:    'bg-green-50 text-green-700 border border-green-200',
    medium: 'bg-yellow-50 text-yellow-700 border border-yellow-200',
    high:   'bg-red-50 text-red-700 border border-red-200',
  }
  return (
    <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium', styles[level])}>
      離脱リスク: {RISK_LABELS[level]}
    </span>
  )
}

// ── RedFlagAlert ──
export function RedFlagAlert({ flags }: { flags: Record<string, boolean | string> }) {
  const activeFlags = Object.entries(flags).filter(([, v]) => v && v !== '')
  if (activeFlags.length === 0) return null
  return (
    <div className="rounded-lg bg-red-50 border border-red-200 p-4 mb-4">
      <div className="flex items-start gap-3">
        <span className="text-red-500 text-lg flex-shrink-0">⚠️</span>
        <div>
          <p className="font-semibold text-red-700 text-sm">レッドフラッグが確認されています</p>
          <p className="text-red-600 text-xs mt-1">医療機関への受診を検討してください。このアプリは診断を行いません。</p>
          <p className="text-red-500 text-xs mt-1">強い痛み・しびれ・脱力・夜間痛・発熱・急な悪化がある場合は医師に相談してください。</p>
        </div>
      </div>
    </div>
  )
}

// ── NRS入力スライダー ──
export function NRSInput({
  value,
  onChange,
  label = '痛みの強さ（NRS）',
}: {
  value: number
  onChange: (v: number) => void
  label?: string
}) {
  const nrsColor = value >= 7 ? 'text-red-600' : value >= 4 ? 'text-yellow-600' : 'text-green-600'
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-gray-700">{label}</label>
      <div className="flex items-center gap-4">
        <input
          type="range" min={0} max={10} step={1}
          value={value}
          onChange={e => onChange(Number(e.target.value))}
          className="flex-1 h-2 rounded-full appearance-none cursor-pointer accent-teal-600"
        />
        <span className={cn('text-2xl font-bold w-8 text-center tabular-nums', nrsColor)}>{value}</span>
      </div>
      <div className="flex justify-between text-xs text-gray-400">
        <span>0 痛みなし</span>
        <span>10 最大の痛み</span>
      </div>
    </div>
  )
}

// ── Card ──
export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('rounded-xl border border-gray-200 bg-white shadow-sm', className)}>
      {children}
    </div>
  )
}

export function CardHeader({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={cn('px-6 pt-5 pb-3', className)}>{children}</div>
}

export function CardContent({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={cn('px-6 pb-5', className)}>{children}</div>
}

// ── SectionTitle ──
export function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h3 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
      <span className="w-1 h-4 bg-teal-600 rounded-full inline-block" />
      {children}
    </h3>
  )
}

// ── FormLabel ──
export function FormLabel({ children, required }: { children: ReactNode; required?: boolean }) {
  return (
    <label className="block text-sm font-medium text-gray-700 mb-1.5">
      {children}
      {required && <span className="text-red-500 ml-1 text-xs">必須</span>}
    </label>
  )
}

// ── Textarea ──
export function Textarea({
  value,
  onChange,
  placeholder,
  rows = 3,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  rows?: number
}) {
  return (
    <textarea
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      className="flex w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm placeholder:text-gray-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-offset-1 disabled:opacity-50 resize-none"
    />
  )
}

// ── Input ──
export function Input({
  value,
  onChange,
  placeholder,
  type = 'text',
  className = '',
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  type?: string
  className?: string
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className={cn(
        'flex h-10 w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm placeholder:text-gray-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-offset-1 disabled:opacity-50',
        className
      )}
    />
  )
}

// ── ToggleSwitch ──
export function ToggleSwitch({
  label,
  value,
  onChange,
}: {
  label: string
  value: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <label className="flex items-center gap-3 cursor-pointer">
      <button
        type="button"
        role="switch"
        aria-checked={value}
        onClick={() => onChange(!value)}
        className={cn(
          'relative w-11 h-6 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600',
          value ? 'bg-teal-600' : 'bg-gray-200'
        )}
      >
        <span className={cn(
          'absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform',
          value ? 'translate-x-5' : 'translate-x-0'
        )} />
      </button>
      <span className="text-sm text-gray-700">{label}</span>
    </label>
  )
}

// ── Badge ──
export function Badge({
  children,
  color = 'gray',
}: {
  children: ReactNode
  color?: 'gray' | 'green' | 'red' | 'yellow' | 'teal' | 'blue' | 'purple'
}) {
  const styles: Record<string, string> = {
    gray:   'bg-gray-100 text-gray-700',
    green:  'bg-green-100 text-green-700',
    red:    'bg-red-100 text-red-700',
    yellow: 'bg-yellow-100 text-yellow-700',
    teal:   'bg-teal-100 text-teal-700',
    blue:   'bg-blue-100 text-blue-700',
    purple: 'bg-purple-100 text-purple-700',
  }
  return (
    <span className={cn('inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium', styles[color])}>
      {children}
    </span>
  )
}

// ── SaveButton ──
export function SaveButton({
  onClick,
  loading,
  label = '保存',
}: {
  onClick: () => void
  loading?: boolean
  label?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className="inline-flex items-center gap-2 h-10 px-5 bg-teal-600 text-white rounded-md text-sm font-medium hover:bg-teal-700 disabled:opacity-50 disabled:pointer-events-none transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-offset-2"
    >
      {loading && (
        <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
      )}
      {label}
    </button>
  )
}
