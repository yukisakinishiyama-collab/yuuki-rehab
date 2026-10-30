import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'
import { type HTMLAttributes } from 'react'

// 小さな札。文字は 12px（text-xs）より小さくしない。白い文字をのせる色は濃いめ（button.tsx と同じ決まり）
const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors',
  {
    variants: {
      variant: {
        default:     'border-transparent bg-teal-700 text-white',
        secondary:   'border-transparent bg-slate-100 text-slate-700',
        destructive: 'border-transparent bg-red-600 text-white',
        outline:     'border-slate-300 text-slate-700 bg-transparent',
        success:     'border-transparent bg-green-100 text-green-800',
        warning:     'border-transparent bg-amber-100 text-amber-900',
        danger:      'border-transparent bg-red-100 text-red-800',
        teal:        'border-transparent bg-teal-100 text-teal-800',
        blue:        'border-transparent bg-blue-100 text-blue-800',
        purple:      'border-transparent bg-purple-100 text-purple-800',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
)

export interface BadgeProps
  extends HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { badgeVariants }
