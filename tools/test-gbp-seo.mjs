// Google検索向けの投稿（決まった文・画像の写真・予定の決め方）の確認
// 実行: node tools/test-gbp-seo.mjs
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { register } from 'node:module'

const SRC = new URL('../src/', import.meta.url).href
register(
  'data:text/javascript,' +
    encodeURIComponent(
      `export async function resolve(s, c, next) { if (s.startsWith('@/')) s = ${JSON.stringify(SRC)} + s.slice(2); try { return await next(s, c) } catch (e) { if (!/\\.[a-z]+$/.test(s.split('?')[0])) return next(s + '.ts', c); throw e } }`,
    ),
)
const root = new URL('../', import.meta.url)
const data = await import(new URL('src/data/gbp-seo-posts.ts', root).href)
const seo = await import(new URL('src/lib/marketing/gbp-seo.ts', root).href)
const { findViolations } = await import(new URL('src/lib/marketing/compliance.ts', root).href)
const { GBP_SEO_POSTS, gbpSeoText, GBP_SEO_CHIPS } = data

let passed = 0
function test(name, fn) {
  fn()
  passed += 1
  console.log(`  ✓ ${name}`)
}

// 公開中のホームページのページ（https://shimonoseki-yuuki.com）
const SITE_PAGES = new Set(['/', '/about', '/access', '/first-visit', '/price', '/jiko', '/symptoms', '/sym-ankle', '/sym-acl', '/sym-meniscus', '/sym-osgood', '/sym-severs', '/sym-baseball', '/sym-strain', '/sym-shin', '/sym-groin', '/sym-gikkuri', '/sym-achilles', '/sym-hip', '/sym-plantar', '/sym-knee', '/sym-back', '/sym-wrist'])

test('id は重ならず、写真のファイルがあり、リンク先は公開中のページ', () => {
  const ids = GBP_SEO_POSTS.map((p) => p.id)
  assert.equal(new Set(ids).size, ids.length)
  assert.ok(GBP_SEO_POSTS.length >= 12, '投稿は12本以上')
  for (const p of GBP_SEO_POSTS) {
    assert.ok(fs.existsSync(new URL(`assets/gbp-photos/${p.photo}.jpg`, root)), `${p.id} の写真 ${p.photo}`)
    assert.ok(SITE_PAGES.has(p.sitePath), `${p.id} のリンク先 ${p.sitePath}`)
  }
})

test('表現チェック：NG も 注意 も無い（治る・No.1・必ず など）', () => {
  for (const p of GBP_SEO_POSTS) {
    const found = findViolations([gbpSeoText(p), p.title, p.subtitle].join('\n'))
    assert.deepEqual(found.map((f) => `${f.level}:${f.match}`), [], p.id)
    assert.ok(!/専門|最新|最先端|日本一|地域一|No\.?1|治ります|完治|保証/.test(gbpSeoText(p) + p.title + p.subtitle), `${p.id} に強すぎる言葉`)
  }
})

