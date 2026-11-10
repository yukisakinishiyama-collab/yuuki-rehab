'use client'

/**
 * 集客 → 集客概要（指示書6章①）
 *
 * 今日の問い合わせ・今月の新規予約・流入元別・キャンセルの状況・承認待ち・連携の状態を1画面で。
 * 取れなかった数字は 0 にせず「未取得／未連携」と理由を出す。数字ごとに期間と数え方を開いて見られる。
 * 売上などの経営の数字は出さない（院長・スタッフとも同じ画面）。
 */
import Link from 'next/link'
import { AlertTriangle, CalendarRange, Globe, Inbox, Link2, RefreshCw, Sun } from 'lucide-react'
import { IconButton, MoreLink, Panel } from '@/components/clinic/Panel'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useApi } from '@/lib/marketing/use-api'
import { METRIC_STATE_LABELS, type ConnectionRow, type HpEntryRow, type Metric, type OverviewData } from '@/lib/marketing/overview-types'

function formatValue(m: Metric): string {
  if (m.value === null) return ''
  return m.unit === '%' ? m.value.toFixed(1) : m.value.toLocaleString('ja-JP')
}

/** 数字1つ。取れなかったときは「未取得／未連携」と理由。期間と数え方は開いて見る */
function EntryTable({ caption, rows, total }: { caption: string; rows: HpEntryRow[]; total: number }) {
  return (
    <table className="w-full text-sm">
      <caption className="pb-1 text-left text-xs font-bold text-slate-600">{caption}</caption>
      <thead>
        <tr className="border-b border-slate-200 text-left text-xs text-slate-600">
          <th className="py-2 pr-2 font-bold">名前</th>
          <th className="py-2 pr-2 text-right font-bold">回数</th>
          <th className="py-2 text-right font-bold">割合</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.key} className="border-b border-slate-100 last:border-0">
            <td className="py-2 pr-2 font-medium text-slate-800">{r.label}</td>
            <td className="py-2 pr-2 text-right tabular-nums">{r.count}</td>
            <td className="py-2 text-right tabular-nums text-slate-600">{total > 0 ? Math.round((r.count / total) * 100) : 0}%</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function MetricTile({ m }: { m: Metric }) {
  const missing = m.value === null
  const body = (
    <>
      <p className="text-xs font-bold text-slate-600">{m.label}</p>
      {missing ? (
        <p className="mt-1.5">
          <Badge variant={m.state === 'not_connected' ? 'secondary' : 'warning'}>{METRIC_STATE_LABELS[m.state] || '未取得'}</Badge>
        </p>
      ) : (
        <p className="mt-1 text-2xl font-black tabular-nums text-slate-900">
          {formatValue(m)}
          <span className="ml-0.5 text-sm font-bold text-slate-600">{m.unit}</span>
        </p>
      )}
      <p className="mt-1 text-xs text-slate-500">{m.period}</p>
    </>
  )
  return (
    <div className="flex min-w-0 flex-col rounded-xl border border-slate-200 bg-white p-3">
      {m.href ? (
        <Link href={m.href} className="rounded-lg hover:opacity-90 focus-visible:outline-2 focus-visible:outline-teal-700">
          {body}
        </Link>
      ) : (
        body
      )}
      <details className="mt-2 text-xs text-slate-600">
        <summary className="flex min-h-10 cursor-pointer items-center font-bold text-teal-800 lg:min-h-0">数え方</summary>
        <p className="mt-1 leading-relaxed">{m.basis}</p>
        {m.note && <p className="mt-1 leading-relaxed text-amber-800">{m.note}</p>}
      </details>
    </div>
  )
}

const CONNECTION_BADGE: Record<ConnectionRow['state'], { label: string; variant: 'success' | 'secondary' | 'danger' }> = {
  connected: { label: '連携中', variant: 'success' },
  not_set: { label: '未連携', variant: 'secondary' },
  error: { label: '取れない', variant: 'danger' },
}

const pickOverview = (json: { overview?: OverviewData }) => json.overview

export default function MarketingOverview() {
  const { data, error, loading, reload } = useApi('/api/marketing/overview', pickOverview)

  const updated = data ? new Date(data.generatedAt).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }) : ''

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="sr-only text-2xl font-bold lg:not-sr-only">集客概要</h1>
          <p className="text-sm text-slate-600">
            問い合わせ・予約・流入元を、取れたものだけ数えています（取れないものは「未取得」）。
            {updated && <span className="ml-1 text-xs text-slate-500">更新 {updated}</span>}
          </p>
        </div>
        <IconButton label="読み直す" onClick={reload} disabled={loading}>
          <RefreshCw className={cn('h-5 w-5', loading && 'animate-spin')} aria-hidden />
        </IconButton>
      </div>

      {error && (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <p className="font-bold">集客の数字を読み込めませんでした</p>
          <p className="mt-1">{error}</p>
          <button
            type="button"
            onClick={reload}
            className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'mt-3')}
          >
            もう一度読む
          </button>
        </div>
      )}

      {!data && loading && <p className="text-sm text-slate-500">読み込んでいます…</p>}

      {data && (
        <>
          {/* 確認してほしいもの（承認待ち・未対応） */}
          {(data.pending.approvals > 0 || data.pending.inquiriesNew > 0) && (
            <div className="grid gap-3 sm:grid-cols-2">
              {data.pending.approvals > 0 && (
                <Link
                  href="/marketing/autopilot"
                  className="flex min-h-11 items-center gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-900 hover:bg-amber-100"
                >
                  <AlertTriangle className="h-5 w-5 shrink-0" aria-hidden />
                  <span>
                    <span className="block font-bold">投稿の案が {data.pending.approvals} 本、承認を待っています</span>
                    <span className="block text-sm">承認するまで公開されません →</span>
                  </span>
                </Link>
              )}
              {data.pending.inquiriesNew > 0 && (
                <Link
                  href="/marketing/inquiries"
                  className="flex min-h-11 items-center gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-900 hover:bg-amber-100"
                >
                  <Inbox className="h-5 w-5 shrink-0" aria-hidden />
                  <span>
                    <span className="block font-bold">未対応の問い合わせが {data.pending.inquiriesNew} 人</span>
                    <span className="block text-sm">LINE の相談を確認してください →</span>
                  </span>
                </Link>
              )}
            </div>
          )}

          <Panel title="今日" icon={Sun} action={<MoreLink href="/marketing/inquiries">問い合わせ</MoreLink>}>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {data.today.map((m) => (
                <MetricTile key={m.key} m={m} />
              ))}
            </div>
          </Panel>

          <Panel title={`今月（${data.monthLabel}）`} icon={CalendarRange}>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {data.month.map((m) => (
                <MetricTile key={m.key} m={m} />
              ))}
            </div>
          </Panel>

          <Panel title="流入元別の予約" meta={`${data.monthLabel}・受付日で数える`}>
            {data.sources === null ? (
              <p className="text-sm text-slate-600">
                <Badge variant="warning" className="mr-2">未取得</Badge>
                {data.sourcesNote}
              </p>
            ) : data.sources.length === 0 ? (
              <p className="text-sm text-slate-600">今月の予約・予約ボタンの記録はまだありません。</p>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[28rem] text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 text-left text-xs text-slate-600">
                        <th className="py-2 pr-2 font-bold">流入元</th>
                        <th className="py-2 pr-2 text-right font-bold">予約</th>
                        <th className="py-2 pr-2 text-right font-bold">うち初めて</th>
                        <th className="py-2 pr-2 text-right font-bold">キャンセル</th>
                        <th className="py-2 text-right font-bold">予約ボタン</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.sources.map((s) => (
                        <tr key={s.source} className="border-b border-slate-100 last:border-0">
                          <td className="py-2 pr-2 font-medium text-slate-800">{s.label}</td>
                          <td className="py-2 pr-2 text-right tabular-nums">{s.bookings}</td>
                          <td className="py-2 pr-2 text-right tabular-nums">{s.firstVisit}</td>
                          <td className="py-2 pr-2 text-right tabular-nums">{s.cancelled}</td>
                          <td className="py-2 text-right tabular-nums">{s.clicks}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="mt-2 text-xs text-slate-500">{data.sourcesNote}。数の変化は、投稿や季節など多くの理由が重なるため、1つの原因とは決めつけません。</p>
              </>
            )}
          </Panel>

          <Panel title="ホームページへの入口" icon={Globe} meta={data.hpEntries ? `${data.hpEntries.period}・外から来た回数` : undefined}>
            {data.hpEntries === null ? (
              <p className="text-sm text-slate-600">
                <Badge variant="warning" className="mr-2">未取得</Badge>
                {data.hpEntriesNote}
              </p>
            ) : data.hpEntries.total === 0 ? (
              <p className="text-sm text-slate-600">この期間に外から来た記録はまだありません。</p>
            ) : (
              <>
                <div className="grid gap-4 md:grid-cols-2">
                  <EntryTable caption="来たところ" rows={data.hpEntries.sources} total={data.hpEntries.total} />
                  <EntryTable caption="入口になったページ（多い順）" rows={data.hpEntries.pages} total={data.hpEntries.total} />
                </div>
                <p className="mt-2 text-xs text-slate-500">
                  {data.hpEntriesNote}。Google マップのアプリや LINE から開くと、来たところが分からず「直接」に入ることがあります。
                </p>
              </>
            )}
          </Panel>

          <Panel title="連携の状態" icon={Link2} meta="つながっていないものは、動いているように見せません">
            <ul className="divide-y divide-slate-100">
              {data.connections.map((c) => {
                const badge = CONNECTION_BADGE[c.state]
                const row = (
                  <>
                    <span className="min-w-0">
                      <span className="block text-sm font-bold text-slate-800">{c.label}</span>
                      <span className="block text-xs text-slate-600">{c.note}</span>
                    </span>
                    <Badge variant={badge.variant} className="shrink-0">{badge.label}</Badge>
                  </>
                )
                return (
                  <li key={c.key}>
                    {c.href ? (
                      <Link href={c.href} className="flex min-h-11 items-center justify-between gap-3 py-2 hover:bg-slate-50">
                        {row}
                      </Link>
                    ) : (
                      <div className="flex min-h-11 items-center justify-between gap-3 py-2">{row}</div>
                    )}
                  </li>
                )
              })}
            </ul>
          </Panel>
        </>
      )}
    </div>
  )
}
