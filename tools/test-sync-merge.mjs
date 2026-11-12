// カルテの同期（差分を送って重ねる）の確認
// 実行: node tools/test-sync-merge.mjs   （Node 22.18+ は .ts をそのまま読める）
//
// 前半は sync-merge の純粋な関数。後半は、2台の端末（受付のPC・施術室のタブレット）と
// クラウド（/api/sync と同じ重ね方）をこの中で再現して、同時に書いても記録が消えないことを確かめる。
import assert from 'node:assert/strict'
import { register } from 'node:module'
// src の中の import は拡張子を書かない（Next.js の書き方）ので、ここだけ .ts を補って読む
register(
  'data:text/javascript,' +
    encodeURIComponent(
      "export async function resolve(s, c, next) { try { return await next(s, c) } catch (e) { if (s.startsWith('.') && !/\\.[a-z]+$/.test(s.split('?')[0])) return next(s + '.ts', c); throw e } }",
    ),
)
import { applyOp, applyOps, baseMapOf, baseOf, diffAll, diffKey, fingerprint, sanitizeOps } from '../src/lib/sync-merge.ts'

let passed = 0
async function test(name, fn) {
  await fn()
  passed += 1
  console.log(`  ✓ ${name}`)
}

const J = (v) => JSON.stringify(v)
const P = (s) => JSON.parse(s)

// ── 純粋な関数 ─────────────────────────────────

await test('id つきの配列は1件ずつの差分になる（追加・変更・削除）', () => {
  const before = J([{ id: 'a', t: 1 }, { id: 'b', t: 1 }, { id: 'c', t: 1 }])
  const after = J([{ id: 'a', t: 1 }, { id: 'b', t: 2 }, { id: 'd', t: 1 }])
  const op = diffKey('pt_soap_notes', after, baseOf(before))
  assert.equal(op.type, 'merge')
  assert.deepEqual(op.upserts.map((u) => u.id), ['b', 'd'])
  assert.deepEqual(op.deletes, ['c'])
})

await test('指紋はいつも16けたの16進数（記号が混ざらない）', () => {
  for (const t of ['', 'a', 'あいうえお', JSON.stringify({ id: 'x', v: 'y'.repeat(1000) }), '署名'.repeat(500)]) {
    assert.match(fingerprint(t), /^[0-9a-f]{16}$/)
  }
  assert.notEqual(fingerprint('a'), fingerprint('b'))
})

await test('変わっていなければ送らない', () => {
  const v = J([{ id: 'a', t: 1 }])
  assert.equal(diffKey('k', v, baseOf(v)), null)
  assert.equal(diffKey('raw', 'hello', baseOf('hello')), null)
  assert.deepEqual(diffAll({ k: v, raw: 'hello' }, baseMapOf({ k: v, raw: 'hello' })), [])
})

await test('id の無い値は値ごと置きかえる', () => {
  const op = diffKey('pt_version', '2', baseOf('1'))
  assert.deepEqual(op, { key: 'pt_version', type: 'replace', value: '2' })
  assert.equal(applyOp('1', op), '2')
})

await test('新しい空の配列は送らない（ほかの端末の記録を空で消さない）', () => {
  assert.equal(diffKey('pt_new', '[]', undefined), null)
  const op = diffKey('pt_new', J([{ id: 'x' }]), undefined)
  assert.equal(op.type, 'merge')
  // クラウドにほかの端末の分があっても消さずに足す
  assert.deepEqual(P(applyOp(J([{ id: 'y' }]), op)).map((r) => r.id), ['y', 'x'])
})

await test('重ねるときは、クラウド側のほかの記録をそのまま残す', () => {
  const cloud = J([{ id: 'a', v: 'cloud' }, { id: 'b', v: 'cloud' }, { id: 'e', v: 'other-device' }])
  const op = { key: 'k', type: 'merge', upserts: [{ id: 'b', v: 'mine' }, { id: 'z', v: 'mine' }], deletes: ['a'] }
  assert.deepEqual(P(applyOp(cloud, op)), [{ id: 'b', v: 'mine' }, { id: 'e', v: 'other-device' }, { id: 'z', v: 'mine' }])
})

await test('端末から消えたキーは remove、重ねると消える', () => {
  const ops = diffAll({}, baseMapOf({ gone: 'x' }))
  assert.deepEqual(ops, [{ key: 'gone', type: 'remove' }])
  assert.deepEqual(applyOps({ gone: 'x', keep: 'y' }, ops), { keep: 'y' })
})

