'use client'
/**
 * 再評価の時期の小さなマーク（患者さん一覧・カルテの上）
 * 「評価まもなく」（予定日の3日前〜前日）・「要再評価」（当日）・「評価期限超過」（過ぎた）。予定日の4日以上前と予定なしは出さない。
 * 赤は使わない（赤は医学的な危険の知らせ＝レッドフラッグ・受診のすすめの色。これは「評価の時期」の目安だけ）。
 * 押すと、そのカルテの「評価・測定」の再評価の欄を開く。
 */
import { CalendarClock, ClipboardCheck } from 'lucide-react'
import { cn } from '@/lib/utils'
import { daysLeftText, reevalMarkLabel, shortDate, type ReevalStatus } from '@/lib/reeval/schedule'

const TONE: Record<'soon' | 'due' | 'overdue', string> = {
  soon: 'border-sky-200 bg-sky-50 text-sky-800 hover:bg-sky-100',
  due: 'border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100',
  overdue: 'border-amber-400 bg-amber-100 text-amber-950 hover:bg-amber-200',
}

export default function ReevalMark({
  status,
  onClick,
  today,
  className,
}: {
  status: ReevalStatus
  onClick?: () => void
  today?: string
  className?: string
}) {
  const label = reevalMarkLabel(status.state)
  if (!label || status.state === 'none' || status.state === 'scheduled') return null
  const tone = TONE[status.state]
  const Icon = status.state === 'soon' ? CalendarClock : ClipboardCheck
  const title = `再評価の予定日 ${status.dueDate ? shortDate(status.dueDate, today) : ''}（${daysLeftText(status.daysLeft)}）${onClick ? '。押すと評価の画面を開きます' : ''}`
  const inner = (
    <>
      <Icon className="h-3 w-3" aria-hidden />
      {label}
    </>
  )
  const cls = cn('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-bold', tone, className)
  if (!onClick) {
    return (
      <span className={cls} title={title}>
        {inner}
      </span>
    )
  }
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
      onKeyDown={(e) => e.stopPropagation()}
      className={cn(cls, 'transition-colors max-lg:min-h-10')}
    >
      {inner}
    </button>
  )
}
