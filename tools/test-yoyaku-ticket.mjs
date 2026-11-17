// 院内アプリの中の「予約」（予約管理画面）の、ログインの期限の見はりの確認
// 実行: npx tsx tools/test-yoyaku-ticket.mjs
import assert from 'node:assert/strict'
import {
  ADMIN_REFRESH_AFTER_MS,
  ADMIN_TICKET_TTL_MS,
  ADMIN_WARN_AFTER_MS,
  AWAY_LONG_ENOUGH_MS,
  adminFrameAge,
  adminFrameNotice,
  shouldAutoRefresh,
} from '../src/lib/yoyaku-ticket.ts'

let passed = 0
function test(name, fn) {
  fn()
  passed += 1
  console.log(`  ✓ ${name}`)
}

const H = 60 * 60 * 1000
const T0 = Date.parse('2030-01-10T00:00:00Z')

test('期限は予約システムと同じ12時間。読み直しは10時間、案内は11時間から', () => {
  assert.equal(ADMIN_TICKET_TTL_MS, 12 * H)
  assert.equal(ADMIN_REFRESH_AFTER_MS, 10 * H)
  assert.equal(ADMIN_WARN_AFTER_MS, 11 * H)
  assert.ok(ADMIN_REFRESH_AFTER_MS < ADMIN_WARN_AFTER_MS && ADMIN_WARN_AFTER_MS < ADMIN_TICKET_TTL_MS)
})

test('読みこんでからの時間で状態が変わる', () => {
  assert.equal(adminFrameAge(T0, T0), 'fresh')
  assert.equal(adminFrameAge(T0, T0 + 10 * H - 1), 'fresh')
  assert.equal(adminFrameAge(T0, T0 + 10 * H), 'stale')
  assert.equal(adminFrameAge(T0, T0 + 11 * H - 1), 'stale')
  assert.equal(adminFrameAge(T0, T0 + 11 * H), 'expiring')
  assert.equal(adminFrameAge(T0, T0 + 12 * H - 1), 'expiring')
  assert.equal(adminFrameAge(T0, T0 + 12 * H), 'expired')
  assert.equal(adminFrameAge(T0, T0 + 40 * H), 'expired')
})

test('署名なし（パスワードで入る画面）は、期限を数えない', () => {
  assert.equal(adminFrameAge(0, T0 + 100 * H), 'fresh')
})

test('新しいうちは読み直さない', () => {
  assert.equal(shouldAutoRefresh({ age: 'fresh', frameVisible: false, awayMs: 0 }), false)
  assert.equal(shouldAutoRefresh({ age: 'fresh', frameVisible: true, awayMs: 10 * H }), false)
})

test('古くなったら：見ていないときは、だまって読み直す', () => {
  for (const age of ['stale', 'expiring', 'expired']) {
    assert.equal(shouldAutoRefresh({ age, frameVisible: false, awayMs: 0 }), true, age)
  }
})

test('古くなっても：見ている最中は読み直さない（入力の途中で消さない）。5分以上離れて戻ったときは読み直す', () => {
  for (const age of ['stale', 'expiring', 'expired']) {
    assert.equal(shouldAutoRefresh({ age, frameVisible: true, awayMs: 0 }), false, age)
    assert.equal(shouldAutoRefresh({ age, frameVisible: true, awayMs: AWAY_LONG_ENOUGH_MS - 1 }), false, age)
    assert.equal(shouldAutoRefresh({ age, frameVisible: true, awayMs: AWAY_LONG_ENOUGH_MS }), true, age)
  }
})

test('案内：まもなく切れる・切れた、のときだけ出す', () => {
  assert.equal(adminFrameNotice('fresh'), '')
  assert.equal(adminFrameNotice('stale'), '')
  assert.match(adminFrameNotice('expiring'), /まもなく切れます/)
  assert.match(adminFrameNotice('expired'), /切れました/)
  assert.match(adminFrameNotice('expired'), /読み直す/)
})

console.log(`\n${passed} 件すべて通過`)
