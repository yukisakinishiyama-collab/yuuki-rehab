'use client'

/**
 * 集客 → コンテンツ（指示書6章③）
 *
 * Instagram・Google・ホームページの案を「下書き・確認待ち・承認済み・公開済み」で1つの一覧に。
 * - サーバーにあるもの：自動投稿の案・投稿ジョブ（/api/marketing/content）
 * - この端末にあるもの：「投稿を作る」の下書き（ブラウザに保存。ジョブになったものは重ねて出さない）
 * 作る・直す・承認するのは、下の「作る・管理する」の各画面（今までの画面をそのまま使う）。
 */
import Link from 'next/link'
import { useMemo, useState } from 'react'
import { FileText, RefreshCw, Wrench } from 'lucide-react'
import { IconButton, Panel } from '@/components/clinic/Panel'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { useApi } from '@/lib/marketing/use-api'
import { loadProjects } from '@/lib/marketing/store'
import { CHANNEL_LABELS } from '@/lib/marketing/types'
import {
  CONTENT_MEDIUM_LABELS,
  CONTENT_STAGE_LABELS,
  mediumOf,
  stageOfPost,
  toJstLocal,
  type ContentItem,
  type ContentMedium,
  type ContentStage,
} from '@/lib/marketing/content-types'

const STAGES: ContentStage[] = ['draft', 'review', 'approved', 'published']
const MEDIA: Array<ContentMedium | 'all'> = ['all', 'instagram', 'google', 'homepage']
const STAGE_BADGE: Record<ContentStage, 'secondary' | 'warning' | 'blue' | 'success'> = {
  draft: 'secondary',
  review: 'warning',
  approved: 'blue',
  published: 'success',
}

const TOOLS: Array<{ href: string; label: string; note: string }> = [
  { href: '/marketing/autopilot', label: '自動投稿', note: 'AI が週の案を作り、院長が承認した分だけ予定の時刻に出す' },
  { href: '/marketing/compose', label: '投稿を作る', note: 'テーマから Instagram・Google の文を作る（表現チェックつき）' },
  { href: '/marketing/calendar', label: '投稿カレンダー', note: '予定の並びを月で見る' },
  { href: '/marketing/jobs', label: '投稿の予定と結果', note: '予約投稿・手動対応待ち・失敗の確認、Instagram／Google とつなぐ' },
  { href: '/marketing/tools', label: 'リンク・QR・ストーリー', note: '計測つきのリンクと QR、空き状況のストーリー' },
  { href: '/marketing/reviews', label: '口コミ返信', note: 'Google の口コミへの返信案（特典で口コミを頼まない）' },
  { href: '/marketing/videos', label: '動画ストック', note: 'リールに使う動画の保管と検索' },
  { href: '/marketing/references', label: '論文・根拠', note: '投稿の医学的な根拠の控え' },
]

function whenLabel(local?: string): string {
  if (!local) return ''
  const [d, t] = local.split('T')
  const [, m, day] = d.split('-').map(Number)
  return `${m}/${day} ${t ?? ''}`.trim()
}

/** この端末の「投稿を作る」の下書き（ジョブになったものは除く） */
function localItems(jobVariantIds: Set<string>): ContentItem[] {
  return loadProjects().flatMap((project) =>
    project.variants.flatMap((variant): ContentItem[] => {
      const stage = stageOfPost(variant.status)
      if (!stage || jobVariantIds.has(variant.id)) return []
      const blocked = variant.compliance.status === 'blocked' && !variant.compliance.overrideReason
      return [
        {
          id: `local:${variant.id}`,
          origin: 'compose',
          medium: mediumOf(variant.channel),
          channelLabel: CHANNEL_LABELS[variant.channel],
          theme: project.theme,
          stage,
          flag: blocked
            ? { label: 'NG表現あり', tone: 'red' }
            : variant.status === 'failed'
              ? { label: '公開に失敗しました', tone: 'red' }
              : undefined,
          when: toJstLocal(variant.publishedAt ?? variant.scheduledAt ?? project.updatedAt),
          href: `/marketing/compose?project=${project.id}`,
        },
      ]
    }),
  )
}

/** サーバーの一覧（自動投稿の案・投稿ジョブ）に、この端末の下書きを足す。予約した下書きはジョブの側だけ出す（2回数えない） */
function pickContent(json: { items?: ContentItem[] }): ContentItem[] | undefined {
  if (!json.items) return undefined
  const jobVariantIds = new Set(json.items.map((i) => i.variantId).filter((v): v is string => Boolean(v)))
  return [...json.items, ...localItems(jobVariantIds)].sort((a, b) => (b.when ?? '').localeCompare(a.when ?? ''))
}

