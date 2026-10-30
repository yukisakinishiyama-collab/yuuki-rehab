'use client'

/**
 * 売上・来院（NOAH）— 院長のみ
 *
 * 毎晩、院のパソコンで NOAH の「金額分析」「リピート率」を読み取った数字（個人情報なし）を、
 * 日別・月別・曜日別のグラフにする。夜のLINEの「今日のまとめ」と同じ「次の一手」も載せる。
 */
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import Link from 'next/link'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { useMarketingRole } from '@/lib/marketing/use-role'
import { NOAH_KINDS, type NoahKind, type NoahMonth, type NoahStore } from '@/lib/marketing/noah-types'
import {
  dateLabel,
  daysInMonth,
  freeRatio,
  monthPoints,
  prevMonthOf,
  weekdayOfDate,
  type NightlySummary,
} from '@/lib/marketing/noah-analysis'
import type { OpeningDay } from '@/lib/marketing/autopilot-planner'

interface ApiData {
  ok: boolean
  store: NoahStore | null
  summary: NightlySummary | null
  weekdays: Array<{
    weekday: number
    label: string
    avg: number | null
    sales: number | null
    samples: number
  }>
  tips: string[]
  openings: OpeningDay[]
  next: OpeningDay | null
  draftDay: OpeningDay | null
  refreshError?: string
  error?: string
}

// 区分の色（検証済みのカテゴリ配色。区分ごとに固定し、絞り込んでも色は変えない）
const KIND_COLORS: Record<NoahKind, string> = {
  ins: '#2f5d9a',
  self: '#0d9488',
  acc: '#c2410c',
  work: '#7c3aed',
  nonIns: '#db2777',
}
const SERIES = '#2f5d9a'
const GRID = '#e2e8f0'
const AXIS = '#64748b'
const WEEK = ['日', '月', '火', '水', '木', '金', '土']

const fmtYen = (n: number) => `${Math.round(n).toLocaleString('ja-JP')}円`
const fmtNum = (n: number) => Math.round(n).toLocaleString('ja-JP')
const man = (n: number) => (n >= 10_000 ? `${(n / 10_000).toLocaleString('ja-JP', { maximumFractionDigits: 1 })}万` : fmtNum(n))
const ym = (month: string) => `${month.slice(0, 4)}年${Number(month.slice(5, 7))}月`
/** グラフの横軸：最初の月と1月だけ年を付ける（13か月だと同じ月が2回出るため） */
const axisMonth = (month: string, index: number) =>
  index === 0 || month.slice(5, 7) === '01' ? `${month.slice(2, 4)}年${Number(month.slice(5, 7))}月` : `${Number(month.slice(5, 7))}月`
const pct = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : 0)

function monthTotals(m: NoahMonth, lastDay?: number) {
  const pts = monthPoints(m).filter((p) => lastDay === undefined || p.day <= lastDay)
  const visits = pts.reduce((s, p) => s + p.visits, 0)
  const sales = pts.reduce((s, p) => s + p.sales, 0)
  const selfSales = pts.reduce((s, p) => s + p.self[1], 0)
  const openDays = pts.filter((p) => p.visits > 0).length
  return {
    visits,
    sales,
    selfSales,
    selfRatio: pct(selfSales, sales),
    openDays,
  }
}

const isComplete = (m: NoahMonth) => m.asOf === `${m.month}-${String(daysInMonth(m.month)).padStart(2, '0')}`

// ── 部品 ─────────────────────────────────────────────

function Card({ title, sub, children, action }: { title: string; sub?: string; children: ReactNode; action?: ReactNode }) {
  return (
    <section className="min-w-0 rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="min-w-0">
          <h2 className="font-bold text-slate-900">{title}</h2>
          {sub && <p className="mt-0.5 text-xs text-slate-500">{sub}</p>}
        </div>
        {action}
      </div>
      <div className="mt-3">{children}</div>
    </section>
  )
}

