// 月次レポート（前月比・前年同月比）の純粋関数の確認
// 実行: node tools/marketing/test-monthly-report.mjs   （Node 22.18+ は .ts をそのまま読める）
// 数字はすべて架空（ここで作る）。本物の院の数字は置かない。
import assert from 'node:assert/strict'
import { buildReport, delta, formatRate, lastYearOf, monthTotals, reportText, tone, METRIC_DEFS } from '../../src/lib/marketing/monthly-report.ts'

let passed = 0
function test(name, fn) {
  fn()
  passed += 1
  console.log(`  ✓ ${name}`)
}

/** 架空の月を作る：1日 visits 人・1人 unit 円（日曜は休み）。days 日まで */
function fakeMonth(month, visits, unit, days, repeat) {
  const [y, m] = month.split('-').map(Number)
  const dim = new Date(Date.UTC(y, m, 0)).getUTCDate()
  const rows = []
  for (let d = 1; d <= Math.min(days, dim); d++) {
    const sunday = new Date(Date.UTC(y, m - 1, d)).getUTCDay() === 0
    const v = sunday ? 0 : visits
    const selfV = Math.round(v * 0.6)
    const insV = v - selfV
    // cols: day, visits, sales, insV, insS, selfV, selfS, nonInsV, nonInsS, accV, accS, workV, workS
    rows.push([d, v, v * unit, insV, insV * Math.round(unit * 0.5), selfV, selfV * Math.round(unit * 1.33), 0, 0, 0, 0, 0, 0])
  }
  const sales = rows.reduce((s, r) => s + r[2], 0)
  return { v: 1, month, asOf: `${month}-${String(Math.min(days, dim)).padStart(2, '0')}`, exportedAt: '', cols: [], days: rows, total: [0, sales], self: [], goods: [], rank: [], repeat }
}

test('前年同月の文字列', () => {
  assert.equal(lastYearOf('2026-10'), '2025-10')
  assert.equal(lastYearOf('2026-01'), '2025-01')
})

test('差と変化率', () => {
  assert.deepEqual(delta(120, 100), { now: 120, before: 100, diff: 20, rate: 0.2 })
  assert.equal(delta(5, null).rate, null)
  assert.equal(delta(5, 0).rate, null)
  assert.equal(formatRate(delta(120, 100)), '+20%')
  assert.equal(formatRate(delta(80, 100)), '-20%')
})

test('月末までの月：合計・1日平均・自費の割合', () => {
  const m = fakeMonth('2026-09', 20, 2000, 30, { newPt: 4, reinit: 6, gone: 10 })
  const t = monthTotals(m, { month: '2026-09', subscription: 50000, cashless: 30000, overlap: 30000 })
  assert.equal(t.complete, true)
  assert.equal(t.openDays, 26) // 2026-09 は日曜4回
  assert.equal(t.visits, 26 * 20)
  assert.equal(t.outside, 50000)
  assert.equal(Math.round(t.perDay), 20)
  assert.ok(t.selfRatio > 50 && t.selfRatio < 100)
  assert.equal(t.newPt, 4)
})

test('途中の月は、比べる月も同じ日までで切る', () => {
  const months = [
    fakeMonth('2026-10', 22, 2000, 15), // 15日まで
    fakeMonth('2026-09', 20, 2000, 30),
    fakeMonth('2025-10', 18, 1900, 31),
  ]
  const r = buildReport(months, {})
  assert.ok(r)
  assert.equal(r.current.month, '2026-10')
  assert.equal(r.current.complete, false)
  assert.equal(r.current.throughDay, 15)
  assert.equal(r.prevMonth.throughDay, 15)
  assert.equal(r.lastYear.throughDay, 15)
  // 15日までの来院どうしで比べる（人数が 22 vs 20 なので増えている）
  const visits = r.rows.find((x) => x.def.key === 'visits')
  assert.ok(visits.prev.diff > 0)
  assert.ok(visits.lastYear.diff > 0)
})

test('月を指定して作る・前年が無ければ null', () => {
  const months = [fakeMonth('2026-10', 22, 2000, 31), fakeMonth('2026-09', 20, 2000, 30)]
  const r = buildReport(months, {}, '2026-09')
  assert.equal(r.current.month, '2026-09')
  assert.equal(r.prevMonth, null)
  assert.equal(r.lastYear, null)
  const total = r.rows.find((x) => x.def.key === 'total')
  assert.equal(total.prev.rate, null)
  assert.equal(formatRate(total.prev), '—')
})

test('色づけ：増えて良い指標・減って良い指標', () => {
  const visits = METRIC_DEFS.find((d) => d.key === 'visits')
  const gone = METRIC_DEFS.find((d) => d.key === 'gone')
  const openDays = METRIC_DEFS.find((d) => d.key === 'openDays')
  assert.equal(tone(visits, delta(12, 10)), 'good')
  assert.equal(tone(visits, delta(8, 10)), 'bad')
  assert.equal(tone(gone, delta(8, 10)), 'good')
  assert.equal(tone(openDays, delta(8, 10)), null)
  assert.equal(tone(visits, delta(10, 10)), null)
})

test('貼れる文に個人情報が無く、要点が入る', () => {
  const months = [fakeMonth('2026-10', 22, 2000, 31, { newPt: 5, reinit: 7, gone: 9 }), fakeMonth('2026-09', 20, 2000, 30, { newPt: 3, reinit: 6, gone: 12 })]
  const r = buildReport(months, { '2026-10': { month: '2026-10', subscription: 40000, cashless: 0, overlap: 0 } })
  const text = reportText(r)
  assert.match(text, /2026年10月 月次レポート/)
  assert.match(text, /売上（合計）/)
  assert.match(text, /新患 5人/)
  assert.match(text, /NOAH以外の収入: 40,000円/)
  assert.ok(r.summary.length >= 3)
})

console.log(`\n${passed} 件とも通りました`)
