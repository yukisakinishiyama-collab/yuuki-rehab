'use client'

import { useEffect, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { loginWithQRToken, initStore } from '@/lib/rehab-store'
import { CheckCircle, XCircle, Loader2 } from 'lucide-react'

export default function QRAutoLogin() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const rawToken = searchParams.get('qr')
  const token = rawToken ? decodeURIComponent(rawToken) : null
  const [status, setStatus] = useState<'checking' | 'success' | 'failed' | 'none'>('none')

  useEffect(() => {
    if (!token) return
    setStatus('checking')
    initStore()
    // Small delay so initStore can hydrate localStorage
    setTimeout(() => {
      const ok = loginWithQRToken(token)
      if (ok) {
        setStatus('success')
        setTimeout(() => { window.location.href = '/dashboard' }, 800)
      } else {
        setStatus('failed')
      }
    }, 200)
  }, [token, router])

  if (!token) return null

  return (
    <div className="mb-6">
      {status === 'checking' && (
        <div className="flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-blue-800">
          <Loader2 className="w-5 h-5 animate-spin text-blue-500 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold">QRコードで認証中...</p>
            <p className="text-xs text-blue-600 mt-0.5">しばらくお待ちください</p>
          </div>
        </div>
      )}
      {status === 'success' && (
        <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-green-800">
          <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold">ログイン成功！</p>
            <p className="text-xs text-green-600 mt-0.5">ダッシュボードへ移動中...</p>
          </div>
        </div>
      )}
      {status === 'failed' && (
        <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-800">
          <XCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold">QRコードが無効です</p>
            <p className="text-xs text-red-600 mt-0.5">有効期限切れか、すでに使用済みです。PCで新しいQRコードを生成してください。</p>
          </div>
        </div>
      )}
    </div>
  )
}
