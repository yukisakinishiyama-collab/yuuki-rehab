// バックアップ（クラウドの毎月の控え・パソコンに保存する土台）の確認
// 実行: node tools/test-backup.mjs   （Supabase の設定が無いので、KV は一時フォルダのファイルを使う）
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

// KV のファイル（.data/marketing-kv.json）を一時フォルダに作る
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'yuuki-backup-'))
process.chdir(tmp)
delete process.env.SUPABASE_URL
delete process.env.SUPABASE_SERVICE_ROLE_KEY
fs.mkdirSync(path.join(tmp, '.data'))
const J = (v) => JSON.stringify(v)
const seed = {
  'sync:clinic': {
    updatedAt: '2026-11-11T02:00:00.000Z',
    payload: {
      pt_patients: J([{ id: 'p1', name: '山田' }, { id: 'p2', name: '佐藤' }]),
      pt_soap_notes: J([{ id: 's1' }, { id: 's2' }, { id: 's3' }]),
      pt_outcomes: J([{ id: 'o1' }]),
      pt_contracts: J([{ id: 'cabc12345' }, { id: 'bad id!' }]),
    },
  },
  'kphoto:p1': [{ id: 'ph1', patientId: 'p1', storagePath: 'p1/ph1.jpg' }],
  'kcdoc:cabc12345': { record: { id: 'cabc12345' }, html: '<p>署名済み</p>', savedAt: 'x' },
}
fs.writeFileSync(path.join(tmp, '.data', 'marketing-kv.json'), J(seed))

const b = await import(new URL('../src/lib/backup/backup-server.ts', import.meta.url).href)
const kv = await import(new URL('../src/lib/marketing/kv-store-server.ts', import.meta.url).href)

let passed = 0
async function test(name, fn) {
  await fn()
  passed += 1
  console.log(`  ✓ ${name}`)
}

await test('カルテ全部・写真の一覧・契約書の番号をまとめる（件数も）', async () => {
  const core = await b.buildCoreBackup(new Date('2026-11-11T03:00:00Z'))
  assert.equal(core.format, 'yuuki-app-backup')
  assert.equal(core.karte.updatedAt, '2026-11-11T02:00:00.000Z')
  assert.equal(Object.keys(core.karte.data).length, 4)
  assert.deepEqual(core.contractIds, ['cabc12345'], 'おかしな番号は入れない')
  assert.equal(core.photosMeta.p1.length, 1)
  assert.equal(core.counts['患者さん'], 2)
  assert.equal(core.counts.SOAP, 3)
  assert.equal(core.counts['写真'], 1)
})

await test('契約書の本文を番号で受け取る（20件まで・おかしな番号は飛ばす）', async () => {
  const list = await b.getContractSnapshots(['cabc12345', 'nothere123', '../x'])
  assert.equal(list.length, 1)
  assert.equal(list[0].html, '<p>署名済み</p>')
})

await test('毎月の控え：その月の分が無ければ作り、あれば作らない（院長の「今すぐ」は作りなおす）', async () => {
  const now = new Date('2026-11-30T16:00:00Z') // 日本時間 12/1 1:00 → 12月の控え
  const r1 = await b.saveMonthlyBackup(now)
  assert.deepEqual([r1.ym, r1.status], ['2026-12', 'saved'])
  const r2 = await b.saveMonthlyBackup(now)
  assert.equal(r2.status, 'exists')
  const r3 = await b.saveMonthlyBackup(now, true)
  assert.equal(r3.status, 'saved')
  const list = await b.listMonthlyBackups()
  assert.deepEqual(list.map((e) => e.ym), ['2026-12'])
  const month = await b.getMonthlyBackup('2026-12')
  assert.equal(month.counts['患者さん'], 2)
  assert.equal(await b.getMonthlyBackup('../etc'), null)
})

await test('12か月分を残し、古い控えは消す', async () => {
  for (let m = 1; m <= 13; m++) {
    const d = new Date(Date.UTC(2027, m - 1, 5))
    await b.saveMonthlyBackup(d)
  }
  const list = await b.listMonthlyBackups()
  assert.equal(list.length, 12)
  assert.equal(list[0].ym, '2028-01')
  assert.equal(list.at(-1).ym, '2027-02')
  assert.equal(await kv.kvGet('backup:2026-12'), null, '13か月前の控えは消える')
  assert.equal(await kv.kvGet('backup:2027-01'), null)
  assert.ok(await kv.kvGet('backup:2027-02'))
})

await test('控えの名前（backup:・backupidx:）は LINE の一覧などに混ざらない', () => {
  assert.ok(kv.KV_PREFIXES.includes('backup:'))
  assert.ok(kv.KV_PREFIXES.includes('backupidx:'))
  assert.ok(kv.KV_PREFIXES.includes('kcdoc:'))
})

fs.rmSync(tmp, { recursive: true, force: true })
console.log(`\n${passed} 件 OK`)
