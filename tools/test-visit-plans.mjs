// 来院予定（日にちだけ。時間を決めない）の決まりの確認（2026-11-24 院長の依頼）
// 実行: npx tsx tools/test-visit-plans.mjs   （外には送らない・お名前は架空）
import assert from 'node:assert/strict'
import {
  PAST_UNMARKED_DAYS, UPCOMING_DAYS, addDaysYmd, duplicatePlan, findPatientsForPlan, groupVisitPlans, jstToday, newVisitPlan, nextPlanFor,
  planDateLabel, plansOn, visitPlanProblem,
} from '../src/lib/visit-plans.ts'
import { getYoyakuView, setYoyakuView, subscribeYoyakuView } from '../src/lib/yoyaku-view.ts'
import fs from 'node:fs'

let passed = 0
function test(name, fn) {
  fn()
  passed += 1
  console.log(`  ✓ ${name}`)
}

const TODAY = '2026-11-24' // 火曜
const NOW = '2026-11-24T10:00:00.000Z'
const plan = (id, date, name, over = {}) => ({ ...newVisitPlan({ date, name, ...over }, id, NOW), ...(over.status ? { status: over.status } : {}) })

test('日本時間の今日（日本で0時を過ぎたら次の日）', () => {
  assert.equal(jstToday(new Date('2026-11-24T15:30:00Z')), '2026-11-25')
  assert.equal(jstToday(new Date('2026-11-24T14:59:00Z')), '2026-11-24')
})

test('日にちの見せ方：今日・明日・あさってを前に付ける', () => {
  assert.equal(planDateLabel(TODAY, TODAY), '今日 11/24（火）')
  assert.equal(planDateLabel('2026-11-25', TODAY), '明日 11/25（水）')
  assert.equal(planDateLabel('2026-11-26', TODAY), 'あさって 11/26（木）')
  assert.equal(planDateLabel('2026-11-28', TODAY), '11/28（土）')
  assert.equal(planDateLabel('2027-01-03', TODAY), '1/3（日）')
})

test('入れる前の確かめ：日にち・お名前が要る。2週間より前は入れない', () => {
  assert.equal(visitPlanProblem({ date: '', name: '山田' }, TODAY), '日にちを選んでください')
  assert.equal(visitPlanProblem({ date: '2026-02-30', name: '山田' }, TODAY), '日にちを選んでください')
  assert.equal(visitPlanProblem({ date: TODAY, name: '  ' }, TODAY), 'お名前を入れるか、カルテから選んでください')
  assert.match(visitPlanProblem({ date: addDaysYmd(TODAY, -(PAST_UNMARKED_DAYS + 1)), name: '山田' }, TODAY), /より前/)
  assert.equal(visitPlanProblem({ date: addDaysYmd(TODAY, -1), name: '山田' }, TODAY), null) // 昨日来た方を後から入れるのはよい
  assert.equal(visitPlanProblem({ date: '2027-03-01', name: '山田' }, TODAY), null)
})

test('新しい予定：予定の状態で、空白をそろえ、長さを切る。空のメモ・ふりがなは持たない', () => {
  const p = newVisitPlan({ date: TODAY, name: ' 山田　 太郎 ', note: '  夕方\nごろ  ', patientId: 'pt1', kana: 'やまだ たろう' }, 'v1', NOW, '院長')
  assert.deepEqual(p, {
    id: 'v1', date: TODAY, patientId: 'pt1', name: '山田 太郎', kana: 'やまだ たろう', note: '夕方 ごろ', status: 'planned', createdAt: NOW, updatedAt: NOW, createdBy: '院長',
  })
  const q = newVisitPlan({ date: TODAY, name: 'あ'.repeat(80), note: '' }, 'v2', NOW)
  assert.equal(q.name.length, 40)
  assert.ok(!('note' in q) && !('kana' in q) && !('patientId' in q) && !('createdBy' in q))
})

test('同じ日に同じ方は二重に入れない（カルテの方はカルテで、名前だけの方は名前で）', () => {
  const plans = [plan('a', TODAY, '山田 太郎', { patientId: 'pt1' }), plan('b', TODAY, '佐藤 花子')]
  assert.equal(duplicatePlan(plans, { date: TODAY, name: '別の表記', patientId: 'pt1' })?.id, 'a')
  assert.equal(duplicatePlan(plans, { date: '2026-11-25', name: '山田 太郎', patientId: 'pt1' }), undefined)
  assert.equal(duplicatePlan(plans, { date: TODAY, name: '佐藤　花子' })?.id, 'b')
  // 名前だけの方と、同じお名前のカルテの方は別（カルテから選び直したときに入れられるように）
  assert.equal(duplicatePlan(plans, { date: TODAY, name: '佐藤 花子', patientId: 'pt9' }), undefined)
})

