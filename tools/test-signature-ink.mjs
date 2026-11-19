// 署名欄の「どの指（ペン）の線を書くか」の決まり（2026-11-19「タブレットで書くと変に反応する」の見直し）の確認
// 実行: npx tsx tools/test-signature-ink.mjs
// 外には送らない。画面は使わない（決まりだけ）
import assert from 'node:assert/strict'

const root = new URL('../', import.meta.url)
const I = await import(new URL('src/lib/contracts/signature-ink.ts', root).href)
const { InkArbiter } = I

let passed = 0
function test(name, fn) {
  fn()
  passed += 1
  console.log(`  ✓ ${name}`)
}

const FINGER = 1
const PALM = 2
const PEN = 9
const touch = (pointerId, x, y, t) => ({ pointerId, type: 'touch', x, y, t })
const pen = (x, y, t) => ({ pointerId: PEN, type: 'pen', x, y, t })
/** 指で横に線を引く（from から to まで 10px ずつ） */
function drag(ink, id, x0, x1, y, t0) {
  let t = t0
  for (let x = x0 + 10; x <= x1; x += 10) ink.move(id, x, y, (t += 8))
  return t
}
/** 線の中に、となりの点から大きく離れた点（とび）が無いこと */
function noJump(stroke, max = 30) {
  for (let i = 1; i < stroke.points.length; i += 1) {
    const a = stroke.points[i - 1]
    const b = stroke.points[i]
    assert.ok(Math.hypot(b.x - a.x, b.y - a.y) <= max, `点がとんでいる（${JSON.stringify(a)} → ${JSON.stringify(b)}）`)
  }
}

test('指1本で書く：触れる → 動かす → 離す で1画', () => {
  const ink = new InkArbiter()
  assert.ok(ink.isEmpty)
  assert.deepEqual(ink.down(touch(FINGER, 50, 60, 0)), { accepted: true, removed: false })
  assert.ok(ink.isDrawing && ink.isActivePointer(FINGER))
  const t = drag(ink, FINGER, 50, 150, 60, 0)
  assert.equal(ink.up(FINGER, t + 5), true)
  assert.equal(ink.up(FINGER, t + 6), false, '2回目の「離した」は何もしない')
  assert.ok(!ink.isDrawing && !ink.isEmpty)
  assert.equal(ink.strokes.length, 1)
  assert.equal(ink.strokes[0].points.length, 11)
  noJump(ink.strokes[0])
})

test('書いている途中で手のひら（もう1本の指）が触れても、指の線だけ。手のひらへ線が引かれない', () => {
  const ink = new InkArbiter()
  ink.down(touch(FINGER, 50, 60, 0))
  let t = drag(ink, FINGER, 50, 150, 60, 0)
  // 手のひらが右下に触れて、小さく動く
  assert.deepEqual(ink.down(touch(PALM, 600, 140, t + 1)), { accepted: false, removed: false })
  assert.equal(ink.move(PALM, 604, 141, t + 2), null)
  t = drag(ink, FINGER, 150, 300, 60, t + 3)
  assert.equal(ink.move(PALM, 598, 139, t + 1), null)
  // 指を先に離す。手のひらは残っているが、何も書かない
  assert.equal(ink.up(FINGER, t + 2), true)
  assert.equal(ink.move(PALM, 610, 141, t + 3), null)
  assert.equal(ink.up(PALM, t + 4), false)
  assert.equal(ink.cancel(PALM, t + 5), 'none')
  assert.equal(ink.strokes.length, 1)
  assert.ok(ink.strokes[0].points.every((p) => p.y === 60 && p.x <= 300), '手のひらの場所の点が入っていない')
  noJump(ink.strokes[0])
  // 手のひらを置いたまま、次の画を書ける
  assert.equal(ink.down(touch(FINGER, 320, 60, t + 200)).accepted, true)
})

test('手のひらが先に触れていた（ほとんど動いていない）ときは、あとから触れた指で書く。手のひらの点は消す', () => {
  const ink = new InkArbiter()
  ink.down(touch(PALM, 600, 140, 0))
  ink.move(PALM, 603, 142, 50)
  assert.deepEqual(ink.down(touch(FINGER, 50, 60, 180)), { accepted: true, removed: true })
  assert.equal(ink.strokes.length, 1, '手のひらの点は消えている')
  const t = drag(ink, FINGER, 50, 200, 60, 180)
  assert.equal(ink.move(PALM, 606, 141, t + 1), null, '手のひらは、もう書かない')
  ink.up(FINGER, t + 2)
  assert.ok(ink.strokes[0].points.every((p) => p.y === 60))
})

test('手のひらが、ゆっくり少しずつ動いていたときも、手のひらと見る（長く触れていて動きが小さい）', () => {
  const ink = new InkArbiter()
  ink.down(touch(PALM, 600, 140, 0))
  for (let i = 1; i <= 15; i += 1) ink.move(PALM, 600 + i * 2, 140, i * 50) // 750ms で 30px
  assert.equal(ink.down(touch(FINGER, 50, 60, 800)).accepted, true)
  assert.equal(ink.strokes.length, 1)
  assert.equal(ink.strokes[0].points[0].x, 50)
})