await test('届いた変更の形を確かめる（おかしなものは受け付けない）', () => {
  assert.ok(sanitizeOps([{ key: 'k', type: 'replace', value: 'v' }]))
  assert.equal(sanitizeOps('x'), null)
  assert.equal(sanitizeOps([{ key: 'k', type: 'drop' }]), null)
  assert.equal(sanitizeOps([{ key: 'k', type: 'merge', upserts: [{ noid: 1 }], deletes: [] }]), null)
  assert.equal(sanitizeOps([{ key: '', type: 'remove' }]), null)
})

// ── 2台の端末とクラウドを再現 ─────────────────────────

const cloud = { payload: {}, updatedAt: null }
let tick = Date.parse('2026-11-11T02:00:00Z')
function serverPost(body) {
  const prevAt = cloud.updatedAt
  if (body.v === 2) {
    const ops = sanitizeOps(body.ops)
    if (!ops) return { status: 400, body: { error: 'bad' } }
    cloud.payload = applyOps(cloud.payload, ops)
  }
  tick += 1000
  cloud.updatedAt = new Date(tick).toISOString()
  return { status: 200, body: { ok: true, updatedAt: cloud.updatedAt, prevAt } }
}
function serverGet(url) {
  const since = new URL(url, 'http://x').searchParams.get('since')
  if (since && since === cloud.updatedAt) return { status: 200, body: { unchanged: true, updated_at: cloud.updatedAt } }
  return { status: 200, body: { data: { ...cloud.payload }, updated_at: cloud.updatedAt } }
}

function makeStorage() {
  const m = new Map()
  return {
    get length() { return m.size },
    key: (i) => [...m.keys()][i] ?? null,
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => { m.set(k, String(v)) },
    removeItem: (k) => { m.delete(k) },
    _map: m,
  }
}

const devices = { pc: makeStorage(), tablet: makeStorage() }
let current = 'pc'
const events = { pc: [], tablet: [] }
globalThis.localStorage = new Proxy({}, {
  get: (_, prop) => {
    const s = devices[current]
    const v = s[prop]
    return typeof v === 'function' ? v.bind(s) : v
  },
})
globalThis.window = {
  dispatchEvent: (ev) => { events[current].push(ev.detail.keys) },
  addEventListener() {},
  removeEventListener() {},
}
globalThis.document = { visibilityState: 'visible', addEventListener() {}, removeEventListener() {} }
globalThis.CustomEvent = class { constructor(type, init) { this.type = type; this.detail = init?.detail } }
globalThis.fetch = async (url, init = {}) => {
  const r = init.method === 'POST' ? serverPost(JSON.parse(init.body)) : serverGet(String(url))
  return { ok: r.status === 200, status: r.status, json: async () => r.body }
}
process.env.NEXT_PUBLIC_SYNC_SECRET = 'test'

const pcSync = await import('../src/lib/sync-service.ts?device=pc')
const tabSync = await import('../src/lib/sync-service.ts?device=tablet')
async function on(dev, fn) {
  current = dev
  const r = await fn(dev === 'pc' ? pcSync : tabSync)
  return r
}
const read = (dev, key) => P(devices[dev].getItem(key) ?? '[]')
const write = (dev, key, value) => devices[dev].setItem(key, J(value))

// クラウドに今のカルテがある状態から始める
cloud.payload = { pt_patients: J([{ id: 'p1', name: '山田' }]), pt_soap_notes: J([{ id: 's1', p: 'p1', text: '初回' }]) }
cloud.updatedAt = '2026-11-11T01:00:00.000Z'

await test('初めての端末は、クラウドの中身をそのまま取り込む', async () => {
  const r1 = await on('pc', (s) => s.syncNow())
  const r2 = await on('tablet', (s) => s.syncNow())
  assert.ok(r1.ok && r2.ok)
  assert.deepEqual(read('pc', 'pt_soap_notes').map((n) => n.id), ['s1'])
  assert.deepEqual(read('tablet', 'pt_patients').map((n) => n.name), ['山田'])
})

