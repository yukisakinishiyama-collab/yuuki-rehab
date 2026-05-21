'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard,
  FolderOpen,
  LogOut,
  Menu,
  X,
  ChevronRight,
  User,
  Smartphone,
} from 'lucide-react'
import AuthGuard from './AuthGuard'
import { logout } from '@/lib/rehab-store'
import { ROLE_LABELS } from '@/types/rehab'
import type { User as UserType } from '@/types/rehab'
import QRLoginModal from './QRLoginModal'

const NAV = [
  { href: '/dashboard', label: 'ダッシュボード', icon: LayoutDashboard },
  { href: '/cases', label: '案件管理', icon: FolderOpen },
]

// Premium SVG logo mark
function LogoMark({ size = 36 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="36" height="36" rx="10" fill="url(#grad)" />
      {/* Cross / pulse symbol */}
      <path d="M18 8 L18 28" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
      <path d="M8 18 L28 18" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
      {/* Small diamond accents */}
      <circle cx="18" cy="18" r="3.5" fill="white" fillOpacity="0.25"/>
      <defs>
        <linearGradient id="grad" x1="0" y1="0" x2="36" y2="36" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#1a5276"/>
          <stop offset="100%" stopColor="#0d9488"/>
        </linearGradient>
      </defs>
    </svg>
  )
}

function SidebarContent({
  user,
  onLogout,
  pathname,
  onOpenQR,
}: {
  user: UserType
  onLogout: () => void
  pathname: string
  onOpenQR: () => void
}) {
  return (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-white/10">
        <div className="flex items-center gap-3">
          <LogoMark size={38} />
          <div>
            <div className="text-white font-bold text-sm leading-none tracking-wider">YUUKI REHAB</div>
            <div className="text-[#5ec9c2] text-[10px] mt-0.5 tracking-widest uppercase">Motion Analysis</div>
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
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                active
                  ? 'bg-gradient-to-r from-[#0d9488] to-[#0b8276] text-white shadow-md shadow-teal-900/30'
                  : 'text-blue-200/80 hover:bg-white/8 hover:text-white'
              }`}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              {label}
              {active && <ChevronRight className="w-3.5 h-3.5 ml-auto opacity-60" />}
            </Link>
          )
        })}
      </nav>

      {/* User */}
      <div className="px-3 py-4 border-t border-white/10">
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white/8 mb-2">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#0d9488] to-[#1a5276] flex items-center justify-center flex-shrink-0 ring-2 ring-white/20">
            <User className="w-4 h-4 text-white" />
          </div>
          <div className="min-w-0">
            <div className="text-white text-sm font-medium truncate">{user.name}</div>
            <div className="text-[#5ec9c2] text-[10px] uppercase tracking-wider">{ROLE_LABELS[user.role]}</div>
          </div>
        </div>
        <button
          onClick={onOpenQR}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-blue-300/70 hover:bg-white/8 hover:text-white transition-all mb-1"
        >
          <Smartphone className="w-4 h-4" />
          スマートフォンでアクセス
        </button>
        <button
          onClick={onLogout}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-blue-300/70 hover:bg-white/8 hover:text-white transition-all"
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
  const [showQR, setShowQR] = useState(false)

  function handleLogout() {
    logout()
    router.replace('/login')
  }

  return (
    <AuthGuard>
      {(user) => (
        <div className="flex min-h-screen bg-[#f0f4f8]">
          {/* Desktop sidebar */}
          <aside className="hidden md:flex flex-col w-60 bg-[#13253d] fixed inset-y-0 left-0 z-30 shadow-xl">
            <SidebarContent user={user} onLogout={handleLogout} pathname={pathname} onOpenQR={() => setShowQR(true)} />
          </aside>

          {/* Mobile sidebar overlay */}
          {mobileOpen && (
            <div className="fixed inset-0 z-40 md:hidden">
              <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                onClick={() => setMobileOpen(false)}
              />
              <aside className="relative w-64 h-full bg-[#13253d] flex flex-col shadow-2xl">
                <button
                  className="absolute top-4 right-4 text-white/60 hover:text-white"
                  onClick={() => setMobileOpen(false)}
                >
                  <X className="w-5 h-5" />
                </button>
                <SidebarContent user={user} onLogout={handleLogout} pathname={pathname} onOpenQR={() => { setMobileOpen(false); setShowQR(true) }} />
              </aside>
            </div>
          )}

          {/* Main */}
          <div className="flex-1 md:ml-60 flex flex-col min-h-screen">
            {/* Mobile header */}
            <header className="md:hidden bg-[#13253d] px-4 py-3 flex items-center gap-3 sticky top-0 z-20 shadow-md">
              <button onClick={() => setMobileOpen(true)} className="text-white/80 hover:text-white">
                <Menu className="w-5 h-5" />
              </button>
              <div className="flex items-center gap-2 flex-1">
                <LogoMark size={28} />
                <span className="text-white font-bold text-sm tracking-wider">YUUKI REHAB</span>
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
