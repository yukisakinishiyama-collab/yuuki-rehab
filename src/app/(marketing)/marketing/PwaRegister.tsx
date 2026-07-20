'use client'

import { useEffect } from 'react'

/**
 * マーケティングハブをPWA（ホーム画面設置・アイコン起動）にするための
 * Service Worker 登録。スコープは /marketing に限定し、公開サイトには影響させない。
 */
export function PwaRegister() {
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return
    navigator.serviceWorker.register('/sw.js', { scope: '/marketing' }).catch(() => {
      // 登録失敗はアプリ動作に影響しないため握る（開発環境等）
    })
  }, [])
  return null
}
