'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard,
  FolderOpen,
  LogOut,
  Menu,
  X,
  Smartphone,
  Activity,
  Ruler,
  ClipboardList,
  Users,
  BookOpen,
  CloudUpload,
} from 'lucide-react'
import AuthGuard from './AuthGuard'
import { logout } from '@/lib/rehab-store'
import { ROLE_LABELS } from '@/types/rehab'
import type { User as UserType } from '@/types/rehab'
import QRLoginModal from './QRLoginModal'

/* ── ナビゲーション定義（セクション分け） ── */
const NAV_SECTIONS = [
  {
    section: 'WORKSPACE',
    items: [
      { href: '/dashboard', label: 'ダッシュボード', icon: LayoutDashboard },
      { href: '/cases',     label: '案件管理',       icon: FolderOpen },
    ],
  },
  {
    section: 'PATIENT MGMT',
    items: [
      { href: '/patients/dashboard', label: 'リハビリ状況',   icon: LayoutDashboard },
      { href: '/patients',           label: '患者管理',       icon: Users },
    ],
  },
  {
    section: 'CLINICAL',
    items: [
      { href: '/protocols',  label: 'プロトコル立案', icon: ClipboardList },
      { href: '/literature', label: '文献ライブラリ', icon: BookOpen },
      { href: '/rom',        label: '可動域ノート',   icon: Activity },
    ],
  },
  {
    section: 'MEASURE',
    items: [
      { href: '/gonio',   label: '関節角度計',      icon: Ruler },
    ],
  },
]

/* ── ロゴ ── */
function Logo() {
  return (
    <div className="flex items-center gap-2.5">
      {/* シンプルな十字マーク */}
      <div className="w-7 h-7 flex items-center justify-center flex-shrink-0">
        <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
          <rect width="28" height="28" rx="7" fill="#0d9488" fillOpacity="0.15"/>
          <path d="M14 6v16M6 14h16" stroke="#0d9488" strokeWidth="2" strokeLinecap="round"/>
        </svg>
      </div>
      <div>
        <div className="text-white font-bold text-[13px] tracking-[0.12em] leading-none">YUUKI</div>
        <div className="text-white/30 text-[9px] tracking-[0.18em] mt-0.5">REHAB SYSTEM</div>
      </div>
    </div>
  )
}

