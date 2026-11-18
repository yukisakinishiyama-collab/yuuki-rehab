// 図の左右の決まりの確認（人体図の前面・背面、腰部の解剖図、前の記録の印の入れかえ）。データはすべて架空
// 実行: npx tsx tools/test-diagram-layout.mjs
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { register } from 'node:module'
const SRC = new URL('../src/', import.meta.url).href
register(
  'data:text/javascript,' +
    encodeURIComponent(
      `export async function resolve(s, c, next) { if (s.startsWith('@/')) s = ${JSON.stringify(SRC)} + s.slice(2); try { return await next(s, c) } catch (e) { if (!/\\.[a-z]+$/.test(s.split('?')[0])) return next(s + '.ts', c); throw e } }`,
    ),
)

const root = new URL('../', import.meta.url)
const L = await import(new URL('src/lib/anatomy/layout.ts', root).href)
const J = await import(new URL('src/lib/anatomy/body-joints.ts', root).href)
const F = await import(new URL('src/lib/karte/followup.ts', root).href)

let passed = 0
function test(name, fn) {
  fn()
  passed += 1
  console.log(`  ✓ ${name}`)
}

// 人体図の部位（BodyMap.tsx の REGS）を読む
const bodySrc = readFileSync(new URL('src/components/rehab-management/BodyMap.tsx', root), 'utf8')
const regs = []
for (const line of bodySrc.split('\n')) {
  const m = line.match(/\{ id:'([a-z]+)',\s*label:'([^']+)',\s*view:'(front|back)',\s*shape:'(e|r)',(.*)\}/)
  if (!m) continue
  const num = (k) => Number((m[5].match(new RegExp(`\\b${k}:(\\d+)`)) ?? [])[1])
  const cx = m[4] === 'e' ? num('cx') : num('x') + num('w') / 2
  regs.push({ id: m[1], label: m[2], view: m[3], cx })
}
const side = (label) => (label.includes('左') ? 'left' : label.includes('右') ? 'right' : null)

test('人体図の部位が読めている（前面27・背面22。ID と名前は変えていない）', () => {
  assert.equal(regs.filter((r) => r.view === 'front').length, 27)
  assert.equal(regs.filter((r) => r.view === 'back').length, 22)
  const label = Object.fromEntries(regs.map((r) => [r.id, r.label]))
  assert.equal(label.fkl, '左膝')
  assert.equal(label.fkr, '右膝')
  assert.equal(label.fsl, '左肩')
  assert.equal(label.fsr, '右肩')
  assert.equal(label.fal, '左足関節')
  assert.equal(label.bsl, '左肩後')
  assert.equal(label.bhel, '左踵')
  // 名前の「左・右」と、ID の最後の l・r がそろっている（カルテの左右の読み取りは ID の最後の文字）
  for (const r of regs) {
    const s = side(r.label)
    if (s) assert.equal(r.id.endsWith('l') ? 'left' : 'right', s, `${r.id} ${r.label}`)
  }
})

test('前面は、向かって左が患者さんの右（右肩・右膝…は図の左半分、左は右半分）', () => {
  for (const r of regs.filter((x) => x.view === 'front')) {
    const s = side(r.label)
    if (s === 'right') assert.ok(r.cx < 100, `${r.label} cx=${r.cx}`)
    if (s === 'left') assert.ok(r.cx > 100, `${r.label} cx=${r.cx}`)
    if (!s) assert.equal(r.cx, 100, `${r.label} はまん中`)
  }
})

test('背面は、向かって左が患者さんの左（後ろから見た向き）', () => {
  for (const r of regs.filter((x) => x.view === 'back')) {
    const s = side(r.label)
    if (s === 'left') assert.ok(r.cx < 100, `${r.label} cx=${r.cx}`)
    if (s === 'right') assert.ok(r.cx > 100, `${r.label} cx=${r.cx}`)
  }
})

test('左右の組は、まん中をはさんで同じ位置（押しまちがえないように）', () => {
  for (const r of regs.filter((x) => side(x.label) === 'left')) {
    const pair = regs.find((x) => x.view === r.view && x.label === r.label.replace('左', '右'))
    assert.ok(pair, r.label)
    assert.equal(r.cx + pair.cx, 200, `${r.label} と ${pair.label}`)
  }
})

test('図に「右」「左」の文字を出している（前面は向かって左が右）', () => {
  assert.match(bodySrc, /<text x=\{8\} y=\{20\}>\{view === 'front' \? '右' : '左'\}<\/text>/)
  assert.match(bodySrc, /\{view === 'front' \? '左' : '右'\}<\/text>/)
})

