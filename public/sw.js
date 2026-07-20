/*
 * ゆうき整骨院マーケティングハブ Service Worker
 * スコープ: /marketing（登録時に scope 指定）
 * 方針: ナビゲーションはネットワーク優先＋オフライン時はキャッシュ済みページにフォールバック。
 *       オンライン前提のツールなので過度なキャッシュはしない（常に最新を優先）。
 */
const CACHE = 'yuuki-mk-v2'
const FALLBACK = '/marketing'

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys()
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
      await self.clients.claim()
    })(),
  )
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  // GETのページ遷移だけを対象にする（APIやPOSTには介入しない＝常にネットワーク）
  if (req.method !== 'GET' || req.mode !== 'navigate') return

  event.respondWith(
    (async () => {
      try {
        const net = await fetch(req)
        // 表示できたページはキャッシュしておき、オフライン時の復帰に使う
        const cache = await caches.open(CACHE)
        cache.put(req, net.clone())
        return net
      } catch {
        const cache = await caches.open(CACHE)
        const cached = await cache.match(req)
        return cached || (await cache.match(FALLBACK)) || Response.error()
      }
    })(),
  )
})
