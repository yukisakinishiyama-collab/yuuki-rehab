'use client'
/**
 * 公式LINE のブロックの状況（集客 → 自動化設定。院長のみ）
 *
 * 2026-11-26 院長「公式lineをブロックしにくい設計に」。数だけを出す（お名前は出さない）：
 * - 友だちの数・ブロックの数（LINE の集計。前の日まで）
 * - この30日のブロックと、その直前に届いていたお知らせの種類（どのお知らせがブロックにつながりやすいかを見る）
 * - 友だち全員への配信の回数（30日に2回まで・7日あける歯止め）
 */
import { useEffect, useState } from 'react'

interface Stats {
  ok: boolean
  insight: { date: string; followers: number; blocks: number; reach: number } | null
  last30: { total: number; byLast: Array<{ kind: string; label: string; count: number }>; byWithin: Array<{ within: string; label: string; count: number }> }
  broadcasts: { last30: number; lastAt: string | null; limit: number; gapDays: number; blockedNow: string | null }
}

const ymd = (d: string) => `${Number(d.slice(4, 6))}/${Number(d.slice(6, 8))}`

export function LineBlockPanel() {
  const [data, setData] = useState<Stats | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let alive = true
    fetch('/api/marketing/line/block-stats', { cache: 'no-store' })
      .then(async (r) => {
        const d = (await r.json().catch(() => null)) as (Stats & { error?: string }) | null
        if (!r.ok || !d?.ok) throw new Error(d?.error || `HTTP ${r.status}`)
        if (alive) setData(d)
      })
      .catch((e: unknown) => alive && setError(e instanceof Error ? e.message : '読めませんでした'))
    return () => {
      alive = false
    }
  }, [])

  const rate = data?.insight && data.insight.followers > 0 ? Math.round((data.insight.blocks / data.insight.followers) * 1000) / 10 : null

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4" aria-label="公式LINE のブロックの状況">
      <h2 className="font-bold text-slate-900">公式LINE のブロックの状況</h2>
      <p className="mt-1 text-xs text-slate-500">
        ブロックの理由で多いのは「不要な情報が多い」「配信が多い」です。ここで、ブロックの数と、その直前に何を送っていたかを見られます（数だけ。お名前は出ません）。
      </p>
      {error ? (
        <p role="alert" className="mt-2 text-sm text-red-700">読めませんでした（{error}）</p>
      ) : !data ? (
        <p className="mt-2 text-sm text-slate-500">読み込み中…</p>
      ) : (
        <div className="mt-3 space-y-3 text-sm">
          <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              { label: '友だち', value: data.insight ? `${data.insight.followers}人` : '—' },
              { label: 'ブロック中', value: data.insight ? `${data.insight.blocks}人` : '—' },
              { label: 'ブロックの割合', value: rate === null ? '—' : `${rate}%` },
              { label: 'この30日のブロック', value: `${data.last30.total}人` },
            ].map((x) => (
              <div key={x.label} className="rounded-lg bg-slate-50 px-3 py-2">
                <dt className="text-xs text-slate-600">{x.label}</dt>
                <dd className="text-lg font-black tabular-nums text-slate-900">{x.value}</dd>
              </div>
            ))}
          </dl>
          <p className="text-xs text-slate-500">
            {data.insight ? `友だち・ブロック中は LINE の集計（${ymd(data.insight.date)} まで）。` : '友だち・ブロック中の数は、LINE の集計をまだ読めません（友だちが少ないときなどは出ません）。'}
            「この30日のブロック」は、ブロックの通知の数です。
          </p>
          {data.last30.total > 0 && (
            <div>
              <p className="font-bold text-slate-800">ブロックの直前に届いていたもの（この30日）</p>
              <ul className="mt-1 divide-y divide-slate-100">
                {data.last30.byLast.map((r) => (
                  <li key={r.kind} className="flex items-center justify-between gap-3 py-1.5">
                    <span className="text-slate-700">{r.label}</span>
                    <span className="font-bold tabular-nums text-slate-900">{r.count}人</span>
                  </li>
                ))}
              </ul>
              {data.last30.byWithin.length > 0 && (
                <p className="mt-1 text-xs text-slate-500">届いてからブロックまで：{data.last30.byWithin.map((w) => `${w.label} ${w.count}人`).join('・')}</p>
              )}
            </div>
          )}
          <p className="text-slate-700">
            友だち全員への配信：この30日で <span className="font-bold">{data.broadcasts.last30}回</span>（30日に{data.broadcasts.limit}回まで・前の配信から{data.broadcasts.gapDays}日あけます）
            {data.broadcasts.blockedNow && <span className="mt-1 block text-xs text-amber-800">いまは自動では配信しません：{data.broadcasts.blockedNow}</span>}
          </p>
        </div>
      )}
    </section>
  )
}