test('一覧：今日から先を日にちの順・同じ日はふりがなの順。過去は記録がまだの分だけ。2か月より先は数だけ', () => {
  const plans = [
    plan('t2', TODAY, '渡辺', { kana: 'わたなべ' }),
    plan('t1', TODAY, '青木', { kana: 'あおき' }),
    plan('n1', '2026-11-26', '佐藤'),
    plan('y1', addDaysYmd(TODAY, -1), '昨日の予定のまま'),
    plan('y2', addDaysYmd(TODAY, -1), '昨日来た', { status: 'visited' }),
    plan('old', addDaysYmd(TODAY, -(PAST_UNMARKED_DAYS + 3)), 'ずっと前'),
    plan('far', addDaysYmd(TODAY, UPCOMING_DAYS + 5), 'ずっと先'),
  ]
  const g = groupVisitPlans(plans, TODAY)
  assert.deepEqual(g.upcoming.map(d => [d.label, d.plans.map(p => p.id)]), [
    ['今日 11/24（火）', ['t1', 't2']],
    ['あさって 11/26（木）', ['n1']],
  ])
  assert.deepEqual(g.unmarked.map(p => p.id), ['y1'])
  assert.equal(g.later, 1)
})

test('今日の予定・次の予定（カルテの方）', () => {
  const plans = [
    plan('a', TODAY, '山田', { patientId: 'pt1', status: 'visited' }),
    plan('b', '2026-11-28', '山田', { patientId: 'pt1' }),
    plan('c', '2026-11-26', '山田', { patientId: 'pt1' }),
    plan('d', TODAY, '佐藤'),
  ]
  assert.deepEqual(plansOn(plans, TODAY).map(p => p.id).sort(), ['a', 'd'])
  assert.equal(nextPlanFor(plans, 'pt1', TODAY)?.id, 'c')
  assert.equal(nextPlanFor(plans, 'pt9', TODAY), undefined)
})

test('カルテから選ぶ：お名前・ふりがな（カタカナ・ひらがな・空白のちがいは気にしない）', () => {
  const pts = [
    { id: '1', name: '山田 太郎', kana: 'ヤマダ タロウ' },
    { id: '2', name: '山本 花子', kana: 'やまもと はなこ' },
    { id: '3', name: '佐藤 一郎', kana: '' },
  ]
  assert.deepEqual(findPatientsForPlan(pts, 'やまだ').map(p => p.id), ['1'])
  assert.deepEqual(findPatientsForPlan(pts, 'ヤマ').map(p => p.id), ['1', '2'])
  assert.deepEqual(findPatientsForPlan(pts, '山田太郎').map(p => p.id), ['1'])
  assert.deepEqual(findPatientsForPlan(pts, '佐藤').map(p => p.id), ['3'])
  assert.deepEqual(findPatientsForPlan(pts, '  '), [])
  assert.equal(findPatientsForPlan(Array.from({ length: 20 }, (_, i) => ({ id: String(i), name: `山田${i}`, kana: '' })), '山田').length, 8)
})

test('予約の画面の切りかえ（今日の画面から「来院予定を開く」）', () => {
  let calls = 0
  const off = subscribeYoyakuView(() => { calls += 1 })
  assert.equal(getYoyakuView(), 'slots')
  setYoyakuView('plans')
  setYoyakuView('plans') // 同じなら知らせない
  assert.equal(getYoyakuView(), 'plans')
  assert.equal(calls, 1)
  off()
  setYoyakuView('slots')
  assert.equal(calls, 1)
})

// ── 2026-11-25 院長「予約管理画面で院長、スタッフと別にその日の時間を定めない予約欄を作成してください」
// 予約システム v3.29〜の「時間未定」の欄と、合図（postMessage）でやりとりする（lib/yoyaku-lane.ts）
const lane = await import('../src/lib/yoyaku-lane.ts')
const readSrc = (p) => fs.readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')

