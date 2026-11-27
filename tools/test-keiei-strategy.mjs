// 経営方針（90日計画）と月の目標の初めの値（2026-11-27 院長「この内容を今後の経営課題としてガイド、登録してください」「初期値を200万円に修正」）
// 実行: npx tsx tools/test-keiei-strategy.mjs
import assert from 'node:assert/strict'
import fs from 'node:fs'

const D = await import('../src/data/keiei-strategy.ts')
const S = await import('../src/lib/marketing/keiei-strategy.ts')
const G = await import('../src/lib/marketing/goal-plan.ts')
const P = await import('../src/lib/marketing/pdca.ts')
const MG = await import('../src/lib/contracts/member-guide.ts')
const read = (p) => fs.readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')

let passed = 0
function test(name, fn) {
  fn()
  passed += 1
  console.log(`  ✓ ${name}`)
}

test('月の目標の初めの値は 200万円', () => {
  assert.equal(G.DEFAULT_GOAL, 2_000_000)
  const local = read('src/lib/marketing/goal-local.ts')
  assert.match(local, /OLD_DEFAULT = 3_000_000/)
  // 目標を読むところは同じ関数を通す（初めの値・前の 300万円 の直しをそろえる）
  for (const f of ['src/app/(app)/marketing/sales/chat/page.tsx', 'src/app/(app)/marketing/sales/pdca/page.tsx', 'src/components/clinic/KeieiCsvImport.tsx', 'src/app/(app)/marketing/sales/strategy/page.tsx']) {
    assert.match(read(f), /goalOrDefault\(\)/, f)
  }
  assert.match(read('src/app/(app)/marketing/sales/goal/page.tsx'), /migrateSavedGoal\(\)/)
})

test('試算は院長の文の数字どおり（評価 32,000円＋自費 139,200円＝171,200円）', () => {
  assert.deepEqual(D.trialBreakdown(), { assessment: 32_000, self: 139_200, total: 171_200 })
  // 自費 1回 4,350円 は、いまの都度払いの料金（自費リハビリ＋1部位）と同じ
  assert.equal(D.STRATEGY.goal.trial.selfPrice, MG.PAYG_FEES.rehab + MG.PAYG_FEES.part)
  assert.equal(D.STRATEGY.entry.price, 2000)
  assert.equal(D.STRATEGY.entry.minutes, 20)
  assert.equal(D.STRATEGY.budget.yen, 50_000)
  assert.equal(D.STRATEGY.allocation.reduce((s, a) => s + a.pct, 0), 100)
})

test('段階は 1〜30・31〜60・61〜90日、id は重ならない', () => {
  assert.deepEqual(D.STRATEGY_PHASES.map((p) => [p.from, p.to]), [[1, 30], [31, 60], [61, 90]])
  const ids = D.STRATEGY_PHASES.flatMap((p) => p.tasks.map((t) => t.id))
  assert.equal(new Set(ids).size, ids.length)
  const r = D.STRATEGY_REVIEWS.map((x) => x.id)
  assert.equal(new Set(r).size, r.length)
})

test('リンク先の画面がある', () => {
  const links = [...D.STRATEGY_PHASES.flatMap((p) => p.tasks.map((t) => t.link?.href).filter(Boolean)), ...D.STRATEGY.kpis.map((k) => k.link.href)]
  for (const href of links) {
    const dir = href === '/dashboard' ? 'src/app/(app)/dashboard' : href === '/patients' ? 'src/app/(app)/patients' : `src/app/(app)${href}`
    assert.ok(fs.existsSync(new URL(`../${dir}/page.tsx`, import.meta.url)), href)
  }
})

