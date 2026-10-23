// PDCA（施策の数字の自動集計）の純粋関数の確認
// 実行: node tools/marketing/test-pdca.mjs   （Node 22.18+ は .ts をそのまま読める）
// 使う数字はすべて架空（fixtures/noah_sample.json と、ここで作る予約・クリック）。本物の院の数字は置かない。
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {
  TEMPLATES,
  addDays,
  check,
  daysBetween,
  earliestNeeded,
  effectiveStatus,
  jstDate,
  measure,
  pdcaReminder,
  ruleReview,
} from '../../src/lib/marketing/pdca.ts'

let passed = 0
function test(name, fn) {
  fn()
  passed += 1
  console.log(`  ✓ ${name}`)
}

const october = JSON.parse(fs.readFileSync(new URL('./fixtures/noah_sample.json', import.meta.url), 'utf8'))

// 架空の予約：9/1〜10/23 に毎日1件（3日に1件は初めて、7日に1件はキャンセル、偶数日は instagram）
const bookings = []
for (let i = 0; i < 53; i++) {
  const d = addDays('2026-09-01', i)
  bookings.push({
    received: d,
    date: addDays(d, 2),
    source: i % 2 === 0 ? 'instagram' : 'google_post',
    campaign: i % 2 === 0 ? 'ap1' : 'gbp-1',
    visitType: i % 3 === 0 ? '初めて' : '2回目以降',
    status: i % 7 === 0 ? 'キャンセル' : '予約',
  })
}
// 架空のクリック：日本時間で 10/1〜10/10 に1日2回（予約1・地図1）、友だち追加 10/5 に3人
const events = []
for (let i = 0; i < 10; i++) {
  const d = addDays('2026-10-01', i)
  events.push({ at: `${d}T01:00:00.000Z`, kind: 'link_click', meta: { dest: 'reserve', source: 'google_post', campaign: 'gbp-1' } })
  events.push({ at: `${d}T02:00:00.000Z`, kind: 'link_click', meta: { dest: 'map', source: 'google_post' } })
}
for (let i = 0; i < 3; i++) events.push({ at: '2026-10-05T03:00:00.000Z', kind: 'line_follow', meta: {} })
// 日本時間の境目：UTC 10/10 15:30 は 日本時間 10/11 0:30
events.push({ at: '2026-10-10T15:30:00.000Z', kind: 'link_click', meta: { dest: 'reserve', source: 'instagram' } })

const data = { noahMonths: [october], bookings, bookingsSince: '2026-09-01', events }

const item = (patch) => ({
  id: 't',
  createdAt: '',
  updatedAt: '',
  status: 'doing',
  title: 't',
  purpose: '',
  hypothesis: '',
  metric: 'visits',
  target: 100,
  start: '2026-10-01',
  end: '2026-10-31',
  actions: [],
  logs: [],
  manual: [],
  ...patch,
})

test('日付：足し算・両端を含む日数・日本時間', () => {
  assert.equal(addDays('2026-10-31', 1), '2026-11-01')
  assert.equal(addDays('2026-03-01', -1), '2026-02-28')
  assert.equal(daysBetween('2026-10-01', '2026-10-31'), 31)
  assert.equal(daysBetween('2026-10-02', '2026-10-01'), 0)
  assert.equal(jstDate('2026-10-10T15:30:00.000Z'), '2026-10-11')
})

test('NOAH：期間の来院・売上・自費・1回あたり', () => {
  const sum = (col) => october.days.filter((r) => r[0] >= 5 && r[0] <= 11).reduce((s, r) => s + r[col], 0)
  const v = measure(item({ metric: 'visits' }), '2026-10-05', '2026-10-11', data)
  assert.equal(v.value, sum(1))
  assert.equal(measure(item({ metric: 'sales' }), '2026-10-05', '2026-10-11', data).value, sum(2))
  assert.equal(measure(item({ metric: 'selfSales' }), '2026-10-05', '2026-10-11', data).value, sum(6))
  const pv = measure(item({ metric: 'perVisit' }), '2026-10-05', '2026-10-11', data).value
  assert.ok(Math.abs(pv - sum(2) / sum(1)) < 1e-9)
  // 集計の無い期間
  const none = measure(item({ metric: 'visits' }), '2026-12-01', '2026-12-07', data)
  assert.equal(none.value, 0)
  assert.match(none.note, /まだありません/)
  assert.equal(none.coveredDays, 0)
  // 9月は記録が無いので、9/24〜10/23 のうち数えられたのは 10/1〜10/23 の23日
  assert.equal(measure(item({ metric: 'visits' }), '2026-09-24', '2026-10-23', data).coveredDays, 23)
})

