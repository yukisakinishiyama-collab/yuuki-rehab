// 投稿づくりに渡す院情報（予約のルール・はじめての方へ）の確認
// 実行: node tools/marketing/test-clinic-prompt.mjs   （Node 22.18+ は .ts をそのまま読める）
import assert from 'node:assert/strict'
import {
  BOOKING_RULE,
  clinicProfileToPrompt,
  DEFAULT_CLINIC_PROFILE,
  FIRST_VISIT_URL,
} from '../../src/lib/marketing/clinic.ts'

let passed = 0
function check(name, fn) {
  fn()
  passed++
  console.log(`  ✓ ${name}`)
}

const text = clinicProfileToPrompt(DEFAULT_CLINIC_PROFILE)

check('予約のルールが入っている（急なケガは予約不要）', () => {
  assert.ok(text.includes(`予約のルール: ${BOOKING_RULE}`))
  assert.match(BOOKING_RULE, /急なケガ（急性外傷）は予約不要/)
  assert.match(BOOKING_RULE, /リハビリは完全予約制/)
})

check('はじめての方へのページが入っている', () => {
  assert.ok(text.includes(FIRST_VISIT_URL))
  assert.equal(FIRST_VISIT_URL, 'https://shimonoseki-yuuki.com/first-visit')
})

check('締めの案内で「完全予約制」だけ・電話だけにしないよう指示している', () => {
  assert.match(text, /締めの案内:.*「完全予約制」とだけ書かない/)
})

check('設定画面で院情報を書き換えても予約のルールは残る', () => {
  const edited = { ...DEFAULT_CLINIC_PROFILE, parking: '駐車場あり', hours: '月〜土' }
  const t = clinicProfileToPrompt(edited)
  assert.ok(t.includes(BOOKING_RULE))
  assert.ok(t.includes('駐車場あり'))
})

check('駐車場の台数がホームページと同じ', () => {
  assert.equal(DEFAULT_CLINIC_PROFILE.parking, '駐車場あり（院の前・3〜4台）')
})

console.log(`\n${passed} 件 OK`)
