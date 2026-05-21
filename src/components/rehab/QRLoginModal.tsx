'use client'

import { useState, useEffect } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { generateQRToken } from '@/lib/rehab-store'
import { X, Smartphone, RefreshCw, Wifi, Clock, Globe, ChevronDown, ChevronUp } from 'lucide-react'

interface Props {
  onClose: () => void
}

export default function QRLoginModal({ onClose }: Props) {
  const [localUrl, setLocalUrl] = useState<string>('')
  const [token, setToken] = useState<string>('')
  const [remaining, setRemaining] = useState(30 * 60)
  const [ngrokUrl, setNgrokUrl] = useState<string>('')
  const [showNgrok, setShowNgrok] = useState(false)

  function generate() {
    const t = generateQRToken()
    setToken(t)
    setRemaining(30 * 60)
  }

  useEffect(() => {
    const host = window.location.host.replace('localhost', '192.168.11.51')
    const protocol = window.location.protocol
    setLocalUrl(`${protocol}//${host}`)
    // 保存済みngrok URLを復元
    const saved = localStorage.getItem('rehabNgrokUrl') ?? ''
    setNgrokUrl(saved)
    if (saved) setShowNgrok(true)
    generate()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // カウントダウン
  useEffect(() => {
    if (remaining <= 0) return
    const timer = setInterval(() => setRemaining((r) => r - 1), 1000)
    return () => clearInterval(timer)
  }, [remaining])

  // ngrok URL保存
  function handleNgrokChange(val: string) {
    const cleaned = val.trim().replace(/\/$/, '')
    setNgrokUrl(cleaned)
    localStorage.setItem('rehabNgrokUrl', cleaned)
  }

  const baseUrl = ngrokUrl || localUrl
  const qrUrl = baseUrl && token ? `${baseUrl}/login?qr=${encodeURIComponent(token)}` : ''
  const minutes = Math.floor(remaining / 60)
  const seconds = remaining % 60
  const expired = remaining <= 0
  const isExternal = !!ngrokUrl

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden max-h-[95vh] overflow-y-auto">

        {/* ヘッダー */}
        <div className="bg-gradient-to-r from-[#1e3a5f] to-[#0d9488] px-5 py-4 flex items-center justify-between sticky top-0">
          <div className="flex items-center gap-2 text-white">
            <Smartphone className="w-5 h-5" />
            <span className="font-semibold">スマートフォンでアクセス</span>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">

          {/* アクセス方法切替 */}
          {isExternal ? (
            <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-3 py-2.5 text-sm text-green-800">
              <Globe className="w-4 h-4 flex-shrink-0 text-green-500" />
              <span><strong>外部アクセス有効</strong> — どこからでも接続可能</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-xl px-3 py-2.5 text-sm text-blue-800">
              <Wifi className="w-4 h-4 flex-shrink-0 text-blue-500" />
              <span>スマートフォンとPCが<strong>同じWiFi</strong>に接続している必要があります</span>
            </div>
          )}

          {/* QRコード */}
          <div className="flex flex-col items-center gap-3">
            {expired ? (
              <div className="w-48 h-48 flex flex-col items-center justify-center bg-gray-50 border-2 border-dashed border-gray-300 rounded-xl gap-2">
                <Clock className="w-8 h-8 text-gray-400" />
                <p className="text-sm text-gray-500">有効期限切れ</p>
              </div>
            ) : qrUrl ? (
              <div className="p-3 bg-white border-2 border-gray-200 rounded-xl shadow-sm">
                <QRCodeSVG
                  value={qrUrl}
                  size={176}
                  bgColor="#ffffff"
                  fgColor="#1e3a5f"
                  level="M"
                />
              </div>
            ) : (
              <div className="w-48 h-48 flex items-center justify-center bg-gray-50 rounded-xl">
                <RefreshCw className="w-6 h-6 text-gray-400 animate-spin" />
              </div>
            )}

            {/* 残り時間 */}
            {!expired && (
              <div className="flex items-center gap-1.5 text-sm">
                <Clock className="w-3.5 h-3.5 text-gray-400" />
                <span className={`font-mono font-medium ${remaining < 60 ? 'text-red-500' : 'text-gray-600'}`}>
                  {minutes}:{String(seconds).padStart(2, '0')}
                </span>
                <span className="text-gray-400 text-xs">で有効期限切れ</span>
              </div>
            )}
          </div>

          {/* URL直接表示 */}
          <div className="bg-gray-50 rounded-xl p-3">
            <p className="text-xs text-gray-500 mb-1.5 font-medium">またはURLを直接入力</p>
            <p className="font-mono text-sm text-[#0d9488] break-all font-semibold">
              {baseUrl}/dashboard
            </p>
          </div>

          {/* ngrok設定 */}
          <div className="border border-gray-200 rounded-xl overflow-hidden">
            <button
              onClick={() => setShowNgrok(!showNgrok)}
              className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <Globe className="w-4 h-4 text-gray-400" />
              <span className="flex-1 text-left font-medium">外部アクセス（ngrok）を設定</span>
              {showNgrok ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
            </button>
            {showNgrok && (
              <div className="px-3 pb-3 space-y-2.5 border-t border-gray-100 pt-3">
                <p className="text-xs text-gray-500">
                  ngrokのURLを貼り付けると、WiFiなしで外からアクセスできます
                </p>
                <input
                  type="url"
                  value={ngrokUrl}
                  onChange={(e) => handleNgrokChange(e.target.value)}
                  placeholder="https://xxxx-xx-xxx.ngrok-free.app"
                  className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0d9488] font-mono"
                />
                {ngrokUrl && (
                  <button
                    onClick={() => { setNgrokUrl(''); localStorage.removeItem('rehabNgrokUrl') }}
                    className="text-xs text-red-500 hover:text-red-700"
                  >
                    クリア（ローカルIPに戻す）
                  </button>
                )}
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-2.5 text-xs text-amber-800 space-y-1">
                  <p className="font-semibold">ngrokのセットアップ手順</p>
                  <ol className="space-y-0.5 list-decimal list-inside">
                    <li>ngrok.com でアカウント作成（無料）</li>
                    <li>ngrokをダウンロード・インストール</li>
                    <li>コマンドで <code className="bg-amber-100 px-1 rounded">ngrok http 3000</code> を実行</li>
                    <li>表示された <code className="bg-amber-100 px-1 rounded">https://xxxx.ngrok-free.app</code> をここに貼る</li>
                  </ol>
                </div>
              </div>
            )}
          </div>

          {/* 使い方 */}
          <div className="space-y-1.5">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">使い方</p>
            <ol className="space-y-1">
              {[
                'スマートフォンのカメラでQRコードを読み取る',
                'ブラウザが開いて自動ログイン',
                '30分以内にスキャンしてください',
              ].map((step, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-gray-600">
                  <span className="w-4 h-4 rounded-full bg-[#0d9488] text-white flex items-center justify-center flex-shrink-0 text-[10px] font-bold mt-0.5">
                    {i + 1}
                  </span>
                  {step}
                </li>
              ))}
            </ol>
          </div>

          {/* 再生成ボタン */}
          <button
            onClick={generate}
            className="w-full flex items-center justify-center gap-2 py-2.5 bg-[#0d9488] hover:bg-[#0b8276] text-white rounded-xl text-sm font-medium transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            QRコードを再生成
          </button>
        </div>
      </div>
    </div>
  )
}
