'use client'

/**
 * 月の売上の目標（はじめは300万円）への道すじ — 院長のみ・経営メニュー（隠しモード）の中
 *
 * 4つのタブに分ける（ChatGPT とのデザイン相談をふまえた形。2026-10-23）
 *   現在地 … 今月の着地見込み・目標との差・今週いちばんにやること（最初の1画面で分かる）
 *   分析   … 売上の内訳・毎月の推移・いま言えること・自費メニュー上位・その他の収入（アルファノート）
 *   試算   … 基本の2つ（1日の来院・自費の1回あたり）＋詳しい条件。目標に届く組み合わせはボタンで入れる
 *   計画   … 4つの段階（いまの段階だけ開く）と打ち手のチェック・守ること
 *
 * 数字は NOAH の集計（毎晩届く数字だけ）と、NOAH に入らない収入（アルファノートのサブスクなど）から。すべて目安。
 * 「実績」と「見込み（予測）」「試算」は、ラベルで必ず分けて見せる。
 * 計算は src/lib/marketing/goal-plan.ts（架空の数字で単体テストあり）。データは院長だけが読めるAPIから取る。
 */
import { useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from 'react'
import Link from 'next/link'
import { Bar, BarChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { ChevronDown, Minus, Plus } from 'lucide-react'
import { useMarketingRole } from '@/lib/marketing/use-role'
import type { NoahStore } from '@/lib/marketing/noah-types'
import { dateLabel, monthPoints } from '@/lib/marketing/noah-analysis'
import {
  DEFAULT_GOAL,
  baseline,
  insights,
  man,
  requirement,
  simDefaults,
  simulate,
  stages,
  type Baseline,
  type SimInput,
  type Stage,
  type StageKey,
} from '@/lib/marketing/goal-plan'

interface ExtraMonth {
  month: string
  subscription: number
  cashless: number
  overlap: number
  note?: string
  updatedAt: string
}

const NAVY = '#13253d'
const TEAL = '#0d9488'
const BLUE = '#2f5d9a'
const MUTED = '#cbd5e1'

const fmt = (n: number) => Math.round(n).toLocaleString('ja-JP')
const fmt1 = (n: number) => (Math.round(n * 10) / 10).toLocaleString('ja-JP')
const yen = (n: number) => `${fmt(n)}円`
const ym = (month: string) => `${month.slice(0, 4)}年${Number(month.slice(5, 7))}月`
const extraOf = (e?: ExtraMonth) => (e ? e.subscription + Math.max(0, e.cashless - e.overlap) : 0)

// ── この端末に覚えておく小さな設定（目標の金額・チェックした打ち手）とタブ ──────────────

const GOAL_KEY = 'keiei:goal'
const CHECK_KEY = 'keiei:goal-checks'
const LS_EVENT = 'keiei:local'

function readLocal(key: string): string | null {
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}
function writeLocal(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value)
  } catch {
    // 保存できない環境では、この画面を開いている間だけ
  }
  window.dispatchEvent(new Event(LS_EVENT))
}
function subscribeLocal(onChange: () => void) {
  window.addEventListener(LS_EVENT, onChange)
  window.addEventListener('storage', onChange)
  return () => {
    window.removeEventListener(LS_EVENT, onChange)
    window.removeEventListener('storage', onChange)
  }
}
function useLocal(key: string): string | null {
  return useSyncExternalStore(subscribeLocal, () => readLocal(key), () => null)
}

type TabKey = 'now' | 'analysis' | 'sim' | 'plan'
const TABS: Array<{ key: TabKey; label: string }> = [
  { key: 'now', label: '現在地' },
  { key: 'analysis', label: '分析' },
  { key: 'sim', label: '試算' },
  { key: 'plan', label: '計画' },
]
const isTab = (v: string): v is TabKey => TABS.some((t) => t.key === v)

/** タブは URL の #now などに残す（読み直しや「戻る」でも同じタブ） */
function readHash(): TabKey {
  const h = window.location.hash.replace('#', '')
  return isTab(h) ? h : 'now'
}
function subscribeHash(onChange: () => void) {
  window.addEventListener('hashchange', onChange)
  return () => window.removeEventListener('hashchange', onChange)
}
function useTab(): [TabKey, (t: TabKey) => void] {
  const tab = useSyncExternalStore(subscribeHash, readHash, () => 'now' as TabKey)
  const setTab = (t: TabKey) => {
    window.history.replaceState(null, '', `#${t}`)
    window.dispatchEvent(new HashChangeEvent('hashchange'))
    window.scrollTo({ top: 0 })
  }
  return [tab, setTab]
}

// ── 部品 ─────────────────────────────────────────────

