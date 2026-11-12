// 宣伝の短い動画（YouTubeショート・TikTok）：「LINEで承認してから、Buffer 経由で自動で投稿」の確認
// 実行: node tools/test-promo-approval.mjs
// 外には送らない（fetch を差しかえて、Buffer・LINE の返事をまねる）。KV は一時フォルダのファイル
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
const ap = await imp('src/lib/marketing/promo-approval.ts')
const bf = await imp('src/lib/marketing/buffer.ts')
const promo = await imp('src/lib/marketing/promo-video.ts')
const { PROMO_VIDEOS } = await imp('src/data/promo-videos.ts')
const { KV_PREFIXES } = await imp('src/lib/marketing/kv-store-server.ts')

let passed = 0
async function test(name, fn) {
  await fn()
  passed += 1
  console.log(`  ✓ ${name}`)
}

await test('時刻の計算：日本時間の文字のまま時間を足す・昼間（8〜21時）だけLINEを送る', () => {
  assert.equal(ap.addHoursLocal('2026-11-18T13:30', -30), '2026-11-17T07:30')
  assert.equal(ap.addHoursLocal('2026-11-18T13:30', 24), '2026-11-19T13:30')
  assert.equal(ap.addHoursLocal('2026-12-31T23:00', 2), '2027-01-01T01:00')
  assert.equal(ap.isoToLocal('2026-11-17T08:30:00.000Z'), '2026-11-17T17:30')
  assert.equal(ap.isDaytime('2026-11-17T07:59'), false)
  assert.equal(ap.isDaytime('2026-11-17T08:00'), true)
  assert.equal(ap.isDaytime('2026-11-17T20:59'), true)
  assert.equal(ap.isDaytime('2026-11-17T21:00'), false)
  assert.equal(ap.slotText('2026-11-18T13:30'), '11/18(水) 13:30')
})

await test('承認の状態：承認・見送り・期限切れ（時刻から24時間）・待ち', () => {
  const e = { scheduledAt: '2026-11-18T13:30', videoId: 'acl', campaign: 'pv' }
  assert.equal(ap.promoApprovalStatus(e, '2026-11-18T13:29'), 'waiting')
  assert.equal(ap.promoApprovalStatus(e, '2026-11-19T13:29'), 'waiting')
  assert.equal(ap.promoApprovalStatus(e, '2026-11-19T13:30'), 'expired')
  assert.equal(ap.promoApprovalStatus({ ...e, approval: { status: 'approved', at: '', by: '' } }, '2026-11-20T00:00'), 'approved')
  assert.equal(ap.promoApprovalStatus({ ...e, approval: { status: 'skipped', at: '', by: '' } }, '2026-11-17T00:00'), 'skipped')
})

await test('承認のお願いを送る時：30時間前から。送れなかったら1時間おいて送り直す。作っている途中は重ねない', () => {
  const e = { scheduledAt: '2026-11-18T13:30', videoId: 'acl', campaign: 'pv' }
  const iso = (local) => new Date(Date.parse(`${local}:00Z`) - 9 * 3600e3).toISOString()
  assert.equal(ap.needsApprovalRequest(e, '2026-11-17T07:29', iso('2026-11-17T07:29')), false)
  assert.equal(ap.needsApprovalRequest(e, '2026-11-17T07:30', iso('2026-11-17T07:30')), true)
  // 時刻を過ぎても、期限（24時間）までは送る
  assert.equal(ap.needsApprovalRequest(e, '2026-11-19T10:00', iso('2026-11-19T10:00')), true)
  assert.equal(ap.needsApprovalRequest(e, '2026-11-19T13:30', iso('2026-11-19T13:30')), false)
  const video = { url: 'https://b/x.mp4', posterUrl: 'https://b/x.jpg', hash: 'abcdef1234', aiImages: 2 }
  const sent = { ...e, request: { at: iso('2026-11-17T09:00'), delivered: true, video } }
  assert.equal(ap.needsApprovalRequest(sent, '2026-11-17T12:00', iso('2026-11-17T12:00')), false)
  const failed = { ...e, request: { at: iso('2026-11-17T09:00'), delivered: false, video } }
  assert.equal(ap.needsApprovalRequest(failed, '2026-11-17T09:59', iso('2026-11-17T09:59')), false)
  assert.equal(ap.needsApprovalRequest(failed, '2026-11-17T10:00', iso('2026-11-17T10:00')), true)
  const busy = { ...e, requesting: iso('2026-11-17T09:00') }
  assert.equal(ap.needsApprovalRequest(busy, '2026-11-17T09:05', iso('2026-11-17T09:05')), false)
  assert.equal(ap.needsApprovalRequest(busy, '2026-11-17T09:06', iso('2026-11-17T09:06')), true)
  assert.equal(ap.needsApprovalRequest({ ...e, approval: { status: 'approved', at: '', by: '' } }, '2026-11-17T09:00', iso('2026-11-17T09:00')), false)
  // 念押し：届いていて、3時間前を過ぎた。お願い自体が3時間前より後なら送らない。1回だけ
  assert.equal(ap.needsApprovalReminder(sent, '2026-11-18T10:29'), false)
  assert.equal(ap.needsApprovalReminder(sent, '2026-11-18T10:30'), true)
  assert.equal(ap.needsApprovalReminder({ ...sent, remindedAt: 'x' }, '2026-11-18T11:00'), false)
  assert.equal(ap.needsApprovalReminder({ ...sent, request: { ...sent.request, at: iso('2026-11-18T11:00') } }, '2026-11-18T12:00'), false)
  assert.equal(ap.needsApprovalReminder(failed, '2026-11-18T11:00'), false)
})

