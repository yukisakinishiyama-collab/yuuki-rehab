// 予約画面の進み具合（ネット予約の画面で、どこまで進んだか）の集計の確認
// 実行: npx tsx tools/marketing/test-booking-funnel.mjs   （外には送らない・数字は架空）
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { FUNNEL_KEYS, FUNNEL_MIN_OPENS, readFunnel, summarizeFunnel } from '../../src/lib/marketing/booking-funnel.ts'

let passed = 0
function test(name, fn) {
  fn()
  passed += 1
  console.log(`  ✓ ${name}`)
}

const row = (date, source, n) => ({ date, source, open: 0, time: 0, info: 0, first: 0, repeat: 0, intake: 0, confirm: 0, done: 0, fee: 0, ...n })

test('段階の名前は、予約システム（GAS）の FUNNEL_STEPS と同じ並び', () => {
  assert.deepEqual([...FUNNEL_KEYS], ['open', 'time', 'info', 'first', 'repeat', 'intake', 'confirm', 'done', 'fee'])
})

test('受け取った値を確かめて読む：おかしな行は捨て、数字でないものは 0、知らない流入元は direct', () => {
  assert.equal(readFunnel(undefined), undefined)
  assert.equal(readFunnel({}), undefined)
  assert.deepEqual(readFunnel([]), [])
  const rows = readFunnel([
    { date: '2026-11-13', source: 'website', open: 12, time: 7, info: 6, first: 3, repeat: 1, intake: 2, confirm: 4, done: 3, fee: 5 },
    { date: '2026-11-13', source: 'Google Post!', open: '4', time: -2, info: 'x', done: 1.9 },
    { date: '11/13', source: 'line', open: 9 },
    null,
    'text',
    { date: '2026-11-14', source: 'line' },
  ])
  assert.equal(rows.length, 3)
  assert.deepEqual(rows[0], { date: '2026-11-13', source: 'website', open: 12, time: 7, info: 6, first: 3, repeat: 1, intake: 2, confirm: 4, done: 3, fee: 5 })
  assert.deepEqual(rows[1], row('2026-11-13', 'direct', { open: 4, done: 1 }))
  assert.deepEqual(rows[2], row('2026-11-14', 'line', {}))
})

test('まとめ：段ごとの回数・開いた回数に対する割合・前の段からの割合・いちばん減っている段', () => {
  const rows = [
    row('2026-11-12', 'website', { open: 10, time: 6, info: 5, first: 3, repeat: 1, intake: 3, confirm: 3, done: 2, fee: 4 }),
    row('2026-11-13', 'website', { open: 10, time: 4, info: 4, first: 1, repeat: 2, intake: 1, confirm: 3, done: 3, fee: 1 }),
    row('2026-11-13', 'line', { open: 5, time: 5, info: 5, first: 0, repeat: 5, confirm: 5, done: 4 }),
    row('2026-10-01', 'instagram', { open: 99, done: 99 }),
  ]
  const s = summarizeFunnel(rows, '2026-11-01')
  assert.equal(s.from, '2026-11-12')
  assert.equal(s.to, '2026-11-13')
  assert.deepEqual(s.total, { open: 25, time: 15, info: 14, first: 4, repeat: 8, intake: 4, confirm: 11, done: 9, fee: 5 })
  assert.deepEqual(s.stages.map((x) => [x.label, x.count, x.ofOpen, x.ofPrev]), [
    ['予約画面を開いた', 25, 100, null],
    ['時間を選んだ', 15, 60, 60],
    ['お客様情報の画面まで進んだ', 14, 56, 93],
    ['お客様情報を入れ終えた', 12, 48, 86],
    ['確認の画面まで進んだ', 11, 44, 92],
    ['予約を確定した', 9, 36, 82],
  ])
  assert.deepEqual(s.biggestDrop, { from: '予約画面を開いた', to: '時間を選んだ', fromCount: 25, toCount: 15, lost: 10 })
  assert.deepEqual(s.sources, [
    { source: 'website', label: 'ホームページ', open: 20, time: 10, filled: 7, done: 5, fee: 5, doneRate: 25 },
    { source: 'line', label: '公式LINE', open: 5, time: 5, filled: 5, done: 4, fee: 0, doneRate: 80 },
  ])
})

test('回数が少ないうちは「いちばん減っている段」を言わない。記録が無ければ null', () => {
  const few = summarizeFunnel([row('2026-11-13', 'direct', { open: FUNNEL_MIN_OPENS - 1, time: 1 })], '2026-11-01')
  assert.equal(few.biggestDrop, null)
  assert.equal(few.sources[0].label, 'ネット予約（流入元不明）')
  const enough = summarizeFunnel([row('2026-11-13', 'direct', { open: FUNNEL_MIN_OPENS, time: 1 })], '2026-11-01')
  assert.equal(enough.biggestDrop.lost, FUNNEL_MIN_OPENS - 1)
  assert.equal(summarizeFunnel([], '2026-11-01'), null)
  assert.equal(summarizeFunnel(undefined, '2026-11-01'), null)
  assert.equal(summarizeFunnel([row('2026-10-01', 'line', { open: 3 })], '2026-11-01'), null)
  // 開いた回数が 0 でも割り算で止まらない（数え始めの前から開いていた画面で進んだとき）
  const odd = summarizeFunnel([row('2026-11-13', 'line', { time: 2, done: 1 })], '2026-11-01')
  assert.deepEqual(odd.stages.map((x) => x.ofOpen), [null, null, null, null, null, null])
  assert.equal(odd.sources[0].doneRate, null)
})

const stats = fs.readFileSync(new URL('../../src/lib/marketing/booking-stats.ts', import.meta.url), 'utf8')
const api = fs.readFileSync(new URL('../../src/app/api/marketing/analytics/route.ts', import.meta.url), 'utf8')
const page = fs.readFileSync(new URL('../../src/app/(app)/marketing/analytics/page.tsx', import.meta.url), 'utf8')
test('つなぎ：予約システムの数字から読み、集客の効果の API と画面に出す', () => {
  assert.ok(stats.includes('funnel: readFunnel('))
  assert.ok(api.includes('screenFunnel: summarizeFunnel(stats.funnel, sinceDay)'))
  assert.ok(page.includes('<BookingScreenFunnel funnel={data.bookings?.screenFunnel ?? null}'))
  assert.ok(page.includes('人数ではありません'), '回数であることを画面に書く')
})

console.log(`\n予約画面の進み具合：${passed} 件すべて通りました。`)