function Delta({ now, before, unit, label }: { now: number; before: number | null; unit: '人' | '%' | 'pt'; label: string }) {
  if (before === null) return <p className="mt-1 text-xs text-slate-500">比べる記録がありません</p>
  let diff: number
  let text: string
  if (unit === '%') {
    if (before <= 0) return <p className="mt-1 text-xs text-slate-500">比べる記録がありません</p>
    diff = Math.round(((now - before) / before) * 100)
    text = `${diff > 0 ? '+' : ''}${diff}%`
  } else {
    diff = Math.round(now - before)
    text = `${diff > 0 ? '+' : ''}${fmtNum(diff)}${unit === 'pt' ? 'ポイント' : '人'}`
  }
  const tone = diff > 0 ? 'text-teal-700' : diff < 0 ? 'text-rose-700' : 'text-slate-500'
  return (
    <p className="mt-1 text-xs text-slate-500">
      <span className={`font-bold ${tone}`}>{text}</span> {label}
    </p>
  )
}

function Stat({ label, value, children }: { label: string; value: string; children?: ReactNode }) {
  return (
    <div className="min-w-0 rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-xs font-bold text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-black text-slate-900">{value}</p>
      {children}
    </div>
  )
}

interface TipRow {
  name: string
  value: string
  color?: string
  line?: boolean
}

function ChartTip({ title, rows, foot }: { title: string; rows: TipRow[]; foot?: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-sm">
      <p className="font-bold text-slate-700">{title}</p>
      <ul className="mt-1 space-y-0.5">
        {rows.map((r) => (
          <li key={r.name} className="flex items-center gap-2">
            {r.color && <span className="inline-block h-0.5 w-3 rounded" style={{ background: r.color }} aria-hidden />}
            <span className="font-bold text-slate-900">{r.value}</span>
            <span className="text-slate-500">{r.name}</span>
          </li>
        ))}
      </ul>
      {foot && <p className="mt-1 border-t border-slate-100 pt-1 font-bold text-slate-700">{foot}</p>}
    </div>
  )
}

// ── 日別（来院数・金額の積み上げ） ─────────────────────────────

interface DailyRow {
  day: number
  date: string
  label: string
  total: number | null
  ins: number | null
  self: number | null
  acc: number | null
  work: number | null
  nonIns: number | null
}

function dailyRows(m: NoahMonth, measure: 'v' | 's'): DailyRow[] {
  const points = new Map(monthPoints(m).map((p) => [p.day, p]))
  const rows: DailyRow[] = []
  for (let d = 1; d <= daysInMonth(m.month); d += 1) {
    const date = `${m.month}-${String(d).padStart(2, '0')}`
    const p = points.get(d)
    const pick = (pair: [number, number] | undefined) => (pair ? pair[measure === 'v' ? 0 : 1] : null)
    rows.push({
      day: d,
      date,
      label: String(d),
      total: p ? (measure === 'v' ? p.visits : p.sales) : null,
      ins: pick(p?.ins),
      self: pick(p?.self),
      acc: pick(p?.acc),
      work: pick(p?.work),
      nonIns: pick(p?.nonIns),
    })
  }
  return rows
}

