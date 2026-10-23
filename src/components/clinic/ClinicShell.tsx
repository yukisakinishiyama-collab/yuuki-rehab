'use client'

/**
 * 院内アプリの共通の枠（予約管理・カルテ・経営・集客を1つに）
 *
 * - PC（幅1024px以上）: 左に固定のメニュー。経営・集客は中の画面まで並べる
 * - スマホ: 上に今の画面の名前（経営・集客は中の切り替えボタン）、下に5つのタブ
 * - 印刷（カルテの印刷など）にはメニューを出さない（no-print）
 */
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useSyncExternalStore, type ReactNode } from 'react'
import { ExternalLink, MoreHorizontal, X } from 'lucide-react'
import { ROLE_COOKIE } from '@/lib/marketing/auth-shared'
import { NAV, activeSection, type NavSection } from './nav'

/** ログイン中の役割（proxy が付ける読み取り用の Cookie。サーバー側の表示では出さない） */
function readRoleLabel(): string | null {
  try {
    const value = document.cookie
      .split('; ')
      .find((row) => row.startsWith(`${ROLE_COOKIE}=`))
      ?.split('=')[1]
    return value === 'staff' ? 'スタッフ' : value === 'admin' ? '院長' : null
  } catch {
    return null
  }
}
const noSubscribe = () => () => {}

function useRoleLabel(): string | null {
  return useSyncExternalStore(noSubscribe, readRoleLabel, () => null)
}

function Brand() {
  return (
    <Link href="/dashboard" className="flex items-center gap-3 rounded-lg px-2 py-1 focus-visible:outline-2 focus-visible:outline-teal-300">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-teal-500/15 ring-1 ring-teal-400/30" aria-hidden>
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <path d="M10 3v14M3 10h14" stroke="#5eead4" strokeWidth="2.2" strokeLinecap="round" />
        </svg>
      </span>
      <span className="min-w-0 leading-tight">
        <span className="block text-[15px] font-black tracking-wide text-white">ゆうき整骨院</span>
        <span className="block text-[11px] font-bold tracking-[0.14em] text-teal-200/80">院内アプリ</span>
      </span>
    </Link>
  )
}

