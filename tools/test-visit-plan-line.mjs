// 来院予定（時間を決めない予定）の LINE（2026-11-26 院長「更に時間指定のない予約もlineが入るようにしてください」）
// 実行: npx tsx tools/test-visit-plan-line.mjs
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

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vplan-line-'))
const cwd = process.cwd()
process.chdir(dir)
const realFetch = globalThis.fetch
const saved = { ...process.env }
for (const k of Object.keys(process.env)) if (/^(SUPABASE|NEXT_PUBLIC_SUPABASE|LINE_API_BASE_URL|LINE_RESERVATION_CHECK)/.test(k)) delete process.env[k]
process.env.LINE_CHANNEL_ACCESS_TOKEN = 'line-token'
process.env.RESERVATION_NOTIFY_SECRET = 'notify-secret'
process.env.RESERVATION_NOTIFY_LINE_USER_ID = 'U00000000000000000000000000000000'

// 架空の LINE（形は本物と同じ U＋16進32文字）
const HANAKO = 'Uaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' // カルテの QR で結びついた方
const JIRO = 'Ubbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb' // 電話＋お名前で結びついた方
const OWNER = 'U00000000000000000000000000000000'

const pushes = []
let upcomingRows = []
globalThis.fetch = async (url, init) => {
  const u = String(url)
  if (u === 'https://api.line.me/v2/bot/message/push') {
    const body = JSON.parse(init.body)
    pushes.push({ to: body.to, text: body.messages[0].text })
    return new Response('{}', { status: 200 })
  }
  if (u.includes('api=upcoming')) {
    const q = new URL(u).searchParams
    const ok = q.get('sig') === createHmac('sha256', 'notify-secret').update(`upcoming:${q.get('ts')}`).digest('hex')
    return new Response(JSON.stringify(ok ? { ok: true, today: '2030-01-10', now: '11:00', until: '2030-04-10', rows: upcomingRows } : { ok: false }), { status: 200 })
  }
  throw new Error(`外への通信はしない: ${u}`)
}

