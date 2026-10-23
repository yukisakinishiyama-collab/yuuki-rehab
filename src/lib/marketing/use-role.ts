'use client'

/**
 * クライアント側で現在の役割を読むフック。
 *
 * proxy.ts が発行する読み取り可能Cookie `mk_role` を参照する。
 * Cookie が無い場合（＝認証無効のローカル開発）は 'admin' 扱いで全操作を表示する。
 * ここでの判定はあくまでUI表示制御であり、実際の認可はサーバー側で再検証している。
 */
import { useSyncExternalStore } from 'react'
import { ROLE_COOKIE, type MarketingRole } from './auth-shared'

function readRoleCookie(): MarketingRole {
  if (typeof document === 'undefined') return 'admin'
  const match = document.cookie
    .split('; ')
    .find((row) => row.startsWith(`${ROLE_COOKIE}=`))
  const value = match?.split('=')[1]
  return value === 'staff' ? 'staff' : 'admin'
}

const noSubscribe = () => () => {}

export function useMarketingRole(): { role: MarketingRole; isAdmin: boolean } {
  // サーバー側の表示では admin 固定（hydration のずれを防ぐ）。ブラウザでは Cookie の値で確定する
  const role = useSyncExternalStore(noSubscribe, readRoleCookie, (): MarketingRole => 'admin')
  return { role, isAdmin: role === 'admin' }
}
