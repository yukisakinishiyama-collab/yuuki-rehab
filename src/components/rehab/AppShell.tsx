'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  Activity,
  LayoutDashboard,
  FolderOpen,
  LogOut,
  Menu,
  X,
  ChevronRight,
  User,
} from 'lucide-react'
import AuthGuard from './AuthGuard'
import { logout } from '@/lib/rehab-store'
import { ROLE_LABELS } from '@/types/rehab'
import type { User as UserType } from '@/types/rehab'

const NAV = [
  { href: '/dashboard', label: 'ダッシュボード', icon: LayoutDashboard },
  { href: '/cases', label: '症例管理', icon: FolderOpen },
]

function SidebarContent({
  user,
  onLogout,
  pathname,
}: {
  user: UserType
  onLogout: () => void
  pathname: string
}) {
  return (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-[#2a4a6f]">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-[#0d9488] rounded-xl flex items-center justify-center flex-shrink-0">
            <Activity className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="text-white font-bold text-sm leading-none">YUUKI REHAB</div>
            <div className="text-blue-300 text-xs mt-0.5">動作分析</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + '/')
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                active
                  ? 'bg-[#0d9488] text-white'
                  : 'text-blue-200 hover:bg-[#2a4a6f] hover:text-white'
              }`}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              {label}
              {active && <ChevronRight className="w-3.5 h-3.5 ml-auto opacity-70" />}
            </Link>
          )
        })}
      </nav>

      {/* User */}
      <div className="px-3 py-4 border-t border-[#2a4a6f]">
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-[#2a4a6f] mb-2">
          <div className="w-8 h-8 rounded-full bg-[#0d9488] flex items-center justify-center flex-shrink-0">
            <User className="w-4 h-4 text-white" />
          </div>
          <div className="min-w-0">
            <div className="text-white text-sm font-medium truncate">{user.name}</div>
            <div className="text-blue-300 text-xs">{ROLE_LABELS[user.role]}</div>
          </div>
        </div>
        <button
          onClick={onLogout}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-blue-300 hover:bg-[#2a4a6f] hover:text-white transition-colors"
        >
          <LogOut className="w-4 h-4" />
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

  function handleLogout() {
    logout()
    router.replace('/login')
  }

  return (
    <AuthGuard>
      {(user) => (
        <div className="flex min-h-screen bg-[#f0f4f8]">
          {/* Desktop sidebar */}
          <aside className="hidden md:flex flex-col w-60 bg-[#1e3a5f] fixed inset-y-0 left-0 z-30">
            <SidebarContent user={user} onLogout={handleLogout} pathname={pathname} />
          </aside>

          {/* Mobile sidebar overlay */}
          {mobileOpen && (
            <div className="fixed inset-0 z-40 md:hidden">
              <div
                className="absolute inset-0 bg-black/50"
                onClick={() => setMobileOpen(false)}
              />
              <aside className="relative w-60 h-full bg-[#1e3a5f] flex flex-col">
                <button
                  className="absolute top-4 right-4 text-white"
                  onClick={() => setMobileOpen(false)}
                >
                  <X className="w-5 h-5" />
                </button>
                <SidebarContent user={user} onLogout={handleLogout} pathname={pathname} />
              </aside>
            </div>
          )}

          {/* Main */}
          <div className="flex-1 md:ml-60 flex flex-col min-h-screen">
            {/* Mobile header */}
            <header className="md:hidden bg-[#1e3a5f] px-4 py-3 flex items-center gap-3 sticky top-0 z-20">
              <button onClick={() => setMobileOpen(true)} className="text-white">
                <Menu className="w-5 h-5" />
              </button>
              <div className="flex items-center gap-2">
                <Activity className="w-5 h-5 text-[#0d9488]" />
                <span className="text-white font-bold text-sm">YUUKI REHAB</span>
              </div>
            </header>

            <main className="flex-1 p-4 md:p-6">{children}</main>
          </div>
        </div>
      )}
    </AuthGuard>
  )
}
