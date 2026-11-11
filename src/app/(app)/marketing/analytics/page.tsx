'use client'

/** 効果測定ダッシュボード：LINEファネル・流入クリック・コンバージョン・フォロー候補 */
import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { CHANNEL_LABELS, type Channel } from '@/lib/marketing/types'
import { INTENT_LABELS, type IntentKey } from '@/lib/marketing/line-types'
import { useMarketingRole } from '@/lib/marketing/use-role'
import { GBP_DAILY_METRICS, GBP_METRIC_LABELS, impressionsOf, type GbpPerformance } from '@/lib/marketing/gbp-performance'
import type { GscReport } from '@/lib/marketing/gsc'

interface Analytics {
  days: number
  funnel: { follow: number; intent: number; guide: number; reserveClick: number }
  counts: { urgent: number; handoff: number; totalClicks: number }
  intentBreakdown: Record<string, number>
  clickBreakdown: Record<string, number>
  conversions: { contacts: number; reserved: number; visited: number; handedOff: number }
  followUps: Array<{ userId: string; displayName: string; intent: string | null; step: string; daysSince: number }>
  postStats: Record<string, { published: number; pending: number; failed: number }>
  bookings: null | {
    total: number
    firstVisit: number
    sources: Array<{ source: string; label: string; bookings: number; firstVisit: number; cancelled: number; clicks: number }>
    posts: Array<{ campaign: string; theme: string; scheduledAt: string; bookings: number }>
    generatedAt: string
  }
  seoPosts?: Array<{ id: string; scheduledAt: string; title: string; status: string; url: string | null; campaign: string; taps: number; bookings: number }>
}

const SEO_STATUS: Record<string, string> = {
  published: '投稿済み',
  pending: '予約中',
  processing: '投稿中',
  action_required: '手動待ち',
  failed: '失敗',
}

const ymdLabel = (ymd: string) => `${Number(ymd.slice(5, 7))}/${Number(ymd.slice(8, 10))}`
const monthLabel = (ym: string) => `${ym.slice(0, 4)}年${Number(ym.slice(5, 7))}月`

