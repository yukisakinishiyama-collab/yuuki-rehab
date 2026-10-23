'use client'

/**
 * 院内アプリの枠（予約管理・カルテ・経営・集客）
 *
 * - 共通メニューは ClinicShell（PCは左、スマホは下のタブ）
 * - 予約管理（GASの予約画面）は常駐の iframe。/yoyaku を開くたびに読み込み直さない
 * - 起動時にクラウドの控えからカルテを取り込み（変わっていれば読み直す）
 */
import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { CloudUpload, Smartphone } from 'lucide-react'
import AuthGuard from './AuthGuard'
import YoyakuFrame from './YoyakuFrame'
import QRLoginModal from './QRLoginModal'
import ClinicShell from '@/components/clinic/ClinicShell'

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [showQR, setShowQR] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [syncMessage, setSyncMessage] = useState('')

  // 起動時にクラウドからデータを取得し、差分があればリロード
  useEffect(() => {
    import('@/lib/sync-service').then(async ({ pullFromCloud, isSyncEnabled }) => {
      if (!isSyncEnabled()) return
      setSyncing(true)
      const before = localStorage.getItem('pt_patients')
      const ok = await pullFromCloud()
      setSyncing(false)
      if (ok) {
        const after = localStorage.getItem('pt_patients')
        if (before !== after) window.location.reload()
      }
    })
  }, [])

  async function handlePushSync() {
    setSyncing(true)
    setSyncMessage('')
    const { pushToCloud, isSyncEnabled } = await import('@/lib/sync-service')
    if (!isSyncEnabled()) {
      setSyncing(false)
      setSyncMessage('クラウド同期が未設定です')
      return
    }
    const ok = await pushToCloud()
    setSyncing(false)
    setSyncMessage(ok ? 'クラウドへ保存しました' : '保存できませんでした')
  }

  const extras = (
    <>
      <button
        type="button"
        onClick={handlePushSync}
        disabled={syncing}
        className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[13px] text-white/70 transition-colors hover:bg-white/5 hover:text-white disabled:opacity-50"
      >
        <CloudUpload className="h-4 w-4" aria-hidden />
        {syncing ? '同期中…' : 'カルテをクラウドへ保存'}
      </button>
      {syncMessage && <p className="px-3 text-[11px] text-teal-200">{syncMessage}</p>}
      <button
        type="button"
        onClick={() => setShowQR(true)}
        className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[13px] text-white/70 transition-colors hover:bg-white/5 hover:text-white"
      >
        <Smartphone className="h-4 w-4" aria-hidden />
        スマホで開く（QR）
      </button>
    </>
  )

  return (
    <AuthGuard>
      {() => (
        <>
          <ClinicShell extras={extras}>
            {children}
            {/* 予約管理（常駐iframe）：タブ切替で再読み込みせず一瞬で戻れる */}
            <YoyakuFrame visible={pathname === '/yoyaku'} />
          </ClinicShell>
          {showQR && <QRLoginModal onClose={() => setShowQR(false)} />}
        </>
      )}
    </AuthGuard>
  )
}
