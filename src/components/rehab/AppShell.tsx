'use client'

/**
 * 院内アプリの枠（予約管理・カルテ・経営・集客）
 *
 * - 共通メニューは ClinicShell（PCは左、スマホは下のタブ）
 * - 予約管理（GASの予約画面）は常駐の iframe。/yoyaku を開くたびに読み込み直さない
 * - 起動時にクラウドの控えからカルテを取り込み（変わっていれば読み直す）
 * - カルテの画面（今日・カルテ）を開いている間は、15秒ごとにほかの端末の記録を取り込む。「すぐに反映する」で今すぐ
 */
import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { RefreshCw, Smartphone } from 'lucide-react'
import { useSyncStatus } from '@/lib/use-karte-sync'
import AuthGuard from './AuthGuard'
import YoyakuFrame from './YoyakuFrame'
import QRLoginModal from './QRLoginModal'
import ClinicShell from '@/components/clinic/ClinicShell'
import { VoiceFloatingBar, VoiceSessionProvider } from './VoiceSession'

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [showQR, setShowQR] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [syncMessage, setSyncMessage] = useState('')
  const sync = useSyncStatus()

  // カルテを使う画面（今日・カルテ）を開いたとき、クラウドの控えを取り込む（1回だけ）。
  // 集客・経営の画面では取り込まない（入力中に読み直しが起きないように）。
  const usesKarte = pathname === '/dashboard' || pathname.startsWith('/patients')
  const pulledRef = useRef(false)
  useEffect(() => {
    if (!usesKarte || pulledRef.current) return
    pulledRef.current = true
    import('@/lib/sync-service').then(async ({ pullAtStartup, isSyncEnabled }) => {
      if (!isSyncEnabled()) return
      setSyncing(true)
      // カルテの自動作成（lib/karte-auto-create.ts）も同じ1回の取り込みを待つ
      const { changed } = await pullAtStartup()
      setSyncing(false)
      if (changed) window.location.reload()
    })
  }, [usesKarte])

  // カルテの画面にいる間は15秒ごとにそろえる（画面が隠れている間は止まる）
  useEffect(() => {
    if (!usesKarte) return
    let stop: (() => void) | null = null
    let cancelled = false
    import('@/lib/sync-service').then(({ startLiveSync }) => {
      if (!cancelled) stop = startLiveSync()
    })
    return () => {
      cancelled = true
      stop?.()
    }
  }, [usesKarte])

  async function handleSyncNow() {
    setSyncing(true)
    setSyncMessage('')
    const { syncNow, isSyncEnabled } = await import('@/lib/sync-service')
    if (!isSyncEnabled()) {
      setSyncing(false)
      setSyncMessage('クラウド同期が未設定です')
      return
    }
    const result = await syncNow()
    setSyncing(false)
    setSyncMessage(
      !result.ok
        ? 'クラウドに届きませんでした'
        : result.changedKeys.length > 0
          ? 'ほかの端末の記録を取り込みました'
          : result.sent > 0
            ? 'この端末の記録を反映しました'
            : 'クラウドとそろっています',
    )
  }

  const lastSynced = sync.lastSyncedAt
    ? new Date(sync.lastSyncedAt).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : null

  const extras = (
    <>
      <button
        type="button"
        onClick={handleSyncNow}
        disabled={syncing || sync.state === 'syncing'}
        className="flex min-h-10 w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[13px] text-white/70 transition-colors hover:bg-white/5 hover:text-white disabled:opacity-50 lg:min-h-0"
      >
        <RefreshCw className={`h-4 w-4 ${syncing || sync.state === 'syncing' ? 'animate-spin' : ''}`} aria-hidden />
        {syncing || sync.state === 'syncing' ? '反映しています…' : 'すぐに反映する'}
      </button>
      <p role="status" className="px-3 text-xs text-teal-200">
        {syncMessage ||
          (sync.state === 'error'
            ? sync.message
            : lastSynced
              ? `${lastSynced} にそろえました${usesKarte ? '（15秒ごと）' : ''}`
              : '')}
      </p>
      <button
        type="button"
        onClick={() => setShowQR(true)}
        className="flex min-h-10 w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[13px] text-white/70 transition-colors hover:bg-white/5 hover:text-white lg:min-h-0"
      >
        <Smartphone className="h-4 w-4" aria-hidden />
        スマホで開く（QR）
      </button>
    </>
  )

  return (
    <AuthGuard>
      {() => (
        <VoiceSessionProvider>
          <ClinicShell extras={extras}>
            {children}
            {/* 予約管理（常駐iframe）：タブ切替で再読み込みせず一瞬で戻れる */}
            <YoyakuFrame visible={pathname === '/yoyaku'} />
          </ClinicShell>
          {/* 録音中の帯（録音の本体は枠にあるので、他の画面へ行っても続く） */}
          <VoiceFloatingBar activePatientId={pathname.match(/^\/patients\/([^/]+)/)?.[1]} />
          {showQR && <QRLoginModal onClose={() => setShowQR(false)} />}
        </VoiceSessionProvider>
      )}
    </AuthGuard>
  )
}