await test('LINEのボタン：週・番号・見本の目印を入れる。形のちがうものは受けない', () => {
  const data = ap.promoPostback('ok', '2026-11-16', 1, ap.promoVideoToken('abcdef1234567'))
  assert.equal(data, 'ap:pv_ok:2026-11-16:1:abcdef12')
  assert.ok(data.length <= 300)
  assert.deepEqual(ap.parsePromoPostback(data), { action: 'ok', week: '2026-11-16', n: 1, token: 'abcdef12' })
  assert.deepEqual(ap.parsePromoPostback('ap:pv_swap:2026-11-23:2:zz'), { action: 'swap', week: '2026-11-23', n: 2, token: 'zz' })
  assert.equal(ap.parsePromoPostback('ap:pv_ok:2026-11-16:1'), null)
  assert.equal(ap.parsePromoPostback('ap:pv_delete:2026-11-16:1:abc'), null)
  assert.equal(ap.parsePromoPostback('ap:done:job'), null)
})

await test('別の動画にする：いまの次から、予定に入っていない動画', () => {
  const vids = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }]
  assert.equal(ap.pickSwapVideo('a', ['a', 'b'], vids).id, 'c')
  assert.equal(ap.pickSwapVideo('d', ['d'], vids).id, 'a')
  assert.equal(ap.pickSwapVideo('a', ['a', 'b', 'c', 'd'], vids).id, 'b')
  assert.equal(ap.pickSwapVideo('a', [], [{ id: 'a' }]), null)
})

