'use client'

/**
 * 月の売上の目標（はじめは300万円）への道すじ — 院長のみ・経営メニュー（隠しモード）の中
 *
 * NOAH の集計（毎晩届く数字だけ）と、NOAH 以外の収入（アルファノートのサブスクなど）から、
 * いまの位置・目標に届く数字・試算・4つの段階と打ち手を出す。数字はすべて目安。
 * 計算は src/lib/marketing/goal-plan.ts（架空の数字で単体テストあり）。
 */
import { useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from 'react'
import Link from 'next/link'
import { Bar, BarChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useMarketingRole } from '@/lib/marketing/use-role'
import type { NoahStore } from '@/lib/marketing/noah-types'
import { dateLabel, monthPoints } from '@/lib/marketing/noah-analysis'
import {
  DEFAULT_GOAL,
  baseline,
  insights,
  isCompleteMonth,
  man,
  requirement,
  simDefaults,
  simulate,
  stages,
  type SimInput,
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

const fmt = (n: number) => Math.round(n).toLocaleString('ja-JP')
const fmt1 = (n: number) => (Math.round(n * 10) / 10).toLocaleString('ja-JP')
const yen = (n: number) => `${fmt(n)}円`
const ym = (month: string) => `${month.slice(0, 4)}年${Number(month.slice(5, 7))}月`
const extraOf = (e?: ExtraMonth) => (e ? e.subscription + Math.max(0, e.cashless - e.overlap) : 0)

// ── この端末に覚えておく小さな設定（目標の金額・チェックした打ち手） ──────────────

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

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="min-w-0 rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-xs font-bold text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-black text-slate-900">{value}</p>
      {sub && <p className="mt-1 text-xs text-slate-500">{sub}</p>}
    </div>
  )
}

function Progress({ value, goal }: { value: number; goal: number }) {
  const pct = goal > 0 ? Math.min(100, Math.round((value / goal) * 100)) : 0
  return (
    <div>
      <div className="h-3 w-full overflow-hidden rounded-full bg-slate-100" role="img" aria-label={`目標の${pct}%`}>
        <div className="h-full rounded-full bg-teal-600" style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-1 text-xs text-slate-500">目標の {pct}%</p>
    </div>
  )
}