test('「時間未定」の欄へ渡す来院予定：その日の分だけ・まだの方を上に・お名前とメモと状態だけ', () => {
  const plans = [
    plan('a', TODAY, '山田 太郎', { patientId: 'p1', kana: 'やまだ たろう', note: '夕方ごろ', status: 'visited' }),
    plan('b', TODAY, '佐藤 花子', { kana: 'さとう はなこ' }),
    plan('c', TODAY, '青木 次郎', { status: 'no_show' }),
    plan('d', TODAY, '井上 三郎', { kana: 'いのうえ さぶろう' }),
    plan('e', addDaysYmd(TODAY, 1), '明日 来る'),
  ]
  const msg = lane.lanePlansMessage(TODAY, plans)
  assert.equal(msg.type, 'yuuki:visit-plans')
  assert.equal(msg.date, TODAY)
  assert.deepEqual(msg.plans.map((p) => [p.id, p.status]), [['d', 'planned'], ['b', 'planned'], ['a', 'visited'], ['c', 'no_show']])
  assert.deepEqual(Object.keys(msg.plans[2]).sort(), ['id', 'name', 'note', 'status'], 'カルテの番号・ふりがな・入れた人などは渡さない')
  assert.deepEqual(msg.plans[2], { id: 'a', name: '山田 太郎', note: '夕方ごろ', status: 'visited' })
  assert.equal(msg.plans[0].note, '')
  // 人数の上限
  const many = Array.from({ length: 60 }, (_, i) => plan(`m${i}`, TODAY, `架空 ${String(i).padStart(2, '0')}`))
  assert.equal(lane.lanePlans(many, TODAY).length, lane.LANE_MAX_PLANS)
  assert.deepEqual(lane.lanePlans(plans, '2026-12-31'), [])
})

test('予約の画面から届く合図：形が合うものだけ読む', () => {
  assert.deepEqual(lane.parseLaneRequest({ type: 'yuuki:visit-plans-watch', date: TODAY }), { kind: 'watch', date: TODAY })
  assert.deepEqual(lane.parseLaneRequest({ type: 'yuuki:visit-plan-add', date: TODAY }), { kind: 'add', date: TODAY })
  assert.deepEqual(lane.parseLaneRequest({ type: 'yuuki:visit-plan-open', id: 'V1StGXR8_Z5jdHi6B-myT', date: TODAY }), { kind: 'open', id: 'V1StGXR8_Z5jdHi6B-myT' })
  assert.equal(lane.parseLaneRequest({ type: 'yuuki:visit-plans-watch', date: '11/25' }), null)
  assert.equal(lane.parseLaneRequest({ type: 'yuuki:visit-plan-add' }), null)
  assert.equal(lane.parseLaneRequest({ type: 'yuuki:visit-plan-open', id: '<script>' }), null)
  assert.equal(lane.parseLaneRequest({ type: 'yuuki:visit-plan-open', id: 'x'.repeat(65) }), null)
  assert.equal(lane.parseLaneRequest({ type: 'yuuki:open-karte', name: '山田' }), null, 'ほかの合図は今までどおり')
  assert.equal(lane.parseLaneRequest(null), null)
  assert.equal(lane.parseLaneRequest('yuuki:visit-plan-add'), null)
  assert.deepEqual(lane.KARTE_HELLO_ACK, { type: 'yuuki:karte-hello-ack', visitPlans: true })
})

test('予約の画面（YoyakuFrame）：予約システムのページからの合図だけ読み、返事はそのページあてに送る', () => {
  const frame = readSrc('src/components/rehab/YoyakuFrame.tsx')
  const handler = frame.slice(frame.indexOf('const onMessage = (event: MessageEvent) => {'), frame.indexOf("window.addEventListener('message', onMessage)"))
  assert.ok(handler.indexOf('if (!isReservationOrigin(event.origin)) return') < handler.indexOf('parseLaneRequest(data)'), '出どころを確かめてから読む')
  assert.match(handler, /source\?\.postMessage\(KARTE_HELLO_ACK, \{ targetOrigin: event\.origin \}\)/)
  assert.match(frame, /target\.win\.postMessage\(lanePlansMessage\(date, getVisitPlans\(\)\), \{ targetOrigin: target\.origin \}\)/)
  assert.match(frame, /startLiveSync\(LANE_SYNC_INTERVAL_MS\)/, '予約表を見ている間は、ほかの端末の分を取り込む')
  assert.match(frame, /<VisitPlanDialog /)
  // 小さな画面は「来院予定（日にち）」と同じ部品・同じ記録
  const dialog = readSrc('src/components/clinic/VisitPlanDialog.tsx')
  assert.match(dialog, /import \{ PlanAddForm, PlanRow, usePlans \} from '\.\/VisitPlansPanel'/)
  assert.match(dialog, /<PlanAddForm initialDate=\{state\.date\}/)
})

console.log(`\n${passed} 件、すべて通りました`)