test('検索ワード：1行目は【下関市彦島…】、本文に院名・地域・強み、長さは Google の上限（1500字）より短い', () => {
  for (const p of GBP_SEO_POSTS) {
    const text = gbpSeoText(p)
    assert.match(text.split('\n')[0], /^【下関市彦島/, p.id)
    assert.ok(text.includes('ゆうき整骨院'), p.id)
    assert.ok(text.length <= 1000, `${p.id} は ${text.length} 字`)
    assert.ok(text.length >= 250, `${p.id} は短すぎる（${text.length} 字）`)
    assert.ok(p.title.length <= 22 && p.subtitle.length <= 30, `${p.id} の見出しが長い`)
    assert.ok(text.includes(`https://shimonoseki-yuuki.com${p.sitePath}`), p.id)
    // URL は本文に1回だけ
    assert.equal((text.match(/https?:\/\//g) ?? []).length, 1, p.id)
  }
})

test('院の情報（受付時間・駐車場・資格者の数）はホームページと同じ', () => {
  const footer = data.gbpSeoFooter('/')
  assert.match(footer, /柔道整復師3名（国家資格）/)
  assert.match(footer, /平日20時まで受付（土曜は15時まで・日祝休み）/)
  assert.match(footer, /駐車場あり（3〜4台）/)
  assert.match(footer, /急なケガは予約不要／リハビリは予約制/)
  assert.deepEqual(GBP_SEO_CHIPS, ['柔道整復師3名', 'エコーで状態を確認', '平日20時まで受付', '駐車場あり'])
})

test('予定：週1は月曜12時、週2は月曜12時と金曜18時', () => {
  assert.deepEqual(seo.seoSlotsForWeek('2026-11-16', 2), ['2026-11-16T12:00', '2026-11-20T18:00'])
  assert.deepEqual(seo.seoSlotsForWeek('2026-11-16', 1), ['2026-11-16T12:00'])
  assert.deepEqual(seo.seoSlotsForWeek('2026-11-16', 9), ['2026-11-16T12:00', '2026-11-20T18:00'])
})

test('順番：前回の続きから一覧の順にくり返す（一覧から消した id は飛ばす）', () => {
  const ids = GBP_SEO_POSTS.map((p) => p.id)
  assert.deepEqual(seo.pickSeoPosts([], 2).map((p) => p.id), ids.slice(0, 2))
  assert.deepEqual(seo.pickSeoPosts([ids[0], ids[1]], 2).map((p) => p.id), ids.slice(2, 4))
  assert.deepEqual(seo.pickSeoPosts([ids.at(-1)], 2).map((p) => p.id), [ids[0], ids[1]])
  assert.deepEqual(seo.pickSeoPosts([ids[3], 'deleted-post'], 1).map((p) => p.id), [ids[4]])
  assert.deepEqual(seo.pickSeoPosts([ids[0]], 0), [])
})

test('投稿の中身：予約ボタンは計測リンク（流入元 google_post・計測名）、画像は院の写真の型', () => {
  const p = GBP_SEO_POSTS[0]
  const c = seo.seoContent(p, seo.seoCampaign('2026-11-16', 2))
  assert.equal(c.cta.label, '予約')
  assert.match(c.cta.url, /^https:\/\/yuuki-rehab\.vercel\.app\/api\/marketing\/go\?d=reserve&source=google_post&campaign=seo20261116-2$/)
  assert.equal(c.seoPostId, p.id)
  assert.equal(c.body, gbpSeoText(p))
  assert.equal(seo.seoImageUrl(p.id), `https://yuuki-rehab.vercel.app/api/marketing/image?kind=gbp-seo&id=${p.id}`)
})

console.log(`\nGoogle検索向けの投稿：${passed} 件すべて通りました。`)

// ── 予約の動き（KV は一時フォルダのファイル） ──
{
  const os = await import('node:os')
  const path = await import('node:path')
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'yuuki-gbpseo-'))
  process.chdir(tmp)
  delete process.env.SUPABASE_URL
  delete process.env.SUPABASE_SERVICE_ROLE_KEY
  fs.mkdirSync(path.join(tmp, '.data'))
  fs.writeFileSync(path.join(tmp, '.data', 'marketing-kv.json'), '{}')
  const server = await import(new URL('src/lib/marketing/gbp-seo-server.ts', root).href)
  const jobs = await import(new URL('src/lib/marketing/jobs-store-server.ts', root).href)
  const kv = await import(new URL('src/lib/marketing/kv-store-server.ts', root).href)
  const ids = GBP_SEO_POSTS.map((p) => p.id)
  let n = 0
  async function atest(name, fn) {
    await fn()
    n += 1
    console.log(`  ✓ ${name}`)
  }
  // 2026-11-11（水）15:00 JST
  const wed = new Date('2026-11-11T06:00:00Z')
  await atest('水曜に動くと、今週は金曜の1本・来週は月と金の2本を予約。続きの順で選ぶ', async () => {
    const r = await server.scheduleSeoPosts(wed)
    assert.equal(r.scheduled, 3)
    assert.deepEqual(r.weeks, ['2026-11-09', '2026-11-16'])
    const list = (await jobs.listJobs()).filter((j) => j.idempotencyKey.startsWith('gbpseo:')).sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt))
    assert.deepEqual(list.map((j) => j.scheduledAt), ['2026-11-13T18:00', '2026-11-16T12:00', '2026-11-20T18:00'])
    assert.deepEqual(list.map((j) => j.content.seoPostId), ids.slice(0, 3))
    assert.ok(list.every((j) => j.channel === 'google_business' && j.status === 'pending'))
    assert.match(list[1].content.cta.url, /campaign=seo20261116-1$/)
  })
  await atest('同じ日にもう一度動いても、二重に予約しない', async () => {
    const r = await server.scheduleSeoPosts(new Date('2026-11-11T08:00:00Z'))
    assert.equal(r.scheduled, 0)
    assert.equal((await jobs.listJobs()).length, 3)
  })
  await atest('翌週の日曜に動くと、その次の週の2本を続きから予約', async () => {
    const r = await server.scheduleSeoPosts(new Date('2026-11-22T09:30:00Z'))
    assert.deepEqual(r.weeks, ['2026-11-23'])
    const next = (await jobs.listJobs()).filter((j) => j.idempotencyKey.startsWith('gbpseo:2026-11-23:')).sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt))
    assert.deepEqual(next.map((j) => j.content.seoPostId), ids.slice(3, 5))
  })
  await atest('設定でオフにすると、まだ出していない分を取り消し、オフの間は予約しない', async () => {
    const cancelled = await server.cancelPendingSeoPosts()
    assert.equal(cancelled, 5)
    assert.ok((await jobs.listJobs()).every((j) => j.status === 'cancelled'))
    await kv.kvSet('autopilot:settings', { googleSeo: false })
    const r = await server.scheduleSeoPosts(new Date('2026-11-24T03:00:00Z'))
    assert.equal(r.scheduled, 0)
    assert.match(r.skipped, /オフ/)
  })
  console.log(`\n予約の動き：${n} 件すべて通りました。`)
}
