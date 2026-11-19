// 契約書・同意書を iPad に渡して記入してもらう（QR の受け渡し。2026-11-19 院長の依頼）の確認
// 実行: npx tsx tools/test-contract-handoff.mjs
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

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'handoff-'))
const cwd = process.cwd()
process.chdir(dir)
const saved = { ...process.env }
for (const k of Object.keys(process.env)) if (/^(SUPABASE|NEXT_PUBLIC_SUPABASE)/.test(k)) delete process.env[k]
const realFetch = globalThis.fetch
globalThis.fetch = async (url) => {
  throw new Error(`外への通信はしない: ${url}`)
}

try {
  const H = await imp('src/lib/contracts/handoff.ts')
  const S = await imp('src/lib/karte/handoff-server.ts')
  const { KV_PREFIXES, kvGet, kvList, kvSet } = await imp('src/lib/marketing/kv-store-server.ts')
  const { CONTRACT_TEMPLATES } = await imp('src/data/contract-templates.ts')
  const { parseTemplate } = await imp('src/lib/contracts/template.ts')
  const { fingerprint } = await imp('src/lib/sync-merge.ts')

  const tplInfo = (tpl) => {
    const parsed = parseTemplate(tpl.body)
    return { id: tpl.id, version: tpl.version, bodyHash: fingerprint(tpl.body), checkCount: parsed.checkCount, blankCount: parsed.blankCount }
  }
  const draftOf = (tpl, over = {}) => {
    const info = tplInfo(tpl)
    return {
      docId: info.id,
      version: info.version,
      bodyHash: info.bodyHash,
      checks: Array(info.checkCount).fill(false),
      inputs: Array(info.blankCount).fill(null),
      member: { plan: '一般会員', start: '2030-01-10', partnerName: '', partnerRelation: '', partnerBirthDate: '', partnerPatientId: '', pauseFrom: '2030-01', pauseMonths: 1, special: false, specialReason: '' },
      patientName: '架空 花子',
      minor: false,
      guardianName: '',
      relation: '',
      staffName: '架空 院長',
      ...over,
    }
  }
  const TPL = CONTRACT_TEMPLATES[0]

  await test('受け渡しの頭（khand:）が LINE の連絡先の一覧にまぎれない', () => {
    assert.ok(KV_PREFIXES.includes(H.HANDOFF_PREFIX))
  })

  await test('どの書類（ひな形）でも、同じ版どうしなら受け渡しの中身が合う', () => {
    assert.ok(CONTRACT_TEMPLATES.length >= 7)
    for (const tpl of CONTRACT_TEMPLATES) {
      const draft = H.sanitizeHandoffDraft(draftOf(tpl))
      assert.ok(draft, tpl.id)
      assert.equal(H.handoffDraftProblem(draft, tplInfo(tpl)), null, tpl.id)
    }
  })

  await test('版・文面・□ や記入欄の数がちがうときは開かない（片方の端末が古いアプリのまま）', () => {
    const draft = draftOf(TPL)
    const info = tplInfo(TPL)
    assert.match(H.handoffDraftProblem(draft, null), /見つかりません/)
    assert.match(H.handoffDraftProblem(draft, { ...info, id: 'other' }), /見つかりません/)
    assert.match(H.handoffDraftProblem(draft, { ...info, version: '9.9' }), /版がちがいます/)
    assert.match(H.handoffDraftProblem(draft, { ...info, bodyHash: '0000000000000000' }), /版がちがいます/)
    assert.match(H.handoffDraftProblem({ ...draft, checks: [...draft.checks, true] }, info), /版がちがいます/)
    assert.match(H.handoffDraftProblem({ ...draft, inputs: [...draft.inputs, null] }, info), /版がちがいます/)
  })

  await test('外から届いた中身は形を確かめる（おかしければ受けつけない・文字は1行にして長さを切る）', () => {
    const ok = H.sanitizeHandoffDraft({ ...draftOf(TPL), patientName: `架空\n花子${'あ'.repeat(100)}`, inputs: ['x'.repeat(1000), null], checks: [true, false], member: { plan: '学生会員', pauseMonths: 99, start: 'きょう', special: 'yes', partnerPatientId: '../x' }, extra: 'いらない' })
    assert.equal(ok.patientName.length, 40)
    assert.ok(!ok.patientName.includes('\n'))
    assert.equal(ok.inputs[0].length, 400)
    assert.equal(ok.inputs[1], null)
    assert.deepEqual(ok.member, { plan: '学生会員', start: '', partnerName: '', partnerRelation: '', partnerBirthDate: '', partnerPatientId: '', pauseFrom: '', pauseMonths: 1, special: false, specialReason: '' })
    assert.ok(!('extra' in ok))
    for (const bad of [null, 'x', [], { ...draftOf(TPL), docId: '' }, { ...draftOf(TPL), bodyHash: 'ZZZ' }, { ...draftOf(TPL), checks: ['true'] }, { ...draftOf(TPL), inputs: [1] }, { ...draftOf(TPL), checks: Array(401).fill(true) }]) {
      assert.equal(H.sanitizeHandoffDraft(bad), null)
    }
  })

  await test('受け渡しの番号・アドレス・状態の言葉', () => {
    assert.ok(H.isValidHandoffToken('abcDEF123_-abcDEF123_-xyz'))
    assert.ok(!H.isValidHandoffToken('short'))
    assert.ok(!H.isValidHandoffToken('abc/../../etc/passwd-aaaaaaaa'))
    assert.ok(!H.isValidHandoffToken(123))
    assert.equal(H.handoffUrl('https://example.test/', 'abcDEF123_-abcDEF123_-xyz'), 'https://example.test/patients/sign?t=abcDEF123_-abcDEF123_-xyz')
    assert.match(H.handoffStatusText('waiting'), /QR コードを読み取って/)
    assert.match(H.handoffStatusText('expired'), /出し直して/)
  })

  const NOW = new Date('2030-01-10T02:00:00.000Z')
  const later = (min) => new Date(NOW.getTime() + min * 60_000)
  const input = { patientId: 'p1', patientName: '架空 花子', title: TPL.title, draft: H.sanitizeHandoffDraft(draftOf(TPL, { checks: draftOf(TPL).checks.map((_, i) => i === 0) })) }

  let first
  await test('パソコン：受け渡しを作る（1時間使える・推測できない番号・中身はそのまま）', async () => {
    first = await S.createHandoff(input, NOW)
    assert.ok(H.isValidHandoffToken(first.token))
    assert.equal(first.status, 'waiting')
    assert.equal(first.expiresAt, later(60).toISOString())
    const again = await S.createHandoff({ ...input, patientId: 'p2' }, NOW)
    assert.notEqual(again.token, first.token)
    const read = await S.getHandoff(first.token)
    assert.deepEqual(read.draft, input.draft)
    assert.equal(await S.getHandoff('abcDEF123_-abcDEF123_-xyz'), null)
    assert.equal(await S.getHandoff('../sync:clinic'), null)
  })

  await test('iPad：開く → 署名が終わる。署名済みになったら中身は消し、記録の ID だけを残す', async () => {
    const opened = await S.openHandoff(first.token, later(5))
    assert.equal(opened.ok, true)
    assert.equal(opened.session.status, 'opened')
    assert.equal((await S.openHandoff(first.token, later(6))).session.openedAt, later(5).toISOString(), '2回開いても同じ')
    assert.deepEqual((await S.listOpenHandoffs('p1', later(6))).map((s) => s.token), [first.token])
    const done = await S.completeHandoff(first.token, 'c0000001abc', later(20))
    assert.equal(done.session.status, 'signed')
    assert.equal(done.session.recordId, 'c0000001abc')
    const kept = await kvGet(`khand:${first.token}`)
    assert.ok(!('draft' in kept), '中身を長く置かない')
    assert.deepEqual(await S.listOpenHandoffs('p1', later(21)), [])
    // 署名済みは、もう開けない・取り消せない。もう一度「終わった」が来ても同じ
    assert.deepEqual(await S.openHandoff(first.token, later(22)), { ok: false, reason: 'signed' })
    assert.deepEqual(await S.cancelHandoff(first.token), { ok: false, reason: 'signed' })
    assert.equal((await S.completeHandoff(first.token, 'cZZZZZZZZ', later(23))).session.recordId, 'c0000001abc')
  })

  await test('パソコン：取り消したら、iPad では開けない（中身も消す）', async () => {
    const s = await S.createHandoff({ ...input, patientId: 'p3' }, NOW)
    assert.equal((await S.cancelHandoff(s.token)).ok, true)
    assert.deepEqual(await S.openHandoff(s.token, later(1)), { ok: false, reason: 'cancelled' })
    assert.ok(!('draft' in (await kvGet(`khand:${s.token}`))))
    assert.deepEqual(H.toHandoffListItem(await S.getHandoff(s.token)), { token: s.token, title: TPL.title, status: 'cancelled', createdAt: NOW.toISOString() })
  })

  await test('1時間を過ぎたら開けない。無い番号も開けない', async () => {
    const s = await S.createHandoff({ ...input, patientId: 'p4' }, NOW)
    assert.equal((await S.openHandoff(s.token, later(59))).ok, true)
    const t = await S.createHandoff({ ...input, patientId: 'p5' }, NOW)
    assert.deepEqual(await S.openHandoff(t.token, later(61)), { ok: false, reason: 'expired' })
    assert.equal(H.isHandoffExpired(t, later(60)), true)
    assert.equal(H.isHandoffExpired(t, later(59)), false)
    assert.deepEqual(await S.listOpenHandoffs('p5', later(61)), [])
    assert.deepEqual(await S.openHandoff('abcDEF123_-abcDEF123_-xyz', NOW), { ok: false, reason: 'missing' })
    // 時間が過ぎてから署名が終わった（患者様がゆっくり読んだ）ときは、署名済みとして残す（署名入りの本文はもう保存してある）
    assert.equal((await S.completeHandoff(t.token, 'c0000002abc', later(70))).session.status, 'signed')
  })

  await test('同じ患者さんの同じ書類で QR を出し直したら、前の受け渡しは取り消す（古い QR から2通目を作らせない）', async () => {
    const a = await S.createHandoff({ ...input, patientId: 'p6' }, NOW)
    const b = await S.createHandoff({ ...input, patientId: 'p6' }, later(3))
    assert.equal((await S.getHandoff(a.token)).status, 'cancelled')
    assert.equal((await S.getHandoff(b.token)).status, 'waiting')
    assert.deepEqual((await S.listOpenHandoffs('p6', later(4))).map((s) => s.token), [b.token])
    // 別の書類は取り消さない
    const other = CONTRACT_TEMPLATES[1]
    const c = await S.createHandoff({ ...input, patientId: 'p6', title: other.title, draft: H.sanitizeHandoffDraft(draftOf(other)) }, later(5))
    assert.equal((await S.getHandoff(b.token)).status, 'waiting')
    assert.deepEqual((await S.listOpenHandoffs('p6', later(6))).map((s) => s.token), [c.token, b.token])
  })

  await test('古い受け渡しは、次に作るときに消す（時間が過ぎて1日たったもの）', async () => {
    await kvSet('khand:oldoldoldoldoldoldoldold', { token: 'oldoldoldoldoldoldoldold', patientId: 'p9', patientName: '架空', title: 'x', status: 'waiting', createdAt: '2030-01-01T00:00:00.000Z', expiresAt: '2030-01-01T01:00:00.000Z' })
    const before = (await kvList('khand:')).length
    await S.createHandoff({ ...input, patientId: 'p7' }, NOW)
    const after = await kvList('khand:')
    assert.equal(after.length, before, '1つ消えて、1つ増えた')
    assert.ok(!after.some((x) => x.key === 'khand:oldoldoldoldoldoldoldold'))
    // カルテの控えなど、ほかの入れ物にはさわらない
    await kvSet('sync:clinic', { payload: {}, updatedAt: '2030-01-01T00:00:00.000Z' })
    await S.createHandoff({ ...input, patientId: 'p8' }, later(1))
    assert.ok(await kvGet('sync:clinic'))
  })
} finally {
  globalThis.fetch = realFetch
  for (const k of Object.keys(process.env)) if (!(k in saved)) delete process.env[k]
  Object.assign(process.env, saved)
  process.chdir(cwd)
  fs.rmSync(dir, { recursive: true, force: true })
}

console.log(`\n${passed} 件 OK`)
