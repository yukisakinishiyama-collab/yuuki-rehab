import Link from 'next/link'
import { cookies } from 'next/headers'
import type { Metadata, Viewport } from 'next'
import type { ReactNode } from 'react'
import { PwaRegister } from './PwaRegister'
import { ROLE_COOKIE } from '@/lib/marketing/auth-shared'

// マーケハブを独立PWAとして設定（/marketing 起点・ネイビーテーマ）
export const metadata: Metadata = {
  title: 'ゆうき整骨院 マーケティングハブ',
  manifest: '/marketing-app.webmanifest',
  appleWebApp: { capable: true, title: 'ゆうきマーケ', statusBarStyle: 'default' },
  icons: {
    icon: '/icons/icon-192.png',
    apple: '/icons/apple-touch-icon.png',
  },
}

export const viewport: Viewport = {
  themeColor: '#16233d',
}

const NAV = [
  { href: '/marketing', label: 'ダッシュボード' },
  { href: '/marketing/compose', label: '投稿を作る' },
  { href: '/marketing/videos', label: '動画ストック' },
  { href: '/marketing/calendar', label: '投稿カレンダー' },
  { href: '/marketing/line', label: 'LINE導線' },
  { href: '/marketing/jobs', label: '投稿ジョブ' },
  { href: '/marketing/analytics', label: '効果測定' },
  { href: '/marketing/references', label: '論文・根拠' },
  { href: '/marketing/reviews', label: '口コミ返信' },
  { href: '/marketing/settings', label: '基本設定' },
]

export default async function MarketingLayout({ children }: { children: ReactNode }) {
  // proxy が発行する役割Cookie。本番（認証有効）でのみ存在する
  const roleCookie = (await cookies()).get(ROLE_COOKIE)?.value
  const roleBadge =
    roleCookie === 'staff'
      ? { label: 'スタッフ（編集）', tone: 'bg-slate-100 text-slate-600' }
      : roleCookie === 'admin'
        ? { label: '院長（管理者）', tone: 'bg-teal-100 text-teal-800' }
        : null

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <PwaRegister />
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <Link href="/marketing" className="text-lg font-bold text-slate-900">
            ゆうき整骨院 <span className="text-teal-700">マーケティングハブ</span>
          </Link>
          {roleBadge && (
            <span className={`rounded-full px-3 py-1 text-xs font-bold ${roleBadge.tone}`}>{roleBadge.label}</span>
          )}
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
