// 患者さんの動き（離反・リピート）の純粋関数の確認。数字・名前はすべて架空
// 実行: node tools/marketing/test-patient-movement.mjs
import assert from 'node:assert/strict'
import { bandOf, callCandidates, countBands, patientGaps, repeatRows } from '../../src/lib/marketing/patient-movement.ts'

let passed = 0
function test(name, fn) {
  fn()
  passed += 1
  console.log(`  ✓ ${name}`)
}

const today = '2026-10-26'
const patients = [
  { id: 'a', name: '患者A', phone: '090-0000-0001', status: 'active', firstVisitDate: '2026-09-01' },
  { id: 'b', name: '患者B', phone: '090-0000-0002', status: 'active', firstVisitDate: '2026-05-01', noah: { lastVisit: '2026-10-20', visitCount: 12 } },
  { id: 'c', name: '患者C', phone: '090-0000-0003', status: 'active', firstVisitDate: '2026-06-01' },
  { id: 'd', name: '患者D', phone: '', status: 'discharged', firstVisitDate: '2026-01-01' },
  { id: 'e', name: '患者E', phone: '', status: 'active' },
]
const visits = [
  { patientId: 'a', visitDate: '2026-10-01' },
  { patientId: 'a', visitDate: '2026-10-05' },
  { patientId: 'c', visitDate: '2026-06-10' },
  { patientId: 'c', visitDate: '2026-11-01' }, // 未来の日は数えない
]

test('帯の分け方', () => {
  assert.equal(bandOf(0), 'active')
  assert.equal(bandOf(14), 'active')
  assert.equal(bandOf(15), 'w2')
  assert.equal(bandOf(28), 'w2')
  assert.equal(bandOf(29), 'm1')
  assert.equal(bandOf(60), 'm1')
  assert.equal(bandOf(61), 'm2')
  assert.equal(bandOf(91), 'm3plus')
  assert.equal(bandOf(null), 'none')
})

test('最後に来た日：SOAP・NOAH・初診日のいちばん新しい日。終了の方は除く。未来は数えない', () => {
  const gaps = patientGaps(patients, visits, today)
  assert.equal(gaps.length, 4) // d（終了）は除く
  const a = gaps.find((g) => g.id === 'a')
  assert.equal(a.lastVisit, '2026-10-05')
  assert.equal(a.days, 21)
  assert.equal(a.visits, 2)
  const b = gaps.find((g) => g.id === 'b')
  assert.equal(b.lastVisit, '2026-10-20')
  assert.equal(b.visits, 12)
  const c = gaps.find((g) => g.id === 'c')
  assert.equal(c.lastVisit, '2026-06-10')
  const e = gaps.find((g) => g.id === 'e')
  assert.equal(e.lastVisit, null)
  assert.equal(e.days, null)
  // 空いている日数が長い順
  assert.equal(gaps[0].id, 'c')
})

test('帯ごとの人数と、声かけの候補', () => {
  const gaps = patientGaps(patients, visits, today)
  const bands = countBands(gaps)
  assert.equal(bands.active, 1) // b
  assert.equal(bands.w2, 1) // a（21日）
  assert.equal(bands.m3plus, 1) // c
  assert.equal(bands.none, 1) // e
  const cands = callCandidates(gaps)
  assert.deepEqual(
    cands.map((c) => c.id),
    ['a'],
  ) // 2〜8週・2回以上
})

test('NOAHのリピート率の並び：継続率と月末までか', () => {
  const rows = repeatRows([
    { month: '2026-10', asOf: '2026-10-24', days: [], repeat: { last: 60, gone: 30, selfGone: 8, newPt: 3, reinit: 7 } },
    { month: '2026-09', asOf: '2026-09-30', days: [], repeat: { last: 55, gone: 11 } },
    { month: '2026-08', asOf: '2026-08-31', days: [] },
  ])
  assert.equal(rows[0].month, '2026-10')
  assert.equal(rows[0].complete, false)
  assert.equal(rows[0].rate, 0.5)
  assert.equal(rows[1].complete, true)
  assert.equal(rows[1].rate, 0.8)
  assert.equal(rows[2].rate, null)
})

console.log(`\n${passed} 件とも通りました`)