await test('LINEの文：見本の動画・貼る文・承認／見送り／別の動画／アプリのボタン（吹き出し4つ＝1通）', () => {
  const v = PROMO_VIDEOS[0]
  const video = { url: 'https://blob.example/promo/a.mp4', posterUrl: 'https://blob.example/promo/a.jpg', hash: 'abcdef1234', aiImages: 2 }
  const input = {
    week: '2026-11-16',
    n: 1,
    entry: { scheduledAt: '2026-11-18T13:30', videoId: v.id, campaign: 'pv20261116-1' },
    title: v.post.title,
    video,
    routes: { youtube_short: 'buffer', tiktok: 'manual' },
    youtubeTitle: '題名',
    tiktokCaption: 'TikTokの文',
    appUrl: 'https://yuuki-rehab.vercel.app',
    nowLocal: '2026-11-17T09:00',
  }
  const msgs = ap.approvalRequestMessages(input)
  assert.equal(msgs.length, 4)
  assert.match(msgs[0], /11\/18\(水\) 13:30 に出す動画です/)
  assert.match(msgs[0], /→ YouTube（承認すると、時間になったら自動で投稿します）/)
  assert.match(msgs[0], /TikTokは自動で出す連携がまだのため/)
  assert.match(msgs[0], /押さなければ投稿しません/)
  assert.match(msgs[0], /前半の絵はAIで作ったイメージ/)
  assert.deepEqual(msgs[1], { type: 'video', originalContentUrl: video.url, previewImageUrl: video.posterUrl })
  assert.match(msgs[2], /【YouTube 題名】\n題名/)
  const buttons = msgs[3].contents.footer.contents.map((b) => b.action.data ?? b.action.uri)
  assert.deepEqual(buttons, [
    'ap:pv_ok:2026-11-16:1:abcdef12',
    'ap:pv_skip:2026-11-16:1:abcdef12',
    'ap:pv_swap:2026-11-16:1:abcdef12',
    'https://yuuki-rehab.vercel.app/marketing/autopilot?open=settings#promo-video',
  ])
  // 院内アプリのURL（パスワードの内側）の動画は LINE から読めないので、動画の吹き出しは付けない
  assert.equal(ap.approvalRequestMessages({ ...input, video: { ...video, url: 'https://yuuki-rehab.vercel.app/api/x' } }).length, 3)
  // 時刻を過ぎてからのお願いは「すぐに」
  assert.match(ap.approvalRequestMessages({ ...input, nowLocal: '2026-11-18T15:00' })[0], /すぐに自動で投稿/)
  const remind = ap.approvalReminderMessages(input)
  assert.equal(remind.length, 1)
  assert.match(remind[0].contents.body.contents[0].text, /まだ承認されていません/)
  assert.match(remind[0].contents.body.contents[0].text, /11\/19\(木\) 13:30 までに承認が無ければ/)
})

