// 公式LINEの「予約確認」（2026-11-25 院長「公式lineで患者様側から日程を確認して返信が来るような設定はできますか？（予約確認です）」）
// 実行: npx tsx tools/test-reservation-check.mjs
// 外には送らない（fetch を差しかえて予約システムの返事をまねる）。KV は一時フォルダのファイル。データはすべて架空
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

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rsv-check-'))
const cwd = process.cwd()
process.chdir(dir)
const realFetch = globalThis.fetch
const saved = { ...process.env }
for (const k of Object.keys(process.env)) if (/^(SUPABASE|NEXT_PUBLIC_SUPABASE|LINE_RESERVATION_CHECK)/.test(k)) delete process.env[k]
process.env.RESERVATION_NOTIFY_SECRET = 'notify-secret'

// 架空の LINE（形は本物と同じ U＋16進32文字）
const HANAKO = 'Uaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' // カルテの QR で結びついた方（ご家族2人のカルテ）
const LINER = 'Ubbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb' // LINE から予約した方（カルテとは結びついていない）
const NOBODY = 'Ucccccccccccccccccccccccccccccccc' // だれとも結びついていない LINE
const EMPTY = 'Udddddddddddddddddddddddddddddddd' // 結びついているが、これからの予約が無い方

// 予約システムの返事をまねる
let gas = { status: 'ok', rows: [] }
const calls = []
globalThis.fetch = async (url) => {
  const u = new URL(String(url))
  if (u.searchParams.get('api') === 'upcoming') {
    calls.push(u)
    if (gas.status === 'down') throw new Error('network')
    if (gas.status === 'unauthorized') return new Response(JSON.stringify({ ok: false, error: 'unauthorized' }), { status: 200 })
    return new Response(JSON.stringify({ ok: true, today: '2030-01-10', now: '11:00', until: '2030-04-10', rows: gas.rows }), { status: 200 })
  }
  throw new Error(`外への通信はしない: ${url}`)
}

