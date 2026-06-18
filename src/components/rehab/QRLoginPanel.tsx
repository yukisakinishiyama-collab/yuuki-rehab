'use client'

import { useState, useEffect } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { generateQRToken } from '@/lib/rehab-store'
import { Smartphone, RefreshCw, Clock, ChevronDown, ChevronUp } from 'lucide-react'

/**
 * ログインページ用QRパネル
 * PCで開くだけでスマホがスキャンしてそのまま自動ログインできる。
 * AppShell（ログイン後）のQRモーダルとは独立して動作する。
 */
export default function QRLoginPanel() {
  const [open, setOpen] = useState(false)
  const [localUrl, setLocalUrl] = useState('')
  const [token, setToken] = useState('')
  const [remaining, setRemaining] = useState(30 * 60)

  // localUrl はクライアントサイドでのみ取得できる
  useEffect(() => {
    const host = window.location.host.replace('localhost', '192.168.11.51')
    setLocalUrl(`${window.location.protocol}//${host}`)
  }, [])

  // パネルを開いたときにトークンを生成
  useEffect(() => {
    if (!open) return
    generate()
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  // カウントダウン（パネルが開いている間だけ動作）
  useEffect(() => {
    if (!open || remaining <= 0) return
    const timer = setInterval(() => setRemaining((r) => r - 1), 1000)
    return () => clearInterval(timer)
  }, [open, remaining])

  function generate() {
    setToken(generateQRToken())
    setRemaining(30 * 60)
  }

  const expired = remaining <= 0
  const minutes = Math.floor(remaining / 60)
  const seconds = remaining % 60
  const qrUrl = localUrl && token ? `${localUrl}/login?qr=${encodeURIComponent(token)}` : ''

  return (
    <div className="mt-4 border border-gray-200 rounded-xl overflow-hidden">
      {/* アコーディオンヘッダー */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        style={{ touchAction: 'manipulation' }}
        className="w-full flex items-center gap-2.5 px-4 py-3 text-sm text-gray-600 hover:bg-gray-50 active:bg-gray-100 transition-colors"
      >
        <Smartphone className="w-4 h-4 text-teal-600 flex-shrink-0" />
        <span className="flex-1 text-left font-medium">スマホでスキャンしてログイン</span>
        {open
          ? <ChevronUp className="w-4 h-4 text-gray-400" />
          : <ChevronDown className="w-4 h-4 text-gray-400" />
        }
      </button>

      {/* コンテンツ */}
      {open && (
        <div className="px-4 pb-4 pt-2 border-t border-gray-100 space-y-3">
          <p className="text-xs text-gray-500">
            PCのカメラでQRコードを読み取ると、パスワード入力なしでログインできます。<br />
            スマホとPCが<strong>同じWiFi</strong>に繋がっている必要があります。
          </p>

          {/* QRコード */}
          <div className="flex flex-col items-center gap-2">
            {!qrUrl ? (
              <div className="w-40 h-40 flex items-center justify-center bg-gray-50 rounded-xl">
                <RefreshCw className="w-5 h-5 text-gray-400 animate-spin" />
              </div>
            ) : expired ? (
              <div className="w-40 h-40 flex flex-col items-center justify-center bg-gray-50 border-2 border-dashed border-gray-300 rounded-xl gap-1">
                <Clock className="w-7 h-7 text-gray-400" />
                <p className="text-xs text-gray-400">期限切れ</p>
              </div>
            ) : (
              <div className="p-2.5 bg-white border-2 border-gray-200 rounded-xl shadow-sm">
                <QRCodeSVG
                  value={qrUrl}
                  size={148}
                  bgColor="#ffffff"
                  fgColor="#1e3a5f"
                  level="M"
                />
              </div>
            )}

            {/* 残り時間 + 再生成 */}
            <div className="flex items-center gap-3 text-xs">
              {!expired ? (
                <span className={`flex items-center gap-1 ${remaining < 60 ? 'text-red-500' : 'text-gray-500'}`}>
                  <Clock className="w-3 h-3" />
                  <span className="font-mono font-medium">{minutes}:{String(seconds).padStart(2, '0')}</span>
                </span>
              ) : null}
              <button
                type="button"
                onClick={generate}
                style={{ touchAction: 'manipulation' }}
                className="flex items-center gap-1 text-teal-600 hover:text-teal-800 active:text-teal-900 font-medium"
              >
                <RefreshCw className="w-3 h-3" />
                再生成
              </button>
            </div>
          </div>

          {/* URL */}
          <div className="bg-gray-50 rounded-lg px-3 py-2">
            <p className="text-[10px] text-gray-400 mb-0.5">または直接アクセス</p>
            <p className="font-mono text-xs text-teal-700 font-semibold break-all">
              {localUrl}/dashboard
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