await test('Buffer に渡す形：すぐ出す・自動で公開。YouTube は題名とカテゴリ、TikTok は表紙の位置。AIの申告', () => {
  const content = { title: 'あ'.repeat(120), body: '説明' }
  const yt = bf.bufferPostInput({ channelId: 'ch-yt', channel: 'youtube_short', content, videoUrl: 'https://blob.example/a.mp4', aiGenerated: true })
  assert.deepEqual(yt, {
    channelId: 'ch-yt',
    text: '説明',
    schedulingType: 'automatic',
    mode: 'shareNow',
    assets: [{ video: { url: 'https://blob.example/a.mp4' } }],
    metadata: { youtube: { title: 'あ'.repeat(100), categoryId: '26', privacy: 'public', madeForKids: false, notifySubscribers: true, embeddable: true, license: 'youtube', isAiGenerated: true } },
  })
  const tt = bf.bufferPostInput({ channelId: 'ch-tt', channel: 'tiktok', content, videoUrl: 'https://blob.example/a.mp4', aiGenerated: false })
  assert.deepEqual(tt.assets, [{ video: { url: 'https://blob.example/a.mp4', metadata: { thumbnailOffset: 1500 } } }])
  assert.deepEqual(tt.metadata, { tiktok: { isAiGenerated: false } })
  // 動画は https の公開URLだけ（Buffer が取りに来る）
  assert.throws(() => bf.bufferPostInput({ channelId: 'c', channel: 'tiktok', content, videoUrl: '/api/marketing/promo-video?id=x', aiGenerated: false }))
  // 返事の読み方
  assert.deepEqual(bf.readCreatePostResult({ createPost: { __typename: 'PostActionSuccess', post: { id: 'p1', status: 'sending', externalLink: null, error: null } } }), {
    ok: true,
    post: { id: 'p1', status: 'sending', externalLink: null, error: null },
  })
  assert.deepEqual(bf.readCreatePostResult({ createPost: { __typename: 'LimitReachedError', message: 'over limit' } }), { ok: false, kind: 'LimitReachedError', message: 'over limit' })
  assert.equal(bf.bufferPostPhase('sent'), 'sent')
  assert.equal(bf.bufferPostPhase('error'), 'error')
  assert.equal(bf.bufferPostPhase('sending'), 'waiting')
  // GraphQL の文：Buffer の CLI と同じ名前
  assert.match(bf.M_CREATE_POST, /createPost\(input: \$input\)/)
  assert.match(bf.M_CREATE_POST, /\.\.\. on PostActionSuccess/)
  assert.match(bf.M_CREATE_POST, /\.\.\. on MutationError \{ message \}/)
  assert.match(bf.Q_CHANNELS, /channels\(input: \$input\)/)
  assert.match(bf.Q_RECENT_POSTS, /edges \{ node/)
  // チャンネル：YouTube・TikTok を1つずつ。使えるものを先に
  const picked = bf.pickBufferChannels([
    { id: 'x1', name: '古いTikTok', service: 'tiktok', isDisconnected: true },
    { id: 'x2', name: 'ゆうき整骨院', service: 'tiktok' },
    { id: 'x3', name: 'ゆうき整骨院ch', service: 'youtube', isLocked: false },
    { id: 'x4', name: 'IG', service: 'instagram' },
  ])
  assert.deepEqual(Object.keys(picked).sort(), ['tiktok', 'youtube'])
  assert.equal(picked.tiktok.id, 'x2')
  assert.equal(bf.bufferChannelReady({ id: 'x1', name: '', service: 'tiktok', isDisconnected: true }), false)
  assert.equal(bf.looksLikeBufferKey('buf_abc123def456ghi789'), true)
  assert.equal(bf.looksLikeBufferKey('buf abc 123'), false)
  assert.equal(bf.looksLikeBufferKey('短い'), false)
  assert.equal(bf.bufferKeyHint('buf_abcdef1234'), '…1234')
  assert.ok(KV_PREFIXES.includes('buffer:'), 'LINEの連絡先の一覧に、Buffer の行がまぎれこまないように')
})

await test('通しで：前日にLINEで見本→念押し→承認→Buffer で自動投稿→出たかを確かめる（出せなかったら手で投稿の案内）', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'promo-approval-'))
  const cwd = process.cwd()
  process.chdir(dir)
  const realFetch = globalThis.fetch
  const saved = { ...process.env }
  try {
    delete process.env.MARKETING_MODE
    delete process.env.BLOB_READ_WRITE_TOKEN
    delete process.env.OPENAI_API_KEY
    delete process.env.BUFFER_API_KEY
    delete process.env.GBP_CLIENT_ID
    process.env.LINE_CHANNEL_ACCESS_TOKEN = 'line-token'
    process.env.RESERVATION_NOTIFY_LINE_USER_ID = 'Uowner'
    const { kvGet, kvSet } = await imp('src/lib/marketing/kv-store-server.ts')
    const server = await imp('src/lib/marketing/promo-video-server.ts')
    const buffer = await imp('src/lib/marketing/buffer-server.ts')
    const { runOneJob } = await imp('src/lib/marketing/job-runner.ts')
    const { getJob, listJobs } = await imp('src/lib/marketing/jobs-store-server.ts')
    const { handleOwnerPostback } = await imp('src/lib/marketing/autopilot-server.ts')

    // 来週の月曜（日本時間）。テストを走らせる日に左右されないように
    const jstToday = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10)
    const dow = new Date(`${jstToday}T00:00:00Z`).getUTCDay()
    const add = (d, n) => new Date(Date.parse(`${d}T00:00:00Z`) + n * 86400e3).toISOString().slice(0, 10)
    const week = add(jstToday, ((8 - dow) % 7) || 7)
    const slot = `${add(week, 2)}T13:30`
    const at = (local) => new Date(Date.parse(`${local}:00Z`) - 9 * 3600e3) // 日本時間 → Date

    // Buffer・LINE の返事をまねる
    const lines = []
    const gql = []
    let createMode = 'ok'
    let recentText = ''
    const postStatus = {}
    globalThis.fetch = async (url, init) => {
      const u = String(url)
      if (u.startsWith('https://api.line.me/')) {
        lines.push(JSON.parse(init.body))
        return new Response('{}', { status: 200 })
      }
      if (u === bf.BUFFER_API_URL) {
        assert.equal(init.headers.Authorization, 'Bearer buf_test_key_1234567890')
        const body = JSON.parse(init.body)
        gql.push(body)
        const json = (data) => new Response(JSON.stringify({ data }), { status: 200, headers: { 'content-type': 'application/json' } })
        if (body.query.includes('BufferAccount')) return json({ account: { id: 'acc', timezone: 'Asia/Tokyo', organizations: [{ id: 'org1', name: 'ゆうき整骨院' }] } })
        if (body.query.includes('BufferChannels')) {
          assert.deepEqual(body.variables, { input: { organizationId: 'org1' } })
          return json({ channels: [{ id: 'yt1', name: 'ゆうき整骨院', displayName: null, service: 'youtube' }, { id: 'tt1', name: 'yu.ki', displayName: null, service: 'tiktok' }] })
        }
        if (body.query.includes('CreatePost')) {
          if (createMode === 'network') {
            createMode = 'ok'
            throw new TypeError('fetch failed')
          }
          const id = `post-${body.variables.input.channelId}`
          return json({ createPost: { __typename: 'PostActionSuccess', post: { id, status: 'sending', externalLink: null, error: null } } })
        }
        if (body.query.includes('BufferRecentPosts')) {
          return json({ posts: { edges: [{ node: { id: 'post-yt1', status: 'sending', text: recentText, createdAt: new Date().toISOString(), externalLink: null } }] } })
        }
        if (body.query.includes('BufferPost')) {
          const s = postStatus[body.variables.input.id] ?? { status: 'sending' }
          return json({ post: { id: body.variables.input.id, status: s.status, externalLink: s.link ?? null, sentAt: null, error: s.error ? { message: s.error } : null } })
        }
      }
      throw new Error(`思っていない送り先: ${u}`)
    }

    // 0) 院内アプリのURL（パスワードの内側）は、Buffer が取りに来られないので使わない
    assert.equal(server.isFetchableFromOutside('https://yuuki-rehab.vercel.app/api/marketing/promo-video?id=x&kind=video'), false)
    assert.equal(server.isFetchableFromOutside('https://abc.public.blob.vercel-storage.com/marketing/promo/x.mp4'), true)
    assert.equal(server.isFetchableFromOutside('/api/marketing/promo-video?id=x'), false)

    // 1) Buffer につなぐ（キーは保存されるが、状態には出さない）
    const status = await buffer.connectBuffer('buf_test_key_1234567890')
    assert.equal(status.connected, true)
    assert.equal(status.source, 'app')
    assert.equal(status.keyHint, '…7890')
    assert.deepEqual(status.youtube, { name: 'ゆうき整骨院', ready: true })
    assert.deepEqual(status.tiktok, { name: 'yu.ki', ready: true })
    assert.ok(!JSON.stringify(status).includes('buf_test_key'), '状態にキーそのものを出さない')
    assert.equal(await server.promoRouteFor('tiktok'), 'buffer')
    assert.equal(await server.promoRouteFor('youtube_short'), 'buffer')

    // 2) 予定を決める（来週の水曜13:30）。動画は作りおきがある状態に（Blob に置いたもの）
    const now0 = at(`${week}T09:00`)
    await server.schedulePromoVideos(now0)
    const plan = await server.getPromoWeekPlan(week)
    assert.equal(plan.items[0].scheduledAt, slot)
    const vid = plan.items[0].videoId
    const hash = await server.promoVideoHash(vid)
    const stored = { id: vid, hash, url: `https://blob.example/promo/${vid}-${hash}.mp4`, posterUrl: `https://blob.example/promo/${vid}-${hash}.jpg`, seconds: 16, bytes: 4, createdAt: new Date().toISOString(), aiImages: 0 }
    await kvSet(`promo:video:${vid}`, stored)
    const jobs = (await listJobs()).filter((j) => j.idempotencyKey.startsWith(`promo:${week}:1:`))
    assert.deepEqual(jobs.map((j) => j.channel).sort(), ['instagram_reel', 'tiktok', 'youtube_short'])

    // 3) まだ早い（31時間前）・夜は送らない
    assert.equal((await server.requestPromoApprovals({ now: at(ap.addHoursLocal(slot, -31)) })).requested, 0)
    assert.equal((await server.requestPromoApprovals({ now: at(`${add(week, 1)}T22:00`) })).requested, 0)
    assert.equal(lines.length, 0)

    // 4) 前日17:30：見本の動画つきで承認のお願い（1通）。続けて呼んでも2通めは送らない
    const tue = at(`${add(week, 1)}T17:30`)
    assert.deepEqual(await server.requestPromoApprovals({ now: tue }), { requested: 1, reminded: 0 })
    assert.equal(lines.length, 1)
    const msgs = lines[0].messages
    assert.equal(lines[0].to, 'Uowner')
    assert.deepEqual(msgs.map((m) => m.type), ['text', 'video', 'text', 'flex'])
    assert.match(msgs[0].text, /→ YouTube・TikTok（承認すると、時間になったら自動で投稿します）/)
    assert.equal(msgs[1].originalContentUrl, stored.url)
    const token = ap.promoVideoToken(hash)
    const okData = `ap:pv_ok:${week}:1:${token}`
    assert.equal(msgs[3].contents.footer.contents[0].action.data, okData)
    assert.deepEqual(await server.requestPromoApprovals({ now: new Date(tue.getTime() + 15 * 60e3) }), { requested: 0, reminded: 0 })
    assert.equal(lines.length, 1)

    // 5) 承認前に時刻が来ても出さない（待つ。やり直しの回数に数えない）
    const yJob = jobs.find((j) => j.channel === 'youtube_short')
    const tJob = jobs.find((j) => j.channel === 'tiktok')
    recentText = yJob.content.body
    const waited = await runOneJob(yJob)
    assert.equal(waited.outcome, 'waiting')
    assert.equal(waited.job.status, 'pending')
    assert.equal(waited.job.attempts.length, 0)
    assert.ok(waited.job.nextAttemptAt)
    assert.match(waited.job.actionReason, /承認待ち/)
    assert.ok(!gql.some((b) => b.query.includes('CreatePost')))

    // 6) 3時間前に1回だけ念押し
    const wed = at(ap.addHoursLocal(slot, -2.5))
    assert.deepEqual(await server.requestPromoApprovals({ now: wed }), { requested: 0, reminded: 1 })
    assert.deepEqual(lines[1].messages.map((m) => m.type), ['flex'])
    assert.deepEqual(await server.requestPromoApprovals({ now: new Date(wed.getTime() + 15 * 60e3) }), { requested: 0, reminded: 0 })

    // 7) LINEのボタン：古い見本の目印では操作できない／正しい目印で承認
    assert.match((await handleOwnerPostback(`ap:pv_ok:${week}:1:zzzzzzzz`))[0], /古くなっています/)
    const reply = await handleOwnerPostback(okData)
    assert.match(reply[0], /✅ 承認しました/)
    const approved = (await server.getPromoWeekPlan(week)).items[0]
    assert.equal(approved.approval.status, 'approved')
    assert.equal(approved.approval.by, 'LINE（院長）')
    assert.equal(approved.approval.video.url, stored.url)
    assert.equal((await getJob(yJob.id)).nextAttemptAt, undefined, '承認したら、待たずに次の回で出す')
    assert.match((await handleOwnerPostback(okData))[0], /すでに承認済み/)
    // 承認したら「別の動画にする」はできない
    assert.match((await handleOwnerPostback(`ap:pv_swap:${week}:1:${token}`))[0], /先に承認を取り消して/)

    // 8) 承認した動画を Buffer で出す（TikTok）
    const tOut = await runOneJob(await getJob(tJob.id))
    assert.equal(tOut.outcome, 'published')
    const create = gql.filter((b) => b.query.includes('CreatePost')).at(-1).variables.input
    assert.equal(create.channelId, 'tt1')
    assert.equal(create.mode, 'shareNow')
    assert.equal(create.schedulingType, 'automatic')
    assert.equal(create.assets[0].video.url, stored.url)
    assert.deepEqual(create.metadata, { tiktok: { isAiGenerated: false } })
    assert.equal(create.text, tJob.content.body)
    const tAfter = await getJob(tJob.id)
    assert.equal(tAfter.status, 'published')
    assert.equal(tAfter.external.postId, 'post-tt1')
    assert.equal(tAfter.actionReason, undefined)

    // 9) YouTube：届いたか分からない（通信エラー）→ 一覧で確かめて、できていれば二重に作らない
    createMode = 'network'
    const before = gql.filter((b) => b.query.includes('CreatePost')).length
    const yOut = await runOneJob(await getJob(yJob.id))
    assert.equal(yOut.outcome, 'published')
    assert.equal(gql.filter((b) => b.query.includes('CreatePost')).length, before + 1, '通信エラーのあと、もう一度は作らない（送ったのは1回だけ）')
    assert.ok(gql.some((b) => b.query.includes('BufferRecentPosts')))
    assert.equal((await getJob(yJob.id)).external.postId, 'post-yt1')

    // 10) 出たか確かめる：TikTok は出た（公開先を記録）、YouTube は出せなかった（手で投稿の案内へ）
    postStatus['post-tt1'] = { status: 'sent', link: 'https://www.tiktok.com/@yu.ki/video/1' }
    postStatus['post-yt1'] = { status: 'error', error: 'Video is too short' }
    const checked = await server.checkBufferPromoPosts()
    assert.equal(checked.sent, 1)
    assert.equal(checked.failed.length, 1)
    assert.equal((await getJob(tJob.id)).publishedUrl, 'https://www.tiktok.com/@yu.ki/video/1')
    const yFailed = await getJob(yJob.id)
    assert.equal(yFailed.status, 'action_required')
    assert.equal(yFailed.manualUrl, stored.url)
    assert.match(yFailed.actionReason, /^BufferからYouTubeへ投稿できませんでした（Video is too short）/)
    // 確かめ終わったものは、もう見ない
    assert.deepEqual(await server.checkBufferPromoPosts(), { checked: 0, sent: 0, failed: [] })

    // 11) 来週の分：別の動画に変える → 見送る（ジョブは取り消し・作り直さない）→ 元に戻す
    const week2 = add(week, 7)
    const plan2 = await server.getPromoWeekPlan(week2)
    const old = plan2.items[0].videoId
    let r = await server.applyPromoAction(week2, 1, 'swap', 'テスト', { now: now0 })
    assert.equal(r.ok, true)
    const swapped = (await server.getPromoWeekPlan(week2)).items[0].videoId
    assert.notEqual(swapped, old)
    assert.notEqual(swapped, vid)
    const jobs2 = (await listJobs()).filter((j) => j.idempotencyKey.startsWith(`promo:${week2}:1:`))
    assert.ok(jobs2.every((j) => j.content.promoVideoId === swapped))
    r = await server.applyPromoAction(week2, 1, 'skip', 'テスト', { now: now0 })
    assert.equal(r.ok, true)
    assert.ok((await listJobs()).filter((j) => j.idempotencyKey.startsWith(`promo:${week2}:1:`)).every((j) => j.status === 'cancelled'))
    await server.schedulePromoVideos(now0)
    assert.equal((await listJobs()).filter((j) => j.idempotencyKey.startsWith(`promo:${week2}:1:`) && j.status === 'pending').length, 0, '見送った回のジョブは作り直さない')
    r = await server.applyPromoAction(week2, 1, 'restore', 'テスト', { now: now0 })
    assert.equal(r.ok, true)
    assert.equal((await listJobs()).filter((j) => j.idempotencyKey.startsWith(`promo:${week2}:1:`) && j.status === 'pending').length, 3)

    // 12) 承認が無いまま時刻から24時間たったら、その回は出さない
    const g = await server.promoGate('tiktok', promo.promoJobKey(week2, 1, 'tiktok'), at(ap.addHoursLocal((await server.getPromoWeekPlan(week2)).items[0].scheduledAt, 25)))
    assert.equal(g.kind, 'skip')
    assert.equal((await server.getPromoWeekPlan(week2)).items[0].approval.status, 'expired')

    // 13) 画面に出す一覧（承認の状態・出し方）
    const view = await server.promoPlanView(now0)
    assert.equal(view[0].status, 'approved')
    assert.deepEqual(view[0].channels.map((c) => c.route), ['buffer', 'buffer', 'manual'])
    assert.equal(view[0].videoUrl, stored.url)

    // 14) キーが取り消されたら、つながっていない扱い（自動では出さず手で）
    globalThis.fetch = async (url) => {
      if (String(url) === bf.BUFFER_API_URL) return new Response('{"errors":[{"message":"Unauthorized"}]}', { status: 401 })
      throw new Error('思っていない送り先')
    }
    const revoked = await buffer.bufferStatus({ refresh: true })
    assert.equal(revoked.connected, false)
    assert.match(revoked.error, /キーが正しくないか、取り消されています/)
    // 画面に貼ったキーを消せる
    await buffer.disconnectBuffer()
    assert.equal((await kvGet('buffer:config')), null)
    assert.equal((await buffer.bufferStatus()).connected, false)
  } finally {
    globalThis.fetch = realFetch
    for (const k of Object.keys(process.env)) if (!(k in saved)) delete process.env[k]
    Object.assign(process.env, saved)
    process.chdir(cwd)
    fs.rmSync(dir, { recursive: true, force: true })
  }
})

console.log(`\n${passed} 件 OK`)
