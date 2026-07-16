'use client'

/** 効果測定ダッシュボード：LINEファネル・流入クリック・コンバージョン・フォロー候補 */
import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { CHANNEL_LABELS, type Channel } from '@/lib/marketing/types'
import { INTENT_LABELS, type IntentKey } from '@/lib/marketing/line-types'

interface Analytics {
  days: number
  funnel: { follow: number; intent: number; guide: number; reserveClick: number }
  counts: { urgent: number; handoff: number; totalClicks: number }
  intentBreakdown: Record<string, number>
  clickBreakdown: Record<string, number>
  conversions: { contacts: number; reserved: number; visited: number; handedOff: number }
  followUps: Array<{ userId: string; displayName: string; intent: string | null; step: string; daysSince: number }>
  postStats: Record<string, { published: number; pending: number; failed: number }>
}

const FUNNEL_STEPS: Array<{ key: keyof Analytics['funnel']; label: string }> = [
  { key: 'follow', label: '友だち追加' },
  { key: 'intent', label: '相談内容を選択' },
  { key: 'guide', label: '来院案内に到達' },
  { key: 'reserveClick', label: '予約リンクをクリック' },
]

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
        <h1 className="text-2xl font-bold">効果測定</h1>
        <div className="flex gap-1">
          {[7, 30, 90].map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDays(d)}
              className={`rounded-full border px-3 py-1 text-sm font-medium ${
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
                    className="flex h-6 items-center rounded bg-teal-600 px-2 text-xs font-bold text-white"
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
