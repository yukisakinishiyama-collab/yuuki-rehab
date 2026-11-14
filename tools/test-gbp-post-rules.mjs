// Googleの投稿が拒否されないための決まり（ボタンのリンク・本文）と、出したあとの審査の結果の確認
// 実行: npx tsx tools/test-gbp-post-rules.mjs
// 外には送らない（fetch を差しかえて、Google・LINE の返事をまねる）。KV は一時フォルダのファイル。電話番号などは架空
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { register } from 'node:module'

const SRC = new URL('../src/', import.meta.url).href
register(
  'data:text/javascript,' +
    encodeURIComponent(
      `export async function resolve(s, c, next) { if (s.startsWith('@/')) s = ${JSON.stringify(SRC)} + s.slice(2); try { return await next(s, c) } catch (e) { if (!/\\.[a-z]+$/.test(s.split('?')[0])) return next(s + '.ts', c); throw e } }`,
    ),
)
const root = new URL('../', import.meta.url)
const imp = (p) => import(new URL(p, root).href)
const rules = await imp('src/lib/marketing/gbp-post-rules.ts')
const data = await imp('src/data/gbp-seo-posts.ts')
const seo = await imp('src/lib/marketing/gbp-seo.ts')
const planner = await imp('src/lib/marketing/autopilot-planner.ts')
const hp = await imp('src/lib/marketing/hp-measure.ts')
const { GBP_SEO_POSTS, gbpSeoText } = data

let passed = 0
async function test(name, fn) {
  await fn()
  passed += 1
  console.log(`  ✓ ${name}`)
}

const GAS = 'https://script.google.com/macros/s/AKfycbTESTONLY/exec'
const GO = 'https://yuuki-rehab.vercel.app/api/marketing/go?d=reserve&source=google_post&campaign=seo20261109-1'

await test('ボタンのリンク：入れてよいのは院のホームページと公式LINEだけ', () => {
  assert.equal(rules.isSafeGoogleButtonUrl('https://shimonoseki-yuuki.com/sym-ankle?utm_source=google_post'), true)
  assert.equal(rules.isSafeGoogleButtonUrl('https://www.shimonoseki-yuuki.com/'), true)
  assert.equal(rules.isSafeGoogleButtonUrl('https://lin.ee/abcdefg'), true)
  // 予約システムのアドレス（これをボタンに入れた投稿が、7本続けて拒否された）
  assert.equal(rules.isSafeGoogleButtonUrl(`${GAS}?source=google_post&campaign=gbp-20261106`), false)
  // 院内アプリの転送リンク（開くと予約システムへ進む）
  assert.equal(rules.isSafeGoogleButtonUrl(GO), false)
  assert.equal(rules.isSafeGoogleButtonUrl('https://yuuki-rehab.vercel.app/yoyaku-net'), false)
  assert.equal(rules.isSafeGoogleButtonUrl('http://shimonoseki-yuuki.com/'), false)
  assert.equal(rules.isSafeGoogleButtonUrl('https://shimonoseki-yuuki.com.example.org/'), false)
  assert.equal(rules.isSafeGoogleButtonUrl(''), false)
  assert.equal(rules.isSafeGoogleButtonUrl(undefined), false)
  assert.equal(rules.isSafeGoogleButtonUrl('ここを押す'), false)
})

await test('計測名：もとのリンクの campaign、無ければジョブの印から。おかしな値は使わない', () => {
  assert.equal(rules.googleCampaign(GO), 'seo20261109-1')
  assert.equal(rules.googleCampaign(`${GAS}?source=google_post&campaign=gbp-20261106`), 'gbp-20261106')
  assert.equal(rules.googleCampaign(GAS, 'gbpseo:2026-11-16:2'), 'seo20261116-2')
  assert.equal(rules.googleCampaign(undefined, 'gbpseo:2026-11-16:2'), 'seo20261116-2')
  assert.equal(rules.googleCampaign(GAS, 'autopilot:2026-10-26:1:google_business'), 'gbp')
  assert.equal(rules.googleCampaign(`${GAS}?campaign=${encodeURIComponent('<script>')}`), 'gbp')
})

