// 公式LINEを、ブロックされにくくする決まり（2026-11-26 院長「次に公式lineをブロックしにくい設計に」）
// 実行: npx tsx tools/test-line-block-guard.mjs
// 外には送らない（fetch を差しかえて LINE・予約システムの返事をまねる）。KV は一時フォルダのファイル。データはすべて架空
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createHmac } from 'node:crypto'
import { register } from 'node:module'

const SRC = new URL('../src/', import.meta.url).href
register(
  'data:text/javascript,' +
    encodeURIComponent(
      `export async function resolve(s, c, next) { if (s.startsWith('@/')) s = ${JSON.stringify(SRC)} + s.slice(2); try { return await next(s, c) } catch (e) { if (!/\\.[a-z]+$/.test(s.split('?')[0])) return next(s + '.ts', c); throw e } }`,
    ),
)
const root = new URL('../', import.meta.url)
const imp = (p) => import(new URL(p, root).href)
const read = (p) => fs.readFileSync(new URL(p, root), 'utf8')

let passed = 0
async function test(name, fn) {
  await fn()
  passed += 1
  console.log(`  ✓ ${name}`)
}

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'line-block-'))
const cwd = process.cwd()
process.chdir(dir)
const realFetch = globalThis.fetch
const saved = { ...process.env }
for (const k of Object.keys(process.env)) if (/^(SUPABASE|NEXT_PUBLIC_SUPABASE|LINE_API_BASE_URL|MARKETING_)/.test(k)) delete process.env[k]
process.env.LINE_CHANNEL_ACCESS_TOKEN = 'line-token'
process.env.RESERVATION_NOTIFY_SECRET = 'notify-secret'
process.env.RESERVATION_NOTIFY_LINE_USER_ID = 'U00000000000000000000000000000000'

const HANAKO = `U${'a'.repeat(32)}`
const pushes = []
let insight = { status: 'ready', followers: 200, targetedReaches: 180, blocks: 14 }
globalThis.fetch = async (url, init) => {
  const u = String(url)
  if (u === 'https://api.line.me/v2/bot/message/push') {
    const body = JSON.parse(init.body)
    pushes.push({ to: body.to, message: body.messages[0] })
    return new Response('{}', { status: 200 })
  }
  if (u.startsWith('https://api.line.me/v2/bot/insight/followers?date=')) return new Response(JSON.stringify(insight), { status: 200 })
  if (u.includes('api=upcoming')) {
    const q = new URL(u).searchParams
    const ok = q.get('sig') === createHmac('sha256', 'notify-secret').update(`upcoming:${q.get('ts')}`).digest('hex')
    return new Response(JSON.stringify(ok ? { ok: true, today: '2030-03-11', now: '14:00', until: '2030-06-09', rows: [] } : { ok: false }), { status: 200 })
  }
  throw new Error(`外への通信はしない: ${u}`)
}

