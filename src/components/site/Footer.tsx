import Link from 'next/link'
import { MapPin, Clock, Phone } from 'lucide-react'

export default function Footer() {
  return (
    <footer className="bg-navy text-white">
      <div className="max-w-6xl mx-auto px-4 py-12 md:py-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
          {/* Clinic Info */}
          <div>
            <p className="text-xs text-blue-300 tracking-widest mb-1">YUUKI SEIKOTSU-IN</p>
            <h2 className="text-2xl font-bold mb-3">ゆうき整骨院</h2>
            <p className="text-blue-200 text-sm leading-relaxed mb-4">
              スポーツ障害・術前術後リハビリ・競技復帰に特化した、山口県下関市の整骨院です。運動療法・動作改善を重視した、医学的根拠に基づく施術を提供しています。
            </p>
            <div className="flex gap-3 mt-4">
              <a
                href="https://www.instagram.com/yu.ki__seikotsuin/"
                className="flex items-center gap-1.5 text-sm text-blue-200 hover:text-white transition-colors"
                target="_blank"
                rel="noopener noreferrer"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/>
                  <circle cx="12" cy="12" r="3"/>
                  <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/>
                </svg>
                Instagram
              </a>
            </div>
          </div>

          {/* Hours */}
          <div>
            <h3 className="text-sm font-bold text-blue-300 uppercase tracking-wider mb-4">診療時間</h3>
            <div className="space-y-2 text-sm text-blue-100">
              <div className="flex gap-3">
                <span className="flex items-center gap-1 text-blue-300 min-w-20">
                  <Clock size={14} /> 平日
                </span>
                <span>10:00〜13:00 / 15:00〜20:00</span>
              </div>
              <div className="flex gap-3">
                <span className="flex items-center gap-1 text-blue-300 min-w-20">
                  <Clock size={14} /> 土曜日
                </span>
                <span>10:00〜15:00</span>
              </div>
              <div className="flex gap-3">
                <span className="flex items-center gap-1 text-blue-300 min-w-20">
                  <Clock size={14} /> 休診日
                </span>
                <span>日曜・祝日</span>
              </div>
            </div>
          </div>

          {/* Access + Nav */}
          <div>
            <h3 className="text-sm font-bold text-blue-300 uppercase tracking-wider mb-4">アクセス</h3>
            <div className="flex items-start gap-2 text-sm text-blue-100 mb-4">
              <MapPin size={16} className="mt-0.5 text-blue-300 shrink-0" />
              <span>山口県下関市彦島江の浦町9丁目1-14</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-blue-100 mb-6">
              <Phone size={16} className="text-blue-300" />
              <a href="tel:0832654545" className="hover:text-white transition-colors">083-265-4545</a>
            </div>
            <nav className="flex flex-col gap-2">
              {[
                { href: '/', label: 'トップ' },
                { href: '/first-visit', label: '初めての方へ' },
                { href: '/price', label: '料金' },
                { href: '/symptoms', label: '症状・お悩み' },
                { href: '/blog', label: 'ブログ' },
                { href: '/faq', label: 'よくある質問' },
                { href: '/access', label: 'アクセス' },
              ].map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="text-sm text-blue-200 hover:text-white transition-colors"
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>
        </div>

        <div className="border-t border-blue-900/60 mt-10 pt-6 text-center text-xs text-blue-400">
          © {new Date().getFullYear()} ゆうき整骨院 All Rights Reserved.
        </div>
      </div>
    </footer>
  )
}
