import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'
import { type HTMLAttributes } from 'react'

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors',
  {
    variants: {
      variant: {
        default:     'border-transparent bg-teal-600 text-white',
        secondary:   'border-transparent bg-gray-100 text-gray-700',
        destructive: 'border-transparent bg-red-500 text-white',
        outline:     'border-gray-200 text-gray-700 bg-transparent',
        success:     'border-transparent bg-green-100 text-green-800',
        warning:     'border-transparent bg-yellow-100 text-yellow-800',
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
