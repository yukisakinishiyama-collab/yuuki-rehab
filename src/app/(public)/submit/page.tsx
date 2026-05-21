import SubmitForm from '@/components/rehab/SubmitForm'

export const metadata = {
  title: '動作解析 依頼フォーム | YUUKI MOTION LAB',
  description: '動作解析サービスへの動画送付フォームです。',
}

export default function SubmitPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0d1f33] via-[#1e3a5f] to-[#0a2d28]">
      {/* 背景装飾 */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[#0d9488]/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-[#1e3a5f]/30 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 max-w-2xl mx-auto px-4 py-12">
        {/* ヘッダー */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-[#1a5276] to-[#0d9488] rounded-2xl mb-4 shadow-2xl">
            <svg width="32" height="32" viewBox="0 0 36 36" fill="none">
              <path d="M18 8 L18 28" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
              <path d="M8 18 L28 18" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
              <circle cx="18" cy="18" r="3.5" fill="white" fillOpacity="0.3"/>
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white">YUUKI MOTION LAB</h1>
          <p className="text-[#5ec9c2] text-sm mt-1 tracking-wide">動作解析 依頼フォーム</p>
        </div>

        <SubmitForm />

        <p className="text-center text-blue-300/50 text-xs mt-6">
          © 2026 YUUKI MOTION LAB — お送りいただいた情報は解析目的のみに使用します
        </p>
      </div>
    </div>
  )
}