test('腰部の解剖図（後面）：右の部位は図の右半分、左は左半分。ID と名前は変えていない', () => {
  const lumbar = JSON.parse(readFileSync(new URL('src/lib/anatomy/zones/lumbar.json', root), 'utf8'))
  assert.equal(lumbar.mirrorForLeft, false)
  const post = lumbar.views.find((v) => v.view === 'posterior')
  assert.equal(post.width, L.LUMBAR_POSTERIOR_WIDTH)
  const cx = (z) => z.polygon.reduce((s, p) => s + p[0], 0) / z.polygon.length
  const by = Object.fromEntries(post.zones.map((z) => [z.id, z]))
  for (const id of ['lum_para_r', 'lum_si_r', 'lum_glut_r']) {
    assert.ok(by[id].label.startsWith('右'), id)
    assert.ok(cx(by[id]) > post.width / 2, `${id} cx=${cx(by[id])}`)
    assert.ok(by[id].labelAt[0] > post.width / 2, `${id} の名札`)
  }
  for (const id of ['lum_para_l', 'lum_si_l', 'lum_glut_l']) {
    assert.ok(by[id].label.startsWith('左'), id)
    assert.ok(cx(by[id]) < post.width / 2, `${id} cx=${cx(by[id])}`)
    assert.ok(by[id].labelAt[0] < post.width / 2, `${id} の名札`)
  }
  for (const id of ['lum_l1', 'lum_l3', 'lum_l5']) assert.ok(Math.abs(cx(by[id]) - 500) < 5, id)
})

const marks = () => ({ pins: [[60, 97]], strokes: [[[86, 280], [90, 290]]] })

test('印の左右の入れかえ（x → 幅 − x。もとの印は変えない）', () => {
  const m = marks()
  const out = L.mirrorViewMarks(m, 200)
  assert.deepEqual(out, { pins: [[140, 97]], strokes: [[[114, 280], [110, 290]]] })
  assert.deepEqual(m, marks())
  assert.deepEqual(L.mirrorViewMarks(out, 200), m) // 2回で元に戻る
})

test('人体図の印：前の決まりの記録（版なし）は前面だけ入れかえる。いまの版の記録はそのまま', () => {
  const old = { front: marks(), back: marks() }
  const shown = L.bodyMarksForLayout(old, undefined)
  assert.deepEqual(shown.front.pins, [[140, 97]])
  assert.deepEqual(shown.back, marks()) // 背面は変わっていない
  assert.deepEqual(old.front, marks())
  assert.equal(L.bodyMarksForLayout(old, L.DIAGRAM_LAYOUT), old)
  assert.equal(L.bodyMarksForLayout(undefined, undefined), undefined)
  assert.deepEqual(L.bodyMarksForLayout({ back: marks() }, undefined), { back: marks() })
})

test('解剖図の印：前の決まりの記録は腰部の後面だけ入れかえる（膝など・腰部の外側はそのまま）', () => {
  const old = {
    腰部: { posterior: { pins: [[300, 400]], strokes: [] }, lateral: { pins: [[300, 400]], strokes: [] } },
    膝関節: { anterior: { pins: [[300, 400]], strokes: [] } },
  }
  const shown = L.anatomyMarksForLayout(old, 1)
  assert.deepEqual(shown['腰部'].posterior.pins, [[700, 400]])
  assert.deepEqual(shown['腰部'].lateral.pins, [[300, 400]])
  assert.deepEqual(shown['膝関節'], old['膝関節'])
  assert.equal(L.anatomyMarksForLayout(old, L.DIAGRAM_LAYOUT), old)
  assert.equal(L.anatomyMarksForLayout({ 膝関節: old['膝関節'] }, undefined)['膝関節'], old['膝関節'])
})

test('経過のカルテへ引き継ぐとき、前の決まりの印は、いまの向きにして渡す', () => {
  const last = {
    id: 'n1', patientId: 'p', visitDate: '2026-11-10', visitNumber: 1, createdAt: '2026-11-10T01:00:00Z',
    painLocations: ['fkl'], painToday: 5, currentPhase: 3,
    bodyMarks: { front: marks() },
    anatomyMarks: { 腰部: { posterior: { pins: [[300, 400]], strokes: [] } } },
  }
  const c = F.carryForward(last)
  assert.deepEqual(c.bodyMarks.front.pins, [[140, 97]])
  assert.deepEqual(c.anatomyMarks['腰部'].posterior.pins, [[700, 400]])
  assert.deepEqual(c.painLocations, ['fkl']) // 部位（左膝）はそのまま
  assert.deepEqual(last.bodyMarks.front.pins, [[60, 97]]) // もとの記録は変えない
  // いまの版で書いた記録は、そのまま引き継ぐ
  const c2 = F.carryForward({ ...last, diagramLayout: L.DIAGRAM_LAYOUT })
  assert.deepEqual(c2.bodyMarks.front.pins, [[60, 97]])
})

test('人体図で押した部位 → 解剖図の関節と左右（ID の最後の l・r）。左踵でも足関節の図が出る', () => {
  assert.deepEqual(J.jointsFromPainLocations(['fkl'], ['膝関節']), [{ joint: '膝関節', side: 'left' }])
  assert.deepEqual(J.jointsFromPainLocations(['fkr'], ['膝関節']), [{ joint: '膝関節', side: 'right' }])
  assert.deepEqual(J.jointsFromPainLocations(['bhel'], ['足関節']), [{ joint: '足関節', side: 'left' }])
  assert.deepEqual(J.jointsFromPainLocations(['blb'], ['腰部']), [{ joint: '腰部', side: undefined }])
})

console.log(`\n${passed} 件成功・0 件失敗`)
