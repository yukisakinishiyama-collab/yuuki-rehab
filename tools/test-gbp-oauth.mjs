// 「Googleとつなぐ」の試験（店舗IDなどはすべて架空。通信はモック）
// 実行: node tools/test-gbp-oauth.mjs
import { gbpAuthorizeUrl, gbpOAuthConfig, findGbpLocations, pickClinicLocation, exchangeGbpCode } from '../src/lib/marketing/gbp-oauth-server.ts'

let passed = 0
let failed = 0
const check = (label, condition, detail) => {
  if (condition) { passed += 1; console.log(`  ✓ ${label}`) }
  else { failed += 1; console.log(`  ✗ ${label}${detail !== undefined ? `\n      実際: ${JSON.stringify(detail)}` : ''}`) }
}

console.log('設定')
delete process.env.GBP_CLIENT_ID; delete process.env.GBP_CLIENT_SECRET; delete process.env.GBP_OAUTH_REDIRECT_BASE
check('値が無いときは ready=false', gbpOAuthConfig('https://example.test').ready === false)
process.env.GBP_CLIENT_ID = 'dummy-client.apps.googleusercontent.com'
process.env.GBP_CLIENT_SECRET = 'dummy-secret'
const cfg = gbpOAuthConfig('https://example.test')
check('値があれば ready=true', cfg.ready === true)
check('戻り先は /api/marketing/google/callback', cfg.redirectUri === 'https://example.test/api/marketing/google/callback', cfg.redirectUri)
process.env.GBP_OAUTH_REDIRECT_BASE = 'https://fixed.test'
check('戻り先のベースは上書きできる', gbpOAuthConfig('https://example.test').redirectUri === 'https://fixed.test/api/marketing/google/callback')

console.log('許可画面のURL')
const u = new URL(gbpAuthorizeUrl('cid', 'https://fixed.test/cb', 'st-1'))
check('Googleの許可画面', u.origin === 'https://accounts.google.com')
check('投稿の権限だけを求める', u.searchParams.get('scope') === 'https://www.googleapis.com/auth/business.manage')
check('リフレッシュトークンを受け取る（offline + consent）', u.searchParams.get('access_type') === 'offline' && u.searchParams.get('prompt') === 'consent')
check('stateを付ける', u.searchParams.get('state') === 'st-1')

console.log('店舗の選び方')
check('0件なら null', pickClinicLocation([]) === null)
check('院名を含む店舗を選ぶ', pickClinicLocation([{ name: 'accounts/1/locations/2', title: '別の店' }, { name: 'accounts/1/locations/3', title: 'ゆうき整骨院' }])?.name === 'accounts/1/locations/3')
check('院名が無ければ最初の1件', pickClinicLocation([{ name: 'accounts/1/locations/9', title: 'A' }])?.name === 'accounts/1/locations/9')

console.log('通信（モック）')
const realFetch = globalThis.fetch
globalThis.fetch = async (url) => {
  const s = String(url)
  if (s.startsWith('https://mybusinessaccountmanagement.googleapis.com/v1/accounts')) {
    return new Response(JSON.stringify({ accounts: [{ name: 'accounts/111' }, { name: 'bad' }] }), { status: 200 })
  }
  if (s.startsWith('https://mybusinessbusinessinformation.googleapis.com/v1/accounts/111/locations')) {
    return new Response(JSON.stringify({ locations: [{ name: 'locations/222', title: 'ゆうき整骨院' }, { name: 'oops' }] }), { status: 200 })
  }
  if (s === 'https://oauth2.googleapis.com/token') {
    return new Response(JSON.stringify({ access_token: 'at', refresh_token: 'rt' }), { status: 200 })
  }
  return new Response('{}', { status: 404 })
}
const locs = await findGbpLocations('at')
check('投稿APIの形（accounts/…/locations/…）にする', locs.length === 1 && locs[0].name === 'accounts/111/locations/222', locs)
const tok = await exchangeGbpCode({ code: 'c', clientId: 'cid', clientSecret: 's', redirectUri: 'https://fixed.test/cb' })
check('コードをリフレッシュトークンに交換', tok.refreshToken === 'rt' && tok.accessToken === 'at')
globalThis.fetch = async () => new Response(JSON.stringify({ access_token: 'at' }), { status: 200 })
let threw = false
try { await exchangeGbpCode({ code: 'c', clientId: 'cid', clientSecret: 's', redirectUri: 'x' }) } catch { threw = true }
check('リフレッシュトークンが無ければ失敗にする', threw)
globalThis.fetch = realFetch

console.log(`\n${passed}件成功 / ${failed}件失敗`)
if (failed > 0) process.exit(1)