/* ── サイドバー本体 ── */
function SidebarContent({
  user,
  onLogout,
  pathname,
  onOpenQR,
  onPushSync,
  syncing,
}: {
  user: UserType
  onLogout: () => void
  pathname: string
  onOpenQR: () => void
  onPushSync: () => void
  syncing: boolean
}) {
  return (
    <div className="flex flex-col h-full">

      {/* ロゴ */}
      <div className="px-5 pt-6 pb-5">
        <Logo />
      </div>

      {/* ナビ */}
      <nav className="flex-1 px-3 overflow-y-auto">
        {NAV_SECTIONS.map(({ section, items }) => (
          <div key={section} className="mb-5">
            {/* セクションラベル */}
            <div className="px-3 mb-1.5 text-[9px] font-bold tracking-[0.2em] text-white/20 select-none">
              {section}
            </div>
            {items.map(({ href, label, icon: Icon }) => {
              const active = pathname === href || pathname.startsWith(href + '/')
              return (
                <Link
                  key={href}
                  href={href}
                  className={`group relative flex items-center gap-3 px-3 py-2 text-[13px]
                    transition-all duration-150 rounded-md
                    ${active
                      ? 'text-white'
                      : 'text-white/35 hover:text-white/75'
                    }`}
                >
                  {/* アクティブ時の左ボーダー */}
                  {active && (
                    <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5
                      bg-[#0d9488] rounded-full shadow-[0_0_8px_#0d9488aa]" />
                  )}
                  <Icon className={`w-[15px] h-[15px] flex-shrink-0 transition-colors ${
                    active ? 'text-[#0d9488]' : 'text-white/25 group-hover:text-white/50'
                  }`} />
                  <span className={`font-medium leading-none ${active ? 'font-semibold' : ''}`}>
                    {label}
                  </span>
                  {/* アクティブドット */}
                  {active && (
                    <span className="ml-auto w-1 h-1 rounded-full bg-[#0d9488]
                      shadow-[0_0_6px_#0d9488]" />
                  )}
                </Link>
              )
            })}
          </div>
        ))}
      </nav>

      {/* ユーザー + ボトムアクション */}
      <div className="px-3 pb-4 pt-3 border-t border-white/[0.06]">
        {/* ユーザー行 */}
        <div className="flex items-center gap-2.5 px-3 py-2.5 mb-1">
          {/* イニシャルアバター */}
          <div className="w-6 h-6 rounded-md bg-[#0d9488]/20 flex items-center justify-center
            flex-shrink-0 ring-1 ring-[#0d9488]/30 text-[10px] font-bold text-[#0d9488] select-none">
            {user.name.slice(0, 1)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-white/80 text-[12px] font-medium truncate leading-none">
              {user.name}
            </div>
            <div className="text-white/25 text-[9px] tracking-wider mt-0.5">
              {ROLE_LABELS[user.role]}
            </div>
          </div>
        </div>

        {/* サブアクション */}
        <button
          onClick={onPushSync}
          disabled={syncing}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-md
            text-[12px] text-white/25 hover:text-white/60 transition-colors disabled:opacity-40"
        >
          <CloudUpload className="w-3.5 h-3.5 flex-shrink-0" />
          {syncing ? '同期中...' : 'クラウドに同期'}
        </button>
        <button
          onClick={onOpenQR}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-md
            text-[12px] text-white/25 hover:text-white/60 transition-colors"
        >
          <Smartphone className="w-3.5 h-3.5 flex-shrink-0" />
          スマートフォンでアクセス
        </button>
        <button
          onClick={onLogout}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-md
            text-[12px] text-white/25 hover:text-red-400/70 transition-colors"
        >
          <LogOut className="w-3.5 h-3.5 flex-shrink-0" />
          ログアウト
        </button>
      </div>
    </div>
  )
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [showQR, setShowQR] = useState(false)
  const [syncing, setSyncing] = useState(false)

  // 起動時にクラウドからデータを取得し、差分があればリロード
  useEffect(() => {
    import('@/lib/sync-service').then(async ({ pullFromCloud, isSyncEnabled }) => {
      if (!isSyncEnabled()) return
      setSyncing(true)
      const before = localStorage.getItem('pt_patients')
      const ok = await pullFromCloud()
      setSyncing(false)
      if (ok) {
        const after = localStorage.getItem('pt_patients')
        if (before !== after) window.location.reload()
      }
    })
  }, [])

  function handleLogout() {
    logout()
    router.replace('/login')
  }

  async function handlePushSync() {
    setSyncing(true)
    const { pushToCloud } = await import('@/lib/sync-service')
    await pushToCloud()
    setSyncing(false)
    alert('クラウドへの同期が完了しました')
  }

  return (
    <AuthGuard>
      {(user) => (
        <div className="flex min-h-screen bg-[#f0f4f8]">
          {/* Desktop sidebar */}
          <aside className="hidden md:flex flex-col w-56 bg-[#080e1a] fixed inset-y-0 left-0 z-30
            border-r border-white/[0.05]">
            <SidebarContent user={user} onLogout={handleLogout} pathname={pathname} onOpenQR={() => setShowQR(true)} onPushSync={handlePushSync} syncing={syncing} />
            {syncing && (
              <div className="absolute bottom-0 left-0 right-0 px-4 py-2 bg-teal-900/50 text-teal-300 text-[10px] flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-teal-400 animate-pulse" />
                同期中...
              </div>
            )}
          </aside>

          {/* Mobile sidebar overlay */}
          {mobileOpen && (
            <div className="fixed inset-0 z-40 md:hidden">
              <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                onClick={() => setMobileOpen(false)}
              />
              <aside className="relative w-56 h-full bg-[#080e1a] flex flex-col border-r border-white/[0.05]">
                <button
                  className="absolute top-4 right-4 text-white/60 hover:text-white"
                  onClick={() => setMobileOpen(false)}
                >
                  <X className="w-5 h-5" />
                </button>
                <SidebarContent user={user} onLogout={handleLogout} pathname={pathname} onOpenQR={() => { setMobileOpen(false); setShowQR(true) }} onPushSync={handlePushSync} syncing={syncing} />
              </aside>
            </div>
          )}

          {/* Main */}
          <div className="flex-1 md:ml-56 flex flex-col min-h-screen">
            {/* Mobile header */}
            <header className="md:hidden bg-[#080e1a] px-4 py-3 flex items-center gap-3 sticky top-0 z-20
              border-b border-white/[0.06]">
              <button onClick={() => setMobileOpen(true)} className="text-white/80 hover:text-white">
                <Menu className="w-5 h-5" />
              </button>
              <div className="flex items-center gap-2 flex-1">
                <Logo />
              </div>
              <button
                onClick={() => setShowQR(true)}
                className="text-white/70 hover:text-white transition-colors"
                title="スマートフォンでアクセス"
              >
                <Smartphone className="w-5 h-5" />
              </button>
            </header>

            <main className="flex-1 p-4 md:p-6">{children}</main>
          </div>

          {/* QR Login Modal */}
          {showQR && <QRLoginModal onClose={() => setShowQR(false)} />}
        </div>
      )}
    </AuthGuard>
  )
}
