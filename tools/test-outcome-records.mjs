// アウトカムで「記録がつかない」ものを無くす（2026-11-20 院長「アウトカムの評価で記録がつかないものがあります」）
// - アウトカム（すぐ記録）：範囲の外の値は、理由（どの欄を・どの範囲で）を出す。左右の値の上限を広げた
// - アウトカムスコア（質問票）：スライダーは動かさなくても、さわれば答えたことにする・まだの項目を番号で出す・
//   部分の点も保存する・消した数字の欄は 0 にしない・評価日は日本時間の今日
// 実行: npx tsx tools/test-outcome-records.mjs
import assert from 'node:assert/strict'
import fs from 'node:fs'

const { OUTCOME_METRICS, getOutcomeMetric } = await import('../src/data/outcome-metrics.ts')
const calc = await import('../src/lib/outcomes/calc.ts')
const { unansweredItems } = await import('../src/lib/outcome-score-answers.ts')
const { SCORE_DEFS } = await import('../src/data/outcome-score-defs.ts')
const read = (p) => fs.readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')

let passed = 0
function test(name, fn) {
  fn()
  passed += 1
  console.log(`  ✓ ${name}`)
}

const inputOf = (m, v) =>
  m.rotation
    ? { kind: 'rotation', r: { irThrow: v ?? 45, erThrow: 115, irNon: 60, erNon: 100 } }
    : m.pair
      ? { kind: 'pair', a: v ?? m.pair.start[0], b: m.pair.start[1] }
      : { kind: 'single', value: v ?? m.start }

test('すべての指標：最初に入っている値のまま「記録する」と記録できる', () => {
  for (const m of OUTCOME_METRICS) {
    const input = inputOf(m)
    assert.equal(calc.outcomeInputProblem(m, input), null, m.key)
    assert.ok(calc.buildOutcomeValues(m, input), m.key)
  }
})

test('左右の値の上限を広げた（筋力 999kg・片脚ホップ 500cm・3段 1500cm・カーフレイズ 300回・6mホップ 30秒）', () => {
  const max = (k) => getOutcomeMetric(k).pair.max
  assert.equal(max('lsi_quad'), 999)
  assert.equal(max('lsi_ham'), 999)
  assert.equal(max('lsi_hip_add'), 999)
  assert.equal(max('lsi_hip_abd'), 999)
  assert.equal(max('lsi_hop'), 500)
  assert.equal(max('lsi_hop_triple'), 1500)
  assert.equal(max('lsi_hop_cross'), 1500)
  assert.equal(max('lsi_calf'), 300)
  assert.equal(max('lsi_hop_timed'), 30)
  // 前は記録できなかった値（大腿四頭筋 健側 180kg・片脚ホップ 健側 320cm）
  const quad = getOutcomeMetric('lsi_quad')
  assert.equal(calc.outcomeInputProblem(quad, { kind: 'pair', a: 160, b: 180 }), null)
  assert.equal(calc.buildOutcomeValues(quad, { kind: 'pair', a: 160, b: 180 }).value, 88.9)
  const hop = getOutcomeMetric('lsi_hop')
  assert.equal(calc.outcomeInputProblem(hop, { kind: 'pair', a: 290, b: 320 }), null)
})

test('範囲の外・空の欄は、どの欄をどの範囲で、と理由を出す（前は「健側を 0 より大きく」と出ていた）', () => {
  const quad = getOutcomeMetric('lsi_quad')
  assert.equal(calc.outcomeInputProblem(quad, { kind: 'pair', a: 20, b: 1200 }), '健側は 0〜999kg の範囲で入れてください。')
  assert.equal(calc.outcomeInputProblem(quad, { kind: 'pair', a: Number.NaN, b: 25 }), '患側の値を入れてください。')
  assert.match(calc.outcomeInputProblem(quad, { kind: 'pair', a: 20, b: 0 }), /健側の値を 0 より大きく/)
  const timed = getOutcomeMetric('lsi_hop_timed')
  assert.match(calc.outcomeInputProblem(timed, { kind: 'pair', a: 0, b: 2.3 }), /患側の時間を 0 より大きく/)
  const ybal = getOutcomeMetric('ybal_ant')
  assert.equal(calc.outcomeInputProblem(ybal, { kind: 'pair', a: 60, b: 0 }), null, '左右差は 0 があってよい')
  const gird = getOutcomeMetric('gird')
  assert.equal(calc.outcomeInputProblem(gird, { kind: 'rotation', r: { irThrow: 200, erThrow: 100, irNon: 60, erNon: 100 } }), '投げる側 内旋は 0〜180° の範囲で入れてください。')
  assert.equal(calc.outcomeInputProblem(gird, { kind: 'rotation', r: { irThrow: 40, erThrow: Number.NaN, irNon: 60, erNon: 100 } }), '投げる側 外旋の値を入れてください。')
})

