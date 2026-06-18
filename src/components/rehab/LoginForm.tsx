'use client'

import { useState, useEffect } from 'react'
import { initStore, generateQRToken } from '@/lib/rehab-store'
import { LogIn, User, QrCode, RefreshCw, Clock, X, Shield } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import type { User as UserType } from '@/types/rehab'

const STAFF_LIST: UserType[] = [
  {
    id: 'user-001',
    name: '西山 勇来',
    role: 'admin',
    department: 'リハビリテーション科',
    email: 'nishiyama@rehab.example.com',
  },
]

// パスワードなし・ワンタップでログインする院内専用方式
function loginDirect(userId: string): boolean {
  if (typeof window === 'undefined') return false
  try {
    initStore()
    const user = STAFF_LIST.find((u) => u.id === userId)
    if (!user) return false
    localStorage.setItem('rehabUser', JSON.stringify(user))
    return true
  } catch {
    return false
  }
}

export default function LoginForm() {
  const [loading, setLoading] = useState(false)
  const [showQR, setShowQR] = useState(false)
  const [localUrl, setLocalUrl] = useState('')
  const [token, setToken] = useState('')
  const [remaining, setRemaining] = useState(30 * 60)

  useEffect(() => {
    const host = window.location.host.replace('localhost', '192.168.11.51')
    setLocalUrl(`${window.location.protocol}//${host}`)
  }, [])

  useEffect(() => {
    if (!showQR) return
    generateToken()
  }, [showQR]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!showQR || remaining <= 0) return
    const t = setInterval(() => setRemaining((r) => r - 1), 1000)
    return () => clearInterval(t)
  }, [showQR, remaining])

  function generateToken() {
    setToken(generateQRToken())
    setRemaining(30 * 60)
  }

  function handleLogin(userId: string) {
    if (loading) return
    setLoading(true)
    const ok = loginDirect(userId)
    if (ok) {
      window.location.href = '/dashboard'
    } else {
      setLoading(false)
    }
  }

  const qrUrl = localUrl && token
    ? `${localUrl}/login?qr=${encodeURIComponent(token)}`
    : ''
  const expired = remaining <= 0
  const minutes = Math.floor(remaining / 60)
  const seconds = remaining % 60

  return (
    <div className="space-y-4">

      {/* スタッフ選択 → タップでそのままログイン */}
      <div>
        <p className="text-sm font-semibold text-gray-500 mb-3">担当者を選んでタップ</p>
        <div className="space-y-2">
          {STAFF_LIST.map((staff) => (
            <button
              key={staff.id}
              type="button"
              disabled={loading}
              onClick={() => handleLogin(staff.id)}
              style={{ touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent' }}
              className="w-full flex items-center gap-3 bg-gray-50 border-2 border-gray-200 active:border-teal-500 active:bg-teal-50 rounded-2xl px-4 py-4 text-left disabled:opacity-60 transition-colors"
            >
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#0d9488] to-[#1a5276] flex items-center justify-center flex-shrink-0">
                <User className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1">
                <p className="font-bold text-gray-900 text-base">{staff.name}</p>
                <p className="text-xs text-gray-400">管理者・リハビリテーション科</p>
              </div>
              {loading ? (
                <span className="w-5 h-5 border-2 border-teal-500 border-t-transparent rounded-full animate-spin flex-shrink-0" />
              ) : (
                <LogIn className="w-5 h-5 text-teal-500 flex-shrink-0" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* 注記 */}
      <div className="flex items-center gap-1.5 text-xs text-gray-400 px-1">
        <Shield className="w-3.5 h-3.5 flex-shrink-0" />
        <span>院内ネットワーク専用 — パスワード不要</span>
      </div>

      {/* 区切り */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-px bg-gray-200" />
        <span className="text-xs text-gray-400">または</span>
        <div className="flex-1 h-px bg-gray-200" />
      </div>

      {/* QR */}
      {!showQR ? (
        <button
          type="button"
          onClick={() => setShowQR(true)}
          style={{ touchAction: 'manipulation' }}
          className="w-full flex items-center justify-center gap-2 border-2 border-gray-200 active:border-teal-400 active:bg-teal-50 text-gray-600 font-semibold py-3.5 rounded-2xl"
        >
          <QrCode className="w-5 h-5 text-teal-600" />
          <span>PCのQRコードをスキャン</span>
        </button>
      ) : (
        <div className="border-2 border-teal-100 rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between bg-teal-50 px-4 py-3">
            <div className="flex items-center gap-2">
              <QrCode className="w-4 h-4 text-teal-600" />
              <span className="text-sm font-semibold text-teal-800">PCのQRをスキャン</span>
            </div>
            <button
              type="button"
              onClick={() => setShowQR(false)}
              style={{ touchAction: 'manipulation' }}
              className="text-teal-400 active:text-teal-700 p-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="p-4 flex flex-col items-center gap-3">
            <p className="text-xs text-gray-500 text-center leading-relaxed">
              PCでこのアプリを開き、サイドバーの<br />📱アイコンからQRを表示してスキャン
            </p>
            {!qrUrl ? (
              <div className="w-36 h-36 flex items-center justify-center bg-gray-50 rounded-xl">
                <RefreshCw className="w-6 h-6 text-gray-300 animate-spin" />
              </div>
            ) : expired ? (
              <div className="w-36 h-36 flex flex-col items-center justify-center bg-gray-50 border-2 border-dashed border-gray-300 rounded-xl gap-1">
                <Clock className="w-7 h-7 text-gray-400" />
                <p className="text-xs text-gray-400">期限切れ</p>
              </div>
            ) : (
              <div className="p-2 bg-white border-2 border-gray-200 rounded-xl shadow-sm">
                <QRCodeSVG value={qrUrl} size={132} bgColor="#fff" fgColor="#1e3a5f" level="M" />
              </div>
            )}
            <div className="flex items-center gap-3 text-xs">
              {!expired && (
                <span className={`flex items-center gap-1 ${remaining < 60 ? 'text-red-500' : 'text-gray-400'}`}>
                  <Clock className="w-3 h-3" />
                  <span className="font-mono">{minutes}:{String(seconds).padStart(2, '0')}</span>
                </span>
              )}
              <button
                type="button"
                onClick={generateToken}
                style={{ touchAction: 'manipulation' }}
                className="flex items-center gap-1 text-teal-600 active:text-teal-800 font-medium"
              >
                <RefreshCw className="w-3 h-3" />再生成
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
