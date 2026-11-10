// ホームページの計測（自動アクセスの見分け方・閲覧数と電話タップの数え方）の確認
// 実行: node tools/marketing/test-hp-measure.mjs   （Node 22.18+ は .ts をそのまま読める）
import assert from 'node:assert/strict'
import {
  addHpEvent,
  classifySource,
  HP_DAY_LIMIT,
  HP_SOURCE_LABELS,
  HP_SOURCES,
  pageLabel,
  topEntries,
  isBotUserAgent,
  isPrefetch,
  normalizePage,
  normalizePlace,
  sumHpDays,
  totalOf,
} from '../../src/lib/marketing/hp-measure.ts'

let passed = 0
function test(name, fn) {
  fn()
  passed += 1
  console.log(`  ✓ ${name}`)
}

const HUMANS = [
  // iPhone の Safari・LINE・Instagram の中のブラウザ、Android の Chrome、PC
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Mobile/15E148 Safari/604.1',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Safari Line/15.16.0',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/22G86 Instagram 400.0.0.0.0 (iPhone15,2; iOS 18_6; ja_JP; ja-JP)',
  'Mozilla/5.0 (Linux; Android 14; SO-51D) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 Edg/141.0.0.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15',
]
const BOTS = [
  'Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X Build/MMB29P) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
  'Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)',
  'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; GPTBot/1.2; +https://openai.com/gptbot)',
  'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; ClaudeBot/1.0; +claudebot@anthropic.com)',
  'Mozilla/5.0 (Linux; Android 5.0) AppleWebKit/537.36 (KHTML, like Gecko) Mobile Safari/537.36 (compatible; Bytespider; spider-feedback@bytedance.com)',
  'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
  'Mozilla/5.0 (compatible; AhrefsBot/7.0; +http://ahrefs.com/robot/)',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/141.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 Chrome-Lighthouse',
  'curl/8.5.0',
  'python-requests/2.32.3',
  'Go-http-client/2.0',
  'node-fetch/1.0',
  'WhatsApp/2.24.1 A',
  '',
]

test('人のブラウザ（Safari・LINE・Instagram・Chrome・Edge）は数える', () => {
  for (const ua of HUMANS) assert.equal(isBotUserAgent(ua), false, ua)
})

test('検索エンジン・AI のクローラー・下見・プログラムは数えない', () => {
  for (const ua of BOTS) assert.equal(isBotUserAgent(ua), true, ua || '(空)')
  assert.equal(isBotUserAgent(null), true)
})

test('ブラウザの先読みは数えない', () => {
  const h = (obj) => (name) => obj[name] ?? null
  assert.equal(isPrefetch(h({ 'sec-purpose': 'prefetch' })), true)
  assert.equal(isPrefetch(h({ 'sec-purpose': 'prefetch;prerender' })), true)
  assert.equal(isPrefetch(h({ purpose: 'prefetch' })), true)
  assert.equal(isPrefetch(h({})), false)
})

test('ページの場所をそろえる（.html・末尾の / ・index・? と # を外す）', () => {
  assert.equal(normalizePage('/first-visit'), '/first-visit')
  assert.equal(normalizePage('/first-visit.html'), '/first-visit')
  assert.equal(normalizePage('/first-visit/'), '/first-visit')
  assert.equal(normalizePage('/'), '/')
  assert.equal(normalizePage('/index.html'), '/')
  assert.equal(normalizePage('/price?x=1#fee'), '/price')
  assert.equal(normalizePage('/Sym-ACL'), '/sym-acl')
})

test('おかしなページの値は数えない', () => {
  assert.equal(normalizePage(null), null)
  assert.equal(normalizePage(''), null)
  assert.equal(normalizePage('first-visit'), null)
  assert.equal(normalizePage('https://example.com/'), null)
  assert.equal(normalizePage('/a/b'), null)
  assert.equal(normalizePage('/<script>'), null)
  assert.equal(normalizePage('/' + 'a'.repeat(41)), null)
})

test('電話の置き場所は決まった名前だけ', () => {
  assert.equal(normalizePlace('bar'), 'bar')
  assert.equal(normalizePlace('HEADER'), 'header')
  assert.equal(normalizePlace('evil'), 'other')
  assert.equal(normalizePlace(null), 'other')
})

test('閲覧と電話タップを日別に足す（元の値は変えない）', () => {
  const d0 = null
  const d1 = addHpEvent(d0, 'view', '/first-visit')
  const d2 = addHpEvent(d1, 'view', '/first-visit')
  const d3 = addHpEvent(d2, 'tel', '/first-visit', 'bar')
  assert.deepEqual(d1.v, { '/first-visit': 1 })
  assert.deepEqual(d3.v, { '/first-visit': 2 })
  assert.deepEqual(d3.t, { '/first-visit': 1 })
  assert.deepEqual(d3.tw, { bar: 1 })
})

test('1日・1ページの上限で止まる', () => {
  let d = { v: { '/': HP_DAY_LIMIT }, t: {}, tw: {} }
  d = addHpEvent(d, 'view', '/')
  assert.equal(d.v['/'], HP_DAY_LIMIT)
})

