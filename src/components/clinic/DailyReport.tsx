'use client'
/**
 * 日報（予約 →「日報」＝/yoyaku/daily?date=YYYY-MM-DD）
 *
 * 2026-11-27 院長「1日ごとの予約などを日報として出せるようにしてください」「印刷できるようにも」。
 * 1日分の予約・時間を決めない来院予定・キャンセル・カルテの記録・（院長が経営を開いているときは）売上を1枚にまとめる。
 * 「印刷する」で、メニューやボタンを隠して A4 の縦に印刷する。決まりは lib/daily-report.ts（テストあり）。
 * 日報そのものは何も保存しない（今ある記録を読んで並べるだけ）。電話番号は載せない。
 * 院長が経営を開いているときは、売上の CSV（経営の「CSVを入れて最新にする」と同じ。NOAH の金額分析・アルファノート）を
 * この画面からも入れられる。保存したら売上の欄を読み直す（2026-11-27 院長「売り上げ日報もCSVで登録保存、反映できるように」）。
 * NOAH の「来院者日報」（PDF）も入れられる（同じ日「NOAHの日報をのせます」「PDFでした」）。PDF はこのブラウザの中で読み、
 * その日の合計の数字だけを保存して、売上の欄の「窓口（来院者日報）」に出す（components/clinic/NoahDailyPdfImport.tsx）。
 */
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ChevronLeft, ChevronRight, Printer, RefreshCw } from 'lucide-react'
import { getCancellations, getPatients, getSOAPNotes, getVisitPlans, initPatientStore } from '@/lib/patient-store'
import { SYNCED_EVENT } from '@/lib/sync-service'
import { addDaysYmd, isYmd, jstToday } from '@/lib/reeval/schedule'
import { toDateKey, type YoyakuFeed } from '@/lib/yoyaku-cancel-sync'
import { useMarketingRole } from '@/lib/marketing/use-role'
import { useKeieiOpen } from '@/lib/clinic/keiei-mode'
import { monthPoints, yen } from '@/lib/marketing/noah-analysis'
import type { NoahStore } from '@/lib/marketing/noah-types'
import {
  NOAH_REPORT_KINDS,
  REPORT_AHEAD_DAYS,
  REPORT_BACK_DAYS,
  buildDailyReport,
  feedRange,
  shortDateLabel,
  sourceShort,
  type NoahDayLike,
  type ReportFeedRow,
} from '@/lib/daily-report'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import KeieiCsvImport from '@/components/clinic/KeieiCsvImport'
import NoahDailyPdfImport from '@/components/clinic/NoahDailyPdfImport'
import { NOAH_DAILY_AMOUNT_KEYS, NOAH_DAILY_LABELS, type NoahDailySheet } from '@/lib/marketing/noah-daily'

const FEED_KEY_STORAGE = 'yoyaku_feed_key'

const jstClock = (d = new Date()) => new Date(d.getTime() + 9 * 3_600_000).toISOString()
const hhmm = (d = new Date()) => jstClock(d).slice(11, 16)

/** 印刷の形（A4 縦）。この画面を開いているあいだだけ効く */
const PRINT_CSS = `
@media print {
  @page { size: A4 portrait; margin: 10mm 10mm 12mm; }
  /* 紙は白地（画面の薄い灰色の地を出さない。表の見出しの行だけ色を残す） */
  body * { background-color: transparent !important; }
  .daily-report { font-size: 9.5pt; line-height: 1.45; color: #000; }
  .daily-report table { border-collapse: collapse; width: 100%; }
  .daily-report th, .daily-report td { border: 1px solid #94a3b8; padding: 2px 4px; vertical-align: top; text-align: left; }
  .daily-report th { background: #f1f5f9 !important; font-weight: 700; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .daily-report tr, .daily-report .keep { break-inside: avoid; }
  .daily-report h2 { break-after: avoid; }
}
`

function Section({ title, meta, children, className }: { title: string; meta?: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn('rounded-xl border border-slate-200 bg-white p-4 print:rounded-none print:border-0 print:p-0', className)} aria-label={title}>
      <h2 className="flex flex-wrap items-baseline gap-x-2 font-bold text-slate-900 print:border-b print:border-slate-400 print:pb-0.5 print:text-[10.5pt]">
        {title}
        {meta && <span className="text-xs font-normal text-slate-500 print:text-[8.5pt] print:text-slate-700">{meta}</span>}
      </h2>
      <div className="mt-2 print:mt-1">{children}</div>
    </section>
  )
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-slate-500 print:text-[9pt] print:text-slate-700">{children}</p>
}

