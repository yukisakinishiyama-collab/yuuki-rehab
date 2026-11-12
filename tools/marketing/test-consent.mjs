// お知らせの受け取り（src/lib/marketing/consent.ts）と、問い合わせの数え方への影響の確認
// 実行: node tools/marketing/test-consent.mjs   （Node 22.18+ は .ts をそのまま読める）
import assert from 'node:assert/strict'
import {
  consentAllows,
  consentReply,
  inSendHours,
  jstHour,
  normalizeCommand,
  parseConsentCommand,
} from '../../src/lib/marketing/consent.ts'
import { isInquiry, lastUserText } from '../../src/lib/marketing/inquiry.ts'

let passed = 0
function test(name, fn) {
  fn()
  passed += 1
  console.log(`  ✓ ${name}`)
}

test('決まった言葉で止める・再開する', () => {
  assert.deepEqual(parseConsentCommand('配信停止'), { purpose: 'marketing', allow: false })
  assert.deepEqual(parseConsentCommand('配信再開'), { purpose: 'marketing', allow: true })
  assert.deepEqual(parseConsentCommand('予約のお知らせ停止'), { purpose: 'reservation', allow: false })
  assert.deepEqual(parseConsentCommand('予約のお知らせ再開'), { purpose: 'reservation', allow: true })
})

test('ていねいな言い方・空白・全角半角・かっこがあっても受け付ける', () => {
  assert.deepEqual(parseConsentCommand('  配信停止してください。'), { purpose: 'marketing', allow: false })
  assert.deepEqual(parseConsentCommand('「配信 停止」お願いします'), { purpose: 'marketing', allow: false })
  assert.deepEqual(parseConsentCommand('予約のお知らせを止めてください'), { purpose: 'reservation', allow: false })
  assert.deepEqual(parseConsentCommand('リマインド不要です'), { purpose: 'reservation', allow: false })
  assert.deepEqual(parseConsentCommand('キャンセル待ちの案内はいらない'), { purpose: 'reservation', allow: false })
  assert.equal(normalizeCommand('配信停止希望します！'), '配信停止')
})

test('「予約のお知らせ停止」を「お知らせ停止」と取り違えない', () => {
  assert.equal(parseConsentCommand('予約のお知らせ停止')?.purpose, 'reservation')
  assert.equal(parseConsentCommand('お知らせ停止')?.purpose, 'marketing')
})

test('ふつうの相談の文には反応しない', () => {
  for (const text of [
    '配信停止ってどうやるんですか？足首をひねりました',
    '明日の予約をキャンセルしたいです',
    'お知らせください',
    'お知らせほしい',
    '停止',
    '予約したい',
    '',
  ]) {
    assert.equal(parseConsentCommand(text), null, text)
  }
})

test('記録が無い方は受け取る。止めた目的だけ止まる', () => {
  assert.equal(consentAllows(null, 'reservation'), true)
  assert.equal(consentAllows(null, 'marketing'), true)
  const rec = { reservation: true, marketing: false, updatedAt: '2026-11-04T00:00:00Z', source: 'line' }
  assert.equal(consentAllows(rec, 'marketing'), false)
  assert.equal(consentAllows(rec, 'reservation'), true)
})

test('返事に、止まらないもの・戻し方を書く', () => {
  const off = consentReply({ purpose: 'marketing', allow: false })
  assert.match(off, /配信を止めました/)
  assert.match(off, /配信再開/)
  assert.match(off, /一斉|全員/)
  const roff = consentReply({ purpose: 'reservation', allow: false })
  assert.match(roff, /確定・キャンセルの控え/)
  assert.match(roff, /予約のお知らせ再開/)
})

test('送ってよい時間帯（日本時間 8時〜20時）', () => {
  // 2026-11-04 07:59 JST = 2026-11-03T22:59Z
  assert.equal(jstHour(new Date('2026-11-03T22:59:00Z')), 7)
  assert.equal(inSendHours(new Date('2026-11-03T22:59:00Z'), 8, 20), false)
  assert.equal(inSendHours(new Date('2026-11-03T23:00:00Z'), 8, 20), true) // 8:00
  assert.equal(inSendHours(new Date('2026-11-04T10:59:00Z'), 8, 20), true) // 19:59
  assert.equal(inSendHours(new Date('2026-11-04T11:00:00Z'), 8, 20), false) // 20:00
  assert.equal(inSendHours(new Date('2026-11-04T11:00:00Z')), true) // 指定なしはいつでも
})

test('「配信停止」の会話は問い合わせに数えない', () => {
  const base = { tags: [], step: 'idle', handoff: false, reserved: false }
  const consentOnly = {
    ...base,
    messages: [
      { at: '2026-11-04T00:00:00Z', from: 'user', text: '（友だち追加）' },
      { at: '2026-11-04T00:01:00Z', from: 'user', text: '配信停止', note: 'consent' },
      { at: '2026-11-04T00:01:00Z', from: 'bot', text: '止めました', note: 'consent' },
    ],
  }
  assert.equal(isInquiry(consentOnly), false)
  const withQuestion = {
    ...base,
    messages: [...consentOnly.messages, { at: '2026-11-04T00:02:00Z', from: 'user', text: '料金を知りたい' }],
  }
  assert.equal(isInquiry(withQuestion), true)
  assert.equal(lastUserText(withQuestion), '料金を知りたい')
})

console.log(`\nお知らせの受け取り: ${passed} 件 OK`)
