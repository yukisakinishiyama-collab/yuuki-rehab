// 前日のお知らせが届かない方（2026-11-20 院長「キャンセル率を下げる対策を」→「届かない方を一覧に」）
// 実行: npx tsx tools/test-reminder-reach.mjs
import assert from 'node:assert/strict'
import fs from 'node:fs'

const R = await import('../src/lib/reminder-reach.ts')
const read = (p) => fs.readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')

let passed = 0
function test(name, fn) {
  fn()
  passed += 1
  console.log(`  ✓ ${name}`)
}

test('届くか：LINE 連携・LINE予約は「動かす」のときだけ LINE で届く。テスト・止めるならメールがあればメール', () => {
  assert.equal(R.reachOf({}, true, 'on'), 'line')
  assert.equal(R.reachOf({ line: true }, false, 'on'), 'line')
  assert.equal(R.reachOf({}, true, 'test'), 'line_paused', 'テスト中は患者さんに送らない（LINE はある）')
  assert.equal(R.reachOf({ mail: true }, true, 'test'), 'mail')
  assert.equal(R.reachOf({ line: true, mail: true }, false, 'off'), 'mail')
  assert.equal(R.reachOf({ mail: true }, false, 'on'), 'mail')
  assert.equal(R.reachOf({}, false, 'on'), 'none')
})

test('お知らせ不要・送った・古い予約システム', () => {
  assert.equal(R.reachOf({ off: true, mail: true }, true, 'on'), 'off')
  assert.equal(R.reachOf({ sent: true }, false, 'on'), 'sent')
  assert.equal(R.reachOf(undefined, false, 'on'), 'unknown', 'メールの有無が分からない')
  assert.equal(R.reachOf(undefined, true, 'on'), 'line')
  assert.equal(R.reachOf(undefined, true, 'unknown'), 'line', '設定が読めないときは届く扱い（一覧をうるさくしない）')
  assert.ok(R.needsCall('none') && R.needsCall('unknown') && R.needsCall('line_paused') && !R.needsCall('off') && !R.needsCall('sent'))
})

const NOW = { date: '2026-11-20', time: '12:00', tomorrow: '2026-11-21' }
const row = (o) => ({ date: '2026-11-21', time: '10:00', name: '架空 太郎', phone: '090-1111-2222', status: '確定', reservationNo: `R${Math.random()}`, remind: {}, ...o })

test('一覧：明日の届かない予約・お知らせ不要・今日来られる方で手段が無い方・先の件数', () => {
  const rows = [
    row({ name: 'A', time: '10:00', remind: {} }),
    row({ name: 'B', time: '09:00', remind: { mail: true } }),
    row({ name: 'C', time: '11:00', remind: { off: true } }),
    row({ name: 'D', time: '12:00', remind: { sent: true } }),
    row({ name: 'E', time: '13:00', status: 'キャンセル', remind: {} }),
    row({ name: 'L', time: '14:00', remind: {} }),
    row({ name: 'T1', date: '2026-11-20', time: '15:00', remind: {} }),
    row({ name: 'T2', date: '2026-11-20', time: '10:00', remind: {} }),
    row({ name: 'T3', date: '2026-11-20', time: '16:00', remind: { mail: true } }),
    row({ name: 'F', date: '2026-11-25', remind: {} }),
    row({ name: 'G', date: '2026-11-26', remind: { line: true } }),
  ]
  const s = R.buildReachSummary(rows, (r) => r.name === 'L', 'on', NOW)
  assert.deepEqual(s.tomorrow.map((i) => i.name), ['A'], '連携の L・メールの B・送った D・キャンセルの E は出ない')
  assert.deepEqual(s.tomorrowOff.map((i) => i.name), ['C'])
  assert.equal(s.tomorrowTotal, 5, '明日の確定の予約（キャンセルは数えない）')
  assert.deepEqual(s.todayNoRoute.map((i) => i.name), ['T1'], '過ぎた時刻（T2）・メールのある方（T3）は出さない')
  assert.equal(s.laterNoRoute, 1)
  assert.equal(s.legacy, false)
  // テスト中は LINE 連携の L も届かない
  const t = R.buildReachSummary(rows, (r) => r.name === 'L', 'test', NOW)
  assert.deepEqual(t.tomorrow.map((i) => [i.name, i.reach]), [['A', 'none'], ['L', 'line_paused']])
  assert.equal(t.laterNoRoute, 2)
})

test('古い予約システム（remind が無い）では、LINE 連携の無い方を「分からない」で出す', () => {
  const s = R.buildReachSummary([row({ name: 'X', remind: undefined }), row({ name: 'Y', remind: undefined })], (r) => r.name === 'Y', 'on', NOW)
  assert.equal(s.legacy, true)
  assert.deepEqual(s.tomorrow.map((i) => [i.name, i.reach]), [['X', 'unknown']])
})

test('電話のリンク（数字だけ）', () => {
  assert.equal(R.telHref('090-1111-2222'), 'tel:09011112222')
  assert.equal(R.telHref('083(265)4545'), 'tel:0832654545')
  assert.equal(R.telHref('123'), '')
})

test('「今日」の画面に出る・前日のお知らせの設定を読む', () => {
  const dash = read('src/components/clinic/TodayDashboard.tsx')
  assert.ok(dash.includes('<ReminderReachPanel />'))
  const panel = read('src/components/clinic/ReminderReachPanel.tsx')
  assert.ok(panel.includes("fetch('/api/line-link/remind-mode'"))
  assert.ok(panel.includes('QRコードでLINEと結びつける'))
  const route = read('src/app/api/line-link/remind-mode/route.ts')
  assert.ok(route.includes("getRule('reservation_remind')"))
})

console.log(`\n${passed} 件 OK`)
