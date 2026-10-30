'use client'

/**
 * 今日（院内アプリのホーム）
 *
 * 朝いちばんに開いて「今日やること」が一目でわかる画面。
 * - 今日の予約（予約システムと連携）と、キャンセルのカルテへの取り込み
 * - 昨日の締め（NOAHの来院数・金額）と次の一手 … 経営メニューを隠しコマンドで開いているときだけ
 * - 気にかけたい患者さん（しばらく記録がない・離脱リスクが高い）と最近ひらいたカルテ
 * - 承認を待っている投稿
 *
 * カードはすべて Panel（./Panel.tsx）で、見出し・余白・見出しの右のボタンの置き方をそろえている。
 * スマホでは上から「承認待ちのお知らせ → 今日の予約 → キャンセル → （昨日の締め）→ カルテ」の順に並ぶ。
 */
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState, type FormEvent } from 'react'
import { ChartColumn, ChevronRight, ClipboardList, Search, Send, UserPlus } from 'lucide-react'
import YoyakuTodayCard from '@/components/rehab/YoyakuTodayCard'
import YoyakuCancelSyncCard from '@/components/rehab-management/YoyakuCancelSyncCard'
import { getCancellations, getPatients, getSOAPNotes, initPatientStore } from '@/lib/patient-store'
import { getRecentViews } from '@/lib/patient-ui-prefs'
import { groupByPatient, isCountedCancellation } from '@/lib/cancellation-utils'
import { calculateRetentionRisk, getDaysSinceLastVisit } from '@/lib/rehab-algorithms'
import { dateLabel, people, yen, type NightlySummary } from '@/lib/marketing/noah-analysis'
import type { OpeningDay } from '@/lib/marketing/autopilot-planner'
import type { WeeklyProposal } from '@/lib/marketing/autopilot-types'
import type { Patient } from '@/types/patient'
import { useKeieiOpen } from '@/lib/clinic/keiei-mode'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { MoreLink, Panel } from './Panel'

function todayLabel(): string {
  try {
    return new Intl.DateTimeFormat('ja-JP', { timeZone: 'Asia/Tokyo', month: 'long', day: 'numeric', weekday: 'short' }).format(new Date())
  } catch {
    return ''
  }
}

// ── 昨日の締め（NOAH） ─────────────────────────────────

interface NoahApi {
  summary: NightlySummary | null
  tips: string[]
  next: OpeningDay | null
  draftDay: OpeningDay | null
}