test('1つの値の指標：範囲の外は黙って丸めずに、理由を出す', () => {
  const nrs = getOutcomeMetric('nrs')
  assert.equal(calc.outcomeInputProblem(nrs, { kind: 'single', value: 12 }), '値は 0〜10 の範囲で入れてください。')
  assert.equal(calc.outcomeInputProblem(nrs, { kind: 'single', value: Number.NaN }), '値を入れてください。')
  const flex = getOutcomeMetric('rom_knee_flex')
  assert.equal(calc.outcomeInputProblem(flex, { kind: 'single', value: 165 }), null, '膝の屈曲 165° は記録できる（上限 170°）')
  const ext = getOutcomeMetric('rom_knee_ext')
  assert.equal(calc.outcomeInputProblem(ext, { kind: 'single', value: 18 }), null, '膝の過伸展 18° も記録できる')
  assert.equal(calc.outcomeInputProblem(ext, { kind: 'single', value: -35 }), null, '伸展制限 -35° も記録できる')
})

test('アウトカム（すぐ記録）の画面：記録する前に理由を確かめる・消した欄は 0 にしない・記録したことを出す', () => {
  const page = read('src/components/rehab-management/OutcomeQuickTab.tsx')
  assert.ok(page.includes('const problem = useMemo(() => outcomeInputProblem(metric, input), [metric, input])'))
  assert.ok(page.includes("setError(problem ?? '値を確かめてください。')"))
  assert.ok(page.includes("e.target.value.trim() === '' ? Number.NaN : Number(e.target.value)"))
  assert.ok(page.includes('を記録しました（'))
  assert.ok(!page.includes("'健側の値を 0 より大きくしてください。' : metric.pair?.calc"), '前のまぎらわしい言葉は使わない')
})

test('質問票：まだ答えていない項目を番号で出す（スライダーを動かしていない項目も）', () => {
  const atrs = SCORE_DEFS.atrs
  assert.deepEqual(
    unansweredItems(atrs.items, { q1: 10, q2: 0, q4: 5 }).map((u) => u.no),
    [3, 5, 6, 7, 8, 9, 10],
  )
  assert.deepEqual(unansweredItems(atrs.items, Object.fromEntries(atrs.items.map((i) => [i.id, 0]))), [], '0 も答え')
  assert.deepEqual(unansweredItems([{ id: 'a' }], { a: Number.NaN }).map((u) => u.no), [1])
})

test('質問票の画面：スライダーはさわれば記録・「0 で答える」・部分の点も保存・消した数字は答えなし・日本時間の今日', () => {
  const page = read('src/app/(app)/patients/[id]/outcome-scores/page.tsx')
  assert.ok(page.includes('onPointerUp={e => answerSlider(item.id, Number(e.currentTarget.value))}'))
  assert.ok(page.includes('onKeyUp={e => answerSlider(item.id, Number(e.currentTarget.value))}'))
  assert.ok(page.includes('{item.min ?? 0} で答える'))
  assert.ok(page.includes('subscores: result.subscores,'), '部分の点（ASES の痛み・機能 など）を保存する')
  assert.ok(page.includes("if (raw === '' || !Number.isFinite(Number(raw))) delete next[item.id]"))
  assert.ok(page.includes('useState(jstToday())'))
  assert.ok(!page.includes("new Date().toISOString().split('T')[0]"), '世界時の日付は使わない')
  assert.ok(page.includes('まだ答えていない項目：'))
})

test('質問票：部分の点を返すもの（ASES・Constant など）は、保存する値に入る形', () => {
  const ases = SCORE_DEFS.ases
  const full = Object.fromEntries(ases.items.map((i) => [i.id, i.type === 'radio' ? i.options[0].value : (i.min ?? 0)]))
  const r = ases.calculate(full)
  assert.ok(r.subscores && Object.values(r.subscores).every((v) => Number.isFinite(v)))
})

console.log(`\n${passed} 件 OK`)