await test('ボタンのリンク：予約システム・転送リンクは、院のホームページのページに置きかえる', () => {
  // いま予約されている Google検索向けの投稿（11/13 18時の分）と同じ形
  assert.equal(
    rules.googleButtonUrl({ ctaUrl: GO, seoPostId: 'ankle-sprain', jobKey: 'gbpseo:2026-11-09:1' }),
    'https://shimonoseki-yuuki.com/sym-ankle?utm_source=google_post&utm_campaign=seo20261109-1',
  )
  // 10/30 に拒否された投稿と同じ形（予約システムのアドレスそのまま）
  assert.equal(rules.googleButtonUrl({ ctaUrl: GAS }), 'https://shimonoseki-yuuki.com/first-visit?utm_source=google_post&utm_campaign=gbp')
  // トップページの投稿
  assert.equal(rules.siteButtonUrl('/', 'seo20261207-1'), 'https://shimonoseki-yuuki.com/?utm_source=google_post&utm_campaign=seo20261207-1')
  // 入れてよいリンクはそのまま
  assert.equal(rules.googleButtonUrl({ ctaUrl: 'https://lin.ee/abcdefg' }), 'https://lin.ee/abcdefg')
  const own = 'https://shimonoseki-yuuki.com/jiko?utm_source=google_post&utm_campaign=seo20261207-2'
  assert.equal(rules.googleButtonUrl({ ctaUrl: own, seoPostId: 'ankle-sprain' }), own)
  // リンクの無い投稿は、ボタン無しのまま
  assert.equal(rules.googleButtonUrl({}), undefined)
  assert.equal(rules.googleButtonUrl({ ctaUrl: 'tel:0830000000' }), undefined)
  // 置きかえたあとのリンクは、どれも入れてよい場所
  for (const p of GBP_SEO_POSTS) assert.equal(rules.isSafeGoogleButtonUrl(rules.googleButtonUrl({ ctaUrl: GO, seoPostId: p.id })), true, p.id)
})

await test('Google検索向けの投稿：予約ボタンは院のホームページのそのページ。本文に URL・電話番号が無い', () => {
  for (const p of GBP_SEO_POSTS) {
    const c = seo.seoContent(p, 'seo20261116-1')
    assert.equal(c.cta.label, '予約')
    assert.equal(c.cta.url, `https://shimonoseki-yuuki.com${p.sitePath}?utm_source=google_post&utm_campaign=seo20261116-1`, p.id)
    assert.equal(rules.isSafeGoogleButtonUrl(c.cta.url), true, p.id)
    const cleaned = rules.googleSummary(c.body)
    assert.equal(cleaned.urls, 0, `${p.id} の本文に URL`)
    assert.equal(cleaned.phones, 0, `${p.id} の本文に電話番号`)
    assert.equal(cleaned.text, c.body, `${p.id} の本文が変わった`)
    assert.ok(!/https?:|www\.|\.com|\.jp/.test(c.body), p.id)
    assert.match(c.body, /ご予約・くわしい内容は、下の「予約」ボタンから（ホームページが開きます）。$/, p.id)
  }
  // YouTube の説明に使う院の情報には、これまでどおりページのURLが入る
  assert.match(data.gbpSeoFooter('/sym-ankle'), /くわしくは：https:\/\/shimonoseki-yuuki\.com\/sym-ankle$/)
})

