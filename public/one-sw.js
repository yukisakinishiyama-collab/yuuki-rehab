/**
 * Project ONE — Service Worker（オフラインシェル）
 *
 * 対象は /one 配下のページと、それらが使う静的アセットのみ。
 * 既存の整骨院サイト・院内アプリのリクエストには一切関与しない。
 *
 * 戦略:
 * - ページ (/one, /one/history, /one/favorites): network-first → キャッシュ → /one
 * - 静的アセット (/_next/static, アイコン, manifest): cache-first
 * - AI API (/api/one-chat) は対象外（失敗時はアプリ内のオフライン回答が働く）
 */

const CACHE = 'one-v1';
const PRECACHE = ['/one', '/one/history', '/one/favorites', '/one.webmanifest', '/one-icon-192.png', '/one-icon-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k.startsWith('one-') && k !== CACHE).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== location.origin) return;

  const isOnePage = url.pathname === '/one' || url.pathname.startsWith('/one/');
  const isStatic =
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/one-icon-') ||
    url.pathname === '/one.webmanifest';

  if (isStatic) {
    // cache-first: ビルド成果物はハッシュ付きなので安全に永続キャッシュできる
    event.respondWith(
      caches.open(CACHE).then(async (cache) => {
        const hit = await cache.match(req);
        if (hit) return hit;
        const res = await fetch(req);
        if (res.ok) cache.put(req, res.clone());
        return res;
      })
    );
    return;
  }

  if (isOnePage) {
    // network-first: オンライン時は常に最新、圏外時はキャッシュ済みシェル
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((cache) => cache.put(req, copy));
          }
          return res;
        })
        .catch(async () => (await caches.match(req)) ?? (await caches.match('/one')) ?? Response.error())
    );
  }
});
