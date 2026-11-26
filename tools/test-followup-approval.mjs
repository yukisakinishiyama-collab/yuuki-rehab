// ご来院が空いている方へのご連絡：院長の LINE での承認
// 2026-11-26 院長「日にちが開いての来院されていない患者の承認は私のlineに一度送って承認の確認をしてください」
// 実行: npx tsx tools/test-followup-approval.mjs
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

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'followup-ok-'))
const cwd = process.cwd()
process.chdir(dir)
const realFetch = globalThis.fetch
const saved = { ...process.env }
for (const k of Object.keys(process.env)) if (/^(SUPABASE|NEXT_PUBLIC_SUPABASE|LINE_API_BASE_URL|MARKETING_)/.test(k)) delete process.env[k]
process.env.LINE_CHANNEL_ACCESS_TOKEN = 'line-token'
process.env.RESERVATION_NOTIFY_SECRET = 'notify-secret'
process.env.RESERVATION_NOTIFY_LINE_USER_ID = 'U00000000000000000000000000000000'

const U = (c) => `U${c.repeat(32)}`
const OWNER = 'U00000000000000000000000000000000'

// 送ったもの（院長あて・患者さんあて）
const pushes = []
globalThis.fetch = async (url, init) => {
  const u = String(url)
  if (u === 'https://api.line.me/v2/bot/message/push') {
    const body = JSON.parse(init.body)
    pushes.push({ to: body.to, messages: body.messages })
    return new Response('{}', { status: 200 })
  }
  if (u.includes('api=upcoming')) {
    const q = new URL(u).searchParams
    const ok = q.get('sig') === createHmac('sha256', 'notify-secret').update(`upcoming:${q.get('ts')}`).digest('hex')
    return new Response(JSON.stringify(ok ? { ok: true, today: '2030-03-11', now: '09:00', until: '2030-06-09', rows: [] } : { ok: false }), { status: 200 })
  }
  throw new Error(`外への通信はしない: ${u}`)
}
const toOwner = () => pushes.filter((p) => p.to === OWNER)
const toPatients = () => pushes.filter((p) => p.to !== OWNER)
const textOf = (m) => (typeof m.text === 'string' ? m.text : JSON.stringify(m))