await test('本文：「くわしくは：URL」の行は行ごと消す（前に予約した投稿の古い文）', () => {
  const old = `${GBP_SEO_POSTS[0].body.trim()}\n\n${data.gbpSeoFooter('/sym-ankle')}`
  const r = rules.googleSummary(old)
  assert.equal(r.urls, 1)
  assert.equal(r.phones, 0)
  assert.ok(!r.text.includes('http') && !r.text.includes('くわしくは'), r.text)
  assert.ok(r.text.endsWith('・急なケガは予約不要／リハビリは予約制'), r.text.slice(-40))
  assert.ok(r.text.startsWith('【下関市彦島｜足首の捻挫のリハビリ】'))
  // ほかの行は1文字も変えない
  assert.equal(r.text, old.split('\n').slice(0, -1).join('\n'))
  const more = rules.googleSummary('本文です。\n\nくわしくはこちら：https://shimonoseki-yuuki.com/price\nネット予約（24時間）：https://example.com/x?a=1\nおわり')
  assert.equal(more.text, '本文です。\n\nおわり')
  assert.equal(more.urls, 2)
  // 文の途中の URL は、URL だけを取る
  assert.equal(rules.googleSummary('ホームページ（https://shimonoseki-yuuki.com/）もご覧ください。').text, 'ホームページもご覧ください。')
})

await test('本文：電話番号を取る（拒否された投稿と同じ書き方）。住所・受付時間・日付・料金は変えない', () => {
  // 「今週の空き状況」の定型文
  const t = planner.availabilityText([{ date: '2026-10-27', closed: false, am: 3, pm: 2 }], '2026-10-26', '2026-10-25T18:30', '083-000-0000')
  const a = rules.googleSummary(t.body)
  assert.equal(a.phones, 1)
  assert.ok(a.text.includes('急なケガや強い痛みのときは、お電話のほうが早く対応できます。'), a.text)
  assert.ok(!/\d{2,4}-\d{2,4}-\d{4}/.test(a.text))
  assert.ok(a.text.includes('【今週のご予約の空き状況】（10/25時点）') && a.text.includes('・10/27（火） 午前'), a.text)
  // 拒否された「ぎっくり腰」の投稿の終わりの形
  const foot = '※症状や経過には個人差があります。\n■所在地：下関市彦島江の浦町9丁目1-14\n■受付時間：月〜金 10:00〜13:00／15:00〜20:00、土 10:00〜15:00（日曜休み）\n■お電話：083-000-0000'
  const f = rules.googleSummary(foot)
  assert.equal(f.phones, 1)
  assert.equal(f.text, foot.split('\n').slice(0, 3).join('\n'))
  // 書き方のちがい
  assert.equal(rules.googleSummary('TEL 0830000000').text, '')
  assert.equal(rules.googleSummary('☎ ０８３－０００－００００').text, '')
  assert.equal(rules.googleSummary('お電話（083(000)0000）でもどうぞ。').text, 'お電話でもどうぞ。')
  assert.equal(rules.googleSummary('フリーダイヤル 0120-000-000 まで').phones, 1)
  // 電話番号ではないもの
  const safe = [
    '下関市彦島江の浦町9丁目1-14（〒750-0075）',
    '月〜金 10:00-13:00・15:00-20:00、土 10:00-15:00',
    '2026-11-13 の 18:00 に公開。11月1日は下関海響マラソンです。',
    'リハビリ約30分2,850円、施術1部位1,500円、物理療法1,100〜3,500円（税込）',
    '柔道整復師3名・駐車場あり（3〜4台）・創業2014年',
    '100 200 3000 の順に、0 から 10 まで',
  ].join('\n')
  const s = rules.googleSummary(safe)
  assert.equal(s.text, safe)
  assert.equal(s.phones, 0)
  assert.equal(s.urls, 0)
})

await test('ホームページの入口：Googleの投稿のボタンから来た人は「Googleマップ・プロフィール」に数える', () => {
  assert.equal(hp.classifySource('', 'google_post'), 'maps')
  assert.equal(hp.classifySource('www.google.com', 'google_post'), 'maps')
  assert.equal(hp.classifySource('www.google.com', ''), 'google')
})

