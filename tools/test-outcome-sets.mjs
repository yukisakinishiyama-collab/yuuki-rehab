// アウトカムの競技セット・LSI・左右差・GIRD/TRM の計算の確認
// 実行: node tools/test-outcome-sets.mjs   （Node 22.18+ は .ts をそのまま読める）
import assert from 'node:assert/strict'
import { register } from 'node:module'
const SRC = new URL('../src/', import.meta.url).href
register(
  'data:text/javascript,' +
    encodeURIComponent(
      `export async function resolve(s, c, next) { if (s.startsWith('@/')) s = ${JSON.stringify(SRC)} + s.slice(2); try { return await next(s, c) } catch (e) { if (!/\\.[a-z]+$/.test(s.split('?')[0])) return next(s + '.ts', c); throw e } }`,
    ),
)

const root = new URL('../', import.meta.url)
const data = await import(new URL('src/data/outcome-metrics.ts', root).href)
const calc = await import(new URL('src/lib/outcomes/calc.ts', root).href)
const { OUTCOME_METRICS, SPORT_SETS, getOutcomeMetric, getSportSet, suggestSport } = data
const { lsi, lsiTime, absDiff, rotation, buildOutcomeValues, judgeTarget, latestByMetric, trmOver } = calc

let passed = 0
function test(name, fn) {
  fn()
  passed += 1
  console.log(`  ✓ ${name}`)
}

test('指標の key は重ならず、どのセットの指標も一覧にある', () => {
  const keys = OUTCOME_METRICS.map((m) => m.key)
  assert.equal(new Set(keys).size, keys.length)
  for (const s of SPORT_SETS) for (const k of s.metrics) assert.ok(getOutcomeMetric(k), `${s.key} の ${k}`)
  assert.deepEqual(
    SPORT_SETS.map((s) => s.key),
    ['none', 'baseball', 'soccer', 'running', 'jump', 'acl'],
  )
})

test('前からある指標（nrs・膝・KOOS・LSI）はそのまま残っている（保存した記録が読める）', () => {
  for (const k of ['nrs', 'rom_knee_flex', 'rom_knee_ext', 'rom_other', 'koos', 'lysholm', 'ikdc', 'lsi_quad', 'lsi_ham', 'lsi_hop'])
    assert.ok(getOutcomeMetric(k), k)
})

test('LSI＝患側÷健側×100、時間は健側÷患側×100、健側 0 は出さない', () => {
  assert.equal(lsi(18, 20), 90)
  assert.equal(lsi(17.5, 21), 83.3)
  assert.equal(lsi(10, 0), null)
  assert.equal(lsiTime(2.5, 2.25), 90)
  assert.equal(lsiTime(0, 2.2), null)
  assert.equal(absDiff(58, 63.5), 5.5)
})

test('GIRD と TRM 差（Wilk 2011 の定義：投げない側 − 投げる側）', () => {
  const r = rotation({ irThrow: 40, erThrow: 120, irNon: 62, erNon: 100 })
  assert.deepEqual(r, { gird: 22, trm: 2 })
  assert.equal(rotation({ irThrow: -1, erThrow: 120, irNon: 62, erNon: 100 }), null)
  assert.equal(trmOver(5), false)
  assert.equal(trmOver(5.5), true)
})

test('入れた値から記録の値を作る（左右・4つ・1つ）', () => {
  const quad = getOutcomeMetric('lsi_quad')
  assert.deepEqual(buildOutcomeValues(quad, { kind: 'pair', a: 22.5, b: 25 }), { value: 90, involved: 22.5, uninvolved: 25 })
  assert.equal(buildOutcomeValues(quad, { kind: 'pair', a: 22.5, b: 0 }), null)
  assert.equal(buildOutcomeValues(quad, { kind: 'single', value: 90 }), null)

  const timed = getOutcomeMetric('lsi_hop_timed')
  assert.equal(buildOutcomeValues(timed, { kind: 'pair', a: 2.5, b: 2.25 }).value, 90)

  const ybal = getOutcomeMetric('ybal_ant')
  assert.equal(buildOutcomeValues(ybal, { kind: 'pair', a: 61, b: 65.5 }).value, 4.5)

  const gird = getOutcomeMetric('gird')
  const g = buildOutcomeValues(gird, { kind: 'rotation', r: { irThrow: 40, erThrow: 118, irNon: 60, erNon: 104 } })
  assert.equal(g.value, 20)
  assert.equal(g.detail.trm, 6)

  const nrs = getOutcomeMetric('nrs')
  assert.deepEqual(buildOutcomeValues(nrs, { kind: 'single', value: 12 }), { value: 10 })
})

test('目安との比べ：LSI は 90 に届いたか、GIRD は 20 以上、Yバランスは 4cm を超えたら注意', () => {
  const hop = getOutcomeMetric('lsi_hop')
  assert.deepEqual(judgeTarget(hop, 90), { state: 'reached', gap: 0 })
  assert.deepEqual(judgeTarget(hop, 84.5), { state: 'notyet', gap: 5.5 })
  const gird = getOutcomeMetric('gird')
  assert.equal(judgeTarget(gird, 20).state, 'over')
  assert.equal(judgeTarget(gird, 19).state, 'within')
  const ybal = getOutcomeMetric('ybal_ant')
  assert.equal(judgeTarget(ybal, 4).state, 'within')
  assert.equal(judgeTarget(ybal, 4.5).state, 'over')
  const visa = getOutcomeMetric('visa_a')
  assert.deepEqual(judgeTarget(visa, 80), { state: 'reference', gap: 16 })
  assert.equal(judgeTarget(getOutcomeMetric('kjoc'), 80).state, 'none')
})

test('目安の線には必ず出どころ（論文）が書いてあり、「復帰可」とは書かない', () => {
  for (const m of OUTCOME_METRICS) {
    if (!m.target) continue
    assert.ok(m.target.source.length > 5, m.key)
    assert.ok(/\d{4}/.test(m.target.source), `${m.key} の出どころに年がない`)
    assert.ok(!/復帰可|治る|完治/.test(m.target.label + m.target.source), m.key)
  }
})

test('指標ごとの最新の記録（同じ日は後に作った方）', () => {
  const rec = (id, metric, date, createdAt, value) => ({ id, patientId: 'p', metric, date, createdAt, value })
  const map = latestByMetric([
    rec('a', 'nrs', '2026-11-10', '2026-11-10T01:00:00Z', 6),
    rec('b', 'nrs', '2026-11-11', '2026-11-11T01:00:00Z', 4),
    rec('c', 'nrs', '2026-11-11', '2026-11-11T02:00:00Z', 3),
    rec('d', 'gird', '2026-11-01', '2026-11-01T00:00:00Z', 22),
  ])
  assert.equal(map.get('nrs').id, 'c')
  assert.equal(map.get('gird').value, 22)
})

test('カルテの言葉から競技セットをすすめる', () => {
  assert.equal(suggestSport('右膝 ACL再建術後'), 'acl')
  assert.equal(suggestSport('前十字靱帯損傷 サッカー'), 'acl')
  assert.equal(suggestSport('野球肩 投球時痛'), 'baseball')
  assert.equal(suggestSport('サッカー 鼠径部痛'), 'soccer')
  assert.equal(suggestSport('アキレス腱炎 マラソン'), 'running')
  assert.equal(suggestSport('ジャンパー膝 バレーボール'), 'jump')
  assert.equal(suggestSport('腰痛 デスクワーク'), null)
  assert.equal(getSportSet('unknown').key, 'none')
})

console.log(`\nアウトカムの競技セット：${passed} 件すべて通りました。`)
