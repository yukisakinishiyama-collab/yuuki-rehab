'use client'

/** ダッシュボード：投稿状況の俯瞰と次のアクション */
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { loadProjects } from '@/lib/marketing/store'
import { CHANNEL_LABELS, STATUS_LABELS, type ContentProject, type PostStatus } from '@/lib/marketing/types'

export default function MarketingDashboard() {
  const [projects, setProjects] = useState<ContentProject[]>([])
  useEffect(() => setProjects(loadProjects()), [])

  const variants = projects.flatMap((p) => p.variants.map((v) => ({ project: p, variant: v })))
  const countBy = (status: PostStatus) => variants.filter((x) => x.variant.status === status).length
  const blocked = variants.filter((x) => x.variant.compliance.status === 'blocked' && !x.variant.compliance.overrideReason)
  const upcoming = variants
    .filter((x) => x.variant.status === 'scheduled' && x.variant.scheduledAt)
    .sort((a, b) => (a.variant.scheduledAt ?? '').localeCompare(b.variant.scheduledAt ?? ''))
    .slice(0, 5)

  const cards: Array<{ status: PostStatus; tone: string }> = [
    { status: 'draft', tone: 'bg-slate-100 text-slate-700' },
    { status: 'review', tone: 'bg-amber-100 text-amber-800' },
    { status: 'approved', tone: 'bg-blue-100 text-blue-800' },
    { status: 'scheduled', tone: 'bg-teal-100 text-teal-800' },
    { status: 'published', tone: 'bg-emerald-100 text-emerald-800' },
    { status: 'failed', tone: 'bg-red-100 text-red-800' },
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">ダッシュボード</h1>
        <Link
          href="/marketing/compose"
          className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-bold text-white hover:bg-teal-800"
        >
          ＋ 投稿を作る
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {cards.map(({ status, tone }) => (
          <div key={status} className={`rounded-xl p-4 ${tone}`}>
            <p className="text-xs font-bold">{STATUS_LABELS[status]}</p>
            <p className="mt-1 text-2xl font-black">{countBy(status)}</p>
          </div>
        ))}
      </div>

      {blocked.length > 0 && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4">
          <p className="font-bold text-red-800">⚠ 公開禁止の表現が {blocked.length} 件あります</p>
          <p className="mt-1 text-sm text-red-700">
            投稿カレンダーから該当の投稿を開き、表現を修正するか理由を入力して解除してください。
          </p>
        </div>
      )}

      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="font-bold">公開予定</h2>
        {upcoming.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">予約済みの投稿はありません。</p>
        ) : (
          <ul className="mt-2 divide-y divide-slate-100 text-sm">
            {upcoming.map(({ project, variant }) => (
              <li key={variant.id} className="flex flex-wrap items-center gap-2 py-2">
                <span className="font-mono text-teal-800">{variant.scheduledAt?.replace('T', ' ')}</span>
                <span className="rounded bg-slate-100 px-2 py-0.5 text-xs">{CHANNEL_LABELS[variant.channel]}</span>
                <span className="truncate">{project.theme}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="font-bold">最近のプロジェクト</h2>
        {projects.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">
            まだ投稿がありません。「投稿を作る」から最初のコンテンツを生成してください。
          </p>
        ) : (
          <ul className="mt-2 divide-y divide-slate-100 text-sm">
            {projects.slice(0, 8).map((p) => (
              <li key={p.id} className="flex flex-wrap items-center gap-2 py-2">
                <span className="text-slate-400">{p.createdAt.slice(0, 10)}</span>
                <span className="rounded bg-teal-50 px-2 py-0.5 text-xs text-teal-800">{p.objective}</span>
                <Link href={`/marketing/compose?project=${p.id}`} className="font-medium text-slate-800 hover:underline">
                  {p.theme}
                </Link>
                <span className="text-xs text-slate-400">{p.variants.length}媒体</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
