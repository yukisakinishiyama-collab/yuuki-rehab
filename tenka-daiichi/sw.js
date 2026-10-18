/* めざせ天下第一関 — オフラインで動かすためのサービスワーカー */
const VERSION = 'tenka-20261018-2014';
const FONT_CACHE = 'tenka-fonts';
const VOICE_CACHE = 'tenka-voice';
const VOICE_FILES = ["./voice/core.69a6538e.mp3", "./voice/play.bfc07bcc.mp3", "./voice/q_eigo.b51fe4ab.mp3", "./voice/q_hoken.19cee857.mp3", "./voice/q_katei.f3f48d41.mp3", "./voice/q_kokugo.89af5f54.mp3", "./voice/q_ongaku.4cb579f3.mp3", "./voice/q_rika.89a8cc96.mp3", "./voice/q_sansu.a57d8b1a.mp3", "./voice/q_shakai.c873bdc0.mp3", "./voice/q_tekisei.4bacca99.mp3", "./voice/q_zuko.8793c6dd.mp3"];
const CORE = ['./', './index.html', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png', './icons/maskable-512.png', './icons/apple-touch-icon.png', './icons/favicon-64.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(CORE))
    // みなとの声も入れておく（まだ持っていないパックだけ。失敗してもアプリは入る）
    .then(() => caches.open(VOICE_CACHE)).then(c => Promise.all(VOICE_FILES.map(f => c.match(f).then(hit => hit || c.add(f)).catch(() => {}))))
    .then(() => self.skipWaiting()));
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
  if (/\/voice\/[^/]+\.mp3$/.test(url.pathname)) {
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