test('評価：期間中にNOAHの数字がまだ無いときは、進みと比べを出さない', () => {
  const c = check(item({ metric: 'visits', start: '2026-10-24', end: '2026-11-22', target: 500 }), data, '2026-10-24')
  assert.equal(c.noData, true)
  assert.equal(c.progress, 0)
  assert.equal(c.change, null)
  assert.ok(c.notes.some((n) => /まだありません/.test(n)))
  assert.ok(!c.notes.some((n) => /前の晩/.test(n)))
})

test('予約：受付日で数え、キャンセルを除く・初めての方・流入元で絞る', () => {
  const inRange = bookings.filter((b) => b.received >= '2026-10-01' && b.received <= '2026-10-10' && b.status !== 'キャンセル')
  assert.equal(measure(item({ metric: 'bookings' }), '2026-10-01', '2026-10-10', data).value, inRange.length)
  assert.equal(
    measure(item({ metric: 'newBookings' }), '2026-10-01', '2026-10-10', data).value,
    inRange.filter((b) => b.visitType.startsWith('初')).length,
  )
  assert.equal(
    measure(item({ metric: 'bookings', filter: { source: 'instagram' } }), '2026-10-01', '2026-10-10', data).value,
    inRange.filter((b) => b.source === 'instagram').length,
  )
  const off = measure(item({ metric: 'bookings' }), '2026-10-01', '2026-10-10', { ...data, bookings: null })
  assert.match(off.note, /受け取れません/)
})

test('クリック：予約ボタンだけ・日本時間の日付・計測名で絞る／友だち追加', () => {
  assert.equal(measure(item({ metric: 'clicks' }), '2026-10-01', '2026-10-10', data).value, 10)
  assert.equal(measure(item({ metric: 'clicks' }), '2026-10-11', '2026-10-11', data).value, 1, '日本時間で翌日')
  assert.equal(measure(item({ metric: 'clicks', filter: { campaign: 'gbp-1' } }), '2026-10-01', '2026-10-31', data).value, 10)
  assert.equal(measure(item({ metric: 'lineFollows' }), '2026-10-01', '2026-10-31', data).value, 3)
})

test('評価：期間中のペース・前の同じ日数との比べ・目標への進み', () => {
  // 予約の施策：10/11〜10/31（21日）を 10/20 に見る → 10日たった
  const it = item({ metric: 'bookings', start: '2026-10-11', end: '2026-10-31', target: 20 })
  const c = check(it, data, '2026-10-20')
  assert.equal(c.phase, 'running')
  assert.equal(c.totalDays, 21)
  assert.equal(c.elapsedDays, 10)
  const actual = bookings.filter((b) => b.received >= '2026-10-11' && b.received <= '2026-10-20' && b.status !== 'キャンセル').length
  assert.equal(c.actual, actual)
  assert.ok(Math.abs(c.projected - (actual / 10) * 21) < 1e-9)
  assert.deepEqual(c.baselineRange, { from: '2026-09-20', to: '2026-10-10' })
  const base = bookings.filter((b) => b.received >= '2026-09-20' && b.received <= '2026-10-10' && b.status !== 'キャンセル').length
  assert.equal(c.baseline, base)
  assert.ok(Math.abs(c.change - (c.projected / base - 1)) < 1e-9)
  assert.ok(Math.abs(c.progress - c.projected / 20) < 1e-9)
})

test('評価：NOAHは前の晩までの日数でペースを出す・前の数字が無ければ注意', () => {
  // 10/1〜10/31 を 10/25 に見る（NOAHは 10/23 まで）
  const c = check(item({ metric: 'visits', target: 600 }), data, '2026-10-25')
  assert.equal(c.elapsedDays, 25)
  const visits = october.days.reduce((s, r) => s + r[1], 0)
  assert.equal(c.actual, visits)
  assert.ok(Math.abs(c.projected - (visits / 23) * 31) < 1e-9, `${c.projected}`)
  assert.ok(c.notes.some((n) => /前の晩/.test(n)))
  assert.ok(c.notes.some((n) => /目安/.test(n)), '9月のNOAHが無いので前との比べは目安')
})

test('評価：始まる前・終わったあと・1回あたりはペースで伸ばさない', () => {
  const before = check(item({ start: '2026-11-01', end: '2026-11-30' }), data, '2026-10-20')
  assert.equal(before.phase, 'before')
  assert.equal(before.actual, 0)
  const ended = check(item({ metric: 'bookings', start: '2026-10-01', end: '2026-10-10' }), data, '2026-10-20')
  assert.equal(ended.phase, 'ended')
  assert.equal(ended.projected, ended.actual)
  const pv = check(item({ metric: 'perVisit', target: 2000 }), data, '2026-10-20')
  assert.equal(pv.projected, pv.actual)
})

