'use client'
/**
 * 経費・利益（損益分岐点）— 院長のみ・経営メニュー（隠しモード）の中
 *
 * 固定費（家賃・人件費など）と変動費の割合、その月だけの出費を入れると、
 * 売上（NOAH＋NOAH以外）から月の利益・利益率・損益分岐点を出す。
 * 計算は lib/marketing/profit.ts（架空の数字で単体テストあり）。設定は KV（keiei:expenses）に保存。
 */
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Plus, Save, Trash2 } from 'lucide-react'
import { useMarketingRole } from '@/lib/marketing/use-role'
import type { NoahStore } from '@/lib/marketing/noah-types'
import type { ExtraMonth } from '@/app/api/marketing/keiei-extra/route'
import { monthTotals, type ExtraMonthLike } from '@/lib/marketing/monthly-report'
import { remainingOpenDays } from '@/lib/marketing/goal-plan'
import { EMPTY_SETTINGS, monthProfit, revenueForProfit, sum, type CostItem, type ExpenseSettings, type MonthProfit } from '@/lib/marketing/profit'

const GOAL_KEY = 'keiei:goal'
const yen = (n: number) => `${Math.round(n).toLocaleString('ja-JP')}円`
const man = (n: number) => `${(n / 10_000).toFixed(Math.abs(n) >= 1_000_000 ? 0 : 1)}万円`
const ym = (m: string) => `${Number(m.slice(0, 4))}年${Number(m.slice(5, 7))}月`
const newId = () => Math.random().toString(36).slice(2, 8)

function readGoal(): number | null {
  try {
    const v = Number(window.localStorage.getItem(GOAL_KEY))
    return Number.isFinite(v) && v > 0 ? v : null
  } catch {
    return null
  }
}

function ItemsEditor({ items, onChange, placeholder }: { items: CostItem[]; onChange: (items: CostItem[]) => void; placeholder: string }) {
  return (
    <div className="space-y-1.5">
      {items.map((it) => (
        <div key={it.id} className="flex items-center gap-2">
          <input value={it.label} onChange={(e) => onChange(items.map((x) => (x.id === it.id ? { ...x, label: e.target.value } : x)))} className="min-w-0 flex-1 rounded-md border border-slate-300 px-2 py-1 text-sm" placeholder={placeholder} />
          <input
            type="number"
            inputMode="numeric"
            min={0}
            value={it.amount || ''}
            onChange={(e) => onChange(items.map((x) => (x.id === it.id ? { ...x, amount: Number(e.target.value) || 0 } : x)))}
            className="w-24 shrink-0 rounded-md border border-slate-300 px-2 py-1 text-right text-sm tabular-nums sm:w-32"
            placeholder="0"
          />
          <span className="text-xs text-slate-500">円</span>
          <button type="button" onClick={() => onChange(items.filter((x) => x.id !== it.id))} className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600" title="消す">
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ))}
      <button type="button" onClick={() => onChange([...items, { id: newId(), label: '', amount: 0 }])} className="inline-flex items-center gap-1 rounded-md border border-dashed border-slate-300 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50">
        <Plus className="h-3.5 w-3.5" />
        項目を足す
      </button>
    </div>
  )
}

