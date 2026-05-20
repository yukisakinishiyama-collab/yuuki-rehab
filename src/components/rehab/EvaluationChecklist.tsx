'use client'

import { useEffect, useState } from 'react'
import type { MovementType, EvaluationItem, EvaluationResult } from '@/types/rehab'
import { MOVEMENT_TYPE_LABELS, EVALUATION_TEMPLATES } from '@/types/rehab'
import { getEvaluation, saveEvaluation, getCurrentUser, generateId } from '@/lib/rehab-store'
import { ClipboardList, Save, CheckCircle } from 'lucide-react'

interface Props {
  caseId: string
  videoId: string
  movementType: MovementType
}

type Severity = EvaluationItem['severity']

const SEVERITY_OPTIONS: Array<{ value: Severity; label: string; color: string }> = [
  { value: 'none', label: 'なし', color: 'text-green-700 bg-green-50 border-green-300' },
  { value: 'mild', label: '軽度', color: 'text-yellow-700 bg-yellow-50 border-yellow-300' },
  { value: 'moderate', label: '中等度', color: 'text-orange-700 bg-orange-50 border-orange-300' },
  { value: 'severe', label: '重度', color: 'text-red-700 bg-red-50 border-red-300' },
]

function initItems(movementType: MovementType): EvaluationItem[] {
  return (EVALUATION_TEMPLATES[movementType] ?? EVALUATION_TEMPLATES.other).map((t) => ({
    key: t.key,
    label: t.label,
    severity: '' as Severity,
    checked: false,
    note: '',
  }))
}

export default function EvaluationChecklist({ caseId, videoId, movementType }: Props) {
  const user = getCurrentUser()
  const [items, setItems] = useState<EvaluationItem[]>([])
  const [overallNote, setOverallNote] = useState('')
  const [saved, setSaved] = useState(false)
  const [existingId, setExistingId] = useState<string | undefined>()

  useEffect(() => {
    const existing = getEvaluation(caseId, videoId)
    if (existing) {
      setItems(existing.items)
      setOverallNote(existing.overallNote)
      setExistingId(existing.id)
    } else {
      setItems(initItems(movementType))
    }
  }, [caseId, videoId, movementType])

  function updateItem(key: string, updates: Partial<EvaluationItem>) {
    setItems((prev) => prev.map((it) => (it.key === key ? { ...it, ...updates } : it)))
    setSaved(false)
  }

  function handleSave() {
    if (!user) return
    const result: EvaluationResult = {
      id: existingId ?? generateId('eval'),
      caseId,
      videoId,
      movementType,
      items,
      overallNote,
      evaluatedBy: user.id,
      evaluatedByName: user.name,
      evaluatedAt: new Date().toISOString(),
    }
    saveEvaluation(result)
    setExistingId(result.id)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const checkedCount = items.filter((i) => i.checked || i.severity !== '').length

  return (
    <div className="flex flex-col space-y-3">
      <div className="flex items-center gap-2">
        <ClipboardList className="w-4 h-4 text-[#0d9488]" />
        <h3 className="font-semibold text-gray-900 text-sm">
          {MOVEMENT_TYPE_LABELS[movementType]} 評価
        </h3>
        {checkedCount > 0 && (
          <span className="text-xs bg-[#0d9488] text-white px-1.5 py-0.5 rounded-full ml-auto">
            {checkedCount}/{items.length}
          </span>
        )}
      </div>

      <div className="space-y-2 pr-1">
        {items.map((item) => (
          <div
            key={item.key}
            className={`rounded-lg border p-3 transition-colors ${
              item.checked || item.severity !== ''
                ? 'border-[#0d9488]/30 bg-teal-50/30'
                : 'border-gray-100 bg-gray-50'
            }`}
          >
            <div className="flex items-start gap-2 mb-2">
              <input
                type="checkbox"
                id={`${videoId}-${item.key}`}
                checked={item.checked}
                onChange={(e) => updateItem(item.key, { checked: e.target.checked })}
                className="mt-0.5 w-3.5 h-3.5 accent-[#0d9488] flex-shrink-0"
              />
              <label
                htmlFor={`${videoId}-${item.key}`}
                className="text-xs font-medium text-gray-800 cursor-pointer leading-tight"
              >
                {item.label}
              </label>
            </div>

            <div className="flex gap-1 flex-wrap ml-5">
              {SEVERITY_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() =>
                    updateItem(item.key, {
                      severity: opt.value,
                      checked: opt.value !== 'none' && opt.value !== '',
                    })
                  }
                  className={`px-2 py-0.5 rounded-full text-xs border transition-colors ${
                    item.severity === opt.value
                      ? opt.color
                      : 'border-gray-200 text-gray-400 hover:border-gray-300'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {(item.checked || item.severity !== '') && (
              <input
                type="text"
                value={item.note}
                onChange={(e) => updateItem(item.key, { note: e.target.value })}
                placeholder="所見メモ..."
                className="w-full mt-2 px-2 py-1 text-xs border border-gray-200 rounded bg-white focus:outline-none focus:ring-1 focus:ring-[#0d9488] ml-5"
              />
            )}
          </div>
        ))}
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">総合所見</label>
        <textarea
          rows={3}
          value={overallNote}
          onChange={(e) => { setOverallNote(e.target.value); setSaved(false) }}
          placeholder="全体的な動作の特徴・問題点・注意事項を記載..."
          className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0d9488] resize-none"
        />
      </div>

      <button
        onClick={handleSave}
        className={`flex items-center justify-center gap-2 w-full py-2 rounded-lg text-sm font-medium transition-colors ${
          saved
            ? 'bg-green-100 text-green-800 border border-green-300'
            : 'bg-[#0d9488] hover:bg-[#0b8276] text-white'
        }`}
      >
        {saved ? (
          <>
            <CheckCircle className="w-4 h-4" />
            保存しました
          </>
        ) : (
          <>
            <Save className="w-4 h-4" />
            評価を保存
          </>
        )}
      </button>
    </div>
  )
}
