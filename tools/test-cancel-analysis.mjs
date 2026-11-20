// キャンセル分析（2026-11-20 院長「キャンセル率を下げる対策を」→「キャンセルの分析画面」）
// 実行: npx tsx tools/test-cancel-analysis.mjs
import assert from 'node:assert/strict'
import fs from 'node:fs'

const A = await import('../src/lib/cancel-analysis.ts')
const read = (p) => fs.readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')

let passed = 0
function test(name, fn) {
  fn()
  passed += 1
  console.log(`  ✓ ${name}`)
}

const TODAY = '2026-11-20'
// 架空の集計の行（お名前は無い）
const rows = []
const push = (n, o) => {
  for (let i = 0; i < n; i += 1) rows.push({ received: '2026-11-01', date: '2026-11-10', source: 'direct', visitType: '2回目以降', status: '来院済み', ...o })
}
push(20, { date: '2026-11-10', status: '来院済み' }) // 火
push(2, { date: '2026-11-10', status: 'キャンセル' })
push(10, { date: '2026-11-13', status: '来院済み' }) // 金
push(5, { date: '2026-11-13', status: 'キャンセル' })
push(12, { date: '2026-11-12', visitType: '初めて', status: '確定', received: '2026-11-11' }) // 木・1日前
push(1, { date: '2026-11-12', visitType: '初めて', status: 'キャンセル', received: '2026-11-11' })
push(3, { date: '2026-11-25', status: 'キャンセル' }) // まだ先 → 数えない
push(2, { date: '2026-11-11', status: '削除' }) // 削除は数えない

test('予約日が過ぎた予約だけ・削除は数えない・全体の率', () => {
  const s = A.bookingCancelStats(rows, TODAY)
  assert.equal(s.total, 50)
  assert.equal(s.cancelled, 8)
  assert.equal(s.rate, 16)
  assert.equal(s.from, '2026-11-10')
  assert.equal(s.to, '2026-11-13')
})

test('曜日・初めて/2回目以降・予約までの日数・流入元', () => {
  const s = A.bookingCancelStats(rows, TODAY, (src) => (src === 'direct' ? 'その他・直接' : src))
  const fri = s.byWeekday.find((c) => c.label === '金')
  assert.deepEqual([fri.total, fri.cancelled, fri.rate], [15, 5, 33.3])
  assert.deepEqual(s.byWeekday.map((c) => c.label), ['火', '木', '金'], '月曜はじまりの順')
  const first = s.byVisitType.find((c) => c.key === '初めての方')
  assert.deepEqual([first.total, first.cancelled], [13, 1])
  assert.equal(s.byLead.find((c) => c.key === 'd1').total, 13)
  assert.equal(s.byLead.find((c) => c.key === 'd8').total, 37)
  assert.equal(s.bySource[0].label, 'その他・直接')
})

test('カルテの記録：入力ミス・院側の都合を除く・範囲・区分・理由・何日前・くり返し・LINE 連携', () => {
  const rec = (o) => ({ id: Math.random().toString(), patientId: 'p1', kind: 'advance', appointmentDate: '2026-11-10', contactedDate: '2026-11-08', reason: '', memo: '', createdAt: '', ...o })
  const records = [
    rec({ reason: '仕事の都合' }),
    rec({ kind: 'same_day', contactedDate: '2026-11-12', appointmentDate: '2026-11-12', reason: '体調不良のため' }),
    rec({ patientId: 'p2', kind: 'no_show', contactedDate: '' }),
    rec({ patientId: 'p3', contactedDate: '2026-11-13', appointmentDate: '2026-11-14', reason: '雨' }),
    rec({ patientId: 'p3', excludedAs: 'input_error' }),
    rec({ patientId: 'p4', appointmentDate: '2026-10-01' }),
  ]
  const s = A.karteCancelStats(records, (id) => `架空${id}`, (id) => id === 'p1', '2026-11-01', '2026-11-19')
  assert.equal(s.total, 4)
  assert.deepEqual(s.byKind, { advance: 2, same_day: 1, no_show: 1 })
  assert.deepEqual(s.reasons.map((r) => r.label).sort(), ['その他', '仕事の都合', '体調不良', '記録なし'].sort())
  assert.deepEqual(Object.fromEntries(s.notice.map((n) => [n.label, n.count])), { '2〜3日前': 1, 前日: 1, 当日: 1, '連絡なし（無断）': 1 })
  assert.deepEqual(s.repeaters, [{ patientId: 'p1', name: '架空p1', count: 2, last: '2026-11-12', linked: true }])
  assert.deepEqual(s.people, { linked: 1, notLinked: 2 })
})

test('気づき：件数が少ないときは出さない・高い曜日・初めて/2回目以降・無断の多さ', () => {
  assert.deepEqual(A.cancelInsights(null, null), [])
  const s = A.bookingCancelStats(rows, TODAY)
  const msgs = A.cancelInsights(s, { total: 10, byKind: { advance: 5, same_day: 2, no_show: 3 }, reasons: [{ label: '仕事の都合', count: 4 }], notice: [], repeaters: [], people: { linked: 1, notLinked: 6 }, from: '', to: '' })
  assert.ok(msgs.some((m) => m.startsWith('金曜（33.3%）')), msgs)
  assert.ok(msgs.some((m) => m.includes('30%') && m.includes('無断')), msgs)
  assert.ok(msgs.some((m) => m.includes('LINE 連携がありません')), msgs)
  assert.ok(msgs.some((m) => m.includes('「仕事の都合」')), msgs)
  // 効果を約束する言い方・理由の決めつけはしない
  for (const m of msgs) assert.ok(!/必ず|確実に|減ります/.test(m), m)
})

test('画面・API・メニュー', () => {
  assert.ok(read('src/components/clinic/nav.ts').includes("'/marketing/sales/cancellations'"))
  const api = read('src/app/api/marketing/cancel-stats/route.ts')
  assert.ok(api.includes('requireAdmin(request)'), '院長だけ')
  const page = read('src/app/(app)/marketing/sales/cancellations/page.tsx')
  assert.ok(page.includes('この画面は院長だけが使えます'))
})

console.log(`\n${passed} 件 OK`)
