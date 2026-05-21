import { Suspense } from 'react'
import LoginForm from '@/components/rehab/LoginForm'
import QRAutoLogin from '@/components/rehab/QRAutoLogin'

function LogoMarkLarge() {
  return (
    <svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="64" height="64" rx="18" fill="url(#lg)"/>
      <path d="M32 14 L32 50" stroke="white" strokeWidth="4.5" strokeLinecap="round"/>
      <path d="M14 32 L50 32" stroke="white" strokeWidth="4.5" strokeLinecap="round"/>
      <circle cx="32" cy="32" r="7" fill="white" fillOpacity="0.2"/>
      <circle cx="32" cy="32" r="3" fill="white" fillOpacity="0.5"/>
      <defs>
        <linearGradient id="lg" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#1a5276"/>
          <stop offset="100%" stopColor="#0d9488"/>
        </linearGradient>
      </defs>
    </svg>
  )
}

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0d1f33] via-[#1e3a5f] to-[#0a2d28] flex flex-col items-center justify-center px-4">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[#0d9488]/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-[#1e3a5f]/30 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-md relative z-10">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center mb-4 drop-shadow-2xl">
            <LogoMarkLarge />
          </div>
          <h1 className="text-3xl font-bold text-white tracking-wider">YUUKI REHAB</h1>
          <p className="text-[#5ec9c2] text-sm mt-1.5 tracking-widest uppercase">Motion Analysis Platform</p>
        </div>

        {/* QR auto-login (shows only when ?qr= param present) */}
        <Suspense fallback={null}>
          <QRAutoLogin />
        </Suspense>

        {/* Card */}
        <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl shadow-black/30 p-8 border border-white/20">
          <h2 className="text-xl font-bold text-gray-900 mb-1">ログイン</h2>
          <p className="text-sm text-gray-500 mb-6">担当者を選択し、パスワードを入力してください</p>
          <LoginForm />
        </div>

        <p className="text-center text-blue-300/60 text-xs mt-6">
          © 2026 YUUKI REHAB — 専門家向け動作分析プラットフォーム
        </p>
      </div>
    </div>
  )
}
