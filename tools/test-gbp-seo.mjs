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

test('予定：週1は月曜12時、週2は月曜12時と金曜18時（年末年始は出さない）', () => {
  assert.deepEqual(seo.seoSlotsForWeek('2026-11-16', 2), ['2026-11-16T12:00', '2026-11-20T18:00'])
  assert.deepEqual(seo.seoSlotsForWeek('2026-11-16', 1), ['2026-11-16T12:00'])
  assert.deepEqual(seo.seoSlotsForWeek('2026-11-16', 9), ['2026-11-16T12:00', '2026-11-20T18:00'])
  // 年末年始（12/29〜1/3）は出さない
  assert.deepEqual(seo.seoSlotsForWeek('2026-12-28', 2), ['2026-12-28T12:00'])
  assert.deepEqual(seo.seoSlotsForWeek('2027-01-04', 2), ['2027-01-04T12:00', '2027-01-08T18:00'])
  assert.equal(seo.isYearEndBreak('2026-12-29'), true)
  assert.equal(seo.isYearEndBreak('2027-01-03'), true)
  assert.equal(seo.isYearEndBreak('2027-01-04'), false)
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

const perf = await import(new URL('src/lib/marketing/gbp-performance.ts', root).href)
const oauth = await import(new URL('src/lib/marketing/gbp-oauth-server.ts', root).href)

test('Googleの成果：期間（3日前まで28日・その前28日・先月と先々月）', () => {
  const r = perf.performanceRanges('2026-11-11')
  assert.deepEqual(r.current, { start: '2026-10-12', end: '2026-11-08' })
  assert.deepEqual(r.previous, { start: '2026-09-14', end: '2026-10-11' })
  assert.equal(r.lastMonth, '2026-10')
  assert.equal(r.monthBefore, '2026-09')
  const jan = perf.performanceRanges('2027-01-20')
  assert.equal(jan.lastMonth, '2026-12')
  assert.equal(jan.monthBefore, '2026-11')
})

test('Googleの成果：日ごとの数字を期間で合計（期間の外・値の無い日は数えない）', () => {
  const json = {
    multiDailyMetricTimeSeries: [
      {
        dailyMetricTimeSeries: [
          { dailyMetric: 'CALL_CLICKS', timeSeries: { datedValues: [{ date: { year: 2026, month: 10, day: 12 }, value: '2' }, { date: { year: 2026, month: 10, day: 11 }, value: '5' }, { date: { year: 2026, month: 11, day: 8 } }] } },
          { dailyMetric: 'BUSINESS_IMPRESSIONS_MOBILE_MAPS', timeSeries: { datedValues: [{ date: { year: 2026, month: 11, day: 1 }, value: '40' }] } },
          { dailyMetric: 'BUSINESS_IMPRESSIONS_MOBILE_SEARCH', timeSeries: { datedValues: [{ date: { year: 2026, month: 11, day: 1 }, value: '10' }] } },
        ],
      },
    ],
  }
  const t = perf.sumDaily(json, { start: '2026-10-12', end: '2026-11-08' })
  assert.equal(t.CALL_CLICKS, 2)
  assert.equal(perf.impressionsOf(t), 50)
  assert.equal(perf.sumDaily(json, { start: '2026-09-14', end: '2026-10-11' }).CALL_CLICKS, 5)
})

test('検索された言葉：多い順、少ない言葉は「15未満」、狙っている言葉に印', () => {
  const rows = perf.parseKeywords({
    searchKeywordsCounts: [
      { searchKeyword: '整骨院 下関', insightsValue: { value: '120' } },
      { searchKeyword: '下関 捻挫', insightsValue: { threshold: '15' } },
      { searchKeyword: 'ゆうき整骨院', insightsValue: { value: '300' } },
      { searchKeyword: 'オスグット 下関', insightsValue: { value: '20' } },
      { searchKeyword: '彦島 むち打ち', insightsValue: { threshold: '15' } },
    ],
  })
  assert.deepEqual(rows.map((r) => r.keyword), ['ゆうき整骨院', '整骨院 下関', 'オスグット 下関', '下関 捻挫', '彦島 むち打ち'])
  assert.equal(rows[0].target, null)
  assert.equal(rows[1].target, null)
  assert.equal(rows[2].target, '成長期の膝の痛み（オスグッド）')
  assert.equal(rows[3].value, null)
  assert.equal(rows[3].threshold, 15)
  assert.equal(rows[3].target, '足首の捻挫のリハビリ')
  assert.equal(rows[4].target, '交通事故のケガ・むち打ちの相談')
})

test('Googleとつなぐ：同じ名前の店舗が重複していても、投稿できる本物を選ぶ', () => {
  const dup = { name: 'accounts/1/locations/11', title: 'ゆうき整骨院', canPost: false, verified: false, duplicate: true }
  const real = { name: 'accounts/1/locations/22', title: 'ゆうき整骨院', canPost: true, verified: true, duplicate: false }
  assert.equal(oauth.pickClinicLocation([dup, real]).name, real.name)
  assert.equal(oauth.pickClinicLocation([real, dup]).name, real.name)
  assert.equal(oauth.pickClinicLocation([{ name: 'accounts/1/locations/3', title: '別の店' }, dup]).name, dup.name)
  assert.equal(oauth.pickClinicLocation([]), null)
})

const gsc = await import(new URL('src/lib/marketing/gsc.ts', root).href)

test('Googleとつなぐ：ビジネスプロフィールと Search Console の両方の許可を求める', () => {
  const url = new URL(oauth.gbpAuthorizeUrl('cid', 'https://yuuki-rehab.vercel.app/api/marketing/google/callback', 'st'))
  const scopes = (url.searchParams.get('scope') ?? '').split(' ')
  assert.ok(scopes.includes('https://www.googleapis.com/auth/business.manage'))
  assert.ok(scopes.includes('https://www.googleapis.com/auth/webmasters.readonly'))
  assert.equal(url.searchParams.get('access_type'), 'offline')
  assert.equal(url.searchParams.get('include_granted_scopes'), 'true')
})

test('Search Console：ドメイン→https の順で、確認済みのプロパティを選ぶ', () => {
  assert.equal(gsc.pickGscSite([{ siteUrl: 'https://shimonoseki-yuuki.com/', permissionLevel: 'siteOwner' }]), 'https://shimonoseki-yuuki.com/')
  assert.equal(
    gsc.pickGscSite([
      { siteUrl: 'https://shimonoseki-yuuki.com/', permissionLevel: 'siteOwner' },
      { siteUrl: 'sc-domain:shimonoseki-yuuki.com', permissionLevel: 'siteFullUser' },
    ]),
    'sc-domain:shimonoseki-yuuki.com',
  )
  assert.equal(gsc.pickGscSite([{ siteUrl: 'sc-domain:shimonoseki-yuuki.com', permissionLevel: 'siteUnverifiedUser' }]), null)
  assert.equal(gsc.pickGscSite([{ siteUrl: 'https://nimble-swan-1814a7.netlify.app/', permissionLevel: 'siteOwner' }]), null)
})

test('Search Console：期間・合計・キーワードに前の順位と狙いの印', () => {
  assert.deepEqual(gsc.gscRanges('2026-11-11').current, { start: '2026-10-12', end: '2026-11-08' })
  assert.deepEqual(gsc.gscTotals({ rows: [{ clicks: 30, impressions: 600, ctr: 0.05, position: 10.44 }] }), { clicks: 30, impressions: 600, ctr: 0.05, position: 10.4 })
  assert.deepEqual(gsc.gscTotals({}), { clicks: 0, impressions: 0, ctr: 0, position: 0 })
  const cur = gsc.parseGscRows({ rows: [{ keys: ['下関 整骨院'], clicks: 3, impressions: 111, ctr: 0.027, position: 8.26 }, { keys: ['下関 捻挫 リハビリ'], clicks: 0, impressions: 20, ctr: 0, position: 15.5 }, { keys: ['ゆうき整骨院'], clicks: 32, impressions: 188, ctr: 0.17, position: 1.2 }] })
  const prev = gsc.parseGscRows({ rows: [{ keys: ['下関 整骨院'], clicks: 2, impressions: 90, ctr: 0.02, position: 9.8 }] })
  const q = gsc.withPrevious(cur, prev)
  assert.deepEqual(q.map((x) => x.key), ['ゆうき整骨院', '下関 整骨院', '下関 捻挫 リハビリ'])
  assert.equal(q[1].position, 8.3)
  assert.equal(q[1].prevPosition, 9.8)
  assert.equal(q[2].prevPosition, null)
  assert.equal(q[2].target, '足首の捻挫のリハビリ')
  assert.equal(q[0].target, null)
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
  await atest('予定の記録（gbpseo:）は KV の予約プレフィックス（LINEの友だち一覧に混ざらない）', async () => {
    assert.ok(kv.KV_PREFIXES.includes('gbpseo:'))
    assert.ok(kv.KV_PREFIXES.includes('gbp:'))
  })
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
