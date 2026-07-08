'use client'
// ──────────────────────────────────────────────
// 定型文ピッカー（カテゴリ選択＋一覧から挿入）
// ──────────────────────────────────────────────
import { useState } from 'react'
import type { TemplateCategory } from '@/types/templates'

interface Props {
  categories: TemplateCategory[]
  onSelect: (text: string) => void
  label?: string
}

export default function TemplatePicker({ categories, onSelect, label = '定型文から選ぶ' }: Props) {
  const [open, setOpen] = useState(false)
  const [activeCat, setActiveCat] = useState(categories[0]?.id ?? '')

  if (categories.length === 0) return null

  return (
    <div className="flex-shrink-0">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="text-xs text-teal-600 hover:text-teal-800 font-medium whitespace-nowrap"
      >
        {open ? '✕ 定型文を閉じる' : `📋 ${label}`}
      </button>

      {open && (
        <div className="mt-1.5 mb-2 rounded-lg border border-teal-100 bg-teal-50/50 p-3 space-y-2">
          <div className="flex flex-wrap gap-1.5">
            {categories.map(cat => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setActiveCat(cat.id)}
                className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                  activeCat === cat.id
                    ? 'bg-teal-600 text-white'
                    : 'bg-white text-gray-600 border border-gray-200 hover:border-teal-300'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
          <div className="space-y-1.5 max-h-48 overflow-y-auto">
            {categories.find(c => c.id === activeCat)?.templates.map((t, i) => (
              <button
                key={i}
                type="button"
                onClick={() => { onSelect(t); setOpen(false) }}
                className="block w-full text-left text-xs text-gray-700 bg-white border border-gray-100 rounded-lg px-3 py-2 hover:border-teal-300 hover:bg-teal-50 transition-colors"
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