/** Search Console：ホームページ（shimonoseki-yuuki.com）の Google 検索でのクリック・表示・掲載順位とキーワード */
function SearchConsole() {
  const [data, setData] = useState<GscReport | null>(null)
  const [loading, setLoading] = useState(false)
  useEffect(() => {
    let alive = true
    fetch('/api/marketing/google/search-console', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d: GscReport) => {
        if (alive) setData(d)
      })
      .catch(() => {
        if (alive) setData({ connected: true, error: '読み込めませんでした' })
      })
    return () => {
      alive = false
    }
  }, [])
  async function refresh() {
    setLoading(true)
    try {
      const res = await fetch('/api/marketing/google/search-console?refresh=1', { cache: 'no-store' })
      setData((await res.json()) as GscReport)
    } finally {
      setLoading(false)
    }
  }
  const cur = data?.current?.totals
  const prev = data?.previous?.totals
  const pct = (v: number) => `${(v * 100).toFixed(1)}%`
  const queries = data?.queries ?? []
  const targeted = queries.filter((q) => q.target)
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-bold">ホームページの検索（Search Console）</h2>
        {data?.connected && !data.error && (
          <button type="button" onClick={refresh} disabled={loading} className="min-h-10 rounded-lg border border-slate-300 px-3 text-sm text-slate-700 hover:bg-slate-50">
            {loading ? '取り直し中…' : 'Googleから取り直す'}
          </button>
        )}
      </div>
      {!data ? (
        <p className="mt-2 text-sm text-slate-500">読み込み中…</p>
      ) : !data.connected ? (
        <p className="mt-2 text-sm text-slate-600">
          「Googleとつなぐ」をもう一度押し、Search Console の項目にもチェックを入れると、ホームページがどんな言葉で検索され、何位に出ているかがここに出ます。
          <Link href="/marketing/jobs" className="ml-1 font-bold text-teal-700 underline">
            「投稿の予定と結果」の画面へ
          </Link>
        </p>
      ) : data.error ? (
        <p className="mt-2 rounded-lg bg-amber-50 p-2 text-sm text-amber-800">{data.error}</p>
      ) : (
        <>
          {cur && data.current && (
            <>
              <p className="mt-1 text-xs text-slate-500">
                直近28日（{ymdLabel(data.current.start)}〜{ymdLabel(data.current.end)}）。カッコはその前の28日。掲載順位は小さいほど上です。
              </p>
              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  ['クリック', `${cur.clicks}`, prev ? `前 ${prev.clicks}` : ''],
                  ['検索で表示', `${cur.impressions}`, prev ? `前 ${prev.impressions}` : ''],
                  ['平均掲載順位', `${cur.position}位`, prev ? `前 ${prev.position}位` : ''],
                  ['クリック率', pct(cur.ctr), prev ? `前 ${pct(prev.ctr)}` : ''],
                ].map(([label, value, before]) => (
                  <div key={label} className="rounded-lg bg-slate-50 p-3">
                    <p className="text-xs font-bold text-slate-500">{label}</p>
                    <p className="mt-1 text-2xl font-black text-teal-900">
                      {value}
                      <span className="ml-1 text-xs font-bold text-slate-500">{before && `(${before})`}</span>
                    </p>
                  </div>
                ))}
              </div>
            </>
          )}
          <p className="mt-4 text-sm font-bold text-slate-700">
            検索キーワード（表示の多い順）
            {targeted.length > 0 && <span className="ml-2 text-xs font-bold text-orange-700">投稿で狙っている言葉：{targeted.length}件</span>}
          </p>
          {queries.length === 0 ? (
            <p className="mt-1 text-sm text-slate-500">まだありません。</p>
          ) : (
            <div className="mt-1 overflow-x-auto">
              <table className="w-full min-w-[34rem] text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs whitespace-nowrap text-slate-600">
                    <th className="py-1.5 pr-2 font-bold">キーワード</th>
                    <th className="py-1.5 pr-2 text-right font-bold">クリック</th>
                    <th className="py-1.5 pr-2 text-right font-bold">表示</th>
                    <th className="py-1.5 text-right font-bold">掲載順位（前）</th>
                  </tr>
                </thead>
                <tbody>
                  {queries.slice(0, 30).map((q) => (
                    <tr key={q.key} className="border-b border-slate-100">
                      <td className="py-1.5 pr-2">
                        {q.key}
                        {q.target && <span className="ml-2 rounded-full bg-orange-50 px-2 py-0.5 text-xs font-bold whitespace-nowrap text-orange-800">狙い：{q.target}</span>}
                      </td>
                      <td className="py-1.5 pr-2 text-right font-bold text-teal-900 tabular-nums">{q.clicks}</td>
                      <td className="py-1.5 pr-2 text-right tabular-nums">{q.impressions}</td>
                      <td className="py-1.5 text-right whitespace-nowrap tabular-nums">
                        {q.position}位
                        <span className="ml-1 text-xs text-slate-500">{q.prevPosition !== null ? `(${q.prevPosition}位)` : '(新しく)'}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {(data.pages ?? []).length > 0 && (
            <details className="mt-3 text-sm">
              <summary className="flex min-h-10 cursor-pointer items-center text-xs font-bold text-slate-600">よく見られたページ（上位10）</summary>
              <ul className="divide-y divide-slate-100">
                {(data.pages ?? []).map((p) => (
                  <li key={p.key} className="flex items-center gap-2 py-1.5">
                    <span className="flex-1 truncate">{p.key.replace(/^https?:\/\/[^/]+/, '') || '/'}</span>
                    <span className="text-xs text-slate-600 tabular-nums">クリック {p.clicks}・表示 {p.impressions}・{p.position}位</span>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </>
      )}
    </section>
  )
}

/** Googleビジネスプロフィールの成果（表示・電話・ルート・ウェブサイト・予約）と「検索された言葉」 */
function GooglePerformance() {
  const [data, setData] = useState<GbpPerformance | null>(null)
  const [loading, setLoading] = useState(false)
  const load = useCallback(async (refresh: boolean) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/marketing/google/performance${refresh ? '?refresh=1' : ''}`, { cache: 'no-store' })
      setData((await res.json()) as GbpPerformance)
    } catch {
      setData({ connected: true, error: '読み込めませんでした' })
    } finally {
      setLoading(false)
    }
  }, [])
  useEffect(() => {
    // 最初は6時間とっておいた値を読む（読み込み中の表示は data が無いことで出す）
    let alive = true
    fetch('/api/marketing/google/performance', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d: GbpPerformance) => {
        if (alive) setData(d)
      })
      .catch(() => {
        if (alive) setData({ connected: true, error: '読み込めませんでした' })
      })
    return () => {
      alive = false
    }
  }, [])

  const cur = data?.current?.totals
  const prev = data?.previous?.totals
  const diff = (a: number, b: number | undefined) => (b === undefined ? '' : a - b > 0 ? `+${a - b}` : `${a - b}`)
  const keywords = data?.keywords?.items ?? []
  const before = new Map((data?.keywordsBefore?.items ?? []).map((k) => [k.keyword, k]))
  const hits = keywords.filter((k) => k.target)

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-bold">Googleビジネスプロフィール（検索・マップ）</h2>
        {data?.connected && (
          <button type="button" onClick={() => load(true)} disabled={loading} className="min-h-10 rounded-lg border border-slate-300 px-3 text-sm text-slate-700 hover:bg-slate-50">
            {loading ? '取り直し中…' : 'Googleから取り直す'}
          </button>
        )}
      </div>
      {!data ? (
        <p className="mt-2 text-sm text-slate-500">読み込み中…</p>
      ) : !data.connected ? (
        <p className="mt-2 text-sm text-slate-600">
          Googleとつなぐと、検索・マップでの表示回数、電話・ルート・ウェブサイトのタップ、実際に「検索された言葉」がここに出ます。
          <Link href="/marketing/jobs" className="ml-1 font-bold text-teal-700 underline">
            「投稿の予定と結果」の画面の「Googleとつなぐ」へ
          </Link>
        </p>
      ) : data.error ? (
        <p className="mt-2 rounded-lg bg-amber-50 p-2 text-sm text-amber-800">{data.error}</p>
      ) : (
        <>
          {cur && data.current && (
            <>
              <p className="mt-1 text-xs text-slate-500">
                直近28日（{ymdLabel(data.current.start)}〜{ymdLabel(data.current.end)}）。カッコはその前の28日とのちがい。Googleの数字は2〜3日遅れて入ります。
              </p>
              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-5">
                {[
                  ['検索・マップで表示', impressionsOf(cur), prev ? impressionsOf(prev) : undefined],
                  ['電話のタップ', cur.CALL_CLICKS, prev?.CALL_CLICKS],
                  ['ルートの検索', cur.BUSINESS_DIRECTION_REQUESTS, prev?.BUSINESS_DIRECTION_REQUESTS],
                  ['ウェブサイトへ', cur.WEBSITE_CLICKS, prev?.WEBSITE_CLICKS],
                  ['Googleからの予約', cur.BUSINESS_BOOKINGS, prev?.BUSINESS_BOOKINGS],
                ].map(([label, value, before]) => (
                  <div key={label as string} className="rounded-lg bg-slate-50 p-3">
                    <p className="text-xs font-bold text-slate-500">{label}</p>
                    <p className="mt-1 text-2xl font-black text-teal-900">
                      {value as number}
                      <span className="ml-1 text-xs font-bold text-slate-500">{diff(value as number, before as number | undefined) && `(${diff(value as number, before as number | undefined)})`}</span>
                    </p>
                  </div>
                ))}
              </div>
              <details className="mt-2 text-sm">
                <summary className="flex min-h-10 cursor-pointer items-center text-xs font-bold text-slate-600">表示の内訳</summary>
                <ul className="grid grid-cols-2 gap-1 text-xs text-slate-600 sm:grid-cols-4">
                  {GBP_DAILY_METRICS.slice(0, 4).map((m) => (
                    <li key={m}>
                      {GBP_METRIC_LABELS[m]}：<b>{cur[m]}</b>
                    </li>
                  ))}
                </ul>
              </details>
            </>
          )}
          <div className="mt-4">
            <p className="text-sm font-bold text-slate-700">
              検索された言葉{data.keywords ? `（${monthLabel(data.keywords.month)}）` : ''}
              {hits.length > 0 && <span className="ml-2 text-xs font-bold text-orange-700">投稿で狙っている言葉：{hits.length}件</span>}
            </p>
            {keywords.length === 0 ? (
              <p className="mt-1 text-sm text-slate-500">先月の分はまだありません（月が終わってから数日で入ります）。</p>
            ) : (
              <ol className="mt-1 divide-y divide-slate-100 text-sm">
                {keywords.slice(0, 25).map((k) => {
                  const b = before.get(k.keyword)
                  return (
                    <li key={k.keyword} className="flex flex-wrap items-center gap-2 py-1.5">
                      <span className="flex-1">{k.keyword}</span>
                      {k.target && <span className="rounded-full bg-orange-50 px-2 py-0.5 text-xs font-bold text-orange-800">狙い：{k.target}</span>}
                      <span className="w-20 text-right font-bold text-teal-900 tabular-nums">{k.value !== null ? `${k.value}回` : `${k.threshold ?? ''}回未満`}</span>
                      <span className="w-16 text-right text-xs text-slate-500 tabular-nums">{b ? `前月 ${b.value ?? `<${b.threshold ?? ''}`}` : '新しく'}</span>
                    </li>
                  )
                })}
              </ol>
            )}
          </div>
        </>
      )}
    </section>
  )
}

const FUNNEL_STEPS: Array<{ key: keyof Analytics['funnel']; label: string }> = [
  { key: 'follow', label: '友だち追加' },
  { key: 'intent', label: '相談内容を選択' },
  { key: 'guide', label: '来院案内に到達' },
  { key: 'reserveClick', label: '予約リンクをクリック' },
]

interface FollowerPoint {
  date: string
  followers: number
  source: 'api' | 'manual'
}
interface FollowerData {
  points: FollowerPoint[]
  summary: null | { latest: FollowerPoint; change7: number | null; change30: number | null }
  connected: boolean
}

const signed = (n: number | null) => (n === null ? '—' : n > 0 ? `+${n}` : `${n}`)

/** Instagramフォロワーの推移（連携後は毎日自動。連携前は手で記録） */
function InstagramFollowers() {
  const { isAdmin } = useMarketingRole()
  const [data, setData] = useState<FollowerData | null>(null)
  const [value, setValue] = useState('')
  const [message, setMessage] = useState('')

  const load = useCallback(
    () =>
      fetch('/api/marketing/analytics/instagram', { cache: 'no-store' })
        .then((r) => (r.ok ? r.json() : null))
        .then((d: FollowerData | null) => {
          if (d) setData(d)
        })
        .catch(() => undefined),
    [],
  )
  useEffect(() => {
    load()
  }, [load])

  async function save() {
    const followers = Number(value.replace(/[,，\s人]/g, ''))
    if (!Number.isFinite(followers) || followers < 0) {
      setMessage('数字で入力してください')
      return
    }
    const res = await fetch('/api/marketing/analytics/instagram', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ followers }),
    })
    const d = await res.json()
    if (res.ok) {
      setData((prev) => ({ connected: prev?.connected ?? false, points: d.points, summary: d.summary }))
      setValue('')
      setMessage('記録しました')
    } else {
      setMessage(d.error ?? '記録できませんでした')
    }
  }

  const recent = [...(data?.points ?? [])].reverse().slice(0, 8)
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4">
      <h2 className="font-bold">Instagramフォロワー</h2>
      {data?.summary ? (
        <div className="mt-2 flex flex-wrap items-end gap-6">
          <div>
            <p className="text-xs font-bold text-slate-500">いま（{data.summary.latest.date}）</p>
            <p className="text-3xl font-black text-teal-900">{data.summary.latest.followers.toLocaleString('ja-JP')}人</p>
          </div>
          <div>
            <p className="text-xs font-bold text-slate-500">7日前から</p>
            <p className="text-xl font-bold">{signed(data.summary.change7)}</p>
          </div>
          <div>
            <p className="text-xs font-bold text-slate-500">30日前から</p>
            <p className="text-xl font-bold">{signed(data.summary.change30)}</p>
          </div>
        </div>
      ) : (
        <p className="mt-2 text-sm text-slate-500">まだ記録がありません。</p>
      )}
      {recent.length > 1 && (
        <ul className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-4">
          {recent.map((p) => (
            <li key={p.date} className="flex justify-between gap-2 border-b border-slate-100 py-1">
              <span className="text-slate-500">{p.date.slice(5).replace('-', '/')}</span>
              <span className="font-medium">{p.followers.toLocaleString('ja-JP')}</span>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 text-xs text-slate-500">
        {data?.connected
          ? 'Instagram連携済み：毎日自動で記録しています。'
          : 'Instagram連携後は毎日自動で記録します。それまでは、週に1回ほどプロフィールのフォロワー数をここに記録してください。'}
      </p>
      {isAdmin && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            inputMode="numeric"
            placeholder="今日のフォロワー数（例: 912）"
            className="w-48 rounded-lg border border-slate-300 p-2 text-sm"
          />
          <button type="button" onClick={save} className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-bold text-white max-lg:min-h-10">
            記録する
          </button>
          {message && <span className="text-sm text-slate-600">{message}</span>}
        </div>
      )}
    </section>
  )
}

export default function AnalyticsPage() {
  const [data, setData] = useState<Analytics | null>(null)
  const [days, setDays] = useState(30)

  const refresh = useCallback(async (d: number) => {
    const res = await fetch(`/api/marketing/analytics?days=${d}`)
    setData(await res.json())
  }, [])

  useEffect(() => {
    refresh(days)
  }, [days, refresh])

  if (!data) return <p className="text-sm text-slate-500">読み込み中…</p>

  const funnelMax = Math.max(data.funnel.follow, 1)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold">集客の効果</h1>
        <div className="flex gap-1">
          {[7, 30, 90].map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDays(d)}
              className={`rounded-full border px-3 py-1 text-sm font-medium max-lg:min-h-10 ${
                days === d ? 'border-teal-700 bg-teal-50 text-teal-800' : 'border-slate-300 text-slate-600'
              }`}
            >
              {d}日
            </button>
          ))}
        </div>
      </div>

      {/* コンバージョンサマリー */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ['LINE友だち', data.conversions.contacts],
          ['予約済み', data.conversions.reserved],
          ['来院済み', data.conversions.visited],
          ['予約クリック', data.funnel.reserveClick],
        ].map(([label, value]) => (
          <div key={label as string} className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs font-bold text-slate-500">{label}</p>
            <p className="mt-1 text-3xl font-black text-teal-900">{value}</p>
          </div>
        ))}
      </div>

      <GooglePerformance />

      <SearchConsole />

      {/* Google検索向けの投稿（1本ごと） */}
      {data.seoPosts && data.seoPosts.length > 0 && (
        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="font-bold">Google検索向けの投稿（1本ごと・直近{data.days}日のタップと予約）</h2>
          <ul className="mt-2 divide-y divide-slate-100 text-sm">
            {data.seoPosts.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center gap-2 py-1.5">
                <span className="w-24 font-mono text-xs text-slate-500">{p.scheduledAt.slice(5, 16).replace('-', '/').replace('T', ' ')}</span>
                <span className="flex-1 truncate">
                  {p.url ? (
                    <a href={p.url} target="_blank" rel="noreferrer" className="text-teal-700 underline">
                      {p.title}
                    </a>
                  ) : (
                    p.title
                  )}
                </span>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700">{SEO_STATUS[p.status] ?? p.status}</span>
                <span className="w-20 text-right text-xs text-slate-600 tabular-nums">予約ボタン {p.taps}</span>
                <span className="w-14 text-right font-bold text-teal-900 tabular-nums">予約 {p.bookings}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <InstagramFollowers />

      {/* 予約（流入元別）… どこから来た予約か */}
      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="font-bold">予約の流入元（どこから来た予約か）</h2>
        {!data.bookings ? (
          <p className="mt-2 text-sm text-slate-500">
            予約システム側の更新（流入元の記録）が終わると、ここに「Instagram・Google・LINEなど、どこから何件の予約が入ったか」が表示されます。
          </p>
        ) : data.bookings.total === 0 ? (
          <p className="mt-2 text-sm text-slate-500">この期間のネット予約はまだありません。</p>
        ) : (
          <>
            <p className="mt-1 text-xs text-slate-500">
              期間中の予約 {data.bookings.total}件（うち初めての方 {data.bookings.firstVisit}件）。計測リンク経由のクリック数と並べて表示します。
            </p>
            <div className="mt-2 overflow-x-auto">
              <table className="w-full min-w-[28rem] text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
                    <th className="py-1.5 pr-2">流入元</th>
                    <th className="py-1.5 pr-2 text-right">予約</th>
                    <th className="py-1.5 pr-2 text-right">うち初めて</th>
                    <th className="py-1.5 pr-2 text-right">キャンセル</th>
                    <th className="py-1.5 text-right">予約リンクのクリック</th>
                  </tr>
                </thead>
                <tbody>
                  {data.bookings.sources.map((s) => (
                    <tr key={s.source} className="border-b border-slate-100">
                      <td className="py-1.5 pr-2 font-medium">{s.label}</td>
                      <td className="py-1.5 pr-2 text-right font-bold text-teal-900">{s.bookings}</td>
                      <td className="py-1.5 pr-2 text-right">{s.firstVisit}</td>
                      <td className="py-1.5 pr-2 text-right text-slate-500">{s.cancelled}</td>
                      <td className="py-1.5 text-right text-slate-500">{s.clicks || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {data.bookings.posts.length > 0 && (
              <div className="mt-3">
                <p className="text-xs font-bold text-slate-600">予約につながった自動投稿</p>
                <ul className="mt-1 divide-y divide-slate-100 text-sm">
                  {data.bookings.posts.map((p) => (
                    <li key={p.campaign} className="flex items-center gap-2 py-1.5">
                      <span className="font-mono text-xs text-slate-500">{p.scheduledAt ? p.scheduledAt.slice(5, 10).replace('-', '/') : p.campaign}</span>
                      <span className="flex-1 truncate">{p.theme}</span>
                      <span className="font-bold text-teal-900">{p.bookings}件</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </section>

      {/* LINEファネル */}
      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="font-bold">LINE初回導線ファネル（直近{data.days}日）</h2>
        <div className="mt-3 space-y-2">
          {FUNNEL_STEPS.map((step, i) => {
            const value = data.funnel[step.key]
            const prev = i > 0 ? data.funnel[FUNNEL_STEPS[i - 1].key] : value
            const rate = i > 0 && prev > 0 ? Math.round((value / prev) * 100) : 100
            return (
              <div key={step.key} className="flex items-center gap-3 text-sm">
                <span className="w-40 font-medium">{step.label}</span>
                <div className="h-6 flex-1 rounded bg-slate-100">
                  <div
                    className="flex h-6 items-center rounded bg-teal-700 px-2 text-xs font-bold text-white"
                    style={{ width: `${Math.max((value / funnelMax) * 100, value > 0 ? 8 : 0)}%` }}
                  >
                    {value}
                  </div>
                </div>
                <span className="w-16 text-right text-xs text-slate-500">{i > 0 ? `${rate}%` : ''}</span>
              </div>
            )
          })}
        </div>
        <p className="mt-2 text-xs text-slate-500">
          緊急案内 {data.counts.urgent}件 / スタッフ引き継ぎ {data.counts.handoff}件（この2つはファネルから除外して案内済み）
        </p>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* 相談入口の内訳 */}
        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="font-bold">相談内容の内訳</h2>
          {Object.keys(data.intentBreakdown).length === 0 ? (
            <p className="mt-2 text-sm text-slate-500">データがまだありません。</p>
          ) : (
            <ul className="mt-2 space-y-1 text-sm">
              {Object.entries(data.intentBreakdown)
                .sort((a, b) => b[1] - a[1])
                .map(([label, value]) => (
                  <li key={label} className="flex justify-between border-b border-slate-100 py-1">
                    <span>{label}</span>
                    <span className="font-bold">{value}</span>
                  </li>
                ))}
            </ul>
          )}
        </section>

        {/* クリック内訳 */}
        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="font-bold">リンククリック内訳（計測リンク経由）</h2>
          {Object.keys(data.clickBreakdown).length === 0 ? (
            <p className="mt-2 text-sm text-slate-500">データがまだありません。</p>
          ) : (
            <ul className="mt-2 space-y-1 text-sm">
              {Object.entries(data.clickBreakdown)
                .sort((a, b) => b[1] - a[1])
                .map(([label, value]) => (
                  <li key={label} className="flex justify-between border-b border-slate-100 py-1">
                    <span>{label}</span>
                    <span className="font-bold">{value}</span>
                  </li>
                ))}
            </ul>
          )}
        </section>
      </div>

      {/* 投稿実績 */}
      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="font-bold">投稿実績（媒体別・直近{data.days}日）</h2>
        {Object.keys(data.postStats).length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">期間内の投稿ジョブはありません。</p>
        ) : (
          <ul className="mt-2 grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
            {Object.entries(data.postStats).map(([channel, s]) => (
              <li key={channel} className="rounded-lg border border-slate-100 p-2">
                <p className="font-bold">{CHANNEL_LABELS[channel as Channel] ?? channel}</p>
                <p className="text-xs text-slate-500">
                  公開 {s.published} / 待機 {s.pending} / 失敗 {s.failed}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* フォロー候補（指示書4-6） */}
      <section className="rounded-xl border border-amber-200 bg-amber-50/50 p-4">
        <h2 className="font-bold">フォロー候補（途中で止まっている方・24時間以上）</h2>
        <p className="mt-1 text-xs text-slate-500">
          予約済み・配信停止・緊急案内済み・人対応中の方は自動的に除外しています。過剰な追客はせず、1〜2回の丁寧な声かけまでに。
        </p>
        {data.followUps.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">現在フォローが必要な方はいません。</p>
        ) : (
          <ul className="mt-2 divide-y divide-amber-100 text-sm">
            {data.followUps.map((f) => (
              <li key={f.userId} className="flex flex-wrap items-center gap-2 py-2">
                <span className="font-bold">{f.displayName}</span>
                <span className="rounded bg-white px-2 py-0.5 text-xs">
                  {f.intent ? INTENT_LABELS[f.intent as IntentKey] ?? f.intent : '入口未選択'}
                </span>
                <span className="text-xs text-slate-500">{f.daysSince}日前から停止</span>
                <Link href="/marketing/line" className="ml-auto text-xs font-bold text-teal-700 underline">
                  会話を開く
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
