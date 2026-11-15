// 院長のLINEへ送るお知らせのリンク（院内アプリのものは、端末のブラウザで開かせる）の確認
// 実行: npx tsx tools/marketing/test-line-links.mjs   （外には送らない。LINE へ送るところは、にせの送り先に差しかえる）
import assert from 'node:assert/strict'
import { APP_ORIGIN, externalBrowserText, externalBrowserUrl, isAppUrl, withExternalBrowserLinks } from '../../src/lib/marketing/line-links.ts'
import { notifyOwner, ownerCard, replyOwner } from '../../src/lib/marketing/owner-notify.ts'

let passed = 0
async function test(name, fn) {
  await fn()
  passed += 1
  console.log(`  ✓ ${name}`)
}

const APP = 'https://yuuki-rehab.vercel.app'

await test('院内アプリのリンクかどうか：似た名前の別のサイトは数えない', () => {
  assert.equal(APP_ORIGIN, APP)
  assert.equal(isAppUrl(`${APP}/marketing/autopilot?week=2026-11-16`), true)
  assert.equal(isAppUrl(`${APP}`), true)
  assert.equal(isAppUrl('https://yuuki-rehab.vercel.app.example.com/marketing'), false)
  assert.equal(isAppUrl('https://example.com/?next=https://yuuki-rehab.vercel.app/marketing'), false)
  assert.equal(isAppUrl('http://yuuki-rehab.vercel.app/marketing'), false)
  assert.equal(isAppUrl('https://shimonoseki-yuuki.com/first-visit'), false)
  assert.equal(isAppUrl('https://business.google.com/'), false)
  assert.equal(isAppUrl('まだ決まっていません'), false)
})

await test('院内アプリのリンクに「端末のブラウザで開く」印を付ける（もとの文字は変えない）', () => {
  assert.equal(externalBrowserUrl(`${APP}/marketing/jobs`), `${APP}/marketing/jobs?openExternalBrowser=1`)
  assert.equal(externalBrowserUrl(`${APP}/marketing/autopilot?week=2026-11-16`), `${APP}/marketing/autopilot?week=2026-11-16&openExternalBrowser=1`)
  // # の前に入れる（後ろに付けると、LINE にもアプリにも届かない）
  assert.equal(
    externalBrowserUrl(`${APP}/marketing/autopilot?open=settings#promo-video`),
    `${APP}/marketing/autopilot?open=settings&openExternalBrowser=1#promo-video`,
  )
  // 画像・動画（パスワードの内側）も同じ。日本語や % の入った値は書きかえない
  const image = `${APP}/api/marketing/image?title=${encodeURIComponent('足首の捻挫')}&photo=https%3A%2F%2Fexample.blob.vercel-storage.com%2Fa%20b.png&size=instagram`
  assert.equal(externalBrowserUrl(image), `${image}&openExternalBrowser=1`)
})

await test('もう付いているもの・ほかのサイト・長すぎるものは、そのまま', () => {
  const done = `${APP}/marketing/jobs?openExternalBrowser=1`
  assert.equal(externalBrowserUrl(done), done)
  assert.equal(externalBrowserUrl(externalBrowserUrl(`${APP}/marketing/jobs`)), done)
  assert.equal(externalBrowserUrl('https://business.google.com/'), 'https://business.google.com/')
  assert.equal(externalBrowserUrl('https://shimonoseki-yuuki.com/first-visit?utm_source=google_post'), 'https://shimonoseki-yuuki.com/first-visit?utm_source=google_post')
  assert.equal(externalBrowserUrl('https://line.me/'), 'https://line.me/')
  // LINE のボタンのリンクは1000文字まで。こえるなら付けない（お知らせごと送れなくなるのを防ぐ）
  const head = `${APP}/api/marketing/image?title=`
  const long = `${head}${'a'.repeat(990 - head.length)}`
  assert.ok(long.length <= 1000 && `${long}&openExternalBrowser=1`.length > 1000)
  assert.equal(externalBrowserUrl(long), long)
})

