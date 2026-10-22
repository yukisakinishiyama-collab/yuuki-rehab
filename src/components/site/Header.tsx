'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Menu, X, Phone, CalendarCheck } from 'lucide-react'
import { webBookingHref } from '@/lib/site/booking'

const navLinks = [
  { href: '/first-visit', label: '初めての方へ' },
  { href: '/price', label: '料金' },
  { href: '/symptoms', label: '症状・お悩み' },
  { href: '/drills', label: '競技復帰ドリル' },
  { href: '/blog', label: 'ブログ' },
  { href: '/faq', label: 'よくある質問' },
  { href: '/access', label: 'アクセス' },
]

export default function Header() {
  const [open, setOpen] = useState(false)

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white shadow-sm">
      <div className="max-w-6xl mx-auto px-4">
        <div className="flex items-center justify-between h-16 md:h-20">
          {/* Logo */}
          <Link href="/" className="flex flex-col leading-tight" onClick={() => setOpen(false)}>
            <span className="text-xs text-slate-500 font-medium tracking-widest">YUUKI SEIKOTSU-IN</span>
            <span className="text-xl md:text-2xl font-bold text-navy">ゆうき整骨院</span>
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden lg:flex items-center gap-4 xl:gap-6">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="whitespace-nowrap text-sm font-medium text-slate-700 hover:text-blue-700 transition-colors"
              >
                {link.label}
              </Link>
            ))}
            <a
              href={webBookingHref('header')}
              className="ml-2 inline-flex items-center gap-1.5 whitespace-nowrap bg-navy hover:opacity-90 text-white text-sm font-bold px-4 xl:px-5 py-2.5 rounded-full transition-opacity"
            >
              <CalendarCheck size={16} aria-hidden="true" />
              <span>
                <span className="hidden xl:inline">24時間</span>ネット予約
              </span>
            </a>
            <a
              href="https://lin.ee/uaGKbfk"
              className="hidden xl:inline-flex items-center gap-1.5 whitespace-nowrap bg-line hover:bg-line-dark text-white text-sm font-bold px-5 py-2.5 rounded-full transition-colors"
              target="_blank"
              rel="noopener noreferrer"
            >
              LINE予約
            </a>
          </nav>

          {/* Mobile: Phone + Hamburger */}
          <div className="flex items-center gap-3 lg:hidden">
            <a href="tel:0832654545" className="p-2 text-blue-700">
              <Phone size={20} />
            </a>
            <button
              onClick={() => setOpen(!open)}
              className="p-2 text-slate-700"
              aria-label="メニュー"
            >
              {open ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {open && (
        <div className="lg:hidden bg-white border-t border-slate-100 shadow-lg">
          <nav className="flex flex-col px-4 py-4 gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="py-3 px-2 text-base font-medium text-slate-700 border-b border-slate-50 hover:text-blue-700"
              >
                {link.label}
              </Link>
            ))}
            <a
              href={webBookingHref('menu')}
              onClick={() => setOpen(false)}
              className="mt-3 flex items-center justify-center gap-2 bg-navy text-white font-bold py-3 rounded-full"
            >
              <CalendarCheck size={18} aria-hidden="true" />
              24時間ネット予約（その場で確定）
            </a>
            <a
              href="https://lin.ee/uaGKbfk"
              className="mt-2 flex items-center justify-center gap-2 bg-line text-white font-bold py-3 rounded-full"
              target="_blank"
              rel="noopener noreferrer"
            >
              LINE予約はこちら
            </a>
          </nav>
        </div>
      )}
    </header>
  )
}