function Slider({
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
  return (
    <div className="min-w-0">
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={id} className="text-sm font-bold text-slate-700">
          {label}
        </label>
        <span className="text-sm font-black tabular-nums text-slate-900">{display}</span>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={Math.min(max, Math.max(min, value))}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-1 w-full accent-teal-600"
      />
      {hint && <p className="text-[11px] text-slate-500">{hint}</p>}
    </div>
  )
}

// ── 打ち手（段階ごと） ─────────────────────────────────────

const ACTIONS: Record<StageKey, Array<{ id: string; text: string; href?: string; link?: string }>> = {
  keep: [
    { id: 'keep-next', text: '施術の終わりに、次回の予約をその場で一緒に決める', href: '/yoyaku', link: '予約' },
    {
      id: 'keep-watch',
      text: '「今日」の「気にかけたい方」を毎日見て、治療中なのに間があいた方へ声をかける（LINE・電話）',
      href: '/dashboard',
      link: '今日',
    },
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

// ── 毎月の推移 ─────────────────────────────────────────────

function TrendChart({
  rows,
  goal,
}: {
  rows: Array<{ month: string; label: string; noah: number; extra: number; rest: number; partial: boolean }>
  goal: number
}) {
  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} margin={{ top: 16, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} stroke="#e2e8f0" />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={{ stroke: '#e2e8f0' }} />
          <YAxis
            tick={{ fontSize: 11, fill: '#64748b' }}
            tickLine={false}
            axisLine={false}
            width={44}
            tickFormatter={(n: number) => man(n)}
            domain={[0, (max: number) => Math.max(max, goal) * 1.08]}
          />
          <Tooltip
            cursor={{ fill: 'rgba(148,163,184,0.12)' }}
            content={({ active, payload }) => {
              const row = active && payload?.[0] ? (payload[0].payload as (typeof rows)[number]) : null
              if (!row) return null
              return (
                <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-sm">
                  <p className="font-bold text-slate-900">{ym(row.month)}</p>
                  <p className="text-slate-700">NOAH：{yen(row.noah)}</p>
                  {row.extra > 0 && <p className="text-slate-700">NOAH以外：{yen(row.extra)}</p>}
                  {row.rest > 0 && <p className="text-slate-500">月末までの見込み：+{yen(row.rest)}</p>}
                </div>
              )
            }}
          />
          <ReferenceLine
            y={goal}
            stroke="#b45309"
            strokeDasharray="5 3"
            label={{ value: `目標 ${man(goal)}`, position: 'insideTopRight', fontSize: 11, fill: '#b45309' }}
          />
          <Bar dataKey="noah" stackId="s" fill="#2f5d9a" maxBarSize={28} isAnimationActive={false} />
          <Bar dataKey="extra" stackId="s" fill="#0d9488" maxBarSize={28} isAnimationActive={false} />
          <Bar dataKey="rest" stackId="s" fill="#cbd5e1" maxBarSize={28} radius={[4, 4, 0, 0]} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

// ── 画面 ─────────────────────────────────────────────

export default function GoalPage() {
  const { isAdmin } = useMarketingRole()
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
      fetch('/api/marketing/noah', { cache: 'no-store' }).then(async (r) => (r.ok ? ((await r.json()) as { store: NoahStore | null }) : null)),
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
  const result = input ? simulate(input) : null
  const req = defaults ? requirement(goal, defaults) : null
  const plan = defaults && base ? stages(goal, defaults, base.maxDayVisits) : []
  const notes = defaults && base ? insights(goal, base, defaults) : []

  // 毎月の推移（NOAH＋NOAH以外、途中の月は月末までの見込みを薄く）
  const trend = [...months]
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
        partial: !isCompleteMonth(m),
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
      setMessage('NOAH以外の収入を保存しました')
    } catch {
      setMessage('保存できませんでした（通信の失敗）')
    } finally {
      setSaving(false)
    }
  }

  const set = (patch: Partial<SimInput>) => input && setSim({ ...input, ...patch })
  const overCapacity = Boolean(input && base && input.perDay > base.maxDayVisits)

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-black text-slate-900">月の売上 {man(goal)}円への道すじ</h1>
          <p className="mt-1 text-sm text-slate-600">
            毎晩届くNOAHの集計と、NOAH以外の収入（アルファノートのサブスクなど）から、いまの位置と、目標に届くための数字を出します。数字はすべて目安です。
          </p>
          {base && <p className="mt-1 text-xs text-slate-500">NOAHの集計：{dateLabel(base.asOf)}まで</p>}
        </div>
        {editGoal === null ? (
          <button
            type="button"
            onClick={() => setEditGoal(String(goal / 10_000))}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
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
              className="h-10 w-24 rounded-lg border border-slate-300 px-2 text-right text-sm"
            />
            <span className="text-sm text-slate-600">万円</span>
            <button type="submit" className="h-10 rounded-lg bg-slate-900 px-3 text-sm font-bold text-white">
              決める
            </button>
          </form>
        )}
      </div>
      {message && <p className="rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-700">{message}</p>}
      {!loaded && <p className="text-sm text-slate-400">読み込み中…</p>}
      {loaded && !base && (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-600">
          まだNOAHの集計が届いていません。毎晩21時すぎに届くと、ここに道すじが出ます。
        </div>
      )}

      {base && defaults && now && req && (
        <>
          {/* いまの位置 */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat
              label={base.complete ? `${ym(base.month)}の売上` : '今月の見込み（月末）'}
              value={`${man(now.sales)}円`}
              sub={
                base.complete
                  ? undefined
                  : `${Number(base.asOf.slice(8, 10))}日までの実績 ${man(base.sales + extraAmount)}円${extraAmount > 0 ? '（NOAH以外を含む）' : ''}`
              }
            />
            <Stat label="目標まで" value={now.sales >= goal ? '達成' : `あと${man(goal - now.sales)}円`} sub={`目標 ${man(goal)}円`} />
            <Stat
              label="1日の来院"
              value={`${fmt1(base.perDay)}人`}
              sub={`営業日 ${base.openDaysSoFar}日（今月の見込み ${base.openDaysMonth}日）・最多の日 ${fmt(base.maxDayVisits)}人`}
            />
            <Stat label="1回あたり（NOAH）" value={yen(base.perVisit)} sub={`来院 ${fmt(base.visits)}回・${yen(base.sales)}`} />
          </div>
          <Progress value={now.sales} goal={goal} />

          {/* 気づき */}
          {notes.length > 0 && (
            <Card title="いま言えること">
              <ul className="space-y-2 text-sm text-slate-700">
                {notes.map((n) => (
                  <li key={n.text} className="flex gap-2">
                    <span className={n.tone === 'warn' ? 'text-amber-600' : 'text-teal-700'} aria-hidden>
                      ●
                    </span>
                    <span className="min-w-0">{n.text}</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {/* 売上の分け方 */}
          <Card title="売上の分け方" sub={`${ym(base.month)}（${Number(base.asOf.slice(8, 10))}日まで）。売上 ＝ 来院 × 1回あたり`}>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[480px] text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
                    <th className="py-1.5 pr-2 font-bold">区分</th>
                    <th className="px-2 py-1.5 text-right font-bold">来院</th>
                    <th className="px-2 py-1.5 text-right font-bold">割合</th>
                    <th className="px-2 py-1.5 text-right font-bold">金額</th>
                    <th className="px-2 py-1.5 text-right font-bold">売上の割合</th>
                    <th className="py-1.5 pl-2 text-right font-bold">1回あたり</th>
                  </tr>
                </thead>
                <tbody className="tabular-nums">
                  {base.kinds.map((k) => (
                    <tr key={k.key} className="border-b border-slate-100">
                      <td className="py-1.5 pr-2 font-bold text-slate-800">{k.label}</td>
                      <td className="px-2 py-1.5 text-right">{fmt(k.visits)}回</td>
                      <td className="px-2 py-1.5 text-right">{Math.round(k.shareVisits * 100)}%</td>
                      <td className="px-2 py-1.5 text-right">{yen(k.sales)}</td>
                      <td className="px-2 py-1.5 text-right">{Math.round(k.shareSales * 100)}%</td>
                      <td className="py-1.5 pl-2 text-right">{k.visits > 0 ? yen(k.perVisit) : '—'}</td>
                    </tr>
                  ))}
                  <tr className="border-b border-slate-100 text-slate-600">
                    <td className="py-1.5 pr-2 font-bold">NOAH以外</td>
                    <td className="px-2 py-1.5 text-right">—</td>
                    <td className="px-2 py-1.5 text-right">—</td>
                    <td className="px-2 py-1.5 text-right">{extraNow ? yen(extraAmount) : '未入力'}</td>
                    <td className="px-2 py-1.5 text-right">—</td>
                    <td className="py-1.5 pl-2 text-right">—</td>
                  </tr>
                </tbody>
              </table>
            </div>
            {(() => {
              const m = months.find((x) => x.month === base.month)
              const items = m ? [...m.self, ...m.goods].sort((a, b) => b[2] - a[2]).slice(0, 6) : []
              if (items.length === 0) return null
              return (
                <div className="mt-3">
                  <p className="text-xs font-bold text-slate-500">自費メニュー・商品（金額の多い順）</p>
                  <ul className="mt-1 grid gap-x-6 gap-y-1 text-sm text-slate-700 sm:grid-cols-2">
                    {items.map(([name, price, total, count]) => (
                      <li key={name} className="flex justify-between gap-2 tabular-nums">
                        <span className="min-w-0 truncate">{name}</span>
                        <span className="shrink-0 text-slate-500">
                          {yen(total)}（{fmt(count)}点・単価{yen(price)}）
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )
            })()}
          </Card>

          {/* NOAH以外の収入 */}
          <Card
            title="NOAH以外の収入（アルファノート）"
            sub="サブスクの収入と、QR・クレジットカードの支払い。カードやQRで窓口の料金を払われた分はNOAHにも入っているので、重なる分を引いて足します。"
            action={
              extraForm === null ? (
                <button
                  type="button"
                  onClick={() =>
                    setExtraForm({
                      subscription: String(extraNow?.subscription ?? ''),
                      cashless: String(extraNow?.cashless ?? ''),
                      overlap: String(extraNow?.overlap ?? ''),
                    })
                  }
                  className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-bold text-slate-700 hover:bg-slate-50"
                >
                  {extraNow ? '直す' : '入れる'}
                </button>
              ) : undefined
            }
          >
            {extraForm === null ? (
              extraNow ? (
                <dl className="grid gap-2 text-sm sm:grid-cols-4">
                  <div>
                    <dt className="text-xs text-slate-500">サブスク</dt>
                    <dd className="font-bold tabular-nums">{yen(extraNow.subscription)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-500">QR・カードの合計</dt>
                    <dd className="font-bold tabular-nums">{yen(extraNow.cashless)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-500">そのうちNOAHと重なる分</dt>
                    <dd className="font-bold tabular-nums">−{yen(extraNow.overlap)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-500">売上に足す分</dt>
                    <dd className="font-black tabular-nums text-teal-700">{yen(extraAmount)}</dd>
                  </div>
                </dl>
              ) : (
                <p className="text-sm text-slate-500">{ym(base.month)}の分はまだ入っていません。</p>
              )
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  void saveExtra()
                }}
                className="grid gap-3 sm:grid-cols-4"
              >
                {(
                  [
                    ['subscription', 'サブスク（円）'],
                    ['cashless', 'QR・カードの合計（円）'],
                    ['overlap', 'そのうちNOAHと重なる分（円）'],
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
                      className="mt-1 h-10 w-full rounded-lg border border-slate-300 px-2 text-right text-sm tabular-nums"
                    />
                  </div>
                ))}
                <div className="flex items-end gap-2">
                  <button
                    type="submit"
                    disabled={saving}
                    className="h-10 rounded-lg bg-slate-900 px-4 text-sm font-bold text-white disabled:opacity-50"
                  >
                    {saving ? '保存中…' : '保存'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setExtraForm(null)}
                    className="h-10 rounded-lg border border-slate-300 px-3 text-sm font-bold text-slate-600"
                  >
                    やめる
                  </button>
                </div>
              </form>
            )}
          </Card>

          {/* 目標に届く3つの道 */}
          {now.sales < goal && (
            <Card title={`${man(goal)}円に届く3つの道`} sub="どれか1つを選ぶのではなく、組み合わせの目安にしてください">
              <div className="grid gap-3 md:grid-cols-3">
                <div className="rounded-xl bg-slate-50 p-3">
                  <p className="text-xs font-black text-slate-700">① 来院だけで</p>
                  <p className="mt-1 text-lg font-black text-slate-900">1日 {fmt1(req.visitsOnly.perDay)}人</p>
                  <p className="text-xs text-slate-500">
                    いまの{fmt1(req.visitsOnly.ratio)}倍（月 {fmt(req.visitsOnly.visits)}回）
                  </p>
                  <button
                    type="button"
                    onClick={() =>
                      setSim({
                        ...defaults,
                        perDay: Math.round(req.visitsOnly.perDay * 10) / 10,
                        accVisits: Math.round(defaults.accVisits * req.visitsOnly.ratio),
                      })
                    }
                    className="mt-2 text-xs font-bold text-teal-700 underline"
                  >
                    試算に入れる
                  </button>
                </div>
                <div className="rounded-xl bg-slate-50 p-3">
                  <p className="text-xs font-black text-slate-700">② 自費・商品の1回あたりだけで</p>
                  {req.selfUnitOnly ? (
                    <>
                      <p className="mt-1 text-lg font-black text-slate-900">1回 {yen(req.selfUnitOnly.selfUnit)}</p>
                      <p className="text-xs text-slate-500">いまの{fmt1(req.selfUnitOnly.ratio)}倍（来院はいまのまま）</p>
                      <button
                        type="button"
                        onClick={() => setSim({ ...defaults, selfUnit: Math.round(req.selfUnitOnly!.selfUnit) })}
                        className="mt-2 text-xs font-bold text-teal-700 underline"
                      >
                        試算に入れる
                      </button>
                    </>
                  ) : (
                    <p className="mt-1 text-sm text-slate-500">自費の来院がないため計算できません</p>
                  )}
                </div>
                <div className="rounded-xl bg-teal-50 p-3 ring-1 ring-teal-200">
                  <p className="text-xs font-black text-teal-800">③ そろって少しずつ（おすすめ）</p>
                  <p className="mt-1 text-lg font-black text-slate-900">どれも {fmt1(req.balanced.k)}倍</p>
                  <p className="text-xs text-slate-600">
                    1日 {fmt1(req.balanced.input.perDay)}人・自費 1回 {yen(req.balanced.input.selfUnit)}・交通事故 月
                    {fmt(req.balanced.input.accVisits)}回
                  </p>
                  <button
                    type="button"
                    onClick={() => setSim(req.balanced.input)}
                    className="mt-2 text-xs font-bold text-teal-700 underline"
                  >
                    試算に入れる
                  </button>
                </div>
              </div>
            </Card>
          )}

          {/* 試算 */}
          {input && result && (
            <Card
              title="試算（数字を動かしてみる）"
              sub="保険の1回あたりは決まった料金なので動かしません"
              action={
                sim && (
                  <button type="button" onClick={() => setSim(null)} className="text-xs font-bold text-slate-600 underline">
                    いまの数字に戻す
                  </button>
                )
              }
            >
              <div className="grid gap-5 lg:grid-cols-[1fr_280px]">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Slider
                    id="sim-perday"
                    label="1日の来院"
                    value={input.perDay}
                    min={0}
                    max={Math.max(80, Math.ceil(defaults.perDay * 3))}
                    step={0.5}
                    display={`${fmt1(input.perDay)}人`}
                    onChange={(v) => set({ perDay: v })}
                    hint={`いま ${fmt1(defaults.perDay)}人・最多の日 ${fmt(base.maxDayVisits)}人`}
                  />
                  <Slider
                    id="sim-days"
                    label="1か月の営業日"
                    value={input.days}
                    min={15}
                    max={31}
                    step={1}
                    display={`${input.days}日`}
                    onChange={(v) => set({ days: v })}
                  />
                  <Slider
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
                  <Slider
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
                  <Slider
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
                  <Slider
                    id="sim-extra"
                    label="NOAH以外の収入（月）"
                    value={input.extra}
                    min={0}
                    max={Math.max(2_000_000, Math.ceil((defaults.extra * 3) / 100_000) * 100_000)}
                    step={10_000}
                    display={yen(input.extra)}
                    onChange={(v) => set({ extra: v })}
                    hint="サブスクなど（アルファノート）"
                  />
                </div>
                <div className="rounded-xl bg-slate-50 p-4">
                  <p className="text-xs font-bold text-slate-500">この数字だと、月の売上は</p>
                  <p className={`mt-1 text-3xl font-black ${result.sales >= goal ? 'text-teal-700' : 'text-slate-900'}`}>
                    {man(result.sales)}円
                  </p>
                  <div className="mt-2">
                    <Progress value={result.sales} goal={goal} />
                  </div>
                  <dl className="mt-3 space-y-1 text-xs text-slate-600">
                    <div className="flex justify-between">
                      <dt>来院（月）</dt>
                      <dd className="tabular-nums">{fmt(result.visits)}回</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt>NOAHの分</dt>
                      <dd className="tabular-nums">{yen(result.noahSales)}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt>NOAH以外</dt>
                      <dd className="tabular-nums">{yen(result.extra)}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt>1回あたり（NOAH）</dt>
                      <dd className="tabular-nums">{yen(result.perVisit)}</dd>
                    </div>
                  </dl>
                  {overCapacity && (
                    <p className="mt-3 rounded-lg bg-amber-50 px-2 py-1.5 text-xs text-amber-900">
                      1日 {fmt1(input.perDay)}人は、これまでの最多の日（{fmt(base.maxDayVisits)}人）を超えます。予約枠・時間・人の体制の見直しが要ります。
                    </p>
                  )}
                </div>
              </div>
            </Card>
          )}

          {/* 道すじ */}
          {plan.length > 0 && (
            <Card title="道すじ（4つの段階）" sub="上から順に。1段ずつ月の売上の目安を超えたら、次の段へ。チェックはこの端末に残ります">
              <ol className="space-y-4">
                {plan.map((st, i) => (
                  <li key={st.key} className="rounded-xl border border-slate-200 p-3">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <p className="font-black text-slate-900">
                        {i + 1}. {st.title}
                      </p>
                      <p className="text-sm font-bold text-teal-700">月 {man(st.target)}円（+{man(st.add)}円）</p>
                    </div>
                    <p className="mt-1 text-xs text-slate-600">目安：{st.measure}</p>
                    <ul className="mt-2 space-y-1.5">
                      {ACTIONS[st.key].map((a) => (
                        <li key={a.id} className="flex items-start gap-2 text-sm text-slate-700">
                          <input
                            id={`act-${a.id}`}
                            type="checkbox"
                            checked={checks.has(a.id)}
                            onChange={() => toggleCheck(a.id)}
                            className="mt-1 h-4 w-4 shrink-0 accent-teal-600"
                          />
                          <label htmlFor={`act-${a.id}`} className={`min-w-0 ${checks.has(a.id) ? 'text-slate-400 line-through' : ''}`}>
                            {a.text}
                          </label>
                          {a.href && (
                            <Link href={a.href} className="shrink-0 text-xs font-bold text-teal-700 underline">
                              {a.link}
                            </Link>
                          )}
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ol>
            </Card>
          )}

          {/* 毎月の推移 */}
          {trend.length > 0 && (
            <Card title="毎月の推移" sub="青＝NOAH、緑＝NOAH以外、灰＝今月の月末までの見込み、点線＝目標">
              <TrendChart rows={trend} goal={goal} />
            </Card>
          )}

          {/* 守ること */}
          <Card title="守ること">
            <ul className="space-y-1.5 text-sm text-slate-700">
              <li>・保険（療養費）は、行った施術のとおりに正しく請求する。売上の目標のために、部位・回数・内容を実際と違えて請求しない。</li>
              <li>・保険の窓口負担を割り引いたり、金品や紹介のお礼で患者さんをさそったりしない（保険の取り扱いの決まりで禁じられています）。</li>
              <li>・広告や投稿は「あはき・柔整広告ガイドライン」の範囲で。効果の保証・体験談・割引の強調はしない。</li>
              <li>・自費は、必要な理由と料金を説明し、同意をいただいてから。強くすすめない。</li>
              <li>・ここの数字はNOAHの集計からの目安です。祝日や臨時の休診は、これからの日については考えていません。</li>
            </ul>
          </Card>
        </>
      )}
    </div>
  )
}