try {
  const { kvSet } = await imp('src/lib/marketing/kv-store-server.ts')
  const { saveLineLink } = await imp('src/lib/line-link-server.ts')
  const { sealUserId } = await imp('src/lib/liff-ticket.ts')
  const A = await imp('src/lib/followup-approval.ts')
  const F = await imp('src/lib/followup-line.ts')
  const S = await imp('src/lib/marketing/followup-approval-server.ts')

  // 日本時間 2030-03-11 は月曜
  const jst = (date, hour, min = 0) => new Date(Date.parse(`${date}T00:00:00Z`) + (hour - 9) * 3600e3 + min * 60e3)
  const MON_9 = jst('2030-03-11', 9, 5)
  const MON_14 = jst('2030-03-11', 14)
  const MON_23 = jst('2030-03-11', 23)
  const TUE_8 = jst('2030-03-12', 8, 10)

  console.log('決まり')
  await test('ボタンの中身：決まった形だけを読む。送ってよい時間は8〜20時。お願いは72時間で期限切れ', () => {
    assert.equal(A.followupPostback('ok', 'abcDEF12345_', 'all'), 'fu:ok:abcDEF12345_:all')
    assert.deepEqual(A.parseFollowupPostback('fu:ok:abcDEF12345_:3'), { action: 'ok', id: 'abcDEF12345_', target: 3 })
    assert.deepEqual(A.parseFollowupPostback('fu:pick:abcDEF12345_:all'), { action: 'pick', id: 'abcDEF12345_', target: 'all' })
    for (const bad of ['fu:send:abcDEF12345_:all', 'fu:ok:short:all', 'fu:ok:abcDEF12345_:x', 'ap:ok:abcDEF12345_:all', 'fu:ok:abcDEF12345_:all:extra']) assert.equal(A.parseFollowupPostback(bad), null, bad)
    assert.equal(A.inFollowupSendHours(jst('2030-03-11', 8)), true)
    assert.equal(A.inFollowupSendHours(jst('2030-03-11', 19, 59)), true)
    assert.equal(A.inFollowupSendHours(jst('2030-03-11', 20)), false)
    assert.equal(A.inFollowupSendHours(jst('2030-03-11', 7, 59)), false)
    assert.equal(A.requestExpired({ createdAt: MON_9.toISOString() }, new Date(MON_9.getTime() + 71 * 3600e3)), false)
    assert.equal(A.requestExpired({ createdAt: MON_9.toISOString() }, new Date(MON_9.getTime() + 73 * 3600e3)), true)
  })
  await test('毎週のお願い：月曜の9〜12時に、その日1回だけ', () => {
    assert.equal(A.weeklyRequestDue(MON_9, undefined), true)
    assert.equal(A.weeklyRequestDue(MON_9, '2030-03-04'), true)
    assert.equal(A.weeklyRequestDue(MON_9, '2030-03-11'), false)
    assert.equal(A.weeklyRequestDue(jst('2030-03-11', 8, 59), undefined), false)
    assert.equal(A.weeklyRequestDue(jst('2030-03-11', 12), undefined), false)
    assert.equal(A.weeklyRequestDue(jst('2030-03-12', 9, 5), undefined), false, '火曜は出さない')
  })

  // 架空のカルテ・LINE 連携・カルテの記録（最後のご来院）
  const kartes = [
    { id: 'p1', name: '山田 花子', phone: '090-1111-2222', status: 'active' },
    { id: 'p2', name: '鈴木 次郎', phone: '090-2222-3333', status: 'active' },
    { id: 'p3', name: '佐藤 三郎', phone: '090-3333-4444', status: 'active' }, // LINE 連携なし
    { id: 'p4', name: '高橋 四郎', phone: '090-4444-5555', status: 'active' }, // 先週来た
  ]
  const notes = [
    { id: 'n1', patientId: 'p1', visitDate: '2030-02-05' },
    { id: 'n2', patientId: 'p2', visitDate: '2030-01-20' },
    { id: 'n3', patientId: 'p3', visitDate: '2030-01-10' },
    { id: 'n4', patientId: 'p4', visitDate: '2030-03-05' },
  ]
  await kvSet('sync:clinic', { payload: { pt_patients: JSON.stringify(kartes), pt_soap_notes: JSON.stringify(notes), pt_visit_plans: '[]' }, updatedAt: '2030-03-01T00:00:00Z' })
  const link = (id, name, user) => saveLineLink({ key: `karte:${id}`, name, phone: '', patientId: id, sealed: sealUserId(user, 'notify-secret'), linkedAt: '2030-01-01T00:00:00Z', via: 'qr' })
  await link('p1', '山田 花子', U('a'))
  await link('p2', '鈴木 次郎', U('b'))
  await link('p4', '高橋 四郎', U('d'))
  const P1 = { patientId: 'p1', name: '山田 花子', lastVisit: '2030-02-05', days: 34 }
  const P2 = { patientId: 'p2', name: '鈴木 次郎', lastVisit: '2030-01-20', days: 50 }
  const P3 = { patientId: 'p3', name: '佐藤 三郎', lastVisit: '2030-01-10', days: 60 }
  const reset = () => kvSet('keiei:followup-log', { sent: {}, recent: [] })

  console.log('承認のお願い')
  let id1 = ''
  await test('お願いは院長の LINE にだけ届く（だれに・どんな文か・ボタン）。患者さんには、まだ何も送らない', async () => {
    const r = await S.createFollowupRequest([P1, P2, P3], F.DEFAULT_FOLLOWUP_TEMPLATE, 'page', MON_14)
    assert.equal(r.ok, true)
    assert.equal(r.count, 3)
    id1 = r.id
    assert.equal(toPatients().length, 0)
    assert.equal(toOwner().length, 1)
    const [text, sample, card] = toOwner()[0].messages
    assert.match(text.text, /承認のお願い/)
    assert.match(text.text, /次の 3人の LINE へ、ご様子うかがいを送ってよいですか？/)
    assert.match(text.text, /1\. 山田 花子 様（最後のご来院 2月5日・34日前）/)
    assert.match(text.text, /押さなければ、だれにも送りません。/)
    assert.match(sample.text, /【患者さんに届く文】（山田 花子 様の場合）[\s\S]*山田 花子 様[\s\S]*配信停止/)
    const buttons = card.contents.footer.contents.map((b) => [b.action.label, b.action.data])
    assert.deepEqual(buttons, [['全員に送る（3人）', `fu:ok:${id1}:all`], ['1人ずつ選ぶ', `fu:pick:${id1}:all`], ['今回は送らない', `fu:no:${id1}:all`]])
  })
  await test('お願いを作れないとき：文に問題・だれも選んでいない・10人より多い（院長にも送らない）', async () => {
    const before = pushes.length
    assert.equal((await S.createFollowupRequest([P1], '{name} 様 必ず治ります', 'page', MON_14)).ok, false)
    assert.equal((await S.createFollowupRequest([], F.DEFAULT_FOLLOWUP_TEMPLATE, 'page', MON_14)).ok, false)
    const many = Array.from({ length: 11 }, (_, i) => ({ patientId: `x${i}`, name: 'だれか' }))
    assert.match((await S.createFollowupRequest(many, F.DEFAULT_FOLLOWUP_TEMPLATE, 'page', MON_14)).error, /10人まで/)
    assert.equal(pushes.length, before)
  })

  console.log('院長が LINE のボタンを押す')
  await test('「1人ずつ選ぶ」：1人に1枚のカード（この方に送る・見送る）。まだ送らない', async () => {
    const replies = await S.handleFollowupPostback(`fu:pick:${id1}:all`, MON_14)
    assert.equal(toPatients().length, 0)
    const carousel = replies[1]
    assert.equal(carousel.contents.type, 'carousel')
    assert.equal(carousel.contents.contents.length, 3)
    const first = carousel.contents.contents[0]
    assert.match(first.body.contents[0].text, /山田 花子 様/)
    assert.deepEqual(first.footer.contents.map((b) => b.action.data), [`fu:ok:${id1}:0`, `fu:no:${id1}:0`])
  })
  await test('「この方に送る」：その方にだけ送る（送る直前に、もう一度確かめる）', async () => {
    const replies = await S.handleFollowupPostback(`fu:ok:${id1}:0`, MON_14)
    assert.equal(toPatients().length, 1)
    assert.equal(toPatients()[0].to, U('a'))
    assert.match(toPatients()[0].messages[0].text, /^山田 花子 様\n/)
    assert.match(textOf({ text: replies[0] }), /✅ 送りました（1人）：山田 花子 様/)
    assert.match(replies[0], /あと 2人は、まだ選んでいません/)
    const again = await S.handleFollowupPostback(`fu:ok:${id1}:0`, MON_14)
    assert.match(again[0], /もう対応済み/)
    assert.equal(toPatients().length, 1, '同じボタンを2回押しても、1通だけ')
  })
  await test('「見送る」：その方には送らない', async () => {
    const replies = await S.handleFollowupPostback(`fu:no:${id1}:1`, MON_14)
    assert.match(replies[0], /見送りました（1人）：鈴木 次郎 様/)
    assert.equal(toPatients().length, 1)
  })
  await test('承認しても、送れない方（LINE 連携なし）には送らず、理由を返す', async () => {
    const replies = await S.handleFollowupPostback(`fu:ok:${id1}:all`, MON_14)
    assert.match(replies[0], /⚠️ 佐藤 三郎 様には送っていません：LINE と結びついていません/)
    assert.equal(toPatients().length, 1)
    assert.match((await S.handleFollowupPostback(`fu:ok:${id1}:all`, MON_14))[0], /すべて対応済み/)
    const stored = await S.getFollowupRequest(id1)
    assert.deepEqual(stored.people.map((p) => p.status), ['sent', 'declined', 'skipped'])
  })
  await test('「全員に送る」：承認した方へ送る。「今回は送らない」：だれにも送らない', async () => {
    await reset()
    const a = await S.createFollowupRequest([P1, P2], F.DEFAULT_FOLLOWUP_TEMPLATE, 'page', MON_14)
    const before = toPatients().length
    const replies = await S.handleFollowupPostback(`fu:ok:${a.id}:all`, MON_14)
    assert.equal(toPatients().length, before + 2)
    assert.match(replies[0], /✅ 送りました（2人）：山田 花子 様・鈴木 次郎 様/)
    await reset()
    const b = await S.createFollowupRequest([P1, P2], F.DEFAULT_FOLLOWUP_TEMPLATE, 'page', MON_14)
    const n = toPatients().length
    assert.match((await S.handleFollowupPostback(`fu:no:${b.id}:all`, MON_14))[0], /見送りました（2人）/)
    assert.equal(toPatients().length, n)
    assert.match((await S.handleFollowupPostback(`fu:ok:${b.id}:all`, MON_14))[0], /すべて対応済み/)
    assert.equal(toPatients().length, n, '見送ったあとに「全員に送る」を押しても送らない')
  })
  await test('期限切れ・知らないお願い・形のちがうボタンでは、だれにも送らない', async () => {
    await reset()
    const a = await S.createFollowupRequest([P1], F.DEFAULT_FOLLOWUP_TEMPLATE, 'page', MON_14)
    const n = toPatients().length
    assert.match((await S.handleFollowupPostback(`fu:ok:${a.id}:all`, new Date(MON_14.getTime() + 73 * 3600e3)))[0], /期限が切れています（だれにも送っていません）/)
    assert.match((await S.handleFollowupPostback('fu:ok:zzzzzzzzzzzz:all', MON_14))[0], /見つかりません/)
    assert.match((await S.handleFollowupPostback('fu:ok:../../x:all', MON_14))[0], /使えません/)
    assert.equal(toPatients().length, n)
  })
  await test('夜に承認したら、その場では送らず、次の朝8時すぎに送る（送ったら院長へ結果）', async () => {
    await reset()
    const a = await S.createFollowupRequest([P1, P2], F.DEFAULT_FOLLOWUP_TEMPLATE, 'page', MON_23)
    const n = toPatients().length
    const replies = await S.handleFollowupPostback(`fu:ok:${a.id}:all`, MON_23)
    assert.match(replies[0], /🌙 夜のため、次の朝8時すぎにお送りします（2人）/)
    assert.equal(toPatients().length, n)
    assert.deepEqual(await S.runFollowupQueue(jst('2030-03-12', 7, 30)), { sent: 0, skipped: 0 })
    assert.equal(toPatients().length, n)
    const ownerBefore = toOwner().length
    assert.deepEqual(await S.runFollowupQueue(TUE_8), { sent: 2, skipped: 0 })
    assert.equal(toPatients().length, n + 2)
    assert.match(toOwner().at(-1).messages[0].text, /夜に承認いただいたご連絡を、お送りしました。[\s\S]*送りました（2人）/)
    assert.equal(toOwner().length, ownerBefore + 1)
    assert.deepEqual(await S.runFollowupQueue(new Date(TUE_8.getTime() + 15 * 60e3)), { sent: 0, skipped: 0 }, '次の回には重ねて送らない')
    assert.equal(toPatients().length, n + 2)
  })

  console.log('毎週のお願い（自動）')
  await test('月曜の朝、クラウドのカルテから候補を出して、院長の LINE へ（患者さんには送らない）。LINE で送れる方だけ', async () => {
    await reset()
    await kvSet('keiei:followup-proposed', {})
    const n = toPatients().length
    const ownerBefore = toOwner().length
    const r = await S.proposeWeeklyFollowups(MON_9)
    assert.deepEqual(r, { proposed: 2 })
    assert.equal(toPatients().length, n)
    assert.equal(toOwner().length, ownerBefore + 1)
    const text = toOwner().at(-1).messages[0].text
    assert.match(text, /今週の候補です。/)
    assert.match(text, /山田 花子 様（最後のご来院 2月5日・34日前）/)
    assert.match(text, /鈴木 次郎 様（最後のご来院 1月20日・50日前）/)
    assert.ok(!/佐藤 三郎|高橋 四郎/.test(text), 'LINE 連携の無い方・先週来た方は候補にしない')
  })
  await test('同じ日に重ねて送らない。次の週も、同じ方は60日のうちは候補に出さない', async () => {
    const ownerBefore = toOwner().length
    assert.equal((await S.proposeWeeklyFollowups(new Date(MON_9.getTime() + 15 * 60e3))).proposed, 0)
    const next = await S.proposeWeeklyFollowups(jst('2030-03-18', 9, 5))
    // 山田さん・鈴木さんは先週お願いに出した。残るのは LINE 連携の無い佐藤さんだけ
    assert.deepEqual([next.proposed, next.reason], [0, 'LINE で送れる候補なし'])
    assert.equal(toOwner().length, ownerBefore)
  })
  await test('確定の LINE を送った予約が最近あれば、候補にしない（カルテに記録が無くても「来ている」とみる）', async () => {
    await kvSet('keiei:followup-proposed', {})
    await kvSet('keiei:followup-settings', { weekly: true, minDays: 30, template: F.DEFAULT_FOLLOWUP_TEMPLATE })
    await kvSet('linesent:R900', { reservationNo: 'R900', key: '09011112222|山田花子', date: '2030-03-08', time: '10:00', sentAt: '2030-03-01T00:00:00Z' })
    const list = await S.cloudFollowupCandidates(30, MON_9)
    assert.deepEqual(list.map((c) => c.patientId), ['p2', 'p3'])
  })
  await test('止めているとき・月曜の朝でないときは、何も送らない。設定は画面から変えられる', async () => {
    const s = await S.saveFollowupSettings({ weekly: false, minDays: 60 })
    assert.deepEqual([s.weekly, s.minDays], [false, 60])
    const ownerBefore = toOwner().length
    assert.match((await S.proposeWeeklyFollowups(jst('2030-03-25', 9, 5))).reason, /止めています/)
    await S.saveFollowupSettings({ weekly: true })
    assert.match((await S.proposeWeeklyFollowups(jst('2030-03-26', 9, 5))).reason, /出す時間ではない/)
    assert.equal(toOwner().length, ownerBefore)
    await assert.rejects(() => S.saveFollowupSettings({ template: '{name} 様 絶対に治ります' }), /使えない言い方/)
    assert.equal((await S.saveFollowupSettings({ minDays: 45 })).minDays, 60, '決まった日数だけ')
    assert.equal((await S.getFollowupSettings()).weekly, true)
  })

  console.log('しくみ')
  await test('ボタンを処理するのは、院長の LINE から届いたときだけ（ほかの人が同じ言葉を送っても動かない）', () => {
    const hook = read('src/app/api/marketing/line/webhook/route.ts')
    const at = hook.indexOf('if (data.startsWith(FOLLOWUP_POSTBACK_PREFIX))')
    assert.ok(at > 0)
    const block = hook.slice(at, at + 900)
    assert.match(block, /if \(isOwnerLineUser\(userId\)\) \{[\s\S]*handleFollowupPostback\(data\)/)
    assert.match(block, /continue\n\s*\}\n\s*input = \{ kind: 'postback', data \}/, 'ほかの人のときは、会話にも流さず終わる')
  })
  await test('定期実行は「夜に承認した分を朝に送る」「毎週のお願いを院長へ」だけ。承認の無い方へは送らない', () => {
    const jobs = read('src/app/api/marketing/jobs/run/route.ts')
    assert.match(jobs, /runFollowupQueue\(\)/)
    assert.match(jobs, /proposeWeeklyFollowups\(\)/)
    assert.ok(!/sendFollowups/.test(jobs))
    const server = read('src/lib/marketing/followup-approval-server.ts')
    // 患者さんへ送るのは sendApproved だけ。呼ぶのは「承認のボタン（ok）」と「承認済みの朝の分」だけ
    assert.equal((server.match(/await sendApproved\(/g) ?? []).length, 2)
    assert.match(server, /const targets = value\.people\.filter\(\(p\) => p\.status === 'approved'\)/)
  })
} finally {
  globalThis.fetch = realFetch
  for (const k of Object.keys(process.env)) if (!(k in saved)) delete process.env[k]
  Object.assign(process.env, saved)
  process.chdir(cwd)
  fs.rmSync(dir, { recursive: true, force: true })
}

console.log(`\n${passed} 件 OK`)
