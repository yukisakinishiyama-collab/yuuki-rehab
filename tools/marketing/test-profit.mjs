// 経費・利益・損益分岐点の純粋関数の確認。数字はすべて架空
// 実行: node tools/marketing/test-profit.mjs
import assert from 'node:assert/strict'
import { monthProfit, revenueForProfit, sum } from '../../src/lib/marketing/profit.ts'

let passed = 0
function test(name, fn) {
  fn()
  passed += 1
  console.log(`  ✓ ${name}`)
}

const settings = {
  fixed: [
    { id: 'rent', label: '家賃', amount: 150000 },
    { id: 'staff', label: '人件費', amount: 250000 },
  ],
  variableRate: 10,
  oneOff: { '2026-10': [{ id: 'x', label: '機器の修理', amount: 50000 }] },
}

test('固定費の合計', () => {
  assert.equal(sum(settings.fixed), 400000)
})

test('月末までの月：利益・利益率・損益分岐点', () => {
  const p = monthProfit({ month: '2026-09', sales: 1000000, outside: 50000, visits: 500, openDays: 26, remainingOpenDays: 0 }, settings)
  assert.equal(p.revenue, 1050000)
  assert.equal(p.fixed, 400000)
  assert.equal(p.variable, 105000)
  assert.equal(p.oneOff, 0)
  assert.equal(p.profit, 1050000 - 400000 - 105000)
  assert.ok(Math.abs(p.margin - p.profit / 1050000) < 1e-9)
  // 分岐点 = 400000 / 0.9
  assert.equal(p.breakEven, Math.round(400000 / 0.9))
  assert.equal(p.toBreakEven, p.breakEven - 1050000)
  assert.equal(p.projected, null)
})

test('臨時の出費が入る月と、分岐点に要る来院回数', () => {
  const p = monthProfit({ month: '2026-10', sales: 600000, outside: 0, visits: 300, openDays: 15, remainingOpenDays: 11 }, settings)
  assert.equal(p.oneOff, 50000)
  assert.equal(p.breakEven, Math.round(450000 / 0.9))
  // 来院1回あたり 2000円 → 500000/2000 = 250 回
  assert.equal(p.breakEvenVisits, 250)
})

test('途中の月：このペースの月末の見込み', () => {
  const p = monthProfit({ month: '2026-10', sales: 600000, outside: 40000, visits: 300, openDays: 15, remainingOpenDays: 11 }, settings)
  assert.ok(p.projected)
  // 1日 40000円 × 残り11日 = 440000 → 売上 1,040,000 + 40,000
  assert.equal(p.projected.revenue, 1080000)
  assert.equal(p.projected.profit, 1080000 - (400000 + 50000 + Math.round(1080000 * 0.1)))
})

test('目標の利益に要る売上', () => {
  assert.equal(revenueForProfit(300000, settings, '2026-09'), Math.round(700000 / 0.9))
  assert.equal(revenueForProfit(300000, settings, '2026-10'), Math.round(750000 / 0.9))
})

test('変動費率は 0〜95% に丸める', () => {
  const p = monthProfit({ month: '2026-09', sales: 100000, outside: 0, visits: 50, openDays: 10, remainingOpenDays: 0 }, { ...settings, variableRate: 200 })
  assert.equal(p.variable, 95000)
})

console.log(`\n${passed} 件とも通りました`)
