// LINE連携の方への予約のお知らせ（予約の確定をすぐ・前日のお知らせ）の確認
// 実行: node tools/test-line-reservation.mjs
// 外には送らない（fetch を差しかえて LINE の返事をまねる）。KV は一時フォルダのファイル。データはすべて架空
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
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

let passed = 0
async function test(name, fn) {
  await fn()
  passed += 1
  console.log(`  ✓ ${name}`)
}

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'line-rsv-'))
const cwd = process.cwd()
process.chdir(dir)
const realFetch = globalThis.fetch
const saved = { ...process.env }
for (const k of Object.keys(process.env)) if (/^(SUPABASE|NEXT_PUBLIC_SUPABASE|LINE_API_BASE_URL)/.test(k)) delete process.env[k]
process.env.LINE_CHANNEL_ACCESS_TOKEN = 'line-token'
process.env.RESERVATION_NOTIFY_SECRET = 'notify-secret'
process.env.RESERVATION_NOTIFY_LINE_USER_ID = 'U00000000000000000000000000000000'

// 架空の LINE の宛先（形は本物と同じ U＋16進32文字）
const HANAKO = 'Uaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
const TARO = 'Ubbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'
const OWNER = 'U00000000000000000000000000000000'

// LINE の返事をまねる（送った宛先と本文を控える）
const pushes = []
let lineFails = false
globalThis.fetch = async (url, init) => {
  const u = String(url)
  if (u === 'https://api.line.me/v2/bot/message/push') {
    const body = JSON.parse(init.body)
    if (lineFails) return new Response('{"message":"boom"}', { status: 500 })
    pushes.push({ to: body.to, text: body.messages[0].text })
    return new Response('{}', { status: 200 })
  }
  throw new Error(`外への通信はしない: ${u}`)
}

