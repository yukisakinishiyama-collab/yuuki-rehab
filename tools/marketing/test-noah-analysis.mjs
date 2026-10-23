// NOAH集計の計算と「今日のまとめ」の文面（純粋関数）の確認
// 実行: node tools/marketing/test-noah-analysis.mjs   （Node 22.18+ は .ts をそのまま読める）
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {
  dateLabel,
  daysInMonth,
  freeRatio,
  mergeMonths,
  missingText,
  monthPoints,
  nextDayAvailabilityText,
  nextOpenDay,
  nightlyText,
  pickDraftDay,
  prevMonthOf,
  suggestions,
  summarize,
  weekdayAverages,
} from '../../src/lib/marketing/noah-analysis.ts'

let passed = 0
function test(name, fn) {
  fn()
  passed += 1
  console.log(`  ✓ ${name}`)
}

// 実物（2026年10月23日に NOAH から書き出した集計。PCの noah_to_json.py が作ったもの）
const october = JSON.parse(fs.readFileSync(new URL('./fixtures/noah_2026-10-23.json', import.meta.url), 'utf8'))
delete october.hash

/** 9月（30日分）のそれっぽい集計：日曜は0、ほかは曜日で少し変える */
function makeMonth(month, lastDay, perDay = (wd) => 20 + wd, repeat) {
  const days = []
  for (let d = 1; d <= lastDay; d += 1) {
    const wd = new Date(`${month}-${String(d).padStart(2, '0')}T00:00:00Z`).getUTCDay()
    const v = wd === 0 ? 0 : perDay(wd)
    const ins = Math.round(v * 0.4)
    const self = v - ins
    days.push([d, v, ins * 1000 + self * 2000, ins, ins * 1000, self, self * 2000, 0, 0, 0, 0, 0, 0])
  }
  return {
    month,
    asOf: `${month}-${String(lastDay).padStart(2, '0')}`,
    exportedAt: `${month}-${String(lastDay).padStart(2, '0')}T21:05`,
    days,
    total: [],
    self: [],
    goods: [],
    rank: [],
    repeat,
  }
}

test('日付の小道具', () => {
  assert.equal(dateLabel('2026-10-23'), '10/23（金）')
  assert.equal(daysInMonth('2026-02'), 28)
  assert.equal(daysInMonth('2028-02'), 29)
  assert.equal(prevMonthOf('2026-01'), '2025-12')
  assert.equal(prevMonthOf('2026-10'), '2026-09')
})

test('実物の10月分を日ごとに読める（区分の合計＝全体）', () => {
  const pts = monthPoints(october)
  assert.equal(pts.length, 23)
  assert.equal(pts[0].date, '2026-10-01')
  assert.equal(pts[22].visits, 24)
  assert.equal(pts[22].sales, 32760)
  for (const p of pts) {
    assert.equal(p.ins[0] + p.self[0] + p.acc[0] + p.work[0] + p.nonIns[0], p.visits)
    assert.equal(p.ins[1] + p.self[1] + p.acc[1] + p.work[1] + p.nonIns[1], p.sales)
  }
})

test('月のまとめ：同じ月は集計日の新しい方で置きかえ、新しい月が先頭', () => {
  const a = makeMonth('2026-10', 20)
  const b = makeMonth('2026-10', 23)
  const c = makeMonth('2026-09', 30)
  const merged = mergeMonths([a, c], [b])
  assert.deepEqual(merged.map((m) => `${m.month}@${m.asOf}`), ['2026-10@2026-10-23', '2026-09@2026-09-30'])
  // 古いファイルが後から来ても戻らない
  assert.equal(mergeMonths(merged, [a])[0].asOf, '2026-10-23')
  assert.equal(mergeMonths([], [a, b, c], 1).length, 1)
})

const september = makeMonth('2026-09', 30, (wd) => 18 + wd, { newPt: 6, reinit: 9, goneCont: 4 })

test('最新日・今月累計・先月の同じ時期・同じ曜日の平均', () => {
  const s = summarize([october, september])
  assert.equal(s.date, '2026-10-23')
  assert.equal(s.today.visits, 24)
  assert.equal(s.mtd.visits, 480)
  assert.equal(s.mtd.sales, 927035)
  assert.equal(s.mtd.selfRatio, Math.round((608827 / 927035) * 100))
  // 先月は 9/1〜9/23
  const prevVisits = monthPoints(september).filter((p) => p.day <= 23).reduce((t, p) => t + p.visits, 0)
  assert.equal(s.prev.visits, prevVisits)
  assert.equal(s.prev.to, '2026-09-23')
  // 金曜（10/23）の直近4回：10/16, 10/9, 10/2, 9/25
  const fridays = [28, 34, 21].concat([18 + 5]) // 10/16=28, 10/9=34, 10/2=21, 9/25=23
  assert.equal(s.weekdaySamples, 4)
  assert.equal(s.weekdayAvg, Math.round(fridays.reduce((t, n) => t + n, 0) / 4))
  assert.equal(s.newcomers, 10)
  assert.equal(s.prevNewcomers, 15)
})

test('先月が途中までしかないときは比べない', () => {
  const partial = makeMonth('2026-09', 10)
  const s = summarize([october, partial])
  assert.equal(s.prev, null)
  assert.equal(s.prevNewcomers, null)
})

