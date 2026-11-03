// 問い合わせの数え方・対応状況の決め方（src/lib/marketing/inquiry.ts）の確認
// 実行: node tools/marketing/test-inquiry.mjs   （Node 22.18+ は .ts をそのまま読める）
import assert from 'node:assert/strict'
import { inquiredOn, inquiryStatusOf, isInquiry, jstDayOf, lastUserText } from '../../src/lib/marketing/inquiry.ts'

let passed = 0
function test(name, fn) {
  fn()
  passed += 1
  console.log(`  ✓ ${name}`)
}

const base = { messages: [], tags: [], step: 'idle', handoff: false, reserved: false }
const follow = { at: '2026-11-03T23:00:00.000Z', from: 'user', text: '（友だち追加）' }
const menu = { at: '2026-11-03T23:00:01.000Z', from: 'bot', text: '友だち追加ありがとうございます' }

test('友だち追加だけの方は問い合わせに数えない', () => {
  assert.equal(isInquiry({ ...base, messages: [follow, menu] }), false)
})

test('何か選んだ・送った方は問い合わせ', () => {
  assert.equal(isInquiry({ ...base, intent: 'injury', messages: [follow] }), true)
  assert.equal(isInquiry({ ...base, messages: [follow, { at: follow.at, from: 'user', text: '足首をひねりました' }] }), true)
})

test('スタッフが決めた状態をいちばん優先する', () => {
  assert.equal(inquiryStatusOf({ ...base, needsAttention: 'x', inquiryStatus: 'done' }), 'done')
})

test('決めていないときは印から決める（予約済み → 要対応 → 案内の途中 → 未対応）', () => {
  assert.equal(inquiryStatusOf({ ...base, reserved: true, needsAttention: 'x' }), 'reserved')
  assert.equal(inquiryStatusOf({ ...base, tags: ['予約済み'] }), 'reserved')
  assert.equal(inquiryStatusOf({ ...base, handoff: true }), 'new')
  assert.equal(inquiryStatusOf({ ...base, step: 'guide' }), 'in_progress')
  assert.equal(inquiryStatusOf({ ...base, step: 'ask_part' }), 'in_progress')
  assert.equal(inquiryStatusOf({ ...base }), 'new')
})

test('今日の問い合わせは日本時間の日付で数える（友だち追加の文は入れない）', () => {
  // 2026-11-03T23:30Z は日本時間 11月4日 8:30
  const m = { at: '2026-11-03T23:30:00.000Z', from: 'user', text: '予約したいです' }
  assert.equal(jstDayOf(m.at), '2026-11-04')
  assert.equal(inquiredOn({ messages: [follow, m] }, '2026-11-04'), true)
  assert.equal(inquiredOn({ messages: [follow, m] }, '2026-11-03'), false)
  assert.equal(inquiredOn({ messages: [follow] }, '2026-11-04'), false)
})

test('一覧に出す文は最後に本人が送ったもの・長いものは切る', () => {
  const long = 'あ'.repeat(80)
  assert.equal(lastUserText({ messages: [follow, { at: follow.at, from: 'user', text: long }, menu] }).length, 61)
  assert.equal(lastUserText({ messages: [follow, menu] }), '')
})

console.log(`\n${passed} 件 OK`)
