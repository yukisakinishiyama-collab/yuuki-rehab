// 今日の空き（毎日の決まった時刻に、Instagramのストーリー・Googleへ「本日のご予約の空き」）の決まりの確認
// 実行: npx tsx tools/marketing/test-daily-openings.mjs   （外には送らない・空きは架空）
import assert from 'node:assert/strict'
import {
  DAILY_OPENINGS_LATE_MINUTES,
  dailyOpeningsChannels,
  dailyOpeningsKey,
  dailyOpeningsText,
  googlePaused,
  hasFirstMarks,
  isStaleDailyPost,
  normalizeTimes,
  oldDailyGooglePosts,
  openSlotsOf,
  parseDailyOpeningsKey,
  planDailyOpenings,
} from '../../src/lib/marketing/daily-openings.ts'
import { googleButtonUrl, googleSummary } from '../../src/lib/marketing/gbp-post-rules.ts'
import { storyRows } from '../../src/lib/marketing/autopilot-planner.ts'

let passed = 0
function test(name, fn) {
  fn()
  passed += 1
  console.log(`  ✓ ${name}`)
}

const ON = { dailyOpenings: true, dailyOpeningsTimes: ['08:00', '13:00'], dailyOpeningsStory: true, dailyOpeningsGoogle: true }
const keysOf = (plans) => plans.map((p) => p.key)
const DAY = '2026-11-19' // 木曜

test('時刻をそろえる：8:00 → 08:00・読めないもの／同じものは捨てる・並べる・3つまで', () => {
  assert.deepEqual(normalizeTimes(['13:00', '8:00', '08:00', 'x', '25:00', '', null]), ['08:00', '13:00'])
  assert.deepEqual(normalizeTimes(['19:00', '7:30', '12:00', '15:00']), ['07:30', '12:00', '15:00'])
  assert.deepEqual(normalizeTimes(undefined), [])
})

test('出す先：設定でオンのものだけ', () => {
  assert.deepEqual(dailyOpeningsChannels(ON), ['instagram_story', 'google_business'])
  assert.deepEqual(dailyOpeningsChannels({ ...ON, dailyOpeningsGoogle: false }), ['instagram_story'])
  assert.deepEqual(dailyOpeningsChannels({ ...ON, dailyOpeningsStory: false, dailyOpeningsGoogle: false }), [])
})

test('印：日・時刻・媒体で1つ（読み戻せる）', () => {
  const key = dailyOpeningsKey(DAY, '08:00', 'google_business')
  assert.equal(key, 'daily-openings:2026-11-19T08:00:google_business')
  assert.deepEqual(parseDailyOpeningsKey(key), { date: DAY, time: '08:00', channel: 'google_business' })
  assert.equal(parseDailyOpeningsKey('cancel-story:2026-11-19T15:00'), null)
})

test('朝6時の定期実行：8時と13時の分を、ストーリーとGoogleで4つ作る', () => {
  const plans = planDailyOpenings(ON, `${DAY}T06:05`, new Set())
  assert.deepEqual(keysOf(plans), [
    'daily-openings:2026-11-19T08:00:instagram_story',
    'daily-openings:2026-11-19T08:00:google_business',
    'daily-openings:2026-11-19T13:00:instagram_story',
    'daily-openings:2026-11-19T13:00:google_business',
  ])
  assert.equal(plans[0].scheduledAt, `${DAY}T08:00`)
  assert.equal(plans[0].notAfter, `${DAY}T10:00`)
  assert.equal(plans[2].notAfter, `${DAY}T15:00`)
})

test('同じ印はもう作らない（出した・出さなかった・取り消したものも）', () => {
  const existing = new Set(keysOf(planDailyOpenings(ON, `${DAY}T06:05`, new Set())).slice(0, 3))
  assert.deepEqual(keysOf(planDailyOpenings(ON, `${DAY}T07:10`, existing)), ['daily-openings:2026-11-19T13:00:google_business'])
})