test('曜日ごとの平均（月〜土・来院のあった日だけ）', () => {
  const w = weekdayAverages([october, september], '2026-10-23')
  assert.deepEqual(w.map((x) => x.label), ['月', '火', '水', '木', '金', '土'])
  assert.ok(w.every((x) => x.samples > 0))
  // 10/4・10/11・10/18（日曜）は入らない。10/17（土）は7人で入る
  const sat = w.find((x) => x.weekday === 6)
  assert.ok(sat.samples >= 3)
})

const open = (date, am, pm, closed = false) => ({ date, am, pm, closed })

test('空きの割合（平日16枠・土曜10枠）', () => {
  assert.equal(freeRatio(open('2026-10-26', 6, 10)), 1)
  assert.equal(freeRatio(open('2026-10-24', 3, 2)), 0.5)
  assert.equal(freeRatio(open('2026-10-25', 5, 5)), 0) // 日曜
  assert.equal(freeRatio(open('2026-10-27', 5, 5, true)), 0) // 臨時休診
})

test('下書きの日：今日のあと最初の診療日（2日先まで）で、空きが6割以上', () => {
  const days = [open('2026-10-23', 1, 1), open('2026-10-24', 4, 3), open('2026-10-25', 0, 0, true), open('2026-10-26', 6, 9)]
  assert.equal(pickDraftDay(days, '2026-10-23')?.date, '2026-10-24') // 土曜 7/10
  assert.equal(pickDraftDay([open('2026-10-24', 2, 2)], '2026-10-23'), null) // 4/10
  // 土曜の夜：翌日は日曜（休診）→ 月曜
  assert.equal(pickDraftDay(days, '2026-10-24')?.date, '2026-10-26')
  // 2日より先は見ない
  assert.equal(pickDraftDay([open('2026-10-27', 6, 10)], '2026-10-24'), null)
  assert.equal(nextOpenDay(days, '2026-10-24')?.date, '2026-10-26')
})

test('次の一手：離反（15日以降）・初回のペース・曜日の傾向', () => {
  const s = summarize([october, september])
  const tips = suggestions(s, { draftDay: null, draftMade: false, weekly: true, weekdays: weekdayAverages([october, september], s.date) })
  assert.ok(tips.some((t) => t.includes('25人が今月まだ来ていません')), tips.join('\n'))
  // 初回: 今月10人、先月15人×23/30≒12人 → 0.8倍(9.2)以上なので出ない
  assert.ok(!tips.some((t) => t.includes('初回の方が先月より少ない')))
  const fewer = { ...s, newcomers: 5 }
  assert.ok(suggestions(fewer, { draftDay: null, draftMade: false, weekly: false }).some((t) => t.includes('初回の方が先月より少ない')))
  // 月の前半は離反を言わない
  const early = { ...s, date: '2026-10-10' }
  assert.ok(!suggestions(early, { draftDay: null, draftMade: false, weekly: false }).some((t) => t.includes('まだ来ていません')))
  // 下書きを作れなかった空き日
  const d = open('2026-10-24', 4, 3)
  assert.ok(suggestions(s, { draftDay: d, draftMade: false, weekly: false })[0].includes('10/24（土）は空きが多め'))
  assert.ok(tips.length <= 3)
})

test('今日のまとめの文面', () => {
  const s = summarize([october, september])
  const text = nightlyText(s, { next: open('2026-10-24', 4, 3), draftDay: open('2026-10-24', 4, 3), draftMade: true, tips: ['テストの提案'] })
  assert.ok(text.startsWith('📊 10/23（金）の締め（NOAH）'))
  assert.ok(text.includes('来院 24人（保険9・自費14・交通事故1）'))
  assert.ok(text.includes('金額 32,760円（自費・商品 18,550円）'))
  assert.ok(text.includes('【今月 10/1〜23】'))
  assert.ok(text.includes('来院 480人・金額 927,035円'))
  assert.ok(text.includes('初回の方 10人（新患3・再初検7）'))
  assert.ok(text.includes('【10/24（土）の空き】午前4・午後3枠'))
  assert.ok(text.includes('下書きを作りました'))
  assert.ok(text.includes('・テストの提案'))
  assert.ok(text.length < 1800, `長さ ${text.length}`)
  console.log(`\n${text}\n`)
})

test('届いていない夜の文面', () => {
  const t = missingText('2026-10-23', '（詳細）')
  assert.ok(t.includes('10/23（金）のNOAHの集計がまだ届いていません'))
  assert.ok(t.includes('（詳細）'))
})

test('明日の空き状況の投稿文（定型文・誇張なし）', () => {
  const t = nextDayAvailabilityText(open('2026-10-24', 4, 3), '2026-10-23T22:00', '083-265-4545')
  assert.equal(t.title, '10/24（土）のご予約の空き状況')
  assert.ok(t.body.includes('午前・午後とも、比較的ご予約に空きがあります。'))
  assert.ok(t.body.includes('（10/23時点）'))
  assert.ok(t.body.includes('083-265-4545'))
  assert.equal(nextDayAvailabilityText(open('2026-10-24', 1, 1), '2026-10-23T22:00', 'x'), null)
  assert.ok(nextDayAvailabilityText(open('2026-10-24', 0, 5), '2026-10-23T22:00', 'x').body.includes('午後に、'))
})

console.log(`\n${passed}件 OK`)
