// 自動投稿パイプラインの計画ロジック（純粋関数）の確認
// 実行: node tools/marketing/test-autopilot-planner.mjs   （Node 22.18+ は .ts をそのまま読める）
import assert from 'node:assert/strict'
import {
  addDays,
  addMinutesLocal,
  availabilityText,
  dueWeekStart,
  jstParts,
  manualTargetWeek,
  mondayOf,
  pickThemes,
  planSlots,
  trackingUrl,
  weekdayOf,
} from '../../src/lib/marketing/autopilot-planner.ts'
import { CATEGORY_PATTERN, THEME_LIBRARY } from '../../src/lib/marketing/theme-library.ts'

let passed = 0
function test(name, fn) {
  fn()
  passed += 1
  console.log(`  ✓ ${name}`)
}
const at = (iso) => new Date(iso)

const SLOTS = [
  { weekday: 2, time: '12:00' },
  { weekday: 4, time: '19:00' },
  { weekday: 6, time: '09:00' },
  { weekday: 1, time: '19:00' },
  { weekday: 3, time: '12:00' },
]

console.log('日付・週')
test('日本時間の変換（UTC 15:30 → 翌日 0:30）', () => {
  const p = jstParts(at('2026-10-24T15:30:00Z'))
  assert.equal(p.date, '2026-10-25')
  assert.equal(p.weekday, 0)
  assert.equal(p.local, '2026-10-25T00:30')
})
test('月曜はじまりの週', () => {
  assert.equal(mondayOf('2026-10-25'), '2026-10-19') // 日曜 → その週の月曜
  assert.equal(mondayOf('2026-10-26'), '2026-10-26')
  assert.equal(mondayOf('2026-10-22'), '2026-10-19')
  assert.equal(weekdayOf('2026-10-22'), 4)
})
test('月・年またぎの日付計算', () => {
  assert.equal(addDays('2026-12-28', 7), '2027-01-04')
  assert.equal(addMinutesLocal('2026-10-31T23:50', 30), '2026-11-01T00:20')
})

console.log('いつ下書きを作るか')
test('日曜18時より前は作らない', () => {
  assert.equal(dueWeekStart(at('2026-10-25T08:59:00Z'), 18), null) // JST 17:59
})
test('日曜18時以降は翌週分', () => {
  assert.equal(dueWeekStart(at('2026-10-25T09:00:00Z'), 18), '2026-10-26') // JST 18:00
  assert.equal(dueWeekStart(at('2026-10-25T14:59:00Z'), 18), '2026-10-26') // JST 23:59
})
test('月曜の正午までは今週分を取り戻す／それ以降・平日は作らない', () => {
  assert.equal(dueWeekStart(at('2026-10-25T15:00:00Z'), 18), '2026-10-26') // 月 0:00
  assert.equal(dueWeekStart(at('2026-10-26T02:59:00Z'), 18), '2026-10-26') // 月 11:59
  assert.equal(dueWeekStart(at('2026-10-26T03:00:00Z'), 18), null) // 月 12:00
  assert.equal(dueWeekStart(at('2026-10-22T09:00:00Z'), 18), null) // 木
})
test('「今すぐ作る」：今週の枠が残っていれば今週、なければ来週', () => {
  // 木 10:00 → 木19時・土9時が残る → 今週
  assert.equal(manualTargetWeek(at('2026-10-22T01:00:00Z'), SLOTS, 3, () => false), '2026-10-19')
  // 今週分がもうある → 来週
  assert.equal(manualTargetWeek(at('2026-10-22T01:00:00Z'), SLOTS, 3, (w) => w === '2026-10-19'), '2026-10-26')
  // 土 10:00 → 残り枠なし → 来週
  assert.equal(manualTargetWeek(at('2026-10-24T01:00:00Z'), SLOTS, 3, () => false), '2026-10-26')
  // 日曜 → 来週
  assert.equal(manualTargetWeek(at('2026-10-25T01:00:00Z'), SLOTS, 3, () => false), '2026-10-26')
})

console.log('投稿枠')
test('本数ぶんの枠を日時順に（火・木・土）', () => {
  assert.deepEqual(planSlots('2026-10-26', SLOTS, 3, '2026-10-25T18:00'), [
    '2026-10-27T12:00',
    '2026-10-29T19:00',
    '2026-10-31T09:00',
  ])
})
test('5本なら月〜土に並ぶ', () => {
  assert.deepEqual(planSlots('2026-10-26', SLOTS, 5, '2026-10-25T18:00'), [
    '2026-10-26T19:00',
    '2026-10-27T12:00',
    '2026-10-28T12:00',
    '2026-10-29T19:00',
    '2026-10-31T09:00',
  ])
})
test('過ぎた枠・30分以内の枠は外す', () => {
  assert.deepEqual(planSlots('2026-10-26', SLOTS, 3, '2026-10-29T18:40'), ['2026-10-31T09:00'])
  assert.deepEqual(planSlots('2026-10-26', SLOTS, 3, '2026-10-29T18:20'), ['2026-10-29T19:00', '2026-10-31T09:00'])
})
test('不正な枠は無視', () => {
  assert.deepEqual(planSlots('2026-10-26', [{ weekday: 9, time: '12:00' }, { weekday: 2, time: '25:00x' }], 2, '2026-10-25T18:00'), [])
})

