import type { Metadata, Viewport } from 'next'
import type { ReactNode } from 'react'
import { PwaRegister } from './PwaRegister'

// 集客・経営の画面（/marketing 以下）。メニューと枠は院内アプリ共通（(app)/layout → AppShell）。
// /marketing をホーム画面に置いたPWAは、そのまま使えるように残す。
export const metadata: Metadata = {
  title: 'ゆうき整骨院 院内アプリ',
  manifest: '/marketing-app.webmanifest',
  appleWebApp: { capable: true, title: 'ゆうき院内', statusBarStyle: 'default' },
  icons: {
    icon: '/icons/icon-192.png',
    apple: '/icons/apple-touch-icon.png',
  },
}

export const viewport: Viewport = {
  themeColor: '#13253d',
}

export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <PwaRegister />
      {children}
    </>
  )
}