test('ちゃんと書いている線（大きく動いている）の途中で、もう1本の指が触れても、書いている指のまま', () => {
  const ink = new InkArbiter()
  ink.down(touch(FINGER, 50, 60, 0))
  const t = drag(ink, FINGER, 50, 120, 60, 0)
  assert.equal(ink.down(touch(PALM, 55, 62, t + 1)).accepted, false)
  // すばやく短い線を書いた直後（動きはまだ小さいが、時間もたっていない）は……動きが 20px をこえていれば指のまま
  const quick = new InkArbiter()
  quick.down(touch(FINGER, 50, 60, 0))
  quick.move(FINGER, 75, 60, 30)
  assert.equal(quick.down(touch(PALM, 400, 100, 40)).accepted, false)
})

test('ペンが優先：指・手のひらが書いている途中でも、ペンが触れたらペンの線にする（先の線は消す）', () => {
  const ink = new InkArbiter()
  ink.down(touch(PALM, 500, 130, 0))
  const t = drag(ink, PALM, 500, 620, 130, 0) // 手のひらが大きくすべっていても
  assert.deepEqual(ink.down(pen(60, 50, t + 1)), { accepted: true, removed: true })
  assert.equal(ink.strokes.length, 1)
  assert.equal(ink.strokes[0].type, 'pen')
  assert.equal(ink.move(PALM, 630, 130, t + 2), null)
  // ペンで書いている間の指・手のひらは受けつけない
  assert.equal(ink.down(touch(3, 300, 100, t + 3)).accepted, false)
  ink.move(PEN, 90, 55, t + 10)
  ink.up(PEN, t + 20)
  assert.equal(ink.strokes[0].points.length, 2)
})

test('ペンを離してから少しの間（画と画の間）は、指・手のひらを受けつけない。時間がたてば指でも書ける', () => {
  const ink = new InkArbiter()
  ink.down(pen(60, 50, 1000))
  ink.move(PEN, 100, 50, 1010)
  ink.up(PEN, 1020)
  assert.equal(ink.down(touch(PALM, 500, 130, 1020 + 200)).accepted, false)
  assert.equal(ink.down(touch(PALM, 500, 130, 1020 + I.PEN_GUARD_MS - 1)).accepted, false)
  // ペンを浮かせて動かしている間も、のびる
  ink.penSeen(3000)
  assert.equal(ink.down(touch(PALM, 500, 130, 3000 + I.PEN_GUARD_MS - 1)).accepted, false)
  assert.equal(ink.down(touch(FINGER, 200, 60, 3000 + I.PEN_GUARD_MS + 1)).accepted, true)
  assert.equal(ink.strokes.length, 2)
  // 「書き直す」のあとは、すぐ指で書ける
  ink.clear()
  assert.ok(ink.isEmpty && !ink.isDrawing)
  assert.equal(ink.down(touch(FINGER, 200, 60, 3000 + I.PEN_GUARD_MS + 2)).accepted, true)
})

test('端末が取り消した指（手のひら）の線は消す。ペン・マウスの線は、そこまでで残す', () => {
  const ink = new InkArbiter()
  ink.down(touch(FINGER, 50, 60, 0))
  ink.up(FINGER, drag(ink, FINGER, 50, 150, 60, 0))
  ink.down(touch(PALM, 500, 130, 500))
  drag(ink, PALM, 500, 560, 130, 500)
  assert.equal(ink.cancel(PALM, 600), 'removed')
  assert.equal(ink.strokes.length, 1, '先に書いた1画は残る')
  assert.ok(!ink.isDrawing)

  const p = new InkArbiter()
  p.down(pen(60, 50, 0))
  p.move(PEN, 100, 50, 10)
  assert.equal(p.cancel(PEN, 20), 'kept')
  assert.equal(p.strokes.length, 1)
  assert.ok(!p.isDrawing)

  const m = new InkArbiter()
  m.down({ pointerId: 1, type: 'mouse', x: 10, y: 10, t: 0, button: 0 })
  m.move(1, 40, 10, 10)
  assert.equal(m.cancel(1, 20), 'kept')
  assert.equal(m.cancel(1, 21), 'none')
})

test('マウスは左ボタンだけ。知らない種類はマウスとして扱う', () => {
  const ink = new InkArbiter()
  assert.equal(ink.down({ pointerId: 1, type: 'mouse', x: 10, y: 10, t: 0, button: 2 }).accepted, false)
  assert.ok(ink.isEmpty)
  assert.equal(ink.down({ pointerId: 1, type: 'mouse', x: 10, y: 10, t: 1, button: 0 }).accepted, true)
  ink.up(1, 5)
  assert.equal(ink.down({ pointerId: 1, type: '', x: 30, y: 10, t: 10 }).accepted, true)
  assert.equal(ink.strokes[1].type, 'mouse')
})