function Card({ title, sub, children, action }: { title?: string; sub?: string; children: ReactNode; action?: ReactNode }) {
  return (
    <section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 sm:p-6">
      {(title || action) && (
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <div className="min-w-0">
            {title && <h2 className="text-[15px] font-bold text-slate-900">{title}</h2>}
            {sub && <p className="mt-0.5 text-xs text-slate-500">{sub}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  )
}

/** 折りたたみ（ふだんは閉じておく詳しい情報） */
function Fold({ title, sub, children, open }: { title: string; sub?: string; children: ReactNode; open?: boolean }) {
  return (
    <details open={open} className="group min-w-0 rounded-2xl border border-slate-200 bg-white">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3.5 sm:px-6 [&::-webkit-details-marker]:hidden">
        <span className="min-w-0">
          <span className="block text-[15px] font-bold text-slate-900">{title}</span>
          {sub && <span className="mt-0.5 block text-xs text-slate-500">{sub}</span>}
        </span>
        <ChevronDown className="h-5 w-5 shrink-0 text-slate-500 transition-transform group-open:rotate-180" aria-hidden />
      </summary>
      <div className="border-t border-slate-100 px-4 pb-4 pt-3 sm:px-6">{children}</div>
    </details>
  )
}

function Bar100({ value, goal, tone = 'teal' }: { value: number; goal: number; tone?: 'teal' | 'light' }) {
  const pct = goal > 0 ? Math.min(100, (value / goal) * 100) : 0
  return (
    <div
      className={`h-2.5 w-full overflow-hidden rounded-full ${tone === 'light' ? 'bg-white/15' : 'bg-slate-100'}`}
      role="img"
      aria-label={`目標の${Math.round(pct)}%`}
    >
      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: tone === 'light' ? '#5eead4' : TEAL }} />
    </div>
  )
}

/** −／＋ つきのスライダー（スマホでも細かく合わせられるように） */
function Stepper({
  id,
  label,
  value,
  min,
  max,
  step,
  display,
  onChange,
  hint,
}: {
  id: string
  label: string
  value: number
  min: number
  max: number
  step: number
  display: string
  onChange: (v: number) => void
  hint?: string
}) {
  const clamp = (v: number) => Math.min(max, Math.max(min, Math.round(v / step) * step))
  const btn =
    'flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 active:bg-slate-100'
  return (
    <div className="min-w-0">
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={id} className="text-sm font-bold text-slate-700">
          {label}
        </label>
        <span className="text-lg font-black tabular-nums text-slate-900">{display}</span>
      </div>
      <div className="mt-1.5 flex items-center gap-2">
        <button type="button" className={btn} onClick={() => onChange(clamp(value - step))} aria-label={`${label}を減らす`}>
          <Minus className="h-4 w-4" aria-hidden />
        </button>
        <input
          id={id}
          type="range"
          min={min}
          max={max}
          step={step}
          value={clamp(value)}
          onChange={(e) => onChange(Number(e.target.value))}
          className="h-11 min-w-0 flex-1 accent-teal-600"
        />
        <button type="button" className={btn} onClick={() => onChange(clamp(value + step))} aria-label={`${label}を増やす`}>
          <Plus className="h-4 w-4" aria-hidden />
        </button>
      </div>
      {hint && <p className="mt-0.5 text-xs text-slate-500">{hint}</p>}
    </div>
  )
}

// ── 打ち手（段階ごと） ─────────────────────────────────────

const ACTIONS: Record<StageKey, Array<{ id: string; text: string; href?: string; link?: string }>> = {
  keep: [
    {
      id: 'keep-watch',
      text: '「今日」の「気にかけたい方」を見て、治療中なのに間があいた方へ声をかける（LINE・電話）',
      href: '/dashboard',
      link: '今日',
    },
    { id: 'keep-next', text: '施術の終わりに、次回の予約をその場で一緒に決める', href: '/yoyaku', link: '予約' },
    { id: 'keep-plan', text: '初回に、回数と期間の目安・ゴール（競技復帰など）を説明して共有する', href: '/patients', link: 'カルテ' },
    { id: 'keep-graduate', text: '卒業のときに、再発予防のセルフケアと、気になったときの相談先を伝える（押しつけない）' },
  ],
  new: [
    { id: 'new-autopilot', text: '毎週日曜に届くInstagramの下書きを確認して承認する', href: '/marketing/autopilot', link: '自動投稿' },
    { id: 'new-reviews', text: 'Googleの口コミに返信する（お礼と受け止め。症状や来院の事実は書かない）', href: '/marketing/reviews', link: '口コミ返信' },
    { id: 'new-line', text: 'LINEの友だち追加から予約までの流れを整える', href: '/marketing/line', link: 'LINE導線' },
    { id: 'new-partner', text: '整形外科・学校の部活・スポーツチームに、紹介状・経過報告書で連携する', href: '/patients', link: 'カルテ' },
  ],
  value: [
    { id: 'value-menu', text: '自費メニュー（運動療法・リハビリ・インソールなど）の内容と料金を、院内でわかる形にする' },
    { id: 'value-course', text: 'ACL・半月板の術後リハビリや競技復帰など、回数と目標が決まったコースを用意する' },
    { id: 'value-explain', text: '自費は、必要な理由と料金を説明して同意をいただいてから（強くすすめない）' },
    { id: 'value-accident', text: '交通事故は、自賠責の説明と、保険会社・医療機関との連携をていねいに' },
  ],
  capacity: [
    { id: 'cap-slots', text: '予約の空きが多い時間帯と、埋まる時間帯を見て、枠の組み方を見直す', href: '/yoyaku', link: '予約' },
    { id: 'cap-time', text: '1回の施術時間と流れ（受付・評価・施術・説明）を見直して、待ち時間を減らす' },
    { id: 'cap-staff', text: 'スタッフの採用・育成で、同じ時間に受けられる人数を増やす' },
    { id: 'cap-hours', text: '受付時間（夕方・土曜）の見直しを考える' },
  ],
}

/** 段階ごとに、PDCA の画面で使うひな形（受けられる人数の段は、施策より体制の見直しなので出さない） */
const STAGE_TEMPLATE: Partial<Record<StageKey, string>> = { keep: 'comeback', new: 'newcomers', value: 'self' }

const STAGE_SHORT: Record<StageKey, string> = {
  keep: '続けて通っていただく',
  new: '新しい方を増やす',
  value: '自費の価値を伝える',
  capacity: '受けられる人数を広げる',
}

/** いまの段階：月末の見込みがまだ届いていない最初の段 */
function currentStageIndex(plan: Stage[], projected: number): number {
  const i = plan.findIndex((s) => s.target > projected)
  return i === -1 ? Math.max(0, plan.length - 1) : i
}

// ── 毎月の推移 ─────────────────────────────────────────────

interface TrendRow {
  month: string
  label: string
  noah: number
  extra: number
  rest: number
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: color }} aria-hidden />
      {label}
    </span>
  )
}