test(`定期実行が遅れても、予定から${DAILY_OPENINGS_LATE_MINUTES}分までなら作る。それより後の時刻の分は作らない`, () => {
  assert.equal(planDailyOpenings(ON, `${DAY}T09:30`, new Set()).length, 4)
  const late = planDailyOpenings(ON, `${DAY}T09:31`, new Set())
  assert.deepEqual([...new Set(late.map((p) => p.time))], ['13:00'])
  assert.equal(planDailyOpenings(ON, `${DAY}T14:31`, new Set()).length, 0)
})

test('作らないとき：オフ・休みの日・出す先が無い・止めている媒体', () => {
  assert.equal(planDailyOpenings({ ...ON, dailyOpenings: false }, `${DAY}T06:00`, new Set()).length, 0)
  assert.equal(planDailyOpenings(ON, `${DAY}T06:00`, new Set(), { todayClosed: true }).length, 0)
  assert.equal(planDailyOpenings({ ...ON, dailyOpeningsStory: false, dailyOpeningsGoogle: false }, `${DAY}T06:00`, new Set()).length, 0)
  const paused = planDailyOpenings(ON, `${DAY}T06:00`, new Set(), { pausedChannels: ['google_business'] })
  assert.ok(paused.length === 2 && paused.every((p) => p.channel === 'instagram_story'))
})

test('古くなったら出さない：予定から2時間を過ぎたら', () => {
  assert.equal(isStaleDailyPost(`${DAY}T10:00`, `${DAY}T10:00`), false)
  assert.equal(isStaleDailyPost(`${DAY}T10:00`, `${DAY}T10:01`), true)
  assert.equal(isStaleDailyPost(undefined, `${DAY}T23:00`), false)
})

const day = (slots, extra = {}) => ({ date: DAY, closed: false, am: 0, pm: 0, slots, ...extra })

test('空きの時間：残り0・読めないものは捨て、時刻順。初めての方の印は残す', () => {
  const slots = openSlotsOf(day([
    { time: '15:00', remaining: 2, first: true },
    { time: '9:30', remaining: 1, first: false },
    { time: '16:00', remaining: 0, first: true },
    { time: 'x', remaining: 3 },
  ]))
  assert.deepEqual(slots, [
    { time: '09:30', remaining: 1, first: false },
    { time: '15:00', remaining: 2, first: true },
  ])
  assert.equal(hasFirstMarks(slots), true)
  assert.equal(hasFirstMarks([{ time: '10:00', remaining: 1 }]), false)
  assert.deepEqual(openSlotsOf(day([{ time: '10:00', remaining: 2 }], { closed: true })), [])
  assert.deepEqual(openSlotsOf(undefined), [])
})

test('ストーリーの時間にも、初めての方の印を引き継ぐ（印が無い古い予約システムでは付けない）', () => {
  const rows = storyRows([day([{ time: '10:00', remaining: 2, first: true }, { time: '12:30', remaining: 1, first: false }, { time: '15:00', remaining: 1 }])], [DAY])
  assert.deepEqual(rows[0].slots, [
    { time: '10:00', remaining: 2, first: true },
    { time: '12:30', remaining: 1, first: false },
    { time: '15:00', remaining: 1 },
  ])
})

test('Googleの本文：午前・午後に分けて時刻を並べ、◎の説明・予約の案内。電話番号・URLは入れない', () => {
  const text = dailyOpeningsText(
    day([
      { time: '10:00', remaining: 2, first: true },
      { time: '12:30', remaining: 1, first: false },
      { time: '15:00', remaining: 1, first: true },
      { time: '19:30', remaining: 2, first: false },
    ]),
    `${DAY}T08:03`,
  )
  assert.equal(text.title, '本日 11/19（木）のご予約の空き')
  const lines = text.body.split('\n')
  assert.equal(lines[0], '【本日 11/19（木）のご予約の空き】（8:03時点）')
  assert.ok(lines.includes('午前　10:00◎　12:30'), lines)
  assert.ok(lines.includes('午後　15:00◎　19:30'), lines)
  assert.ok(text.body.includes('◎ … 初めての方（約60分）もご予約いただける時間です。'))
  // Google に出すときの決まり（gbp-post-rules）で、取るものが無いこと（本文がそのまま出る）
  const cleaned = googleSummary(text.body)
  assert.equal(cleaned.urls, 0)
  assert.equal(cleaned.phones, 0)
  assert.equal(cleaned.text, text.body)
})

