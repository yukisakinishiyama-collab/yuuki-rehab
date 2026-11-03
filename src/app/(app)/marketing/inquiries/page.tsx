'use client'

/**
 * 集客 → 問い合わせ（指示書6章②）
 *
 * 公式LINE の相談を「未対応・対応中・予約済み・完了」で管理する（院長・スタッフとも使える）。
 * 会話の中身・返信は LINE導線（/marketing/line）で。電話・窓口の問い合わせは予約・カルテの側で扱う。
 */
import Link from 'next/link'
import { useMemo, useState } from 'react'
import { Inbox, MessageCircle, RefreshCw } from 'lucide-react'
import { IconButton, Panel } from '@/components/clinic/Panel'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useApi } from '@/lib/marketing/use-api'
import { INQUIRY_STATUS_LABELS, type InquiryStatus } from '@/lib/marketing/line-types'
import type { InquiryRow } from '@/lib/marketing/inquiry'

type Filter = InquiryStatus | 'all'
const FILTERS: Filter[] = ['new', 'in_progress', 'reserved', 'done', 'all']
const STATUS_ORDER: InquiryStatus[] = ['new', 'in_progress', 'reserved', 'done']

const STATUS_BADGE: Record<InquiryStatus, 'warning' | 'blue' | 'success' | 'secondary'> = {
  new: 'warning',
  in_progress: 'blue',
  reserved: 'success',
  done: 'secondary',
}

function when(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

const pickInquiries = (json: { inquiries?: InquiryRow[]; counts?: Record<InquiryStatus, number> }) =>
  json.inquiries ? { inquiries: json.inquiries, counts: json.counts ?? null } : undefined

export default function InquiriesPage() {
  const { data, error: loadError, loading, reload } = useApi('/api/marketing/inquiries', pickInquiries)
  const rows = useMemo(() => data?.inquiries ?? [], [data])
  const counts = data?.counts ?? null
  const [filterChoice, setFilter] = useState<Filter | null>(null)
  // 最初に開いたときは、未対応があれば未対応を出す
  const filter: Filter = filterChoice ?? ((counts?.new ?? 0) > 0 ? 'new' : 'all')
  const [saveError, setError] = useState('')
  const error = saveError || loadError
  const [saving, setSaving] = useState('')

  async function changeStatus(userId: string, status: InquiryStatus) {
    setSaving(userId)
    setError('')
    try {
      const res = await fetch('/api/marketing/inquiries', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, status }),
      })
      const json = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null
      if (!res.ok || !json?.ok) throw new Error(json?.error ?? `変えられませんでした（${res.status}）`)
      reload()
    } catch (e) {
      setError(e instanceof Error ? e.message : '変えられませんでした')
    } finally {
      setSaving('')
    }
  }

  const shown = useMemo(() => (filter !== 'all' ? rows.filter((r) => r.status === filter) : rows), [rows, filter])

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="sr-only text-2xl font-bold lg:not-sr-only">問い合わせ</h1>
          <p className="text-sm text-slate-600">
            公式LINE で相談のあった方（友だち追加だけの方は入れていません）。同じ方は1件です。
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/marketing/line" className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'gap-1.5')}>
            <MessageCircle className="h-4 w-4" aria-hidden />
            LINE導線（会話）
          </Link>
          <IconButton label="読み直す" onClick={reload} disabled={loading}>
            <RefreshCw className={cn('h-5 w-5', loading && 'animate-spin')} aria-hidden />
          </IconButton>
        </div>
      </div>

      {error && (
        <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-800">
          {error}
        </p>
      )}

      <div className="flex flex-wrap gap-1.5" role="group" aria-label="状態で絞る">
        {FILTERS.map((f) => {
          const on = filter === f
          const count = f === 'all' ? rows.length : (counts?.[f] ?? 0)
          return (
            <button
              key={f}
              type="button"
              aria-pressed={on}
              onClick={() => setFilter(f)}
              className={cn(
                'inline-flex min-h-10 items-center gap-1 rounded-full px-3.5 text-[13px] font-bold lg:min-h-8',
                on ? 'bg-teal-700 text-white' : 'bg-white text-slate-700 ring-1 ring-slate-300 hover:bg-slate-50',
              )}
            >
              {f === 'all' ? 'すべて' : INQUIRY_STATUS_LABELS[f]}
              <span className="tabular-nums">{count}</span>
            </button>
          )
        })}
      </div>

      <Panel title="一覧" icon={Inbox} meta="新しい順">
        {loading && rows.length === 0 ? (
          <p className="text-sm text-slate-500">読み込んでいます…</p>
        ) : shown.length === 0 ? (
          <p className="text-sm text-slate-600">この状態の問い合わせはありません。</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {shown.map((r) => (
              <li key={r.userId} className="py-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-1.5">
                      <span className="break-keep text-base font-bold text-slate-900 [overflow-wrap:anywhere]">{r.displayName}</span>
                      <Badge variant={STATUS_BADGE[r.status]}>{INQUIRY_STATUS_LABELS[r.status]}</Badge>
                      {r.simulated && <Badge variant="outline">テスト</Badge>}
                      {r.blocked && <Badge variant="danger">ブロック</Badge>}
                      {r.optedOut && <Badge variant="secondary">配信停止</Badge>}
                      {r.handoff && <Badge variant="purple">スタッフ対応中</Badge>}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-600">
                      {[r.intent, r.bodyPart, r.timing].filter(Boolean).join('・') || '相談の入口：選択なし'}
                      <span className="ml-2 text-slate-500">{when(r.lastAt)}</span>
                    </p>
                    {r.needsAttention && <p className="mt-1 text-sm font-bold text-amber-800">要対応：{r.needsAttention}</p>}
                    {r.lastText && <p className="mt-1 text-sm text-slate-700">「{r.lastText}」</p>}
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    <label className="flex items-center gap-1.5 text-xs font-bold text-slate-600 max-lg:min-h-10">
                      状態
                      <select
                        value={r.status}
                        disabled={saving === r.userId}
                        onChange={(e) => void changeStatus(r.userId, e.target.value as InquiryStatus)}
                        className="h-10 rounded-lg border border-slate-300 bg-white px-2 text-sm font-medium text-slate-800 lg:h-8"
                      >
                        {STATUS_ORDER.map((s) => (
                          <option key={s} value={s}>
                            {INQUIRY_STATUS_LABELS[s]}
                          </option>
                        ))}
                      </select>
                    </label>
                    <Link
                      href={`/marketing/line?user=${encodeURIComponent(r.userId)}`}
                      className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}
                    >
                      会話を見る
                    </Link>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <p className="text-xs leading-relaxed text-slate-500">
        「完了」にすると要対応の印が外れ、その方への自動の案内が最初から動きます。新しくスタッフの対応が要る相談が届くと「未対応」に戻ります。
        AI や自動の案内が病名を決めたり、通院の要否を決めたりすることはありません。
      </p>
    </div>
  )
}
