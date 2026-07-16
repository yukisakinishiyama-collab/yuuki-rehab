import Link from 'next/link'
import type { ReactNode } from 'react'

export const metadata = { title: 'ゆうき整骨院 マーケティングハブ' }

const NAV = [
  { href: '/marketing', label: 'ダッシュボード' },
  { href: '/marketing/compose', label: '投稿を作る' },
  { href: '/marketing/calendar', label: '投稿カレンダー' },
  { href: '/marketing/line', label: 'LINE導線' },
  { href: '/marketing/settings', label: '基本設定' },
]

export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <Link href="/marketing" className="text-lg font-bold text-slate-900">
            ゆうき整骨院 <span className="text-teal-700">マーケティングハブ</span>
          </Link>
          <nav className="flex flex-wrap gap-1 text-sm font-medium">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-lg px-3 py-1.5 text-slate-600 hover:bg-teal-50 hover:text-teal-800"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  )
}
