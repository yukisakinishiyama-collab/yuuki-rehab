'use client'
/**
 * 月次レポート（前月比・前年同月比）— 院長のみ・経営メニュー（隠しモード）の中
 *
 * NOAH の月ごとの集計と、NOAH以外の収入（サブスクなど）から、1つの月の数字と
 * 前月・前年同月との差を出す。計算は src/lib/marketing/monthly-report.ts（架空の数字で単体テストあり）。
 * 途中の月は「その日まで」で、比べる月も同じ日までで切る。
 */
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Copy, RefreshCcw } from 'lucide-react'
import { useMarketingRole } from '@/lib/marketing/use-role'
import type { NoahStore } from '@/lib/marketing/noah-types'
import type { ExtraMonth } from '@/app/api/marketing/keiei-extra/route'
import { buildReport, formatChange, formatValue, lastYearOf, reportText, tone, type Delta, type MetricDef } from '@/lib/marketing/monthly-report'

const ym = (m: string) => `${Number(m.slice(0, 4))}年${Number(m.slice(5, 7))}月`
const ymShort = (m: string) => `${m.slice(2, 4)}/${Number(m.slice(5, 7))}`
const man = (n: number) => (Math.abs(n) >= 10_000 ? `${(n / 10_000).toFixed(n >= 1_000_000 ? 0 : 1)}万` : String(Math.round(n)))

function DeltaCell({ def, d }: { def: MetricDef; d: Delta }) {
  const t = tone(def, d)
  const color = t === 'good' ? 'text-emerald-700' : t === 'bad' ? 'text-red-700' : 'text-slate-500'
  return (
    <td className={`px-2 py-1.5 text-right tabular-nums ${color}`}>
      <div className="font-bold">{formatChange(def, d)}</div>
      {d.before !== null && <div className="text-xs text-slate-400">{formatValue(def, d.before)}</div>}
    </td>
  )
}

