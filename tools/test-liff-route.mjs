// LIFF の行き先（2026-11-20 院長「カルテでLINE連携した時に患者様側の表示がおかしくなったりします」）
// カルテのQR・メニューの「カルテ連携」（https://liff.line.me/{LIFF_ID}/link…）で開いたときに、
// 予約の橋渡し（/liff/yoyaku）が予約のページへ進まないことを確かめる
// 実行: npx tsx tools/test-liff-route.mjs
import assert from 'node:assert/strict'
import fs from 'node:fs'

const R = await import('../src/lib/liff-route.ts')
const read = (p) => fs.readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')

let passed = 0
function test(name, fn) {
  fn()
  passed += 1
  console.log(`  ✓ ${name}`)
}

const CODE = 'AbCdEfGhIjKlMnOpQrStUvWx'
const LID = '2010991753-yKKnDDnb'

test('liff.state に /link があれば、カルテ連携のページ（QR の番号も読む）', () => {
  // LINE が付ける形：liff.state=%2Flink%3Fc%3D…（URLSearchParams がほどく）
  const q = `?lid=${LID}&liff.state=${encodeURIComponent(`/link?c=${CODE}`)}`
  assert.deepEqual(R.liffSubpageOf(q), { page: 'link', code: CODE })
  assert.deepEqual(R.liffSubpageOf(`?liff.state=${encodeURIComponent('/link')}&lid=${LID}`), { page: 'link', code: '' })
  assert.deepEqual(R.liffSubpageOf(`?liff.state=${encodeURIComponent('link/?c=' + CODE)}`), { page: 'link', code: CODE })
})

test('liff.state が無い・知らない行き先なら null（今までどおり予約へ）', () => {
  assert.equal(R.liffSubpageOf(`?lid=${LID}`), null)
  assert.equal(R.liffSubpageOf(''), null)
  assert.equal(R.liffSubpageOf(`?liff.state=${encodeURIComponent('/?store=x')}`), null)
  assert.equal(R.liffSubpageOf(`?liff.state=${encodeURIComponent('/evil?c=' + CODE)}`), null)
  assert.equal(R.liffSubpageOf(`?liff.state=${encodeURIComponent('//example.com/link')}`), null)
})

test('おかしな番号は付けない', () => {
  assert.deepEqual(R.liffSubpageOf(`?liff.state=${encodeURIComponent('/link?c=<script>')}`), { page: 'link', code: '' })
})

test('自分で進むアドレス：このサイトの /liff/yoyaku/link（lid と正しい番号だけ）', () => {
  assert.equal(R.liffSubpageUrl({ page: 'link', code: CODE }, LID), `/liff/yoyaku/link?lid=${LID}&c=${CODE}`)
  assert.equal(R.liffSubpageUrl({ page: 'link', code: '' }, LID), `/liff/yoyaku/link?lid=${LID}`)
  assert.equal(R.liffSubpageUrl({ page: 'link', code: 'x' }, 'bad'), '/liff/yoyaku/link')
})

test('橋渡しのページ：行き先があるときは予約へ進まない・待っている文も変える', () => {
  const page = read('src/app/liff/yoyaku/page.tsx')
  assert.ok(page.includes('if (liffSubpageOf(window.location.search)) return'), '予約へ進む処理は、行き先があるときは動かない')
  assert.ok(page.includes('window.location.replace(liffSubpageUrl(sub, lid))'), 'LINE が進めなければ自分で進む')
  assert.ok(page.includes('liffSubpageWaitText(subpage)'))
  assert.ok(page.includes('{slow && !subpage && ('), '「予約ページへ進む」のボタンは出さない')
  assert.equal(R.liffSubpageWaitText('link'), 'LINEとカルテを結びつけるページを開いています…')
})

console.log(`\n${passed} 件 OK`)