await test('審査の結果：Google の state をアプリの言い方に。見出し・リンク先の名前', () => {
  assert.equal(rules.googlePostState('LIVE'), 'live')
  assert.equal(rules.googlePostState('REJECTED'), 'rejected')
  assert.equal(rules.googlePostState('PROCESSING'), 'processing')
  assert.equal(rules.googlePostState('LOCAL_POST_STATE_UNSPECIFIED'), 'unknown')
  assert.equal(rules.googlePostState(undefined), 'unknown')
  assert.equal(rules.googlePostTitle('【下関市彦島｜足首の捻挫のリハビリ】\n部活や運動中に…'), '【下関市彦島｜足首の捻挫のリハビリ】')
  assert.equal(rules.googlePostTitle('あ'.repeat(60)).length, 40)
  assert.equal(rules.googlePostTitle(undefined), '')
  assert.equal(rules.googleButtonHost(`${GAS}?a=1`), 'script.google.com')
  assert.equal(rules.googleButtonHost(undefined), '')
})

await test('投稿ジョブに当たる Google の投稿を探す：名前で。古いジョブは本文の書き出しと時刻で', () => {
  const posts = [
    { name: 'accounts/1/locations/2/localPosts/30', state: 'LIVE', summary: '【下関市彦島｜足首の捻挫のリハビリ】\n部活や運動中に足首をひねったあと、「腫れが引いたから', createTime: '2026-11-13T09:00:05Z' },
    { name: 'accounts/1/locations/2/localPosts/20', state: 'REJECTED', summary: '山口県下関市彦島江の浦町にある「ゆうき整骨院」です。彦島エリアで部活動や地域のスポーツに励む学生さん', createTime: '2026-10-30T01:00:07Z' },
    { name: 'accounts/1/locations/2/localPosts/10', state: 'LIVE', summary: '山口県下関市彦島江の浦町にある「ゆうき整骨院」です。彦島エリアで部活動や地域のスポーツに励む学生さん', createTime: '2020-12-19T01:00:00Z' },
  ]
  assert.equal(rules.findLocalPost({ name: 'accounts/1/locations/2/localPosts/30', body: 'ちがう文', publishedAt: '2026-01-01T00:00:00Z' }, posts)?.name, posts[0].name)
  assert.equal(rules.findLocalPost({ name: 'accounts/1/locations/2/localPosts/99', body: posts[0].summary, publishedAt: '2026-11-13T09:00:00Z' }, posts), null)
  // 10/30 に出した古いジョブ（名前を控えていない）。同じ書き出しの 2020 年の投稿ではなく、出した時刻に近いほう
  const old = { body: '山口県下関市彦島江の浦町にある「ゆうき整骨院」です。\n彦島エリアで部活動や地域のスポーツに励む学生さん、日々の生活や…', publishedAt: '2026-10-30T01:00:01Z' }
  assert.equal(rules.findLocalPost(old, posts)?.name, 'accounts/1/locations/2/localPosts/20')
  assert.equal(rules.findLocalPost({ ...old, publishedAt: '2026-11-05T01:00:00Z' }, posts), null)
  assert.equal(rules.findLocalPost({ body: '短い', publishedAt: '2026-10-30T01:00:01Z' }, posts), null)
})

await test('確かめる番：出して2時間は毎回・そのあと6時間おき・7日で終わり。古いジョブは45日前まで1回だけ', () => {
  const now = new Date('2026-11-13T12:00:00Z')
  const ago = (min) => new Date(now.getTime() - min * 60000).toISOString()
  assert.equal(rules.googleCheckDue({ publishedAt: ago(1) }, now), 'check')
  assert.equal(rules.googleCheckDue({ publishedAt: ago(30), checkedAt: ago(5) }, now), 'wait')
  assert.equal(rules.googleCheckDue({ publishedAt: ago(30), checkedAt: ago(14) }, now), 'check')
  assert.equal(rules.googleCheckDue({ publishedAt: ago(5 * 60), checkedAt: ago(60) }, now), 'wait')
  assert.equal(rules.googleCheckDue({ publishedAt: ago(9 * 60), checkedAt: ago(6 * 60 + 1) }, now), 'check')
  assert.equal(rules.googleCheckDue({ publishedAt: ago(8 * 24 * 60), checkedAt: ago(60) }, now), 'finish')
  assert.equal(rules.googleCheckDue({ publishedAt: ago(14 * 24 * 60) }, now), 'check')
  assert.equal(rules.googleCheckDue({ publishedAt: ago(50 * 24 * 60) }, now), 'finish')
  assert.equal(rules.googleCheckDue({ publishedAt: ago(30), done: true }, now), 'wait')
  assert.equal(rules.googleCheckDue({ publishedAt: 'こわれた値' }, now), 'wait')
})

