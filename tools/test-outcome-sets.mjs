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
const { OUTCOME_METRICS, SPORT_SETS, CONDITION_SETS, getOutcomeMetric, getSportSet, getConditionSet, metricForCondition, suggestSport, suggestCondition } = data
const { lsi, lsiTime, absDiff, rotation, buildOutcomeValues, judgeTarget, latestByMetric, trmOver } = calc

let passed = 0
async function test(name, fn) {
  await fn()
  passed += 1
  console.log(`  ✓ ${name}`)
}

await test('指標の key は重ならず、どのセットの指標も一覧にある', () => {
  const keys = OUTCOME_METRICS.map((m) => m.key)
  assert.equal(new Set(keys).size, keys.length)
  for (const s of SPORT_SETS) for (const k of s.metrics) assert.ok(getOutcomeMetric(k), `${s.key} の ${k}`)
  assert.deepEqual(
    SPORT_SETS.map((s) => s.key),
    ['none', 'baseball', 'soccer', 'running', 'jump', 'acl'],
  )
})

await test('前からある指標（nrs・膝・KOOS・LSI）はそのまま残っている（保存した記録が読める）', () => {
  for (const k of ['nrs', 'rom_knee_flex', 'rom_knee_ext', 'rom_other', 'koos', 'lysholm', 'ikdc', 'lsi_quad', 'lsi_ham', 'lsi_hop'])
    assert.ok(getOutcomeMetric(k), k)
})

await test('LSI＝患側÷健側×100、時間は健側÷患側×100、健側 0 は出さない', () => {
  assert.equal(lsi(18, 20), 90)
  assert.equal(lsi(17.5, 21), 83.3)
  assert.equal(lsi(10, 0), null)
  assert.equal(lsiTime(2.5, 2.25), 90)
  assert.equal(lsiTime(0, 2.2), null)
  assert.equal(absDiff(58, 63.5), 5.5)
})

await test('GIRD と TRM 差（Wilk 2011 の定義：投げない側 − 投げる側）', () => {
  const r = rotation({ irThrow: 40, erThrow: 120, irNon: 62, erNon: 100 })
  assert.deepEqual(r, { gird: 22, trm: 2 })
  assert.equal(rotation({ irThrow: -1, erThrow: 120, irNon: 62, erNon: 100 }), null)
  assert.equal(trmOver(5), false)
  assert.equal(trmOver(5.5), true)
})

