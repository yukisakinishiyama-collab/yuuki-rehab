// 「月の売上の目標への道すじ」の計算（純粋関数）の確認
// 実行: node tools/marketing/test-goal-plan.mjs   （Node 22.18+ は .ts をそのまま読める）
// 使う数字はすべて架空（fixtures/noah_sample.json）。本物の院の数字はこのリポジトリに置かない。
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {
  baseline,
  insights,
  isCompleteMonth,
  isJpHoliday,
  remainingOpenDays,
  remainingWeekdays,
  saturdayRatio,
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

test('試算の初期値は月末の見込みと同じ（補正で丸めのずれを吸収）', () => {
  const b = baseline([october])
  const d = simDefaults(b)
  const r = simulate(d)
  assert.ok(Math.abs(r.noahSales - b.projectedSales) < 1, `${r.noahSales} vs ${b.projectedSales}`)
  assert.ok(Math.abs(d.calib - 1) < 0.05, `補正はふつう1に近い ${d.calib}`)
  const full = baseline([{ ...october, asOf: '2026-10-31' }])
  assert.ok(Math.abs(simulate(simDefaults(full)).noahSales - full.sales) < 1, '月が終わった月は実績と同じ')
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

test('祝日：振替休日・国民の休日・ハッピーマンデー・春分秋分', () => {
  for (const d of ['2026-01-01', '2026-01-12', '2026-02-23', '2026-03-20', '2026-05-06', '2026-07-20', '2026-09-21', '2026-09-22', '2026-09-23', '2026-10-12', '2026-11-03', '2026-11-23', '2025-11-24', '2027-01-11']) {
    assert.equal(isJpHoliday(d), true, d)
  }
  for (const d of ['2026-10-23', '2026-05-07', '2026-09-24', '2026-12-25', '2026-03-19']) {
    assert.equal(isJpHoliday(d), false, d)
  }
})

test('これからの営業日は日曜・祝日を除き、平日と土曜に分ける', () => {
  // 2026-11：日曜5日・祝日2日（3日・23日）を除いて23日。そのうち土曜は4日
  assert.deepEqual(remainingOpenDays('2026-11', 0), { week: 19, sat: 4 })
  assert.equal(remainingWeekdays('2026-11', 0), 23)
  // 2026-10：24日〜31日は祝日なし（平日5・土曜2）
  assert.deepEqual(remainingOpenDays('2026-10', 23), { week: 5, sat: 2 })
})

test('土曜は半日として見込む（土曜の割合はこれまでの記録から）', () => {
  const r = saturdayRatio([october])
  assert.ok(r.visits > 0.2 && r.visits < 1, `来院 ${r.visits}`)
  assert.ok(r.sales > 0.2 && r.sales < 1, `金額 ${r.sales}`)
  const b = baseline([october])
  // 平日1日あたりに直した金額 × （平日5 ＋ 土曜2 × 割合）
  let sat = 0
  for (const row of october.days) if (row[1] > 0 && new Date(Date.UTC(2026, 9, row[0])).getUTCDay() === 6) sat += 1
  const perWeekday = b.sales / (b.openDaysSoFar - sat + r.sales * sat)
  assert.equal(b.projectedSales, Math.round(b.sales + perWeekday * (5 + r.sales * 2)))
  const flat = Math.round(b.sales + (b.sales / b.openDaysSoFar) * 7)
  assert.ok(b.projectedSales < flat, '土曜を1日と数えるより少なめ')
})

test('区分の合計が全体と合わない月でも、初期値は実際の見込みと同じ・注意を出す', () => {
  // 自費の来院・金額を2重に数えてしまった月（架空）
  const broken = { ...october, days: october.days.map((r) => r.map((v, i) => (i === 5 || i === 6 ? v * 2 : v))) }
  const b = baseline([broken])
  assert.equal(b.mismatch, true)
  assert.equal(baseline([october]).mismatch, false)
  const d = simDefaults(b)
  assert.ok(Math.abs(simulate(d).noahSales - b.projectedSales) < 1)
  assert.ok(d.calib < 1, `補正で下げる ${d.calib}`)
  const req = requirement(GOAL, d)
  assert.ok(Math.abs(simulate({ ...d, selfUnit: req.selfUnitOnly.selfUnit }).sales - GOAL) < 1, '自費だけでも補正込みで届く')
  assert.match(insights(GOAL, b, d).map((i) => i.text).join('\n'), /合っていません/)
})

test('差が小さいときも、段階の目標は目標を超えず、上乗せの合計＝差', () => {
  const b = baseline([october])
  const d = simDefaults(b)
  const goal = Math.round(simulate(d).sales + 35_000)
  const st = stages(goal, d, b.maxDayVisits)
  assert.equal(st.length, 4)
  for (const x of st) assert.ok(x.target <= goal, `${x.target} > ${goal}`)
  for (let i = 1; i < st.length; i++) assert.ok(st[i].target >= st[i - 1].target)
  assert.ok(Math.abs(st.reduce((s, x) => s + x.add, 0) - (goal - simulate(d).sales)) < 1)
})

test('自費の来院が無い月は、自費の段を「自費の方を増やす」目安にする', () => {
  const noSelf = { ...october, days: october.days.map((r) => r.map((v, i) => (i === 5 || i === 6 ? 0 : v))) }
  const fixed = { ...noSelf, days: noSelf.days.map((r) => [r[0], r[3] + r[9], r[4] + r[10], ...r.slice(3)]) }
  const b = baseline([fixed])
  const st = stages(GOAL, simDefaults(b), b.maxDayVisits)
  assert.match(st[2].measure, /自費・商品の方を \+/)
  assert.doesNotMatch(st[2].measure, /\+0円/)
})

test('新しい月に来院がまだ無いときは、前の月（実績）を使い、言葉も実績に合わせる', () => {
  const full = { ...october, asOf: '2026-10-31' }
  const nov = { ...october, month: '2026-11', asOf: '2026-11-01', days: [[1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]], repeat: undefined }
  const b = baseline([nov, full])
  assert.equal(b.month, '2026-10')
  assert.equal(b.complete, true)
  const text = insights(GOAL, b, simDefaults(b)).map((i) => i.text).join('\n')
  assert.match(text, /10月は/)
  assert.doesNotMatch(text, /月末の見込み|今月まだ/)
})

test('来院だけで：切り上げると目標を下回らない', () => {
  const d = simDefaults(baseline([october]))
  const req = requirement(GOAL, d)
  const r = simulate({
    ...d,
    perDay: Math.ceil(req.visitsOnly.perDay * 10 - 1e-9) / 10,
    accVisits: Math.ceil(d.accVisits * req.visitsOnly.ratio - 1e-9),
  })
  assert.ok(r.sales >= GOAL, `${r.sales}`)
})

console.log(`\n${passed} OK`)