await test('文の中のリンクにも付ける（後ろの日本語や句読点は巻きこまない）', () => {
  assert.equal(
    externalBrowserText(`承認しました。\n\n内容の確認・取り消しはこちら：\n${APP}/marketing/autopilot?week=2026-11-16`),
    `承認しました。\n\n内容の確認・取り消しはこちら：\n${APP}/marketing/autopilot?week=2026-11-16&openExternalBrowser=1`,
  )
  assert.equal(externalBrowserText(`画面（${APP}/marketing/jobs）を開いてください。`), `画面（${APP}/marketing/jobs?openExternalBrowser=1）を開いてください。`)
  assert.equal(externalBrowserText(`See ${APP}/marketing/jobs.`), `See ${APP}/marketing/jobs?openExternalBrowser=1.`)
  assert.equal(
    externalBrowserText(`${APP}/marketing/jobs と https://business.google.com/ と ${APP}/marketing/sales`),
    `${APP}/marketing/jobs?openExternalBrowser=1 と https://business.google.com/ と ${APP}/marketing/sales?openExternalBrowser=1`,
  )
  // 似た名前の別のサイトは変えない
  assert.equal(externalBrowserText('https://yuuki-rehab.vercel.app.example.com/x'), 'https://yuuki-rehab.vercel.app.example.com/x')
  assert.equal(externalBrowserText('リンクのない文'), 'リンクのない文')
})

await test('カード：押すと開くボタンだけ直す。承認のボタン・画像や動画そのもの・もとのカードは変えない', () => {
  const card = ownerCard('来週の投稿案ができました', '📝 投稿案ができました', [
    { label: '内容を確認する', uri: `${APP}/marketing/autopilot?week=2026-11-16`, primary: true },
    { label: 'このまま全部承認', postback: 'ap:approve_all:2026-11-16' },
    { label: 'Googleを開く', uri: 'https://business.google.com/' },
  ])
  const before = JSON.stringify(card)
  const fixed = withExternalBrowserLinks(card)
  assert.equal(JSON.stringify(card), before)
  const actions = fixed.contents.footer.contents.map((b) => b.action)
  assert.equal(actions[0].uri, `${APP}/marketing/autopilot?week=2026-11-16&openExternalBrowser=1`)
  assert.deepEqual(actions[1], { type: 'postback', label: 'このまま全部承認', data: 'ap:approve_all:2026-11-16', displayText: 'このまま全部承認' })
  assert.equal(actions[2].uri, 'https://business.google.com/')
  assert.equal(fixed.altText, '来週の投稿案ができました')

  const video = { type: 'video', originalContentUrl: `${APP}/api/marketing/promo-video?id=x&kind=video`, previewImageUrl: `${APP}/api/marketing/promo-video?id=x&kind=poster` }
  assert.deepEqual(withExternalBrowserLinks(video), video)
  assert.deepEqual(withExternalBrowserLinks({ type: 'text', text: `${APP}/marketing/jobs` }), { type: 'text', text: `${APP}/marketing/jobs?openExternalBrowser=1` })
})

await test('つなぎ：院長へ送る直前に直る（push も reply も。にせの送り先で確かめる）', async () => {
  const realFetch = globalThis.fetch
  const env = { ...process.env }
  const sent = []
  globalThis.fetch = async (url, init) => {
    sent.push({ url: String(url), body: JSON.parse(init.body) })
    return new Response('{}', { status: 200 })
  }
  process.env.LINE_CHANNEL_ACCESS_TOKEN = 'test-token'
  process.env.RESERVATION_NOTIFY_LINE_USER_ID = 'Utest'
  delete process.env.MARKETING_MODE
  try {
    const result = await notifyOwner([
      ownerCard('投稿案', '本文', [{ label: '内容を確認する', uri: `${APP}/marketing/autopilot?week=2026-11-16`, primary: true }]),
      `内容の確認はこちら：\n${APP}/marketing/autopilot?week=2026-11-16`,
    ])
    assert.equal(result.delivered, true)
    await replyOwner('reply-token', [`承認しました。\n${APP}/marketing/jobs`])
  } finally {
    globalThis.fetch = realFetch
    process.env = env
  }
  assert.equal(sent.length, 2)
  assert.ok(sent[0].url.endsWith('/v2/bot/message/push'))
  assert.equal(sent[0].body.to, 'Utest')
  assert.equal(sent[0].body.messages[0].contents.footer.contents[0].action.uri, `${APP}/marketing/autopilot?week=2026-11-16&openExternalBrowser=1`)
  assert.equal(sent[0].body.messages[1].text, `内容の確認はこちら：\n${APP}/marketing/autopilot?week=2026-11-16&openExternalBrowser=1`)
  assert.ok(sent[1].url.endsWith('/v2/bot/message/reply'))
  assert.equal(sent[1].body.messages[0].text, `承認しました。\n${APP}/marketing/jobs?openExternalBrowser=1`)
})

console.log(`\n${passed} 件すべて通過`)
