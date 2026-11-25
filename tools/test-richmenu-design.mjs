// 公式LINEのリッチメニューの絵と、押せる場所（2026-11-25 院長「LINEのメニューに「予約確認」のボタン…これを追加して」）
// 実行: npx tsx tools/test-richmenu-design.mjs
// 外には送らない（LINE には登録しない）。絵は、描いた場所を覚えるだけのにせのキャンバスで確かめる
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
const imp = (p) => import(new URL(p, root).href)
const read = (p) => fs.readFileSync(new URL(p, root), 'utf8')

let passed = 0
async function test(name, fn) {
  await fn()
  passed += 1
  console.log(`  ✓ ${name}`)
}

const D = await imp('src/lib/marketing/richmenu-design.ts')
const C = await imp('src/lib/reservation-check.ts')
const ALL = { karte: true, insta: true, check: true }

/** 描いた場所（x・y の範囲）と、書いた文字を覚えるだけのキャンバス */
function fakeCanvas() {
  const box = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity }
  const texts = []
  const see = (x, y) => {
    box.x0 = Math.min(box.x0, x)
    box.y0 = Math.min(box.y0, y)
    box.x1 = Math.max(box.x1, x)
    box.y1 = Math.max(box.y1, y)
  }
  const g = {
    box,
    texts,
    font: '',
    beginPath() {},
    closePath() {},
    fill() {},
    stroke() {},
    moveTo: see,
    lineTo: see,
    arcTo(x1, y1, x2, y2) {
      see(x1, y1)
      see(x2, y2)
    },
    arc(x, y, r) {
      see(x - r, y - r)
      see(x + r, y + r)
    },
    ellipse(x, y, rx, ry) {
      see(x - rx, y - ry)
      see(x + rx, y + ry)
    },
    fillRect(x, y, w, h) {
      see(x, y)
      see(x + w, y + h)
    },
    fillText(t, x, y) {
      const px = Number(/(\d+)px/.exec(g.font)?.[1] ?? 0)
      const w = [...t].length * px // 全角の字として広めに見積もる
      texts.push({ t, px })
      see(x - w / 2, y - px / 2)
      see(x + w / 2, y + px / 2)
    },
    createLinearGradient: () => ({ addColorStop() {} }),
  }
  return g
}
const overlap = (a, b) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height
const areaOf = (areas, label) => areas.find((a) => a.action.label === label)

console.log('リッチメニューの絵と押せる場所')

await test('押せる場所は8つ。画像（2500×1686）の中にあり、重ならない', () => {
  const areas = D.richMenuAreas(ALL)
  assert.equal(areas.length, 8)
  assert.deepEqual(
    areas.map((a) => a.action.label),
    ['電話で予約', 'アクセス', '初めての方へ', '料金', 'ネット予約', 'カルテ連携', 'Instagram', '予約確認'],
  )
  for (const a of areas) {
    const b = a.bounds
    assert.ok(b.x >= 0 && b.y >= 0 && b.width > 0 && b.height > 0, a.action.label)
    assert.ok(b.x + b.width <= D.RICH_W && b.y + b.height <= D.RICH_H, a.action.label)
  }
  for (let i = 0; i < areas.length; i++) for (let j = i + 1; j < areas.length; j++) assert.ok(!overlap(areas[i].bounds, areas[j].bounds), `${areas[i].action.label} と ${areas[j].action.label}`)
})

await test('LINE の決まり：押せる場所は20まで・ラベルは20字まで・送る言葉は300字まで・リンクは https か tel', () => {
  const areas = D.richMenuAreas(ALL)
  assert.ok(areas.length <= 20)
  for (const a of areas) {
    assert.ok(a.action.label.length > 0 && a.action.label.length <= 20, a.action.label)
    if (a.action.type === 'message') assert.ok(a.action.text.length > 0 && a.action.text.length <= 300)
    else assert.match(a.action.uri, /^(https:\/\/|tel:)/)
  }
})

await test('「予約確認」を押すと「予約確認」と送られ、その言葉に予約の返事が反応する', () => {
  const a = areaOf(D.richMenuAreas(ALL), '予約確認')
  assert.equal(a.action.type, 'message')
  assert.equal(a.action.text, C.RESERVATION_CHECK_KEYWORD)
  assert.equal(a.action.text, '予約確認')
  assert.ok(C.parseReservationCheck(a.action.text), 'ボタンの言葉に返事が反応しない')
})

