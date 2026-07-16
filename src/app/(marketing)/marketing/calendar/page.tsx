'use client'

/** 投稿カレンダー：状態別ボード＋日付順リスト */
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { loadProjects } from '@/lib/marketing/store'
import { CHANNEL_LABELS, STATUS_LABELS, type ContentProject, type ContentVariant, type PostStatus } from '@/lib/marketing/types'

type Row = { project: ContentProject; variant: ContentVariant }

const FILTERS: Array<PostStatus | 'all'> = ['all', 'draft', 'review', 'approved', 'scheduled', 'published', 'failed', 'cancelled']

export default function CalendarPage() {
  const [rows, setRows] = useState<Row[]>([])
  const [filter, setFilter] = useState<PostStatus | 'all'>('all')

  useEffect(() => {
    setRows(loadProjects().flatMap((project) => project.variants.map((variant) => ({ project, variant }))))
  }, [])

  const filtered = rows
    .filter((r) => filter === 'all' || r.variant.status === filter)
    .sort((a, b) =>
      (a.variant.scheduledAt ?? a.project.createdAt).localeCompare(b.variant.scheduledAt ?? b.project.createdAt),
    )

  // 日付ごとにグループ化（予約日時がなければ作成日）
  const groups = new Map<string, Row[]>()
  filtered.forEach((row) => {
    const date = (row.variant.scheduledAt ?? row.project.createdAt).slice(0, 10)
    if (!groups.has(date)) groups.set(date, [])
    groups.get(date)!.push(row)
  })

  const statusTone: Record<PostStatus, string> = {
    draft: 'bg-slate-100 text-slate-700',
    review: 'bg-amber-100 text-amber-800',
    approved: 'bg-blue-100 text-blue-800',
    scheduled: 'bg-teal-100 text-teal-800',
    published: 'bg-emerald-100 text-emerald-800',
    failed: 'bg-red-100 text-red-800',
    cancelled: 'bg-slate-200 text-slate-500',
  }

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold">投稿カレンダー</h1>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`rounded-full border px-3 py-1.5 text-sm font-medium ${
              filter === f ? 'border-teal-700 bg-teal-50 text-teal-800' : 'border-slate-300 bg-white text-slate-600'
            }`}
          >
            {f === 'all' ? 'すべて' : STATUS_LABELS[f]}
          </button>
        ))}
      </div>

      {groups.size === 0 ? (
        <p className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
          該当する投稿がありません。
        </p>
      ) : (
        Array.from(groups.entries()).map(([date, dateRows]) => (
          <section key={date} className="rounded-xl border border-slate-200 bg-white p-4">
            <h2 className="font-bold text-teal-900">{date}</h2>
            <ul className="mt-2 divide-y divide-slate-100">
              {dateRows.map(({ project, variant }) => (
                <li key={variant.id} className="flex flex-wrap items-center gap-2 py-2 text-sm">
                  {variant.scheduledAt && (
                    <span className="font-mono text-xs text-slate-500">{variant.scheduledAt.slice(11, 16)}</span>
                  )}
                  <span className={`rounded px-2 py-0.5 text-xs font-bold ${statusTone[variant.status]}`}>
                    {STATUS_LABELS[variant.status]}
                  </span>
                  <span className="rounded bg-slate-100 px-2 py-0.5 text-xs">{CHANNEL_LABELS[variant.channel]}</span>
                  <Link
                    href={`/marketing/compose?project=${project.id}`}
                    className="font-medium text-slate-800 hover:underline"
                  >
                    {project.theme}
                  </Link>
                  {variant.compliance.status === 'blocked' && !variant.compliance.overrideReason && (
                    <span className="text-xs font-bold text-red-600">⚠ 公開禁止</span>
                  )}
                  {variant.publishedUrl && (
                    <a href={variant.publishedUrl} target="_blank" rel="noopener" className="text-xs text-sky-700 underline">
                      公開先
                    </a>
                  )}
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  )
}
