import { cn } from '@/lib/utils'
import { forwardRef, type InputHTMLAttributes } from 'react'

export type InputProps = InputHTMLAttributes<HTMLInputElement>

/**
 * 入力欄。ふだんは 14px（text-sm）。
 * 下のタブが出る幅（1024px未満）と指で操作する端末では、院内アプリの入力欄はすべて 16px になる
 * （src/app/globals.css の「院内アプリの入力欄」。iPhone は 16px より小さい入力欄を押すと画面を勝手に拡大するため）。
 * ここで max-sm:text-base などを書く必要はない。
 */
export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => (
    <input
      type={type}
      ref={ref}
      className={cn(
        'flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm',
        'placeholder:text-slate-500',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 focus-visible:ring-offset-1',
        'disabled:cursor-not-allowed disabled:opacity-50',
        'file:border-0 file:bg-transparent file:text-sm file:font-medium',
        className
      )}
      {...props}
    />
  )
)
Input.displayName = 'Input'
