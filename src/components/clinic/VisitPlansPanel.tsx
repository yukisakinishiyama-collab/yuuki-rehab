'use client'
// ──────────────────────────────────────────────
// 来院予定（日にちだけ。時間を決めない）（2026-11-24 院長「予約の欄で時間予約でなく日にちの来院予定の欄を作成してください」）
//
// - VisitPlansPanel … 予約の画面の「来院予定（日にち）」。入れる・一覧（今日から先／記録がまだの過去の分）・来院した／来なかった・日にちを変える・取り消す
// - TodayVisitPlans … 今日の画面の「今日の来院予定」。今日来る予定の方と、来院した／来なかった
// 予約システムの時間の枠とは別（予約表の空きは減らさない）。患者さんには何も送らない。
// 記録は pt_visit_plans（ほかのカルテの記録と同じく、クラウドとそろう）。決まりは lib/visit-plans.ts
// ──────────────────────────────────────────────
import { useEffect, useId, useMemo, useState, useSyncExternalStore, type FormEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { nanoid } from 'nanoid'
import { CalendarCheck, CalendarDays, Check, X } from 'lucide-react'
import type { Patient } from '@/types/patient'
import { deleteVisitPlan, getPatients, getVisitPlans, initPatientStore, saveVisitPlan } from '@/lib/patient-store'
import { getCurrentUser } from '@/lib/rehab-store'
import { SYNCED_EVENT } from '@/lib/sync-service'
import { setYoyakuView } from '@/lib/yoyaku-view'
import {
  MAX_PLAN_NAME_CHARS, MAX_PLAN_NOTE_CHARS, PAST_UNMARKED_DAYS, VISIT_PLAN_STATUS_LABEL, addDaysYmd, duplicatePlan, findPatientsForPlan,
  groupVisitPlans, jstToday, newVisitPlan, planDateLabel, plansOn, visitPlanProblem,
  type VisitPlan, type VisitPlanStatus,
} from '@/lib/visit-plans'
import { Button, buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Panel } from './Panel'

const fieldClass = 'h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-800 placeholder:text-slate-500 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/30'

const STATUS_TONE: Record<VisitPlanStatus, string> = {
  planned: 'bg-teal-50 text-teal-800 ring-teal-200',
  visited: 'bg-slate-100 text-slate-700 ring-slate-200',
  no_show: 'bg-amber-50 text-amber-900 ring-amber-200',
}

/** この画面で予定を入れた・変えたときの合図（同じ端末のほかの欄も読み直す） */
const PLANS_EVENT = 'visit-plans-changed'

function subscribePlans(fn: () => void): () => void {
  window.addEventListener(SYNCED_EVENT, fn)
  window.addEventListener(PLANS_EVENT, fn)
  window.addEventListener('storage', fn)
  return () => {
    window.removeEventListener(SYNCED_EVENT, fn)
    window.removeEventListener(PLANS_EVENT, fn)
    window.removeEventListener('storage', fn)
  }
}

const readPlansRaw = () => localStorage.getItem('pt_visit_plans') ?? '[]'

function notifyPlansChanged(): void {
  window.dispatchEvent(new Event(PLANS_EVENT))
}

/** 予定の記録を読む（ほかの端末の分を取り込んだとき・この端末で変えたときに読み直す。サーバーでは空） */
export function usePlans(): [VisitPlan[], () => void] {
  const raw = useSyncExternalStore(subscribePlans, readPlansRaw, () => '[]')
  const plans = useMemo(() => (raw === '[]' ? [] : getVisitPlans()), [raw])
  return [plans, notifyPlansChanged]
}

function setStatus(plan: VisitPlan, status: VisitPlanStatus): void {
  saveVisitPlan({ ...plan, status, updatedAt: new Date().toISOString() })
}

/** 1人分の行（名前・メモ・状態・ボタン）。今日の画面では日にちを変えない（compact） */
export function PlanRow({ plan, today, onChange, compact = false, showDate = false }: {
  plan: VisitPlan
  today: string
  onChange: () => void
  compact?: boolean
  showDate?: boolean
}) {
  const [moving, setMoving] = useState(false)
  const [moveTo, setMoveTo] = useState(plan.date)
  const name = plan.patientId
    ? <Link href={`/patients/${plan.patientId}`} className="font-bold text-slate-900 underline-offset-2 hover:underline">{plan.name}</Link>
    : <span className="font-bold text-slate-900">{plan.name}<span className="ml-1.5 text-xs font-normal text-slate-500">（カルテなし）</span></span>

  function mark(status: VisitPlanStatus) {
    setStatus(plan, status)
    onChange()
  }

  function move() {
    if (!moveTo || moveTo === plan.date) {
      setMoving(false)
      return
    }
    saveVisitPlan({ ...plan, date: moveTo, status: 'planned', updatedAt: new Date().toISOString() })
    setMoving(false)
    onChange()
  }

  function remove() {
    if (!window.confirm(`${planDateLabel(plan.date, today)} の ${plan.name} さんの来院予定を取り消しますか？`)) return
    deleteVisitPlan(plan.id)
    onChange()
  }

  return (
    <li className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2 py-2.5 first:pt-0 last:pb-0">
      <div className="min-w-0">
        <p className="flex flex-wrap items-baseline gap-x-2 text-sm">
          {showDate && <span className="text-xs font-semibold text-slate-600">{planDateLabel(plan.date, today)}</span>}
          {name}
          <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ring-1', STATUS_TONE[plan.status])}>
            {VISIT_PLAN_STATUS_LABEL[plan.status]}
          </span>
        </p>
        {plan.note && <p className="mt-0.5 text-sm text-slate-700">{plan.note}</p>}
        {moving && (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <label className="sr-only" htmlFor={`move-${plan.id}`}>新しい日にち</label>
            <input id={`move-${plan.id}`} type="date" value={moveTo} min={addDaysYmd(today, -PAST_UNMARKED_DAYS)} onChange={e => setMoveTo(e.target.value)}
              className={cn(fieldClass, 'w-44')} />
            <Button type="button" size="sm" onClick={move}>この日にする</Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => { setMoving(false); setMoveTo(plan.date) }}>やめる</Button>
          </div>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        {plan.status === 'planned' ? (
          <>
            <Button type="button" size="sm" onClick={() => mark('visited')} className="max-lg:min-h-10">
              <Check className="mr-1 h-4 w-4" aria-hidden />来院した
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => mark('no_show')} className="max-lg:min-h-10">来なかった</Button>
          </>
        ) : (
          <Button type="button" size="sm" variant="ghost" onClick={() => mark('planned')} className="max-lg:min-h-10">予定に戻す</Button>
        )}
        {!compact && !moving && (
          <Button type="button" size="sm" variant="ghost" onClick={() => setMoving(true)} className="max-lg:min-h-10">日にちを変える</Button>
        )}
        {!compact && (
          <Button type="button" size="sm" variant="ghost" onClick={remove} className="text-red-700 hover:text-red-800 max-lg:min-h-10">取り消す</Button>
        )}
      </div>
    </li>
  )
}

/**
 * 来院予定を入れる欄（日にち・患者さん・メモ）。
 * 予約の画面の「来院予定（日にち）」と、予約表の「時間未定」の欄から開く小さな画面（VisitPlanDialog）で使う。
 * initialDate … はじめに選んでおく日にち／onAdded … 入れたあと（小さな画面を閉じる など）
 */
export function PlanAddForm({ initialDate, onAdded, autoFocus = false }: { initialDate?: string; onAdded?: (plan: VisitPlan) => void; autoFocus?: boolean }) {
  const [, reload] = usePlans()
  const today = jstToday()
  const uid = useId()
  const [date, setDate] = useState(initialDate || today)
  const [query, setQuery] = useState('')
  const [picked, setPicked] = useState<Patient | null>(null)
  const [note, setNote] = useState('')
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null)
  const [patients, setPatients] = useState<Patient[]>([])

  const candidates = useMemo(() => (picked ? [] : findPatientsForPlan(patients, query)), [patients, query, picked])

  function loadPatients() {
    if (patients.length === 0) setPatients(getPatients())
  }

  function add(e: FormEvent) {
    e.preventDefault()
    const input = picked
      ? { date, name: picked.name, patientId: picked.id, kana: picked.kana, note }
      : { date, name: query, note }
    const problem = visitPlanProblem(input, today)
    if (problem) {
      setMessage({ tone: 'error', text: problem })
      return
    }
    const same = duplicatePlan(getVisitPlans(), input)
    if (same) {
      setMessage({ tone: 'error', text: `${planDateLabel(date, today)} には、${same.name} さんの来院予定がもう入っています` })
      return
    }
    const plan = newVisitPlan(input, nanoid(), new Date().toISOString(), getCurrentUser()?.name)
    saveVisitPlan(plan)
    reload()
    setQuery('')
    setPicked(null)
    setNote('')
    setMessage({ tone: 'ok', text: `${planDateLabel(plan.date, today)} に ${plan.name} さんを入れました` })
    onAdded?.(plan)
  }

  const quick = [
    { label: '今日', value: today },
    { label: '明日', value: addDaysYmd(today, 1) },
    { label: 'あさって', value: addDaysYmd(today, 2) },
  ]

  return (
    <form onSubmit={add} className="space-y-3">
      <div>
        <p className="mb-1 text-sm font-medium text-slate-700">日にち</p>
        <div className="flex flex-wrap items-center gap-2">
          {quick.map(q => (
            <button key={q.label} type="button" onClick={() => setDate(q.value)} aria-pressed={date === q.value}
              className={cn('min-h-10 rounded-lg px-3 text-sm font-bold ring-1 transition-colors',
                date === q.value ? 'bg-teal-700 text-white ring-teal-700' : 'bg-white text-slate-700 ring-slate-300 hover:bg-slate-50')}>
              {q.label}
            </button>
          ))}
          <label className="sr-only" htmlFor={`${uid}-date`}>日にちを選ぶ</label>
          <input id={`${uid}-date`} type="date" value={date} min={addDaysYmd(today, -PAST_UNMARKED_DAYS)} onChange={e => setDate(e.target.value)}
            className={cn(fieldClass, 'w-44')} />
          <span className="text-sm font-semibold text-teal-800">{planDateLabel(date, today)}</span>
        </div>
      </div>

      <div>
        <label htmlFor={`${uid}-name`} className="mb-1 block text-sm font-medium text-slate-700">患者さん（カルテから選ぶ・カルテが無い方はお名前を入れる）</label>
        {picked ? (
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-teal-200 bg-teal-50 px-3 py-2 text-sm">
            <span className="font-bold text-slate-900">{picked.name}</span>
            {picked.kana && <span className="text-slate-600">{picked.kana}</span>}
            <span className="text-xs text-teal-800">カルテの方</span>
            <button type="button" onClick={() => setPicked(null)} className="ml-auto inline-flex min-h-9 items-center gap-1 rounded-md px-2 text-slate-600 hover:bg-white">
              <X className="h-4 w-4" aria-hidden />選び直す
            </button>
          </div>
        ) : (
          <div className="relative">
            <input id={`${uid}-name`} value={query} onFocus={loadPatients} onChange={e => { loadPatients(); setQuery(e.target.value) }} maxLength={MAX_PLAN_NAME_CHARS}
              autoComplete="off" autoFocus={autoFocus} placeholder="お名前・ふりがなで探す（例：やまだ）" className={fieldClass} />
            {candidates.length > 0 && (
              <ul className="mt-1 divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white shadow-sm" aria-label="カルテの候補">
                {candidates.map(p => (
                  <li key={p.id}>
                    <button type="button" onClick={() => { setPicked(p); setQuery('') }}
                      className="flex min-h-10 w-full items-baseline gap-2 px-3 py-2 text-left text-sm hover:bg-teal-50">
                      <span className="font-bold text-slate-900">{p.name}</span>
                      <span className="text-slate-600">{p.kana}</span>
                      {p.birthDate && <span className="ml-auto text-xs text-slate-500">{p.birthDate}</span>}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {query.trim() && candidates.length === 0 && (
              <p className="mt-1 text-xs text-slate-500">カルテに見つかりません。このお名前のまま入れられます（カルテなし）。</p>
            )}
          </div>
        )}
      </div>

      <div>
        <label htmlFor={`${uid}-note`} className="mb-1 block text-sm font-medium text-slate-700">メモ（任意）</label>
        <input id={`${uid}-note`} value={note} onChange={e => setNote(e.target.value)} maxLength={MAX_PLAN_NOTE_CHARS}
          placeholder="例：夕方ごろ・部活のあと・テーピングだけ" className={fieldClass} />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" className="h-11 rounded-lg font-bold">来院予定に入れる</Button>
        {message && (
          <p role={message.tone === 'error' ? 'alert' : 'status'} className={cn('text-sm', message.tone === 'error' ? 'text-red-700' : 'text-teal-800')}>
            {message.text}
          </p>
        )}
      </div>
    </form>
  )
}

/** 予約の画面の「来院予定（日にち）」。shown の間は、ほかの端末で入れた分を15秒ごとに取り込む */
export default function VisitPlansPanel({ shown }: { shown: boolean }) {
  const [plans, reload] = usePlans()
  const today = jstToday()

  // 見ている間だけ：すぐにクラウドとそろえ、そのあと15秒ごとに（カルテの画面と同じ）
  useEffect(() => {
    if (!shown) return
    let stop: (() => void) | null = null
    let cancelled = false
    initPatientStore()
    import('@/lib/sync-service').then(({ startLiveSync, syncNow, isSyncEnabled }) => {
      if (cancelled || !isSyncEnabled()) return
      void syncNow()
      stop = startLiveSync()
    })
    return () => {
      cancelled = true
      stop?.()
    }
  }, [shown])

  const grouped = useMemo(() => groupVisitPlans(plans, today), [plans, today])

  return (
    <div className="space-y-4">
      <Panel title="来院予定を入れる（日にちだけ）" icon={CalendarDays}>
        <p className="mb-3 text-sm text-slate-600">
          時間を決めずに「◯日に行きます」と聞いた方を書いておく一覧です。予約表の空きは減りません。患者さんには何も送りません。予約表の「時間未定」の欄にも、同じ予定が出ます。
        </p>
        <PlanAddForm />
      </Panel>

      <Panel title="これからの来院予定" icon={CalendarCheck} meta={grouped.upcoming.length ? `${grouped.upcoming.reduce((n, d) => n + d.plans.length, 0)}人` : undefined}>
        {grouped.upcoming.length === 0 ? (
          <p className="text-sm text-slate-600">これからの来院予定はありません。</p>
        ) : (
          <div className="space-y-4">
            {grouped.upcoming.map(day => (
              <section key={day.date}>
                <h3 className={cn('mb-1.5 text-sm font-bold', day.date === today ? 'text-teal-800' : 'text-slate-800')}>
                  {day.label}<span className="ml-2 font-normal text-slate-500">{day.plans.length}人</span>
                </h3>
                <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200 px-3 py-2.5">
                  {day.plans.map(p => <PlanRow key={p.id} plan={p} today={today} onChange={reload} />)}
                </ul>
              </section>
            ))}
          </div>
        )}
        {grouped.later > 0 && <p className="mt-3 text-xs text-slate-500">ほかに、2か月より先の予定が {grouped.later} 件あります。</p>}
      </Panel>

      {grouped.unmarked.length > 0 && (
        <Panel title="来院したかの記録がまだの予定" meta={`過去${PAST_UNMARKED_DAYS}日`} attention>
          <ul className="divide-y divide-slate-100">
            {grouped.unmarked.map(p => <PlanRow key={p.id} plan={p} today={today} onChange={reload} showDate />)}
          </ul>
        </Panel>
      )}
    </div>
  )
}

/** 今日の来院予定で、まだ「来院した／来なかった」を付けていない人数（予約の画面の切りかえの数字） */
export function useTodayPlanCount(): number {
  const [plans] = usePlans()
  const today = jstToday()
  return plansOn(plans, today).filter(p => p.status === 'planned').length
}

/** 今日の画面の「今日の来院予定（日にちだけ）」 */
export function TodayVisitPlans() {
  const router = useRouter()
  const [plans, reload] = usePlans()
  const today = jstToday()
  const todays = plansOn(plans, today)
  const tomorrow = plansOn(plans, addDaysYmd(today, 1)).length
  const waiting = todays.filter(p => p.status === 'planned').length

  function open() {
    setYoyakuView('plans')
    router.push('/yoyaku')
  }

  return (
    <Panel
      title="今日の来院予定（日にちだけ）"
      icon={CalendarCheck}
      meta={todays.length ? `${todays.length}人${waiting ? `・まだ ${waiting}人` : ''}` : undefined}
      action={<button type="button" onClick={open} className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'max-lg:min-h-10')}>来院予定を開く・入れる</button>}
    >
      {todays.length === 0 ? (
        <p className="text-sm text-slate-600">今日の来院予定（時間を決めていない方）はありません。{tomorrow > 0 && `明日は ${tomorrow}人です。`}</p>
      ) : (
        <>
          <ul className="divide-y divide-slate-100">
            {todays.map(p => <PlanRow key={p.id} plan={p} today={today} onChange={reload} compact />)}
          </ul>
          {tomorrow > 0 && <p className="mt-2 text-xs text-slate-500">明日の来院予定：{tomorrow}人</p>}
        </>
      )}
    </Panel>
  )
}
