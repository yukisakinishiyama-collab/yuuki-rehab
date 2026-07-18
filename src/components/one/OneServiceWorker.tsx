'use client';

import { useEffect } from 'react';

/**
 * /one スコープの Service Worker 登録（オフラインシェル）
 * 開発中はキャッシュが邪魔になるため本番のみ登録する。
 */
export default function OneServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return;
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker
      .register('/one-sw.js', { scope: '/one' })
      .catch(() => {
        // 登録失敗してもアプリ自体は通常動作する
      });
  }, []);

  return null;
}