function SideNav({
  pathname,
  extras,
  role,
  showBrand = true,
}: {
  pathname: string
  extras?: ReactNode
  role: string | null
  showBrand?: boolean
}) {
  const { section: current, link: currentLink } = activeSection(pathname)
  return (
    <div className="flex h-full flex-col">
      {showBrand && (
        <div className="px-4 pb-4 pt-5">
          <Brand />
        </div>
      )}
      <nav aria-label="院内アプリのメニュー" className="flex-1 space-y-1 overflow-y-auto px-3 pb-4">
        {NAV.filter((s) => s.key !== 'settings').map((section) => {
          const active = current?.key === section.key
          const Icon = section.icon
          return (
            <div key={section.key} className="pt-1">
              <Link
                href={section.href}
                aria-current={active && !currentLink ? 'page' : undefined}
                className={`group relative flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors ${
                  active ? 'bg-white/10 text-white' : 'text-white/80 hover:bg-white/5 hover:text-white'
                }`}
              >
                {active && <span className="absolute left-0 top-2 bottom-2 w-1 rounded-full bg-teal-400" aria-hidden />}
                <Icon className={`h-5 w-5 shrink-0 ${active ? 'text-teal-300' : 'text-white/60 group-hover:text-white/80'}`} aria-hidden />
                <span className="min-w-0">
                  <span className="block text-[15px] font-bold leading-tight">{section.label}</span>
                  <span className="block truncate text-[11px] leading-tight text-white/55">{section.hint}</span>
                </span>
              </Link>
              {section.children && (
                <ul className="mb-1 ml-6 mt-1 space-y-0.5 border-l border-white/10 pl-3">
                  {section.children.map((child) => {
                    const on = currentLink?.href === child.href
                    return (
                      <li key={child.href}>
                        <Link
                          href={child.href}
                          aria-current={on ? 'page' : undefined}
                          className={`block rounded-lg px-2.5 py-1.5 text-[13px] transition-colors ${
                            on ? 'bg-teal-400/15 font-bold text-teal-100' : 'text-white/70 hover:bg-white/5 hover:text-white'
                          }`}
                        >
                          {child.label}
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          )
        })}
      </nav>
      <div className="space-y-1 border-t border-white/10 px-3 pb-4 pt-3">
        {extras}
        <Link
          href="/marketing/settings"
          aria-current={current?.key === 'settings' ? 'page' : undefined}
          className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] ${
            current?.key === 'settings' ? 'bg-white/10 font-bold text-white' : 'text-white/70 hover:bg-white/5 hover:text-white'
          }`}
        >
          設定
        </Link>
        <a
          href="/"
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] text-white/70 hover:bg-white/5 hover:text-white"
        >
          <ExternalLink className="h-4 w-4" aria-hidden />
          ホームページを見る
        </a>
        {role && <p className="px-3 pt-1 text-[11px] text-white/50">ログイン中：{role}</p>}
      </div>
    </div>
  )
}

/** スマホ：経営・集客の中の画面の切り替え */
function SubNav({ section, pathname }: { section: NavSection; pathname: string }) {
  const { link } = activeSection(pathname)
  if (!section.children) return null
  return (
    <div className="-mx-4 overflow-x-auto px-4 pb-2 lg:hidden" role="navigation" aria-label={`${section.label}の画面`}>
      <ul className="flex w-max gap-1.5">
        {section.children.map((child) => {
          const on = link?.href === child.href
          return (
            <li key={child.href}>
              <Link
                href={child.href}
                aria-current={on ? 'page' : undefined}
                className={`block whitespace-nowrap rounded-full px-3 py-1.5 text-[13px] font-bold ${
                  on ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200'
                }`}
              >
                {child.label}
              </Link>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

export default function ClinicShell({ children, extras }: { children: ReactNode; extras?: ReactNode }) {
  const pathname = usePathname() ?? '/'
  const role = useRoleLabel()
  const [moreOpen, setMoreOpen] = useState(false)
  const { section, link } = activeSection(pathname)
  const title = link?.label ?? section?.label ?? '院内アプリ'

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {/* PC：左のメニュー */}
      <aside className="no-print fixed inset-y-0 left-0 z-30 hidden w-60 bg-[#13253d] lg:block">
        <SideNav pathname={pathname} extras={extras} role={role} />
      </aside>

      {/* スマホ：上の見出し */}
      <header
        className="no-print sticky z-20 border-b border-slate-200 bg-white/95 backdrop-blur lg:hidden"
        style={{ top: 'env(safe-area-inset-top, 0px)' }}
      >
        <div className="flex items-center justify-between gap-3 px-4 py-2.5">
          <div className="min-w-0">
            <p className="text-[11px] font-bold tracking-wide text-teal-700">ゆうき整骨院 院内アプリ</p>
            <h1 className="truncate text-[17px] font-black leading-tight">{title}</h1>
          </div>
          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            className="flex h-10 w-10 items-center justify-center rounded-full text-slate-600 hover:bg-slate-100"
            aria-label="そのほかのメニュー"
          >
            <MoreHorizontal className="h-5 w-5" aria-hidden />
          </button>
        </div>
        {section && section.children && (
          <div className="px-4">
            <SubNav section={section} pathname={pathname} />
          </div>
        )}
      </header>

      {/* 印刷時はメニュー分の余白を詰めて、紙の幅いっぱいに出す */}
      <div className="print-full-width lg:pl-60">
        <main className="mx-auto w-full max-w-6xl px-4 pb-28 pt-4 sm:px-6 lg:pb-10 lg:pt-6">{children}</main>
      </div>

      {/* スマホ：下のタブ */}
      <nav
        aria-label="院内アプリのメニュー"
        className="no-print fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 backdrop-blur lg:hidden"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        <ul className="mx-auto grid max-w-lg grid-cols-5">
          {NAV.filter((s) => s.tab).map((s) => {
            const on = section?.key === s.key
            const Icon = s.icon
            return (
              <li key={s.key}>
                <Link
                  href={s.href}
                  aria-current={on ? 'page' : undefined}
                  className={`flex flex-col items-center gap-0.5 py-2 text-[11px] font-bold ${on ? 'text-teal-700' : 'text-slate-500'}`}
                >
                  <span className={`flex h-7 w-12 items-center justify-center rounded-full ${on ? 'bg-teal-100' : ''}`}>
                    <Icon className="h-5 w-5" aria-hidden />
                  </span>
                  {s.label}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>

      {/* スマホ：そのほかのメニュー */}
      {moreOpen && (
        <div className="no-print fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="そのほかのメニュー">
          <button type="button" className="absolute inset-0 bg-slate-900/50" aria-label="閉じる" onClick={() => setMoreOpen(false)} />
          <div
            className="absolute inset-x-0 bottom-0 rounded-t-2xl bg-[#13253d] text-white shadow-xl"
            style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom, 0px))' }}
          >
            <div className="flex items-center justify-between px-4 pb-1 pt-3">
              <Brand />
              <button
                type="button"
                onClick={() => setMoreOpen(false)}
                className="flex h-10 w-10 items-center justify-center rounded-full text-white/80 hover:bg-white/10"
                aria-label="閉じる"
              >
                <X className="h-5 w-5" aria-hidden />
              </button>
            </div>
            <div className="max-h-[70vh] overflow-y-auto" onClick={(e) => (e.target as HTMLElement).closest('a') && setMoreOpen(false)}>
              <SideNav pathname={pathname} extras={extras} role={role} showBrand={false} />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