await test('今までの7つの場所と行き先は変えていない', () => {
  const areas = D.richMenuAreas(ALL)
  const want = [
    ['電話で予約', 0, 420, 833, 590, 'tel:0832654545'],
    ['アクセス', 833, 420, 834, 590, 'https://maps.google.com/?cid=6709983637345638461'],
    ['初めての方へ', 1667, 420, 833, 590, '初めての方へ'],
    ['料金', 0, 1010, 833, 676, '料金'],
    ['ネット予約', 833, 1010, 834, 676, 'https://liff.line.me/2010991753-yKKnDDnb'],
    ['カルテ連携', 1667, 1010, 833, 676, 'https://liff.line.me/2010991753-yKKnDDnb/link'],
    ['Instagram', 2080, 60, 420, 320, 'https://www.instagram.com/yu.ki__seikotsuin'],
  ]
  for (const [label, x, y, width, height, to] of want) {
    const a = areaOf(areas, label)
    assert.deepEqual(a.bounds, { x, y, width, height }, label)
    assert.equal(a.action.type === 'message' ? a.action.text : a.action.uri, to, label)
  }
})

await test('えらび方：「予約確認」を外すと7つ・Instagram を外すと上の右が消える・カルテ連携を外すと右下は Instagram', () => {
  const noCheck = D.richMenuAreas({ ...ALL, check: false })
  assert.equal(noCheck.length, 7)
  assert.equal(areaOf(noCheck, '予約確認'), undefined)
  const noInsta = D.richMenuAreas({ ...ALL, insta: false })
  assert.equal(noInsta.length, 7)
  assert.equal(areaOf(noInsta, 'Instagram'), undefined)
  assert.ok(areaOf(noInsta, '予約確認'))
  const noKarte = D.richMenuAreas({ ...ALL, karte: false })
  assert.equal(areaOf(noKarte, 'カルテ連携'), undefined)
  const right = noKarte.find((a) => a.bounds.x === 1667 && a.bounds.y === 1010)
  assert.equal(right.action.uri, D.INSTAGRAM_URL)
  // もとの表は書きかえない
  assert.equal(areaOf(D.AREAS, 'カルテ連携').action.uri, D.KARTE_LINK_URL)
})

await test('「予約確認」の絵は、押せる場所の中に描く（はみ出さない・院の名前のところ＝x 600〜 にかからない）', () => {
  const g = fakeCanvas()
  D.drawReservationCheck(g)
  const b = areaOf(D.AREAS, '予約確認').bounds
  assert.ok(g.box.x0 >= b.x && g.box.x1 <= b.x + b.width, `横 ${g.box.x0}〜${g.box.x1}`)
  assert.ok(g.box.y0 >= b.y && g.box.y1 <= b.y + b.height, `縦 ${g.box.y0}〜${g.box.y1}`)
  assert.ok(g.box.x1 < 600)
  assert.deepEqual(
    g.texts.map((t) => t.t),
    ['予約確認'],
  )
  // スマホでは画像が横 400 ほどに縮む（約 1/6）。字は 60px 以上（スマホで 10 ほど）にしておく
  assert.ok(g.texts[0].px >= 60, `字の大きさ ${g.texts[0].px}`)
})

await test('Instagram・カルテ連携の絵も、それぞれの押せる場所の中', () => {
  for (const [label, draw] of [
    ['Instagram', D.drawInstagram],
    ['カルテ連携', D.drawKarte],
  ]) {
    const g = fakeCanvas()
    draw(g)
    const b = areaOf(D.AREAS, label).bounds
    assert.ok(g.box.x0 >= b.x && g.box.x1 <= b.x + b.width, `${label} 横 ${g.box.x0}〜${g.box.x1}`)
    assert.ok(g.box.y0 >= b.y && g.box.y1 <= b.y + b.height, `${label} 縦 ${g.box.y0}〜${g.box.y1}`)
  }
})

await test('左右をそろえる：「予約確認」と Instagram は、同じ大きさの枠を左右の同じ位置に', () => {
  const a = areaOf(D.AREAS, '予約確認').bounds
  const i = areaOf(D.AREAS, 'Instagram').bounds
  assert.equal(a.y, i.y)
  assert.equal(a.width, i.width)
  assert.equal(a.height, i.height)
  assert.equal(a.x, D.RICH_W - (i.x + i.width))
})

await test('院長用の画面は、この絵と場所を使う（画面の中に別の表を持たない）・登録の前に確かめる', () => {
  const page = read('src/app/(app)/marketing/line/richmenu/page.tsx')
  assert.match(page, /from '@\/lib\/marketing\/richmenu-design'/)
  assert.match(page, /richMenuAreas\(\{ karte, insta, check \}\)/)
  assert.match(page, /if \(check\) drawReservationCheck\(g\)/)
  assert.ok(!/const AREAS\b/.test(page), '画面の中に押せる場所の表が残っている')
  assert.match(page, /window\.confirm\(/)
})

console.log(`\n${passed} 件すべて通りました`)
