/* めざせ天下第一関 — オフラインで動かすためのサービスワーカー */
const VERSION = 'tenka-20261018-2009';
const FONT_CACHE = 'tenka-fonts';
const VOICE_CACHE = 'tenka-voice';
const VOICE_FILES = ["./voice/core.1b605294.bin", "./voice/play.30fc5cf8.bin", "./voice/q_eigo.825f5fc1.bin", "./voice/q_hoken.eff0473c.bin", "./voice/q_katei.eb76b9c6.bin", "./voice/q_kokugo.a88ffd0d.bin", "./voice/q_ongaku.6fa6fa41.bin", "./voice/q_rika.7b25af95.bin", "./voice/q_sansu.d4363dd0.bin", "./voice/q_shakai.2cd9b47d.bin", "./voice/q_tekisei.6bc6fdf6.bin", "./voice/q_zuko.eae4cc90.bin"];
const CORE = ['./', './index.html', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png', './icons/maskable-512.png', './icons/apple-touch-icon.png', './icons/favicon-64.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== VERSION && k !== FONT_CACHE && k !== VOICE_CACHE).map(k => caches.delete(k))))
    .then(() => caches.open(VOICE_CACHE)).then(async c => {
      const keep = new Set(VOICE_FILES.map(f => new URL(f, self.registration.scope).href));
      for (const r of await c.keys()) if (!keep.has(r.url)) await c.delete(r);
    })
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // Google Fonts：保存してあればそれを使い、裏で新しくする
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith(caches.open(FONT_CACHE).then(async c => {
      const hit = await c.match(req);
      const net = fetch(req).then(r => { if (r && (r.ok || r.type === 'opaque')) c.put(req, r.clone()); return r; }).catch(() => hit);
      return hit || net;
    }));
    return;
  }
  if (url.origin !== self.location.origin) return;
  // みなとの声：一度ダウンロードしたら端末に保存（ファイル名に中身の番号が入っているので、変わったら別の名前になる）
  if (/\/voice\/[^/]+\.bin$/.test(url.pathname)) {
    e.respondWith(caches.open(VOICE_CACHE).then(async c => {
      const hit = await c.match(req);
      if (hit) return hit;
      const r = await fetch(req);
      if (r && r.ok) c.put(req, r.clone());
      return r;
    }));
    return;
  }
  // ページ本体：ネットがあれば最新を、なければ保存したものを
  if (req.mode === 'navigate') {
    e.respondWith((async () => {
      try {
        const ctl = new AbortController();
        const timer = setTimeout(() => ctl.abort(), 4000);
        const r = await fetch(req, { signal: ctl.signal });
        clearTimeout(timer);
        if (r && r.ok) { const c = await caches.open(VERSION); c.put('./index.html', r.clone()); }
        return r;
      } catch (err) {
        return (await caches.match('./index.html')) || (await caches.match('./')) || Response.error();
      }
    })());
    return;
  }
  // アイコンなど：保存したものを先に使う
  e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(r => {
    if (r && r.ok) caches.open(VERSION).then(c => c.put(req, r.clone()));
    return r;
  })));
});