console.log('テーマ選び')
const ids = (list) => list.map((t) => t.id)
test('テーマ集のIDは重複なし・系統は3種類', () => {
  assert.equal(new Set(ids(THEME_LIBRARY)).size, THEME_LIBRARY.length)
  for (const t of THEME_LIBRARY) assert.ok(['expertise', 'prevention', 'clinic'].includes(t.category), t.id)
})
test('並び（症状→予防→案内）どおりに3本、同じテーマは出ない', () => {
  const picked = pickThemes(THEME_LIBRARY, CATEGORY_PATTERN[3], [], 10, '2026-10-26')
  assert.deepEqual(picked.map((t) => t.category), ['expertise', 'prevention', 'clinic'])
  assert.equal(new Set(ids(picked)).size, 3)
})
test('季節外れのテーマは選ばない（10月に年末の大掃除・夏の練習は出ない）', () => {
  for (let i = 0; i < 20; i += 1) {
    const picked = pickThemes(THEME_LIBRARY, ['prevention', 'prevention', 'prevention'], [], 10, `seed${i}`)
    for (const t of picked) assert.ok(!t.months || t.months.includes(10), t.id)
  }
})
test('最近使ったテーマは避ける（10週回しても直近と重ならない）', () => {
  const history = []
  for (let week = 0; week < 10; week += 1) {
    const picked = pickThemes(THEME_LIBRARY, CATEGORY_PATTERN[3], history, 10, `w${week}`)
    const recentFew = history.slice(0, 3)
    for (const t of picked) assert.ok(!recentFew.includes(t.id), `${t.id} が直近と重複（週${week}）`)
    history.unshift(...ids(picked).reverse())
  }
})
test('5本パターンでも系統の数どおり', () => {
  const picked = pickThemes(THEME_LIBRARY, CATEGORY_PATTERN[5], [], 3, 'x')
  assert.equal(picked.length, 5)
  assert.equal(new Set(ids(picked)).size, 5)
})

console.log('計測リンク')
test('予約への計測リンク', () => {
  assert.equal(
    trackingUrl('https://yuuki-rehab.vercel.app', 'google_post', 'ap20261026-1'),
    'https://yuuki-rehab.vercel.app/api/marketing/go?d=reserve&source=google_post&campaign=ap20261026-1',
  )
})

console.log('今週の空き状況')
const days = [
  { date: '2026-10-26', closed: false, am: 1, pm: 5 },
  { date: '2026-10-27', closed: false, am: 6, pm: 0 },
  { date: '2026-10-28', closed: false, am: 2, pm: 2 },
  { date: '2026-10-29', closed: false, am: 0, pm: 8 },
  { date: '2026-10-31', closed: false, am: 3, pm: 0 },
  { date: '2026-11-01', closed: true, am: 0, pm: 0 },
  { date: '2026-11-02', closed: false, am: 9, pm: 9 }, // 翌週は入れない
]
test('空きの多い時間帯を3つ、日付順に', () => {
  const t = availabilityText(days, '2026-10-26', '2026-10-25T18:30', '083-265-4545')
  assert.ok(t)
  const lines = t.body.split('\n').filter((l) => l.startsWith('・'))
  assert.deepEqual(lines, ['・10/26（月） 午後', '・10/27（火） 午前', '・10/29（木） 午後'])
  assert.ok(t.body.includes('10/25時点'))
  assert.ok(t.body.includes('083-265-4545'))
})
test('週の途中なら過ぎた日は入れない', () => {
  const t = availabilityText(days, '2026-10-26', '2026-10-28T07:00', '083')
  const lines = t.body.split('\n').filter((l) => l.startsWith('・'))
  assert.ok(lines.every((l) => !l.includes('10/26') && !l.includes('10/27')))
})
test('空きがほぼ無い週は投稿しない', () => {
  assert.equal(availabilityText([{ date: '2026-10-27', closed: false, am: 1, pm: 1 }], '2026-10-26', '2026-10-25T18:00', '083'), null)
})

console.log(`\n${passed} 件すべて成功`)
