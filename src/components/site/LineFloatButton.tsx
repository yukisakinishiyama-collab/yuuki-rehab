export default function LineFloatButton() {
  return (
    <a
      href="https://lin.ee/uaGKbfk"
      target="_blank"
      rel="noopener noreferrer"
      className="fixed bottom-6 right-4 z-50 flex items-center gap-2 bg-line hover:bg-line-dark text-white font-bold text-sm px-5 py-3.5 rounded-full shadow-xl transition-all hover:scale-105 active:scale-95"
      aria-label="LINEで予約する"
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M12 2C6.477 2 2 6.145 2 11.243c0 3.121 1.588 5.89 4.063 7.706-.165.595-.535 2.225-.608 2.558-.092.413.148.41.314.3.13-.088 2.053-1.373 2.888-1.932.74.1 1.5.155 2.343.155 5.523 0 10-4.145 10-9.243S17.523 2 12 2z"/>
      </svg>
      LINE予約
    </a>
  )
}
