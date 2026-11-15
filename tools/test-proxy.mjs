// 院内アプリの守り（パスワード）の確認：パスワードが無いときの返事と、通すもの・通さないもの
// 実行: npx tsx tools/test-proxy.mjs   （外には送らない。パスワードは、この確認のための にせもの）
import assert from 'node:assert/strict'
import { NextRequest } from 'next/server'

process.env.MARKETING_ADMIN_PASSWORD = 'test-admin-pass'
process.env.MARKETING_STAFF_PASSWORD = 'test-staff-pass'
const { proxy } = await import('../src/proxy.ts')

let passed = 0
async function test(name, fn) {
  await fn()
  passed += 1
  console.log(`  ✓ ${name}`)
}

const APP = 'https://yuuki-rehab.vercel.app'
const basic = (pass) => `Basic ${Buffer.from(`clinic:${pass}`).toString('base64')}`
const open = (path, headers = {}) => proxy(new NextRequest(`${APP}${path}`, { headers }))
const AUTH = 'Basic realm="marketing-hub", charset="UTF-8"'

await test('パスワードが無いまま画面を開く（LINE の中のブラウザなど）：401 のまま、どうすれば見られるかを出す', async () => {
  for (const path of ['/marketing/autopilot?week=2026-11-16', '/marketing/autopilot?week=2026-11-16&openExternalBrowser=1', '/marketing/jobs', '/api/marketing/image?kind=gbp-seo&id=ankle-sprain', '/patients', '/dashboard']) {
    const res = open(path, { accept: 'text/html,application/xhtml+xml,*/*;q=0.8' })
    assert.equal(res.status, 401, path)
    // ふつうのブラウザがパスワードの入力画面を出すための印は、これまでどおり
    assert.equal(res.headers.get('www-authenticate'), AUTH, path)
    assert.match(res.headers.get('content-type') ?? '', /^text\/html; charset=utf-8/i)
    assert.equal(res.headers.get('cache-control'), 'no-store')
    const body = await res.text()
    assert.match(body, /パスワードが必要な画面です/)
    assert.match(body, /LINEから開いたとき/)
    assert.match(body, /ブラウザで開く/)
    assert.match(body, /name="viewport"/)
    // 中身（投稿・カルテなど）や、開いたアドレスは出さない
    assert.ok(!body.includes('2026-11-16') && !body.includes('ankle-sprain') && !body.includes('test-admin-pass'))
  }
})

await test('アプリの中からの通信（API）には、これまでどおり短い文だけ', async () => {
  for (const headers of [{ accept: 'application/json' }, { accept: '*/*' }, {}]) {
    const res = open('/api/marketing/jobs', headers)
    assert.equal(res.status, 401)
    assert.equal(res.headers.get('www-authenticate'), AUTH)
    assert.equal(await res.text(), '認証が必要です')
  }
})

await test('まちがったパスワードは通さない。正しいパスワードは通す（院長・スタッフ）', async () => {
  const html = { accept: 'text/html' }
  assert.equal(open('/marketing/autopilot', { ...html, authorization: basic('wrong') }).status, 401)
  assert.equal(open('/marketing/autopilot', { ...html, authorization: 'Basic !!!' }).status, 401)
  assert.equal(open('/marketing/autopilot', { ...html, authorization: `Bearer test-admin-pass` }).status, 401)
  const admin = open('/marketing/autopilot?week=2026-11-16&openExternalBrowser=1', { ...html, authorization: basic('test-admin-pass') })
  assert.equal(admin.status, 200)
  assert.match(admin.headers.get('set-cookie') ?? '', /mk_role=admin/)
  const staff = open('/marketing/autopilot', { ...html, authorization: basic('test-staff-pass') })
  assert.equal(staff.status, 200)
  assert.match(staff.headers.get('set-cookie') ?? '', /mk_role=staff/)
})

await test('外から呼ばれる通り道（LINE の通知・計測リンクなど）は、これまでどおりパスワードなしで通る', async () => {
  for (const path of ['/api/marketing/line/webhook', '/api/marketing/go?dest=reserve', '/api/marketing/jobs/run', '/api/marketing/reservation-notify']) {
    assert.equal(open(path, { accept: 'text/html' }).status, 200, path)
  }
  // 名前が似ているだけのものは通さない
  assert.equal(open('/api/marketing/goal', { accept: 'application/json' }).status, 401)
})

console.log(`\n${passed} 件すべて通過`)
