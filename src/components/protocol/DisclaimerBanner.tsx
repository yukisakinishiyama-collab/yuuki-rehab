'use client'

import { AlertTriangle, ShieldAlert, X } from 'lucide-react'
import { useState } from 'react'

export default function DisclaimerBanner({ compact = false }: { compact?: boolean }) {
  const [dismissed, setDismissed] = useState(false)

  if (compact) {
    return (
      <div className="flex items-center gap-2 text-xs text-amber-800 bg-amber-50 border border-amber-200/80 rounded-lg px-3 py-2 no-print">
        <ShieldAlert className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
        <span className="font-body">
          本ツールは臨床意思決定支援を目的とし、医療行為・診断を代替しません。最終判断は有資格の医療者が行ってください。
        </span>
      </div>
    )
  }

  if (dismissed) return null

  return (
    <div className="animate-slide-up flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3.5 mb-4 no-print">
      <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-amber-800 font-display tracking-wide uppercase mb-0.5">
          臨床使用上の注意
        </p>
        <p className="text-xs text-amber-800/90 font-body leading-relaxed">
          本ツールは臨床意思決定支援を目的とし、
          <strong className="font-semibold">医療行為・確定診断・個別治療の指示を代替しません</strong>。
          生成されたプロトコルはあくまで「たたき台」であり、最終判断は必ず有資格の医療者（医師・理学療法士等）が行ってください。
        </p>
      </div>
      <button
        onClick={() => setDismissed(true)}
        className="text-amber-400 hover:text-amber-600 transition-colors flex-shrink-0 -mt-0.5 -mr-0.5 p-1 rounded hover:bg-amber-100"
        aria-label="通知を閉じる"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}