try {
  const { kvGet, kvSet } = await imp('src/lib/marketing/kv-store-server.ts')
  const { saveLineLink } = await imp('src/lib/line-link-server.ts')
  const { sealUserId } = await imp('src/lib/liff-ticket.ts')
  const { saveRule } = await imp('src/lib/marketing/automation-store-server.ts')
  const { applyConsent } = await imp('src/lib/marketing/consent-store-server.ts')
  const M = await imp('src/lib/line-link-match.ts')
  const T = await imp('src/lib/visit-plan-message.ts')
  const P = await imp('src/lib/visit-plans.ts')
  const S = await imp('src/lib/marketing/visit-plan-line-server.ts')
  const C = await imp('src/lib/reservation-check.ts')
  const CS = await imp('src/lib/marketing/reservation-check-server.ts')

  const TODAY = '2030-01-10'
  const TOMORROW = '2030-01-11'
  const at = (jstHour) => new Date(Date.parse(`${TODAY}T00:00:00Z`) + (jstHour - 9) * 3600e3)
  const NOW = at(11)

  // 架空のカルテと LINE 連携（山田さん＝カルテの ID で／鈴木さん＝電話＋お名前で／田中さん＝同じお名前が2人／佐藤さん＝連携なし）
  const kartes = [
    { id: 'p-hanako', name: '山田 花子', phone: '', birthDate: '' },
    { id: 'p-jiro', name: '鈴木 次郎', phone: '090-2222-3333' },
    { id: 'p-tanaka1', name: '田中 実', phone: '090-1000-0001' },
    { id: 'p-tanaka2', name: '田中 実', phone: '090-1000-0002' },
    { id: 'p-sato', name: '佐藤 三郎', phone: '090-4444-5555' },
  ]
  await saveLineLink({ key: 'karte:p-hanako', name: '山田 花子', phone: '', patientId: 'p-hanako', sealed: sealUserId(HANAKO, 'notify-secret'), linkedAt: '2030-01-01T00:00:00Z', via: 'qr' })
  await saveLineLink({ key: '09022223333|鈴木次郎', name: '鈴木次郎', phone: '09022223333', sealed: sealUserId(JIRO, 'notify-secret'), linkedAt: '2030-01-02T00:00:00Z', via: 'liff-link' })
  const links = [
    { key: 'karte:p-hanako', name: '山田 花子', patientId: 'p-hanako' },
    { key: '09022223333|鈴木次郎', name: '鈴木次郎', phone: '09022223333' },
  ]
  const plan = (id, date, extra = {}) => ({ id, date, name: '山田 花子', patientId: 'p-hanako', status: 'planned', createdAt: '2030-01-09T01:00:00Z', updatedAt: '2030-01-09T01:00:00Z', ...extra })
  const setCloud = (plans) => kvSet('sync:clinic', { payload: { pt_patients: JSON.stringify(kartes), pt_visit_plans: JSON.stringify(plans) }, updatedAt: new Date().toISOString() })
  await setCloud([])
  await saveRule('reservation_confirm', { mode: 'on', dailyLimit: 60 })
  await saveRule('reservation_remind', { mode: 'on', dailyLimit: 80 })

  console.log('文')
  await test('「承りました」：お名前・日にち・時間は決めていない・変更の方法。院内のメモ・予約番号は入らない', () => {
    const text = T.visitPlanConfirmText({ name: '山田 花子', date: TOMORROW })
    assert.match(text, /^山田 花子 様\n/)
    assert.match(text, /ゆうき整骨院です。ご来院の予定を承りました。/)
    assert.match(text, /📅 ご来院日：1月11日（金）/)
    assert.match(text, /⏰ 時間：決めていません/)
    assert.match(text, /日にちの変更・取り消しは、このトークまたは\nお電話（083-265-4545）へ/)
    assert.ok(!/予約番号|http/.test(text))
  })
  await test('前日のお知らせ：明日の・場所・止め方（予約のお知らせ停止）。来院を強くすすめる言葉・効果の言葉は入れない', () => {
    const text = T.visitPlanRemindText({ name: '山田 花子', date: TOMORROW }, NOW)
    assert.match(text, /明日のご来院予定のお知らせです。/)
    assert.match(text, /⏰ 時間：決めていません/)
    assert.match(text, /📍 場所：山口県下関市彦島江の浦町9丁目1-14/)
    assert.match(text, /※このお知らせが不要な方は「予約のお知らせ停止」と送ってください。/)
    assert.ok(!/必ず|治|改善|お待ちして/.test(text))
    // 明日でない日は「明日の」を付けない
    assert.ok(!/明日の/.test(T.visitPlanRemindText({ name: '山田 花子', date: '2030-01-20' }, NOW)))
  })

  console.log('だれの LINE か')
  await test('カルテから選んだ予定＝そのカルテの LINE（電話・生年月日が無くても、カルテの ID で）', () => {
    const m = M.matchLinkForPlan({ patientId: 'p-hanako', name: '山田 花子' }, kartes, links)
    assert.deepEqual([m.linked, m.link.key, m.how], [true, 'karte:p-hanako', 'karte_id'])
    const j = M.matchLinkForPlan({ patientId: 'p-jiro', name: '鈴木 次郎' }, kartes, links)
    assert.deepEqual([j.linked, j.how], [true, 'karte_phone'])
    assert.deepEqual(M.matchLinkForPlan({ patientId: 'p-sato', name: '佐藤 三郎' }, kartes, links), { linked: false, why: 'karte_not_linked' })
  })
  await test('お名前だけの予定＝同じお名前のカルテが1つのときだけ。2つあれば送らない・カルテが無ければ送らない', () => {
    assert.equal(M.matchLinkForPlan({ name: '山田花子' }, kartes, links).linked, true)
    assert.deepEqual(M.matchLinkForPlan({ name: '田中 実' }, kartes, links), { linked: false, why: 'karte_ambiguous' })
    assert.deepEqual(M.matchLinkForPlan({ name: '高橋 四郎' }, kartes, links), { linked: false, why: 'no_karte' })
    // カルテを選んだが、クラウドにまだ無い（入れたばかり）→ お名前で探す
    assert.equal(M.matchLinkForPlan({ patientId: 'p-new', name: '山田 花子' }, kartes, links).linked, true)
  })

  console.log('入れたとき・日にちを変えたとき')
  await test('LINE 連携の方に「承りました」を1通（連携のお名前で）。同じ予定・同じ日にちは二度送らない', async () => {
    const r = await S.confirmVisitPlan({ id: 'plan-aaaa01', date: TOMORROW, patientId: 'p-hanako', name: '山田 花子' }, { now: NOW })
    assert.deepEqual([r.linked, r.delivered, r.result, r.why], [true, true, 'sent', 'karte_id'])
    assert.equal(pushes.length, 1)
    assert.equal(pushes[0].to, HANAKO)
    assert.match(pushes[0].text, /山田 花子 様[\s\S]*ご来院の予定を承りました。[\s\S]*1月11日（金）/)
    const again = await S.confirmVisitPlan({ id: 'plan-aaaa01', date: TOMORROW, patientId: 'p-hanako', name: '山田 花子' }, { now: NOW })
    assert.deepEqual([again.delivered, again.result], [true, 'duplicate'])
    assert.equal(pushes.length, 1)
    assert.equal(P.planLineResult(r), 'sent')
    assert.equal(P.planLineResult(again), 'sent')
  })
  await test('日にちを変えたら、新しい日にちでもう1通', async () => {
    const r = await S.confirmVisitPlan({ id: 'plan-aaaa01', date: '2030-01-15', patientId: 'p-hanako', name: '山田 花子' }, { now: NOW })
    assert.equal(r.result, 'sent')
    assert.equal(pushes.length, 2)
    assert.match(pushes[1].text, /1月15日（火）/)
  })
  await test('LINE 連携の無い方・同じお名前が2人・過ぎた日・形がちがうときは、何も送らない（理由を返す。お名前は返さない）', async () => {
    const before = pushes.length
    const sato = await S.confirmVisitPlan({ id: 'plan-sato01', date: TOMORROW, patientId: 'p-sato', name: '佐藤 三郎' }, { now: NOW })
    assert.deepEqual([sato.linked, sato.result, sato.why], [false, 'not_linked', 'karte_not_linked'])
    const tanaka = await S.confirmVisitPlan({ id: 'plan-tana01', date: TOMORROW, name: '田中 実' }, { now: NOW })
    assert.deepEqual([tanaka.result, tanaka.why], ['not_linked', 'karte_ambiguous'])
    assert.equal((await S.confirmVisitPlan({ id: 'plan-aaaa02', date: '2030-01-09', patientId: 'p-hanako', name: '山田 花子' }, { now: NOW })).result, 'past')
    assert.equal((await S.confirmVisitPlan({ id: '../x', date: TOMORROW, name: '山田 花子' }, { now: NOW })).result, 'invalid')
    assert.equal((await S.confirmVisitPlan({ id: 'plan-aaaa03', date: TOMORROW, name: '' }, { now: NOW })).result, 'invalid')
    assert.equal(pushes.length, before)
    assert.ok(!JSON.stringify([sato, tanaka]).includes('佐藤') && !JSON.stringify(tanaka).includes('田中'))
    assert.equal(P.planLineResult(sato), 'not_linked')
    assert.equal(P.planLineResult({ result: 'past' }), null)
  })
  await test('自動化設定に従う：テスト＝院長の LINE に見本（ご本人には送らない）／止める＝送らない', async () => {
    await saveRule('reservation_confirm', { mode: 'test', dailyLimit: 60 })
    const before = pushes.length
    const t = await S.confirmVisitPlan({ id: 'plan-test01', date: TOMORROW, patientId: 'p-hanako', name: '山田 花子' }, { now: NOW })
    assert.deepEqual([t.delivered, t.result], [false, 'test'])
    assert.equal(pushes.length, before + 1)
    assert.equal(pushes.at(-1).to, OWNER)
    assert.match(pushes.at(-1).text, /^【テスト】患者さんにはまだ送っていません/)
    assert.equal(P.planLineResult(t), 'test')
    await saveRule('reservation_confirm', { mode: 'off', dailyLimit: 60 })
    const off = await S.confirmVisitPlan({ id: 'plan-off001', date: TOMORROW, patientId: 'p-hanako', name: '山田 花子' }, { now: NOW })
    assert.deepEqual([off.delivered, off.result], [false, 'skipped'])
    assert.equal(pushes.length, before + 1)
    assert.equal(P.planLineResult(off), 'off')
    await saveRule('reservation_confirm', { mode: 'on', dailyLimit: 60 })
  })

  console.log('前日のお知らせ')
  await test('送る時間の外（8時より前・20時から）は何もしない', async () => {
    await setCloud([plan('plan-rem001', TOMORROW)])
    const before = pushes.length
    assert.match((await S.runVisitPlanReminders(at(7))).reason, /送る時間外/)
    assert.match((await S.runVisitPlanReminders(at(20))).reason, /送る時間外/)
    assert.equal(pushes.length, before)
  })
  await test('明日の「予定」の方へ1通。次の回には重ねて送らない', async () => {
    const before = pushes.length
    const r = await S.runVisitPlanReminders(at(8))
    assert.deepEqual([r.sent, r.skipped], [1, 0])
    assert.equal(pushes.length, before + 1)
    assert.equal(pushes.at(-1).to, HANAKO)
    assert.match(pushes.at(-1).text, /明日のご来院予定のお知らせです。[\s\S]*1月11日（金）[\s\S]*決めていません/)
    const again = await S.runVisitPlanReminders(at(9))
    assert.deepEqual([again.sent, again.skipped], [0, 0])
    assert.equal(pushes.length, before + 1)
  })
  await test('送らない予定：明日でない・来院した・来なかった・取り消した（記録に無い）・「LINE でお知らせする」を外した', async () => {
    await setCloud([
      plan('plan-rem002', '2030-01-12'),
      plan('plan-rem003', TOMORROW, { status: 'visited' }),
      plan('plan-rem004', TOMORROW, { status: 'no_show' }),
      plan('plan-rem005', TOMORROW, { lineOff: true }),
    ])
    const before = pushes.length
    const r = await S.runVisitPlanReminders(at(10))
    assert.deepEqual([r.sent, r.skipped], [0, 0])
    assert.equal(pushes.length, before)
  })
  await test('今日「承りました」を送った明日の予定には、前日のお知らせを重ねない', async () => {
    const c = await S.confirmVisitPlan({ id: 'plan-rem006', date: TOMORROW, patientId: 'p-jiro', name: '鈴木 次郎' }, { now: NOW })
    assert.equal(c.result, 'sent')
    await setCloud([plan('plan-rem006', TOMORROW, { patientId: 'p-jiro', name: '鈴木 次郎' })])
    const before = pushes.length
    const r = await S.runVisitPlanReminders(at(12))
    assert.deepEqual([r.sent, r.skipped], [0, 1])
    assert.equal(pushes.length, before)
    assert.equal((await kvGet('linesent:_vplan:r:plan-rem006')).skipped, 'confirmed_today')
  })
  await test('前の日までに入れた予定は、前日に1通（「承りました」とは別のお知らせ）', async () => {
    // きのう「承りました」を送ってある
    await S.confirmVisitPlan({ id: 'plan-rem007', date: TOMORROW, patientId: 'p-jiro', name: '鈴木 次郎' }, { now: new Date(NOW.getTime() - 24 * 3600e3) })
    await setCloud([plan('plan-rem007', TOMORROW, { patientId: 'p-jiro', name: '鈴木 次郎' })])
    const before = pushes.length
    const r = await S.runVisitPlanReminders(at(13))
    assert.equal(r.sent, 1)
    assert.equal(pushes.at(-1).to, JIRO)
    assert.equal(pushes.length, before + 1)
  })
  await test('ご本人が「予約のお知らせ停止」と送っていたら、前日のお知らせは送らない', async () => {
    await applyConsent(JIRO, { purpose: 'reservation', allow: false })
    await setCloud([plan('plan-rem008', TOMORROW, { patientId: 'p-jiro', name: '鈴木 次郎' })])
    const before = pushes.length
    const r = await S.runVisitPlanReminders(at(14))
    assert.deepEqual([r.sent, r.skipped], [0, 1])
    assert.equal(pushes.length, before)
    await applyConsent(JIRO, { purpose: 'reservation', allow: true })
    // その予定は「終わり」にしてある（止めた方に、あとから送らない）
    assert.equal((await S.runVisitPlanReminders(at(15))).sent, 0)
  })
  await test('LINE 連携の無い方には送らない。その日のうちに連携したら、次の回に送る', async () => {
    await setCloud([plan('plan-rem009', TOMORROW, { patientId: 'p-sato', name: '佐藤 三郎' })])
    const before = pushes.length
    assert.deepEqual(await S.runVisitPlanReminders(at(15)), { sent: 0, skipped: 1 })
    assert.equal(pushes.length, before)
    const SABURO = 'Udddddddddddddddddddddddddddddddd'
    await saveLineLink({ key: 'karte:p-sato', name: '佐藤 三郎', phone: '', patientId: 'p-sato', sealed: sealUserId(SABURO, 'notify-secret'), linkedAt: '2030-01-10T06:30:00Z', via: 'qr' })
    assert.equal((await S.runVisitPlanReminders(at(16))).sent, 1)
    assert.equal(pushes.at(-1).to, SABURO)
  })
  await test('テストのときは院長の LINE に見本だけ。あとで「動かす」にしたら、ご本人へ', async () => {
    await saveRule('reservation_remind', { mode: 'test', dailyLimit: 80 })
    await setCloud([plan('plan-rem010', TOMORROW)])
    const before = pushes.length
    await S.runVisitPlanReminders(at(16))
    assert.equal(pushes.length, before + 1)
    assert.equal(pushes.at(-1).to, OWNER)
    await S.runVisitPlanReminders(at(17))
    assert.equal(pushes.length, before + 1, 'テストの見本は1回だけ')
    await saveRule('reservation_remind', { mode: 'on', dailyLimit: 80 })
    assert.equal((await S.runVisitPlanReminders(at(18))).sent, 1)
    assert.equal(pushes.at(-1).to, HANAKO)
  })

  console.log('「予約確認」の返事')
  await test('時間を決めない来院予定も返す（その LINE の方の分だけ・「予定」のままのものだけ）', async () => {
    const plans = [
      plan('plan-chk001', '2030-01-20'),
      plan('plan-chk002', '2030-01-25', { status: 'visited' }),
      plan('plan-chk003', '2030-01-09'),
      plan('plan-chk004', '2030-01-22', { patientId: 'p-jiro', name: '鈴木 次郎' }),
    ]
    const mine = new Set(['karte:p-hanako'])
    assert.deepEqual(C.pickPlansForLine(plans, TODAY, kartes, links, mine), [{ name: '山田 花子', date: '2030-01-20' }])
    assert.deepEqual(C.pickPlansForLine(plans, TODAY, kartes, links, new Set()), [])
    // 同じ方・同じ日に時間の予約があれば、そちらだけ
    assert.deepEqual(C.pickPlansForLine(plans, TODAY, kartes, links, mine, [{ name: '山田 花子', date: '2030-01-20', time: '10:00', reservationNo: 'R1' }]), [])
  })
  await test('返事の文：予約と来院予定を並べる。来院予定だけでも「ありません」とは言わない', async () => {
    const opts = { clinicName: 'ゆうき整骨院', phone: '083-265-4545', reserveUrl: 'https://liff.line.me/x' }
    const both = C.reservationCheckText({ kind: 'found', items: [{ name: '山田 花子', date: '2030-01-12', time: '10:30', reservationNo: 'R100' }], plans: [{ name: '山田 花子', date: '2030-01-20' }] }, opts)
    assert.match(both, /これからのご予約・ご来院の予定は、次のとおりです。/)
    assert.match(both, /📅 1月12日（土） 10:30〜\n🎫 予約番号：R100/)
    assert.match(both, /📅 1月20日（日） ご来院の予定（時間は決めていません）/)
    const only = C.reservationCheckText({ kind: 'found', items: [], plans: [{ name: '山田 花子', date: '2030-01-20' }] }, opts)
    assert.match(only, /^山田 花子 様\n/)
    assert.ok(!/ありません/.test(only))
    // 来院予定が無いときの文は、今までと同じ
    assert.match(C.reservationCheckText({ kind: 'found', items: [{ name: '山田 花子', date: '2030-01-12', time: '10:30', reservationNo: 'R100' }] }, opts), /これからのご予約は、次のとおりです。/)
  })
  await test('サーバー：予約が無くても、来院予定があれば返す。どちらも無ければ「ご予約はありません」', async () => {
    upcomingRows = []
    await setCloud([plan('plan-chk010', '2030-01-20')])
    const r = await CS.resolveReservationCheck(HANAKO, NOW)
    assert.equal(r.kind, 'found')
    assert.deepEqual(r.plans, [{ name: '山田 花子', date: '2030-01-20' }])
    assert.deepEqual(r.items, [])
    await setCloud([])
    assert.equal((await CS.resolveReservationCheck(HANAKO, NOW)).kind, 'none')
    assert.equal((await CS.resolveReservationCheck('Ueeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee', NOW)).kind, 'unknown')
  })

  console.log('記録と画面')
  await test('予定の記録：チェックを外した予定は lineOff。印は、いまの日にちに送った記録だけ', () => {
    const off = P.newVisitPlan({ date: TOMORROW, name: '山田 花子', patientId: 'p-hanako', lineOff: true }, 'plan-x', '2030-01-10T00:00:00Z')
    assert.equal(off.lineOff, true)
    assert.equal(P.newVisitPlan({ date: TOMORROW, name: '山田 花子' }, 'plan-y', '2030-01-10T00:00:00Z').lineOff, undefined)
    assert.deepEqual(P.planLineBadge(off), { result: 'off', label: 'LINE お知らせなし' })
    assert.equal(P.planLineBadge({ date: TOMORROW }), null)
    assert.deepEqual(P.planLineBadge({ date: TOMORROW, line: { date: TOMORROW, at: 'x', result: 'sent' } }), { result: 'sent', label: 'LINE 送信済み' })
    assert.equal(P.planLineBadge({ date: '2030-01-15', line: { date: TOMORROW, at: 'x', result: 'sent' } }), null, '日にちを変えたあとの古い記録は出さない')
    assert.equal(P.planLineResult(null), 'error')
    assert.equal(P.planLineResult({ linked: true, delivered: false, result: 'limited' }), 'error')
    assert.equal(P.planLineResult({ linked: true, delivered: false, result: 'duplicate' }), 'test')
  })
  await test('画面：入れたとき・日にちを変えたときに頼む。院内の API（パスワードの中）・定期実行から前日のお知らせ', () => {
    const panel = read('src/components/clinic/VisitPlansPanel.tsx')
    assert.match(panel, /fetch\('\/api\/line-link\/visit-plan'/)
    assert.match(panel, /void notifyPlanLine\(plan\)/)
    assert.match(panel, /void notifyPlanLine\(moved\)/)
    // チェックは1人ごとに初め（あり）に戻す
    assert.match(panel, /setNote\(''\)\n[^\n]*\n\s*setLineOn\(true\)/)
    assert.match(panel, /if \(plan\.lineOff \|\| plan\.status !== 'planned' \|\| plan\.date < jstToday\(\)\) return/)
    // メモは送らない（API へ渡すのは、予定の ID・日にち・カルテの ID・お名前だけ）
    assert.match(panel, /body: JSON\.stringify\(\{ id: plan\.id, date: plan\.date, patientId: plan\.patientId, name: plan\.name \}\)/)
    assert.match(read('src/proxy.ts'), /'\/api\/line-link\/:path\*'/)
    assert.match(read('src/app/api/marketing/jobs/run/route.ts'), /runVisitPlanReminders\(\)/)
    // 予約の画面（予約システム）へ渡すのは、今までどおり お名前・メモ・状態だけ
    assert.match(read('src/lib/yoyaku-lane.ts'), /\.map\(\(\{ p \}\) => \(\{ id: p\.id, name: p\.name, note: p\.note \?\? '', status: p\.status \}\)\)/)
  })
} finally {
  globalThis.fetch = realFetch
  for (const k of Object.keys(process.env)) if (!(k in saved)) delete process.env[k]
  Object.assign(process.env, saved)
  process.chdir(cwd)
  fs.rmSync(dir, { recursive: true, force: true })
}

console.log(`\n${passed} 件 OK`)