function TrendChart({ rows, goal }: { rows: TrendRow[]; goal: number }) {
  return (
    <div>
      <div className="h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} margin={{ top: 16, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke="#e2e8f0" />
            <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#64748b' }} tickLine={false} axisLine={{ stroke: '#e2e8f0' }} />
            <YAxis
              tick={{ fontSize: 12, fill: '#64748b' }}
              tickLine={false}
              axisLine={false}
              width={44}
              tickFormatter={(n: number) => man(n)}
              domain={[0, (max: number) => Math.max(max, goal) * 1.08]}
            />
            <Tooltip
              cursor={{ fill: 'rgba(148,163,184,0.12)' }}
              content={({ active, payload }) => {
                const row = active && payload?.[0] ? (payload[0].payload as TrendRow) : null
                if (!row) return null
                return (
                  <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-sm">
                    <p className="font-bold text-slate-900">{ym(row.month)}</p>
                    <p className="text-slate-700">実績（NOAH）：{yen(row.noah)}</p>
                    {row.extra > 0 && <p className="text-slate-700">実績（その他の収入）：{yen(row.extra)}</p>}
                    {row.rest > 0 && <p className="text-slate-500">月末までの見込み：+{yen(row.rest)}</p>}
                  </div>
                )
              }}
            />
            <ReferenceLine
              y={goal}
              stroke="#b45309"
              strokeDasharray="5 3"
              label={{ value: `目標 ${man(goal)}`, position: 'insideTopRight', fontSize: 12, fill: '#b45309' }}
            />
            <Bar dataKey="noah" stackId="s" fill={BLUE} maxBarSize={28} isAnimationActive={false} />
            <Bar dataKey="extra" stackId="s" fill={TEAL} maxBarSize={28} isAnimationActive={false} />
            <Bar dataKey="rest" stackId="s" fill={MUTED} maxBarSize={28} radius={[4, 4, 0, 0]} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
        <Legend color={BLUE} label="実績（NOAH）" />
        <Legend color={TEAL} label="実績（その他の収入）" />
        <Legend color={MUTED} label="今月の見込み（予測）" />
        <span>点線＝目標</span>
      </p>
    </div>
  )
}

