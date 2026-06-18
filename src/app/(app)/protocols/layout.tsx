'use client'

import { usePathname } from 'next/navigation'
import ProtocolSidebar from '@/components/protocol/ProtocolSidebar'

export default function ProtocolsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  /* プレゼンテーション・モードはサイドバーなしのフルスクリーン */
  if (pathname.includes('/patient-view')) {
    return <>{children}</>
  }

  return (
    /*
     * -m-4 md:-m-6 で AppShell の p-4/p-6 を打ち消してエッジまで広げる。
     * h-[calc(100svh-56px)] md:h-screen:
     *   モバイル: ヘッダー高さ（56px）を引いたビューポート高さ
     *   デスクトップ: ビューポート全高（ナビサイドバーは fixed なのでコンテンツ最上部が 0）
     */
    <div className="flex -m-4 md:-m-6 overflow-hidden
      h-[calc(100svh-56px)] md:h-screen">

      {/* 左ペイン: 症例サイドバー（デスクトップのみ） */}
      <ProtocolSidebar />

      {/* 右ペイン: 各ページコンテンツ */}
      <div className="flex-1 overflow-y-auto min-w-0
        p-4 md:p-6 bg-[--color-surface]">
        {children}
      </div>
    </div>
  )
}
