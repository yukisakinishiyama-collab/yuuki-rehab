'use client'
// カルテの同期を画面から使うための小さな道具
// - useKarteSynced(cb) … ほかの端末の記録を取り込んだら cb を呼ぶ（画面の一覧を読み直す）
// - useSyncStatus()    … 同期の状態（最後にそろった時刻・同期中・失敗）
import { useEffect, useRef, useState } from 'react'
import { getSyncStatus, subscribeSyncStatus, SYNCED_EVENT, type SyncStatus } from './sync-service'

export function useKarteSynced(callback: (keys: string[]) => void): void {
  const ref = useRef(callback)
  useEffect(() => {
    ref.current = callback
  })
  useEffect(() => {
    const handler = (ev: Event) => {
      const keys = (ev as CustomEvent<{ keys?: string[] }>).detail?.keys ?? []
      ref.current(keys)
    }
    window.addEventListener(SYNCED_EVENT, handler)
    return () => window.removeEventListener(SYNCED_EVENT, handler)
  }, [])
}

export function useSyncStatus(): SyncStatus {
  const [status, setStatus] = useState<SyncStatus>(() => getSyncStatus())
  useEffect(() => subscribeSyncStatus(setStatus), [])
  return status
}
