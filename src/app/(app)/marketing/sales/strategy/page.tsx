'use client'
/**
 * 経営方針（90日計画）— 院長のみ・経営メニュー（隠しモード）の中
 *
 * 2026-11-27 院長「この内容を今後の経営課題としてガイド、登録してください。また変更したほうが良いものがあれば
 * いつでも指摘、修正してください」。中身は src/data/keiei-strategy.ts（もとの文は docs/keiei-strategy-2026-11.md）、
 * 進み具合（始めた日・済んだこと・見直しの点の状態）は KV の keiei:strategy（/api/marketing/keiei/strategy）。
 * 今月の売上は NOAH の金額分析から。経営相談（AI）にも同じ方針と進み具合を渡す。
 */
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Check, ChevronRight } from 'lucide-react'
import { useMarketingRole } from '@/lib/marketing/use-role'
import { goalOrDefault } from '@/lib/marketing/goal-local'
import { monthPoints } from '@/lib/marketing/noah-analysis'
import type { NoahStore } from '@/lib/marketing/noah-types'
import { STRATEGY, STRATEGY_PHASES, STRATEGY_REVIEWS, trialBreakdown } from '@/data/keiei-strategy'
import { EMPTY_PROGRESS, PLAN_DAYS, REVIEW_STATUS_LABEL, summarizeProgress, type ReviewStatus, type StrategyProgress } from '@/lib/marketing/keiei-strategy'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const yen = (n: number) => `${Math.round(n).toLocaleString('ja-JP')}円`
const jstToday = () => new Date(Date.now() + 9 * 3_600_000).toISOString().slice(0, 10)

function Card({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn('rounded-xl border border-slate-200 bg-white p-4', className)} aria-label={title}>
      <h2 className="font-bold text-slate-900">{title}</h2>
      <div className="mt-2 text-sm text-slate-800">{children}</div>
    </section>
  )
}

