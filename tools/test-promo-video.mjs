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
const { PROMO_VIDEOS, PROMO_VIDEO_TEXTS, PROMO_LIMITS, PROMO_SAFE_PHOTOS, PROMO_AI_RULES, PROMO_AI_NOTE, promoAiPrompt, promoUsesAi, promoTextWidth, promoScenes, youtubeTitle, youtubeDescription, tiktokCaption, instagramReelCaption, promoTags } = data

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
    const all = [...onScreen, youtubeTitle(v), youtubeDescription(v, 'https://example.com/r'), tiktokCaption(v), instagramReelCaption(v)].join('\n')
    assert.deepEqual(findViolations(all).map((f) => `${f.level}:${f.match}`), [], v.id)
    assert.ok(!/専門|最新|最先端|日本一|地域一|No\.?1|治ります|完治|保証|改善します|必ず|絶対/.test(all), `${v.id} に強すぎる言葉`)
  }
})

await test('場面は5つ（つかみ→こんなときに→当院では→強み→ご予約）。前半はAIの絵、後半は院の写真', () => {
  let aiScenes = 0
  for (const v of PROMO_VIDEOS) {
    const scenes = promoScenes(v)
    assert.deepEqual(scenes.map((s) => s.kind), ['hook', 'worry', 'points', 'strengths', 'cta'])
    // 後半（当院では・強み・ご予約）は院の写真だけ。3つとも別の写真（ご予約は外観）
    for (const s of scenes.slice(2)) assert.equal(s.ai, undefined, `${v.id} の後半にAIの絵`)
    assert.equal(scenes[4].photo, 'exterior')
    assert.notEqual(scenes[2].photo, scenes[3].photo, `${v.id} 場面3・4`)
    assert.notEqual(scenes[3].photo, scenes[4].photo, `${v.id} 場面4・5`)
    // 前半は、場面の説明があるものだけAIの絵（slot は 1場面め＝a、2場面め＝b）
    assert.equal(Boolean(scenes[0].ai), Boolean(v.ai[0]), v.id)
    assert.equal(Boolean(scenes[1].ai), Boolean(v.ai[1]), v.id)
    if (scenes[0].ai) assert.equal(scenes[0].ai.slot, 'a')
    if (scenes[1].ai) assert.equal(scenes[1].ai.slot, 'b')
    aiScenes += scenes.filter((s) => s.ai).length
    assert.deepEqual(scenes[0].titleLines, v.headline)
    assert.equal(scenes[2].lines.length, 3)
    assert.equal(scenes[3].chips.length, 4)
  }
  // 基本はAI：どの動画にもAIの絵が1枚以上、ほとんどは2枚
  assert.ok(PROMO_VIDEOS.every(promoUsesAi))
  assert.ok(aiScenes >= PROMO_VIDEOS.length * 2 - 2, `AIの絵 ${aiScenes}枚`)
})

await test('院の写真：人物が特定されない写真だけ（足首とエコー・エコーの機械・運動の器具・外観）。代わりの絵も同じ', async () => {
  assert.deepEqual([...PROMO_SAFE_PHOTOS].sort(), ['echo-hero', 'echo-machine', 'exercise-tools', 'exterior'])
  // スタッフ・患者さん・選手・観客が写っている写真は入れない
  for (const banned of ['room-staff', 'act-seminar', 'act-trainer', 'stadium', 'echo-scene', 'treat-foot', 'act-taping']) assert.ok(!PROMO_SAFE_PHOTOS.includes(banned), banned)
  // Google投稿で使ってよい写真（GBP_SAFE_PHOTOS）の中から選んでいる
  const gbp = await import(new URL('src/data/gbp-seo-posts.ts', root).href)
  for (const photo of PROMO_SAFE_PHOTOS) assert.ok(gbp.GBP_SAFE_PHOTOS.includes(photo), photo)
  for (const v of PROMO_VIDEOS) {
    for (const s of promoScenes(v)) {
      assert.ok(PROMO_SAFE_PHOTOS.includes(s.photo), `${v.id} の写真 ${s.photo}`)
      assert.ok(fs.existsSync(new URL(`assets/gbp-photos/${s.photo}.jpg`, root)), `${v.id} の写真 ${s.photo}`)
    }
  }
})

