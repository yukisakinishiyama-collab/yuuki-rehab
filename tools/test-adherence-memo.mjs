// 自宅運動の実施状況（未確認・理由）と、簡易メモの種類（説明・同意の記録）の確認（データはすべて架空）
// 実行: npx tsx tools/test-adherence-memo.mjs
import assert from 'node:assert/strict'
import { register } from 'node:module'
const SRC = new URL('../src/', import.meta.url).href
register(
  'data:text/javascript,' +
    encodeURIComponent(
      `export async function resolve(s, c, next) { if (s.startsWith('@/')) s = ${JSON.stringify(SRC)} + s.slice(2); try { return await next(s, c) } catch (e) { if (!/\\.[a-z]+$/.test(s.split('?')[0])) return next(s + '.ts', c); throw e } }`,
    ),
)

const root = new URL('../', import.meta.url)
const A = await import(new URL('src/lib/karte/adherence.ts', root).href)
const M = await import(new URL('src/lib/karte/memo-kinds.ts', root).href)

let passed = 0
function test(name, fn) {
  fn()
  passed += 1
  console.log(`  ✓ ${name}`)
}

test('実施・一部実施・未実施・未確認の4つ（今までの3つの値はそのまま読める）', () => {
  assert.deepEqual(A.ADHERENCE_OPTIONS.map((o) => o.value), ['done', 'partial', 'not_done', 'unknown'])
  assert.equal(A.adherenceText('done'), '実施')
  assert.equal(A.adherenceText('partial', true), '⚠️ 一部実施')
  assert.equal(A.adherenceText('not_done', true), '❌ 未実施')
  assert.equal(A.adherenceText('unknown'), '未確認')
  assert.equal(A.adherenceText(undefined), '未確認')
})

test('実施率：未確認はグラフに入れない（今までの値は今までどおり 100・50・0）', () => {
  assert.equal(A.adherenceRate('done'), 100)
  assert.equal(A.adherenceRate('partial'), 50)
  assert.equal(A.adherenceRate('not_done'), 0)
  assert.equal(A.adherenceRate('unknown'), null)
})

test('理由は未実施・一部実施のときだけ。理由から見直しの手がかりを出す（危ない方とは決めない）', () => {
  assert.equal(A.needsReason('not_done'), true)
  assert.equal(A.needsReason('partial'), true)
  assert.equal(A.needsReason('done'), false)
  assert.equal(A.needsReason('unknown'), false)
  for (const r of ['痛み', '時間が足りない', '費用', '体調', '必要性に疑問']) assert.ok(A.ADHERENCE_REASONS.includes(r), r)
  const hints = A.adherenceReviewHints(['痛み', '時間が足りない', 'その他'])
  assert.equal(hints.length, 2)
  assert.ok(hints.every((h) => !/危険|リスク高|離脱/.test(h)))
  assert.deepEqual(A.adherenceReviewHints(undefined), [])
})

test('簡易メモの種類：指示書の8項目を残せる（説明日は日付・同意の状況・自主トレの合意・中断・自己判断の再開・計画変更・注意事項・希望と方針）', () => {
  const labels = M.MEMO_KINDS.map((k) => k.label)
  for (const l of ['治療方針の説明・同意', '自主トレの合意', '治療中断の申し出', '自己判断での運動・競技の再開', '治療計画の変更', '説明した注意事項', '患者さんの希望と最終的な方針']) {
    assert.ok(labels.includes(l), l)
  }
  assert.equal(M.memoKindLabel(undefined), null)
  assert.equal(M.memoKindLabel('explain'), '治療方針の説明・同意')
  // 責任がなくなる・免除される、のような言い方はしない
  assert.ok(M.MEMO_KINDS.every((k) => !/免責|責任.*(なし|なくなる|消滅)/.test(k.template + k.label)))
})

test('種類をえらぶと、欄が空なら見本を入れる。書いてある文は消さない。ふつうのメモに戻すと見本だけ消す', () => {
  const t = M.memoTemplateFor('explain', '')
  assert.match(t, /説明した内容/)
  assert.equal(M.memoTemplateFor('explain', '昨日は痛みが少なかった'), '昨日は痛みが少なかった')
  // 見本のまま別の種類に変えると、見本が入れかわる
  assert.match(M.memoTemplateFor('plan_change', t), /変更前/)
  assert.equal(M.memoTemplateFor(null, t), '')
  assert.equal(M.memoTemplateFor(null, '書いた文'), '書いた文')
})

console.log(`\n${passed} 件成功・0 件失敗`)
