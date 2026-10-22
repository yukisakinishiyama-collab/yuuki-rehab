import { webBookingHref } from '@/lib/site/booking'

/** 画面右下の予約ボタン（ネット予約・LINE予約）。スマホでも親指で届く位置 */
export default function LineFloatButton() {
  return (
    <div className="fixed bottom-6 right-4 z-50 flex flex-col items-end gap-2">
      <a
        href={webBookingHref('float')}
        className="flex items-center gap-2 bg-navy text-white font-bold text-sm px-5 py-3.5 rounded-full shadow-xl transition-all hover:scale-105 active:scale-95"
        aria-label="24時間ネット予約（その場で確定）"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <path d="M16 2v4M8 2v4M3 10h18M9 16l2 2 4-4" />
        </svg>
        ネット予約
      </a>
      <a
        href="https://lin.ee/uaGKbfk"
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-2 bg-line hover:bg-line-dark text-white font-bold text-sm px-5 py-3.5 rounded-full shadow-xl transition-all hover:scale-105 active:scale-95"
        aria-label="LINEで予約する"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M12 2C6.477 2 2 6.145 2 11.243c0 3.121 1.588 5.89 4.063 7.706-.165.595-.535 2.225-.608 2.558-.092.413.148.41.314.3.13-.088 2.053-1.373 2.888-1.932.74.1 1.5.155 2.343.155 5.523 0 10-4.145 10-9.243S17.523 2 12 2z"/>
        </svg>
        LINE予約
      </a>
    </div>
  )
}