/** 売上の内訳（横に積んだ1本の棒と、区分ごとの小さなカード） */
function Breakdown({ base, extraAmount }: { base: Baseline; extraAmount: number }) {
  const parts = [
    ...base.kinds.map((k) => ({ key: k.key as string, label: k.label, sales: k.sales, visits: k.visits, perVisit: k.perVisit })),
    { key: 'extra', label: 'その他の収入', sales: extraAmount, visits: 0, perVisit: 0 },
  ].filter((p) => p.key !== 'extra' || p.sales > 0)
  const total = parts.reduce((s, p) => s + p.sales, 0)
  const color: Record<string, string> = { ins: BLUE, self: TEAL, acc: '#c2410c', extra: '#7c3aed' }
  return (
    <div>
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-slate-100" role="img" aria-label="売上の内訳">
        {parts.map((p) => (
          <div key={p.key} style={{ width: `${total > 0 ? (p.sales / total) * 100 : 0}%`, background: color[p.key] }} />
        ))}
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {parts.map((p) => (
          <div key={p.key} className="rounded-xl bg-slate-50 px-3 py-2.5">
            <p className="flex items-center gap-1.5 text-xs font-bold text-slate-600">
              <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: color[p.key] }} aria-hidden />
              {p.label}
              <span className="ml-auto font-normal tabular-nums text-slate-500">{total > 0 ? Math.round((p.sales / total) * 100) : 0}%</span>
            </p>
            <p className="mt-1 text-lg font-black tabular-nums text-slate-900">{man(p.sales)}円</p>
            {p.key !== 'extra' && (
              <p className="text-xs tabular-nums text-slate-500">
                {fmt(p.visits)}回・1回 {p.visits > 0 ? yen(p.perVisit) : '—'}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

const pill =
  'inline-flex h-11 items-center justify-center rounded-full border border-slate-300 bg-white px-5 text-sm font-bold text-slate-700 hover:bg-slate-50'

// ── 画面 ─────────────────────────────────────────────

export default function GoalPage() {
  const { isAdmin } = useMarketingRole()
  const [tab, setTab] = useTab()
  const [store, setStore] = useState<NoahStore | null>(null)
  const [extras, setExtras] = useState<ExtraMonth[]>([])
  const [loaded, setLoaded] = useState(false)
  const [message, setMessage] = useState('')
  const [sim, setSim] = useState<SimInput | null>(null)
  const [editGoal, setEditGoal] = useState<string | null>(null)
  const [extraForm, setExtraForm] = useState<{ subscription: string; cashless: string; overlap: string } | null>(null)
  const [saving, setSaving] = useState(false)

  const goalRaw = useLocal(GOAL_KEY)
  const goal = Number(goalRaw) > 0 ? Number(goalRaw) : DEFAULT_GOAL
  const checksRaw = useLocal(CHECK_KEY)
  const checks = useMemo(() => {
    try {
      return new Set<string>(JSON.parse(checksRaw ?? '[]') as string[])
    } catch {
      return new Set<string>()
    }
  }, [checksRaw])

  useEffect(() => {
    let alive = true
    Promise.all([
      fetch('/api/marketing/noah?lite=1', { cache: 'no-store' }).then(async (r) => (r.ok ? ((await r.json()) as { store: NoahStore | null }) : null)),
      fetch('/api/marketing/keiei-extra', { cache: 'no-store' }).then(async (r) =>
        r.ok ? ((await r.json()) as { months: ExtraMonth[] }) : null,
      ),
    ])
      .then(([n, e]) => {
        if (!alive) return
        setStore(n?.store ?? null)
        setExtras(e?.months ?? [])
        if (!n) setMessage('NOAHの集計を読み込めませんでした')
        setLoaded(true)
      })
      .catch(() => {
        if (!alive) return
        setMessage('読み込めませんでした（通信の失敗）')
        setLoaded(true)
      })
    return () => {
      alive = false
    }
  }, [])

  const months = useMemo(() => store?.months ?? [], [store])
  const base = useMemo(() => baseline(months), [months])
  const extraNow = base ? extras.find((e) => e.month === base.month) : undefined
  const extraAmount = extraOf(extraNow)
  const defaults = base ? simDefaults(base, extraAmount) : null
  const input = sim ?? defaults

  if (!isAdmin) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
        この画面は院長（管理者）だけが見られます。
      </div>
    )
  }

  const now = defaults ? simulate(defaults) : null
  // いちばん上に出す数字は、試算ではなく実際の見込み（月が終わっていれば実績）＋その他の収入
  const headline = base ? base.projectedSales + extraAmount : 0
  const result = input ? simulate(input) : null
  const req = defaults ? requirement(goal, defaults) : null
  const plan = defaults && base ? stages(goal, defaults, base.maxDayVisits) : []
  const notes = defaults && base ? insights(goal, base, defaults) : []
  const stageIdx = now ? currentStageIndex(plan, headline) : 0
  const stage = plan[stageIdx]
  const nextAction = stage ? (ACTIONS[stage.key].find((a) => !checks.has(a.id)) ?? ACTIONS[stage.key][0]) : null
  const goneNote = notes.find((n) => n.text.includes('まだ来られていない'))

  const trend: TrendRow[] = [...months]
    .sort((a, b) => a.month.localeCompare(b.month))
    .slice(-12)
    .map((m, i, arr) => {
      const noah = monthPoints(m).reduce((s, p) => s + p.sales, 0)
      const extra = extraOf(extras.find((e) => e.month === m.month))
      const isCurrent = base?.month === m.month && i === arr.length - 1
      const rest = isCurrent && base && !base.complete ? Math.max(0, base.projectedSales - base.sales) : 0
      return {
        month: m.month,
        label: i === 0 || m.month.endsWith('-01') ? `${m.month.slice(2, 4)}年${Number(m.month.slice(5))}月` : `${Number(m.month.slice(5))}月`,
        noah,
        extra,
        rest,
      }
    })

  function saveGoal() {
    const n = Number(String(editGoal ?? '').replace(/[,，\s]/g, ''))
    if (Number.isFinite(n) && n >= 10) writeLocal(GOAL_KEY, String(Math.round(n * 10_000)))
    setEditGoal(null)
  }

  function toggleCheck(id: string) {
    const next = new Set(checks)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    writeLocal(CHECK_KEY, JSON.stringify([...next]))
  }

  async function saveExtra() {
    if (!base || !extraForm) return
    setSaving(true)
    setMessage('')
    try {
      const res = await fetch('/api/marketing/keiei-extra', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ month: base.month, ...extraForm, note: 'アルファノート（手入力）' }),
      })
      const body = (await res.json()) as { month?: ExtraMonth; error?: string }
      if (!res.ok || !body.month) {
        setMessage(body.error ?? '保存できませんでした')
        return
      }
      const saved = body.month
      setExtras((list) => [saved, ...list.filter((e) => e.month !== saved.month)])
      setExtraForm(null)
      setSim(null)
      setMessage('その他の収入を保存しました')
    } catch {
      setMessage('保存できませんでした（通信の失敗）')
    } finally {
      setSaving(false)
    }
  }

  const set = (patch: Partial<SimInput>) => input && setSim({ ...input, ...patch })
  const overCapacity = Boolean(input && base && input.perDay > base.maxDayVisits)
  const asOfDay = base ? Number(base.asOf.slice(8, 10)) : 0
  const actual = base ? base.sales + extraAmount : 0

  return (
    <div className="space-y-4">
      {/* 見出し */}
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <h1 className="min-w-0 text-lg font-black text-slate-900 sm:text-2xl">月商 {man(goal)}円への道すじ</h1>
        {editGoal === null ? (
          <button
            type="button"
            onClick={() => setEditGoal(String(goal / 10_000))}
            className="h-9 rounded-full px-3 text-sm font-bold text-teal-700 hover:bg-teal-50 max-lg:h-10"
          >
            目標を変える
          </button>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault()
              saveGoal()
            }}
            className="flex items-center gap-2"
          >
            <label htmlFor="goal-man" className="text-sm font-bold text-slate-700">
              月の目標
            </label>
            <input
              id="goal-man"
              inputMode="numeric"
              value={editGoal}
              onChange={(e) => setEditGoal(e.target.value)}
              className="h-11 w-24 rounded-xl border border-slate-300 px-3 text-right text-sm"
            />
            <span className="text-sm text-slate-600">万円</span>
            <button type="submit" className="h-11 rounded-full bg-teal-700 px-5 text-sm font-bold text-white">
              決める
            </button>
          </form>
        )}
      </div>

      {/* タブ（上に貼り付く） */}
      <div
        className="sticky z-10 -mx-4 bg-slate-50/95 px-4 py-2 backdrop-blur sm:-mx-6 sm:px-6"
        style={{ top: 'calc(var(--shell-top, 0px) + env(safe-area-inset-top, 0px))' }}
      >
        <div className="grid grid-cols-4 gap-1 rounded-full bg-slate-200/70 p-1" role="group" aria-label="表示する内容">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              aria-pressed={tab === t.key}
              onClick={() => setTab(t.key)}
              className={`h-10 rounded-full text-sm font-bold transition-colors ${
                tab === t.key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {message && <p className="rounded-xl bg-slate-100 px-3 py-2 text-sm text-slate-700">{message}</p>}
      {!loaded && <p className="text-sm text-slate-500">読み込み中…</p>}
      {loaded && !base && (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-600">
          まだNOAHの集計が届いていません。毎晩21時すぎに届くと、ここに道すじが出ます。
        </div>
      )}

      {base?.mismatch && (
        <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-900">
          NOAHの区分の合計が全体と合っていない月です。いちばん上の数字は全体の金額から出していますが、区分ごとの数字は目安として見てください。
        </p>
      )}
      {base && defaults && now && req && input && result && (
        <>
          {/* ── 現在地 ── */}
          {tab === 'now' && (
            <div className="space-y-4">
              <section className="overflow-hidden rounded-2xl p-5 text-white sm:p-7" style={{ background: NAVY }}>
                <p className="text-xs font-bold text-teal-200/90">
                  {base.complete ? `${ym(base.month)}の売上（実績）` : `${ym(base.month)}の着地見込み（予測）`}
                </p>
                <p className="mt-1 flex flex-wrap items-baseline gap-x-2">
                  <span className="text-[34px] font-black leading-none tabular-nums sm:text-[40px]">{man(headline)}円</span>
                  <span className="text-sm text-white/60">／ 目標 {man(goal)}円</span>
                </p>
                <div className="mt-4">
                  <Bar100 value={headline} goal={goal} tone="light" />
                </div>
                <div className="mt-2 flex flex-wrap justify-between gap-2 text-sm">
                  <span className="text-white/80">達成率 {goal > 0 ? fmt1((headline / goal) * 100) : 0}%</span>
                  <span className="font-bold">{headline >= goal ? '目標に届いています' : `あと ${man(goal - headline)}円`}</span>
                </div>
                {!base.complete && (
                  <p className="mt-3 border-t border-white/10 pt-3 text-xs text-white/60">
                    {asOfDay}日までの実績 {man(actual)}円{extraAmount > 0 ? '（その他の収入を含む）' : ''}・NOAHの集計 {dateLabel(base.asOf)}まで
                  </p>
                )}
              </section>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <p className="text-xs font-bold text-slate-500">1日の来院（実績）</p>
                  <p className="mt-1 text-[22px] font-black tabular-nums text-slate-900">{fmt1(base.perDaySoFar)}人</p>
                  <p className="text-xs text-slate-500">最多の日 {fmt(base.maxDayVisits)}人</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <p className="text-xs font-bold text-slate-500">1回あたり（実績）</p>
                  <p className="mt-1 text-[22px] font-black tabular-nums text-slate-900">{yen(base.perVisit)}</p>
                  <p className="text-xs text-slate-500">NOAHの分</p>
                </div>
              </div>

              {stage && nextAction && headline < goal && (
                <Card>
                  <p className="text-xs font-bold text-teal-700">
                    {base.complete ? 'まずやること' : '今週いちばんにやること'}（段階 {stageIdx + 1}／4：{STAGE_SHORT[stage.key]}）
                  </p>
                  <p className="mt-1.5 text-base font-bold leading-relaxed text-slate-900">{nextAction.text}</p>
                  {stage.key === 'keep' && goneNote && <p className="mt-2 text-xs leading-relaxed text-slate-500">{goneNote.text}</p>}
                  <div className="mt-3 flex flex-wrap gap-2">
                    {nextAction.href && (
                      <Link
                        href={nextAction.href}
                        className="inline-flex h-11 items-center rounded-full bg-teal-700 px-5 text-sm font-bold text-white hover:bg-teal-800"
                      >
                        {nextAction.link}を開く
                      </Link>
                    )}
                    <button type="button" onClick={() => setTab('plan')} className={pill}>
                      計画を見る
                    </button>
                  </div>
                </Card>
              )}

              {notes[0] && <p className="px-1 text-sm leading-relaxed text-slate-600">{notes[0].text}</p>}

              <div className="grid grid-cols-2 gap-3">
                <button type="button" onClick={() => setTab('analysis')} className={`${pill} h-12 rounded-2xl`}>
                  分析を見る
                </button>
                <button type="button" onClick={() => setTab('sim')} className={`${pill} h-12 rounded-2xl`}>
                  試算する
                </button>
              </div>
            </div>
          )}

          {/* ── 分析 ── */}
          {tab === 'analysis' && (
            <div className="space-y-4">
              <Card title="売上の内訳（実績）" sub={`${ym(base.month)} ${asOfDay}日まで。売上 ＝ 来院 × 1回あたり`}>
                <Breakdown base={base} extraAmount={extraAmount} />
              </Card>

              {trend.length > 0 && (
                <Card title="毎月の推移">
                  <TrendChart rows={trend} goal={goal} />
                </Card>
              )}

              <Fold title="いま言えること" sub="NOAHの集計から計算した目安" open>
                <ul className="space-y-2 text-sm leading-relaxed text-slate-700">
                  {notes.map((n) => (
                    <li key={n.text} className="flex gap-2">
                      <span className={n.tone === 'warn' ? 'text-amber-700' : 'text-teal-700'} aria-hidden>
                        ●
                      </span>
                      <span className="min-w-0">{n.text}</span>
                    </li>
                  ))}
                </ul>
              </Fold>

              {(() => {
                const m = months.find((x) => x.month === base.month)
                const items = m ? [...m.self, ...m.goods].sort((a, b) => b[2] - a[2]).slice(0, 8) : []
                if (items.length === 0) return null
                return (
                  <Fold title="自費メニュー・商品" sub="金額の多い順">
                    <ul className="divide-y divide-slate-100 text-sm">
                      {items.map(([name, price, total, count]) => (
                        <li key={name} className="flex items-baseline justify-between gap-3 py-2 tabular-nums">
                          <span className="min-w-0 truncate text-slate-800">{name}</span>
                          <span className="shrink-0 text-right">
                            <span className="font-bold text-slate-900">{yen(total)}</span>
                            <span className="block text-xs text-slate-500">
                              {fmt(count)}点・単価{yen(price)}
                            </span>
                          </span>
                        </li>
                      ))}
                    </ul>
                  </Fold>
                )
              })()}

              <Fold
                title="その他の収入（アルファノート）"
                sub={extraNow ? `${ym(base.month)}：売上に足す分 ${yen(extraAmount)}` : `${ym(base.month)}の分はまだ入っていません`}
              >
                <p className="text-xs leading-relaxed text-slate-500">
                  NOAHに入らない収入（サブスク）と、QR・クレジットカードの支払いです。窓口の料金をカードやQRで払われた分はNOAHにも入っているので、重なる分を引いて足します。
                </p>
                {extraForm === null ? (
                  <>
                    {extraNow && (
                      <dl className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
                        {(
                          [
                            ['サブスク', extraNow.subscription, ''],
                            ['QR・カードの合計', extraNow.cashless, ''],
                            ['うちNOAHと重なる分', extraNow.overlap, '−'],
                            ['売上に足す分', extraAmount, ''],
                          ] as const
                        ).map(([label, v, sign]) => (
                          <div key={label} className="rounded-xl bg-slate-50 px-3 py-2">
                            <dt className="text-xs text-slate-500">{label}</dt>
                            <dd className="font-bold tabular-nums">
                              {sign}
                              {yen(v)}
                            </dd>
                          </div>
                        ))}
                      </dl>
                    )}
                    <button
                      type="button"
                      onClick={() =>
                        setExtraForm({
                          subscription: String(extraNow?.subscription ?? ''),
                          cashless: String(extraNow?.cashless ?? ''),
                          overlap: String(extraNow?.overlap ?? ''),
                        })
                      }
                      className={` max-lg:min-h-10${pill} mt-3`}
                    >
                      {extraNow ? '直す' : '入れる'}
                    </button>
                  </>
                ) : (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault()
                      void saveExtra()
                    }}
                    className="mt-3 grid gap-3 sm:grid-cols-3"
                  >
                    {(
                      [
                        ['subscription', 'サブスク（円）'],
                        ['cashless', 'QR・カードの合計（円）'],
                        ['overlap', 'うちNOAHと重なる分（円）'],
                      ] as const
                    ).map(([key, label]) => (
                      <div key={key} className="min-w-0">
                        <label htmlFor={`extra-${key}`} className="text-xs font-bold text-slate-600">
                          {label}
                        </label>
                        <input
                          id={`extra-${key}`}
                          inputMode="numeric"
                          value={extraForm[key]}
                          onChange={(e) => setExtraForm({ ...extraForm, [key]: e.target.value })}
                          className="mt-1 h-11 w-full rounded-xl border border-slate-300 px-3 text-right text-sm tabular-nums"
                        />
                      </div>
                    ))}
                    <div className="flex gap-2 sm:col-span-3">
                      <button
                        type="submit"
                        disabled={saving}
                        className="h-11 rounded-full bg-teal-700 px-6 text-sm font-bold text-white disabled:opacity-50"
                      >
                        {saving ? '保存中…' : '保存'}
                      </button>
                      <button type="button" onClick={() => setExtraForm(null)} className={pill}>
                        やめる
                      </button>
                    </div>
                  </form>
                )}
              </Fold>
            </div>
          )}

          {/* ── 試算 ── */}
          {tab === 'sim' && (
            <div className="space-y-4">
              <section className="rounded-2xl p-5 text-white sm:p-6" style={{ background: NAVY }}>
                <p className="text-xs font-bold text-teal-200/90">この条件だと、月の売上は（試算）</p>
                <p className="mt-1 text-[34px] font-black leading-none tabular-nums">{man(result.sales)}円</p>
                <div className="mt-3">
                  <Bar100 value={result.sales} goal={goal} tone="light" />
                </div>
                <dl className="mt-3 grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <dt className="text-white/60">{base.complete ? '実績' : 'いまの見込み'}</dt>
                    <dd className="font-bold tabular-nums">{man(headline)}円</dd>
                  </div>
                  <div>
                    <dt className="text-white/60">目標</dt>
                    <dd className="font-bold tabular-nums">{man(goal)}円</dd>
                  </div>
                  <div>
                    <dt className="text-white/60">目標との差</dt>
                    <dd className="font-bold tabular-nums">
                      {result.sales >= goal ? `+${man(result.sales - goal)}円` : `−${man(goal - result.sales)}円`}
                    </dd>
                  </div>
                </dl>
              </section>

              {headline < goal && (
                <div className="flex flex-wrap gap-2" role="group" aria-label="目標に届く組み合わせ">
                  {req.balanced.result.sales >= goal ? (
                    <button
                      type="button"
                      onClick={() => setSim(req.balanced.input)}
                      className="h-10 rounded-full bg-teal-700 px-4 text-sm font-bold text-white hover:bg-teal-800"
                    >
                      そろって{fmt1(req.balanced.k)}倍（おすすめ）
                    </button>
                  ) : (
                    <p className="w-full text-xs text-slate-500">来院・自費の1回あたり・交通事故をそろって5倍にしても届かない目標です。</p>
                  )}
                  <button
                    type="button"
                    onClick={() =>
                      setSim({
                        ...defaults,
                        // 丸めで目標をわずかに下回らないよう、切り上げる
                        perDay: Math.ceil(req.visitsOnly.perDay * 10 - 1e-9) / 10,
                        accVisits: Math.ceil(defaults.accVisits * req.visitsOnly.ratio - 1e-9),
                      })
                    }
                    className="h-10 rounded-full border border-slate-300 bg-white px-4 text-sm font-bold text-slate-700"
                  >
                    来院だけで
                  </button>
                  {req.selfUnitOnly && (
                    <button
                      type="button"
                      onClick={() => setSim({ ...defaults, selfUnit: Math.ceil(req.selfUnitOnly!.selfUnit) })}
                      className="h-10 rounded-full border border-slate-300 bg-white px-4 text-sm font-bold text-slate-700"
                    >
                      自費の1回あたりだけで
                    </button>
                  )}
                  {sim && (
                    <button type="button" onClick={() => setSim(null)} className="h-10 px-2 text-sm font-bold text-slate-500 underline">
                      いまの数字に戻す
                    </button>
                  )}
                </div>
              )}

              <Card title="基本の条件">
                <div className="grid gap-5 sm:grid-cols-2">
                  <Stepper
                    id="sim-perday"
                    label="1日の来院"
                    value={input.perDay}
                    min={0}
                    max={Math.max(80, Math.ceil(defaults.perDay * 3))}
                    step={0.5}
                    display={`${fmt1(input.perDay)}人`}
                    onChange={(v) => set({ perDay: v })}
                    hint={`いま ${fmt1(defaults.perDay)}人（土曜の半日もならした月の平均）・最多の日 ${fmt(base.maxDayVisits)}人`}
                  />
                  <Stepper
                    id="sim-selfunit"
                    label="自費・商品の1回あたり"
                    value={input.selfUnit}
                    min={0}
                    max={Math.max(10_000, Math.ceil((defaults.selfUnit * 3) / 1000) * 1000)}
                    step={100}
                    display={yen(input.selfUnit)}
                    onChange={(v) => set({ selfUnit: v })}
                    hint={`いま ${yen(defaults.selfUnit)}`}
                  />
                </div>
                {overCapacity && (
                  <p className="mt-4 rounded-xl bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-900">
                    1日 {fmt1(input.perDay)}人は、これまでの最多の日（{fmt(base.maxDayVisits)}人）を超えます。予約枠・時間・人の体制の見直しが要ります。
                  </p>
                )}
              </Card>

              <Fold title="詳しい条件" sub="営業日・自費の方の割合・交通事故・その他の収入">
                <div className="grid gap-5 sm:grid-cols-2">
                  <Stepper
                    id="sim-days"
                    label="1か月の営業日"
                    value={input.days}
                    min={15}
                    max={31}
                    step={1}
                    display={`${input.days}日`}
                    onChange={(v) => set({ days: v })}
                  />
                  <Stepper
                    id="sim-share"
                    label="自費・商品の方の割合"
                    value={Math.round(input.selfShare * 100)}
                    min={0}
                    max={100}
                    step={1}
                    display={`${Math.round(input.selfShare * 100)}%`}
                    onChange={(v) => set({ selfShare: v / 100 })}
                    hint={`交通事故以外の来院のうち。いま ${Math.round(defaults.selfShare * 100)}%`}
                  />
                  <Stepper
                    id="sim-acc"
                    label="交通事故の来院（月）"
                    value={input.accVisits}
                    min={0}
                    max={Math.max(200, defaults.accVisits * 4)}
                    step={1}
                    display={`${fmt(input.accVisits)}回`}
                    onChange={(v) => set({ accVisits: v })}
                    hint={`1回あたり ${yen(input.accUnit)}`}
                  />
                  <Stepper
                    id="sim-extra"
                    label="その他の収入（月）"
                    value={input.extra}
                    min={0}
                    max={Math.max(2_000_000, Math.ceil((defaults.extra * 3) / 100_000) * 100_000)}
                    step={10_000}
                    display={yen(input.extra)}
                    onChange={(v) => set({ extra: v })}
                    hint="サブスクなど（アルファノート）"
                  />
                </div>
                <p className="mt-4 text-xs text-slate-500">保険の1回あたり（{yen(input.insUnit)}）は決まった料金なので動かしません。</p>
              </Fold>
            </div>
          )}

          {/* ── 計画 ── */}
          {tab === 'plan' && (
            <div className="space-y-3">
              {plan.length === 0 && (
                <Card>
                  <p className="text-sm text-slate-700">
                    {base.complete ? `${ym(base.month)}の実績は目標に届きました。` : '今月の見込みは目標に届いています。'}
                    いまの取り組みを続けましょう。
                  </p>
                </Card>
              )}
              {plan.map((st, i) => {
                const done = ACTIONS[st.key].filter((a) => checks.has(a.id)).length
                const isNow = i === stageIdx
                return (
                  <details key={st.key} open={isNow} className="group rounded-2xl border border-slate-200 bg-white">
                    <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3.5 sm:px-6 [&::-webkit-details-marker]:hidden">
                      <span
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-black ${
                          isNow ? 'bg-teal-700 text-white' : i < stageIdx ? 'bg-teal-100 text-teal-800' : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        {i + 1}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[15px] font-bold text-slate-900">
                          {STAGE_SHORT[st.key]}
                          {isNow && (
                            <span className="ml-2 rounded-full bg-teal-50 px-2 py-0.5 align-middle text-xs font-bold text-teal-700">
                              いまの段階
                            </span>
                          )}
                        </span>
                        <span className="block text-xs tabular-nums text-slate-500">
                          月 {man(st.target)}円（+{man(st.add)}円）・{done}／{ACTIONS[st.key].length} 完了
                        </span>
                      </span>
                      <ChevronDown className="h-5 w-5 shrink-0 text-slate-500 transition-transform group-open:rotate-180" aria-hidden />
                    </summary>
                    <div className="border-t border-slate-100 px-4 pb-4 pt-3 sm:px-6">
                      <p className="text-xs leading-relaxed text-slate-500">目安：{st.measure}</p>
                      {STAGE_TEMPLATE[st.key] && (
                        <Link
                          href={`/marketing/sales/pdca?t=${STAGE_TEMPLATE[st.key]}`}
                          className="mt-2 inline-flex h-10 items-center rounded-full bg-teal-50 px-4 text-sm font-bold text-teal-800 hover:bg-teal-100"
                        >
                          この段階をPDCAで回す
                        </Link>
                      )}
                      <ul className="mt-3 space-y-1">
                        {ACTIONS[st.key].map((a) => (
                          <li key={a.id} className="flex items-start gap-3 rounded-xl px-1 py-1.5">
                            <input
                              id={`act-${a.id}`}
                              type="checkbox"
                              checked={checks.has(a.id)}
                              onChange={() => toggleCheck(a.id)}
                              className="mt-0.5 h-5 w-5 shrink-0 accent-teal-600"
                            />
                            <label
                              htmlFor={`act-${a.id}`}
                              className={`min-w-0 flex-1 text-sm leading-relaxed max-lg:min-h-10 ${checks.has(a.id) ? 'text-slate-500 line-through' : 'text-slate-700'}`}
                            >
                              {a.text}
                            </label>
                            {a.href && (
                              <Link
                                href={a.href}
                                className="shrink-0 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-200 max-lg:min-h-10 max-lg:inline-flex max-lg:items-center"
                              >
                                {a.link}
                              </Link>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </details>
                )
              })}

              <Fold title="守ること">
                <ul className="space-y-1.5 text-sm leading-relaxed text-slate-700">
                  <li>・保険（療養費）は、行った施術のとおりに正しく請求する。売上の目標のために、部位・回数・内容を実際と違えて請求しない。</li>
                  <li>・保険の窓口負担を割り引いたり、金品や紹介のお礼で患者さんをさそったりしない（保険の取り扱いの決まりで禁じられています）。</li>
                  <li>・広告や投稿は「あはき・柔整広告ガイドライン」の範囲で。効果の保証・体験談・割引の強調はしない。</li>
                  <li>・自費は、必要な理由と料金を説明し、同意をいただいてから。強くすすめない。</li>
                  <li>
                    ・ここの数字はNOAHの集計からの目安です。これからの日は、日曜・祝日を休み、土曜を半日として見込んでいます（臨時の休診・年末年始は考えていません）。
                  </li>
                </ul>
              </Fold>
            </div>
          )}
        </>
      )}
    </div>
  )
}
