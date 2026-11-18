'use client'
// ──────────────────────────────────────────────
// SOAP の欄＋「文を選ぶ」（タップで文を入れる。2026-11-18 院長の依頼）
//
// 見出しの右の「文を選ぶ」を押すと、その欄で使う文が出る。押すと欄のうしろに足し、もう一度押すと外す。
// 手で書いた文字は消さない。開いたままにできるので、続けていくつも選べる。
// 文は src/data/soap-phrases.ts、入れ方の決まりは src/lib/karte/soap-phrases.ts
// ──────────────────────────────────────────────
import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import type { BodyRegion } from '@/types/patient'
import { PHRASE_BLANK, type SoapPhraseField as PhraseFieldKey } from '@/data/soap-phrases'
import {
  PHRASE_REGION_SHORT, blankSelection, hasPhrase, isSinglePhraseField, phraseGroups, phraseRegions, togglePhrase,
} from '@/lib/karte/soap-phrases'

interface Props {
  label: string
  field: PhraseFieldKey
  value: string
  onChange: (v: string) => void
  /** その方の部位（先に出す） */
  regions: BodyRegion[]
  /** その方だけの文（進行中の復帰プログラムの段階など）。いちばん上に出す */
  extra?: { label: string; phrases: string[] }
  /** 記入欄（Input・Textarea。見出しと欄の間にボタンなどを置くときも、ここに入れる） */
  children: ReactNode
}

export default function SoapPhraseField({ label, field, value, onChange, regions, extra, children }: Props) {
  const [open, setOpen] = useState(false)
  const [picked, setPicked] = useState<BodyRegion | null | undefined>(undefined)
  const panelId = useId()
  const wrap = useRef<HTMLDivElement>(null)
  /** 数字を書く文を足したあと、欄の ＿ を選ぶ位置（欄の文字が入れかわってから選ぶ） */
  const pendingBlank = useRef<[number, number] | null>(null)
  const fieldEl = () => wrap.current?.querySelector<HTMLTextAreaElement | HTMLInputElement>('textarea, input') ?? null

  useEffect(() => {
    const sel = pendingBlank.current
    if (!sel) return
    pendingBlank.current = null
    const el = fieldEl()
    if (el && el.value === value) el.setSelectionRange(sel[0], sel[1])
  }, [value])

  function pick(phrase: string, on: boolean) {
    const next = togglePhrase(value, phrase, single)
    onChange(next)
    if (on) return
    const sel = blankSelection(next, phrase)
    if (!sel) return
    // 数字を書く文：欄にカーソルを移して ＿ を選ぶ（そのまま数字を打てる）。スマホではここでキーボードが出る
    pendingBlank.current = sel
    fieldEl()?.focus()
  }

  const available = phraseRegions(field)
  const mine = regions.filter(r => available.includes(r))
  // 部位：自分で選んだもの（null＝部位なし）→ その方の部位 → なし
  const region = picked !== undefined ? picked : mine[0] ?? null
  const single = isSinglePhraseField(field)
  const groups = [
    ...(extra && extra.phrases.length > 0 ? [{ region: null, key: 'extra', label: extra.label, phrases: extra.phrases }] : []),
    ...phraseGroups(field, region).map(g => ({ ...g, key: g.region ?? 'common' })),
  ]
  const hasBlank = groups.some(g => g.phrases.some(x => x.includes(PHRASE_BLANK)))
  // その方の部位を先に、残りをあとに
  const tabs = [...mine, ...available.filter(r => !mine.includes(r))]

  return (
    <div ref={wrap}>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-gray-700">{label}</span>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen(v => !v)}
          className={`flex-shrink-0 rounded-full border px-3 py-1 text-xs font-medium transition-colors max-lg:min-h-10 ${
            open ? 'border-teal-700 bg-teal-700 text-white' : 'border-teal-200 bg-teal-50 text-teal-800 hover:border-teal-400'
          }`}
        >
          {open ? '閉じる' : '＋ 文を選ぶ'}
        </button>
      </div>

      {open && (
        <div id={panelId} role="group" aria-label={`${label}に入れる文`}
          className="mb-2 space-y-2 rounded-lg border border-teal-100 bg-teal-50/50 p-2.5">
          {tabs.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="部位">
              <span className="text-xs font-bold text-gray-600">部位</span>
              {tabs.map(r => {
                const on = region === r
                return (
                  <button key={r} type="button" aria-pressed={on}
                    onClick={() => setPicked(on ? null : r)}
                    className={`min-w-10 rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors max-lg:min-h-10 ${
                      on ? 'border-slate-700 bg-slate-700 text-white' : 'border-gray-200 bg-white text-gray-700 hover:border-slate-400'
                    }`}>
                    {PHRASE_REGION_SHORT[r]}
                  </button>
                )
              })}
            </div>
          )}
          {groups.map(g => (
            <div key={g.key} className="flex flex-wrap items-center gap-1.5">
              {g.label && <span className="w-full text-xs font-bold text-gray-600">{g.label}</span>}
              {g.phrases.map(p => {
                const on = single ? value.trim() === p : hasPhrase(value, p)
                return (
                  <button key={p} type="button" aria-pressed={on}
                    onClick={() => pick(p, on)}
                    className={`rounded-full border px-2.5 py-1 text-left text-xs font-medium transition-colors max-lg:min-h-10 ${
                      on ? 'border-teal-700 bg-teal-700 text-white' : 'border-gray-200 bg-white text-gray-700 hover:border-teal-300'
                    }`}>
                    {p}
                  </button>
                )
              })}
            </div>
          ))}
          <p className="text-xs text-gray-600">
            {single ? '押すと入れかわります。' : '押すと欄のうしろに足します。もう一度押すと外れます。'}
            {hasBlank && `「${PHRASE_BLANK}」のある文は、押したあとそのまま数字を打てます。`}
          </p>
        </div>
      )}

      {children}
    </div>
  )
}
