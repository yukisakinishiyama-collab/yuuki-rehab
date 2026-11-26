'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { loginWithQRToken, initStore } from '@/lib/rehab-store'
import { CheckCircle, XCircle, Loader2 } from 'lucide-react'

export default function QRAutoLogin() {
  const searchParams = useSearchParams()
  const rawToken = searchParams.get('qr')
  const token = rawToken ? decodeURIComponent(rawToken) : null
  // QR の番号があれば、はじめから「認証中」（effect の中ですぐ書きかえない）
  const [status, setStatus] = useState<'checking' | 'success' | 'failed'>('checking')

  useEffect(() => {
    if (!token) return
    initStore()
    // Small delay so initStore can hydrate localStorage
    const timer = setTimeout(() => {
      const ok = loginWithQRToken(token)
      if (ok) {
        setStatus('success')
        // 前からの動きのまま、アプリ全体を読み直して開く（端末に入れたログインを読み直すため）
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination
        setTimeout(() => { window.location.href = '/dashboard' }, 800)
      } else {
        setStatus('failed')
      }
    }, 200)
    return () => clearTimeout(timer)
  }, [token])

  if (!token) return null

  return (
    <div className="mb-6">
      {status === 'checking' && (
        <div className="flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-blue-800">
          <Loader2 className="w-5 h-5 animate-spin text-blue-600 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold">QRコードで認証中...</p>
            <p className="text-xs text-blue-600 mt-0.5">しばらくお待ちください</p>
          </div>
        </div>
      )}
      {status === 'success' && (
        <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-green-800">
          <CheckCircle className="w-5 h-5 text-green-700 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold">ログイン成功！</p>
            <p className="text-xs text-green-700 mt-0.5">ダッシュボードへ移動中...</p>
          </div>
        </div>
      )}
      {status === 'failed' && (
        <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-800">
          <XCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold">QRコードが無効です</p>
            <p className="text-xs text-red-600 mt-0.5">有効期限切れか、すでに使用済みです。PCで新しいQRコードを生成してください。</p>
          </div>
        </div>
      )}
    </div>
  )
}