test('「離した」が届かなかったときも、署名欄が書けなくならない', () => {
  // 動いていた線（離した知らせが届かない）→ しばらくして別の指：前の線は残して、新しい線を書く
  const ink = new InkArbiter()
  ink.down(touch(FINGER, 50, 60, 0))
  const t = drag(ink, FINGER, 50, 200, 60, 0)
  assert.equal(ink.down(touch(5, 300, 60, t + I.STALE_MS - 100)).accepted, false, 'まだ書いている途中かもしれない間は、受けつけない')
  assert.deepEqual(ink.down(touch(5, 300, 60, t + I.STALE_MS + 100)), { accepted: true, removed: false })
  assert.equal(ink.strokes.length, 2)
  // 同じ指の「触れた」がもう一度来た：前の線は残して、新しい線
  const again = new InkArbiter()
  again.down(touch(FINGER, 50, 60, 0))
  again.move(FINGER, 90, 60, 10)
  assert.deepEqual(again.down(touch(FINGER, 200, 60, 20)), { accepted: true, removed: false })
  assert.equal(again.strokes.length, 2)
  // ペンの「離した」が届かない → 時間がたてば指で書ける（ペンの線は残る）
  const stuck = new InkArbiter()
  stuck.down(pen(60, 50, 0))
  stuck.move(PEN, 120, 50, 10)
  assert.equal(stuck.down(touch(FINGER, 300, 60, 500)).accepted, false)
  assert.equal(stuck.down(touch(FINGER, 300, 60, 10 + I.PEN_GUARD_MS + 1)).accepted, true)
  assert.equal(stuck.strokes.length, 2)
  // 置いたままの手のひら（何も届かない）→ 別の指：手のひらの点は消す
  const palm = new InkArbiter()
  palm.down(touch(PALM, 600, 140, 0))
  assert.deepEqual(palm.down(touch(FINGER, 50, 60, 5000)), { accepted: true, removed: true })
  assert.equal(palm.strokes.length, 1)
})

test('1つ戻す・書き直す', () => {
  const ink = new InkArbiter()
  assert.equal(ink.undo(), false)
  for (let s = 0; s < 3; s += 1) {
    ink.down(touch(FINGER, 50 + s * 100, 60, s * 1000))
    ink.up(FINGER, drag(ink, FINGER, 50 + s * 100, 100 + s * 100, 60, s * 1000))
  }
  assert.equal(ink.strokes.length, 3)
  assert.equal(ink.undo(), true)
  assert.equal(ink.strokes.length, 2)
  assert.equal(ink.strokes[1].points[0].x, 150)
  // 書いている途中で戻す → その線が消える
  ink.down(touch(FINGER, 400, 60, 5000))
  ink.move(FINGER, 440, 60, 5010)
  assert.equal(ink.undo(), true)
  assert.ok(!ink.isDrawing)
  assert.equal(ink.strokes.length, 2)
  assert.equal(ink.move(FINGER, 460, 60, 5020), null)
  ink.clear()
  assert.ok(ink.isEmpty)
})

test('同じ場所の点は足さない（触れているだけで点が増えない）', () => {
  const ink = new InkArbiter()
  ink.down(touch(FINGER, 50, 60, 0))
  assert.equal(ink.move(FINGER, 50.2, 60.1, 5), null)
  assert.deepEqual(ink.move(FINGER, 51, 60, 10), { x: 51, y: 60 })
  assert.equal(ink.current.points.length, 2)
})

test('線の形：点 → まっすぐ → 曲線 … → 最後の点まで。区切りはつながっている', () => {
  const pts = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 20, y: 10 }, { x: 30, y: 10 }]
  assert.deepEqual(I.segmentsOf([pts[0]]), [{ kind: 'dot', x: 0, y: 0 }])
  assert.equal(I.tailSegment([pts[0]]), null)
  const segs = I.segmentsOf(pts)
  assert.deepEqual(segs.map((s) => s.kind), ['dot', 'line', 'curve', 'curve', 'line'])
  assert.deepEqual(segs[1], { kind: 'line', x1: 0, y1: 0, x2: 5, y2: 0 })
  assert.deepEqual(segs[2], { kind: 'curve', x1: 5, y1: 0, cx: 10, cy: 0, x2: 15, y2: 5 })
  assert.deepEqual(segs[4], { kind: 'line', x1: 25, y1: 10, x2: 30, y2: 10 })
  for (let i = 2; i < segs.length; i += 1) {
    assert.deepEqual([segs[i].x1, segs[i].y1], [segs[i - 1].x2, segs[i - 1].y2], '前の区切りの終わりから始まる')
  }
  // 書いている途中に1点ずつ足すときも、同じ形になる
  const live = []
  for (let i = 0; i < pts.length; i += 1) live.push(I.segmentForPoint(pts.slice(0, i + 1), i))
  live.push(I.tailSegment(pts))
  assert.deepEqual(live, segs)
  assert.equal(I.segmentForPoint(pts, 9), null)
})

test('欄の高さ：スマホは 150、タブレット・パソコンは 200', () => {
  assert.equal(I.padHeightFor(340), 150)
  assert.equal(I.padHeightFor(559), 150)
  assert.equal(I.padHeightFor(560), 200)
  assert.equal(I.padHeightFor(720), 200)
})

console.log(`\n${passed} 件 OK`)