export default function StrategyPage() {
  const { isAdmin } = useMarketingRole()
  const today = useMemo(() => jstToday(), [])
  const [progress, setProgress] = useState<StrategyProgress | null>(null)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [startInput, setStartInput] = useState(today)
  const [noah, setNoah] = useState<NoahStore | null | undefined>(undefined)
  const [appGoal] = useState(() => (typeof window !== 'undefined' ? goalOrDefault() : 0))

  useEffect(() => {
    let alive = true
    fetch('/api/marketing/keiei/strategy', { cache: 'no-store' })
      .then(async (r) => {
        const d = (await r.json().catch(() => null)) as { ok?: boolean; progress?: StrategyProgress } | null
        if (!r.ok || !d?.ok || !d.progress) throw new Error(`HTTP ${r.status}`)
        if (alive) setProgress(d.progress)
      })
      .catch(() => {
        if (alive) {
          setProgress({ ...EMPTY_PROGRESS })
          setError('進み具合を読めませんでした（チェックは保存されないことがあります）')
        }
      })
    fetch('/api/marketing/noah?lite=1', { cache: 'no-store' })
      .then(async (r) => (r.ok ? ((await r.json()) as { store?: NoahStore | null }).store ?? null : null))
      .then((s) => alive && setNoah(s))
      .catch(() => alive && setNoah(null))
    return () => {
      alive = false
    }
  }, [])

  async function save(next: StrategyProgress) {
    const before = progress
    setProgress(next)
    setSaving(true)
    setError('')
    try {
      const r = await fetch('/api/marketing/keiei/strategy', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ progress: next }) })
      const d = (await r.json().catch(() => null)) as { ok?: boolean; error?: string; progress?: StrategyProgress } | null
      if (!r.ok || !d?.ok) throw new Error(d?.error || `HTTP ${r.status}`)
      if (d.progress) setProgress(d.progress)
    } catch (e) {
      setProgress(before)
      setError(`保存できませんでした（${e instanceof Error ? e.message : '不明'}）`)
    } finally {
      setSaving(false)
    }
  }

  const summary = progress ? summarizeProgress(progress, today) : null
  const trial = trialBreakdown()

  // 今月の売上（NOAH の金額分析。保険の請求分を含む総額）
  const month = useMemo(() => {
    if (!noah) return null
    const m = noah.months.find((x) => x.month === today.slice(0, 7))
    if (!m) return null
    const sales = monthPoints(m).reduce((s, p) => s + p.sales, 0)
    return { sales, asOf: m.asOf }
  }, [noah, today])

  if (!isAdmin) return <p className="text-sm text-slate-600">この画面は院長だけが使えます。</p>

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div>
        <h1 className="text-xl font-black text-slate-900">経営方針（90日計画）</h1>
        <p className="text-xs text-slate-500">
          {STRATEGY.registeredAt} に院長の「競合分析および今後の経営戦略」から登録。経営相談（AI）も、この方針をふまえて答えます。方針を変えたいときは、Claude に伝えてください。
        </p>
      </div>

      {/* 目指す姿 */}
      <section className="rounded-xl bg-teal-800 p-4 text-white" aria-label="目指す姿">
        <p className="text-xs font-bold text-teal-100">理念「{STRATEGY.philosophy}」</p>
        <p className="mt-1 text-lg font-black">{STRATEGY.title}</p>
        <p className="mt-1 text-sm text-teal-50">{STRATEGY.vision}</p>
        <p className="mt-2 text-base font-black">「{STRATEGY.motto}」</p>
      </section>

      {error && (
        <p role="alert" className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900 ring-1 ring-amber-200">
          {error}
        </p>
      )}

      {/* 90日の進み具合 */}
      <Card title="90日の実行計画">
        {!progress || !summary ? (
          <p className="text-slate-500">読み込み中…</p>
        ) : (
          <>
            {progress.startDate ? (
              <p className="font-bold">
                {summary.finished ? `90日が終わりました（${summary.day}日目）` : summary.day !== null && summary.day < 1 ? `${progress.startDate} から始めます` : `${summary.day}日目／${PLAN_DAYS}日（${summary.phase?.title ?? ''}）`}
                <span className="ml-2 font-normal text-slate-600">
                  済んだこと {summary.done}/{summary.total}
                </span>
              </p>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                <span>始める日を決めると、何日目か・遅れていることが出ます。</span>
                <input type="date" value={startInput} onChange={(e) => setStartInput(e.target.value)} className="min-h-10 rounded-lg border border-slate-300 px-2" aria-label="1日目" />
                <Button type="button" className="font-bold" disabled={saving || !startInput} onClick={() => void save({ ...progress, startDate: startInput })}>
                  この日を1日目にする
                </Button>
              </div>
            )}
            {summary.overdue.length > 0 && (
              <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-amber-900 ring-1 ring-amber-200">
                段階の日が過ぎて、まだのこと：{summary.overdue.map((t) => t.text).join('／')}
              </p>
            )}
            <div className="mt-3 space-y-3">
              {STRATEGY_PHASES.map((ph) => {
                const current = summary.phase?.key === ph.key
                return (
                  <div key={ph.key} className={cn('rounded-lg border p-3', current ? 'border-teal-700 bg-teal-50/40' : 'border-slate-200')}>
                    <p className="font-bold text-slate-900">
                      {ph.title}
                      {current && <span className="ml-2 rounded-full bg-teal-700 px-2 py-0.5 text-xs text-white">いまここ</span>}
                    </p>
                    <ul className="mt-1 space-y-1">
                      {ph.tasks.map((t) => {
                        const doneAt = progress.done[t.id]
                        return (
                          <li key={t.id} className="flex flex-col gap-x-2 sm:flex-row sm:items-center">
                            <label className="flex min-h-10 min-w-0 flex-1 items-center gap-2">
                              <input
                                type="checkbox"
                                className="h-5 w-5 shrink-0"
                                checked={Boolean(doneAt)}
                                disabled={saving}
                                onChange={(e) => {
                                  const done = { ...progress.done }
                                  if (e.target.checked) done[t.id] = today
                                  else delete done[t.id]
                                  void save({ ...progress, done })
                                }}
                              />
                              <span className={cn('min-w-0 break-keep wrap-anywhere', doneAt && 'text-slate-500 line-through')}>{t.text}</span>
                              {doneAt && <span className="shrink-0 text-xs text-slate-500">（{doneAt}）</span>}
                            </label>
                            {t.link && (
                              <Link href={t.link.href} className="-mt-2 inline-flex min-h-10 shrink-0 items-center pl-7 text-xs font-bold text-teal-800 hover:underline sm:mt-0 sm:pl-0">
                                {t.link.label}
                                <ChevronRight className="h-3.5 w-3.5" aria-hidden />
                              </Link>
                            )}
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                )
              })}
            </div>
            {progress.startDate && (
              <button type="button" className="mt-2 min-h-10 text-xs text-slate-500 underline" disabled={saving} onClick={() => void save({ ...progress, startDate: null })}>
                1日目を決め直す
              </button>
            )}
          </>
        )}
      </Card>

      {/* 目標と今の数字 */}
      <Card title="目標と、いまの数字">
        <ul className="space-y-1.5">
          <li>
            <span className="font-bold">月の売上</span>：戦略の目標 {yen(STRATEGY.goal.monthlySales)} 以上（安定して）／アプリの月の目標 {appGoal ? yen(appGoal) : '—'}
            <br />
            <span className="text-slate-600">
              今月（NOAH の金額分析・保険の請求分を含む）：
              {noah === undefined ? '読み込み中…' : month ? `${yen(month.sales)}（${Number(month.asOf.slice(8, 10))}日まで）・${STRATEGY.goal.monthlySales > 0 ? Math.round((month.sales / STRATEGY.goal.monthlySales) * 100) : 0}%` : 'まだ入っていません'}
            </span>
          </li>
          {STRATEGY.kpis.slice(1).map((k) => (
            <li key={k.label}>
              <span className="font-bold">{k.label}</span>：{k.target}
              <Link href={k.link.href} className="ml-2 text-xs font-bold text-teal-800 hover:underline">
                {k.link.label} →
              </Link>
            </li>
          ))}
        </ul>
        <p className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-700">
          試算（仮定）：初回の評価 {STRATEGY.goal.trial.assessments}人×{yen(STRATEGY.goal.trial.assessmentPrice)}＝{yen(trial.assessment)}、自費 {STRATEGY.goal.trial.selfUsers}人×{STRATEGY.goal.trial.visitsEach}回×{yen(STRATEGY.goal.trial.selfPrice)}＝{yen(trial.self)}、合わせて月 {yen(trial.total)}。{STRATEGY.goal.trialNote}
        </p>
      </Card>

      {/* 見直したほうがよい点 */}
      <Card title={`見直したほうがよい点（${summary ? `まだ ${summary.openReviews}件` : '…'}）`}>
        <p className="text-xs text-slate-500">戦略を読んで気づいたことです。確かめたら印を付けてください。変えたい点は Claude に伝えると、方針と画面を直します。</p>
        <ul className="mt-2 space-y-2">
          {STRATEGY_REVIEWS.map((r) => {
            const st = progress?.reviews[r.id]
            const setStatus = (v: ReviewStatus | null) => {
              if (!progress) return
              const reviews = { ...progress.reviews }
              if (v) reviews[r.id] = v
              else delete reviews[r.id]
              void save({ ...progress, reviews })
            }
            return (
              <li key={r.id} className={cn('rounded-lg border p-3', st ? 'border-slate-200 bg-slate-50' : 'border-amber-200 bg-amber-50/40')}>
                <p className="font-bold text-slate-900">
                  {r.title}
                  {st && (
                    <span className="ml-2 inline-flex items-center gap-0.5 rounded-full bg-teal-50 px-2 py-0.5 text-xs font-bold text-teal-800">
                      <Check className="h-3 w-3" aria-hidden />
                      {REVIEW_STATUS_LABEL[st]}
                    </span>
                  )}
                </p>
                <p className="mt-1 text-slate-700">{r.detail}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {(['checked', 'decided'] as const).map((v) => (
                    <Button key={v} type="button" size="sm" variant={st === v ? 'default' : 'outline'} disabled={saving || !progress} onClick={() => setStatus(st === v ? null : v)}>
                      {REVIEW_STATUS_LABEL[v]}
                    </Button>
                  ))}
                </div>
              </li>
            )
          })}
        </ul>
      </Card>

      {/* 方針の中身 */}
      <Card title="立ち位置">
        <ul className="list-disc space-y-1 pl-5">
          {STRATEGY.stance.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ul>
      </Card>
      <div className="grid gap-4 md:grid-cols-2">
        <Card title="4つの主力サービス">
          <ul className="space-y-1">
            {STRATEGY.services.map((s) => (
              <li key={s.title}>
                <span className="font-bold">{s.title}</span>：{s.who}
              </li>
            ))}
          </ul>
        </Card>
        <Card title={STRATEGY.entry.name}>
          <p>
            約{STRATEGY.entry.minutes}分・{yen(STRATEGY.entry.price)}：{STRATEGY.entry.contents.join('・')}
          </p>
          <p className="mt-1 text-slate-600">{STRATEGY.entry.note}</p>
        </Card>
        <Card title="時間帯ごとの重点">
          <ul className="space-y-1">
            {STRATEGY.timeSlots.map((t) => (
              <li key={t.when}>
                <span className="font-bold">{t.when}</span>：{t.who}
              </li>
            ))}
          </ul>
          <p className="mt-1 text-xs text-slate-500">{STRATEGY.timeSlotNote}</p>
        </Card>
        <Card title="集患の入口">
          <p>{STRATEGY.channels.join('・')}</p>
        </Card>
        <Card title={`予算（${STRATEGY.budget.days}日で ${yen(STRATEGY.budget.yen)} 以内）と力の配分`}>
          <ul className="space-y-1">
            {STRATEGY.allocation.map((a) => (
              <li key={a.label} className="flex items-center gap-2">
                <span className="w-40 shrink-0">{a.label}</span>
                <span className="h-2 rounded bg-teal-700" style={{ width: `${a.pct * 2}px` }} aria-hidden />
                <span className="tabular-nums">{a.pct}%</span>
              </li>
            ))}
          </ul>
          <p className="mt-1 text-xs text-slate-500">{STRATEGY.budget.note}</p>
        </Card>
        <Card title="リハビリパスポート（差別化）">
          <p>{STRATEGY.passport}</p>
        </Card>
      </div>
      <Card title="守ること">
        <ul className="list-disc space-y-1 pl-5">
          {STRATEGY.rules.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      </Card>
    </div>
  )
}