function SalesPanel() {
  const [state, setState] = useState<{ kind: 'loading' } | { kind: 'denied' } | { kind: 'error' } | { kind: 'ok'; data: NoahApi }>({
    kind: 'loading',
  })
  useEffect(() => {
    let alive = true
    fetch('/api/marketing/noah', { cache: 'no-store' })
      .then(async (r) => {
        if (!alive) return
        if (r.status === 403) return setState({ kind: 'denied' })
        if (!r.ok) return setState({ kind: 'error' })
        setState({ kind: 'ok', data: (await r.json()) as NoahApi })
      })
      .catch(() => alive && setState({ kind: 'error' }))
    return () => {
      alive = false
    }
  }, [])

  const s = state.kind === 'ok' ? state.data.summary : null
  return (
    <Panel
      title={s ? `${dateLabel(s.date)}の締め` : '昨日の締め（NOAH）'}
      icon={ChartColumn}
      action={<MoreLink href="/marketing/sales">経営を見る</MoreLink>}
    >
      {state.kind === 'loading' && <p className="text-sm text-slate-500">読み込み中…</p>}
      {state.kind === 'denied' && <p className="text-sm text-slate-600">売上は院長のログインで表示されます。</p>}
      {state.kind === 'error' && <p className="text-sm text-slate-600">集計を読み込めませんでした。</p>}
      {state.kind === 'ok' && !s && (
        <p className="text-sm text-slate-600">まだ NOAH の集計が届いていません（毎晩21時すぎに届きます）。</p>
      )}
      {s && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-end gap-x-6 gap-y-2">
            <div>
              <p className="text-xs font-bold text-slate-600">来院</p>
              <p className="text-3xl font-black tabular-nums text-slate-900">{s.today ? people(s.today.visits) : '—'}</p>
            </div>
            <div>
              <p className="text-xs font-bold text-slate-600">金額</p>
              <p className="text-xl font-black tabular-nums text-slate-900">{s.today ? yen(s.today.sales) : '—'}</p>
            </div>
          </div>
          {s.today && s.weekdayAvg !== null && (
            <p className="text-xs text-slate-600">いつもの同じ曜日は平均{people(s.weekdayAvg)}</p>
          )}
          <div className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">
            <p className="tabular-nums">
              今月 {Number(s.mtd.to.slice(8, 10))}日まで：<span className="font-bold">{people(s.mtd.visits)}</span>・
              <span className="font-bold">{yen(s.mtd.sales)}</span>
            </p>
            {s.prev && (
              <p className="mt-0.5 text-xs tabular-nums text-slate-600">
                先月の同じ時期：{people(s.prev.visits)}・{yen(s.prev.sales)}
              </p>
            )}
          </div>
        </div>
      )}
      {state.kind === 'ok' && (state.data.tips.length > 0 || state.data.next) && (
        <div className="mt-4 border-t border-slate-100 pt-3">
          <p className="mb-1.5 text-sm font-bold text-slate-800">次の一手</p>
          <ul className="space-y-1.5 text-sm text-slate-700">
            {state.data.next && (
              <li className="flex gap-2">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-teal-700" aria-hidden />
                <span className="min-w-0">
                  {dateLabel(state.data.next.date)}の空き：午前{state.data.next.am}・午後{state.data.next.pm}枠
                  {state.data.draftDay?.date === state.data.next.date && '（空き多め。夜に投稿の下書きを作ります）'}
                </span>
              </li>
            )}
            {state.data.tips.map((t) => (
              <li key={t} className="flex gap-2">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-teal-700" aria-hidden />
                <span className="min-w-0">{t}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Panel>
  )
}

// ── 承認を待っている投稿 ───────────────────────────────

function PostsPanel() {
  const [pending, setPending] = useState<{ count: number; week: string } | null | undefined>(undefined)
  useEffect(() => {
    let alive = true
    fetch('/api/marketing/autopilot', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { proposals?: WeeklyProposal[] } | null) => {
        if (!alive) return
        const proposals = data?.proposals ?? []
        const target = [...proposals].reverse().find((p) => p.items.some((i) => i.status === 'proposed'))
        setPending(target ? { count: target.items.filter((i) => i.status === 'proposed').length, week: target.weekStart } : null)
      })
      .catch(() => alive && setPending(null))
    return () => {
      alive = false
    }
  }, [])
  if (!pending) return null
  return (
    <Link
      href={`/marketing/autopilot?week=${pending.week}`}
      className="flex items-center gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-950 shadow-sm transition-colors hover:bg-amber-100"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-800" aria-hidden>
        <Send className="h-5 w-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-bold">投稿の案が {pending.count} 本、承認を待っています</span>
        <span className="mt-0.5 block text-sm text-amber-900">内容を見て承認すると、予定の時刻に投稿されます</span>
      </span>
      <ChevronRight className="h-5 w-5 shrink-0" aria-hidden />
    </Link>
  )
}

// ── カルテ（気にかけたい方・最近ひらいたカルテ） ───────────────

interface KarteRow {
  patient: Patient
  lastDate: string
  days: number
  visits: number
  risk: 'low' | 'medium' | 'high'
}

function buildKarteRows(): { rows: KarteRow[]; recent: KarteRow[] } {
  initPatientStore()
  const patients = getPatients()
  const notesBy = new Map<string, string[]>()
  for (const n of getSOAPNotes()) {
    const list = notesBy.get(n.patientId) ?? []
    list.push(n.visitDate)
    notesBy.set(n.patientId, list)
  }
  const cancels = groupByPatient(getCancellations())
  const rows: KarteRow[] = patients.map((p) => {
    const dates = (notesBy.get(p.id) ?? []).sort().reverse()
    const lastDate = dates[0] ?? ''
    const days = getDaysSinceLastVisit(lastDate || p.updatedAt)
    const risk = calculateRetentionRisk({
      daysSinceLastVisit: days,
      recommendedIntervalDays: 7,
      cancelCount: (cancels.get(p.id) ?? []).filter(isCountedCancellation).length,
      totalVisits: dates.length,
      painChange: -3,
      romImprovementRate: 10,
      strengthImprovementRate: 10,
      homeExerciseAdherence: 50,
      hasEconomicConcern: false,
      hasGoalUnclear: false,
      hasExplanationInsufficient: false,
    }).level
    return { patient: p, lastDate, days, visits: dates.length, risk }
  })
  const byId = new Map(rows.map((r) => [r.patient.id, r]))
  const recent = getRecentViews()
    .map((v) => byId.get(v.id))
    .filter((r): r is KarteRow => Boolean(r))
    .slice(0, 5)
  return { rows, recent }
}

/**
 * 間があいた方への声かけの文（LINEや電話の前に写して使う）
 *
 * 文はこの端末の中で作るだけで、外へは送らない。送るかどうか・文を直すかは院長・スタッフが決める。
 * 症状・施術の内容・「治る」などの言葉は入れない（決まった、ていねいな文だけ）。
 */
export function followUpMessage(name: string): string {
  // LINE・SMS・電話の前のメモ、どれに使っても通じる言い方にする（「このLINEから」とは書かない）
  const who = name.trim() ? `${name.trim()}様　` : ''
  return [
    `${who}ゆうき整骨院です。`,
    'その後、お身体の具合はいかがでしょうか。前回から少し間があきましたので、ご様子をうかがいたくご連絡しました。',
    '気になることがあれば、いつでもお気軽にご相談ください。ご予約は、24時間のネット予約、またはお電話・LINEからどうぞ。',
  ].join('\n')
}

function CopyFollowUp({ name }: { name: string }) {
  const [done, setDone] = useState(false)
  async function copy() {
    const text = followUpMessage(name)
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      // 写せない環境では、選んでコピーできるように表示する
      window.prompt('この文をコピーしてお使いください', text)
    }
    setDone(true)
    window.setTimeout(() => setDone(false), 2500)
  }
  return (
    <>
      <button
        type="button"
        onClick={copy}
        className="inline-flex h-11 shrink-0 items-center rounded-lg border border-slate-300 bg-white px-3 text-xs font-bold text-slate-700 hover:bg-slate-50 lg:h-8"
        aria-label={`${name}様への声かけの文を写す`}
      >
        {done ? '写しました' : '声かけ文'}
      </button>
      {/* 読み上げ（スクリーンリーダー）にも「写しました」を伝える */}
      <span className="sr-only" role="status" aria-live="polite">
        {done ? `${name}様への声かけの文を写しました` : ''}
      </span>
    </>
  )
}

/** 数字のタイル。気にかけたい数が 0 より大きいときだけ色を付ける（色だけに頼らず、数字と言葉でも分かる） */
const STAT_TONE = {
  plain: 'bg-slate-50 text-slate-900',
  watch: 'bg-amber-50 text-amber-950 ring-1 ring-amber-200',
  alert: 'bg-red-50 text-red-900 ring-1 ring-red-200',
} as const

function KartePanel() {
  const [data, setData] = useState<{ rows: KarteRow[]; recent: KarteRow[] } | null>(null)
  useEffect(() => {
    // 端末に保存されたカルテを読む（画面の表示が終わってから）
    const id = requestAnimationFrame(() => setData(buildKarteRows()))
    return () => cancelAnimationFrame(id)
  }, [])

  const active = (data?.rows ?? []).filter((r) => r.patient.status === 'active')
  const watch = active
    .filter((r) => r.visits > 0 && (r.days >= 14 || r.risk === 'high'))
    .sort((a, b) => b.days - a.days)
  const recent = data?.recent ?? []
  const gapCount = active.filter((r) => r.visits > 0 && r.days >= 14).length
  const highCount = active.filter((r) => r.risk === 'high').length

  return (
    <Panel title="カルテ" icon={ClipboardList} action={<MoreLink href="/patients">カルテ一覧</MoreLink>}>
      {!data ? (
        <p className="text-sm text-slate-500">読み込み中…</p>
      ) : (
        <div className="space-y-4">
          <dl className="grid grid-cols-3 gap-2 text-center">
            {[
              { label: '通院中', value: active.length, tone: STAT_TONE.plain },
              { label: '2週間以上空いた方', value: gapCount, tone: gapCount > 0 ? STAT_TONE.watch : STAT_TONE.plain },
              { label: '離脱リスク高', value: highCount, tone: highCount > 0 ? STAT_TONE.alert : STAT_TONE.plain },
            ].map((x) => (
              <div key={x.label} className={`flex flex-col-reverse justify-end rounded-lg px-2 py-2 ${x.tone}`}>
                <dt className="text-xs font-bold leading-tight">{x.label}</dt>
                <dd className="mb-0.5 text-2xl font-black tabular-nums">{x.value}</dd>
              </div>
            ))}
          </dl>

          {watch.length > 0 && (
            <div>
              <p className="text-sm font-bold text-slate-800">気にかけたい方</p>
              <p className="mb-1.5 text-xs text-slate-600">
                しばらく記録がない・離脱リスクが高い方。「声かけ文」で、LINEや電話の前に使えるていねいな文を写せます（送るのはご自身で）。
              </p>
              <ul className="divide-y divide-slate-100">
                {watch.slice(0, 5).map((r) => (
                  <li key={r.patient.id} className="flex items-center gap-2">
                    <Link
                      href={`/patients/${r.patient.id}`}
                      className="flex min-h-12 min-w-0 flex-1 flex-wrap items-center justify-between gap-x-3 gap-y-0.5 rounded-lg py-2 hover:bg-slate-50"
                    >
                      <span className="min-w-0 break-keep text-base font-bold text-slate-900 wrap-anywhere">{r.patient.name}</span>
                      <span className="shrink-0 text-xs text-slate-600">
                        {r.days >= 999 ? '記録なし' : `最後の記録から${r.days}日`}
                        {r.risk === 'high' && <span className="ml-1.5 rounded bg-red-50 px-1.5 py-0.5 font-bold text-red-700">リスク高</span>}
                      </span>
                    </Link>
                    <CopyFollowUp name={r.patient.name} />
                  </li>
                ))}
              </ul>
            </div>
          )}

          {recent.length > 0 && (
            <div>
              <p className="mb-1.5 text-sm font-bold text-slate-800">最近ひらいたカルテ</p>
              <ul className="flex flex-wrap gap-2">
                {recent.map((r) => (
                  <li key={r.patient.id}>
                    <Link
                      href={`/patients/${r.patient.id}`}
                      className="flex min-h-10 items-center rounded-full bg-white px-3.5 text-sm font-bold text-slate-800 ring-1 ring-slate-300 hover:bg-slate-50 lg:min-h-8"
                    >
                      {r.patient.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <Link
            href="/patients/new"
            className="inline-flex h-11 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 text-sm font-bold text-slate-800 hover:border-teal-600 hover:text-teal-800"
          >
            <UserPlus className="h-4 w-4" aria-hidden />
            新しい患者さんを登録
          </Link>
        </div>
      )}
    </Panel>
  )
}

// ── 画面 ─────────────────────────────────────────────

export default function TodayDashboard() {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const keieiOpen = useKeieiOpen()

  function search(e: FormEvent) {
    e.preventDefault()
    const q = query.trim()
    router.push(q ? `/patients?q=${encodeURIComponent(q)}` : '/patients')
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-base font-bold text-teal-800" suppressHydrationWarning>
            {todayLabel()}
          </p>
          {/* スマホでは上の見出し（共通の枠）に「今日」と出ているので、ここは読み上げ用だけにする */}
          <h1 className="sr-only lg:not-sr-only lg:text-2xl lg:font-black lg:text-slate-900">今日</h1>
        </div>
        <form onSubmit={search} className="flex w-full max-w-md items-center gap-2 sm:w-auto" role="search">
          <label htmlFor="today-search" className="sr-only">
            カルテを探す
          </label>
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" aria-hidden />
            {/* スマホでは 16px になる（globals.css の「院内アプリの入力欄」。iPhone で押したときに画面が拡大されないように） */}
            <input
              id="today-search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="カルテを探す（お名前・カナ）"
              className="h-11 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 text-sm placeholder:text-slate-500 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/30 sm:w-72"
            />
          </div>
          <button type="submit" className={cn(buttonVariants(), 'h-11 shrink-0 rounded-lg font-bold')}>
            探す
          </button>
        </form>
      </div>

      <PostsPanel />

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="min-w-0 space-y-5 lg:col-span-2">
          <YoyakuTodayCard />
          <YoyakuCancelSyncCard />
        </div>
        <div className="min-w-0 space-y-5">
          {/* 売上などの数字は、経営メニューを隠しコマンドで開いているときだけ出す（患者さんの目に入らないように） */}
          {keieiOpen && <SalesPanel />}
          <KartePanel />
        </div>
      </div>
    </div>
  )
}
