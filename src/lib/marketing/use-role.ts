'use client'

/**
 * クライアント側で現在の役割を読むフック。
 *
 * proxy.ts が発行する読み取り可能Cookie `mk_role` を参照する。
 * Cookie が無い場合（＝認証無効のローカル開発）は 'admin' 扱いで全操作を表示する。
 * ここでの判定はあくまでUI表示制御であり、実際の認可はサーバー側で再検証している。
 */
import { useEffect, useState } from 'react'
import { ROLE_COOKIE, type MarketingRole } from './auth-shared'

function readRoleCookie(): MarketingRole {
  if (typeof document === 'undefined') return 'admin'
  const match = document.cookie
    .split('; ')
    .find((row) => row.startsWith(`${ROLE_COOKIE}=`))
  const value = match?.split('=')[1]
  return value === 'staff' ? 'staff' : 'admin'
}

export function useMarketingRole(): { role: MarketingRole; isAdmin: boolean } {
  // 初期値はサーバーとの不一致（hydration mismatch）を避けるため admin 固定にし、
  // マウント後に実際のCookieで確定する
  const [role, setRole] = useState<MarketingRole>('admin')
  useEffect(() => {
    setRole(readRoleCookie())
  }, [])
  return { role, isAdmin: role === 'admin' }
}
