'use client'
/**
 * 「すぐに反映する」ボタン（カルテの画面の上に置く小さい版）
 * 押すと、この端末の変更をクラウドへ送り、ほかの端末の記録を取り込む。
 * 何もしなくても15秒ごとにそろうが、受付で書いた直後に施術室ですぐ見たいときに押す。
 */
import { useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { useSyncStatus } from '@/lib/use-karte-sync'

export default function SyncNowButton({ className = '' }: { className?: string }) {
  const status = useSyncStatus()
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState('')

  if (status.state === 'off') return null

  async function run() {
    setBusy(true)
    setNote('')
    const { syncNow } = await import('@/lib/sync-service')
    const result = await syncNow()
    setBusy(false)
    setNote(
      !result.ok
        ? '届きませんでした'
        : result.changedKeys.length > 0
          ? 'ほかの端末の記録を取り込みました'
          : result.sent > 0
            ? '反映しました'
            : 'そろっています',
    )
    setTimeout(() => setNote(''), 4000)
  }

  const spinning = busy || status.state === 'syncing'
  const last = status.lastSyncedAt
    ? new Date(status.lastSyncedAt).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : ''

  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <button
        type="button"
        onClick={run}
        disabled={spinning}
        className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-teal-200 bg-white px-3 text-sm font-medium text-teal-800 hover:bg-teal-50 disabled:opacity-60"
        title="この端末の記録を送り、ほかの端末の記録を取り込みます（ふだんは15秒ごとに自動）"
      >
        <RefreshCw className={`h-4 w-4 ${spinning ? 'animate-spin' : ''}`} aria-hidden />
        {spinning ? '反映中…' : 'すぐに反映する'}
      </button>
      <span role="status" className={`text-xs ${status.state === 'error' && !note ? 'text-red-600' : 'text-slate-500'}`}>
        {note || (status.state === 'error' ? status.message : last ? `${last} 更新` : '')}
      </span>
    </span>
  )
}