function NameLink({ name, patientId }: { name: string; patientId?: string }) {
  const text = `${name} 様`
  if (!patientId) return <span className="break-keep font-bold text-slate-900 wrap-anywhere">{text}</span>
  return (
    <Link href={`/patients/${patientId}`} className="break-keep font-bold text-slate-900 underline decoration-slate-300 underline-offset-2 wrap-anywhere hover:decoration-teal-700 print:no-underline">
      {text}
    </Link>
  )
}

function Tag({ children, tone = 'slate' }: { children: React.ReactNode; tone?: 'teal' | 'amber' | 'green' | 'slate' }) {
  const color = {
    teal: 'border-teal-300 bg-teal-50 text-teal-800',
    amber: 'border-amber-300 bg-amber-50 text-amber-900',
    green: 'border-green-300 bg-green-50 text-green-800',
    slate: 'border-slate-300 bg-slate-50 text-slate-700',
  }[tone]
  return <span className={cn('inline-flex items-center rounded-full border px-1.5 py-0.5 text-xs font-bold leading-none', color)}>{children}</span>
}

interface FeedState {
  key: string
  rows: ReportFeedRow[] | null
  nextRows: ReportFeedRow[] | null
  error: string
  at: string
}

export default function DailyReport({ initialDate }: { initialDate: string }) {
  const today = useMemo(() => jstToday(), [])
  const [date, setDate] = useState(isYmd(initialDate) ? initialDate : today)
  const [tick, setTick] = useState(0)
  const { isAdmin } = useMarketingRole()
  const keieiOpen = useKeieiOpen()
  const salesAllowed = isAdmin && keieiOpen
  const [includeSales, setIncludeSales] = useState(true)
  const showSales = salesAllowed && includeSales

  // カルテの記録（端末の控え）。クラウドから新しい記録が届いたら読み直す
  const [stamp, setStamp] = useState(0)
  useEffect(() => {
    const bump = () => setStamp((s) => s + 1)
    window.addEventListener(SYNCED_EVENT, bump)
    window.addEventListener('storage', bump)
    let cancelled = false
    import('@/lib/sync-service').then(({ isSyncEnabled, syncNow }) => {
      if (!cancelled && isSyncEnabled()) void syncNow()
    })
    return () => {
      cancelled = true
      window.removeEventListener(SYNCED_EVENT, bump)
      window.removeEventListener('storage', bump)
    }
  }, [])
  const karte = useMemo(() => {
    void stamp
    initPatientStore()
    return {
      patients: getPatients(),
      notes: getSOAPNotes().map((n) => ({ patientId: n.patientId, visitDate: n.visitDate })),
      plans: getVisitPlans(),
      cancellations: getCancellations(),
    }
  }, [stamp])

  // 予約（予約システムの一覧）
  const [feedKey] = useState(() => {
    try {
      return localStorage.getItem(FEED_KEY_STORAGE) ?? ''
    } catch {
      return ''
    }
  })
  const range = feedRange(date, today)
  const reqKey = `${date}|${tick}`
  const [feed, setFeed] = useState<FeedState | null>(null)
  useEffect(() => {
    if (!feedKey || !range) return
    let alive = true
    const day = date
    const key = `${day}|${tick}`
    fetch(`/api/yoyaku/feed?key=${encodeURIComponent(feedKey)}&days=${range.days}&back=${range.back}`, { cache: 'no-store' })
      .then(async (r) => {
        const data = (await r.json().catch(() => null)) as YoyakuFeed | null
        if (!data?.ok) throw new Error(data?.error === 'unauthorized' ? '予約システムの管理者パスワードが合いません（今日の画面の「今日の予約」で入れ直してください）' : data?.error || `HTTP ${r.status}`)
        const find = (k: string) => data.days?.find((x) => toDateKey(x.date) === k)
        const found = find(day)
        const next = find(addDaysYmd(day, 1))
        if (alive) setFeed({ key, rows: (found?.rows ?? []) as ReportFeedRow[], nextRows: next ? (next.rows as ReportFeedRow[]) : null, error: '', at: hhmm() })
      })
      .catch((e: unknown) => {
        if (alive) setFeed({ key, rows: null, nextRows: null, error: e instanceof Error ? e.message : '読めませんでした', at: '' })
      })
    return () => {
      alive = false
    }
    // range は date と today から決まる
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, tick, feedKey, today])
  const current = feed && feed.key === reqKey ? feed : null
  const feedLoading = Boolean(feedKey && range && !current)

  // 売上（NOAH の日ごとの集計）。院長が経営を開いているときだけ読む
  const [noah, setNoah] = useState<{ store: NoahStore | null; error: string } | null>(null)
  useEffect(() => {
    if (!salesAllowed) return
    let alive = true
    fetch('/api/marketing/noah?lite=1', { cache: 'no-store' })
      .then(async (r) => {
        const d = (await r.json().catch(() => null)) as { store?: NoahStore | null } | null
        if (!r.ok || !d) throw new Error(`HTTP ${r.status}`)
        if (alive) setNoah({ store: d.store ?? null, error: '' })
      })
      .catch(() => alive && setNoah({ store: null, error: 'NOAH の集計を読めませんでした' }))
    return () => {
      alive = false
    }
  }, [salesAllowed, tick])
  // NOAH の来院者日報（PDF から入れた、その日の合計）
  const [dailySheet, setDailySheet] = useState<{ date: string; sheet: NoahDailySheet | null; error: string } | null>(null)
  useEffect(() => {
    if (!salesAllowed) return
    let alive = true
    const day = date
    fetch(`/api/marketing/noah/daily?date=${day}`, { cache: 'no-store' })
      .then(async (r) => {
        const d = (await r.json().catch(() => null)) as { ok?: boolean; sheet?: NoahDailySheet | null } | null
        if (!r.ok || !d?.ok) throw new Error(`HTTP ${r.status}`)
        if (alive) setDailySheet({ date: day, sheet: d.sheet ?? null, error: '' })
      })
      .catch(() => alive && setDailySheet({ date: day, sheet: null, error: 'NOAH の日報を読めませんでした' }))
    return () => {
      alive = false
    }
  }, [salesAllowed, date, tick])
  const sheet = dailySheet && dailySheet.date === date ? dailySheet : null

  const noahDay = useMemo((): { day: NoahDayLike | null; note: string } => {
    if (!noah) return { day: null, note: '読み込み中…' }
    if (noah.error) return { day: null, note: noah.error }
    const month = noah.store?.months.find((m) => m.month === date.slice(0, 7))
    if (!month || month.asOf < date) return { day: null, note: 'この日の NOAH の集計は、まだ入っていません。' }
    const p = monthPoints(month).find((x) => x.date === date)
    if (!p) return { day: null, note: 'この日の NOAH の記録はありません（休みの日など）。' }
    return { day: { visits: p.visits, sales: p.sales, ins: p.ins as [number, number], self: p.self as [number, number], nonIns: p.nonIns as [number, number], acc: p.acc as [number, number], work: p.work as [number, number] }, note: '' }
  }, [noah, date])

  const report = useMemo(
    () =>
      buildDailyReport({
        date,
        today,
        nowTime: hhmm(),
        rows: current?.rows ?? null,
        nextRows: current?.nextRows ?? null,
        plans: karte.plans,
        cancellations: karte.cancellations,
        patients: karte.patients,
        notes: karte.notes,
        noah: showSales ? noahDay.day : null,
      }),
    [date, today, current, karte, showSales, noahDay],
  )

  const go = (d: string) => {
    if (!isYmd(d)) return
    setDate(d)
    try {
      window.history.replaceState(null, '', `/yoyaku/daily?date=${d}`)
    } catch {
      // アドレスを変えられなくても、画面はそのまま使える
    }
  }

  const printedAt = `${jstClock().slice(0, 10).replace(/-/g, '/')} ${hhmm()}`
  const c = report.counts
  const feedNote = !feedKey
    ? '予約システムとつながっていません。今日の画面の「今日の予約」で、予約管理の管理者パスワードを入れると、この端末で読めます。'
    : !range
      ? `予約システムから読めるのは、${REPORT_BACK_DAYS}日前から${REPORT_AHEAD_DAYS}日先までです。この日の予約は出せません（来院予定・キャンセル・カルテの記録は出します）。`
      : current?.error
        ? `予約を読めませんでした（${current.error}）。`
        : ''

  return (
    <div className="daily-report mx-auto max-w-4xl space-y-4 print:max-w-none print:space-y-3">
      <style>{PRINT_CSS}</style>

      {/* 操作（印刷には出さない） */}
      <div className="flex flex-wrap items-end justify-between gap-3 print:hidden">
        <div>
          <h1 className="sr-only text-xl font-black text-slate-900 lg:not-sr-only">日報</h1>
          <p className="text-xs text-slate-500">1日分の予約・来院予定・キャンセル・カルテの記録をまとめます。「印刷する」で A4 の紙に出せます。</p>
        </div>
        <Link href="/yoyaku" className="inline-flex min-h-10 items-center gap-0.5 rounded-lg px-2 text-sm font-bold text-teal-800 hover:bg-teal-50">
          <ChevronLeft className="h-4 w-4" aria-hidden />
          予約にもどる
        </Link>
      </div>
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-2 print:hidden">
        <Button type="button" variant="outline" className="gap-0.5 px-2.5 font-bold" onClick={() => go(addDaysYmd(date, -1))}>
          <ChevronLeft className="h-4 w-4" aria-hidden />
          前の日
        </Button>
        <label className="inline-flex items-center gap-1.5 text-sm">
          <span className="sr-only">日付</span>
          <input type="date" value={date} onChange={(e) => go(e.target.value)} className="min-h-10 rounded-lg border border-slate-300 bg-white px-2 text-sm font-bold text-slate-900" />
        </label>
        <Button type="button" variant="outline" className="gap-0.5 px-2.5 font-bold" onClick={() => go(addDaysYmd(date, 1))}>
          次の日
          <ChevronRight className="h-4 w-4" aria-hidden />
        </Button>
        {date !== today && (
          <Button type="button" variant="ghost" className="px-2.5 font-bold text-teal-800" onClick={() => go(today)}>
            今日にもどす
          </Button>
        )}
        <div className="ml-auto flex items-center gap-2">
          <Button type="button" variant="outline" className="gap-1 px-2.5 font-bold" onClick={() => setTick((t) => t + 1)} disabled={feedLoading}>
            <RefreshCw className={cn('h-4 w-4', feedLoading && 'animate-spin')} aria-hidden />
            読み直す
          </Button>
          <Button type="button" className="gap-1 px-3 font-bold" onClick={() => window.print()} disabled={feedLoading}>
            <Printer className="h-4 w-4" aria-hidden />
            印刷する
          </Button>
        </div>
        {salesAllowed && (
          <label className="flex w-full items-center gap-2 px-1 text-xs text-slate-600 max-lg:min-h-10">
            <input type="checkbox" checked={includeSales} onChange={(e) => setIncludeSales(e.target.checked)} className="h-4 w-4" />
            売上（NOAH）も載せる（院長が経営を開いているときだけ出ます）
          </label>
        )}
      </div>

      {/* 見出し（画面と紙） */}
      <header className="flex flex-wrap items-end justify-between gap-2 border-b-2 border-slate-800 pb-1">
        <p className="text-2xl font-black text-slate-900 print:text-[16pt]">
          <span className="mr-2 text-base text-slate-600 print:text-[11pt] print:text-slate-800">日報</span>
          {report.label}
        </p>
        <p className="text-right text-xs text-slate-600 print:text-[8.5pt] print:text-slate-800">
          ゆうき整骨院
          <br />
          <span className="hidden print:inline">出力 {printedAt}</span>
          <span className="print:hidden">{current?.at ? `予約は ${current.at} に読みました` : feedLoading ? '予約を読んでいます…' : ''}</span>
        </p>
      </header>

      {feedNote && (
        <p role="status" className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900 ring-1 ring-amber-200 print:bg-transparent print:p-0 print:text-[9pt] print:ring-0">
          {feedNote}
        </p>
      )}

      {/* 数字のまとめ */}
      <section aria-label="まとめ" className="keep">
        <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6 print:grid-cols-6 print:gap-0">
          {[
            { label: '予約', value: report.reservationsLoaded ? `${c.total}件` : '—', sub: report.reservationsLoaded && c.visited ? `来院済み ${c.visited}` : '' },
            { label: '初めての方', value: report.reservationsLoaded ? `${c.first}人` : '—', sub: '' },
            { label: '会員の方', value: report.reservationsLoaded ? `${c.member}人` : '—', sub: '' },
            { label: 'キャンセル', value: `${c.cancelled}件`, sub: [c.sameDay ? `当日 ${c.sameDay}` : '', c.noShow ? `無断 ${c.noShow}` : ''].filter(Boolean).join('・') },
            { label: '来院予定（時間未定）', value: `${c.plans}人`, sub: '' },
            { label: report.next ? `次の日 ${shortDateLabel(report.next.date)}` : '次の日', value: report.next ? `${report.next.total}件` : '—', sub: report.next?.first ? `初めて ${report.next.first}` : '' },
          ].map((x) => (
            <div key={x.label} className="rounded-lg bg-slate-50 px-3 py-2 print:rounded-none print:border print:border-slate-400 print:bg-transparent print:px-2 print:py-1">
              <dt className="text-xs text-slate-600 print:text-[8pt] print:text-slate-800">{x.label}</dt>
              <dd className="text-lg font-black tabular-nums text-slate-900 print:text-[13pt]">{x.value}</dd>
              {x.sub && <dd className="text-xs text-slate-600 print:text-[8pt] print:text-slate-800">{x.sub}</dd>}
            </div>
          ))}
        </dl>
        {report.reservationsLoaded && c.total > 0 && (
          <p className="mt-2 text-sm text-slate-700 print:mt-1 print:text-[9pt]">
            受付：ネット予約 {c.net}件{report.bySource.length > 0 && `（${report.bySource.map((s) => `${s.label} ${s.count}`).join('・')}）`}／院で登録 {c.clinic}件
            {report.byStaff.length > 0 && <>　担当：{report.byStaff.map((s) => `${s.staff} ${s.count}`).join('・')}</>}
          </p>
        )}
      </section>

      {/* 売上（院長・経営を開いているときだけ） */}
      {showSales && (
        <Section title="売上（NOAH）">
          {/* 窓口（NOAH の来院者日報） */}
          {sheet?.sheet ? (
            <p className="text-sm text-slate-800 print:text-[9.5pt]">
              <span className="mr-1 font-bold text-slate-600 print:text-slate-800">窓口（来院者日報）</span>
              来院 <span className="font-black">{sheet.sheet.visits}人</span>・窓口領収 <span className="font-black">{yen(sheet.sheet.window)}</span>
              <span className="text-slate-600 print:text-slate-800">
                （
                {NOAH_DAILY_AMOUNT_KEYS.filter((k) => k !== 'window')
                  .map((k) => `${NOAH_DAILY_LABELS[k]} ${yen(sheet.sheet![k])}`)
                  .join('・')}
                ）
              </span>
            </p>
          ) : (
            <Empty>
              <span className="mr-1 font-bold">窓口（来院者日報）</span>
              {!sheet ? '読み込み中…' : sheet.error || 'この日の NOAH の日報は、まだ入っていません（下の「NOAH の日報（PDF）を入れる」から）。'}
            </Empty>
          )}
          {/* 金額分析（保険の請求分も含めた金額） */}
          {noah?.store?.latest && (
            <p className="mt-2 mb-1 text-xs text-slate-500 print:hidden">
              金額分析の集計は {shortDateLabel(noah.store.latest.asOf)} まで（入れた日時 {noah.store.latest.exportedAt.replace('T', ' ')}）
            </p>
          )}
          {report.noah ? (
            <p className="text-sm text-slate-800 print:text-[9.5pt]">
              <span className="mr-1 font-bold text-slate-600 print:text-slate-800">金額分析</span>
              来院 <span className="font-black">{report.noah.visits}人</span>・売上 <span className="font-black">{yen(report.noah.sales)}</span>
              <span className="text-slate-600 print:text-slate-800">
                （
                {NOAH_REPORT_KINDS.filter((k) => report.noah![k.key][0] || report.noah![k.key][1])
                  .map((k) => `${k.label} ${report.noah![k.key][0]}人 ${yen(report.noah![k.key][1])}`)
                  .join('・') || '内訳なし'}
                ）
              </span>
            </p>
          ) : (
            <Empty>
              <span className="mr-1 font-bold">金額分析</span>
              {noahDay.note}
            </Empty>
          )}
          <p className="mt-1 text-xs text-slate-500 print:text-[8pt] print:text-slate-700">
            窓口＝その日に窓口でいただいた金額（NOAH の来院者日報）。金額分析＝保険の請求分も含めた金額（NOAH の金額分析）。
          </p>
        </Section>
      )}
      {showSales && (
        <div className="space-y-3 print:hidden">
          <NoahDailyPdfImport
            onSaved={(dates) => {
              setTick((t) => t + 1)
              if (dates.length === 1 && dates[0] !== date) go(dates[0])
            }}
          />
          {noah && !noah.error && <KeieiCsvImport storeMonths={noah.store?.months ?? []} onSaved={() => setTick((t) => t + 1)} />}
        </div>
      )}

      {/* 予約の一覧 */}
      <Section title="予約" meta={report.reservationsLoaded ? `${c.total}件（キャンセルを除く。時刻の順）` : undefined}>
        {!report.reservationsLoaded ? (
          <Empty>{feedLoading ? '予約を読んでいます…' : '予約は出せません（上の案内をご覧ください）。'}</Empty>
        ) : report.reservations.length === 0 ? (
          <Empty>この日の予約はありません。</Empty>
        ) : (
          <>
            {/* 画面：1行ずつ */}
            <ul className="divide-y divide-slate-100 print:hidden">
              {report.reservations.map((r, i) => (
                <li key={`${r.reservationNo}-${i}`} className="flex gap-3 py-2 max-lg:text-base">
                  <div className="w-24 shrink-0 tabular-nums font-bold text-slate-900 lg:text-sm">
                    {r.time}
                    {r.end && <span className="font-normal text-slate-500">–{r.end}</span>}
                  </div>
                  <div className="min-w-0 flex-1 lg:text-sm">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <NameLink name={r.name} patientId={r.patientId} />
                      {r.first && <Tag tone="teal">初めて</Tag>}
                      {r.member && <Tag tone="amber">会員</Tag>}
                      {r.status === 'visited' && <Tag tone="green">来院済み</Tag>}
                      {r.status === 'other' && r.statusLabel && <Tag>{r.statusLabel}</Tag>}
                    </div>
                    <p className="mt-0.5 text-xs text-slate-600">
                      {[r.menu, r.staff ? `${r.staff}${r.nominated ? '（指名）' : ''}` : '', sourceShort(r.source)].filter(Boolean).join('・')}
                    </p>
                    {r.memo && <p className="mt-0.5 whitespace-pre-wrap text-xs text-slate-800">メモ：{r.memo}</p>}
                  </div>
                </li>
              ))}
            </ul>
            {/* 紙：表 */}
            <table className="hidden print:table">
              <thead>
                <tr>
                  <th style={{ width: '13%' }}>時間</th>
                  <th style={{ width: '18%' }}>お名前</th>
                  <th style={{ width: '16%' }}>メニュー</th>
                  <th style={{ width: '9%' }}>担当</th>
                  <th style={{ width: '11%' }}>入口</th>
                  <th style={{ width: '9%' }}>状態</th>
                  <th>院内メモ</th>
                </tr>
              </thead>
              <tbody>
                {report.reservations.map((r, i) => (
                  <tr key={`p-${r.reservationNo}-${i}`}>
                    <td className="whitespace-nowrap tabular-nums">
                      {r.time}
                      {r.end && `–${r.end}`}
                    </td>
                    <td>
                      {r.name} 様{[r.first ? '初めて' : '', r.member ? '会員' : ''].filter(Boolean).map((t) => `［${t}］`).join('')}
                    </td>
                    <td>{r.menu}</td>
                    <td>
                      {r.staff}
                      {r.nominated && '（指名）'}
                    </td>
                    <td>{sourceShort(r.source)}</td>
                    <td>{r.status === 'visited' ? '来院済み' : r.statusLabel}</td>
                    <td className="whitespace-pre-wrap">{r.memo}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </Section>

      {/* 時間を決めない来院予定 */}
      <Section title="来院予定（時間未定）" meta={report.plans.length ? `${report.plans.length}人` : undefined}>
        {report.plans.length === 0 ? (
          <Empty>この日の来院予定はありません。</Empty>
        ) : (
          <ul className="space-y-1 text-sm print:text-[9.5pt]">
            {report.plans.map((p, i) => (
              <li key={`${p.name}-${i}`} className="keep flex flex-wrap items-center gap-x-2">
                <NameLink name={p.name} patientId={p.patientId} />
                <span className={cn('text-xs font-bold', p.status === 'visited' ? 'text-green-800' : p.status === 'no_show' ? 'text-slate-500' : 'text-slate-600')}>［{p.statusLabel}］</span>
                {p.note && <span className="text-xs text-slate-700 print:text-[9pt]">{p.note}</span>}
              </li>
            ))}
          </ul>
        )}
      </Section>

      {/* キャンセル */}
      <Section title="キャンセル" meta={report.cancels.length ? `${report.cancels.length}件` : undefined}>
        {report.cancels.length === 0 ? (
          <Empty>{report.reservationsLoaded ? 'この日のキャンセルはありません。' : 'カルテに書いたキャンセルはありません。'}</Empty>
        ) : (
          <ul className="space-y-1 text-sm print:text-[9.5pt]">
            {report.cancels.map((x, i) => (
              <li key={`${x.name}-${i}`} className="keep flex flex-wrap items-baseline gap-x-2">
                <span className="w-12 shrink-0 tabular-nums text-slate-700">{x.time || '—'}</span>
                <span className="font-bold text-slate-900">{x.name ? `${x.name} 様` : '（お名前なし）'}</span>
                <span className="text-xs font-bold text-slate-700">［{x.kind || '区分の記録なし'}］</span>
                {x.excluded && <span className="text-xs text-slate-500">回数に数えない：{x.excluded}</span>}
                {x.reason && <span className="text-xs text-slate-700">理由：{x.reason}</span>}
              </li>
            ))}
          </ul>
        )}
        {report.cancels.some((x) => !x.kind) && (
          <p className="mt-1 text-xs text-slate-500 print:hidden">区分（予約日前・当日・無断）は、カルテのキャンセルの記録から出します。記録がまだの予約は「区分の記録なし」です。</p>
        )}
      </Section>

      {/* カルテ */}
      <Section title="カルテ" meta={report.karte ? `この日の SOAP を書いた方 ${report.karte.written}人` : undefined}>
        {report.karte === null ? (
          <Empty>先の日は、カルテの記録の確かめはありません。</Empty>
        ) : !report.reservationsLoaded ? (
          <Empty>予約を読めないので、記録がまだの方は出せません。</Empty>
        ) : report.karte.missing.length === 0 ? (
          <Empty>{report.reservations.length === 0 ? 'この日の予約が無いので、確かめる方はいません。' : '予約のあった方は、みなさん、この日の SOAP があります。'}</Empty>
        ) : (
          <div className="text-sm print:text-[9.5pt]">
            <p className="text-slate-700">
              予約があって、この日の SOAP がまだの方（{report.karte.missing.length}人
              {date === today ? '・今の時刻より前の予約' : ''}）：
            </p>
            <p className="mt-1 leading-7 print:leading-normal">
              {report.karte.missing.map((m, i) => (
                <span key={`${m.name}-${i}`} className="mr-3 inline-block">
                  <span className="tabular-nums text-slate-500 print:text-slate-700">{m.time}</span> <NameLink name={m.name} patientId={m.patientId} />
                  {m.noKarte && <span className="text-xs text-slate-500">（カルテなし）</span>}
                </span>
              ))}
            </p>
          </div>
        )}
        {report.newCharts.length > 0 && (
          <p className="mt-2 text-sm text-slate-700 print:text-[9.5pt]">
            この日に作ったカルテ（{report.newCharts.length}人）：
            {report.newCharts.map((n) => (
              <span key={n.id} className="mr-2 inline-block">
                <NameLink name={n.name} patientId={n.id} />
                {n.auto && <span className="text-xs text-slate-500">（予約から自動）</span>}
              </span>
            ))}
          </p>
        )}
      </Section>

      {/* 紙だけ：手書きのメモ欄と、取り扱いの注意 */}
      <section className="keep hidden print:block" aria-hidden>
        <h2 className="border-b border-slate-400 pb-0.5 text-[10.5pt] font-bold">メモ・申し送り</h2>
        <div className="mt-1 space-y-[7mm] pt-[6mm]">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="border-b border-dotted border-slate-500" />
          ))}
        </div>
      </section>
      <p className="hidden text-[8pt] text-slate-700 print:block">
        ※ 患者さんのお名前を含みます。院の外へ持ち出さず、要らなくなったらシュレッダーで処分してください。
      </p>
    </div>
  )
}