export default function ContentPage() {
  const { data, error, loading, reload } = useApi('/api/marketing/content', pickContent)
  const items = useMemo(() => data ?? [], [data])
  const [stage, setStage] = useState<ContentStage>('review')
  const [medium, setMedium] = useState<ContentMedium | 'all'>('all')

  const counts = useMemo(() => {
    const inMedium = items.filter((i) => medium === 'all' || i.medium === medium)
    return Object.fromEntries(STAGES.map((s) => [s, inMedium.filter((i) => i.stage === s).length])) as Record<ContentStage, number>
  }, [items, medium])
  const shown = items.filter((i) => i.stage === stage && (medium === 'all' || i.medium === medium))

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="sr-only text-2xl font-bold lg:not-sr-only">コンテンツ</h1>
          <p className="text-sm text-slate-600">
            どの案も、表現チェック（医療広告のガイドライン）を通し、院長が承認するまで公開されません。
          </p>
        </div>
        <IconButton label="読み直す" onClick={reload} disabled={loading}>
          <RefreshCw className={cn('h-5 w-5', loading && 'animate-spin')} aria-hidden />
        </IconButton>
      </div>

      {error && (
        <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-800">
          {error}
        </p>
      )}

      <div className="space-y-2">
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="状態で絞る">
          {STAGES.map((s) => (
            <button
              key={s}
              type="button"
              aria-pressed={stage === s}
              onClick={() => setStage(s)}
              className={cn(
                'inline-flex min-h-10 items-center gap-1 rounded-full px-3.5 text-[13px] font-bold lg:min-h-8',
                stage === s ? 'bg-teal-700 text-white' : 'bg-white text-slate-700 ring-1 ring-slate-300 hover:bg-slate-50',
              )}
            >
              {CONTENT_STAGE_LABELS[s]}
              <span className="tabular-nums">{counts[s]}</span>
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="媒体で絞る">
          {MEDIA.map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={medium === m}
              onClick={() => setMedium(m)}
              className={cn(
                'inline-flex min-h-10 items-center rounded-full px-3 text-xs font-bold lg:min-h-8',
                medium === m ? 'bg-teal-50 text-teal-800 ring-1 ring-teal-700' : 'bg-slate-100 text-slate-700 hover:bg-slate-200',
              )}
            >
              {m === 'all' ? 'すべての媒体' : CONTENT_MEDIUM_LABELS[m]}
            </button>
          ))}
        </div>
      </div>

      <Panel title={CONTENT_STAGE_LABELS[stage]} icon={FileText} meta="新しい順">
        {loading && items.length === 0 ? (
          <p className="text-sm text-slate-500">読み込んでいます…</p>
        ) : shown.length === 0 ? (
          <p className="text-sm text-slate-600">
            {medium === 'homepage'
              ? 'ホームページの記事案はまだありません（第3段階で、重点テーマの記事案と検索キーワードからの改善案を作ります。同じ内容のページを量産することはしません）。'
              : 'この状態のものはありません。'}
          </p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {shown.map((i) => (
              <li key={i.id}>
                <Link href={i.href} className="flex min-h-11 flex-wrap items-center gap-x-2 gap-y-1 py-2.5 hover:bg-slate-50">
                  <Badge variant={STAGE_BADGE[i.stage]}>{CONTENT_STAGE_LABELS[i.stage]}</Badge>
                  <span className="text-xs font-bold text-slate-600">{i.channelLabel}</span>
                  {i.when && <span className="text-xs tabular-nums text-slate-500">{whenLabel(i.when)}</span>}
                  {i.origin === 'compose' && <span className="text-xs text-slate-500">この端末の下書き</span>}
                  <span className="w-full min-w-0 text-sm font-medium text-slate-800 sm:w-auto sm:flex-1">{i.theme}</span>
                  {i.flag && (
                    <span className={cn('text-xs font-bold', i.flag.tone === 'red' ? 'text-red-700' : 'text-amber-800')}>{i.flag.label}</span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel title="作る・管理する" icon={Wrench}>
        <ul className="grid gap-2 sm:grid-cols-2">
          {TOOLS.map((t) => (
            <li key={t.href}>
              <Link href={t.href} className="block min-h-11 rounded-lg border border-slate-200 p-3 hover:bg-slate-50">
                <span className="block text-sm font-bold text-teal-800">{t.label}</span>
                <span className="block text-xs text-slate-600">{t.note}</span>
              </Link>
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  )
}