export default function ProfitPage() {
  const { isAdmin } = useMarketingRole()
  const [settings, setSettings] = useState<ExpenseSettings | null>(null)
  const [store, setStore] = useState<NoahStore | null>(null)
  const [extras, setExtras] = useState<ExtraMonth[]>([])
  const [month, setMonth] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [dirty, setDirty] = useState(false)
  const [goal, setGoal] = useState<number | null>(null)

  useEffect(() => {
    Promise.all([
      fetch('/api/marketing/keiei-expenses', { cache: 'no-store' }).then(async (r) => (r.ok ? ((await r.json()) as { settings: ExpenseSettings }) : null)),
      fetch('/api/marketing/noah?lite=1', { cache: 'no-store' }).then(async (r) => (r.ok ? ((await r.json()) as { store: NoahStore | null }) : null)),
      fetch('/api/marketing/keiei-extra', { cache: 'no-store' }).then(async (r) => (r.ok ? ((await r.json()) as { months: ExtraMonth[] }) : null)),
    ])
      .then(([s, n, e]) => {
        setSettings(s?.settings ?? EMPTY_SETTINGS)
        setStore(n?.store ?? null)
        setExtras(e?.months ?? [])
        setGoal(readGoal())
      })
      .catch(() => setError('読み込めませんでした'))
  }, [])

  const months = useMemo(() => [...(store?.months ?? [])].sort((a, b) => b.month.localeCompare(a.month)), [store])
  const extraMap = useMemo<Record<string, ExtraMonthLike>>(() => Object.fromEntries(extras.map((e) => [e.month, e])), [extras])
  const selected = month || months[0]?.month || ''

  const results = useMemo<MonthProfit[]>(() => {
    if (!settings) return []
    return months.slice(0, 13).map((m) => {
      const t = monthTotals(m, extraMap[m.month])
      const rem = t.complete ? 0 : (() => {
        const r = remainingOpenDays(m.month, t.throughDay)
        return r.week + r.sat
      })()
      return monthProfit({ month: m.month, sales: t.sales, outside: t.outside, visits: t.visits, openDays: t.openDays, remainingOpenDays: rem }, settings)
    })
  }, [months, extraMap, settings])
  const current = results.find((r) => r.month === selected) ?? null
  const currentTotals = useMemo(() => {
    const m = months.find((x) => x.month === selected)
    return m ? monthTotals(m, extraMap[m.month]) : null
  }, [months, extraMap, selected])

  const update = (patch: Partial<ExpenseSettings>) => {
    setSettings((s) => (s ? { ...s, ...patch } : s))
    setDirty(true)
    setMessage('')
  }

  const save = async () => {
    if (!settings) return
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/marketing/keiei-expenses', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(settings) })
      const d = (await res.json()) as { ok?: boolean; error?: string; settings?: ExpenseSettings }
      if (!res.ok || !d.ok) throw new Error(d.error ?? `HTTP ${res.status}`)
      setSettings(d.settings ?? settings)
      setDirty(false)
      setMessage('保存しました')
    } catch (e) {
      setError(e instanceof Error ? e.message : '保存できませんでした')
    } finally {
      setSaving(false)
    }
  }

  if (!isAdmin) return <p className="text-sm text-slate-600">この画面は院長だけが使えます。</p>

  const oneOffItems = settings?.oneOff[selected] ?? []
  const fixedTotal = settings ? sum(settings.fixed) : 0

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-black text-slate-900">経費・利益（損益分岐点）</h1>
          <p className="text-xs text-slate-500">売上（NOAH＋NOAH以外）から経費を引いた、税引き前の利益の目安です。税務の判断は税理士さんにご確認ください。</p>
        </div>
        <select value={selected} onChange={(e) => setMonth(e.target.value)} className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm">
          {months.map((m) => (
            <option key={m.month} value={m.month}>
              {ym(m.month)}
            </option>
          ))}
        </select>
      </div>

      {error && <p className="text-sm text-red-700">{error}</p>}
      {!settings && !error && <p className="text-sm text-slate-500">読み込み中…</p>}

      {settings && current && currentTotals && (
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="text-xs text-slate-500">売上（合計）{!currentTotals.complete && <span className="ml-1 text-amber-700">{currentTotals.throughDay}日まで</span>}</div>
            <div className="text-2xl font-black tabular-nums text-slate-900">{man(current.revenue)}</div>
            <div className="text-xs text-slate-500">NOAH {man(currentTotals.sales)}＋その他 {man(currentTotals.outside)}</div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="text-xs text-slate-500">経費</div>
            <div className="text-2xl font-black tabular-nums text-slate-900">{man(current.expenses)}</div>
            <div className="text-xs text-slate-500">固定 {man(current.fixed)}／変動 {man(current.variable)}{current.oneOff ? `／臨時 ${man(current.oneOff)}` : ''}</div>
          </div>
          <div className={`rounded-xl border p-4 ${current.profit >= 0 ? 'border-emerald-200 bg-emerald-50' : 'border-red-200 bg-red-50'}`}>
            <div className="text-xs text-slate-600">利益（税引き前）</div>
            <div className={`text-2xl font-black tabular-nums ${current.profit >= 0 ? 'text-emerald-800' : 'text-red-800'}`}>{current.profit < 0 ? '−' : ''}{man(Math.abs(current.profit))}</div>
            <div className="text-xs text-slate-600">利益率 {current.margin === null ? '—' : `${Math.round(current.margin * 100)}%`}{current.projected ? `／このペースの月末 ${current.projected.profit < 0 ? '−' : ''}${man(Math.abs(current.projected.profit))}` : ''}</div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="text-xs text-slate-500">損益分岐点の売上</div>
            <div className="text-2xl font-black tabular-nums text-slate-900">{man(current.breakEven)}</div>
            <div className="text-xs text-slate-500">
              {current.toBreakEven > 0 ? `あと ${man(current.toBreakEven)}` : '超えています'}
              {current.breakEvenVisits !== null ? `／来院 約${current.breakEvenVisits}回分` : ''}
            </div>
          </div>
        </section>
      )}

      {settings && goal && current && (
        <p className="text-xs text-slate-600">
          今月の売上目標 {man(goal)}（<Link href="/marketing/sales/goal" className="underline">月の目標への道すじ</Link>）のとき、利益の目安は {man(goal - (current.fixed + current.oneOff + Math.round(goal * (settings.variableRate / 100))))}。
          利益を 30万円 残すには売上 {man(revenueForProfit(300_000, settings, selected))} が目安です。
        </p>
      )}

      {settings && (
        <section className="grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <h2 className="font-bold text-slate-900">毎月の固定費 <span className="ml-1 text-sm font-normal text-slate-500">合計 {yen(fixedTotal)}</span></h2>
            <p className="mb-2 text-xs text-slate-500">院長の報酬を入れるかは院長の決め方次第です（入れると「手元に残る利益」、入れないと「院の利益」）。</p>
            <ItemsEditor items={settings.fixed} onChange={(fixed) => update({ fixed })} placeholder="項目名（例：家賃）" />
            <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
              <label className="text-slate-700">売上に比例する変動費（消耗品・テーピングなど）</label>
              <input type="number" min={0} max={95} step={0.5} value={settings.variableRate} onChange={(e) => update({ variableRate: Number(e.target.value) || 0 })} className="w-20 rounded-md border border-slate-300 px-2 py-1 text-right tabular-nums" />
              <span className="text-slate-500">%</span>
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <h2 className="font-bold text-slate-900">{ym(selected || '2026-01')}だけの出費（臨時）</h2>
            <p className="mb-2 text-xs text-slate-500">機器の修理、研修、税金・保険の年払いなど。</p>
            <ItemsEditor items={oneOffItems} onChange={(items) => update({ oneOff: { ...settings.oneOff, [selected]: items } })} placeholder="項目名（例：機器の修理）" />
          </div>
        </section>
      )}

      {settings && (
        <div className="flex items-center gap-3">
          <button type="button" onClick={save} disabled={saving || !dirty} className="inline-flex items-center gap-1 rounded-md bg-teal-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">
            <Save className="h-4 w-4" />
            {saving ? '保存中…' : '経費の設定を保存'}
          </button>
          {message && <span className="text-sm text-emerald-700">{message}</span>}
          {dirty && !message && <span className="text-xs text-amber-700">まだ保存していません</span>}
        </div>
      )}

      {results.length > 0 && (
        <section className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="px-2 py-2 text-left">月</th>
                <th className="px-2 py-2 text-right">売上（合計）</th>
                <th className="px-2 py-2 text-right">経費</th>
                <th className="px-2 py-2 text-right">利益</th>
                <th className="px-2 py-2 text-right">利益率</th>
                <th className="px-2 py-2 text-right">分岐点まで</th>
              </tr>
            </thead>
            <tbody>
              {results.map((r) => (
                <tr key={r.month} className={`border-t border-slate-100 ${r.month === selected ? 'bg-teal-50/60' : ''}`}>
                  <td className="px-2 py-1 text-slate-700">{ym(r.month)}{r.projected && <span className="ml-1 text-xs text-amber-700">途中</span>}</td>
                  <td className="px-2 py-1 text-right tabular-nums">{r.revenue.toLocaleString('ja-JP')}</td>
                  <td className="px-2 py-1 text-right tabular-nums">{r.expenses.toLocaleString('ja-JP')}</td>
                  <td className={`px-2 py-1 text-right font-bold tabular-nums ${r.profit >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>{r.profit.toLocaleString('ja-JP')}</td>
                  <td className="px-2 py-1 text-right tabular-nums">{r.margin === null ? '—' : `${Math.round(r.margin * 100)}%`}</td>
                  <td className="px-2 py-1 text-right tabular-nums">{r.toBreakEven > 0 ? r.toBreakEven.toLocaleString('ja-JP') : '超'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="px-3 py-2 text-xs text-slate-500">固定費と変動費の割合は、すべての月に同じ値で当てています（月ごとの違いは「臨時の出費」で）。</p>
        </section>
      )}
    </div>
  )
}
