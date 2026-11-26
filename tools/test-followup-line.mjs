// ご来院が空いている方へのご連絡（公式LINE。院長が選んで承認した方にだけ）
// 2026-11-26 院長「一定期間ご来院のない患者様にも連絡がいくように（これは事前に私に誰に送るか出して承認したものだけ）」
// 実行: npx tsx tools/test-followup-line.mjs
// 外には送らない（fetch を差しかえて LINE・予約システムの返事をまねる）。KV は一時フォルダのファイル。データはすべて架空
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createHmac } from 'node:crypto'
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
const read = (p) => fs.readFileSync(new URL(p, root), 'utf8')

let passed = 0
async function test(name, fn) {
  await fn()
  passed += 1
  console.log(`  ✓ ${name}`)
}

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'followup-'))
const cwd = process.cwd()
process.chdir(dir)
const realFetch = globalThis.fetch
const saved = { ...process.env }
for (const k of Object.keys(process.env)) if (/^(SUPABASE|NEXT_PUBLIC_SUPABASE|LINE_API_BASE_URL|MARKETING_)/.test(k)) delete process.env[k]
process.env.LINE_CHANNEL_ACCESS_TOKEN = 'line-token'
process.env.RESERVATION_NOTIFY_SECRET = 'notify-secret'
process.env.RESERVATION_NOTIFY_LINE_USER_ID = 'U00000000000000000000000000000000'

const U = (c) => `U${c.repeat(32)}`
const OWNER = 'U00000000000000000000000000000000'

const pushes = []
let upcomingRows = []
let upcomingDown = false
let lineFails = false
globalThis.fetch = async (url, init) => {
  const u = String(url)
  if (u === 'https://api.line.me/v2/bot/message/push') {
    const body = JSON.parse(init.body)
    if (lineFails) return new Response('{"message":"boom"}', { status: 500 })
    pushes.push({ to: body.to, text: body.messages[0].text })
    return new Response('{}', { status: 200 })
  }
  if (u.includes('api=upcoming')) {
    if (upcomingDown) return new Response('oops', { status: 500 })
    const q = new URL(u).searchParams
    const ok = q.get('sig') === createHmac('sha256', 'notify-secret').update(`upcoming:${q.get('ts')}`).digest('hex')
    return new Response(JSON.stringify(ok ? { ok: true, today: '2030-03-10', now: '11:00', until: '2030-06-08', rows: upcomingRows } : { ok: false }), { status: 200 })
  }
  throw new Error(`外への通信はしない: ${u}`)
}

