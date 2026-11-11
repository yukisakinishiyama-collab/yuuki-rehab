// 宣伝の短い動画（YouTubeショート・TikTok）：文面・場面・予定の決め方・YouTube への送り方の確認
// 実行: node tools/test-promo-video.mjs
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
const data = await import(new URL('src/data/promo-videos.ts', root).href)
const { GBP_SEO_POSTS } = await import(new URL('src/data/gbp-seo-posts.ts', root).href)
const promo = await import(new URL('src/lib/marketing/promo-video.ts', root).href)
const { findViolations } = await import(new URL('src/lib/marketing/compliance.ts', root).href)
const { KV_PREFIXES } = await import(new URL('src/lib/marketing/kv-store-server.ts', root).href)
const { CHANNEL_LABELS, VIDEO_CHANNELS } = await import(new URL('src/lib/marketing/types.ts', root).href)
const { DEFAULT_AUTOPILOT_SETTINGS } = await import(new URL('src/lib/marketing/autopilot-types.ts', root).href)
const { PROMO_VIDEOS, PROMO_VIDEO_TEXTS, PROMO_LIMITS, promoTextWidth, promoScenes, youtubeTitle, youtubeDescription, tiktokCaption, promoTags } = data

let passed = 0
async function test(name, fn) {
  await fn()
  passed += 1
  console.log(`  ✓ ${name}`)
}

await test('18テーマすべてに動画の文があり、Google検索向けの投稿と同じ順', () => {
  assert.equal(PROMO_VIDEOS.length, GBP_SEO_POSTS.length)
  assert.deepEqual(PROMO_VIDEO_TEXTS.map((t) => t.id), GBP_SEO_POSTS.map((p) => p.id))
})

await test('1行の長さ（画面からはみ出さない）：こんなときに15文字・当院では17文字・見出し12.5文字×2行・小見出し22文字×2行まで（全角で数えて）', () => {
  for (const v of PROMO_VIDEOS) {
    // 長さは全角で数える（半角の英数字は0.6）
    const w = promoTextWidth
    for (const line of v.worry) assert.ok(line.length > 0 && w(line) <= PROMO_LIMITS.worry, `${v.id} worry「${line}」${w(line)}`)
    for (const line of v.points) assert.ok(line.length > 0 && w(line) <= PROMO_LIMITS.point, `${v.id} point「${line}」${w(line)}`)
    assert.ok(v.headline.length >= 1 && v.headline.length <= 2, `${v.id} の見出しは1〜2行`)
    for (const line of v.headline) assert.ok(w(line) <= PROMO_LIMITS.headline, `${v.id} headline「${line}」${w(line)}`)
    const subs = promoScenes(v)[0].subtitleLines
    assert.ok(subs.length <= 2, `${v.id} の小見出しは2行まで`)
    for (const line of subs) assert.ok(w(line) <= PROMO_LIMITS.subtitle, `${v.id} subtitle「${line}」${w(line)}`)
    // 2行に分けた小見出しは、つなぐと元の小見出しと同じ
    if (v.subLines) assert.equal(v.subLines.join(''), v.post.subtitle, v.id)
    assert.ok(v.tags.length >= 2 && v.tags.length <= 3, `${v.id} tags`)
  }
})

await test('表現チェック：動画の文字・題名・説明に NG も 注意 も無い（治る・No.1・必ず など）', () => {
  for (const v of PROMO_VIDEOS) {
    const scenes = promoScenes(v)
    const onScreen = scenes.flatMap((s) => [...(s.titleLines ?? []), ...(s.subtitleLines ?? []), s.label, ...(s.lines ?? []), ...(s.chips ?? []), s.name, s.address, s.search]).filter(Boolean)
    const all = [...onScreen, youtubeTitle(v), youtubeDescription(v, 'https://example.com/r'), tiktokCaption(v)].join('\n')
    assert.deepEqual(findViolations(all).map((f) => `${f.level}:${f.match}`), [], v.id)
    assert.ok(!/専門|最新|最先端|日本一|地域一|No\.?1|治ります|完治|保証|改善します|必ず|絶対/.test(all), `${v.id} に強すぎる言葉`)
  }
})

