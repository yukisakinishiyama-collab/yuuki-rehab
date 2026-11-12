// ホームページに出す Instagram の最新投稿（選び方）の確認
// 実行: node tools/marketing/test-instagram-feed.mjs   （Node 22.18+ は .ts をそのまま読める）
import assert from 'node:assert/strict'
import {
  isAllowedImageHost,
  isExcluded,
  isLearning,
  jstDate,
  pickImageUrl,
  summarizeCaption,
  toFeedItems,
} from '../../src/lib/marketing/instagram-feed.ts'

let passed = 0
function test(name, fn) {
  fn()
  passed += 1
  console.log(`  ✓ ${name}`)
}

const base = 'https://yuuki-rehab.vercel.app/api/public/instagram-feed/image'
const m = (id, caption, ts, extra = {}) => ({
  id,
  caption,
  timestamp: ts,
  media_type: 'VIDEO',
  media_product_type: 'REELS',
  thumbnail_url: 'https://scontent-nrt1-1.cdninstagram.com/v/t51/thumb.jpg?x=1',
  permalink: `https://www.instagram.com/reel/${id}/`,
  ...extra,
})

const media = [
  m('1000000001', '足首の捻挫のセルフケア\n#セルフケア', '2026-11-01T10:00:00+0000'),
  m('1000000002', '【勉強会】膝のACL術後リハの最新知見を学んできました\n#勉強会 #下関', '2026-11-05T12:00:00+0000'),
  m('1000000003', '患者様の声をご紹介します。痛みが改善したとのご感想をいただきました', '2026-11-07T09:00:00+0000'),
  m('1000000004', '股関節のセミナーを受講しました @someone https://example.com', '2026-10-20T15:30:00+0000'),
  m('1000000005', 'ストーリー', '2026-11-08T00:00:00+0000', { media_product_type: 'STORY' }),
  m('1000000006', '画像の投稿 研修の様子', '2026-10-01T00:00:00+0000', { media_type: 'IMAGE', media_product_type: 'FEED', media_url: 'https://scontent.cdninstagram.com/a.jpg' }),
  m('bad-id', '勉強会', '2026-11-08T00:00:00+0000'),
  m('1000000007', '勉強会', '2026-11-08T00:00:00+0000', { permalink: 'https://evil.example.com/x' }),
]

test('勉強会・セミナー・研修の投稿だけを新しい順に選ぶ', () => {
  const { items, matched } = toFeedItems(media, { mode: 'learning', limit: 3, imageBase: base })
  assert.equal(matched, true)
  assert.deepEqual(items.map((i) => i.id), ['1000000002', '1000000004', '1000000006'])
})

test('患者さんの感想・口コミの投稿は出さない', () => {
  const { items } = toFeedItems(media, { mode: 'latest', limit: 6, imageBase: base })
  assert.ok(!items.some((i) => i.id === '1000000003'))
  assert.equal(isExcluded('患者様の声をご紹介'), true)
  assert.equal(isExcluded('口コミありがとうございます'), true)
})

test('ストーリー・IDやリンク先がおかしい投稿は出さない', () => {
  const { items } = toFeedItems(media, { mode: 'latest', limit: 6, imageBase: base })
  const ids = items.map((i) => i.id)
  for (const bad of ['1000000005', 'bad-id', '1000000007']) assert.ok(!ids.includes(bad), bad)
})

test('最新順（latest）は学びに限らず新しい順', () => {
  const { items, matched } = toFeedItems(media, { mode: 'latest', limit: 2, imageBase: base })
  assert.equal(matched, true)
  assert.deepEqual(items.map((i) => i.id), ['1000000002', '1000000001'])
})

test('学びの投稿が無いときは最新を返し matched=false', () => {
  const plain = [m('1000000011', 'セルフケア', '2026-11-01T00:00:00+0000'), m('1000000012', 'テーピング', '2026-11-02T00:00:00+0000')]
  const { items, matched } = toFeedItems(plain, { mode: 'learning', limit: 3, imageBase: base })
  assert.equal(matched, false)
  assert.deepEqual(items.map((i) => i.id), ['1000000012', '1000000011'])
})

test('件数は1〜6に収める', () => {
  assert.equal(toFeedItems(media, { mode: 'latest', limit: 99, imageBase: base }).items.length, 4)
  assert.equal(toFeedItems(media, { mode: 'latest', limit: 0, imageBase: base }).items.length, 3)
})

test('画像は院内アプリの中継URL・リールの印・日本時間の日付', () => {
  const [first] = toFeedItems(media, { mode: 'learning', limit: 1, imageBase: `${base}/` }).items
  assert.equal(first.image, `${base}/1000000002`)
  assert.equal(first.reel, true)
  assert.equal(first.date, '2026-11-05')
  assert.equal(jstDate('2026-10-20T15:30:00+0000'), '2026-10-21')
  assert.equal(jstDate('nope'), '')
})

test('キャプションは1行目からタグ・メンション・URLを除いて短く', () => {
  assert.equal(summarizeCaption('【勉強会】膝のACL術後リハの最新知見を学んできました\n#勉強会'), '勉強会 膝のACL術後リハの最新知見を学んできました')
  assert.equal(summarizeCaption('股関節のセミナーを受講しました @someone https://example.com'), '股関節のセミナーを受講しました')
  assert.equal(summarizeCaption('#タグだけ\n2行目が本文です'), '2行目が本文です')
  assert.equal(Array.from(summarizeCaption('あ'.repeat(80))).length, 48)
  assert.ok(summarizeCaption('あ'.repeat(80)).endsWith('…'))
})

test('学びの判定', () => {
  assert.equal(isLearning('学会で発表を聞いてきました'), true)
  assert.equal(isLearning('今日のテーピング'), false)
})

test('画像の中継は Instagram の配信元だけ', () => {
  assert.equal(isAllowedImageHost('https://scontent-nrt1-1.cdninstagram.com/v/a.jpg'), true)
  assert.equal(isAllowedImageHost('https://scontent.xx.fbcdn.net/v/a.jpg'), true)
  assert.equal(isAllowedImageHost('http://scontent.cdninstagram.com/a.jpg'), false)
  assert.equal(isAllowedImageHost('https://cdninstagram.com.evil.example/a.jpg'), false)
  assert.equal(isAllowedImageHost('https://169.254.169.254/latest'), false)
  assert.equal(pickImageUrl({ media_type: 'VIDEO', thumbnail_url: 'https://scontent.cdninstagram.com/t.jpg', media_url: 'https://scontent.cdninstagram.com/v.mp4' }), 'https://scontent.cdninstagram.com/t.jpg')
  assert.equal(pickImageUrl({ media_type: 'IMAGE', media_url: 'https://evil.example/a.jpg' }), null)
})

console.log(`\n${passed} 件 OK`)