test('手入力の指標は期間の記録を足し、前との比べはしない', () => {
  const it = item({ metric: 'manual', manual: [{ at: '2026-10-03', value: 2 }, { at: '2026-10-09', value: 1 }, { at: '2026-09-30', value: 5 }], target: 5 })
  const c = check(it, data, '2026-10-20')
  assert.equal(c.actual, 3)
  assert.equal(c.baseline, null)
  assert.equal(c.change, null)
})

test('一覧の段階：期間が終われば「振り返り」・終わったものはそのまま', () => {
  assert.equal(effectiveStatus(item({ end: '2026-10-31' }), '2026-10-20'), 'doing')
  assert.equal(effectiveStatus(item({ end: '2026-10-31' }), '2026-11-01'), 'review')
  assert.equal(effectiveStatus(item({ status: 'done', end: '2026-10-31' }), '2026-11-01'), 'done')
  assert.equal(earliestNeeded([item({ start: '2026-10-11', end: '2026-10-31' }), item({ start: '2026-11-01', end: '2026-11-07' })]), '2026-09-20')
  assert.equal(earliestNeeded([]), null)
})

test('ひな形：どれも目標が1以上・やることがある・言葉に NaN などが無い', () => {
  const base = { visits30: 600, sales30: 1_200_000, selfSales30: 700_000, bookings30: 40, newBookings30: 8, clicks30: 30, follows30: 10, gone: 20 }
  const zero = { visits30: 0, sales30: 0, selfSales30: 0, bookings30: 0, newBookings30: 0, clicks30: 0, follows30: 0, gone: null }
  for (const t of TEMPLATES) {
    for (const b of [base, zero]) {
      const d = t.draft(b)
      assert.ok(d.target >= 1, `${t.id} ${d.target}`)
      assert.ok(d.actions.length >= 2, t.id)
      assert.ok(d.days >= 7)
      assert.doesNotMatch(JSON.stringify(d), /NaN|undefined|Infinity/)
    }
  }
})

test('振り返りの下書き（AIなし）：届けば続ける・届かず増えてもいなければやめる', () => {
  const it = item({ metric: 'bookings', target: 10, actions: [{ id: 'a', text: 'x', done: true }, { id: 'b', text: 'y', done: false }] })
  const base = { actual: 0, baseline: 10, baselineRange: { from: '', to: '' }, totalDays: 30, elapsedDays: 30, projected: 0, progress: 0, change: null, phase: 'ended', noData: false, notes: [] }
  assert.equal(ruleReview(it, { ...base, projected: 12, progress: 1.2, change: 0.2 }).decision, 'continue')
  const adj = ruleReview(it, { ...base, projected: 7, progress: 0.7, change: -0.3 })
  assert.equal(adj.decision, 'adjust')
  assert.match(adj.next, /できなかったやること/)
  assert.equal(ruleReview(it, { ...base, projected: 3, progress: 0.3, change: -0.7 }).decision, 'stop')
  assert.match(ruleReview(it, { ...base, projected: 3, progress: 0.3, change: -0.7 }).learned, /目標の30%（始める前の同じ日数より−70%）/)
})

test('毎晩のお知らせ：振り返りの時期・まもなく終わる・記録が止まっている', () => {
  const today = '2026-11-01'
  const ended = item({ id: 'a', title: '終わった施策', start: '2026-10-01', end: '2026-10-31' })
  const reviewed = item({ id: 'b', title: '振り返り済み', start: '2026-10-01', end: '2026-10-31', review: { decision: 'continue', learned: '', next: '', at: '' } })
  const soon = item({ id: 'c', title: 'もうすぐ', start: '2026-10-30', end: '2026-11-03', logs: [{ id: 'l', at: '2026-10-31', text: 'x' }] })
  const quiet = item({ id: 'd', title: '止まっている', start: '2026-10-10', end: '2026-11-30', logs: [{ id: 'l', at: '2026-10-20', text: 'x' }] })
  const active = item({ id: 'e', title: '動いている', start: '2026-10-10', end: '2026-11-30', actions: [{ id: 'x', text: 'x', done: true, doneAt: '2026-10-29' }] })
  const done = item({ id: 'f', title: '完了', status: 'done', start: '2026-10-01', end: '2026-10-31' })
  const lines = pdcaReminder([ended, reviewed, soon, quiet, active, done], today)
  assert.deepEqual(lines, [
    '振り返りの時期：「終わった施策」（10/31で終了）',
    'まもなく終わる：「もうすぐ」（あと2日）',
    '記録が止まっています：「止まっている」（この7日「やったこと」がありません）',
  ])
  assert.deepEqual(pdcaReminder([done, active], today), [])
  assert.equal(pdcaReminder([item({ id: 'g', title: '今日まで', start: '2026-10-30', end: '2026-11-01' })], today)[0], 'まもなく終わる：「今日まで」（今日まで）')
})

console.log(`\n${passed} OK`)