await test('場面は5つ（つかみ→こんなときに→当院では→強み→ご予約）。写真のファイルがあり、3〜5場面めは前と同じ写真にしない', () => {
  for (const v of PROMO_VIDEOS) {
    const scenes = promoScenes(v)
    assert.deepEqual(scenes.map((s) => s.kind), ['hook', 'worry', 'points', 'strengths', 'cta'])
    for (const s of scenes) assert.ok(fs.existsSync(new URL(`assets/gbp-photos/${s.photo}.jpg`, root)), `${v.id} の写真 ${s.photo}`)
    for (let i = 2; i < scenes.length; i++) assert.notEqual(scenes[i].photo, scenes[i - 1].photo, `${v.id} 場面${i + 1}`)
    assert.deepEqual(scenes[0].titleLines, v.headline)
    assert.equal(scenes[2].lines.length, 3)
    assert.equal(scenes[3].chips.length, 4)
  }
})

await test('題名・説明：YouTube は100文字までの題名・予約の計測リンク・#Shorts、TikTok は短くリンクなし', () => {
  for (const v of PROMO_VIDEOS) {
    const c = promo.promoContent(v, 'youtube_short', 'pv20261116-1')
    assert.ok(c.title.length <= 100 && c.title.includes('下関市彦島') && c.title.includes('ゆうき整骨院'), v.id)
    assert.ok(c.body.length <= 4900, `${v.id} 説明 ${c.body.length}`)
    assert.match(c.body, /source=youtube&campaign=pv20261116-1/)
    assert.match(c.body, /#下関 #彦島 #整骨院 #ゆうき整骨院/)
    assert.match(c.body, /#Shorts/)
    assert.ok(!/[<>]/.test(c.title + c.body), `${v.id} に < > が入っている`)
    assert.equal(c.promoVideoId, v.id)
    assert.deepEqual(c.hashtags, [])
    const t = promo.promoContent(v, 'tiktok', 'pv20261116-1')
    assert.ok(t.body.length <= 400, `${v.id} TikTokの説明 ${t.body.length}`)
    assert.ok(!/https?:\/\//.test(t.body), `${v.id} TikTokの説明にリンク`)
    assert.match(t.body, /「ゆうき整骨院 下関」で検索/)
    assert.ok(!/[？！]、|[？！]。|。。/.test(t.body), `${v.id} TikTokの説明の句読点`)
    assert.match(t.cta.url, /source=tiktok/)
    assert.equal(new Set(promoTags(v)).size, promoTags(v).length)
  }
})

await test('予定：週1は水曜13:30、週2は土曜16:00も。年末年始（12/29〜1/3）は出さない', () => {
  assert.deepEqual(promo.promoSlotsForWeek('2026-11-16', 1), ['2026-11-18T13:30'])
  assert.deepEqual(promo.promoSlotsForWeek('2026-11-16', 2), ['2026-11-18T13:30', '2026-11-21T16:00'])
  assert.deepEqual(promo.promoSlotsForWeek('2026-11-16', 9), ['2026-11-18T13:30', '2026-11-21T16:00'])
  // 2026-12-28 の週：水曜 12/30・土曜 1/2 はどちらも年末年始
  assert.deepEqual(promo.promoSlotsForWeek('2026-12-28', 2), [])
  assert.deepEqual(promo.promoSlotsForWeek('2027-01-04', 2), ['2027-01-06T13:30', '2027-01-09T16:00'])
})

await test('出す順：一覧の上から。前回の続きから、最後まで行ったら最初に戻る', () => {
  assert.deepEqual(promo.pickPromoVideos([], 2).map((v) => v.id), ['ankle-sprain', 'acl'])
  assert.deepEqual(promo.pickPromoVideos(['ankle-sprain', 'acl'], 1).map((v) => v.id), ['meniscus'])
  assert.deepEqual(promo.pickPromoVideos(['plantar'], 2).map((v) => v.id), ['ankle-sprain', 'acl'])
  assert.deepEqual(promo.pickPromoVideos(['acl', '消した動画'], 1).map((v) => v.id), ['meniscus'])
  assert.deepEqual(promo.pickPromoVideos([], 0), [])
})

await test('ジョブの目印・計測名・まとめ方', () => {
  assert.equal(promo.promoCampaign('2026-11-16', 1), 'pv20261116-1')
  const key = promo.promoJobKey('2026-11-16', 1, 'tiktok')
  assert.equal(key, 'promo:2026-11-16:1:tiktok')
  assert.ok(promo.isPromoJobKey(key))
  assert.ok(!promo.isPromoJobKey('gbpseo:2026-11-16:1'))
  assert.equal(promo.promoGroupKey(key), '2026-11-16:1')
  assert.equal(promo.promoGroupKey(promo.promoJobKey('2026-11-16', 1, 'youtube_short')), '2026-11-16:1')
  assert.equal(promo.promoGroupKey('autopilot:2026-11-16:x:google_business'), null)
})

await test('設定の初めの値：YouTube・TikTok はオン・週1本・YouTubeの審査はまだ（オフ）。KV の頭文字・媒体の名前', () => {
  assert.equal(DEFAULT_AUTOPILOT_SETTINGS.youtubeShorts, true)
  assert.equal(DEFAULT_AUTOPILOT_SETTINGS.tiktokVideo, true)
  assert.equal(DEFAULT_AUTOPILOT_SETTINGS.promoVideoPerWeek, 1)
  assert.equal(DEFAULT_AUTOPILOT_SETTINGS.youtubeAudited, false)
  // LINEの連絡先の一覧に、KV の行がまぎれこまないように
  assert.ok(KV_PREFIXES.includes('promo:') && KV_PREFIXES.includes('yt:'))
  assert.equal(CHANNEL_LABELS.youtube_short, 'YouTubeショート')
  assert.equal(CHANNEL_LABELS.tiktok, 'TikTok')
  assert.deepEqual(VIDEO_CHANNELS, ['youtube_short', 'tiktok'])
})

await test('YouTube へ送る情報：公開・子ども向けではない・題名は100文字まで。送り方は「受付→本体」の2回', async () => {
  const yt = await import(new URL('src/lib/marketing/youtube-server.ts', root).href)
  const res = yt.youtubeVideoResource({ title: 'あ'.repeat(120), description: '説明<b>', tags: Array.from({ length: 20 }, (_, i) => `t${i}`) })
  assert.equal(res.snippet.title.length, 100)
  assert.equal(res.snippet.description, '説明b')
  assert.equal(res.snippet.tags.length, 15)
  assert.deepEqual(res.status, { privacyStatus: 'public', selfDeclaredMadeForKids: false, containsSyntheticMedia: false, embeddable: true })

  const calls = []
  const realFetch = globalThis.fetch
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), init })
    if (calls.length === 1) return new Response('', { status: 200, headers: { location: 'https://upload.example/session-1' } })
    return new Response(JSON.stringify({ id: 'abc123', status: { privacyStatus: 'public' } }), { status: 201, headers: { 'content-type': 'application/json' } })
  }
  try {
    const bytes = new Uint8Array([1, 2, 3, 4])
    const out = await yt.uploadYoutubeVideo('token-x', { title: '題名', description: '説明', tags: ['下関'], bytes })
    assert.deepEqual(out, { id: 'abc123', url: 'https://www.youtube.com/shorts/abc123', privacyStatus: 'public' })
    assert.equal(calls.length, 2)
    assert.match(calls[0].url, /upload\/youtube\/v3\/videos\?uploadType=resumable&part=snippet,status$/)
    assert.equal(calls[0].init.method, 'POST')
    assert.equal(calls[0].init.headers.Authorization, 'Bearer token-x')
    assert.equal(calls[0].init.headers['X-Upload-Content-Type'], 'video/mp4')
    assert.equal(calls[0].init.headers['X-Upload-Content-Length'], '4')
    assert.equal(JSON.parse(calls[0].init.body).snippet.title, '題名')
    assert.equal(calls[1].url, 'https://upload.example/session-1')
    assert.equal(calls[1].init.method, 'PUT')
    assert.equal(calls[1].init.body, bytes)
    // 許可の期限切れは、やり直しても直らないので「接続が切れています」として返す
    globalThis.fetch = async () => new Response('{}', { status: 401 })
    await assert.rejects(() => yt.uploadYoutubeVideo('token-x', { title: 't', description: 'd', tags: [], bytes }), yt.YoutubeAuthError)
    // YouTube Data API が有効になっていないとき
    globalThis.fetch = async () => new Response(JSON.stringify({ error: { message: 'x', errors: [{ reason: 'accessNotConfigured' }] } }), { status: 403 })
    await assert.rejects(() => yt.uploadYoutubeVideo('token-x', { title: 't', description: 'd', tags: [], bytes }), /YouTube Data API v3/)
  } finally {
    globalThis.fetch = realFetch
  }
  assert.deepEqual(yt.YOUTUBE_SCOPES, ['https://www.googleapis.com/auth/youtube.upload', 'https://www.googleapis.com/auth/youtube.readonly'])
  const u = new URL(yt.youtubeAuthorizeUrl('cid', 'https://yuuki-rehab.vercel.app/api/marketing/google/callback', 'yt.state'))
  assert.equal(u.searchParams.get('state'), 'yt.state')
  assert.equal(u.searchParams.get('access_type'), 'offline')
  assert.equal(u.searchParams.get('redirect_uri'), 'https://yuuki-rehab.vercel.app/api/marketing/google/callback')
})