try {
  const C = await imp('src/lib/reservation-check.ts')
  const S = await imp('src/lib/marketing/reservation-check-server.ts')
  const { kvSet } = await imp('src/lib/marketing/kv-store-server.ts')
  const { saveLineLink } = await imp('src/lib/line-link-server.ts')
  const { sealUserId } = await imp('src/lib/liff-ticket.ts')
  const { reservationChangeUrl } = await imp('src/lib/reservation-change-link.ts')
  const seal = (u) => sealUserId(u, 'notify-secret')

  await test('言葉：「予約確認」とその言いかえだけに反応する', () => {
    for (const t of ['予約確認', ' 予約確認 ', '予約の確認', '予約確認お願いします', '予約を確認したいです', 'ご予約の確認', '予約日時', '予約の日程を教えてください', '次の予約', '次の予約はいつですか？', '予約いつでしたっけ', '予約状況', '私の予約の確認']) {
      assert.equal(C.parseReservationCheck(t), true, t)
    }
    // 予約を取りたい・変えたい・ふつうの相談には反応しない
    for (const t of ['予約', '予約したい', '予約お願いします', '予約を変更したい', '予約のキャンセル', '明日の予約を確認したいのですが、時間を変えられますか', '確認', 'こんにちは', '', '予約確認'.repeat(5), '予約のお知らせ停止']) {
      assert.equal(C.parseReservationCheck(t), false, t)
    }
    assert.equal(C.RESERVATION_CHECK_KEYWORD, '予約確認')
  })

  // カルテと LINE 連携
  const kartes = [
    { id: 'p_hanako', name: '架空 花子', phone: '090-1111-2222' },
    { id: 'p_child', name: '架空 一郎', phone: '' }, // お子さん（電話なし。お母さんの LINE と QR で結びついた）
    { id: 'p_other', name: '別人 太郎', phone: '090-9999-0000' },
    { id: 'p_empty', name: '予定なし 次郎', phone: '080-2222-3333' },
  ]
  await kvSet('sync:clinic', { payload: { pt_patients: JSON.stringify(kartes) }, updatedAt: '2030-01-01T00:00:00Z' })
  await saveLineLink({ key: '09011112222|架空花子', name: '架空 花子', phone: '09011112222', sealed: seal(HANAKO), linkedAt: '2030-01-01T00:00:00Z', via: 'karte-qr', patientId: 'p_hanako' })
  await saveLineLink({ key: '09011112222|架空一郎', name: '架空 一郎', phone: '09011112222', sealed: seal(HANAKO), linkedAt: '2030-01-02T00:00:00Z', via: 'karte-qr', patientId: 'p_child' })
  await saveLineLink({ key: '09099990000|別人太郎', name: '別人 太郎', phone: '09099990000', sealed: seal('Ueeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee'), linkedAt: '2030-01-03T00:00:00Z', via: 'liff-link' })
  await saveLineLink({ key: '08022223333|予定なし次郎', name: '予定なし 次郎', phone: '08022223333', sealed: seal(EMPTY), linkedAt: '2030-01-04T00:00:00Z', via: 'liff-link' })

  const row = (no, date, time, name, phone, lineKey = '') => ({ no, date, time, name, phone, lineKey })
  gas.rows = [
    row('AAA111', '2030-01-10', '09:00', '架空 花子', '09011112222'), // 今日の、もう過ぎた時間
    row('AAA222', '2030-01-10', '18:00', '架空花子', '09011112222'), // 今日のこれから
    row('BBB111', '2030-01-12', '10:30', '架空 一郎', ''), // お子さん（予約に電話なし → カルテの ID で）
    row('CCC111', '2030-01-11', '15:00', '別人 太郎', '09099990000'), // ほかの方
    row('DDD111', '2030-01-13', '11:00', 'LINE 予約子', '07012345678', seal(LINER)), // LINE から予約した方
    row('EEE111', '2030-01-14', '12:00', '連携なし 三郎', '08000001111'), // LINE と結びついていない方
    row('AAA333', '2030-02-01', '21:00', '架空 花子', '090-1111-2222'),
  ]
  const opts = { clinicName: 'ゆうき整骨院', phone: '083-265-4545', reserveUrl: 'https://liff.line.me/test' }

  await test('カルテと結びついた LINE：その LINE に届く予約だけ（ご家族の分も・過ぎた時間とほかの方の予約は出さない）', async () => {
    const r = await S.resolveReservationCheck(HANAKO)
    assert.equal(r.kind, 'found')
    assert.deepEqual(r.items.map((i) => [i.reservationNo, i.name, i.date, i.time]), [
      ['AAA222', '架空 花子', '2030-01-10', '18:00'],
      ['BBB111', '架空 一郎', '2030-01-12', '10:30'],
      ['AAA333', '架空 花子', '2030-02-01', '21:00'],
    ])
    assert.equal(r.changeUrls.AAA222, reservationChangeUrl('AAA222'))
    const text = C.reservationCheckText(r, opts)
    assert.match(text, /■ 架空 花子 様[\s\S]*1月10日（木） 18:00〜[\s\S]*予約番号：AAA222[\s\S]*2月1日（金） 21:00〜/)
    assert.match(text, /■ 架空 一郎 様[\s\S]*1月12日（土） 10:30〜/)
    assert.ok(text.includes(reservationChangeUrl('BBB111')), '変更・キャンセルのリンク')
    assert.doesNotMatch(text, /別人|CCC111|LINE 予約子|DDD111|連携なし|EEE111|AAA111|090|070|080/, 'ほかの方・電話番号は出さない')
    assert.match(text, /このトーク・お電話（083-265-4545）でも承ります。$/)
  })

  await test('LINE から予約した方：予約の行の封印が、その LINE のものなら出す（カルテと結びついていなくても）', async () => {
    const r = await S.resolveReservationCheck(LINER)
    assert.deepEqual(r.items.map((i) => [i.reservationNo, i.name]), [['DDD111', 'LINE 予約子']])
    const text = C.reservationCheckText(r, opts)
    assert.match(text, /^LINE 予約子 様\n\nゆうき整骨院です。これからのご予約は、次のとおりです。\n\n📅 1月13日（日） 11:00〜\n🎫 予約番号：DDD111\n日時の変更・キャンセルは、こちらから（入力はいりません）\n/)
    assert.doesNotMatch(text, /■/, '1人のときは、お名前を上に1回')
  })

  await test('結びついているが予約が無い方・結びついていない LINE', async () => {
    const none = await S.resolveReservationCheck(EMPTY)
    assert.deepEqual(none, { kind: 'none', names: ['予定なし 次郎'] })
    const t1 = C.reservationCheckText(none, opts)
    assert.match(t1, /予定なし 次郎 様の、これからのご予約はありません。/)
    assert.ok(t1.includes('https://liff.line.me/test'))
    const unknown = await S.resolveReservationCheck(NOBODY)
    assert.deepEqual(unknown, { kind: 'unknown' })
    const t2 = C.reservationCheckText(unknown, opts)
    assert.match(t2, /このLINEでは、ご予約を見つけられませんでした。/)
    assert.match(t2, /受付でお声がけ/)
    assert.doesNotMatch(t2, /架空|別人|予定なし|AAA|BBB|CCC|DDD|EEE/, 'だれの予約も出さない')
  })

  await test('予約システムへの頼み方：署名つき・お名前や電話は送らない', async () => {
    const before = calls.length
    await S.resolveReservationCheck(HANAKO, new Date('2030-01-10T02:00:00Z'))
    const u = calls.at(-1)
    assert.equal(calls.length, before + 1)
    const ts = u.searchParams.get('ts')
    assert.equal(ts, String(new Date('2030-01-10T02:00:00Z').getTime()))
    assert.equal(u.searchParams.get('sig'), createHmac('sha256', 'notify-secret').update(`upcoming:${ts}`).digest('hex'))
    assert.deepEqual([...u.searchParams.keys()].sort(), ['api', 'days', 'sig', 'ts'], 'お名前・電話・LINE の ID は送らない')
  })

  await test('予約システムから取れないとき：あやまって、お電話を案内する（予約が無いとは言わない）', async () => {
    for (const status of ['down', 'unauthorized']) {
      gas.status = status
      const r = await S.resolveReservationCheck(HANAKO)
      assert.deepEqual(r, { kind: 'error' }, status)
      const text = await S.answerReservationCheck(HANAKO)
      assert.match(text, /いま、ご予約をお調べできませんでした/)
      assert.doesNotMatch(text, /ご予約はありません|見つけられません/)
    }
    gas.status = 'ok'
    const saveSecret = process.env.RESERVATION_NOTIFY_SECRET
    delete process.env.RESERVATION_NOTIFY_SECRET
    assert.deepEqual(await S.resolveReservationCheck(HANAKO), { kind: 'error' })
    process.env.RESERVATION_NOTIFY_SECRET = saveSecret
  })

  await test('予約が多いとき：8件まで出して、残りは件数だけ', () => {
    const items = Array.from({ length: 11 }, (_, i) => ({ name: '架空 花子', date: `2030-02-${String(i + 1).padStart(2, '0')}`, time: '10:00', reservationNo: `M${i}` }))
    const text = C.reservationCheckText({ kind: 'found', items }, opts)
    assert.equal((text.match(/📅/g) || []).length, C.RESERVATION_CHECK_MAX)
    assert.match(text, /ほかに 3 件のご予約があります。/)
    assert.ok(text.length < 4500, 'LINE の1通（5000字）に収まる')
  })

  await test('同じお名前のカルテが2つあって決められない予約は出さない（お知らせを送るときと同じ決まり）', () => {
    const k2 = [{ id: 'x1', name: '同姓 同名', phone: '080-1111-0001' }, { id: 'x2', name: '同姓 同名', phone: '080-1111-0002' }]
    const l2 = [{ key: '08011110001|同姓同名', name: '同姓 同名', phone: '08011110001', patientId: 'x1', linkedAt: '2030-01-01T00:00:00Z' }]
    const mine = new Set(['08011110001|同姓同名'])
    const pick = (phone) => C.pickReservationsForLine([row('Z1', '2030-01-20', '10:00', '同姓同名', phone)], { today: '2030-01-10', time: '11:00' }, k2, l2, mine, () => false)
    assert.equal(pick('').length, 0, '電話が無く、どちらの方か決められない')
    assert.equal(pick('08011110002').length, 0, 'もう一人の方の予約')
    assert.equal(pick('08011110001').length, 1)
  })

  await test('Webhook：「予約確認」は自動案内の会話に流さず、返信（Reply）で返す。止めるスイッチがある', () => {
    const hook = read('src/app/api/marketing/line/webhook/route.ts')
    const at = hook.indexOf('if (parseReservationCheck(message.text ?? \'\')) {')
    assert.ok(at > 0)
    assert.ok(hook.indexOf('const consentCommand = parseConsentCommand') < at, '「予約のお知らせ停止」などを先に見る')
    assert.ok(at < hook.indexOf("input = { kind: 'text', text: message.text ?? '' }"), '自動案内の会話より前')
    const block = hook.slice(at, at + 900)
    assert.match(block, /await replyToLine\(replyToken, \[\{ type: 'text', text \}\]\)/)
    assert.match(block, /continue/)
    assert.doesNotMatch(block, /message\/push/)
    process.env.LINE_RESERVATION_CHECK = 'off'
    assert.equal(S.reservationCheckEnabled(), false)
    delete process.env.LINE_RESERVATION_CHECK
    assert.equal(S.reservationCheckEnabled(), true)
  })
} finally {
  globalThis.fetch = realFetch
  for (const k of Object.keys(process.env)) if (!(k in saved)) delete process.env[k]
  Object.assign(process.env, saved)
  process.chdir(cwd)
  fs.rmSync(dir, { recursive: true, force: true })
}

console.log(`\n${passed} 件 OK`)
