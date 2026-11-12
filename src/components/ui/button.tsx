import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'
import { forwardRef, type ButtonHTMLAttributes } from 'react'

/**
 * 院内アプリのボタン
 *
 * 色の決まり（DESIGN_DECISIONS.md「院内アプリの見た目の決まり」）
 * - 白い文字をのせる色は、文字が読める濃さ（コントラスト比 4.5 以上）にする。
 *   teal-600・green-600・red-500・amber-500 の上の白い文字は薄くて読みにくいので使わない
 * - いちばん大事な操作（保存・登録など）は default（teal-700）。1つの画面に多く並べない
 * 大きさ（size）は PC（幅1024px以上）では今までと同じ。下のタブが出る幅（1024px未満。スマホ・スマホの横向き・iPad の縦向き）では、
 * 小さいボタン（sm・icon-sm）も指で押せる 40px にする（切り替えの幅は、共通の枠 ClinicShell と同じ lg）。
 * 置き場所ごとの調整は className で上書きする（tailwind-merge で後勝ち）
 */
const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default:     'bg-teal-700 text-white hover:bg-teal-800',
        destructive: 'bg-red-600 text-white hover:bg-red-700',
        outline:     'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900',
        secondary:   'bg-slate-100 text-slate-900 hover:bg-slate-200',
        ghost:       'text-slate-700 hover:bg-slate-100 hover:text-slate-900',
        link:        'text-teal-700 underline-offset-4 hover:underline p-0 h-auto',
        success:     'bg-green-700 text-white hover:bg-green-800',
        warning:     'bg-amber-400 text-amber-950 hover:bg-amber-500',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm:      'h-10 rounded-md px-3 text-sm lg:h-8 lg:text-xs',
        lg:      'h-11 rounded-md px-8 text-base',
        icon:    'h-10 w-10',
        'icon-sm': 'h-10 w-10 lg:h-8 lg:w-8',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
)

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
)
Button.displayName = 'Button'

export { buttonVariants }