export default function MonthlyReportPage() {
  const { isAdmin } = useMarketingRole()
  const [store, setStore] = useState<NoahStore | null>(null)
  const [extras, setExtras] = useState<ExtraMonth[]>([])
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState('')
  const [month, setMonth] = useState<string>('')
  const [copied, setCopied] = useState(false)

  const load = () =>
    Promise.all([
      fetch('/api/marketing/noah?lite=1', { cache: 'no-store' }).then(async (r) => (r.ok ? ((await r.json()) as { store: NoahStore | null }) : null)),
      fetch('/api/marketing/keiei-extra', { cache: 'no-store' }).then(async (r) => (r.ok ? ((await r.json()) as { months: ExtraMonth[] }) : null)),
    ])
      .then(([n, e]) => {
        setStore(n?.store ?? null)
        setExtras(e?.months ?? [])
        setError(n ? '' : 'NOAHの集計を読み込めませんでした')
        setLoaded(true)
      })
      .catch(() => {
        setError('読み込めませんでした')
        setLoaded(true)
      })

  useEffect(() => {
    void load()
  }, [])

  const months = useMemo(() => [...(store?.months ?? [])].sort((a, b) => b.month.localeCompare(a.month)), [store])
  const extraMap = useMemo(() => Object.fromEntries(extras.map((e) => [e.month, e])), [extras])
  const report = useMemo(() => (months.length ? buildReport(months, extraMap, month || undefined) : null), [months, extraMap, month])

  const trendRows = useMemo(
    () =>
      report
        ? [...report.trend].reverse().map((t) => ({
            label: ymShort(t.month),
            month: t.month,
            total: t.sales + t.outside,
            sales: t.sales,
            visits: t.visits,
            selfRatio: Math.round(t.selfRatio * 10) / 10,
            newPt: t.newPt ?? 0,
            partial: !t.complete,
          }))
        : [],
    [report],
  )

  const copy = async () => {
    if (!report) return
    try {
      await navigator.clipboard.writeText(reportText(report))
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      window.alert('コピーできませんでした')
    }
  }

  if (!isAdmin) return <p className="text-sm text-slate-600">この画面は院長だけが使えます。</p>

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-black text-slate-900">月次レポート</h1>
          <p className="text-xs text-slate-500">前月比・前年同月比。途中の月は、その日までの合計で、比べる月も同じ日までで切ります。NOAHの金額は保険の請求分も含めた総額です。</p>
        </div>
        <div className="flex items-center gap-2">
          <select value={month || (months[0]?.month ?? '')} onChange={(e) => setMonth(e.target.value)} className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm">
            {months.map((m) => (
              <option key={m.month} value={m.month}>
                {ym(m.month)}
                {Number(m.asOf.slice(8, 10)) < new Date(Number(m.month.slice(0, 4)), Number(m.month.slice(5, 7)), 0).getDate() ? `（${Number(m.asOf.slice(8, 10))}日まで）` : ''}
              </option>
            ))}
          </select>
          <button type="button" onClick={() => void load()} className="rounded-md border border-slate-300 bg-white p-2 text-slate-600 hover:bg-slate-50" title="読み直す">
            <RefreshCcw className="h-4 w-4" />
          </button>
          <button type="button" onClick={copy} disabled={!report} className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
            <Copy className="h-3.5 w-3.5" />
            {copied ? 'コピーしました' : '文にしてコピー'}
          </button>
        </div>
      </div>

      {!loaded && <p className="text-sm text-slate-500">読み込み中…</p>}
      {error && <p className="text-sm text-red-700">{error}</p>}
      {loaded && !report && !error && (
        <p className="text-sm text-slate-600">
          NOAH の集計がまだありません。毎晩の読み取りが届くと出ます（<Link href="/marketing/sales" className="underline">売上・来院</Link>）。
        </p>
      )}

      {report && (
        <>
          <section className="rounded-xl border border-slate-200 bg-white p-4">
            <h2 className="font-bold text-slate-900">
              {ym(report.current.month)}のまとめ
              {!report.current.complete && <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-800">{report.current.throughDay}日まで</span>}
            </h2>
            <ul className="mt-2 space-y-1 text-sm text-slate-800">
              {report.summary.map((s) => (
                <li key={s}>・{s}</li>
              ))}
            </ul>
          </section>

          <section className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs text-slate-500">
                <tr>
                  <th className="px-3 py-2 text-left">指標</th>
                  <th className="px-2 py-2 text-right">{ym(report.current.month)}</th>
                  <th className="px-2 py-2 text-right">前月比{report.prevMonth ? `（${ymShort(report.prevMonth.month)}）` : ''}</th>
                  <th className="px-2 py-2 text-right">前年同月比{report.lastYear ? `（${ymShort(lastYearOf(report.current.month))}）` : ''}</th>
                </tr>
              </thead>
              <tbody>
                {report.rows.map((row) => (
                  <tr key={row.def.key} className="border-t border-slate-100">
                    <td className="px-3 py-1.5 text-slate-700">{row.def.label}</td>
                    <td className="px-2 py-1.5 text-right font-bold tabular-nums text-slate-900">{formatValue(row.def, row.now)}</td>
                    <DeltaCell def={row.def} d={row.prev} />
                    <DeltaCell def={row.def} d={row.lastYear} />
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="px-3 py-2 text-xs text-slate-500">
              緑＝良い方向、赤＝気になる方向。新患・再初検・離反は NOAH の画面で読めた月だけ。NOAH以外の収入は月単位（途中の月は入っている分）。
            </p>
          </section>

          <section className="grid gap-4 rounded-xl border border-slate-200 bg-white p-4 md:grid-cols-2">
            <div className="min-w-0">
              <p className="text-xs font-bold text-slate-500">売上（合計）の推移・13か月</p>
              <div className="h-48 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={trendRows} margin={{ top: 10, right: 4, bottom: 0, left: 0 }}>
                    <CartesianGrid vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#64748b' }} tickLine={false} axisLine={{ stroke: '#e2e8f0' }} />
                    <YAxis tick={{ fontSize: 12, fill: '#64748b' }} tickLine={false} axisLine={false} width={44} tickFormatter={(v: number) => man(v)} />
                    <Tooltip formatter={(v) => [`${Math.round(Number(v)).toLocaleString('ja-JP')}円`, '売上（合計）']} labelFormatter={(l) => String(l)} />
                    <Bar dataKey="total" fill="#0f766e" maxBarSize={22} radius={[4, 4, 0, 0]} isAnimationActive={false} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-slate-500">来院（延べ）と自費の割合</p>
              <div className="h-48 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trendRows} margin={{ top: 10, right: 8, bottom: 0, left: 0 }}>
                    <CartesianGrid vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#64748b' }} tickLine={false} axisLine={{ stroke: '#e2e8f0' }} />
                    <YAxis yAxisId="v" tick={{ fontSize: 12, fill: '#64748b' }} tickLine={false} axisLine={false} width={36} />
                    <YAxis yAxisId="r" orientation="right" domain={[0, 100]} tick={{ fontSize: 12, fill: '#64748b' }} tickLine={false} axisLine={false} width={34} tickFormatter={(v: number) => `${v}%`} />
                    <Tooltip />
                    <Line yAxisId="v" type="monotone" dataKey="visits" name="来院" stroke="#0f766e" strokeWidth={2} dot={false} isAnimationActive={false} />
                    <Line yAxisId="r" type="monotone" dataKey="selfRatio" name="自費の割合(%)" stroke="#b45309" strokeWidth={2} dot={false} isAnimationActive={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </section>

          <section className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-2 py-2 text-left">月</th>
                  <th className="px-2 py-2 text-right">売上（合計）</th>
                  <th className="px-2 py-2 text-right">NOAH</th>
                  <th className="px-2 py-2 text-right">NOAH以外</th>
                  <th className="px-2 py-2 text-right">来院</th>
                  <th className="px-2 py-2 text-right">診療日</th>
                  <th className="px-2 py-2 text-right">1日平均</th>
                  <th className="px-2 py-2 text-right">自費%</th>
                  <th className="px-2 py-2 text-right">新患/再初検</th>
                </tr>
              </thead>
              <tbody>
                {report.trend.map((t) => (
                  <tr key={t.month} className={`border-t border-slate-100 ${t.month === report.current.month ? 'bg-teal-50/60' : ''}`}>
                    <td className="px-2 py-1 text-slate-700">
                      {ym(t.month)}
                      {!t.complete && <span className="ml-1 text-xs text-amber-700">{t.throughDay}日まで</span>}
                    </td>
                    <td className="px-2 py-1 text-right font-bold tabular-nums">{(t.sales + t.outside).toLocaleString('ja-JP')}</td>
                    <td className="px-2 py-1 text-right tabular-nums">{t.sales.toLocaleString('ja-JP')}</td>
                    <td className="px-2 py-1 text-right tabular-nums">{t.outside ? t.outside.toLocaleString('ja-JP') : '—'}</td>
                    <td className="px-2 py-1 text-right tabular-nums">{t.visits}</td>
                    <td className="px-2 py-1 text-right tabular-nums">{t.openDays}</td>
                    <td className="px-2 py-1 text-right tabular-nums">{t.perDay.toFixed(1)}</td>
                    <td className="px-2 py-1 text-right tabular-nums">{t.selfRatio.toFixed(1)}</td>
                    <td className="px-2 py-1 text-right tabular-nums">{t.newPt ?? '—'}/{t.reinit ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
          <p className="text-xs text-slate-500">
            NOAH以外の収入は<Link href="/marketing/sales/goal" className="underline">月の目標への道すじ</Link>の「その他の収入」で入れたもの（毎月1日に自動で取り込み）。
          </p>
        </>
      )}
    </div>
  )
}