test('何日目か・どの段階か（始めた日が1日目）', () => {
  assert.equal(S.strategyDay(null, '2026-11-27'), null)
  assert.equal(S.strategyDay('2026-11-27', '2026-11-27'), 1)
  assert.equal(S.strategyDay('2026-11-27', '2026-12-26'), 30)
  assert.equal(S.phaseOfDay(30).key, D.STRATEGY_PHASES[0].key)
  assert.equal(S.phaseOfDay(31).key, D.STRATEGY_PHASES[1].key)
  assert.equal(S.phaseOfDay(90).key, D.STRATEGY_PHASES[2].key)
  assert.equal(S.phaseOfDay(91), null)
  assert.equal(S.phaseOfDay(0), null)
  // 月またぎ・うるう年も日付どおり
  assert.equal(S.strategyDay('2028-02-28', '2028-03-01'), 3)
})

test('段階の日が過ぎて、まだのことを出す', () => {
  const p = { startDate: '2026-11-01', done: { 'p1-service': '2026-11-10' }, reviews: {} }
  const s = S.summarizeProgress(p, '2026-12-05') // 35日目
  assert.equal(s.day, 35)
  assert.equal(s.phase.key, D.STRATEGY_PHASES[1].key)
  assert.deepEqual(s.overdue.map((t) => t.id), ['p1-price', 'p1-format', 'p1-web'])
  assert.equal(s.done, 1)
  assert.equal(s.openReviews, D.STRATEGY_REVIEWS.length)
  const end = S.summarizeProgress(p, '2027-02-15')
  assert.equal(end.finished, true)
})

test('保存の前の確かめ（知らない id・形のちがいは通さない）', () => {
  assert.equal(S.progressProblem({ startDate: null, done: {}, reviews: {} }), null)
  assert.equal(S.progressProblem({ startDate: '2026-11-27', done: { 'p1-price': '2026-11-27' }, reviews: { 'r-goal': 'decided' } }), null)
  assert.ok(S.progressProblem({ startDate: '11/27', done: {}, reviews: {} }))
  assert.ok(S.progressProblem({ startDate: null, done: { nope: '2026-11-27' }, reviews: {} }))
  assert.ok(S.progressProblem({ startDate: null, done: {}, reviews: { 'r-goal': 'yes' } }))
  assert.ok(S.progressProblem(null))
})

test('経営相談（AI）に方針と進み具合を渡す（数字と方針だけ）', () => {
  const lines = S.strategyContextLines({ startDate: '2026-11-27', done: {}, reviews: { 'r-trial': 'checked' } }, '2026-11-28', 2_000_000)
  const text = lines.join('\n')
  assert.match(text, /技術の獲得から、技術の価値化へ/)
  assert.match(text, /1,500,000円 以上/)
  assert.match(text, /アプリの月の目標は 2,000,000円/)
  assert.match(text, /2日目/)
  assert.ok(!text.includes('試算の内訳を書き分ける'), '確かめた点は「まだ」に出さない')
  assert.match(text, /目標の金額をそろえる/)
  const server = read('src/lib/marketing/keiei-chat-server.ts')
  assert.match(server, /strategyContextLines/)
  assert.match(server, /はっきり指摘する/)
})

test('PDCA に初回の評価のひな形がある', () => {
  const t = P.TEMPLATES.find((x) => x.id === 'assessment')
  assert.ok(t)
  const d = t.draft({ visits30: 0, sales30: 0, selfSales30: 0, bookings30: 0, newBookings30: 0, clicks30: 0, follows30: 0, gone: null })
  assert.equal(d.target, D.STRATEGY.goal.trial.assessments)
  assert.equal(d.metric, 'manual')
  assert.ok(d.cautions.some((c) => c.includes('約束しない')))
})

test('院長だけ・経営メニューの中', () => {
  assert.match(read('src/app/api/marketing/keiei/strategy/route.ts'), /requireAdmin/g)
  assert.match(read('src/components/clinic/nav.ts'), /'\/marketing\/sales\/strategy'/)
  assert.match(read('src/lib/marketing/keiei-strategy-server.ts'), /'keiei:strategy'/)
})

test('方針の文に、効果を約束する言い方・禁止の言葉が無い', () => {
  const text = read('src/data/keiei-strategy.ts')
  for (const w of ['絶対', '必ず治', '地域No.1', '医師が推薦', '完治']) assert.ok(!text.includes(w), w)
})

console.log(`\nkeiei-strategy: ${passed} passed`)