await test('投稿：YouTube は「連携」と「審査に通った」の両方がそろうまで送らない（手動）。そろえば公開。TikTok は手動。LINE に動画と文を届ける', async () => {
  const os = await import('node:os')
  const path = await import('node:path')
  // KV（手元ではファイル）を、このテストだけの場所に置く
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'promo-test-'))
  const cwd = process.cwd()
  process.chdir(dir)
  const realFetch = globalThis.fetch
  const saved = { ...process.env }
  try {
    process.env.GBP_CLIENT_ID = 'cid'
    process.env.GBP_CLIENT_SECRET = 'secret'
    delete process.env.MARKETING_MODE
    delete process.env.BLOB_READ_WRITE_TOKEN
    const { kvSet } = await import(new URL('src/lib/marketing/kv-store-server.ts', root).href)
    const server = await import(new URL('src/lib/marketing/promo-video-server.ts', root).href)
    const { publishToChannel } = await import(new URL('src/lib/marketing/publishers.ts', root).href)
    const v = PROMO_VIDEOS[0]
    // 作りおきの動画がある状態（Blob に置いたもの）
    const stored = { id: v.id, hash: await server.promoVideoHash(v.id), url: 'https://blob.example/promo/a.mp4', posterUrl: 'https://blob.example/promo/a.jpg', seconds: 16, bytes: 4, createdAt: '2026-11-11T00:00:00Z' }
    await kvSet(`promo:video:${v.id}`, stored)
    assert.deepEqual(await server.getStoredPromoVideo(v.id), stored)
    // 文面が変わる（指紋がちがう）と、作りおきは使わない
    await kvSet(`promo:video:${PROMO_VIDEOS[1].id}`, { ...stored, id: PROMO_VIDEOS[1].id, hash: 'old' })
    assert.equal(await server.getStoredPromoVideo(PROMO_VIDEOS[1].id), null)

    const calls = []
    globalThis.fetch = async (url, init) => {
      const u = String(url)
      calls.push(u)
      if (u.startsWith('https://oauth2.googleapis.com/token')) return new Response(JSON.stringify({ access_token: 'at' }), { status: 200 })
      if (u.startsWith('https://blob.example/')) return new Response(new Uint8Array([1, 2, 3, 4]), { status: 200 })
      if (u.includes('/upload/youtube/v3/videos')) return new Response('', { status: 200, headers: { location: 'https://upload.example/s' } })
      if (u === 'https://upload.example/s') return new Response(JSON.stringify({ id: 'vid1', status: { privacyStatus: 'public' } }), { status: 201 })
      if (u.startsWith('https://api.line.me/')) return new Response('{}', { status: 200 })
      throw new Error(`思っていない送り先: ${u} ${init?.method ?? ''}`)
    }
    const yt = promo.promoContent(v, 'youtube_short', 'pv20261116-1')
    const tt = promo.promoContent(v, 'tiktok', 'pv20261116-1')

    // 1) まだつないでいない → 手動。どこにも送らない
    let out = await publishToChannel('youtube_short', yt)
    assert.equal(out.kind, 'action_required')
    assert.equal(out.manualUrl, stored.url)
    assert.match(out.reason, /連携がまだ/)
    assert.deepEqual(calls, [])

    // 2) つないだが、審査はまだ → 手動。YouTube には送らない（非公開に固定されるのを防ぐ）
    await kvSet('yt:oauth', { refreshToken: 'rt', channelId: 'UC1', channelTitle: 'ゆうき整骨院', connectedAt: '2026-11-11T00:00:00Z' })
    out = await publishToChannel('youtube_short', yt)
    assert.equal(out.kind, 'action_required')
    assert.match(out.reason, /審査/)
    assert.deepEqual(calls, [])

    // 3) 審査に通った → 自動で公開（トークン → 動画を読む → 受付 → 本体）
    await kvSet('autopilot:settings', { youtubeAudited: true })
    out = await publishToChannel('youtube_short', yt)
    assert.deepEqual(out, { kind: 'published', url: 'https://www.youtube.com/shorts/vid1', message: 'YouTubeにショート動画を公開しました' })
    assert.deepEqual(calls.map((u) => new URL(u).host), ['oauth2.googleapis.com', 'blob.example', 'www.googleapis.com', 'upload.example'])

    // 4) TikTok は手動（どこにも送らない）
    calls.length = 0
    out = await publishToChannel('tiktok', tt)
    assert.equal(out.kind, 'action_required')
    assert.equal(out.manualUrl, stored.url)
    assert.deepEqual(calls, [])

    // 5) 動画が決まっていないジョブはエラー
    assert.equal((await publishToChannel('tiktok', { ...tt, promoVideoId: undefined })).kind, 'error')

    // 6) 手動のお知らせ：同じ動画の YouTube・TikTok を1通に。動画そのもの・貼る文・「投稿した」ボタン
    process.env.LINE_CHANNEL_ACCESS_TOKEN = 'line-token'
    process.env.RESERVATION_NOTIFY_LINE_USER_ID = 'Uowner'
    const pushed = []
    const lineFetch = globalThis.fetch
    globalThis.fetch = async (url, init) => {
      if (String(url).startsWith('https://api.line.me/')) pushed.push(JSON.parse(init.body))
      return lineFetch(url, init)
    }
    const { nudgeManualPosts } = await import(new URL('src/lib/marketing/autopilot-server.ts', root).href)
    const job = (channel, id, content) => ({ id, idempotencyKey: promo.promoJobKey('2026-11-16', 1, channel), projectId: 'promo:2026-11-16', variantId: 'x', channel, theme: `動画：${v.post.title}`, content, scheduledAt: '2026-11-18T13:30', status: 'action_required', attempts: [], maxAttempts: 5, manualUrl: stored.url, createdAt: '', updatedAt: '' })
    assert.equal(await nudgeManualPosts([job('youtube_short', 'job-yt', yt), job('tiktok', 'job-tt', tt)]), 1)
    assert.equal(pushed.length, 1)
    const msgs = pushed[0].messages
    assert.equal(pushed[0].to, 'Uowner')
    assert.deepEqual(msgs.map((m) => m.type), ['text', 'video', 'text', 'text', 'flex'])
    assert.match(msgs[0].text, /動画の投稿の時間です（11\/18\(水\) 13:30）/)
    assert.deepEqual(msgs[1], { type: 'video', originalContentUrl: stored.url, previewImageUrl: stored.posterUrl })
    assert.match(msgs[2].text, /【YouTube 題名】\n足首の捻挫のリハビリ｜下関市彦島 ゆうき整骨院/)
    assert.match(msgs[3].text, /【TikTok 説明】/)
    const buttons = msgs[4].contents.footer.contents.map((b) => b.action.data ?? b.action.uri)
    assert.deepEqual(buttons, ['ap:done:job-yt', 'ap:done:job-tt', stored.url, 'https://yuuki-rehab.vercel.app/marketing/autopilot?open=settings'])
    // TikTok だけ（YouTube は自動で出た）のときは、TikTok の分だけ
    pushed.length = 0
    await nudgeManualPosts([job('tiktok', 'job-tt', tt)])
    assert.deepEqual(pushed[0].messages.map((m) => m.type), ['text', 'video', 'text', 'flex'])
    assert.ok(!/YouTube：/.test(pushed[0].messages[0].text))
  } finally {
    globalThis.fetch = realFetch
    for (const k of Object.keys(process.env)) if (!(k in saved)) delete process.env[k]
    Object.assign(process.env, saved)
    process.chdir(cwd)
    fs.rmSync(dir, { recursive: true, force: true })
  }
})

console.log(`\n${passed} 件 OK`)
