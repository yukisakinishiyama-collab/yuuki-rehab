// 予約が入ったら、カルテが無い方のカルテを自動で作る（2026-11-19 院長の依頼）の確認
// 実行: npx tsx tools/test-auto-register.mjs
// 外には送らない。KV は一時フォルダのファイル。データはすべて架空
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

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'auto-register-'))
const cwd = process.cwd()
process.chdir(dir)
const saved = { ...process.env }
for (const k of Object.keys(process.env)) if (/^(SUPABASE|NEXT_PUBLIC_SUPABASE|KARTE_AUTO_REGISTER)/.test(k)) delete process.env[k]
process.env.RESERVATION_NOTIFY_SECRET = 'notify-secret'
const realFetch = globalThis.fetch
globalThis.fetch = async (url) => {
  throw new Error(`外への通信はしない: ${url}`)
}

try {
  const { kvGet, kvSet } = await imp('src/lib/marketing/kv-store-server.ts')
  const { sameChartsForReservation, kanaKey, personNameKey, buildPatientFromReservation } = await imp('src/lib/karte-from-reservation.ts')
  const { registerPatientFromReservation, reservationPatientId } = await imp('src/lib/karte/auto-register-server.ts')
  const { nextVersion, applySyncOps, readSyncRecord } = await imp('src/lib/sync-store-server.ts')
  const fast = { settleMs: [1, 1, 1], now: '2030-01-10T02:00:00.000Z' }
  const patients = async () => JSON.parse((await kvGet('sync:clinic')).payload.pt_patients)

  // 架空のカルテ
  const CHARTS = [
    { id: 'p1', name: '佐藤 太郎', kana: 'サトウ タロウ', phone: '083-000-0001', birthDate: '2012-05-06' },
    { id: 'p2', name: '鈴木　花子', kana: 'すずき はなこ', phone: '090-0000-0002' },
    { id: 'p3', name: '高橋 一郎', kana: '', phone: '09000000003' },
  ]

  await test('同じ方の見分け：お名前が同じ（空白・全角半角・「様」は無視。電話がちがっても同じ方）', () => {
    assert.deepEqual(sameChartsForReservation(CHARTS, { name: '佐藤太郎', phone: '080-9999-0000' }).map((p) => p.id), ['p1'])
    assert.deepEqual(sameChartsForReservation(CHARTS, { name: '鈴木 花子 様' }).map((p) => p.id), ['p2'])
    assert.equal(personNameKey(' 鈴木　花子 さま'), '鈴木花子')
  })

  await test('同じ方の見分け：電話とふりがなが同じ（漢字の書き方がちがう・かなで予約した）', () => {
    assert.equal(kanaKey('サトウ　ﾀﾛｳ'), 'さとうたろう')
    assert.deepEqual(sameChartsForReservation(CHARTS, { name: '佐藤 太朗', kana: 'さとう たろう', phone: '0830000001' }).map((p) => p.id), ['p1'])
    assert.deepEqual(sameChartsForReservation(CHARTS, { name: 'スズキ ハナコ', phone: '09000000002' }).map((p) => p.id), ['p2'])
    // ふりがなが同じでも、電話がちがえば別の方
    assert.deepEqual(sameChartsForReservation(CHARTS, { name: '佐藤 太朗', kana: 'サトウ タロウ', phone: '070-1111-1111' }), [])
  })

  await test('同じ方の見分け：電話だけ同じ（ご家族）は別の方。お名前もふりがなも無ければ探さない', () => {
    assert.deepEqual(sameChartsForReservation(CHARTS, { name: '佐藤 次郎', kana: 'サトウ ジロウ', phone: '083-000-0001' }), [])
    assert.deepEqual(sameChartsForReservation(CHARTS, { name: '', phone: '083-000-0001' }), [])
  })

  await test('クラウドの控えがまだ無いときは作らない（初めて同期する端末の一覧を置きかえないように）', async () => {
    const r = await registerPatientFromReservation({ name: '架空 新太', phone: '090-1234-0000', date: '2030-01-11' }, fast)
    assert.equal(r.kind, 'skipped')
    assert.equal(await kvGet('sync:clinic'), null)
  })

  await kvSet('sync:clinic', {
    payload: { pt_patients: JSON.stringify(CHARTS), pt_soap_notes: JSON.stringify([{ id: 's1', patientId: 'p1' }]), pt_version: '1' },
    updatedAt: '2030-01-01T00:00:00.000Z',
  })

  await test('カルテが無い方の予約：お名前・ふりがな・電話でカルテを1つ足す（ほかの記録はそのまま・版が進む）', async () => {
    const r = await registerPatientFromReservation(
      { reservationNo: 'R200', name: '架空 新太 様', kana: 'カクウ シンタ', phone: '090-1234-0000', date: '2030-01-11', time: '10:30', menu: '初診', symptom: '右ひざが痛い\n階段がつらい' },
      fast,
    )
    assert.equal(r.kind, 'created')
    const record = await kvGet('sync:clinic')
    assert.ok(record.updatedAt > '2030-01-01T00:00:00.000Z')
    assert.equal(record.payload.pt_soap_notes, JSON.stringify([{ id: 's1', patientId: 'p1' }]))
    assert.equal(record.payload.pt_version, '1')
    const list = await patients()
    assert.equal(list.length, 4)
    assert.deepEqual(list.slice(0, 3), CHARTS, '今あるカルテは書きかえない')
    const made = list[3]
    assert.equal(made.id, r.patientId)
    assert.match(made.id, /^rsv[0-9a-f]{20}$/)
    assert.equal(made.name, '架空 新太')
    assert.equal(made.kana, 'カクウ シンタ')
    assert.equal(made.phone, '090-1234-0000')
    assert.equal(made.autoCreatedFrom, 'reservation')
    assert.equal(made.status, 'active')
    assert.equal(made.birthDate, '')
    assert.equal(made.firstVisitDate, '2030-01-11', '初診の予約は、予約の日を初回来院の日に')
    assert.equal(made.therapistNotes, '予約のときのご記入（1/11の予約）：右ひざが痛い 階段がつらい')
    assert.equal(made.createdAt, fast.now)
    // 画面で作るカルテと同じ形（足りない欄が無い）
    assert.deepEqual(Object.keys(made).sort(), Object.keys(buildPatientFromReservation({ name: 'x' })).sort())
  })

  await test('同じ方の予約がもう一度来ても、カルテは増えない（日時を変えた・2回目の予約）', async () => {
    const r = await registerPatientFromReservation({ name: '架空新太', phone: '09012340000', date: '2030-01-18', time: '11:00' }, fast)
    assert.deepEqual(r, { kind: 'exists', count: 1 })
    assert.equal((await patients()).length, 4)
  })

  await test('カルテがある方（再診）の予約では作らない。お名前が同じなら電話がちがっても作らない', async () => {
    assert.equal((await registerPatientFromReservation({ name: '佐藤 太郎', phone: '083-000-0001', date: '2030-01-12' }, fast)).kind, 'exists')
    assert.equal((await registerPatientFromReservation({ name: '高橋一郎', phone: '080-7777-7777', date: '2030-01-12' }, fast)).kind, 'exists')
    assert.equal((await patients()).length, 4)
  })

  await test('ご家族（電話が同じでお名前がちがう）は、別のカルテを作る。再診の予約は初回来院の日を入れない', async () => {
    const r = await registerPatientFromReservation({ name: '佐藤 次郎', kana: 'サトウ ジロウ', phone: '083-000-0001', date: '2030-01-12', menu: '再診' }, fast)
    assert.equal(r.kind, 'created')
    const list = await patients()
    assert.equal(list.length, 5)
    assert.equal(list[4].name, '佐藤 次郎')
    assert.equal(list[4].firstVisitDate, '')
    assert.equal(list[4].therapistNotes, '')
  })

  await test('お名前が無い予約・止めているときは作らない', async () => {
    assert.equal((await registerPatientFromReservation({ name: ' 様 ', phone: '090-0000-9999' }, fast)).kind, 'skipped')
    process.env.KARTE_AUTO_REGISTER = 'off'
    assert.equal((await registerPatientFromReservation({ name: '架空 止男', phone: '090-0000-9998' }, fast)).kind, 'skipped')
    delete process.env.KARTE_AUTO_REGISTER
    assert.equal((await patients()).length, 5)
  })

  await test('外から来た文字は1行にして長さを切る（改行・制御文字・電話の余計な文字）', async () => {
    const r = await registerPatientFromReservation({ name: '架空\n改行\u0007子', kana: 'カクウ'.repeat(40), phone: '090-5555-0000<script>', date: '2030/01/12', symptom: 'あ'.repeat(500) }, fast)
    assert.equal(r.kind, 'created')
    const made = (await patients()).find((p) => p.id === r.patientId)
    assert.equal(made.name, '架空 改行 子')
    assert.equal(made.kana.length, 60)
    assert.equal(made.phone, '090-5555-0000')
    assert.equal(made.firstVisitDate, '')
    assert.equal(made.therapistNotes, `予約のときのご記入：${'あ'.repeat(300)}`)
  })

  await test('同じ方の通知が同時に2つ来ても、カルテは1つ（ID が「お名前＋電話」から決まる）', async () => {
    const before = (await patients()).length
    const a = { name: '架空 同時', phone: '090-2222-0000', date: '2030-01-13', time: '10:00' }
    const [r1, r2] = await Promise.all([registerPatientFromReservation(a, fast), registerPatientFromReservation({ ...a, time: '10:30' }, fast)])
    assert.ok([r1.kind, r2.kind].includes('created'))
    const list = await patients()
    assert.equal(list.length, before + 1)
    assert.equal(list.filter((p) => p.name === '架空 同時').length, 1)
    // 鍵がちがえば ID もちがう（お名前や電話を逆算できない）。同じ方なら書き方がちがっても同じ ID
    assert.equal(reservationPatientId('架空 同時', '090-2222-0000', 'notify-secret'), reservationPatientId('架空同時 様', '09022220000', 'notify-secret'))
    assert.notEqual(reservationPatientId('架空 同時', '090-2222-0000', 'notify-secret'), reservationPatientId('架空 同時', '090-2222-0000', 'other-secret'))
  })

  await test('足した直後に端末の保存と重なって消えたら、やり直して入れる', async () => {
    // 足す前の一覧を控えておき、足した直後（入ったかを確かめる前）に、その古い一覧で上書きする
    // ＝同じときに端末の保存が重なって、足したカルテが消えた、というまね
    const snapshot = await kvGet('sync:clinic')
    let clobbered = 0
    const timer = setTimeout(() => {
      clobbered += 1
      void kvSet('sync:clinic', snapshot)
    }, 80)
    const r = await registerPatientFromReservation({ name: '架空 再試行', phone: '090-3333-0000', date: '2030-01-14' }, { ...fast, settleMs: [250, 5, 5] })
    clearTimeout(timer)
    assert.equal(clobbered, 1, '確かめる前に上書きが起きている')
    assert.equal(r.kind, 'created')
    assert.equal((await patients()).filter((p) => p.name === '架空 再試行').length, 1)
  })

  await test('カルテの一覧が読めない形のときは、さわらない', async () => {
    const keep = await kvGet('sync:clinic')
    await kvSet('sync:clinic', { payload: { pt_patients: '{こわれている' }, updatedAt: '2030-01-02T00:00:00.000Z' })
    const r = await registerPatientFromReservation({ name: '架空 壊', phone: '090-4444-0000' }, fast)
    assert.equal(r.kind, 'skipped')
    assert.equal((await kvGet('sync:clinic')).payload.pt_patients, '{こわれている')
    await kvSet('sync:clinic', keep)
  })

  await test('版は必ず前より後になる。サーバーからの重ねは /api/sync と同じ形', async () => {
    assert.equal(nextVersion('2030-01-01T00:00:00.000Z', new Date('2029-12-31T00:00:00.000Z')), '2030-01-01T00:00:00.001Z')
    assert.equal(nextVersion(null, new Date('2030-01-05T00:00:00.000Z')), '2030-01-05T00:00:00.000Z')
    const before = await readSyncRecord()
    const r = await applySyncOps([{ key: 'pt_quick_memos', type: 'merge', upserts: [{ id: 'm1', patientId: 'p1' }], deletes: [] }])
    assert.equal(r.prevAt, before.updatedAt)
    assert.ok(r.updatedAt > before.updatedAt)
    assert.equal((await readSyncRecord()).payload.pt_quick_memos, JSON.stringify([{ id: 'm1', patientId: 'p1' }]))
  })
} finally {
  globalThis.fetch = realFetch
  for (const k of Object.keys(process.env)) if (!(k in saved)) delete process.env[k]
  Object.assign(process.env, saved)
  process.chdir(cwd)
  fs.rmSync(dir, { recursive: true, force: true })
}

console.log(`\n${passed} 件 OK`)