try {
  const { KV_PREFIXES, kvGet, kvSet } = await imp('src/lib/marketing/kv-store-server.ts')
  const { saveLineLink } = await imp('src/lib/line-link-server.ts')
  const { sealUserId } = await imp('src/lib/liff-ticket.ts')
  const { saveRule, getRule } = await imp('src/lib/marketing/automation-store-server.ts')
  const { applyConsent } = await imp('src/lib/marketing/consent-store-server.ts')
  const rsv = await imp('src/lib/marketing/line-reservation-server.ts')

  // 日本時間の「今日」と「明日」（日付の境目に左右されないよう、決まった時刻で動かす）
  const NOW = new Date('2030-01-10T02:00:00Z') // 日本時間 1/10 11:00
  const TODAY = '2030-01-10'
  const TOMORROW = '2030-01-11'
  const at = (jstHour) => new Date(Date.parse(`${TODAY}T00:00:00Z`) + (jstHour - 9) * 3600e3)
  const fast = { waitMs: 5, now: NOW }

  // 架空の LINE 連携（電話＋お名前で結びついた方・生年月日だけで探す方）
  await saveLineLink({ key: '09011112222|山田花子', name: '山田花子', phone: '09011112222', sealed: sealUserId(HANAKO, 'notify-secret'), linkedAt: '2030-01-01T00:00:00Z', via: 'liff-link' })
  await saveLineLink({ key: '08033334444|佐藤太郎', name: '佐藤太郎', phone: '08033334444', sealed: sealUserId(TARO, 'notify-secret'), linkedAt: '2030-01-02T00:00:00Z', via: 'liff-link', birthDate: '2012-05-06' })
  // クラウドのカルテ（佐藤さんは予約の電話が連携の電話と違う）
  await kvSet('sync:clinic', { payload: { pt_patients: JSON.stringify([{ id: 'p1', name: '佐藤 太郎', phone: '070-5555-6666', birthDate: '2012-05-06' }]) }, updatedAt: '2030-01-01T00:00:00Z' })

  await test('控えの頭（linersv:）が LINE の連絡先の一覧にまぎれない', () => {
    assert.ok(KV_PREFIXES.includes('linersv:'))
    assert.ok(KV_PREFIXES.includes('linesent:'))
  })

  await test('予約が入った：電話＋お名前で連携の方には「確定しました」を1通。控えも残す', async () => {
    assert.equal((await getRule('reservation_confirm')).mode, 'on')
    const r = await rsv.onNewReservation({ reservationNo: 'R100', name: '山田 花子', phone: '090-1111-2222', date: TOMORROW, time: '10:30' }, fast)
    assert.equal(r, 'sent')
    assert.equal(pushes.length, 1)
    assert.equal(pushes[0].to, HANAKO)
    assert.match(pushes[0].text, /山田花子 様/)
    assert.match(pushes[0].text, /10:30/)
    assert.match(pushes[0].text, /R100/)
    const kept = await kvGet('linersv:R100')
    assert.equal(kept.key, '09011112222|山田花子')
    assert.equal(kept.date, TOMORROW)
    assert.ok(kept.confirmedAt)
    assert.ok(await rsv.confirmSentFor('R100', TOMORROW, '10:30'), '予約システムの確定が遅れて来ても二重に送らない印')
    assert.equal(await rsv.confirmSentFor('R100', TOMORROW, '11:00'), false, '日時が変わったら別のお知らせ')
  })

  await test('同じ予約の通知がもう一度来ても、二重には送らない', async () => {
    const r = await rsv.onNewReservation({ reservationNo: 'R100', name: '山田花子', phone: '09011112222', date: TOMORROW, time: '10:30' }, fast)
    assert.equal(r, '確定の LINE は送り済み')
    assert.equal(pushes.length, 1)
  })

  await test('LINE連携していない方・過ぎた日・形のおかしい予約には送らない', async () => {
    assert.equal(await rsv.onNewReservation({ reservationNo: 'R101', name: '架空 次郎', phone: '09099998888', date: TOMORROW, time: '11:00' }, fast), 'LINE連携していない方')
    assert.equal(await rsv.onNewReservation({ reservationNo: 'R102', name: '山田花子', phone: '09011112222', date: '2030-01-09', time: '11:00' }, fast), '過ぎた日の予約')
    assert.equal(await rsv.onNewReservation({ reservationNo: 'R 1/2', name: '山田花子', phone: '09011112222', date: TOMORROW, time: '11:00' }, fast), '予約番号・日時が読めません')
    assert.equal(pushes.length, 1)
    assert.equal(await kvGet('linersv:R101'), null)
  })

  await test('電話が違っても、カルテのお名前＋生年月日で連携の方とわかれば送る', async () => {
    const r = await rsv.onNewReservation({ reservationNo: 'R200', name: '佐藤太郎', phone: '07055556666', date: TOMORROW, time: '16:00' }, fast)
    assert.equal(r, 'sent')
    assert.equal(pushes.at(-1).to, TARO)
    assert.equal((await kvGet('linersv:R200')).key, '08033334444|佐藤太郎')
  })

  await test('LINEから予約した方：予約システムが先に「確定しました」を送っていたら、こちらからは送らない', async () => {
    await rsv.markConfirmSent({ reservationNo: 'R300', date: TOMORROW, time: '09:00', userId: HANAKO })
    const before = pushes.length
    const r = await rsv.onNewReservation({ reservationNo: 'R300', name: '山田花子', phone: '09011112222', date: TOMORROW, time: '09:00' }, fast)
    assert.equal(r, '確定の LINE は送り済み')
    assert.equal(pushes.length, before)
  })

  await test('「止める」のときは送らない（控えは残すので、動かせば前日のお知らせは届く）', async () => {
    await saveRule('reservation_confirm', { mode: 'off', dailyLimit: 60 })
    const before = pushes.length
    const r = await rsv.onNewReservation({ reservationNo: 'R400', name: '山田花子', phone: '09011112222', date: '2030-01-12', time: '12:00' }, fast)
    assert.equal(r, '自動化設定で止めています')
    assert.equal(pushes.length, before)
    assert.ok(await kvGet('linersv:R400'))
    await saveRule('reservation_confirm', { mode: 'on', dailyLimit: 60 })
  })

  await test('前日のお知らせ：「テスト」のあいだは患者さんに送らず、院長に見本だけ', async () => {
    assert.equal((await getRule('reservation_remind')).mode, 'test')
    const before = pushes.length
    const r = await rsv.runLineReminders(at(11))
    assert.ok(pushes.length > before)
    for (const p of pushes.slice(before)) {
      assert.equal(p.to, OWNER)
      assert.match(p.text, /^【テスト】患者さんにはまだ送っていません/)
    }
    assert.equal(r.sent, 0)
    assert.equal((await kvGet('linersv:R100')).remindedTest, true, '見本で済んだ印')
    // テストのままなら、次の回は見本も送らない
    const n = pushes.length
    await rsv.runLineReminders(at(12))
    assert.equal(pushes.length, n)
  })

  await test('前日のお知らせ：「動かす」なら、明日の予約の方へ1通ずつ。2回目は送らない。時間外は何もしない', async () => {
    await saveRule('reservation_remind', { mode: 'on', dailyLimit: 80 })
    await kvSet('linersv:R300', { reservationNo: 'R300', key: '09011112222|山田花子', date: TOMORROW, time: '09:00', savedAt: NOW.toISOString() })
    // 時間外（9時台・20時台）
    const early = await rsv.runLineReminders(at(9))
    assert.match(early.reason, /送る時間外/)
    const late = await rsv.runLineReminders(at(20))
    assert.match(late.reason, /送る時間外/)
    const before = pushes.length
    const r = await rsv.runLineReminders(at(11))
    const sentNow = pushes.slice(before)
    assert.equal(r.sent, 3, '明日の3件（R100・R200・R300）。見本だけだった分も、ご本人へ届く')
    assert.deepEqual(sentNow.map((p) => p.to).sort(), [HANAKO, HANAKO, TARO])
    for (const p of sentNow) {
      assert.match(p.text, /明日のご予約のお知らせです/)
      assert.match(p.text, /予約のお知らせ停止/)
    }
    // 明後日の R400 にはまだ送らない
    assert.ok(!sentNow.some((p) => p.text.includes('R400')))
    assert.equal((await kvGet('linersv:R100')).remindedTest, undefined)
    const again = await rsv.runLineReminders(at(12))
    assert.equal(again.sent, 0)
    assert.equal(pushes.length, before + 3)
  })

  await test('前日のお知らせ：「予約のお知らせ停止」と送った方には送らない。キャンセルした予約にも送らない', async () => {
    await applyConsent(TARO, { purpose: 'reservation', allow: false })
    await kvSet('linersv:R500', { reservationNo: 'R500', key: '08033334444|佐藤太郎', date: TOMORROW, time: '17:00', savedAt: NOW.toISOString() })
    await kvSet('linersv:R501', { reservationNo: 'R501', key: '09011112222|山田花子', date: TOMORROW, time: '18:00', savedAt: NOW.toISOString() })
    await rsv.onCancelReservation('R501')
    assert.equal(await kvGet('linersv:R501'), null)
    const before = pushes.length
    const r = await rsv.runLineReminders(at(13))
    assert.equal(r.sent, 0)
    assert.equal(pushes.length, before)
    assert.ok((await kvGet('linersv:R500')).remindedAt, '止めている方の分は、くり返し確かめない')
  })

  await test('前日のお知らせ：LINE が失敗したら、次の回にもう一度。過ぎた予約の控えは消す', async () => {
    await kvSet('linersv:R600', { reservationNo: 'R600', key: '09011112222|山田花子', date: TOMORROW, time: '19:00', savedAt: NOW.toISOString() })
    await kvSet('linersv:R601', { reservationNo: 'R601', key: '09011112222|山田花子', date: '2030-01-08', time: '19:00', savedAt: NOW.toISOString() })
    lineFails = true
    const failed = await rsv.runLineReminders(at(14))
    lineFails = false
    assert.equal(failed.sent, 0)
    assert.equal((await kvGet('linersv:R600')).remindedAt, undefined)
    assert.equal(await kvGet('linersv:R601'), null)
    const retry = await rsv.runLineReminders(at(15))
    assert.equal(retry.sent, 1)
  })

  await test('「今日」の画面の一覧でそろえる：空の一覧では消さない・日時の変更は直す・無くなった予約は消す・わからない予約は残す', async () => {
    await kvSet('linersv:R700', { reservationNo: 'R700', key: '09011112222|山田花子', date: '2030-01-13', time: '10:00', savedAt: NOW.toISOString(), remindedAt: 'x' })
    await kvSet('linersv:R701', { reservationNo: 'R701', key: '09011112222|山田花子', date: '2030-01-13', time: '11:00', savedAt: NOW.toISOString() })
    await kvSet('linersv:R702', { reservationNo: 'R702', key: '08033334444|佐藤太郎', date: '2030-01-14', time: '12:00', savedAt: NOW.toISOString() })
    const range = { from: '2030-01-12', to: '2030-01-20' }
    // 一覧が空（読み込みの不具合かもしれない）→ 何も消さない
    const empty = await rsv.syncLineReservations({ ...range, rows: [], items: [] })
    assert.deepEqual(empty, { saved: 0, updated: 0, removed: 0 })
    assert.ok(await kvGet('linersv:R701'))
    const r = await rsv.syncLineReservations({
      ...range,
      rows: [
        { reservationNo: 'R700', date: '2030-01-15', time: '14:00' }, // 日時が変わった
        { reservationNo: 'R702', date: '2030-01-14', time: '12:00' }, // そのまま（画面では連携とわからなかった）
        { reservationNo: 'R400', date: '2030-01-12', time: '12:00' },
        { reservationNo: 'R800', date: '2030-01-16', time: '9:30' }, // 新しく連携の方とわかった
      ],
      items: [{ key: '09011112222|山田花子', reservationNo: 'R800', date: '2030-01-16', time: '9:30' }],
    })
    assert.deepEqual(r, { saved: 1, updated: 1, removed: 1 })
    const moved = await kvGet('linersv:R700')
    assert.equal(moved.date, '2030-01-15')
    assert.equal(moved.time, '14:00')
    assert.equal(moved.remindedAt, undefined, '新しい日時で前日のお知らせを送れるように')
    assert.equal(await kvGet('linersv:R701'), null, 'キャンセル・来院済みで一覧から無くなった')
    assert.ok(await kvGet('linersv:R702'))
    assert.equal((await kvGet('linersv:R800')).time, '09:30')
    // 形のおかしいキーは入れない
    const bad = await rsv.syncLineReservations({ ...range, rows: [{ reservationNo: 'R900', date: '2030-01-16', time: '10:00' }], items: [{ key: 'だれか', reservationNo: 'R900', date: '2030-01-16', time: '10:00' }] })
    assert.equal(bad.saved, 0)
    await assert.rejects(rsv.syncLineReservations({ from: '1/1', to: '2030-01-20', rows: [], items: [] }))
  })

  await test('1日の上限に達したら送らず、次の回にもう一度', async () => {
    await saveRule('reservation_remind', { mode: 'on', dailyLimit: 1 })
    await kvSet('linersv:R950', { reservationNo: 'R950', key: '09011112222|山田花子', date: TOMORROW, time: '19:30', savedAt: NOW.toISOString() })
    const before = pushes.length
    const r = await rsv.runLineReminders(at(16))
    assert.equal(r.sent, 0)
    assert.equal(pushes.length, before)
    assert.equal((await kvGet('linersv:R950')).remindedAt, undefined)
  })
} finally {
  globalThis.fetch = realFetch
  for (const k of Object.keys(process.env)) if (!(k in saved)) delete process.env[k]
  Object.assign(process.env, saved)
  process.chdir(cwd)
  fs.rmSync(dir, { recursive: true, force: true })
}

console.log(`\n${passed} 件 OK`)
