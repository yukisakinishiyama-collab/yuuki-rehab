/**
 * 見出しつきのカード（Panel）と「〜を見る」リンク（MoreLink）
 *
 * 今日の画面のカード（今日の予約・キャンセルのカルテ反映・カルテ・昨日の締め）は、すべてこれを使う。
 * 見出しの大きさ・余白・見出しの右のボタンの置き方をそろえるため。
 * 枠の見た目（角丸・線・影）は ui/card の cardSurface と同じ。変えるときは ui/card.tsx を直す。
 */
import Link from 'next/link'
import type { ReactNode } from 'react'
import { ChevronRight, type LucideIcon } from 'lucide-react'
import { cardSurface } from '@/components/ui/card'
import { cn } from '@/lib/utils'

export function Panel({
  title,
  icon: Icon,
  meta,
  action,
  attention = false,
  className,
  children,
}: {
  title: ReactNode
  /** 見出しの左のアイコン（lucide-react） */
  icon?: LucideIcon
  /** 見出しの横の小さな補足（「更新 10:32」など） */
  meta?: ReactNode
  /** 見出しの右に置くボタンやリンク（幅が足りないスマホでは、見出しの下の行の右に回る） */
  action?: ReactNode
  /** 確認が必要なものがあるとき（枠を黄色にして目立たせる） */
  attention?: boolean
  className?: string
  children: ReactNode
}) {
  return (
    <section className={cn(cardSurface, 'min-w-0 p-4 sm:p-5', attention && 'border-amber-300 ring-1 ring-amber-200', className)}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
          {Icon && <Icon className="h-5 w-5 shrink-0 text-teal-700" aria-hidden />}
          <h2 className="text-base font-bold text-slate-900">{title}</h2>
          {meta && <span className="text-xs text-slate-500">{meta}</span>}
        </div>
        {/* ml-auto：幅が足りずに見出しの下の行へ回ったときも、右にそろえる（スマホでは見出しの下の行の右になる） */}
        {action && <div className="ml-auto flex shrink-0 items-center gap-1.5">{action}</div>}
      </div>
      {children}
    </section>
  )
}

/** カードの右上などに置く「〜を見る」リンク。下のタブが出る幅（1024px未満）では指で押しやすい高さにする */
export function MoreLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex min-h-11 items-center gap-0.5 rounded-lg px-2 text-sm font-bold text-teal-800 hover:bg-teal-50 lg:min-h-8"
    >
      {children}
      <ChevronRight className="h-4 w-4" aria-hidden />
    </Link>
  )
}

/** 丸いアイコンだけのボタン（読み直しなど）。見えない文字（label）を必ず付ける */
export function IconButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string
  onClick: () => void
  disabled?: boolean
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className="flex h-11 w-11 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-50 lg:h-8 lg:w-8"
    >
      {children}
    </button>
  )
}
