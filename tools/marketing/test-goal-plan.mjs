// 「月の売上の目標への道すじ」の計算（純粋関数）の確認
// 実行: node tools/marketing/test-goal-plan.mjs   （Node 22.18+ は .ts をそのまま読める）
// 使う数字はすべて架空（fixtures/noah_sample.json）。本物の院の数字はこのリポジトリに置かない。
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {
  baseline,
  insights,
  isCompleteMonth,
  remainingWeekdays,
  requirement,
  scaleInput,
  simDefaults,
  simulate,
  solveBalanced,
  stages,
} from '../../src/lib/marketing/goal-plan.ts'

let passed = 0
function test(name, fn) {
  fn()
  passed += 1
  console.log(`  ✓ ${name}`)
}

const october = JSON.parse(fs.readFileSync(new URL('./fixtures/noah_sample.json', import.meta.url), 'utf8'))
const GOAL = 3_000_000

test('残りの営業日は日曜を除いて数える', () => {
  // 2026-10：24日（土）〜31日（土）のうち日曜は25日だけ → 7日
  assert.equal(remainingWeekdays('2026-10', 23), 7)
  assert.equal(remainingWeekdays('2026-10', 31), 0)
})

test('いまの位置：合計・1日平均・月末の見込み', () => {
  const b = baseline([october])
  assert.ok(b)
  assert.equal(b.month, '2026-10')
  assert.equal(b.complete, false)
  assert.equal(b.visits, october.total[0])
  assert.equal(b.sales, october.total[1])
  const kindsVisits = b.kinds.reduce((s, k) => s + k.visits, 0)
  assert.equal(kindsVisits, b.visits, '区分の来院の合計＝全体')
  const kindsSales = b.kinds.reduce((s, k) => s + k.sales, 0)
  assert.equal(kindsSales, b.sales, '区分の金額の合計＝全体')
  assert.equal(b.openDaysMonth, b.openDaysSoFar + 7)
  assert.ok(b.projectedSales > b.sales)
  assert.equal(b.newcomers, (october.repeat.newPt ?? 0) + (october.repeat.reinit ?? 0))
  assert.equal(b.lastComplete, null)
})

test('月が終わった月は見込み＝実績', () => {
  const full = { ...october, asOf: '2026-10-31' }
  assert.equal(isCompleteMonth(full), true)
  const b = baseline([full])
  assert.equal(b.projectedSales, b.sales)
  assert.equal(b.lastComplete.month, '2026-10')
})

test('試算の初期値は月末の見込みに近い', () => {
  const b = baseline([october])
  const d = simDefaults(b)
  const r = simulate(d)
  assert.ok(Math.abs(r.sales - b.projectedSales) / b.projectedSales < 0.02, `${r.sales} vs ${b.projectedSales}`)
})

test('来院だけ・自費の1回あたりだけ・そろって上げる の3通りが目標に届く', () => {
  const d = simDefaults(baseline([october]))
  const req = requirement(GOAL, d)
  const byVisits = simulate({ ...d, perDay: req.visitsOnly.perDay, accVisits: d.accVisits * req.visitsOnly.ratio })
  assert.ok(Math.abs(byVisits.sales - GOAL) / GOAL < 0.01, `来院だけ ${byVisits.sales}`)
  const bySelf = simulate({ ...d, selfUnit: req.selfUnitOnly.selfUnit })
  assert.ok(Math.abs(bySelf.sales - GOAL) / GOAL < 0.001, `自費だけ ${bySelf.sales}`)
  assert.ok(Math.abs(req.balanced.result.sales - GOAL) / GOAL < 0.01, `そろって ${req.balanced.result.sales}`)
  assert.ok(req.balanced.result.sales >= GOAL, '丸めても目標を下回らない')
  assert.ok(req.balanced.k > 1 && req.balanced.k < req.visitsOnly.ratio)
})

test('すでに届いているときは倍率1・段階なし', () => {
  const d = simDefaults(baseline([october]))
  assert.equal(solveBalanced(100_000, d), 1)
  assert.deepEqual(stages(100_000, d), [])
  assert.equal(scaleInput(d, 1).perDay, d.perDay)
})

test('道すじは4段で、最後は目標ちょうど・上乗せの合計＝差', () => {
  const b = baseline([october])
  const d = simDefaults(b)
  const st = stages(GOAL, d, b.maxDayVisits)
  assert.equal(st.length, 4)
  assert.deepEqual(
    st.map((s) => s.key),
    ['keep', 'new', 'value', 'capacity'],
  )
  assert.equal(st[3].target, GOAL)
  for (let i = 1; i < st.length; i++) assert.ok(st[i].target >= st[i - 1].target)
  const addSum = st.reduce((s, x) => s + x.add, 0)
  assert.ok(Math.abs(addSum - (GOAL - simulate(d).sales)) < 1)
  assert.match(st[2].measure, /自費・商品の1回あたり/)
  assert.match(st[3].measure, /体制の見直し/)
})

test('気づき：差・来院だけでは難しいこと・間があいた方の人数', () => {
  const b = baseline([october])
  const text = insights(GOAL, b, simDefaults(b)).map((i) => i.text).join('\n')
  assert.match(text, /月末の見込み/)
  assert.match(text, /来院を増やすだけでは難しく/)
  assert.match(text, new RegExp(`今月まだ来られていない方が${october.repeat.gone}人`))
  assert.doesNotMatch(text, /NaN|undefined|Infinity/)
})

test('NOAH以外の収入（サブスクなど）は合計に足し、来院で届かせる分を減らす', () => {
  const b = baseline([october])
  const plain = simDefaults(b)
  const withExtra = simDefaults(b, 200_000)
  const r0 = simulate(plain)
  const r1 = simulate(withExtra)
  assert.equal(r1.extra, 200_000)
  assert.equal(r1.noahSales, r0.noahSales)
  assert.equal(r1.sales, r0.sales + 200_000)
  assert.equal(r1.perVisit, r0.perVisit, '1回あたりはNOAHの分だけで計算')
  const q0 = requirement(GOAL, plain)
  const q1 = requirement(GOAL, withExtra)
  assert.ok(q1.visitsOnly.visits < q0.visitsOnly.visits)
  assert.ok(q1.selfUnitOnly.selfUnit < q0.selfUnitOnly.selfUnit)
  assert.ok(Math.abs(simulate({ ...withExtra, selfUnit: q1.selfUnitOnly.selfUnit }).sales - GOAL) < 1)
  const st = stages(GOAL, withExtra)
  assert.ok(Math.abs(st.reduce((s, x) => s + x.add, 0) - (GOAL - r1.sales)) < 1)
  assert.match(insights(GOAL, b, withExtra)[0].text, /NOAH以外/)
})

test('記録がない・来院0の月は null', () => {
  assert.equal(baseline([]), null)
  assert.equal(baseline([{ ...october, days: october.days.map((r) => r.map((v, i) => (i === 0 ? v : 0))) }]), null)
})

console.log(`\n${passed} OK`)