await test('入れた値から記録の値を作る（左右・4つ・1つ）', () => {
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

await test('目安との比べ：LSI は 90 に届いたか、GIRD は 20 以上、Yバランスは 4cm を超えたら注意', () => {
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

await test('目安の線には必ず出どころ（論文）が書いてあり、「復帰可」とは書かない', () => {
  for (const m of OUTCOME_METRICS) {
    if (!m.target) continue
    assert.ok(m.target.source.length > 5, m.key)
    assert.ok(/\d{4}/.test(m.target.source), `${m.key} の出どころに年がない`)
    assert.ok(!/復帰可|治る|完治/.test(m.target.label + m.target.source), m.key)
  }
})

await test('指標ごとの最新の記録（同じ日は後に作った方）', () => {
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

await test('カルテの言葉から競技セットをすすめる', () => {
  assert.equal(suggestSport('右膝 ACL再建術後'), 'acl')
  assert.equal(suggestSport('前十字靱帯損傷 サッカー'), 'acl')
  assert.equal(suggestSport('野球肩 投球時痛'), 'baseball')
  assert.equal(suggestSport('サッカー 鼠径部痛'), 'soccer')
  assert.equal(suggestSport('アキレス腱炎 マラソン'), 'running')
  assert.equal(suggestSport('ジャンパー膝 バレーボール'), 'jump')
  assert.equal(suggestSport('腰痛 デスクワーク'), null)
  assert.equal(getSportSet('unknown').key, 'none')
})

// ── 疾患ごとの評価セット（2026-11-27 院長「アウトカムで捻挫や肉離れのようにそれぞれの疾患に伴うアウトカム評価も」） ──

await test('疾患のセット：足関節捻挫・肉離れ3部位。どのセットの指標も一覧にあり、指標の key は保存値なので変えない', () => {
  assert.deepEqual(CONDITION_SETS.map((c) => c.key), [
    'none', 'ankle_sprain', 'ham_strain', 'calf_strain', 'quad_strain',
    'achilles', 'plantar_heel', 'mtss', 'bone_stress', 'patellar_tendinopathy', 'osgood', 'meniscus', 'groin', 'low_back',
  ])
  for (const c of CONDITION_SETS) if (c.key !== 'none') assert.ok(data.CONDITION_AREAS.includes(c.area), `${c.key} の部位`)
  for (const c of CONDITION_SETS) {
    for (const k of c.metrics) assert.ok(getOutcomeMetric(k), `${c.key} の ${k}`)
    for (const k of c.noTarget ?? []) assert.ok(c.metrics.includes(k), `${c.key} の noTarget ${k}`)
  }
  for (const k of ['cait', 'swelling_f8', 'wblt', 'side_hop', 'aslr', 'slhb', 'sprint_pct', 'kick_nrs',
    'decline_squat_nrs', 'koos_qol', 'hbd', 'tender_length', 'hop_nrs', 'walk_nrs', 'bony_tender', 'ext_nrs', 'odi', 'firststep_nrs']) assert.ok(getOutcomeMetric(k), k)
  assert.equal(getConditionSet('unknown').key, 'none')
  assert.deepEqual(getConditionSet('ankle_sprain').metrics, ['nrs', 'swelling_f8', 'wblt', 'cait', 'ybal_ant', 'side_hop', 'lsi_hop', 'lsi_calf'])
})

await test('CAIT は 25点以下が注意（Wright 2014）。大きいほど良い指標の「注意」は区切りより下の側', () => {
  const cait = getOutcomeMetric('cait')
  assert.equal(judgeTarget(cait, 25).state, 'over')
  assert.equal(judgeTarget(cait, 20).state, 'over')
  assert.equal(judgeTarget(cait, 26).state, 'within')
  assert.match(cait.target.source, /Wright 2014/)
  // 前からの区切りは変わらない（GIRD 20°以上・Yバランス 4cm を超える）
  assert.equal(judgeTarget(getOutcomeMetric('gird'), 20).state, 'over')
  assert.equal(judgeTarget(getOutcomeMetric('ybal_ant'), 4).state, 'within')
})

await test('左右の値から：腫れ・ランジ・能動SLR は左右の差、横とびホップは時間の LSI、片脚ブリッジは回数の LSI', () => {
  assert.equal(buildOutcomeValues(getOutcomeMetric('swelling_f8'), { kind: 'pair', a: 53.5, b: 51 }).value, 2.5)
  assert.equal(buildOutcomeValues(getOutcomeMetric('wblt'), { kind: 'pair', a: 7, b: 10 }).value, 3)
  assert.equal(buildOutcomeValues(getOutcomeMetric('aslr'), { kind: 'pair', a: 62, b: 78 }).value, 16)
  assert.equal(buildOutcomeValues(getOutcomeMetric('side_hop'), { kind: 'pair', a: 12.5, b: 10 }).value, 80)
  assert.equal(buildOutcomeValues(getOutcomeMetric('slhb'), { kind: 'pair', a: 18, b: 24 }).value, 75)
  assert.equal(buildOutcomeValues(getOutcomeMetric('sprint_pct'), { kind: 'single', value: 90 }).value, 90)
  assert.deepEqual(judgeTarget(getOutcomeMetric('sprint_pct'), 90), { state: 'notyet', gap: 10 })
})

await test('肉離れでは、ACL の研究の LSI 90% の線を出さない（筋力の目安は専門家の合意に届かなかった＝Paton 2023）', () => {
  const ham = getConditionSet('ham_strain')
  assert.equal(metricForCondition(getOutcomeMetric('lsi_ham'), ham).target, undefined)
  assert.ok(getOutcomeMetric('lsi_ham').target, 'もとの指標（ACL術後のセット）では線が残る')
  assert.equal(metricForCondition(getOutcomeMetric('lsi_quad'), getConditionSet('quad_strain')).target, undefined)
  assert.ok(metricForCondition(getOutcomeMetric('ybal_ant'), getConditionSet('ankle_sprain')).target, '足関節捻挫の Yバランスの線は残す')
  assert.ok(ham.refs.some((r) => /Paton 2023/.test(r)))
})

await test('疾患のセットの参考の論文には、著者と年が書いてある（PubMed で抄録を読んだもの）', () => {
  for (const c of CONDITION_SETS) {
    if (c.key === 'none') continue
    assert.ok((c.refs ?? []).length > 0, c.key)
    for (const r of c.refs) assert.ok(/[A-Z][A-Za-z-]+( [A-Z][a-z]+)? \d{4}/.test(r), `${c.key}: ${r}`)
    assert.ok(!/復帰可|治る|完治/.test(c.refs.join('') + c.who), c.key)
  }
})

await await test('小さいほど良い指標の「目安」：痛みなく歩ける・押して痛みなし（0）＝George 2024。VISA-P は健康な人の平均 95（Zwerver 2009）', () => {
  assert.deepEqual(judgeTarget(getOutcomeMetric('walk_nrs'), 0), { state: 'reached', gap: 0 })
  assert.deepEqual(judgeTarget(getOutcomeMetric('walk_nrs'), 3), { state: 'notyet', gap: 3 })
  assert.deepEqual(judgeTarget(getOutcomeMetric('bony_tender'), 1), { state: 'notyet', gap: 1 })
  assert.match(getOutcomeMetric('walk_nrs').target.source, /George 2024/)
  assert.deepEqual(judgeTarget(getOutcomeMetric('visa_p'), 80), { state: 'reference', gap: 15 })
  // 大きいほど良い「目安」は今までどおり
  assert.deepEqual(judgeTarget(getOutcomeMetric('lsi_hop'), 84.5), { state: 'notyet', gap: 5.5 })
  // 膝蓋腱炎・半月板では ACL の研究の線を出さない
  assert.equal(metricForCondition(getOutcomeMetric('lsi_hop'), getConditionSet('meniscus')).target, undefined)
  assert.equal(metricForCondition(getOutcomeMetric('lsi_quad'), getConditionSet('patellar_tendinopathy')).target, undefined)
})

await test('カルテの言葉から疾患のセットをすすめる', () => {
  assert.equal(suggestCondition('右足関節捻挫'), 'ankle_sprain')
  assert.equal(suggestCondition('左足首 ねんざ（内反）'), 'ankle_sprain')
  assert.equal(suggestCondition('右前距腓靱帯損傷'), 'ankle_sprain')
  assert.equal(suggestCondition('右ハムストリング肉離れ'), 'ham_strain')
  assert.equal(suggestCondition('左大腿後面 筋挫傷'), 'ham_strain')
  assert.equal(suggestCondition('右下腿三頭筋 肉ばなれ'), 'calf_strain')
  assert.equal(suggestCondition('ふくらはぎの肉離れ（テニスレッグ）'), 'calf_strain')
  assert.equal(suggestCondition('左大腿直筋 肉離れ'), 'quad_strain')
  assert.equal(suggestCondition('肉離れ'), null, '場所が分からないときはすすめない')
    assert.equal(suggestCondition('右膝 捻挫'), null, '足首でない捻挫はすすめない')
  assert.equal(suggestCondition('右アキレス腱炎'), 'achilles')
  assert.equal(suggestCondition('左アキレス腱断裂 術後'), null, '断裂はアキレス腱症のセットにしない')
  assert.equal(suggestCondition('右足底腱膜炎'), 'plantar_heel')
  assert.equal(suggestCondition('両側シンスプリント'), 'mtss')
  assert.equal(suggestCondition('右脛骨疲労骨折'), 'bone_stress')
  assert.equal(suggestCondition('右膝蓋腱炎（ジャンパー膝）'), 'patellar_tendinopathy')
  assert.equal(suggestCondition('左オスグッド'), 'osgood')
  assert.equal(suggestCondition('右膝内側半月板損傷'), 'meniscus')
  assert.equal(suggestCondition('サッカー 鼠径部痛'), 'groin')
  assert.equal(suggestCondition('腰椎分離症（L5）'), 'low_back')
  assert.equal(suggestCondition('腰痛 デスクワーク'), 'low_back')
})

await test('患者さんごとの設定：競技と疾患は別々に残る（片方を変えても、もう片方は消えない）', async () => {
  const mem = new Map()
  globalThis.localStorage = { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k) }
  globalThis.window = globalThis.window ?? { dispatchEvent: () => true, addEventListener: () => {}, removeEventListener: () => {} }
  const store = await import(new URL('src/lib/contracts/store.ts', root).href)
  assert.equal(store.getOutcomeSport('p1'), null)
  assert.equal(store.getOutcomeCondition('p1'), null)
  store.setOutcomeSport('p1', 'soccer')
  store.setOutcomeCondition('p1', 'ankle_sprain')
  assert.equal(store.getOutcomeSport('p1'), 'soccer')
  assert.equal(store.getOutcomeCondition('p1'), 'ankle_sprain')
  store.setOutcomeSport('p1', 'jump')
  assert.equal(store.getOutcomeCondition('p1'), 'ankle_sprain')
  // 前の形の記録（sport だけ）も読める
  mem.set('pt_outcome_settings', JSON.stringify([{ id: 'p2', sport: 'acl', updatedAt: 'x' }]))
  assert.equal(store.getOutcomeSport('p2'), 'acl')
  assert.equal(store.getOutcomeCondition('p2'), null)
})

console.log(`\nアウトカムの競技・疾患のセット：${passed} 件すべて通りました。`)