await test('2台が同じ時間に別の記録を書いても、どちらも消えない', async () => {
  write('pc', 'pt_soap_notes', [...read('pc', 'pt_soap_notes'), { id: 's2', p: 'p1', text: '受付のPCで' }])
  write('tablet', 'pt_soap_notes', [...read('tablet', 'pt_soap_notes'), { id: 's3', p: 'p1', text: 'タブレットで' }])
  await on('pc', (s) => s.syncNow())
  const r = await on('tablet', (s) => s.syncNow())
  assert.ok(r.ok)
  assert.deepEqual(P(cloud.payload.pt_soap_notes).map((n) => n.id).sort(), ['s1', 's2', 's3'])
  // タブレットは PC の記録を取り込み、自分の記録も残っている
  assert.deepEqual(read('tablet', 'pt_soap_notes').map((n) => n.id).sort(), ['s1', 's2', 's3'])
  // PC は次の確認（15秒ごと）でタブレットの記録を取り込む
  events.pc.length = 0
  await on('pc', (s) => s.syncNow())
  assert.deepEqual(read('pc', 'pt_soap_notes').map((n) => n.id).sort(), ['s1', 's2', 's3'])
  assert.ok(events.pc.some((keys) => keys.includes('pt_soap_notes')), '画面に「取り込んだ」を知らせる')
})

await test('同じ記録をあとから直した方が残り、ほかの記録はそのまま', async () => {
  write('pc', 'pt_soap_notes', read('pc', 'pt_soap_notes').map((n) => (n.id === 's1' ? { ...n, text: 'PCで直した' } : n)))
  await on('pc', (s) => s.syncNow())
  await on('tablet', (s) => s.syncNow())
  assert.equal(read('tablet', 'pt_soap_notes').find((n) => n.id === 's1').text, 'PCで直した')
  assert.equal(read('tablet', 'pt_soap_notes').length, 3)
})

await test('消した記録は、ほかの端末からも消える（ほかの記録は残る）', async () => {
  write('tablet', 'pt_soap_notes', read('tablet', 'pt_soap_notes').filter((n) => n.id !== 's3'))
  await on('tablet', (s) => s.syncNow())
  await on('pc', (s) => s.syncNow())
  assert.deepEqual(read('pc', 'pt_soap_notes').map((n) => n.id).sort(), ['s1', 's2'])
})

await test('変わっていないときの確認は軽い（クラウドの全体を受け取らない）', async () => {
  const before = cloud.updatedAt
  const r = await on('pc', (s) => s.syncNow())
  assert.ok(r.ok)
  assert.equal(r.sent, 0)
  assert.deepEqual(r.changedKeys, [])
  assert.equal(cloud.updatedAt, before, '何も書かない')
})

await test('取り込むあいだに端末で書いた分は、上書きされずに次で送られる', async () => {
  // タブレットで新しい記録（まだ送っていない）。PC が別の記録を送る
  write('tablet', 'pt_soap_notes', [...read('tablet', 'pt_soap_notes'), { id: 's4', p: 'p1', text: 'タブレット・未送信' }])
  write('pc', 'pt_patients', [...read('pc', 'pt_patients'), { id: 'p2', name: '佐藤' }])
  await on('pc', (s) => s.syncNow())
  await on('tablet', (s) => s.syncNow())
  assert.deepEqual(read('tablet', 'pt_patients').map((p) => p.id), ['p1', 'p2'])
  assert.ok(read('tablet', 'pt_soap_notes').some((n) => n.id === 's4'))
  assert.ok(P(cloud.payload.pt_soap_notes).some((n) => n.id === 's4'))
})

await test('クラウドに届かないときは、端末の記録を取り込みで上書きしない', async () => {
  const realFetch = globalThis.fetch
  globalThis.fetch = async () => { throw new Error('offline') }
  write('pc', 'pt_soap_notes', [...read('pc', 'pt_soap_notes'), { id: 's5', p: 'p2', text: 'オフライン中' }])
  const r = await on('pc', (s) => s.syncNow())
  assert.equal(r.ok, false)
  assert.ok(read('pc', 'pt_soap_notes').some((n) => n.id === 's5'))
  assert.equal(pcSync.getSyncStatus().state, 'error')
  globalThis.fetch = realFetch
  const r2 = await on('pc', (s) => s.syncNow())
  assert.ok(r2.ok)
  assert.ok(P(cloud.payload.pt_soap_notes).some((n) => n.id === 's5'), 'つながったら送られる')
})

await test('同期の印（sync_meta）や端末だけの設定はクラウドへ送らない', async () => {
  devices.pc.setItem('featureFlags', '{"x":false}')
  await on('pc', (s) => s.syncNow())
  assert.equal(cloud.payload.sync_meta, undefined)
  assert.equal(cloud.payload.featureFlags, undefined)
})

console.log(`\n${passed} 件 OK`)