await test('通しで：Google へ送る中身（本文・ボタン）→ 審査の結果を確かめる → 拒否は「公開失敗」にして院長のLINEへ', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gbp-posts-'))
  const cwd = process.cwd()
  process.chdir(dir)
  const realFetch = globalThis.fetch
  const saved = { ...process.env }
  try {
    delete process.env.MARKETING_MODE
    delete process.env.SUPABASE_URL
    delete process.env.SUPABASE_SERVICE_ROLE_KEY
    delete process.env.BLOB_READ_WRITE_TOKEN
    process.env.GBP_CLIENT_ID = 'client'
    process.env.GBP_CLIENT_SECRET = 'secret'
    process.env.GBP_REFRESH_TOKEN = 'refresh'
    process.env.GBP_LOCATION_NAME = 'accounts/1/locations/2'
    process.env.LINE_CHANNEL_ACCESS_TOKEN = 'line-token'
    process.env.RESERVATION_NOTIFY_LINE_USER_ID = 'Uowner'
    const { createJob, getJob, updateJob } = await imp('src/lib/marketing/jobs-store-server.ts')
    const { kvGet } = await imp('src/lib/marketing/kv-store-server.ts')
    const { runOneJob } = await imp('src/lib/marketing/job-runner.ts')
    const server = await imp('src/lib/marketing/gbp-posts-server.ts')

    const sentToGoogle = []
    const lines = []
    let listed = []
    let listCalls = 0
    let listFails = false
    globalThis.fetch = async (url, init) => {
      const u = String(url)
      if (u === 'https://oauth2.googleapis.com/token') return new Response(JSON.stringify({ access_token: 'at' }), { status: 200 })
      if (u === 'https://mybusiness.googleapis.com/v4/accounts/1/locations/2/localPosts' && init?.method === 'POST') {
        const body = JSON.parse(init.body)
        sentToGoogle.push(body)
        const name = `accounts/1/locations/2/localPosts/${100 + sentToGoogle.length}`
        return new Response(JSON.stringify({ name, state: 'PROCESSING', searchUrl: 'https://local.google.com/place?id=1' }), { status: 200 })
      }
      if (u === 'https://mybusiness.googleapis.com/v4/accounts/1/locations/2/localPosts?pageSize=100') {
        listCalls += 1
        assert.equal(init.headers.Authorization, 'Bearer at')
        if (listFails) return new Response(JSON.stringify({ error: { message: 'だめ' } }), { status: 500 })
        return new Response(JSON.stringify({ localPosts: listed }), { status: 200 })
      }
      if (u.startsWith('https://api.line.me/')) {
        lines.push(JSON.parse(init.body))
        return new Response('{}', { status: 200 })
      }
      throw new Error(`テストで想定していない送信先: ${u}`)
    }

    // ① 前に予約した Google検索向けの投稿（本文に URL・ボタンは転送リンク）を、時刻になって出す
    const post = GBP_SEO_POSTS[0]
    const oldBody = `${post.body.trim()}\n\n${data.gbpSeoFooter(post.sitePath)}`
    const { job: seoJob } = await createJob({
      idempotencyKey: 'gbpseo:2026-11-09:1',
      projectId: 'gbpseo:2026-11-09',
      variantId: `gbpseo-${post.id}`,
      channel: 'google_business',
      theme: `Google検索向け：${post.title}`,
      content: { title: post.title, hook: post.subtitle, body: oldBody, cta: { label: '予約', url: GO }, hashtags: [], warnings: [], seoPostId: post.id },
      scheduledAt: '2026-11-13T18:00',
    })
    const ran = await runOneJob(seoJob)
    assert.equal(ran.outcome, 'published')
    assert.equal(sentToGoogle.length, 1)
    assert.equal(sentToGoogle[0].summary, gbpSeoText(post))
    assert.ok(!/https?:/.test(sentToGoogle[0].summary), '本文に URL を入れない')
    assert.deepEqual(sentToGoogle[0].callToAction, { actionType: 'BOOK', url: 'https://shimonoseki-yuuki.com/sym-ankle?utm_source=google_post&utm_campaign=seo20261109-1' })
    let stored = await getJob(seoJob.id)
    assert.equal(stored.status, 'published')
    assert.equal(stored.google.name, 'accounts/1/locations/2/localPosts/101')
    assert.equal(stored.google.state, 'processing')
    assert.ok(stored.google.postedAt)
    assert.match(stored.attempts.at(-1).message, /Googleの審査の結果は、このあと確かめます/)

    // ② 本文に電話番号・ボタンは予約システムのアドレス、という投稿（「投稿づくり」から）
    const { job: aiJob } = await createJob({
      idempotencyKey: 'variant-1',
      projectId: 'p1',
      variantId: 'variant-1',
      channel: 'google_business',
      theme: '新規集客',
      content: { title: '彦島でスポーツのお悩みなら', hook: '', body: '下関市彦島のゆうき整骨院です。\nお電話（083-000-0000）でもご相談いただけます。\nくわしくはこちら：https://example.com/', cta: { label: '予約', url: GAS }, hashtags: [], warnings: [] },
      scheduledAt: '2026-11-13T10:00',
    })
    await runOneJob(aiJob)
    assert.equal(sentToGoogle.length, 2)
    assert.equal(sentToGoogle[1].summary, '下関市彦島のゆうき整骨院です。\nお電話でもご相談いただけます。')
    assert.equal(sentToGoogle[1].callToAction.url, 'https://shimonoseki-yuuki.com/first-visit?utm_source=google_post&utm_campaign=gbp')
    assert.match((await getJob(aiJob.id)).attempts.at(-1).message, /本文のURL・電話番号は取りました/)

    // ③ 出した直後：Google ではまだ審査中。もう1本は公開された
    const t0 = new Date()
    listed = [
      { name: 'accounts/1/locations/2/localPosts/102', state: 'LIVE', summary: sentToGoogle[1].summary, createTime: t0.toISOString(), searchUrl: 'https://local.google.com/place?id=2', callToAction: sentToGoogle[1].callToAction },
      { name: 'accounts/1/locations/2/localPosts/101', state: 'PROCESSING', summary: sentToGoogle[0].summary, createTime: t0.toISOString(), callToAction: sentToGoogle[0].callToAction },
    ]
    let r = await server.checkGooglePosts(new Date(t0.getTime() + 60_000))
    assert.equal(r.checked, 2)
    assert.equal(r.live, 1)
    assert.equal(r.rejected.length, 0)
    assert.equal(await server.notifyGoogleRejections(r), 0)
    assert.equal(lines.length, 0)
    assert.equal((await getJob(aiJob.id)).google.state, 'live')
    assert.match((await getJob(aiJob.id)).attempts.at(-1).message, /Googleで公開されていることを確かめました/)
    assert.equal((await getJob(seoJob.id)).google.state, 'processing')
    // すぐもう一度呼んでも、Google には問い合わせない（確かめる番ではない）
    const before = listCalls
    r = await server.checkGooglePosts(new Date(t0.getTime() + 3 * 60_000))
    assert.equal(r.checked, 0)
    assert.equal(listCalls, before)

    // ④ 15分後：Google が拒否にした → 「公開失敗」にして理由を書き、院長のLINEへ1回だけ
    listed[1].state = 'REJECTED'
    // アプリの外（Googleの画面）で出して拒否された投稿：新しいもの1本と、3週間前のもの1本
    listed.push({ name: 'accounts/1/locations/2/localPosts/55', state: 'REJECTED', summary: '【冬の走り込みシーズン、すねや足の痛みはお早めに】\n下関市彦島の…', createTime: new Date(t0.getTime() - 22 * 86400e3).toISOString(), callToAction: { actionType: 'BOOK', url: `${GAS}?source=google_post&campaign=gbp-20261113` } })
    r = await server.checkGooglePosts(new Date(t0.getTime() + 16 * 60_000))
    assert.equal(r.rejected.length, 1)
    assert.equal(r.outside.length, 0, 'アプリの外の投稿は、半日に1回だけ見る')
    stored = await getJob(seoJob.id)
    assert.equal(stored.status, 'failed')
    assert.equal(stored.google.state, 'rejected')
    assert.equal(stored.google.done, true)
    assert.equal(stored.actionReason, server.GOOGLE_REJECTED_REASON)
    assert.match(stored.attempts.at(-1).message, /Googleの審査で拒否されました/)
    assert.equal(await server.notifyGoogleRejections(r), 1)
    assert.equal(lines.length, 1)
    assert.equal(lines[0].to, 'Uowner')
    const lineText = lines[0].messages[0].text
    assert.match(lineText, /Googleの投稿が、Googleの審査で拒否されました（公開されていません）/)
    assert.ok(lineText.includes(`「${post.title}」`) && lineText.includes('院内アプリから'), lineText)
    assert.ok(!/083|https?:/.test(lineText), lineText)
    assert.ok((await getJob(seoJob.id)).google.notifiedAt)
    // もう確かめ終わったので、次からは見ない・知らせない
    r = await server.checkGooglePosts(new Date(t0.getTime() + 40 * 60_000))
    assert.equal(r.rejected.length, 0)
    assert.equal(await server.notifyGoogleRejections(r), 0)
    assert.equal(lines.length, 1)

    // ⑤ 半日後：アプリの外で出した投稿の拒否。新しいものだけを1回知らせる（3週間前のものは知らせない）
    listed.push({ name: 'accounts/1/locations/2/localPosts/60', state: 'REJECTED', summary: '【年末年始の受付のお知らせ】\n下関市彦島の…', createTime: new Date(t0.getTime() + 10 * 3600e3).toISOString(), callToAction: { actionType: 'CALL' } })
    const half = new Date(t0.getTime() + 13 * 3600e3)
    r = await server.checkGooglePosts(half)
    assert.deepEqual(r.outside.map((p) => p.name), ['accounts/1/locations/2/localPosts/60'])
    assert.equal(await server.notifyGoogleRejections(r, half), 1)
    assert.equal(lines.length, 2)
    assert.ok(lines[1].messages[0].text.includes('「【年末年始の受付のお知らせ】」') && lines[1].messages[0].text.includes('Googleの画面から'), lines[1].messages[0].text)
    assert.deepEqual((await kvGet('gbp:posts:watch')).seen, ['accounts/1/locations/2/localPosts/60'])
    r = await server.checkGooglePosts(new Date(half.getTime() + 13 * 3600e3))
    assert.equal(r.outside.length, 0, '同じ拒否を二度知らせない')

    // ⑥ 画面に出す中身：数・拒否された投稿・リンク先が拒否されやすいかどうか
    const view = await server.googlePostsOverview(true, new Date(half.getTime() + 14 * 3600e3))
    assert.equal(view.connected, true)
    assert.deepEqual(view.counts, { total: 4, live: 1, rejected: 3, processing: 0 })
    assert.deepEqual(view.rejected.map((x) => x.title), ['【年末年始の受付のお知らせ】', '【下関市彦島｜足首の捻挫のリハビリ】', '【冬の走り込みシーズン、すねや足の痛みはお早めに】'])
    const mine = view.rejected.find((x) => x.title.includes('足首'))
    assert.equal(mine.fromApp, true)
    assert.equal(mine.linkHost, 'shimonoseki-yuuki.com')
    assert.equal(mine.linkOk, true)
    const gas = view.rejected.find((x) => x.title.includes('冬の走り込み'))
    assert.equal(gas.fromApp, false)
    assert.equal(gas.linkHost, 'script.google.com')
    assert.equal(gas.linkOk, false)
    assert.equal(view.rejected[0].button, 'CALL')
    assert.equal(view.rejected[0].linkOk, true)
    // とっておきには、本文の書き出しだけを残す
    const cache = await kvGet('gbp:posts:cache')
    assert.ok(cache.posts.every((p) => (p.summary ?? '').length <= 160 && !('media' in p)))

    // ⑦ この仕組みの前に出した古いジョブ（名前の控えなし）：本文の書き出しで探し、拒否なら印を付ける。古いのでLINEはしない
    const oldAt = new Date(half.getTime() - 14 * 86400e3)
    const { job: legacy } = await createJob({
      idempotencyKey: 'legacy-1',
      projectId: 'p0',
      variantId: 'legacy-1',
      channel: 'google_business',
      theme: '新規集客',
      content: { title: '彦島で捻挫・打撲・スポーツのお悩みなら', hook: '', body: '山口県下関市彦島江の浦町にある「ゆうき整骨院」です。彦島エリアで部活動や地域のスポーツに励む学生さん、日々の生活や…', cta: { label: '予約', url: GAS }, hashtags: [], warnings: [] },
      scheduledAt: '2026-10-30T10:00',
    })
    await updateJob(legacy.id, (j) => {
      j.status = 'published'
      j.attempts.push({ at: oldAt.toISOString(), ok: true, message: 'Googleビジネスプロフィールへ投稿しました' })
    })
    listed.push({ name: 'accounts/1/locations/2/localPosts/40', state: 'REJECTED', summary: '山口県下関市彦島江の浦町にある「ゆうき整骨院」です。彦島エリアで部活動や地域のスポーツに励む学生さん、日々の生活や…', createTime: new Date(oldAt.getTime() + 5000).toISOString(), callToAction: { actionType: 'BOOK', url: GAS } })
    const later = new Date(half.getTime() + 15 * 3600e3)
    r = await server.checkGooglePosts(later)
    assert.deepEqual(r.rejected.map((j) => j.id), [legacy.id])
    assert.equal((await getJob(legacy.id)).status, 'failed')
    assert.equal(await server.notifyGoogleRejections(r, later), 0, '2週間前の拒否は、いまさら知らせない')
    assert.equal(lines.length, 2)

    // ⑧ Google に問い合わせられないとき：止まらず、何も変えない
    const { job: third } = await createJob({ idempotencyKey: 'variant-3', projectId: 'p3', variantId: 'variant-3', channel: 'google_business', theme: 'x', content: { title: 'x', hook: '', body: '下関市彦島のゆうき整骨院です。冬の走り込みの時期になりました。', hashtags: [], warnings: [] }, scheduledAt: '2026-11-13T10:00' })
    await runOneJob(third)
    assert.equal(sentToGoogle[2].callToAction, undefined, 'リンクの無い投稿はボタン無し')
    listFails = true
    r = await server.checkGooglePosts(new Date(Date.now() + 60_000))
    assert.deepEqual({ checked: r.checked, rejected: r.rejected.length }, { checked: 0, rejected: 0 })
    assert.equal((await getJob(third.id)).status, 'published')
    assert.equal((await getJob(third.id)).google.checkedAt, undefined)
  } finally {
    globalThis.fetch = realFetch
    for (const k of Object.keys(process.env)) if (!(k in saved)) delete process.env[k]
    Object.assign(process.env, saved)
    process.chdir(cwd)
    fs.rmSync(dir, { recursive: true, force: true })
  }
})

const page = fs.readFileSync(new URL('src/app/(app)/marketing/jobs/page.tsx', root), 'utf8')
const run = fs.readFileSync(new URL('src/app/api/marketing/jobs/run/route.ts', root), 'utf8')
await test('つなぎ：定期の実行（jobs/run）で確かめる・画面に「Googleが拒否」を出し、出し直しのボタンは出さない', () => {
  assert.ok(run.includes('checkGooglePosts()') && run.includes('notifyGoogleRejections(checked)'))
  assert.ok(page.includes("label: 'Googleが拒否'") && page.includes("job.status === 'failed' && !isGoogleRejected(job)"))
  assert.ok(page.includes('/api/marketing/google/posts'))
})

console.log(`\n結果: ${passed} 件成功 / 0 件失敗`)
