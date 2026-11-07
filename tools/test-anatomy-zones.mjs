// 解剖図の座標データの検査（Codex が納品したら必ず通すこと）
// 実行: node tools/test-anatomy-zones.mjs
// 見るもの: JSON の形、部位IDが既存の一覧と一致するか、多角形が画像の中に収まるか、画像ファイルがあるか
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const ZONES_DIR = join(ROOT, 'src/lib/anatomy/zones')
const PUBLIC = join(ROOT, 'public')
const VIEWS = ['anterior', 'posterior', 'medial', 'lateral', 'superior', 'palmar', 'dorsal']
const TYPES = ['ligament', 'tendon', 'meniscus', 'muscle', 'nerve', 'bursa', 'cartilage', 'bone']

// 既存の部位ID（JointDetailMap.tsx から読む。カルテの保存値なので、ここに無いIDは使えない）
const src = readFileSync(join(ROOT, 'src/components/rehab-management/JointDetailMap.tsx'), 'utf8')
const known = {}
let joint = null
for (const line of src.slice(src.indexOf('const JOINT_ZONES')).split('\n')) {
  const j = line.match(/^\s*'([^']+)':\s*\[/)
  if (j) { joint = j[1]; known[joint] = new Set(); continue }
  const z = line.match(/id:\s*'([^']+)'/)
  if (z && joint) known[joint].add(z[1])
  if (line.startsWith('const SILHOUETTE_MAP')) break
}

let failed = 0
const fail = (m) => { failed += 1; console.log(`  ✗ ${m}`) }
const ok = (m) => console.log(`  ✓ ${m}`)

for (const file of readdirSync(ZONES_DIR).filter((f) => f.endsWith('.json'))) {
  console.log(file)
  const spec = JSON.parse(readFileSync(join(ZONES_DIR, file), 'utf8'))
  if (!spec.joint || !spec.key || !Array.isArray(spec.views)) { fail('joint / key / views がありません'); continue }
  if (!known[spec.joint]) { fail(`関節名「${spec.joint}」は JointDetailMap に無い`); continue }
  if (spec.views.length === 0) { ok('views が空（未納品。従来の図を使う）'); continue }
  const seen = new Set()
  for (const v of spec.views) {
    if (!VIEWS.includes(v.view)) fail(`view「${v.view}」は使えない（${VIEWS.join('/')}）`)
    if (seen.has(v.view)) fail(`view「${v.view}」が重複`)
    seen.add(v.view)
    if (!(v.width > 0 && v.height > 0)) fail(`${v.view}: width/height が無い`)
    const img = join(PUBLIC, String(v.image || '').replace(/^\//, ''))
    if (!v.image || !existsSync(img)) fail(`${v.view}: 画像が無い ${v.image}`)
    else if (statSync(img).size > 400 * 1024) fail(`${v.view}: 画像が 400KB を超えている（${Math.round(statSync(img).size / 1024)}KB）`)
    else ok(`${v.view}: 画像あり ${v.image}`)
    if (!Array.isArray(v.zones) || v.zones.length === 0) { fail(`${v.view}: zones が空`); continue }
    for (const z of v.zones) {
      if (!known[spec.joint].has(z.id)) fail(`${v.view}: 部位ID「${z.id}」は既存一覧に無い`)
      if (!TYPES.includes(z.type)) fail(`${v.view}: ${z.id} の type「${z.type}」は使えない`)
      if (!z.label) fail(`${v.view}: ${z.id} に label が無い`)
      if (!Array.isArray(z.polygon) || z.polygon.length < 3) fail(`${v.view}: ${z.id} の polygon は3点以上`)
      else for (const [x, y] of z.polygon) {
        if (!(x >= 0 && x <= v.width && y >= 0 && y <= v.height)) { fail(`${v.view}: ${z.id} の点 (${x},${y}) が画像の外`); break }
      }
    }
    ok(`${v.view}: 部位 ${v.zones.length}件`)
  }
  const covered = new Set(spec.views.flatMap((v) => v.zones.map((z) => z.id)))
  const missing = [...known[spec.joint]].filter((id) => !covered.has(id))
  if (missing.length) fail(`どの向きにも無い部位ID: ${missing.join(', ')}`)
  else ok('既存の部位IDをすべてどこかの向きで押せる')
}
console.log(failed ? `\n${failed}件の問題` : '\n問題なし')
process.exit(failed ? 1 : 0)