try {
  const { kvSet } = await imp('src/lib/marketing/kv-store-server.ts')
  const G = await imp('src/lib/line-block-guard.ts')
  const T = await imp('src/lib/marketing/line-touch-server.ts')
  const { pushToPatient } = await imp('src/lib/marketing/patient-line-push-server.ts')
  const { saveRule } = await imp('src/lib/marketing/automation-store-server.ts')
  const { recordEvent } = await imp('src/lib/marketing/analytics-store-server.ts')

  const NOW = new Date('2030-03-11T05:00:00Z') // 日本時間 14:00
  const ago = (hours) => new Date(NOW.getTime() - hours * 3600e3).toISOString()

  console.log('ブロックの直前に、何が届いていたか')
  await test('いちばん新しいお知らせ（その方あて・一斉配信の新しいほう）と、どのくらい前か', () => {
    assert.deepEqual(G.attributeBlock([{ at: ago(30), kind: 'reservation_remind' }, { at: ago(2), kind: 'followup' }], ago(50), NOW), { last: 'followup', within: '24h' })
    assert.deepEqual(G.attributeBlock([{ at: ago(30), kind: 'reservation_remind' }], ago(0.5), NOW), { last: 'broadcast', within: '1h' })
    assert.deepEqual(G.attributeBlock([{ at: ago(24 * 5), kind: 'birthday' }], null, NOW), { last: 'birthday', within: '7d' })
    // 30日より前・何も送っていない → 「何も送っていない」（そのお知らせが理由とは言えない）
    assert.deepEqual(G.attributeBlock([{ at: ago(24 * 40), kind: 'followup' }], null, NOW), { last: 'none', within: 'none' })
    assert.deepEqual(G.attributeBlock([], null, NOW), { last: 'none', within: 'none' })
    // 先の日時の記録は見ない
    assert.deepEqual(G.attributeBlock([{ at: ago(-5), kind: 'followup' }], null, NOW), { last: 'none', within: 'none' })
  })
  await test('送った記録：LINE の ID は残さない（印＝ハッシュ）。テストの見本は数えない', async () => {
    await saveRule('reservation_remind', { mode: 'on', dailyLimit: 80 })
    const r = await pushToPatient({ automation: 'reservation_remind', userId: HANAKO, text: '前日のお知らせ', note: 'テスト' })
    assert.equal(r.result, 'sent')
    const touches = await T.listTouches(HANAKO)
    assert.deepEqual(touches.map((t) => t.kind), ['reservation_remind'])
    const raw = fs.readFileSync(path.join(dir, '.data', 'marketing-kv.json'), 'utf8')
    assert.ok(!raw.includes(HANAKO), '生の LINE の ID を残さない')
    await saveRule('reservation_remind', { mode: 'test', dailyLimit: 80 })
    await pushToPatient({ automation: 'reservation_remind', userId: HANAKO, text: '前日のお知らせ', note: 'テスト' })
    assert.equal((await T.listTouches(HANAKO)).length, 1, 'テストの見本（院長あて）は、その方へ送った記録にしない')
    await saveRule('reservation_remind', { mode: 'on', dailyLimit: 80 })
  })
  await test('ブロックされたとき：種類と「どのくらい前か」だけを残す', async () => {
    await T.noteLinePush(HANAKO, 'followup', new Date(NOW.getTime() - 2 * 3600e3))
    const a = await T.blockAttribution(HANAKO, NOW)
    assert.deepEqual(a, { last: 'followup', within: '24h' })
    assert.deepEqual(await T.blockAttribution(`U${'f'.repeat(32)}`, NOW), { last: 'none', within: 'none' })
    const hook = read('src/app/api/marketing/line/webhook/route.ts')
    assert.match(hook, /await recordEvent\('line_unfollow', await blockAttribution\(userId\), userId\)/)
  })
  await test('古い記録は持たない（60日・30件まで）', async () => {
    const u = `U${'b'.repeat(32)}`
    await T.noteLinePush(u, 'birthday', new Date(NOW.getTime() - 70 * 86400e3))
    for (let i = 0; i < 35; i++) await T.noteLinePush(u, 'reservation_confirm', new Date(NOW.getTime() - (35 - i) * 3600e3))
    const list = await T.listTouches(u)
    assert.equal(list.length, G.TOUCH_KEEP_MAX)
    assert.ok(list.every((t) => t.kind === 'reservation_confirm'))
  })

  console.log('友だち全員への配信の歯止め')
  await test('30日に2回まで・前の配信から7日あける', () => {
    assert.equal(G.broadcastProblem([], NOW), null)
    assert.match(G.broadcastProblem([ago(24 * 3)], NOW), /7日あけます（前の配信は3日前）/)
    assert.match(G.broadcastProblem([ago(2)], NOW), /前の配信は今日/)
    assert.equal(G.broadcastProblem([ago(24 * 8)], NOW), null)
    assert.match(G.broadcastProblem([ago(24 * 8), ago(24 * 20)], NOW), /30日に2回まで[\s\S]*この30日で2回/)
    assert.equal(G.broadcastProblem([ago(24 * 8), ago(24 * 40)], NOW), null)
  })
  await test('配信の前に確かめ、超えるときは自動では配信しない（LINE の管理画面から手で）。配信したら記録する', async () => {
    assert.equal(await T.checkBroadcastAllowed(NOW), null)
    await T.noteBroadcast(new Date(NOW.getTime() - 86400e3))
    assert.match(await T.checkBroadcastAllowed(NOW), /7日あけます/)
    const pub = read('src/lib/marketing/publishers.ts')
    const at = pub.indexOf('async function publishLineBroadcast')
    const body = pub.slice(at, at + 1800)
    assert.ok(body.indexOf('checkBroadcastAllowed()') < body.indexOf('message/broadcast'), '配信の前に確かめる')
    assert.match(body, /if \(blocked\) \{\s*return \{ kind: 'action_required'/)
    assert.match(body, /await noteBroadcast\(\)\s*return \{ kind: 'published'/)
  })
  await test('投稿づくりの画面：公式LINE配信は、初めから選ばれていない。選んだら注意を出す', () => {
    const page = read('src/app/(app)/marketing/compose/page.tsx')
    assert.match(page, /useState<Channel\[\]>\(\['instagram_feed', 'google_business'\]\)/)
    assert.match(page, /channels\.includes\('line_broadcast'\) && \(/)
    // 毎週の自動投稿は、今までどおり LINE には配信しない
    assert.ok(!/line_broadcast/.test(read('src/lib/marketing/autopilot-server.ts').split('export function channelsFor')[1].slice(0, 300)))
  })

  console.log('止めたい方が、ブロックの手前で止められる')
  await test('「お知らせ設定」の言葉：設定を見たい・減らしたい言葉だけ。ふつうの相談・すぐ止める言葉には反応しない', () => {
    for (const t of ['お知らせ設定', 'お知らせの設定', '通知設定', '配信設定を変更したい', 'お知らせを減らしたい', '通知を止めたい', '「お知らせ設定」お願いします']) assert.equal(G.parseNoticeSettings(t), true, t)
    for (const t of ['配信停止', '予約のお知らせ停止', '予約したい', '設定', 'お知らせ', '膝が痛いのですが、お知らせ設定はどこですか']) assert.equal(G.parseNoticeSettings(t), false, t)
  })
  await test('返事：いまの受け取りと、すぐ押せるボタン（止める／再開する）。記録が無い方は「お送りしています」', () => {
    const a = G.noticeSettingsReply(null, 'ゆうき整骨院')
    assert.match(a.text, /ご予約のお知らせ（前日のお知らせ・キャンセル待ちのご案内）：お送りしています/)
    assert.match(a.text, /院からのご連絡（ご様子うかがい・誕生日のご挨拶）：お送りしています/)
    assert.match(a.text, /ご予約の確定・変更の控えは、お手続きのたびにお送りします。/)
    assert.deepEqual(a.buttons, ['予約のお知らせ停止', '配信停止'])
    const b = G.noticeSettingsReply({ reservation: false, marketing: true, updatedAt: 'x', source: 'line' }, 'ゆうき整骨院')
    assert.match(b.text, /前日のお知らせ・キャンセル待ちのご案内）：止めています/)
    assert.deepEqual(b.buttons, ['予約のお知らせ再開', '配信停止'])
  })
  await test('Webhook：「お知らせ設定」は、すぐ止める言葉のあと・「予約確認」の前に見る。返信（Reply）で返す', async () => {
    const { parseConsentCommand } = await imp('src/lib/marketing/consent.ts')
    for (const b of ['予約のお知らせ停止', '配信停止', '予約のお知らせ再開', '配信再開']) assert.ok(parseConsentCommand(b), b)
    const hook = read('src/app/api/marketing/line/webhook/route.ts')
    const consentAt = hook.indexOf('const consentCommand = parseConsentCommand(message.text')
    const settingsAt = hook.indexOf('if (parseNoticeSettings(message.text')
    const checkAt = hook.indexOf('if (parseReservationCheck(message.text')
    assert.ok(consentAt > 0 && consentAt < settingsAt && settingsAt < checkAt)
    assert.match(hook.slice(settingsAt, settingsAt + 1200), /message\/reply[\s\S]*quickReply/)
  })
  await test('ご来院が空いた方へのご連絡：文の下に「予約する」「配信停止」のボタン（押すと、その場で止まる）', async () => {
    const S = await imp('src/lib/marketing/followup-line-server.ts')
    const { saveLineLink } = await imp('src/lib/line-link-server.ts')
    const { sealUserId } = await imp('src/lib/liff-ticket.ts')
    const F = await imp('src/lib/followup-line.ts')
    await kvSet('sync:clinic', { payload: { pt_patients: JSON.stringify([{ id: 'p1', name: '山田 花子', phone: '090-1111-2222' }]), pt_visit_plans: '[]' }, updatedAt: '2030-03-01T00:00:00Z' })
    const u = `U${'c'.repeat(32)}`
    await saveLineLink({ key: 'karte:p1', name: '山田 花子', phone: '', patientId: 'p1', sealed: sealUserId(u, 'notify-secret'), linkedAt: '2030-01-01T00:00:00Z', via: 'qr' })
    const r = await S.sendFollowups([{ patientId: 'p1', name: '山田 花子' }], F.DEFAULT_FOLLOWUP_TEMPLATE, NOW)
    assert.equal(r.sent, 1)
    const sent = pushes.at(-1)
    assert.equal(sent.to, u)
    assert.deepEqual(sent.message.quickReply.items.map((i) => [i.action.type, i.action.label]), [['uri', '予約する'], ['message', '配信停止']])
    assert.equal(sent.message.quickReply.items[1].action.text, '配信停止')
    assert.deepEqual((await T.listTouches(u)).map((t) => t.kind), ['followup'])
  })
  await test('友だち追加のあいさつ：何が届くか・減らし方（「お知らせ設定」）を伝える', async () => {
    const L = await imp('src/lib/marketing/line-scenario.ts')
    for (const menu of ['classic', 'three']) {
      const text = L.intentMenu(menu).text
      assert.match(text, /^友だち追加ありがとうございます/)
      assert.match(text, /ご本人あてのご連絡です。お知らせを減らしたいときは「お知らせ設定」と送ってください。$/)
      assert.ok(text.length <= 500)
    }
  })

  console.log('数える')
  await test('ブロックの状況：友だち・ブロックの数（LINE の集計）と、この30日のブロックの直前のお知らせ（数だけ）', async () => {
    await recordEvent('line_unfollow', { last: 'followup', within: '24h' }, 'Ux1')
    await recordEvent('line_unfollow', { last: 'broadcast', within: '1h' }, 'Ux2')
    await recordEvent('line_unfollow', { last: 'broadcast', within: '24h' }, 'Ux3')
    await recordEvent('line_unfollow', {}, 'Ux4') // 記録を始める前の形
    const s = await T.blockStats(new Date())
    assert.deepEqual(s.insight && [s.insight.followers, s.insight.blocks, s.insight.reach], [200, 14, 186])
    assert.equal(s.last30.total, 4)
    assert.deepEqual(s.last30.byLast.map((r) => [r.kind, r.count]), [['broadcast', 2], ['followup', 1], ['unknown', 1]])
    assert.deepEqual(s.last30.byWithin.map((r) => [r.within, r.count]), [['1h', 1], ['24h', 2]])
    assert.ok(!/Ux1|userId/.test(JSON.stringify(s)))
    insight = { status: 'unready' }
    assert.equal((await T.blockStats(new Date())).insight, null, 'LINE の集計がまだのときは「—」')
    const route = read('src/app/api/marketing/line/block-stats/route.ts')
    assert.match(route, /requireAdmin\(request\)/)
  })
} finally {
  globalThis.fetch = realFetch
  for (const k of Object.keys(process.env)) if (!(k in saved)) delete process.env[k]
  Object.assign(process.env, saved)
  process.chdir(cwd)
  fs.rmSync(dir, { recursive: true, force: true })
}

console.log(`\n${passed} 件 OK`)
