// 納品画像の実寸・alpha・合成差分と、重なった部位の押せる範囲を確認する。
// node tools/review-anatomy-layers.mjs [出力先]
import assert from 'node:assert/strict'
import { mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const root = fileURLToPath(new URL('..', import.meta.url))
const out = resolve(root, process.argv[2] ?? '.post-images/anatomy-review')
mkdirSync(out, { recursive: true })
const publicPath = (p) => resolve(root, 'public', p.replace(/^\//, ''))
const canonical = readFileSync(resolve(root, 'src/components/rehab-management/JointDetailMap.tsx'), 'utf8')
const definitions = new Map([...canonical.matchAll(/id:\s*'([^']+)',\s*label:\s*'([^']+)',\s*type:\s*'([^']+)'/g)].map(m => [m[1], { label: m[2], type: m[3] }]))
const report = []
const palette = ['#d97706', '#0891b2', '#9333ea', '#dc2626', '#16a34a', '#2563eb', '#a16207', '#db2777']
const svg = (body) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="1300">${body}</svg>`)

function contains([x, y], poly) {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j]
    if (((yi > y) !== (yj > y)) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside
  }
  return inside
}

async function contact(filename, images, columns, headings) {
  const w = 300, h = 390, head = 30
  const overlays = []
  for (let i = 0; i < images.length; i++) {
    const x = i % columns * w, y = Math.floor(i / columns) * (h + head)
    overlays.push({ input: await sharp(images[i]).resize(w, h).png().toBuffer(), left: x, top: y + head })
    const title = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${head}"><text x="8" y="21" font-size="15" font-family="sans-serif">${headings[i]}</text></svg>`
    overlays.push({ input: Buffer.from(title), left: x, top: y })
  }
  await sharp({ create: { width: w * columns, height: Math.ceil(images.length / columns) * (h + head), channels: 3, background: '#fff' } }).composite(overlays).webp({ quality: 80, effort: 6 }).toFile(resolve(out, filename))
}

for (const key of ['knee', 'ankle', 'shoulder']) {
  const spec = JSON.parse(readFileSync(resolve(root, `src/lib/anatomy/zones/${key}.json`), 'utf8'))
  const comparisons = [], comparisonTitles = [], isolated = [], isolatedTitles = [], zoneImages = [], zoneTitles = []
  for (const view of spec.views) {
    const images = [view.image, ...view.layers.map(l => l.image)]
    const sizes = {}
    for (const path of images) {
      const file = publicPath(path), meta = await sharp(file).metadata()
      assert.equal(meta.width, 1000, path)
      assert.equal(meta.height, 1300, path)
      assert.equal(meta.format, 'webp', path)
      sizes[path.split('/').pop()] = statSync(file).size
      assert.ok(statSync(file).size <= 400000, `${path}: 400KB超過`)
    }
    const bone = publicPath(view.layers.find(l => l.key === 'bone').image)
    const tissue = publicPath(view.layers.find(l => l.key === 'ligament').image)
    const pixels = await sharp(tissue).ensureAlpha().raw().toBuffer()
    assert.ok((await sharp(tissue).metadata()).hasAlpha, `${tissue}: alphaなし`)
    let transparent = 0, visible = 0
    for (let i = 3; i < pixels.length; i += 4) {
      if (pixels[i] === 0) transparent++
      else visible++
    }
    assert.ok(transparent > 130000 && visible > 1000, `${tissue}: 透過/描画範囲が不正`)
    for (const [x, y] of [[0, 0], [999, 0], [0, 1299], [999, 1299]]) assert.equal(pixels[(y * 1000 + x) * 4 + 3], 0, '角が透過でない')
    const bp = await sharp(bone).ensureAlpha().raw().toBuffer()
    for (let i = 3; i < bp.length; i += 4) assert.equal(bp[i], 255, `${bone}: 不透明でない`)
    for (const [x, y] of [[0, 0], [999, 0], [0, 1299], [999, 1299]]) assert.deepEqual([...bp.subarray((y * 1000 + x) * 4, (y * 1000 + x) * 4 + 3)], [255, 255, 255], '角が白でない')

    const flat = publicPath(view.image)
    const stack = await sharp(bone).composite(view.layers.filter(l => l.key !== 'bone').map(l => ({ input: publicPath(l.image) }))).removeAlpha().png().toBuffer()
    const actual = await sharp(stack).removeAlpha().toColourspace('srgb').raw().toBuffer()
    const expected = await sharp(flat).removeAlpha().toColourspace('srgb').raw().toBuffer()
    const difference = Buffer.alloc(actual.length), blend = Buffer.alloc(actual.length)
    let total = 0, max = 0, changedPixels = 0
    for (let i = 0; i < actual.length; i += 3) {
      let changed = false
      for (let c = 0; c < 3; c++) {
        const delta = Math.abs(actual[i + c] - expected[i + c])
        total += delta; max = Math.max(max, delta); changed ||= delta > 2
        difference[i + c] = Math.min(255, delta * 5)
        blend[i + c] = Math.round((actual[i + c] + expected[i + c]) / 2)
      }
      if (changed) changedPixels++
    }
    // 全関節とも最終WebPの層から1枚絵を書き出し、デコード後の画素も一致させる。
    assert.equal(max, 0, `${key}/${view.view}: 層の合成と1枚絵が不一致`)
    const diffPNG = await sharp(difference, { raw: { width: 1000, height: 1300, channels: 3 } }).png().toBuffer()
    const blendPNG = await sharp(blend, { raw: { width: 1000, height: 1300, channels: 3 } }).png().toBuffer()
    comparisons.push(flat, stack, blendPNG, diffPNG)
    comparisonTitles.push(`${view.view} / original`, 'layers combined', '50% overlay', 'absolute difference x5')
    const tissuePreview = await sharp(tissue).flatten({ background: '#dce6e8' }).png().toBuffer()
    isolated.push(bone, tissuePreview)
    isolatedTitles.push(`${view.view} / bone`, 'ligament on blue-gray')

    const hitSamples = {}
    const hit = (point, zones) => [...zones].reverse().find(z => contains(point, z.polygon))?.id
    for (const z of view.zones) {
      assert.deepEqual({ label: z.label, type: z.type }, definitions.get(z.id), `${z.id}: label/typeが不一致`)
      const xs = z.polygon.map(p => p[0]), ys = z.polygon.map(p => p[1])
      assert.ok(Math.max(...xs) - Math.min(...xs) >= 60 && Math.max(...ys) - Math.min(...ys) >= 60, `${z.id}: 外接寸法60px未満`)
      let sample
      for (let y = Math.min(...ys) + 4; y <= Math.max(...ys) - 4 && !sample; y += 4) {
        for (let x = Math.min(...xs) + 4; x <= Math.max(...xs) - 4; x += 4) {
          if ([[x,y],[x-2,y],[x+2,y],[x,y-2],[x,y+2]].every(p => hit(p, view.zones) === z.id)) { sample = [x, y]; break }
        }
      }
      assert.ok(sample, `${view.view}/${z.id}: 他の領域に覆われて押せない`)
      hitSamples[z.id] = sample
      const mirrored = view.zones.map(zz => ({ ...zz, polygon: zz.polygon.map(([x, y]) => [1000 - x, y]) }))
      assert.equal(hit([1000 - sample[0], sample[1]], mirrored), z.id, '反転時のIDが不一致')
    }
    const polygons = view.zones.map((z, i) => {
      const p = z.labelAt ?? z.polygon[0], color = palette[i % palette.length]
      return `<polygon points="${z.polygon.map(a => a.join(',')).join(' ')}" fill="${color}" fill-opacity=".18" stroke="${color}" stroke-width="3"/><text x="${p[0]}" y="${p[1]}" font-size="20" text-anchor="middle" fill="#122" stroke="white" stroke-width="3" paint-order="stroke">${z.id}</text>`
    }).join('')
    const zonePNG = await sharp(stack).composite([{ input: svg(polygons) }]).png().toBuffer()
    zoneImages.push(zonePNG, await sharp(zonePNG).flop().png().toBuffer())
    zoneTitles.push(`${view.view} / right`, `${view.view} / mirrored (QA)`)
    report.push({ joint: key, view: view.view, sizes, transparentPixels: transparent, visiblePixels: visible, maxChannelDifference: max, meanChannelDifference: Number((total / actual.length).toFixed(6)), pixelsDifferentByMoreThan2: changedPixels, exactCompositeMatch: max === 0, hitSamples })
    console.log(`${key}/${view.view}: max Δ=${max}, mean Δ=${(total / actual.length).toFixed(4)} / 255; alpha・実寸・容量・押せる領域・反転 OK`)
  }
  await contact(`${key}-comparison.webp`, comparisons, 4, comparisonTitles)
  await contact(`${key}-isolated.webp`, isolated, 2, isolatedTitles)
  await contact(`${key}-zones.webp`, zoneImages, 2, zoneTitles)
}
writeFileSync(resolve(out, 'metrics.json'), JSON.stringify(report, null, 2) + '\n')
console.log(`確認画像と数値: ${out}`)
console.log('全方向で層の合成と1枚絵が画素単位で完全一致。')
