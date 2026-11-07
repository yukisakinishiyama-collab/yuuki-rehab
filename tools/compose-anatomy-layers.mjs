// 確定した層のWebPから互換用の1枚絵を再生成する。
// node tools/compose-anatomy-layers.mjs knee shoulder
import assert from 'node:assert/strict'
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const root = fileURLToPath(new URL('..', import.meta.url))
const keys = process.argv.slice(2)
assert.ok(keys.length, '関節keyを指定してください: knee shoulder')
const publicPath = path => resolve(root, 'public', path.replace(/^\//, ''))

for (const key of keys) {
  assert.match(key, /^[a-z]+$/, '関節keyが不正')
  const spec = JSON.parse(readFileSync(resolve(root, `src/lib/anatomy/zones/${key}.json`), 'utf8'))
  for (const view of spec.views) {
    assert.equal(view.layers?.[0]?.key, 'bone', `${key}/${view.view}: 最下層にboneが必要`)
    for (const layer of view.layers) {
      const metadata = await sharp(publicPath(layer.image)).metadata()
      assert.equal(metadata.width, view.width, layer.image)
      assert.equal(metadata.height, view.height, layer.image)
    }
    // 必ず納品するWebPを入力にする。原画を合成してから各層を非可逆圧縮すると不一致になる。
    const composite = await sharp(publicPath(view.layers[0].image))
      .composite(view.layers.slice(1).map(layer => ({ input: publicPath(layer.image) })))
      .removeAlpha().webp({ lossless: true, effort: 6 }).toBuffer()
    assert.ok(composite.length <= 400000, `${key}/${view.view}: 400KB超過。原画・各層を調整して再実行してください`)
    writeFileSync(publicPath(view.image), composite)
    console.log(`${key}/${view.view}: ${composite.length} bytes`)
  }
}

