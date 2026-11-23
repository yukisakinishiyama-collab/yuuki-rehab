// 空き状況のストーリーに入れる「急なケガ（急性外傷）は、この限りではありません」の確認（2026-11-23 院長の依頼）
// 実行: npx tsx tools/marketing/test-story-acute.mjs   （外には送らない・空きは架空。画像は手元で描くだけ）
//
// - 文に広告の表現でNGが無いこと
// - 毎日・週・キャンセルのストーリー、どの形でも枠が入ること
// - 中身が多い日でも、下の帯（Instagram の返信の欄などがかぶる下 250px）に文字がかからないこと
import assert from 'node:assert/strict'
import { PNG } from 'pngjs'
import { STORY_ACUTE_INJURY_LINES, renderStoryImage } from '../../src/lib/marketing/image-template.tsx'
import { storyRows } from '../../src/lib/marketing/autopilot-planner.ts'
import { findViolations } from '../../src/lib/marketing/compliance.ts'

let passed = 0
async function test(name, fn) {
  await fn()
  passed += 1
  console.log(`  ✓ ${name}`)
}

const day = (date, times, closed = false) => {
  const slots = closed ? [] : times.map((time, k) => ({ time, remaining: (k % 3) + 1, first: k % 2 === 0 }))
  return { date, closed, am: slots.filter((s) => s.time < '13:00').length, pm: slots.filter((s) => s.time >= '13:00').length, slots }
}
const FEW = ['10:00', '11:30', '15:00', '17:30', '19:00']
const MANY = [
  '09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '12:00', '12:30', '15:00', '15:30',
  '16:00', '16:30', '17:00', '17:30', '18:00', '18:30', '19:00', '19:30', '20:00', '20:30',
]
const WEEK = Array.from({ length: 6 }, (_, i) => day(`2026-11-${String(23 + i).padStart(2, '0')}`, FEW))
const today = (times) => storyRows([day('2026-11-23', times)], ['2026-11-23'])

const CASES = [
  ['本日の空き（時間が少ない日）', { title: '本日のご予約の空き', asOfLabel: '11/23 8:00 時点', scope: 'day', rows: today(FEW), cta: 'profile' }],
  ['本日の空き（時間が多い日）', { title: '本日のご予約の空き', asOfLabel: '11/23 8:00 時点', scope: 'day', rows: today(MANY), cta: 'profile' }],
  [
    'キャンセルのストーリー（時間が多い日＋ひとこと）',
    { title: 'キャンセルが出ました', asOfLabel: '11/23 8:00 時点', scope: 'day', rows: today(MANY), note: '本日 15:00 に空きが出ました', cta: 'profile' },
  ],
  ['この1週間（6日）', { title: 'この1週間のご予約の空き', asOfLabel: '11/23 8:00 時点', scope: 'week', rows: storyRows(WEEK, WEEK.map((d) => d.date)), cta: 'profile' }],
  [
    'この1週間（6日＋ひとこと・手で出す用）',
    {
      title: 'この1週間のご予約の空き',
      asOfLabel: '11/23 8:00 時点（前の晩の空き）',
      scope: 'week',
      rows: storyRows(WEEK, WEEK.map((d) => d.date)),
      note: '平日の夜も受け付けています。お気軽にどうぞ',
      cta: 'sticker',
    },
  ],
  [
    '午前・午後だけ（古い予約システム）',
    { title: '明日のご予約の空き', asOfLabel: '11/23 20:00 時点', scope: 'day', rows: storyRows([{ date: '2026-11-24', closed: false, am: 2, pm: 0 }], ['2026-11-24']), cta: 'profile' },
  ],
]

/** 画像の中で、文字・枠がある行か（となりの画素との明るさの差が大きいところがあるか。背景のグラデーションは差が小さい） */
function inkRows(png) {
  const { width, height, data } = png
  const light = (x, y) => {
    const i = (y * width + x) * 4
    return (data[i] * 299 + data[i + 1] * 587 + data[i + 2] * 114) / 1000
  }
  const rows = []
  for (let y = 0; y < height; y++) {
    let max = 0
    for (let x = 0; x < width - 2; x += 2) max = Math.max(max, Math.abs(light(x, y) - light(x + 1, y)))
    if (max > 40) rows.push(y)
  }
  return rows
}

/** 「急なケガ」の枠のふち（#fbbf24）が横に長く続く行があるか（時間の札・「少しあり」の札は短い） */
function hasWideAmberLine(png) {
  const { width, height, data } = png
  for (let y = 0; y < height; y++) {
    let run = 0
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4
      const amber = Math.abs(data[i] - 251) < 24 && Math.abs(data[i + 1] - 191) < 24 && Math.abs(data[i + 2] - 36) < 40
      run = amber ? run + 1 : 0
      if (run > 700) return true
    }
  }
  return false
}

await test('文：急性外傷は「この限りではありません」と、まずはお電話で。広告の表現でNGは無い', () => {
  assert.equal(STORY_ACUTE_INJURY_LINES.length, 2)
  assert.ok(STORY_ACUTE_INJURY_LINES[0].includes('急性外傷'))
  assert.ok(STORY_ACUTE_INJURY_LINES[0].includes('この限りではありません'))
  assert.ok(STORY_ACUTE_INJURY_LINES[1].includes('お電話'))
  const ng = findViolations(STORY_ACUTE_INJURY_LINES.join('\n')).filter((f) => f.level === 'NG')
  assert.deepEqual(ng, [])
  // 治る・効く などの約束はしない
  assert.doesNotMatch(STORY_ACUTE_INJURY_LINES.join(''), /治|効|必ず|すぐ良く/)
})

for (const [name, input] of CASES) {
  await test(`画像（${name}）：「急なケガ」の枠が入り、下 250px に文字がかからない`, async () => {
    const png = PNG.sync.read(await renderStoryImage(input))
    assert.equal(png.width, 1080)
    assert.equal(png.height, 1920)
    assert.ok(hasWideAmberLine(png), '「急なケガ」の枠が見つかりません')
    const ink = inkRows(png)
    const lowest = Math.max(...ink)
    assert.ok(lowest < 1920 - 250, `いちばん下の文字が ${lowest}px（下の帯 ${1920 - 250}px より下）`)
  })
}

console.log(`\n${passed} 件、すべて通りました`)