test('Googleの本文：昼の分は午後だけ／初めての方がえらべる時間が無い日はそう書く／印が無い古い予約システム', () => {
  const pm = dailyOpeningsText(day([{ time: '15:30', remaining: 1, first: false }, { time: '19:30', remaining: 1, first: false }]), `${DAY}T13:10`)
  assert.ok(!pm.body.includes('午前'))
  assert.ok(pm.body.includes('午後　15:30　19:30'))
  assert.ok(pm.body.includes('初めての方は約60分のお時間をいただくため、本日はご予約いただける時間がありません。'))
  const old = dailyOpeningsText(day([{ time: '15:30', remaining: 1 }]), `${DAY}T13:10`)
  assert.ok(old.body.includes('午後　15:30') && !old.body.includes('◎'))
  assert.ok(old.body.includes('初めての方は約60分のお時間をいただきます。'))
})

test('Googleの本文：空きが無い・休み・その日が無いときは出さない（null）', () => {
  assert.equal(dailyOpeningsText(day([]), `${DAY}T08:00`), null)
  assert.equal(dailyOpeningsText(day([{ time: '10:00', remaining: 2 }], { closed: true }), `${DAY}T08:00`), null)
  assert.equal(dailyOpeningsText(undefined, `${DAY}T08:00`), null)
})

test('Googleの「予約」ボタン：院のホームページへ置きかわり、どの時刻の投稿から来たかが残る', () => {
  const url = googleButtonUrl({ ctaUrl: 'https://yuuki-rehab.vercel.app/yoyaku-net?source=google_post&campaign=openings-20261119-0800' })
  const u = new URL(url)
  assert.equal(u.hostname, 'shimonoseki-yuuki.com')
  assert.equal(u.searchParams.get('utm_source'), 'google_post')
  assert.equal(u.searchParams.get('utm_campaign'), 'openings-20261119-0800')
})

const job = (id, key, google, createdAt = '2026-11-19T00:00:00.000Z') => ({ id, idempotencyKey: key, google, createdAt })

test('Googleは最新の1本だけ残す：前に出した「今日の空き」（名前があり、まだ消していないもの）を消す', () => {
  const jobs = [
    job('a', 'daily-openings:2026-11-18T13:00:google_business', { name: 'accounts/1/locations/2/localPosts/a' }),
    job('b', 'daily-openings:2026-11-19T08:00:google_business', { name: 'accounts/1/locations/2/localPosts/b' }),
    job('c', 'daily-openings:2026-11-18T08:00:google_business', { name: 'accounts/1/locations/2/localPosts/c', deletedAt: '2026-11-18T05:00:00Z' }),
    job('d', 'daily-openings:2026-11-18T08:00:instagram_story', undefined),
    job('e', 'gbpseo:2026-11-16:1', { name: 'accounts/1/locations/2/localPosts/e' }),
    job('f', 'daily-openings:2026-11-17T08:00:google_business', {}),
  ]
  assert.deepEqual(oldDailyGooglePosts(jobs, 'b').map((j) => j.id), ['a'])
})

test('Googleの審査で拒否が続いたら止める（3日で2回）。ほかの投稿の拒否・古い拒否は数えない', () => {
  const now = '2026-11-19T00:00:00.000Z'
  const rejected = (id, createdAt) => job(id, `daily-openings:${id}:google_business`, { state: 'rejected' }, createdAt)
  assert.equal(googlePaused([rejected('x', '2026-11-18T00:00:00.000Z')], now), false)
  assert.equal(googlePaused([rejected('x', '2026-11-18T00:00:00.000Z'), rejected('y', '2026-11-17T00:00:00.000Z')], now), true)
  assert.equal(googlePaused([rejected('x', '2026-11-18T00:00:00.000Z'), rejected('y', '2026-11-10T00:00:00.000Z')], now), false)
  assert.equal(googlePaused([rejected('x', '2026-11-18T00:00:00.000Z'), job('z', 'gbpseo:1', { state: 'rejected' }, '2026-11-18T00:00:00.000Z')], now), false)
})

console.log(`\n${passed} 件成功`)
