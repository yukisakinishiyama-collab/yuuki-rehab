'use client'

import type { Criterion } from '@/types/protocol'
import { Check, Circle } from 'lucide-react'

interface Props {
  criteria: Criterion[]
  onToggle?: (index: number) => void
  readOnly?: boolean
}

export default function CriteriaGauge({ criteria, onToggle, readOnly }: Props) {
  const met = criteria.filter(c => c.met).length
  const total = criteria.length
  const pct = total === 0 ? 0 : Math.round((met / total) * 100)
  const allMet = pct === 100

  return (
    <div className="space-y-3">
      {/* 達成バー */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-[--color-text-secondary] font-display tracking-wide uppercase">
            移行基準達成度
          </span>
          <span className="metric text-sm font-semibold text-[--color-primary]">
            {met} / {total} 項目
          </span>
        </div>

        {/* プログレスバー */}
        <div className="relative h-2 bg-slate-100 rounded-full overflow-hidden">
          <div
            className={`absolute inset-y-0 left-0 rounded-full transition-all duration-700 ease-out ${
              allMet
                ? 'bg-gradient-to-r from-emerald-400 to-emerald-500'
                : 'bg-gradient-to-r from-[--color-primary] to-[--color-primary-mid]'
            }`}
            style={{ width: `${pct}%` }}
          />
        </div>

        <div className="flex justify-between items-center mt-1.5">
          <div className="h-1" />
          {total > 0 && (
            <div className="text-xs font-body">
              {allMet ? (
                <span className="text-emerald-600 font-semibold flex items-center gap-1">
                  <Check className="w-3 h-3" />全基準クリア！次フェーズへ進めます
                </span>
              ) : (
                <span className="text-[--color-text-muted]">あと {total - met} 項目</span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 基準リスト */}
      <ul className="space-y-1.5">
        {criteria.map((c, i) => (
          <li
            key={i}
            role={!readOnly && onToggle ? 'checkbox' : undefined}
            aria-checked={!readOnly && onToggle ? c.met : undefined}
            tabIndex={!readOnly && onToggle ? 0 : undefined}
            className={`
              flex items-start gap-2.5 rounded-lg px-3 py-2.5 text-sm
              border transition-all duration-200
              ${c.met
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                : 'bg-[--color-surface-raised] border-slate-200 text-[--color-text-primary]'
              }
              ${!readOnly && onToggle
                ? 'cursor-pointer hover:border-[--color-primary] hover:bg-[--color-primary-light]/30 select-none'
                : ''
              }
            `}
            onClick={() => !readOnly && onToggle?.(i)}
            onKeyDown={e => (e.key === ' ' || e.key === 'Enter') && !readOnly && onToggle?.(i)}
          >
            <span className="flex-shrink-0 mt-0.5">
              {c.met ? (
                <span className="w-4 h-4 rounded-full bg-emerald-500 flex items-center justify-center">
                  <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />
                </span>
              ) : (
                <Circle className="w-4 h-4 text-slate-300" />
              )}
            </span>
            <div className="flex-1 min-w-0 font-body">
              <span className={`${c.met ? 'line-through text-emerald-700/70' : ''}`}>
                {c.label}
              </span>
              {c.target && (
                <span className="metric text-xs ml-2 text-[--color-text-muted]">
                  目標: {c.target}
                </span>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
