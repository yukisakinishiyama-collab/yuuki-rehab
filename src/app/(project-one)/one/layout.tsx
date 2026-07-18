import type { Metadata, Viewport } from 'next';
import OneNav from '@/components/one/OneNav';
import OneServiceWorker from '@/components/one/OneServiceWorker';
import OneMetrics from '@/components/one/OneMetrics';

export const metadata: Metadata = {
  title: 'ONE｜まいにちのAIそうだん',
  description:
    '説明書なしで使える、買い切り型AIライフアシスタント。悩みをひとこと話すと、やさしい答えと「今日の行動」が届きます。',
  robots: { index: false },
  manifest: '/one.webmanifest',
  icons: { icon: '/one-icon-192.png', apple: '/one-icon-192.png' },
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'ONE' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#2563eb',
};

/**
 * Project ONE — モバイル専用シェル
 * デザイン方針: 白×青・丸み・大フォント・広い余白・片手操作（下部ナビ）
 */
export default function OneLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-white text-slate-800" style={{ fontFamily: 'var(--font-zen-kaku), "Hiragino Sans", sans-serif' }}>
      <main className="mx-auto min-h-screen max-w-md px-5 pb-28 pt-6">
        {children}
      </main>
      <OneNav />
      <OneServiceWorker />
      <OneMetrics />
    </div>
  );
}
