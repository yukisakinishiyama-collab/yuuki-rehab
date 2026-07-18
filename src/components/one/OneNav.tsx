'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { MessageCircleHeart, History, Star } from 'lucide-react';

/**
 * Project ONE — 下部タブナビゲーション
 * ボタンは3個。片手（親指）で届く位置に固定。アイコン中心・大きめタップ領域。
 */
const TABS = [
  { href: '/one', label: 'そうだん', icon: MessageCircleHeart },
  { href: '/one/history', label: 'りれき', icon: History },
  { href: '/one/favorites', label: 'お気に入り', icon: Star },
] as const;

export default function OneNav() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-50 border-t border-blue-100 bg-white/95 backdrop-blur"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      aria-label="メインメニュー"
    >
      <div className="mx-auto grid max-w-md grid-cols-3">
        {TABS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? 'page' : undefined}
              className={`flex min-h-[64px] flex-col items-center justify-center gap-1 rounded-2xl transition-colors ${
                active ? 'text-blue-600' : 'text-slate-400 hover:text-blue-400'
              }`}
            >
              <Icon size={28} strokeWidth={active ? 2.5 : 2} aria-hidden />
              <span className={`text-xs ${active ? 'font-bold' : 'font-medium'}`}>
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