await test('AIの絵の指示：顔・文字・院や施術・ケガの絵を描かせない決まりを足す。場面の説明にも入れない', () => {
  assert.match(PROMO_AI_RULES, /No face may be visible/)
  assert.match(PROMO_AI_RULES, /no text/i)
  assert.match(PROMO_AI_RULES, /Do not show: a clinic, a therapist, treatment/)
  // 画面いっぱいに描かせる（「上は見出し・下はボタン」と伝えると、AIが上下に黒い帯を描いてしまった）
  assert.match(PROMO_AI_RULES, /fill the whole square frame from edge to edge/)
  assert.match(PROMO_AI_RULES, /no letterbox, no black or dark bars/)
  assert.ok(!/title panel|covered by app buttons/.test(PROMO_AI_RULES))
  // 靴や服は無地に（実在のメーカーの印に似た模様を描かせない）
  assert.match(PROMO_AI_RULES, /must be plain and generic/)
  assert.match(PROMO_AI_RULES, /resemble any real sports brand/)
  for (const v of PROMO_VIDEOS) {
    for (const scene of promoScenes(v).filter((s) => s.ai)) {
      const text = scene.ai.scene
      assert.ok(text.length >= 60 && text.length <= 400, `${v.id}・${scene.ai.slot} の長さ ${text.length}`)
      // 院・スタッフ・施術・医療の機械・ケガの見た目・顔・実在の名前を、場面の説明に書かない
      assert.ok(!/clinic|therapist|doctor|nurse|massage|treatment|ultrasound|echo|taping|bandage|cast|crutch|blood|bruise|swell|x-ray|mri|logo|brand|yuuki|shimonoseki|hikoshima/i.test(text), `${v.id}・${scene.ai.slot} に描かせないものがある`)
      assert.ok(!/\bface (is|clearly) visible|smiling|looking at the camera|portrait/i.test(text), `${v.id}・${scene.ai.slot} に顔`)
      // 人が出る場面は、顔が写らない撮り方を書いてある
      if (/person|player|child|student|runner|parent|pitcher|sprinter|athlete/i.test(text)) {
        assert.ok(/from behind|from the (waist|knees|chest|shoulders|neck) down|seen from the back|away from the camera/i.test(text), `${v.id}・${scene.ai.slot} の撮り方`)
      }
      const prompt = promoAiPrompt(scene.ai)
      assert.ok(prompt.startsWith(text) && prompt.endsWith(PROMO_AI_RULES))
    }
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
    // AIの絵を使う動画は、説明に断り書きを入れる
    assert.equal(c.body.includes(PROMO_AI_NOTE), promoUsesAi(v), v.id)
    assert.equal(t.body.includes(PROMO_AI_NOTE), promoUsesAi(v), v.id)
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
  assert.equal(DEFAULT_AUTOPILOT_SETTINGS.instagramReels, true)
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
  // AIで作った絵を含む動画は、YouTube に申告する
  assert.equal(yt.youtubeVideoResource({ title: 't', description: 'd', tags: [], synthetic: true }).status.containsSyntheticMedia, true)

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
    const { kvSet, kvDelete } = await import(new URL('src/lib/marketing/kv-store-server.ts', root).href)
    const server = await import(new URL('src/lib/marketing/promo-video-server.ts', root).href)
    const { publishToChannel } = await import(new URL('src/lib/marketing/publishers.ts', root).href)
    const v = PROMO_VIDEOS[0]
    // 作りおきの動画がある状態（Blob に置いたもの）
    // AIの絵が2枚作ってある状態（場面の説明の指紋が合っているものだけ使う）
    const { fingerprint } = await import(new URL('src/lib/sync-merge.ts', root).href)
    const scenes = promoScenes(v)
    const before = await server.promoVideoHash(v.id)
    for (const sc of scenes.filter((x) => x.ai)) {
      await kvSet(`promo:ai:${v.id}:${sc.ai.slot}`, { url: `https://store.public.blob.vercel-storage.com/marketing/ai-photos/promo-${v.id}-${sc.ai.slot}-x.png`, promptHash: fingerprint(promoAiPrompt(sc.ai)), model: 'gpt-image-2', createdAt: '2026-11-11T00:00:00Z' })
    }
    const withAi = await server.promoVideoHash(v.id)
    assert.notEqual(withAi, before, 'AIの絵ができたら、動画の指紋が変わる（作り直す）')
    // 場面の説明を変えたあとの古い絵は使わない
    await kvSet(`promo:ai:${PROMO_VIDEOS[2].id}:a`, { url: 'https://store.public.blob.vercel-storage.com/marketing/ai-photos/old.png', promptHash: 'old', model: 'm', createdAt: '2026-11-11T00:00:00Z' })
    const plain = await server.promoVideoHash(PROMO_VIDEOS[2].id)
    await kvDelete(`promo:ai:${PROMO_VIDEOS[2].id}:a`)
    assert.equal(await server.promoVideoHash(PROMO_VIDEOS[2].id), plain)

    const stored = { id: v.id, hash: withAi, url: 'https://blob.example/promo/a.mp4', posterUrl: 'https://blob.example/promo/a.jpg', seconds: 16, bytes: 4, createdAt: '2026-11-11T00:00:00Z', aiImages: 2 }
    await kvSet(`promo:video:${v.id}`, stored)
    assert.deepEqual(await server.getStoredPromoVideo(v.id), stored)
    // AIの絵が作れず院の写真で代えた動画は、AIが使える設定なら6時間たったら作り直す（使えない設定ならそのまま使う）
    const third = PROMO_VIDEOS[3]
    const pendingVideo = { ...stored, id: third.id, hash: await server.promoVideoHash(third.id), aiImages: 0, aiPending: true, createdAt: new Date(Date.now() - 7 * 3600 * 1000).toISOString() }
    await kvSet(`promo:video:${third.id}`, pendingVideo)
    assert.deepEqual(await server.getStoredPromoVideo(third.id), pendingVideo)
    process.env.OPENAI_API_KEY = 'sk-test'
    assert.equal(await server.getStoredPromoVideo(third.id), null)
    await kvSet(`promo:video:${third.id}`, { ...pendingVideo, createdAt: new Date().toISOString() })
    assert.ok(await server.getStoredPromoVideo(third.id))
    delete process.env.OPENAI_API_KEY
    // 文面が変わる（指紋がちがう）と、作りおきは使わない
    await kvSet(`promo:video:${PROMO_VIDEOS[1].id}`, { ...stored, id: PROMO_VIDEOS[1].id, hash: 'old' })
    assert.equal(await server.getStoredPromoVideo(PROMO_VIDEOS[1].id), null)

    const calls = []
    const uploadBodies = []
    globalThis.fetch = async (url, init) => {
      const u = String(url)
      calls.push(u)
      if (u.startsWith('https://oauth2.googleapis.com/token')) return new Response(JSON.stringify({ access_token: 'at' }), { status: 200 })
      if (u.startsWith('https://blob.example/')) return new Response(new Uint8Array([1, 2, 3, 4]), { status: 200 })
      if (u.includes('/upload/youtube/v3/videos')) {
        uploadBodies.push(JSON.parse(init.body))
        return new Response('', { status: 200, headers: { location: 'https://upload.example/s' } })
      }
      if (u === 'https://upload.example/s') return new Response(JSON.stringify({ id: 'vid1', status: { privacyStatus: 'public' } }), { status: 201 })
      if (u.startsWith('https://api.line.me/')) return new Response('{}', { status: 200 })
      throw new Error(`思っていない送り先: ${u} ${init?.method ?? ''}`)
    }
    const yt = promo.promoContent(v, 'youtube_short', 'pv20261116-1')
    const tt = promo.promoContent(v, 'tiktok', 'pv20261116-1')

    // 1) まだつないでいない → 手動。どこにも送らない
    const ytKey = promo.promoJobKey('2026-11-16', 1, 'youtube_short')
    let out = await publishToChannel('youtube_short', yt, { jobKey: ytKey })
    assert.equal(out.kind, 'action_required')
    assert.equal(out.manualUrl, stored.url)
    assert.match(out.reason, /自動で出す連携（Buffer）がまだ/)
    assert.deepEqual(calls, [])

    // 2) つないだが、審査はまだ → 手動。YouTube には送らない（非公開に固定されるのを防ぐ）
    await kvSet('yt:oauth', { refreshToken: 'rt', channelId: 'UC1', channelTitle: 'ゆうき整骨院', connectedAt: '2026-11-11T00:00:00Z' })
    out = await publishToChannel('youtube_short', yt, { jobKey: ytKey })
    assert.equal(out.kind, 'action_required')
    assert.deepEqual(calls, [])

    // 3) 審査に通った → 自動で出せるが、院長の承認が要る
    await kvSet('autopilot:settings', { youtubeAudited: true })
    const snap = { url: stored.url, posterUrl: stored.posterUrl, hash: stored.hash, aiImages: 2 }
    // 予定の時刻は、テストを走らせる日の3日後（日本時間）。期限切れにならないように
    const later = new Date(Date.now() + 9 * 3600e3 + 3 * 24 * 3600e3).toISOString().slice(0, 16)
    // 3-a) 予定が分からないジョブ（承認のしようがない）は、自動では出さない
    out = await publishToChannel('youtube_short', yt)
    assert.equal(out.kind, 'action_required')
    assert.deepEqual(calls, [])
    // 3-b) 承認待ち → 待つ（どこにも送らない。やり直しの回数にも数えない）
    await kvSet('promo:week:2026-11-16', { weekStart: '2026-11-16', createdAt: '', items: [{ scheduledAt: later, videoId: v.id, campaign: 'pv20261116-1' }] })
    out = await publishToChannel('youtube_short', yt, { jobKey: ytKey })
    assert.equal(out.kind, 'wait')
    assert.match(out.message, /承認待ち/)
    assert.deepEqual(calls, [])
    // 3-c) 承認済み → 承認した動画を自動で公開（トークン → 動画を読む → 受付 → 本体）
    await kvSet('promo:week:2026-11-16', { weekStart: '2026-11-16', createdAt: '', items: [{ scheduledAt: later, videoId: v.id, campaign: 'pv20261116-1', approval: { status: 'approved', at: '', by: 'テスト', video: snap } }] })
    out = await publishToChannel('youtube_short', yt, { jobKey: ytKey })
    assert.deepEqual(out, { kind: 'published', url: 'https://www.youtube.com/shorts/vid1', message: 'YouTubeにショート動画を公開しました' })
    assert.deepEqual(calls.map((u) => new URL(u).host), ['oauth2.googleapis.com', 'blob.example', 'www.googleapis.com', 'upload.example'])
    // AIの絵を使った動画なので、YouTube に「合成されたコンテンツ」として申告している
    assert.equal(uploadBodies.length, 1)
    assert.equal(uploadBodies[0].status.containsSyntheticMedia, true)
    assert.equal(uploadBodies[0].status.privacyStatus, 'public')

    // 3-d) 見送り → 出さない
    await kvSet('promo:week:2026-11-16', { weekStart: '2026-11-16', createdAt: '', items: [{ scheduledAt: later, videoId: v.id, campaign: 'pv20261116-1', approval: { status: 'skipped', at: '', by: 'テスト' } }] })
    calls.length = 0
    out = await publishToChannel('youtube_short', yt, { jobKey: ytKey })
    assert.equal(out.kind, 'skipped')
    assert.deepEqual(calls, [])
    await kvDelete('promo:week:2026-11-16')

    // 4) TikTok は手動（Buffer につないでいない。どこにも送らない）
    calls.length = 0
    out = await publishToChannel('tiktok', tt, { jobKey: promo.promoJobKey('2026-11-16', 1, 'tiktok') })
    assert.equal(out.kind, 'action_required')
    assert.equal(out.manualUrl, stored.url)
    assert.match(out.reason, /TikTokは自動で出す連携（Buffer）がまだ/)
    assert.deepEqual(calls, [])

    // 4-b) Instagram のリール：連携がまだなら手動。つながっていて承認済みなら、承認した動画をリールとして公開
    const ig = promo.promoContent(v, 'instagram_reel', 'pv20261116-1')
    const igKey = promo.promoJobKey('2026-11-16', 1, 'instagram_reel')
    assert.equal(igKey, 'promo:2026-11-16:1:instagram_reel')
    assert.match(ig.body, /プロフィールのリンクから/)
    assert.match(ig.cta.url, /source=instagram/)
    assert.equal(ig.promoVideoId, v.id)
    const savedIg = { t: process.env.INSTAGRAM_ACCESS_TOKEN, u: process.env.INSTAGRAM_USER_ID }
    delete process.env.INSTAGRAM_ACCESS_TOKEN
    delete process.env.INSTAGRAM_USER_ID
    calls.length = 0
    assert.equal(await server.promoRouteFor('instagram_reel'), 'manual')
    out = await publishToChannel('instagram_reel', ig, { jobKey: igKey })
    assert.equal(out.kind, 'action_required')
    assert.equal(out.manualUrl, stored.url)
    assert.match(out.reason, /Instagramとの連携がまだ/)
    assert.deepEqual(calls, [])
    // 動画の無い（AIの投稿案の）リールは、これまでどおり手で
    out = await publishToChannel('instagram_reel', { ...ig, promoVideoId: undefined })
    assert.equal(out.kind, 'action_required')
    process.env.INSTAGRAM_ACCESS_TOKEN = 'ig-token'
    process.env.INSTAGRAM_USER_ID = '1789'
    assert.equal(await server.promoRouteFor('instagram_reel'), 'instagram_api')
    const igBodies = []
    const baseFetch = globalThis.fetch
    let igStatus = ['IN_PROGRESS', 'FINISHED']
    globalThis.fetch = async (url, init) => {
      const u = String(url)
      if (u.startsWith('https://graph.instagram.com/')) {
        calls.push(u)
        if (u.endsWith('/1789/media')) { igBodies.push(JSON.parse(init.body)); return new Response(JSON.stringify({ id: 'c1' }), { status: 200 }) }
        if (u.includes('/c1?fields=status_code')) return new Response(JSON.stringify({ status_code: igStatus.length > 1 ? igStatus.shift() : igStatus[0], status: 'Error: 2207026' }), { status: 200 })
        if (u.endsWith('/1789/media_publish')) return new Response(JSON.stringify({ id: 'm1' }), { status: 200 })
        if (u.includes('/m1?fields=permalink')) return new Response(JSON.stringify({ permalink: 'https://www.instagram.com/reel/abc/' }), { status: 200 })
      }
      return baseFetch(url, init)
    }
    // 承認待ち → 待つ（Instagram には送らない）
    await kvSet('promo:week:2026-11-16', { weekStart: '2026-11-16', createdAt: '', items: [{ scheduledAt: later, videoId: v.id, campaign: 'pv20261116-1' }] })
    out = await publishToChannel('instagram_reel', ig, { jobKey: igKey })
    assert.equal(out.kind, 'wait')
    assert.deepEqual(calls, [])
    // 承認済み → リールとして公開（フィードにも出す・表紙つき・承認した動画のURL）
    await kvSet('promo:week:2026-11-16', { weekStart: '2026-11-16', createdAt: '', items: [{ scheduledAt: later, videoId: v.id, campaign: 'pv20261116-1', approval: { status: 'approved', at: '', by: 'テスト', video: snap } }] })
    out = await publishToChannel('instagram_reel', ig, { jobKey: igKey })
    assert.deepEqual(out, { kind: 'published', url: 'https://www.instagram.com/reel/abc/', message: 'Instagramにリールを公開しました' })
    assert.equal(igBodies.length, 1)
    assert.equal(igBodies[0].media_type, 'REELS')
    assert.equal(igBodies[0].video_url, snap.url)
    assert.equal(igBodies[0].cover_url, snap.posterUrl)
    assert.equal(igBodies[0].share_to_feed, true)
    assert.equal(igBodies[0].caption, ig.body)
    // Instagram が動画を取り込めなかった → 手で投稿（動画のURLつき）
    igStatus = ['ERROR']
    out = await publishToChannel('instagram_reel', ig, { jobKey: igKey })
    assert.equal(out.kind, 'action_required')
    assert.equal(out.manualUrl, snap.url)
    assert.match(out.reason, /Instagramが動画を受け付けませんでした/)
    await kvDelete('promo:week:2026-11-16')
    globalThis.fetch = baseFetch
    if (savedIg.t === undefined) delete process.env.INSTAGRAM_ACCESS_TOKEN; else process.env.INSTAGRAM_ACCESS_TOKEN = savedIg.t
    if (savedIg.u === undefined) delete process.env.INSTAGRAM_USER_ID; else process.env.INSTAGRAM_USER_ID = savedIg.u
    calls.length = 0

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
    assert.match(msgs[0].text, /前半の絵はAIで作ったイメージです/)
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
