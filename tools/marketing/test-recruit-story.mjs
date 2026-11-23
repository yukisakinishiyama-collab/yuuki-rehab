// 求人ストーリー（募集の動画を毎日決まった時刻にInstagramのストーリーへ）の決まりの確認
// 実行: npx tsx tools/marketing/test-recruit-story.mjs   （外には送らない・データは架空）
import assert from 'node:assert/strict'
import {
  RECRUIT_STORY_LATE_MINUTES,
  RECRUIT_STORY_MAX_PER_DAY,
  isRecruitFinished,
  isStaleRecruitStory,
  isUsableVideoUrl,
  normalizeRecruitTimes,
  parseRecruitStoryKey,
  planRecruitStories,
  recruitStoryBlockedReason,
  recruitStoryKey,
  shortRecruitTime,
} from '../../src/lib/marketing/recruit-story.ts'

let passed = 0
function test(name, fn) {
  fn()
  passed += 1
  console.log(`  ✓ ${name}`)
}

const VIDEO = 'https://example.public.blob.vercel-storage.com/marketing/recruit/story.mp4'
const ON = { recruitStory: true, recruitStoryTimes: ['09:00', '14:00', '19:00'], recruitStoryVideoUrl: VIDEO, recruitStoryUntil: '' }
const DAY = '2026-11-24'
const keysOf = (plans) => plans.map((p) => p.key)

console.log('求人ストーリーの決まり')

test('時刻をそろえる（0埋め・重複を捨てる・並べる・上限）', () => {
  assert.deepEqual(normalizeRecruitTimes(['9:00', '19:00', '14:00']), ['09:00', '14:00', '19:00'])
  assert.deepEqual(normalizeRecruitTimes(['9:00', '09:00']), ['09:00'])
  assert.deepEqual(normalizeRecruitTimes(['25:00', 'あさ', '', null]), [])
  assert.equal(normalizeRecruitTimes(['01:00', '02:00', '03:00', '04:00', '05:00']).length, RECRUIT_STORY_MAX_PER_DAY)
  assert.deepEqual(normalizeRecruitTimes('9:00'), [])
})

test('動画のアドレスは https のものだけ', () => {
  assert.equal(isUsableVideoUrl(VIDEO), true)
  assert.equal(isUsableVideoUrl('http://example.com/a.mp4'), false)
  assert.equal(isUsableVideoUrl(''), false)
  assert.equal(isUsableVideoUrl(undefined), false)
  assert.equal(isUsableVideoUrl('ただの文字'), false)
})

test('掲載の終わりの日', () => {
  assert.equal(isRecruitFinished('', DAY), false)
  assert.equal(isRecruitFinished('2026-11-30', DAY), false)
  assert.equal(isRecruitFinished('2026-11-24', DAY), false) // 当日はまだ出す
  assert.equal(isRecruitFinished('2026-11-23', DAY), true)
  assert.equal(isRecruitFinished('でたらめ', DAY), false)
})

test('印の作り・読み取り', () => {
  assert.equal(recruitStoryKey(DAY, '09:00'), 'recruit-story:2026-11-24T09:00')
  assert.deepEqual(parseRecruitStoryKey('recruit-story:2026-11-24T09:00'), { date: DAY, time: '09:00' })
  assert.equal(parseRecruitStoryKey('daily-openings:2026-11-24T08:00:instagram_story'), null)
  assert.equal(parseRecruitStoryKey('recruit-story:こわれた'), null)
})

test('予定を作らない理由', () => {
  assert.equal(recruitStoryBlockedReason(ON, DAY), null)
  assert.match(recruitStoryBlockedReason({ ...ON, recruitStory: false }, DAY), /オフ/)
  assert.match(recruitStoryBlockedReason({ ...ON, recruitStoryVideoUrl: '' }, DAY), /動画/)
  assert.match(recruitStoryBlockedReason({ ...ON, recruitStoryUntil: '2026-11-23' }, DAY), /終わりの日/)
  assert.match(recruitStoryBlockedReason({ ...ON, recruitStoryTimes: [] }, DAY), /時刻/)
})

test('朝いちばんに、その日の3つ分の予定を作る', () => {
  const plans = planRecruitStories(ON, `${DAY}T06:30`, new Set())
  assert.deepEqual(keysOf(plans), [
    'recruit-story:2026-11-24T09:00',
    'recruit-story:2026-11-24T14:00',
    'recruit-story:2026-11-24T19:00',
  ])
  assert.equal(plans[0].scheduledAt, `${DAY}T09:00`)
  assert.equal(plans[0].notAfter, `${DAY}T12:00`) // 3時間後
  assert.equal(plans[0].videoUrl, VIDEO)
})

test('オフ・動画なし・終わりの日を過ぎたときは作らない', () => {
  assert.deepEqual(planRecruitStories({ ...ON, recruitStory: false }, `${DAY}T06:30`, new Set()), [])
  assert.deepEqual(planRecruitStories({ ...ON, recruitStoryVideoUrl: '' }, `${DAY}T06:30`, new Set()), [])
  assert.deepEqual(planRecruitStories({ ...ON, recruitStoryUntil: '2026-11-23' }, `${DAY}T06:30`, new Set()), [])
})

test('すでにある印は作らない（二重に出さない）', () => {
  const existing = new Set(['recruit-story:2026-11-24T09:00'])
  const plans = planRecruitStories(ON, `${DAY}T06:30`, existing)
  assert.deepEqual(keysOf(plans), ['recruit-story:2026-11-24T14:00', 'recruit-story:2026-11-24T19:00'])
})

test('時刻を大きく過ぎた分は作らない（朝の分を夜に出さない）', () => {
  // 15:00 の時点では、9:00 の分（11:30 まで）は作らない。14:00 の分は1時間遅れなので作る
  const plans = planRecruitStories(ON, `${DAY}T15:00`, new Set())
  assert.deepEqual(keysOf(plans), ['recruit-story:2026-11-24T14:00', 'recruit-story:2026-11-24T19:00'])
  // 夜に初めて動いたときは、朝・昼の分はもう作らない
  const evening = planRecruitStories(ON, `${DAY}T18:00`, new Set())
  assert.deepEqual(keysOf(evening), ['recruit-story:2026-11-24T19:00'])
  // 少し遅れただけなら作る
  const late = planRecruitStories(ON, `${DAY}T11:00`, new Set())
  assert.ok(keysOf(late).includes('recruit-story:2026-11-24T09:00'))
  assert.equal(RECRUIT_STORY_LATE_MINUTES, 150)
})

test('日をまたぐ notAfter', () => {
  const plans = planRecruitStories({ ...ON, recruitStoryTimes: ['23:00'] }, `${DAY}T22:00`, new Set())
  assert.equal(plans[0].notAfter, '2026-11-25T02:00')
})

test('予定の時刻から3時間たったら出さない', () => {
  assert.equal(isStaleRecruitStory(`${DAY}T12:00`, `${DAY}T11:59`), false)
  assert.equal(isStaleRecruitStory(`${DAY}T12:00`, `${DAY}T12:01`), true)
  assert.equal(isStaleRecruitStory(undefined, `${DAY}T12:01`), false)
})

test('画面の見せ方', () => {
  assert.equal(shortRecruitTime('09:00'), '9:00')
  assert.equal(shortRecruitTime('14:00'), '14:00')
})

console.log(`\n${passed} 件すべて通りました`)
