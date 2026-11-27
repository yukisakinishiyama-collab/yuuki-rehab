// アウトカムの「測り方の図」（2026-11-27 院長「検査方法をChat Gptを使用して画像としても載せてください」）
// 実行: npx tsx tools/test-method-images.mjs
import assert from 'node:assert/strict'
import fs from 'node:fs'

const D = await import('../src/data/outcome-method-images.ts')
const M = await import('../src/data/outcome-metrics.ts')
const R = await import('../src/lib/karte/method-images.ts')
const KV = await import('../src/lib/marketing/kv-store-server.ts')
const read = (p) => fs.readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')

let passed = 0
function test(name, fn) {
  fn()
  passed += 1
  console.log(`  ✓ ${name}`)
}

test('図の場面は、ある指標だけ・説明つき', () => {
  assert.ok(D.METHOD_IMAGE_KEYS.length >= 20)
  for (const k of D.METHOD_IMAGE_KEYS) {
    assert.ok(M.getOutcomeMetric(k), `指標が無い: ${k}`)
    const s = D.METHOD_IMAGE_SCENES[k]
    assert.ok(s.caption.length >= 15 && s.caption.length <= 140, `caption の長さ: ${k}`)
    assert.ok(s.scene.length >= 120, `scene が短い: ${k}`)
    assert.ok(!/[ぁ-んァ-ン一-龥]/.test(s.scene), `scene は英語で: ${k}`)
  }
  // 質問票・聞くだけの指標には図を作らない
  for (const k of ['nrs', 'koos', 'odi', 'cait', 'visa_a', 'acl_rsi', 'firststep_nrs', 'run_minutes']) assert.ok(!D.METHOD_IMAGE_SCENES[k], k)
})

test('画像生成への決まり：顔なし・文字なし・院の中や施術を描かない', () => {
  const p = D.methodImagePrompt('wblt')
  assert.match(p, /knee-to-wall/)
  assert.match(p, /faceless/)
  assert.match(p, /Never include: any text/)
  assert.match(p, /clinic or hospital interior/)
  assert.match(p, /treatment scenes/)
  assert.equal(D.methodImagePrompt('koos'), null)
})

test('測り方の中身が指標の説明と食いちがわない（主なもの）', () => {
  assert.match(D.METHOD_IMAGE_SCENES.decline_squat_nrs.scene, /25 degrees/)
  assert.match(D.METHOD_IMAGE_SCENES.slhb.scene, /60 cm/)
  assert.match(D.METHOD_IMAGE_SCENES.side_hop.scene, /30 cm apart/)
  assert.match(D.METHOD_IMAGE_SCENES.lsi_hop_timed.scene, /6-meter/)
  assert.match(D.METHOD_IMAGE_SCENES.lsi_hop_cross.scene, /15 cm/)
  assert.match(D.METHOD_IMAGE_SCENES.gird.scene, /90 degrees/)
  assert.match(D.METHOD_IMAGE_SCENES.wblt.caption, /かかと/)
  assert.match(D.METHOD_IMAGE_SCENES.lsi_hip_add.caption, /仰向け/)
  assert.match(D.METHOD_IMAGE_SCENES.lsi_hip_abd.caption, /仰向け/)
})

const img = (u) => ({ url: u, model: 'gpt-image-1', createdAt: '2026-11-27T10:00:00.000Z' })
const NOW = '2026-11-27T11:00:00.000Z'

test('作る → 下書き。作り直すと前の下書きを消す', () => {
  let r = R.applyMethodImageAction({}, 'wblt', 'generate', NOW, img('a'))
  assert.deepEqual(r.next.wblt, { draft: img('a') })
  assert.deepEqual(r.toDelete, [])
  r = R.applyMethodImageAction(r.next, 'wblt', 'generate', NOW, img('b'))
  assert.equal(r.next.wblt.draft.url, 'b')
  assert.deepEqual(r.toDelete, ['a'])
})

test('使う → カルテに出す図に。前に使っていた図は消す', () => {
  const start = { wblt: { approved: { ...img('old'), approvedAt: 'x' }, draft: img('new') } }
  const r = R.applyMethodImageAction(start, 'wblt', 'approve', NOW)
  assert.equal(r.next.wblt.approved.url, 'new')
  assert.equal(r.next.wblt.approved.approvedAt, NOW)
  assert.equal(r.next.wblt.draft, undefined)
  assert.deepEqual(r.toDelete, ['old'])
})

test('やめる・外す。何も無くなったら記録から消す', () => {
  let r = R.applyMethodImageAction({ wblt: { draft: img('d') } }, 'wblt', 'discard', NOW)
  assert.deepEqual(r.next, {})
  assert.deepEqual(r.toDelete, ['d'])
  r = R.applyMethodImageAction({ wblt: { approved: img('a'), draft: img('d') } }, 'wblt', 'remove', NOW)
  assert.deepEqual(r.next, { wblt: { draft: img('d') } })
  assert.deepEqual(r.toDelete, ['a'])
})

test('できない操作は理由を返して、記録は変えない', () => {
  const store = { wblt: { approved: img('a') } }
  for (const a of ['approve', 'discard']) {
    const r = R.applyMethodImageAction(store, 'wblt', a, NOW)
    assert.ok(r.error)
    assert.equal(r.next, store)
  }
  assert.ok(R.applyMethodImageAction({}, 'wblt', 'remove', NOW).error)
  assert.ok(R.applyMethodImageAction({}, 'wblt', 'generate', NOW).error)
})

test('図の無い指標・指標の見分け', () => {
  const missing = R.keysWithoutImage({ wblt: { draft: img('d') }, slhb: { approved: img('a') } })
  assert.ok(!missing.includes('wblt') && !missing.includes('slhb'))
  assert.equal(missing.length, D.METHOD_IMAGE_KEYS.length - 2)
  assert.equal(R.isMethodImageKey('wblt'), true)
  assert.equal(R.isMethodImageKey('koos'), false)
  assert.equal(R.isMethodImageKey('__proto__'), false)
})

test('作るのは院長だけ・カルテに出すのは「使う」にした図だけ', () => {
  const route = read('src/app/api/karte/method-images/route.ts')
  assert.match(route, /export async function POST[\s\S]*requireAdmin/)
  assert.ok(KV.KV_PREFIXES.includes('omimg:'))
  const hint = read('src/components/rehab-management/MethodImageHint.tsx')
  assert.match(hint, /\.approved/)
  assert.ok(!/\.draft\?\.url|draft\.url/.test(hint), 'カルテには下書きの図を出さない')
  assert.match(read('src/components/rehab-management/OutcomeQuickTab.tsx'), /<MethodImageHint/)
  assert.match(R.METHOD_IMAGE_NOTE, /AI（ChatGPT）で作ったイメージ図/)
})

console.log(`\nmethod-images: ${passed} passed`)