test('何日分かを合計する', () => {
  const total = sumHpDays([
    { v: { '/': 3, '/first-visit': 2 }, t: { '/': 1 }, tw: { bar: 1 } },
    { v: { '/first-visit': 5 }, t: { '/price': 2 }, tw: { main: 2 } },
  ])
  assert.equal(total.v['/first-visit'], 7)
  assert.equal(totalOf(total.v), 10)
  assert.equal(totalOf(total.t), 3)
  assert.deepEqual(total.tw, { bar: 1, main: 2 })
})

// ── 入口（どこから来たか） ─────────────────────────────────

test('来たところを分ける（検索・地図・SNS・AI・口コミサイト）', () => {
  const cases = [
    ['www.google.com', 'google'],
    ['www.google.co.jp', 'google'],
    ['com.google.android.googlequicksearchbox', 'google'],
    ['maps.google.com', 'maps'],
    ['maps.google.co.jp', 'maps'],
    ['com.google.android.apps.maps', 'maps'],
    ['maps.app.goo.gl', 'maps'],
    ['gemini.google.com', 'ai'],
    ['chatgpt.com', 'ai'],
    ['www.perplexity.ai', 'ai'],
    ['search.yahoo.co.jp', 'yahoo'],
    ['www.bing.com', 'search'],
    ['duckduckgo.com', 'search'],
    ['l.instagram.com', 'instagram'],
    ['www.instagram.com', 'instagram'],
    ['liff.line.me', 'line'],
    ['jp.naver.line.android', 'line'],
    ['l.facebook.com', 'facebook'],
    ['t.co', 'x'],
    ['www.ekiten.jp', 'portal'],
    ['bonbone.jp', 'portal'],
    ['peraichi.com', 'other'],
    ['example.com', 'other'],
    ['', 'direct'],
    [null, 'direct'],
  ]
  for (const [host, want] of cases) assert.equal(classifySource(host), want, String(host))
})

test('サイトの中の移動は入口に数えない', () => {
  assert.equal(classifySource('shimonoseki-yuuki.com'), null)
  assert.equal(classifySource('www.shimonoseki-yuuki.com'), null)
  assert.equal(classifySource('SHIMONOSEKI-YUUKI.COM.'), null)
  // utm_source が付いていても、サイトの中の移動なら数えない
  assert.equal(classifySource('shimonoseki-yuuki.com', 'gbp'), null)
})

test('utm_source が決まった名前なら優先する（マップのアプリは前のサイトを教えないことが多い）', () => {
  assert.equal(classifySource('', 'gbp'), 'maps')
  assert.equal(classifySource('www.google.com', 'google_business_profile'), 'maps')
  assert.equal(classifySource('', 'Instagram'), 'instagram')
  assert.equal(classifySource('', 'line'), 'line')
  // 決まっていない名前は前のサイトで分ける
  assert.equal(classifySource('www.google.com', 'newsletter'), 'google')
  assert.equal(classifySource('', 'whatever'), 'direct')
})

test('おかしなホスト名は「ほかのサイト」にまとめ、そのままは残さない', () => {
  assert.equal(classifySource('<script>'), 'other')
  assert.equal(classifySource('a'.repeat(101)), 'other')
  assert.equal(classifySource('evil.example/path'), 'other')
  for (const s of HP_SOURCES) assert.ok(HP_SOURCE_LABELS[s], s)
})

test('入口のときだけ、来たところと入口のページを足す', () => {
  let d = addHpEvent(null, 'view', '/sym-acl', undefined, 'google')
  d = addHpEvent(d, 'view', '/first-visit') // サイトの中の移動
  d = addHpEvent(d, 'view', '/', undefined, 'maps')
  d = addHpEvent(d, 'view', '/', undefined, 'evil') // 決まっていない名前は数えない
  d = addHpEvent(d, 'tel', '/', 'bar', 'google') // 電話タップは入口に数えない
  assert.equal(totalOf(d.v), 4)
  assert.deepEqual(d.s, { google: 1, maps: 1 })
  assert.deepEqual(d.lp, { '/sym-acl': 1, '/': 1 })
})

test('入口の記録が無い古い日とも合計できる', () => {
  const total = sumHpDays([
    { v: { '/': 3 }, t: {}, tw: {} },
    { v: { '/': 1 }, t: {}, tw: {}, s: { google: 2, direct: 1 }, lp: { '/': 3 } },
    { v: {}, t: {}, tw: {}, s: { google: 1 }, lp: { '/sym-acl': 1 } },
  ])
  assert.deepEqual(total.s, { google: 3, direct: 1 })
  assert.deepEqual(topEntries(total.lp), [['/', 3], ['/sym-acl', 1]])
  assert.equal(pageLabel('/first-visit'), 'はじめての方へ')
  assert.equal(pageLabel('/unknown-page'), '/unknown-page')
})

console.log(`\n${passed} 件 OK`)
