// 自動投稿の設定が、保存のときに捨てられていないかの確認
// 2026-11-23：求人ストーリーの項目をスキーマに足し忘れ、画面で保存しても設定が元に戻る不具合があった。
// 実行: npx tsx tools/marketing/test-autopilot-settings-schema.mjs   （外には送らない・データは架空）
import assert from 'node:assert/strict'
import { SettingsSchema } from '../../src/lib/marketing/autopilot-settings-schema.ts'
import { DEFAULT_AUTOPILOT_SETTINGS } from '../../src/lib/marketing/autopilot-types.ts'

let passed = 0
function test(name, fn) {
  fn()
  passed += 1
  console.log(`  ✓ ${name}`)
}

console.log('自動投稿の設定の受け取り方')

test('設定の項目がひとつも捨てられない（足し忘れるとここで落ちる）', () => {
  const parsed = SettingsSchema.parse(DEFAULT_AUTOPILOT_SETTINGS)
  const missing = Object.keys(DEFAULT_AUTOPILOT_SETTINGS).filter(
    (k) => k !== 'updatedAt' && k !== 'clinicProfile' && !(k in parsed),
  )
  assert.deepEqual(
    missing,
    [],
    `スキーマ（src/lib/marketing/autopilot-settings-schema.ts）に足りない項目: ${missing.join(', ')}`,
  )
})

test('求人ストーリーの項目がそのまま通る', () => {
  const input = {
    ...DEFAULT_AUTOPILOT_SETTINGS,
    recruitStory: true,
    recruitStoryTimes: ['09:00', '14:00', '19:00'],
    recruitStoryVideoUrl: 'https://example.public.blob.vercel-storage.com/marketing/recruit/story.mp4',
    recruitStoryUntil: '2026-12-31',
  }
  const parsed = SettingsSchema.parse(input)
  assert.equal(parsed.recruitStory, true)
  assert.deepEqual(parsed.recruitStoryTimes, ['09:00', '14:00', '19:00'])
  assert.equal(parsed.recruitStoryVideoUrl, input.recruitStoryVideoUrl)
  assert.equal(parsed.recruitStoryUntil, '2026-12-31')
})

test('掲載の終わりの日は、空か YYYY-MM-DD だけ', () => {
  assert.equal(SettingsSchema.parse({ ...DEFAULT_AUTOPILOT_SETTINGS, recruitStoryUntil: '' }).recruitStoryUntil, '')
  assert.throws(() => SettingsSchema.parse({ ...DEFAULT_AUTOPILOT_SETTINGS, recruitStoryUntil: '2026/12/31' }))
})

test('出す時刻は4つまで・時刻の形だけ', () => {
  assert.throws(() => SettingsSchema.parse({ ...DEFAULT_AUTOPILOT_SETTINGS, recruitStoryTimes: ['9:00'] }))
  assert.throws(() =>
    SettingsSchema.parse({
      ...DEFAULT_AUTOPILOT_SETTINGS,
      recruitStoryTimes: ['01:00', '02:00', '03:00', '04:00', '05:00'],
    }),
  )
})

console.log(`\n${passed} 件すべて通りました`)