try {
  const { kvGet, kvSet } = await imp('src/lib/marketing/kv-store-server.ts')
  const { saveLineLink } = await imp('src/lib/line-link-server.ts')
  const { sealUserId } = await imp('src/lib/liff-ticket.ts')
  const { applyConsent } = await imp('src/lib/marketing/consent-store-server.ts')
  const F = await imp('src/lib/followup-line.ts')
  const S = await imp('src/lib/marketing/followup-line-server.ts')

  const TODAY = '2030-03-10'
  const NOW = new Date('2030-03-10T02:00:00Z') // 日本時間 3/10 11:00

  console.log('文')
  await test('初めの文：お名前・ご様子うかがい。最後に、予約の入口・お電話・止め方（配信停止）がいつも付く', () => {
    assert.equal(F.followupTemplateProblem(F.DEFAULT_FOLLOWUP_TEMPLATE), null)
    const text = F.followupText(F.DEFAULT_FOLLOWUP_TEMPLATE, '山田 花子')
    assert.match(text, /^山田 花子 様\n\nゆうき整骨院です。\nその後、お身体の具合はいかがでしょうか。/)
    assert.match(text, /ご予約は、こちらから（24時間）\nhttps:\/\/liff\.line\.me\/[\w-]+\nお電話（083-265-4545）でも承ります。/)
    assert.match(text, /※このようなご連絡が不要な方は「配信停止」と送ってください。$/)
    // 症状・施術・効果の言葉は入れない
    assert.ok(!/治|改善|痛み|施術|キャンペーン|割引|無料/.test(text))
  })
  await test('書きかえた文の確かめ：空・長すぎ・{name} が無い・リンク・効果を約束する言い方は通さない', () => {
    assert.match(F.followupTemplateProblem(''), /文を入れてください/)
    assert.match(F.followupTemplateProblem(`{name} 様${'あ'.repeat(400)}`), /400文字まで/)
    assert.match(F.followupTemplateProblem('お元気ですか'), /\{name\}/)
    assert.match(F.followupTemplateProblem('{name} 様 https://example.com'), /リンクは入れられません/)
    assert.match(F.followupTemplateProblem('{name} 様 必ず治ります'), /使えない言い方/)
    assert.match(F.followupTemplateProblem('{name} 様 地域No.1の整骨院です'), /使えない言い方/)
    assert.match(F.followupTemplateProblem('{name} 様 痛みが消えます'), /使えない言い方/)
    assert.equal(F.followupTemplateProblem('{name} 様\nお変わりありませんか。'), null)
  })
  await test('お名前に入った改行などは取る（文のなりすまし防止）', () => {
    assert.match(F.followupText('{name} 様', '山田\n花子\u0007'), /^山田 花子 様\n/)
  })

  console.log('一覧（画面で作る）')
  await test('最後に来た日：カルテの記録に、予約の表の過去の分（キャンセル以外）と、来院予定の「来院した」を足す', () => {
    const people = [
      { id: 'a', name: '山田 花子', phone: '090-1111-2222', lastVisit: '2030-01-05' },
      { id: 'b', name: '鈴木 次郎', phone: '', lastVisit: '2030-01-20' },
      { id: 'c', name: '佐藤 三郎', phone: '090-3333-4444', lastVisit: null },
    ]
    const past = [
      { date: '2030-02-20', name: '山田花子', phone: '09011112222', status: '来院済み' },
      { date: '2030-03-01', name: '山田花子', phone: '09011112222', status: 'キャンセル' },
      { date: '2030-02-25', name: '山田 花子', phone: '080-9999-0000', status: '確定' }, // 同じお名前でも電話がちがう＝別の方
      { date: '2030-02-10', name: '鈴木次郎', phone: '070-1234-5678', status: '確定' }, // カルテに電話が無い方はお名前で
      { date: '2030-03-20', name: '佐藤三郎', phone: '09033334444', status: '確定' }, // 先の日は見ない
    ]
    const last = F.latestVisitDates(people, past, [{ patientId: 'c', date: '2030-02-01' }], TODAY)
    assert.equal(last.get('a'), '2030-02-20')
    assert.equal(last.get('b'), '2030-02-10')
    assert.equal(last.get('c'), '2030-02-01')
  })
  await test('一覧：えらんだ日数より空いていて、1年までの方。空いて間もない順', () => {
    const people = [
      { id: 'a', name: 'あ', phone: '', visits: 3 },
      { id: 'b', name: 'い', phone: '', visits: 5 },
      { id: 'c', name: 'う', phone: '', visits: 1 },
      { id: 'd', name: 'え', phone: '', visits: 9 },
      { id: 'e', name: 'お', phone: '', visits: 2 },
    ]
    const last = new Map([['a', '2030-02-08'], ['b', '2030-01-01'], ['c', '2030-03-01'], ['d', '2029-01-01']])
    const list = F.followupCandidates(people, last, TODAY, 30)
    assert.deepEqual(list.map((c) => [c.patientId, c.days]), [['a', 30], ['b', 68]])
    assert.deepEqual(F.followupCandidates(people, last, TODAY, 60).map((c) => c.patientId), ['b'])
    assert.deepEqual(F.followupCandidates(people, last, TODAY, 14).map((c) => c.patientId), ['a', 'b'])
    assert.equal(F.FOLLOWUP_DEFAULT_DAYS, 30)
    assert.ok(F.FOLLOWUP_PERIODS.some((p) => p.days === F.FOLLOWUP_DEFAULT_DAYS))
  })
  await test('同じ方へは、60日あける', () => {
    assert.equal(F.canSendAgain(undefined, TODAY), true)
    assert.equal(F.canSendAgain('2030-02-01', TODAY), false)
    assert.equal(F.canSendAgain('2030-01-09', TODAY), true)
  })

  // 架空のカルテと LINE 連携
  const kartes = [
    { id: 'p1', name: '山田 花子', phone: '090-1111-2222' }, // 送れる方
    { id: 'p2', name: '鈴木 次郎', phone: '090-2222-3333' }, // LINE 連携なし
    { id: 'p3', name: '佐藤 三郎', phone: '090-3333-4444' }, // 配信停止
    { id: 'p4', name: '高橋 四郎', phone: '090-4444-5555' }, // これからの予約あり
    { id: 'p5', name: '伊藤 五郎', phone: '090-5555-6666' }, // 来院予定あり
    { id: 'p6', name: '渡辺 六郎', phone: '090-6666-7777' }, // 送れる方
    { id: 'p7', name: '山田 一郎', phone: '090-1111-2222' }, // 山田花子さんと同じ LINE（ご家族）
  ]
  const link = (id, name, user) => saveLineLink({ key: `karte:${id}`, name, phone: '', patientId: id, sealed: sealUserId(user, 'notify-secret'), linkedAt: '2030-01-01T00:00:00Z', via: 'qr' })
  await link('p1', '山田 花子', U('a'))
  await link('p3', '佐藤 三郎', U('c'))
  await link('p4', '高橋 四郎', U('d'))
  await link('p5', '伊藤 五郎', U('e'))
  await link('p6', '渡辺 六郎', U('f'))
  await link('p7', '山田 一郎', U('a'))
  await applyConsent(U('c'), { purpose: 'marketing', allow: false })
  const setCloud = (plans = []) => kvSet('sync:clinic', { payload: { pt_patients: JSON.stringify(kartes), pt_visit_plans: JSON.stringify(plans) }, updatedAt: new Date().toISOString() })
  await setCloud([{ id: 'plan-000001', date: '2030-03-15', patientId: 'p5', name: '伊藤 五郎', status: 'planned' }])
  upcomingRows = [{ no: 'R1', date: '2030-03-12', time: '10:00', name: '高橋四郎', phone: '09044445555', lineKey: '' }]
  const person = (id) => ({ patientId: id, name: kartes.find((k) => k.id === id).name })
  const all = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6'].map(person)

  console.log('送ってよいかの確かめ（送らない）')
  await test('1人ずつ確かめる：LINE 連携なし・配信停止・これからの予約・来院予定の方は送れない。理由を返す（お名前・宛先は返さない）', async () => {
    const checks = await S.checkFollowupPeople(all, NOW)
    assert.deepEqual(
      checks.map((c) => [c.patientId, c.sendable, c.block ?? '', c.detail ?? '']),
      [
        ['p1', true, '', ''],
        ['p2', false, 'not_linked', ''],
        ['p3', false, 'opted_out', ''],
        ['p4', false, 'has_reservation', '2030-03-12'],
        ['p5', false, 'has_plan', '2030-03-15'],
        ['p6', true, '', ''],
      ],
    )
    const raw = JSON.stringify(checks)
    assert.ok(!/山田|鈴木|Uaaaa|userId|linkName|sealed/.test(raw))
    assert.equal(pushes.length, 0, '確かめるだけでは送らない')
  })
  await test('クラウドのカルテに無い・お名前がちがうときは送れない（ちがう方へ送らない）', async () => {
    const checks = await S.checkFollowupPeople([{ patientId: 'p-none', name: '山田 花子' }, { patientId: 'p1', name: '鈴木 次郎' }], NOW)
    assert.deepEqual(checks.map((c) => c.block), ['karte_missing', 'karte_missing'])
  })
  await test('予約システムから予約を取れないときは、送れない（予約のある方へ送ってしまわないため）', async () => {
    upcomingDown = true
    const checks = await S.checkFollowupPeople([person('p1')], NOW)
    assert.deepEqual([checks[0].sendable, checks[0].block], [false, 'reservation_unknown'])
    upcomingDown = false
  })

  console.log('院長が承認した方へ送る')
  await test('見本は院長の LINE にだけ。患者さんには送らない', async () => {
    const r = await S.sendFollowupSample(F.DEFAULT_FOLLOWUP_TEMPLATE)
    assert.equal(r.ok, true)
    assert.equal(pushes.length, 1)
    assert.equal(pushes[0].to, OWNER)
    assert.match(pushes[0].text, /^【見本】患者さんには送っていません。\n\n山田 太郎 様/)
    assert.equal((await S.sendFollowupSample('必ず治ります {name}')).ok, false)
    assert.equal(pushes.length, 1)
  })
  await test('選んだ方のうち、送ってよい方にだけ送る（送る直前にもう一度確かめる）。連携のお名前で届く', async () => {
    const before = pushes.length
    const r = await S.sendFollowups(all, F.DEFAULT_FOLLOWUP_TEMPLATE, NOW)
    assert.deepEqual([r.sent, r.skipped, r.failed], [2, 4, 0])
    const sent = pushes.slice(before)
    assert.deepEqual(sent.map((p) => p.to), [U('a'), U('f')])
    assert.match(sent[0].text, /^山田 花子 様\n/)
    assert.match(sent[1].text, /^渡辺 六郎 様\n/)
    assert.match(sent[0].text, /配信停止/)
    assert.deepEqual(r.results.filter((x) => !x.ok).map((x) => [x.patientId, x.block]), [['p2', 'not_linked'], ['p3', 'opted_out'], ['p4', 'has_reservation'], ['p5', 'has_plan']])
    assert.ok(!/Uaaaa|Uffff|userId|linkName/.test(JSON.stringify(r)))
  })
  await test('選んでいない方には送らない（一覧にいても）', async () => {
    assert.ok(!pushes.some((p) => [U('c'), U('d'), U('e')].includes(p.to)))
  })
  await test('送った方は記録に残り、60日のうちはもう送らない', async () => {
    const log = await kvGet('keiei:followup-log')
    assert.deepEqual(log.sent.p1, [TODAY])
    assert.deepEqual(log.recent.map((x) => [x.name, x.ok]).sort(), [['山田 花子', true], ['渡辺 六郎', true]])
    assert.ok(!JSON.stringify(log).includes('Uaaaa'), '記録に LINE の宛先を残さない')
    const again = await S.checkFollowupPeople([person('p1')], NOW)
    assert.deepEqual([again[0].sendable, again[0].block, again[0].detail], [false, 'recently_sent', TODAY])
    const before = pushes.length
    const r = await S.sendFollowups([person('p1')], F.DEFAULT_FOLLOWUP_TEMPLATE, NOW)
    assert.deepEqual([r.sent, r.skipped], [0, 1])
    assert.equal(pushes.length, before)
    // 61日後は送れる
    const later = await S.checkFollowupPeople([person('p1')], new Date(NOW.getTime() + 61 * 86400e3))
    assert.equal(later[0].sendable, true)
  })
  await test('同じ LINE（ご家族で1つの LINE）へは、1回の承認で1通だけ', async () => {
    await kvSet('keiei:followup-log', { sent: {}, recent: [] })
    const before = pushes.length
    const r = await S.sendFollowups([person('p1'), person('p7')], F.DEFAULT_FOLLOWUP_TEMPLATE, NOW)
    assert.deepEqual([r.sent, r.skipped], [1, 1])
    assert.equal(pushes.length, before + 1)
  })
  await test('文に問題がある・だれも選んでいない・1回の上限（20人）より多いときは、1通も送らない', async () => {
    const before = pushes.length
    await assert.rejects(() => S.sendFollowups([person('p6')], '{name} 様 絶対に治ります', NOW), /使えない言い方/)
    await assert.rejects(() => S.sendFollowups([], F.DEFAULT_FOLLOWUP_TEMPLATE, NOW), /選ばれていません/)
    const many = Array.from({ length: 21 }, (_, i) => ({ patientId: `x${i}`, name: 'だれか' }))
    await assert.rejects(() => S.sendFollowups(many, F.DEFAULT_FOLLOWUP_TEMPLATE, NOW), /20人まで/)
    assert.equal(pushes.length, before)
  })
  await test('1日の上限（30人）を超えたら送らない', async () => {
    const at = NOW.toISOString()
    await kvSet('keiei:followup-log', { sent: {}, recent: Array.from({ length: 30 }, () => ({ at, name: 'だれか', ok: true })) })
    const before = pushes.length
    const r = await S.sendFollowups([person('p6')], F.DEFAULT_FOLLOWUP_TEMPLATE, NOW)
    assert.deepEqual([r.sent, r.skipped], [0, 1])
    assert.match(r.results[0].error, /30人まで/)
    assert.equal(pushes.length, before)
    await kvSet('keiei:followup-log', { sent: {}, recent: [] })
  })
  await test('LINE が送れなかったときは「送れず」と返し、送った記録にしない（あとで送り直せる）', async () => {
    lineFails = true
    const r = await S.sendFollowups([person('p6')], F.DEFAULT_FOLLOWUP_TEMPLATE, NOW)
    lineFails = false
    assert.deepEqual([r.sent, r.failed], [0, 1])
    assert.equal((await kvGet('keiei:followup-log')).sent.p6, undefined)
    assert.equal((await S.checkFollowupPeople([person('p6')], NOW))[0].sendable, true)
  })

  console.log('しくみ')
  await test('自動では送らない：定期実行（jobs/run）からは呼ばない。送るのは院長だけの API から', () => {
    assert.ok(!/followup/i.test(read('src/app/api/marketing/jobs/run/route.ts')))
    assert.ok(!/followup/i.test(fs.readFileSync(new URL('vercel.json', root), 'utf8')))
    const route = read('src/app/api/marketing/line/followup/route.ts')
    assert.equal((route.match(/requireAdmin\(request\)/g) ?? []).length, 2, 'GET・POST とも院長だけ')
    assert.match(read('src/proxy.ts'), /'\/api\/marketing\/:path\*'/)
  })
  await test('画面：初めはだれも選ばれていない・選んだ方のお名前を出してから「承認して送る」・院長だけ', () => {
    const page = read('src/app/(app)/marketing/line/followup/page.tsx')
    assert.match(page, /useState<Set<string>>\(new Set\(\)\)/)
    assert.match(page, /次の \{chosen\.length\}人の LINE に送ります。よろしいですか？/)
    assert.match(page, /承認して送る（\{chosen\.length\}人）/)
    assert.match(page, /if \(!isAdmin\) return/)
    assert.match(page, /自動では送りません。/)
    assert.ok(read('src/components/clinic/nav.ts').includes("'/marketing/line/followup'"))
  })
} finally {
  globalThis.fetch = realFetch
  for (const k of Object.keys(process.env)) if (!(k in saved)) delete process.env[k]
  Object.assign(process.env, saved)
  process.chdir(cwd)
  fs.rmSync(dir, { recursive: true, force: true })
}

console.log(`\n${passed} 件 OK`)
