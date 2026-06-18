'use client'

import { useEffect, useState } from 'react'
import { initStore } from '@/lib/rehab-store'

const DEFAULT_USER = {
  id: 'user-001',
  name: '西山 勇来',
  role: 'admin',
  department: 'リハビリテーション科',
  email: 'nishiyama@rehab.example.com',
}

/**
 * ログインページを開いた瞬間に自動ログイン → ダッシュボードへリダイレクト
 * 院内専用アプリのため認証フォームなし
 */
export default function AutoLogin() {
  const [status, setStatus] = useState<'logging-in' | 'done' | 'error'>('logging-in')

  useEffect(() => {
    try {
      initStore()
      localStorage.setItem('rehabUser', JSON.stringify(DEFAULT_USER))
      setStatus('done')
      // すぐにリダイレクト
      window.location.replace('/dashboard')
    } catch (e) {
      console.error('AutoLogin error:', e)
      setStatus('error')
    }
  }, [])

  return (
    <div className="flex flex-col items-center gap-6">
      {/* ロゴ */}
      <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-[#1a5276] to-[#0d9488] flex items-center justify-center shadow-xl shadow-teal-900/50">
        <svg width="40" height="40" viewBox="0 0 36 36" fill="none">
          <path d="M18 6 L18 30" stroke="white" strokeWidth="3.5" strokeLinecap="round"/>
          <path d="M6 18 L30 18" stroke="white" strokeWidth="3.5" strokeLinecap="round"/>
          <circle cx="18" cy="18" r="5" fill="white" fillOpacity="0.2"/>
        </svg>
      </div>

      <div className="text-center">
        <h1 className="text-white font-bold text-2xl tracking-widest mb-1">YUUKI REHAB</h1>
        <p className="text-teal-400 text-sm tracking-widest">スタッフ専用</p>
      </div>

      {status === 'logging-in' || status === 'done' ? (
        <div className="flex items-center gap-3 text-white/80">
          <span className="w-5 h-5 border-2 border-teal-400 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm">ログイン中...</span>
        </div>
      ) : (
        /* エラー時はリロードボタンを表示 */
        <div className="text-center space-y-4">
          <p className="text-red-300 text-sm">読み込みに失敗しました</p>
          <button
            onClick={() => window.location.reload()}
            className="px-8 py-3 bg-teal-600 text-white font-bold rounded-2xl text-base"
            style={{ touchAction: 'manipulation' }}
          >
            再読み込み
          </button>
        </div>
      )}
    </div>
  )
}