function DailyChart({ month, measure }: { month: NoahMonth; measure: 'v' | 's' }) {
  const rows = useMemo(() => dailyRows(month, measure), [month, measure])
  const kinds = NOAH_KINDS.filter((k) => rows.some((r) => (r[k.key] ?? 0) > 0))
  const fmt = measure === 'v' ? (n: number) => `${fmtNum(n)}人` : fmtYen
  return (
    <>
      {kinds.length > 1 && (
        <ul className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600" aria-label="区分">
          {kinds.map((k) => (
            <li key={k.key} className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: KIND_COLORS[k.key] }} aria-hidden />
              {k.label}
            </li>
          ))}
        </ul>
      )}
      <div className="h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barCategoryGap="20%">
            <CartesianGrid vertical={false} stroke={GRID} />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 12, fill: AXIS }}
              tickLine={false}
              axisLine={{ stroke: GRID }}
              interval="preserveStartEnd"
              minTickGap={4}
            />
            <YAxis
              tick={{ fontSize: 12, fill: AXIS }}
              tickLine={false}
              axisLine={false}
              width={44}
              allowDecimals={false}
              tickFormatter={(n: number) => (measure === 'v' ? fmtNum(n) : man(n))}
            />
            <Tooltip
              cursor={{ fill: 'rgba(148,163,184,0.12)' }}
              content={({ active, payload }) => {
                const row = active && payload?.[0] ? (payload[0].payload as DailyRow) : null
                if (!row || row.total === null) return null
                return (
                  <ChartTip
                    title={dateLabel(row.date)}
                    rows={kinds
                      .filter((k) => (row[k.key] ?? 0) > 0)
                      .map((k) => ({
                        name: k.label,
                        value: fmt(row[k.key] ?? 0),
                        color: KIND_COLORS[k.key],
                      }))}
                    foot={`合計 ${fmt(row.total)}`}
                  />
                )
              }}
            />
            {kinds.map((k, i) => (
              <Bar
                key={k.key}
                dataKey={k.key}
                name={k.label}
                stackId="a"
                fill={KIND_COLORS[k.key]}
                stroke="#ffffff"
                strokeWidth={1}
                maxBarSize={18}
                radius={i === kinds.length - 1 ? [4, 4, 0, 0] : 0}
                isAnimationActive={false}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </>
  )
}

function DailyTable({ month }: { month: NoahMonth }) {
  const points = monthPoints(month)
  return (
    <div className="mt-3 max-h-80 overflow-auto rounded-lg border border-slate-200">
      <table className="w-full min-w-[560px] text-right text-xs tabular-nums">
        <thead className="sticky top-0 bg-slate-50 text-slate-500">
          <tr>
            <th className="px-2 py-1.5 text-left font-bold">日付</th>
            <th className="px-2 py-1.5 font-bold">来院</th>
            <th className="px-2 py-1.5 font-bold">金額</th>
            {NOAH_KINDS.map((k) => (
              <th key={k.key} className="px-2 py-1.5 font-bold">
                {k.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {points.map((p) => (
            <tr key={p.date} className="border-t border-slate-100">
              <td className="px-2 py-1 text-left text-slate-600">{dateLabel(p.date)}</td>
              <td className="px-2 py-1 font-bold">{fmtNum(p.visits)}</td>
              <td className="px-2 py-1 font-bold">{fmtNum(p.sales)}</td>
              {NOAH_KINDS.map((k) => (
                <td key={k.key} className="px-2 py-1 text-slate-600">
                  {p[k.key][0] > 0 ? `${p[k.key][0]}人 / ${fmtNum(p[k.key][1])}` : '—'}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── 月別の推移（来院数・金額を別々のグラフに） ─────────────────────

function MonthlyCharts({ months }: { months: NoahMonth[] }) {
  const rows = [...months]
    .sort((a, b) => a.month.localeCompare(b.month))
    .slice(-13)
    .map((m, i) => {
      const t = monthTotals(m)
      return {
        month: m.month,
        label: axisMonth(m.month, i),
        visits: t.visits,
        sales: t.sales,
        partial: !isComplete(m),
        asOf: m.asOf,
      }
    })
  const chart = (key: 'visits' | 'sales', title: string, fmt: (n: number) => string, tick: (n: number) => string) => (
    <div className="min-w-0">
      <p className="text-xs font-bold text-slate-500">{title}</p>
      <div className="h-48 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} margin={{ top: 18, right: 4, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke={GRID} />
            <XAxis dataKey="label" tick={{ fontSize: 12, fill: AXIS }} tickLine={false} axisLine={{ stroke: GRID }} />
            <YAxis tick={{ fontSize: 12, fill: AXIS }} tickLine={false} axisLine={false} width={44} tickFormatter={tick} />
            <Tooltip
              cursor={{ fill: 'rgba(148,163,184,0.12)' }}
              content={({ active, payload }) => {
                const row = active && payload?.[0] ? (payload[0].payload as (typeof rows)[number]) : null
                if (!row) return null
                return (
                  <ChartTip
                    title={`${ym(row.month)}${row.partial ? `（${Number(row.asOf.slice(8, 10))}日まで）` : ''}`}
                    rows={[{ name: title, value: fmt(row[key]), color: SERIES }]}
                  />
                )
              }}
            />
            <Bar dataKey={key} fill={SERIES} maxBarSize={24} radius={[4, 4, 0, 0]} isAnimationActive={false}>
              {rows.map((r) => (
                <Cell key={r.month} fill={r.partial ? '#9db3d4' : SERIES} />
              ))}
              <LabelList
                dataKey={key}
                position="top"
                formatter={(v: unknown) => (rows.length <= 6 ? tick(Number(v)) : '')}
                style={{ fontSize: 12, fill: '#334155' }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {chart('visits', '来院数（延べ）', (n) => `${fmtNum(n)}人`, fmtNum)}
      {chart('sales', '金額', fmtYen, man)}
      {rows.some((r) => r.partial) && (
        <p className="text-xs text-slate-500 sm:col-span-2">
          <span className="mr-1 inline-block h-2.5 w-2.5 rounded-sm align-middle" style={{ background: '#9db3d4' }} aria-hidden />
          薄い棒は途中の月（その日までの合計）です
        </p>
      )}
    </div>
  )
}

// ── 曜日ごとの平均 ─────────────────────────────────────────────

function WeekdayChart({ weekdays }: { weekdays: ApiData['weekdays'] }) {
  const rows = weekdays.map((w) => ({
    ...w,
    value: w.avg === null ? 0 : Math.round(w.avg * 10) / 10,
  }))
  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} margin={{ top: 20, right: 4, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} stroke={GRID} />
          <XAxis dataKey="label" tick={{ fontSize: 12, fill: AXIS }} tickLine={false} axisLine={{ stroke: GRID }} />
          <YAxis tick={{ fontSize: 12, fill: AXIS }} tickLine={false} axisLine={false} width={36} allowDecimals={false} />
          <Tooltip
            cursor={{ fill: 'rgba(148,163,184,0.12)' }}
            content={({ active, payload }) => {
              const row = active && payload?.[0] ? (payload[0].payload as (typeof rows)[number]) : null
              if (!row) return null
              return (
                <ChartTip
                  title={`${row.label}曜（直近8週・${row.samples}日分）`}
                  rows={[
                    {
                      name: '平均の来院数',
                      value: row.avg === null ? '—' : `${row.value}人`,
                      color: SERIES,
                    },
                    {
                      name: '平均の金額',
                      value: row.sales === null ? '—' : fmtYen(row.sales),
                    },
                  ]}
                />
              )
            }}
          />
          <Bar dataKey="value" fill={SERIES} maxBarSize={24} radius={[4, 4, 0, 0]} isAnimationActive={false}>
            <LabelList dataKey="value" position="top" style={{ fontSize: 12, fill: '#334155' }} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

// ── 自費メニュー・商品の内訳 ─────────────────────────────────────

function ItemsChart({ month }: { month: NoahMonth }) {
  const rows = [
    ...month.self.map((r) => ({
      name: r[0],
      unit: r[1],
      amount: r[2],
      count: r[3],
      group: '自費メニュー',
    })),
    ...month.goods.map((r) => ({
      name: r[0],
      unit: r[1],
      amount: r[2],
      count: r[3],
      group: '商品・物療',
    })),
  ]
    .filter((r) => r.amount > 0)
    .sort((a, b) => b.amount - a.amount)
  const top = rows.slice(0, 10)
  const rest = rows.slice(10)
  const data =
    rest.length > 0
      ? [
          ...top,
          {
            name: `ほか${rest.length}件`,
            unit: 0,
            amount: rest.reduce((s, r) => s + r.amount, 0),
            count: rest.reduce((s, r) => s + r.count, 0),
            group: 'まとめ',
          },
        ]
      : top
  if (data.length === 0) return <p className="text-sm text-slate-500">この月の内訳はありません。</p>
  return (
    <div className="w-full" style={{ height: data.length * 30 + 24 }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 72, bottom: 0, left: 0 }}>
          <CartesianGrid horizontal={false} stroke={GRID} />
          <XAxis type="number" tick={{ fontSize: 12, fill: AXIS }} tickLine={false} axisLine={false} tickFormatter={man} />
          <YAxis
            type="category"
            dataKey="name"
            width={118}
            tick={{ fontSize: 12, fill: '#334155' }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(s: string) => (s.length > 10 ? `${s.slice(0, 10)}…` : s)}
          />
          <Tooltip
            cursor={{ fill: 'rgba(148,163,184,0.12)' }}
            content={({ active, payload }) => {
              const row = active && payload?.[0] ? (payload[0].payload as (typeof data)[number]) : null
              if (!row) return null
              return (
                <ChartTip
                  title={`${row.name}（${row.group}）`}
                  rows={[
                    {
                      name: '金額',
                      value: fmtYen(row.amount),
                      color: KIND_COLORS.self,
                    },
                    { name: '点数', value: `${fmtNum(row.count)}点` },
                    ...(row.unit > 0 ? [{ name: '単価', value: fmtYen(row.unit) }] : []),
                  ]}
                />
              )
            }}
          />
          <Bar dataKey="amount" fill={KIND_COLORS.self} maxBarSize={16} radius={[0, 4, 4, 0]} isAnimationActive={false}>
            <LabelList
              dataKey="amount"
              position="right"
              formatter={(v: unknown) => fmtYen(Number(v))}
              style={{ fontSize: 12, fill: '#334155' }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

// ── エリアランキング ───────────────────────────────────────────

function RankChart({ rank }: { rank: NoahMonth['rank'] }) {
  const rows = rank.slice(-13).map(([month, clinics, position], i) => ({
    month,
    label: axisMonth(month, i),
    clinics,
    position,
  }))
  if (rows.length < 2) return <p className="text-sm text-slate-500">順位の記録がまだありません。</p>
  const worst = Math.max(...rows.map((r) => r.position))
  const step = worst <= 10 ? 2 : worst <= 25 ? 5 : worst <= 50 ? 10 : 20
  const bottom = Math.ceil(worst / step) * step
  const ticks = [1, ...Array.from({ length: bottom / step }, (_, i) => (i + 1) * step)]
  const last = rows[rows.length - 1]
  return (
    <>
      <p className="text-sm text-slate-700">
        いちばん新しい月（{ym(last.month)}）：
        <span className="font-bold">
          {fmtNum(last.clinics)}院中 {last.position}位
        </span>
      </p>
      <div className="mt-2 h-48 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={rows} margin={{ top: 12, right: 16, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke={GRID} />
            <XAxis dataKey="label" tick={{ fontSize: 12, fill: AXIS }} tickLine={false} axisLine={{ stroke: GRID }} />
            <YAxis
              reversed
              domain={[1, bottom]}
              ticks={ticks}
              tick={{ fontSize: 12, fill: AXIS }}
              tickLine={false}
              axisLine={false}
              width={36}
              allowDecimals={false}
              tickFormatter={(n: number) => `${n}位`}
            />
            <Tooltip
              content={({ active, payload }) => {
                const row = active && payload?.[0] ? (payload[0].payload as (typeof rows)[number]) : null
                if (!row) return null
                return (
                  <ChartTip
                    title={ym(row.month)}
                    rows={[
                      {
                        name: `位（${fmtNum(row.clinics)}院中）`,
                        value: `${row.position}`,
                        color: SERIES,
                      },
                    ]}
                  />
                )
              }}
            />
            <Line
              type="linear"
              dataKey="position"
              stroke={SERIES}
              strokeWidth={2}
              dot={{ r: 3, fill: SERIES, stroke: '#ffffff', strokeWidth: 2 }}
              activeDot={{
                r: 5,
                fill: SERIES,
                stroke: '#ffffff',
                strokeWidth: 2,
              }}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </>
  )
}

// ── この先の空き ───────────────────────────────────────────────

function Openings({ openings, draftDay }: { openings: OpeningDay[]; draftDay: OpeningDay | null }) {
  if (openings.length === 0) return <p className="text-sm text-slate-500">予約システムから空きを受け取れませんでした。</p>
  return (
    <ul className="space-y-2">
      {openings.map((d) => {
        const ratio = Math.round(freeRatio(d) * 100)
        return (
          <li key={d.date} className="grid grid-cols-[5.75rem_minmax(3rem,1fr)_auto] items-center gap-2 text-sm sm:gap-3">
            <span className={weekdayOfDate(d.date) === 0 ? 'text-slate-500' : 'text-slate-700'}>{dateLabel(d.date)}</span>
            {d.closed || weekdayOfDate(d.date) === 0 ? (
              <span className="col-span-2 text-xs text-slate-500">休診</span>
            ) : (
              <>
                <span className="h-2 overflow-hidden rounded-full bg-teal-100" aria-hidden>
                  <span className="block h-full rounded-full bg-teal-600" style={{ width: `${ratio}%` }} />
                </span>
                <span className="whitespace-nowrap text-xs text-slate-600">
                  午前{d.am}・午後{d.pm}枠
                  {draftDay?.date === d.date && (
                    <span className="ml-1 rounded bg-amber-100 px-1.5 py-0.5 font-bold text-amber-800">空き多め</span>
                  )}
                </span>
              </>
            )}
          </li>
        )
      })}
    </ul>
  )
}

// ── 画面 ─────────────────────────────────────────────────────

export default function SalesPage() {
  const { isAdmin } = useMarketingRole()
  const [data, setData] = useState<ApiData | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [showTable, setShowTable] = useState(false)

  const fetchData = useCallback(async (refresh: boolean) => {
    const res = await fetch(`/api/marketing/noah${refresh ? '?refresh=1' : ''}`, { cache: 'no-store' })
    return { ok: res.ok, body: (await res.json()) as ApiData }
  }, [])

  useEffect(() => {
    let alive = true
    fetchData(false)
      .then(({ ok, body }) => {
        if (!alive) return
        if (ok) setData(body)
        else setMessage(body.error ?? '読み込めませんでした')
      })
      .catch(() => {
        if (alive) setMessage('読み込めませんでした（通信の失敗）')
      })
    return () => {
      alive = false
    }
  }, [fetchData])

  async function refreshNow() {
    setBusy(true)
    setMessage('')
    try {
      const { ok, body } = await fetchData(true)
      if (!ok) {
        setMessage(body.error ?? '読み込めませんでした')
        return
      }
      setData(body)
      setMessage(body.refreshError ?? '最新の集計にしました')
    } catch {
      setMessage('読み込めませんでした（通信の失敗）')
    } finally {
      setBusy(false)
    }
  }

  const months = useMemo(() => data?.store?.months ?? [], [data])
  const month = months.find((m) => m.month === selected) ?? months[0] ?? null
  const isLatest = Boolean(month && months[0] && month.month === months[0].month)
  const prevMonth = month ? (months.find((m) => m.month === prevMonthOf(month.month)) ?? null) : null

  if (!isAdmin) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
        売上・来院の画面は院長（管理者）だけが見られます。
      </div>
    )
  }

  const summary = data?.summary ?? null
  const totals = month ? monthTotals(month) : null
  const lastDay = month ? Number(month.asOf.slice(8, 10)) : 0
  // 比べる相手：月が終わっていれば前の月の合計、途中なら先月の同じ日まで（その日までの記録があるときだけ）
  let prevSame: ReturnType<typeof monthTotals> | null = null
  if (month && prevMonth) {
    if (isComplete(month)) {
      if (isComplete(prevMonth)) prevSame = monthTotals(prevMonth)
    } else {
      const cut = Math.min(lastDay, daysInMonth(prevMonth.month))
      if (prevMonth.asOf >= `${prevMonth.month}-${String(cut).padStart(2, '0')}`) prevSame = monthTotals(prevMonth, cut)
    }
  }
  const latest = data?.store?.latest

  return (
    <div className={`space-y-5 transition-opacity ${busy && data ? 'opacity-60' : ''}`}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-black text-slate-900">売上・来院（NOAH）</h1>
          <p className="mt-1 text-sm text-slate-600">
            毎晩、院のパソコンで NOAH の集計を読み取って更新します（数字だけ。患者さんのお名前などは扱いません）。
          </p>
          {latest && (
            <p className="mt-1 text-xs text-slate-500">
              最新：{dateLabel(latest.asOf)}まで（NOAHから書き出し {latest.exportedAt.replace('T', ' ')}）
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={refreshNow}
          disabled={busy}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50 max-lg:min-h-10"
        >
          {busy ? '読み込み中…' : '最新にする'}
        </button>
      </div>
      {message && <p className="rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-700">{message}</p>}

      {data && months.length === 0 && (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-600">
          <p className="font-bold text-slate-800">まだ NOAH の集計が届いていません。</p>
          <p className="mt-2">
            毎晩21時ごろ、院のパソコンで Claude が NOAH の「分析 → 金額分析」を読み取り、ここに届けます。
            パソコンの電源が入っていて、Claude のアプリと NOAH が開いていることが必要です。
          </p>
          {data.store?.folderFound === false && (
            <p className="mt-2 text-xs text-slate-500">（集計を置くフォルダがまだ作られていません）</p>
          )}
        </div>
      )}

      {month && totals && (
        <>
          {months.length > 1 && (
            <div className="flex flex-wrap gap-1" role="group" aria-label="表示する月">
              {months.slice(0, 13).map((m) => (
                <button
                  key={m.month}
                  type="button"
                    aria-pressed={m.month === month.month}
                  onClick={() => setSelected(m.month)}
                  className={`rounded-lg px-3 py-1.5 text-sm font-bold max-lg:min-h-10 ${
                    m.month === month.month
                      ? 'bg-teal-700 text-white'
                      : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {ym(m.month)}
                  {!isComplete(m) && <span className="ml-1 text-xs font-medium">途中</span>}
                </button>
              ))}
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {isLatest && summary?.today ? (
              <Stat label={`${dateLabel(summary.date)}の来院`} value={`${fmtNum(summary.today.visits)}人`}>
                <p className="mt-1 text-xs text-slate-500">
                  金額 {fmtYen(summary.today.sales)}
                  {summary.weekdayAvg !== null && `・いつもの${WEEK[summary.today.weekday]}曜は平均${summary.weekdayAvg}人`}
                </p>
              </Stat>
            ) : (
              <Stat label="1日あたりの来院" value={`${totals.openDays > 0 ? Math.round(totals.visits / totals.openDays) : 0}人`}>
                <p className="mt-1 text-xs text-slate-500">来院のあった{totals.openDays}日の平均</p>
              </Stat>
            )}
            <Stat
              label={isComplete(month) ? `${ym(month.month)}の来院（延べ）` : `今月の来院（${lastDay}日まで・延べ）`}
              value={`${fmtNum(totals.visits)}人`}
            >
              <Delta
                now={totals.visits}
                before={prevSame?.visits ?? null}
                unit="人"
                label={isComplete(month) ? '前の月より' : '先月の同じ時期より'}
              />
            </Stat>
            <Stat
              label={isComplete(month) ? `${ym(month.month)}の金額` : `今月の金額（${lastDay}日まで）`}
              value={fmtYen(totals.sales)}
            >
              <Delta
                now={totals.sales}
                before={prevSame?.sales ?? null}
                unit="%"
                label={isComplete(month) ? '前の月より' : '先月の同じ時期より'}
              />
            </Stat>
            <Stat label="自費・商品の割合（金額）" value={`${totals.selfRatio}%`}>
              <Delta
                now={totals.selfRatio}
                before={prevSame?.selfRatio ?? null}
                unit="pt"
                label={isComplete(month) ? '前の月より' : '先月の同じ時期より'}
              />
            </Stat>
          </div>

          {isLatest && data && (data.tips.length > 0 || data.next) && (
            <Card title="次の一手" sub="夜のLINEの「今日のまとめ」と同じ考え方で出しています">
              <ul className="space-y-2 text-sm text-slate-700">
                {data.tips.map((t) => (
                  <li key={t} className="flex gap-2">
                    <span className="text-teal-700" aria-hidden>
                      ●
                    </span>
                    <span className="min-w-0">{t}</span>
                  </li>
                ))}
                {data.tips.length === 0 && <li className="text-slate-500">今日は特にありません。</li>}
              </ul>
              {data.draftDay && (
                <p className="mt-3 text-sm text-slate-600">
                  {dateLabel(data.draftDay.date)}
                  は空きが多めです。夜のまとめのときに Google の「空き状況」投稿の下書きを作ります（
                  <Link href="/marketing/autopilot" className="font-bold text-teal-800 underline">
                    自動投稿
                  </Link>
                  で承認するまで投稿されません）。
                </p>
              )}
            </Card>
          )}

          <Card
            title="日別の来院数（延べ）"
            sub={`${ym(month.month)}${isComplete(month) ? '' : `（${lastDay}日まで）`}・区分はNOAHの金額分析のとおり`}
            action={
              <button type="button" onClick={() => setShowTable((v) => !v)} className="text-xs font-bold text-teal-800 underline max-lg:min-h-10">
                {showTable ? '表を閉じる' : '表で見る'}
              </button>
            }
          >
            <DailyChart month={month} measure="v" />
            {showTable && <DailyTable month={month} />}
          </Card>

          <Card title="日別の金額" sub="NOAHの金額分析の値（保険の請求分も含めた総額）">
            <DailyChart month={month} measure="s" />
          </Card>

          <div className="grid gap-5 lg:grid-cols-2">
            <Card title="曜日ごとの平均来院数" sub="直近8週・来院のあった日だけで平均">
              {data && data.weekdays.some((w) => w.avg !== null) ? (
                <WeekdayChart weekdays={data.weekdays} />
              ) : (
                <p className="text-sm text-slate-500">まだ記録が足りません。</p>
              )}
            </Card>
            <Card title="この先の空き（予約システム）" sub="空いている予約枠の数。バーは空きの割合">
              <Openings openings={data?.openings ?? []} draftDay={data?.draftDay ?? null} />
            </Card>
          </div>

          {months.length > 1 && (
            <Card title="月ごとの推移" sub="途中の月は、その日までの合計です">
              <MonthlyCharts months={months} />
            </Card>
          )}

          <div className="grid gap-5 lg:grid-cols-2">
            <Card title="自費メニュー・商品の内訳" sub={`${ym(month.month)}・金額の多い順`}>
              <ItemsChart month={month} />
            </Card>
            <Card
              title="リピート・離反（NOAHのリピート率）"
              sub={`${ym(month.month)}${isComplete(month) ? '' : `（${lastDay}日まで）`}`}
            >
              {month.repeat ? (
                <dl className="grid grid-cols-2 gap-3 text-sm">
                  {typeof month.repeat.newPt === 'number' && (
                    <div className="rounded-lg bg-slate-50 p-3">
                      <dt className="text-xs font-bold text-slate-500">初回の方</dt>
                      <dd className="mt-1 text-lg font-black">{(month.repeat.newPt ?? 0) + (month.repeat.reinit ?? 0)}人</dd>
                      <dd className="text-xs text-slate-500">
                        新患{month.repeat.newPt}・再初検{month.repeat.reinit}
                      </dd>
                    </div>
                  )}
                  {typeof month.repeat.last === 'number' && (
                    <div className="rounded-lg bg-slate-50 p-3">
                      <dt className="text-xs font-bold text-slate-500">先月来院→今月まだ</dt>
                      <dd className="mt-1 text-lg font-black">
                        {month.repeat.gone ?? 0}人
                        <span className="text-xs font-medium text-slate-500"> / {month.repeat.last}人</span>
                      </dd>
                      <dd className="text-xs text-slate-500">
                        継続中{month.repeat.goneCont ?? 0}・治癒
                        {month.repeat.cured ?? 0}・中止
                        {month.repeat.stopped ?? 0}
                      </dd>
                    </div>
                  )}
                  {typeof month.repeat.selfGone === 'number' && (
                    <div className="rounded-lg bg-slate-50 p-3">
                      <dt className="text-xs font-bold text-slate-500">自費の方の月間離反</dt>
                      <dd className="mt-1 text-lg font-black">{month.repeat.selfGone}人</dd>
                    </div>
                  )}
                  <p className="col-span-2 text-xs text-slate-500">
                    お名前の一覧は NOAH の「分析 → 来院分析 →
                    リピート率」で、月間離反率の「継続」の数字を押すと出ます（ハガキはラベル印刷）。
                    一覧はパソコンの外へは出しません。
                  </p>
                </dl>
              ) : (
                <p className="text-sm text-slate-500">この月のリピート率は読み取っていません。</p>
              )}
            </Card>
          </div>

          <Card title="エリアランキング（NOAH）" sub="NOAHが出している地域の院の中での順位（上ほど上位）">
            <RankChart rank={(months[0] ?? month).rank} />
          </Card>

          {(data?.store?.errors?.length ?? 0) > 0 && (
            <Card title="読み取れなかった集計ファイル" sub="写し間違い・途中切れのファイルは使わず、ひとつ前のものを使っています">
              <ul className="space-y-1 text-xs text-slate-600">
                {data?.store?.errors.map((e) => (
                  <li key={`${e.file}-${e.savedAt}`}>
                    {e.file}（{e.savedAt}）：{e.message}
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
