// NOAH の「来院者日報」（PDF）を読んで、その日の合計（数字だけ）を保存する決まりの確認（2026-11-27 院長「NOAHの日報をのせます」「PDFでした」）
// 実行: npx tsx tools/test-noah-daily.mjs
// 外には送らない。PDF はこのテストの中で作る架空のもの（お名前・番号はすべて作りもの）。KV は一時フォルダのファイル。
// 本物の PDF で試すときは NOAH_DAILY_PDF=ファイルの場所 を付けて実行すると、合計だけを表示する（お名前は出さない）。
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import zlib from 'node:zlib'
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

const { extractPdfLines, parseToUnicode, parseCidWidths } = await imp('src/lib/pdf-text.ts')
const { parseNoahDaily, amountOf, dateOfTitle, sheetProblem, cleanSheet } = await imp('src/lib/marketing/noah-daily.ts')

// ── 架空の来院者日報の PDF を作る（NOAH → Microsoft Print to PDF と同じ作り：CID フォント・ToUnicode・上下反転の座標・TJ） ──
function makePdf(pages, { compressCmap = false } = {}) {
  const chars = new Map()
  const codeOf = (ch) => {
    if (!chars.has(ch)) chars.set(ch, chars.size + 0x10)
    return chars.get(ch)
  }
  const hex = (s) => [...s].map((ch) => codeOf(ch).toString(16).toUpperCase().padStart(4, '0')).join('')
  // セル：[x, y, [文字, すき間, 文字, …]]（すき間は TJ の数＝1000分の1文字。マイナスで右へ）
  const tj = (x, y, parts, size = 12) =>
    `q\n0 0 0 rg\nBT\n/F1 ${size} Tf\n1 0 0 -1 ${x} ${y} Tm\n[${parts.map((p) => (typeof p === 'number' ? ` ${p} ` : `<${hex(p)}>`)).join('')}] TJ\nET\nQ\n`
  const contents = pages.map((cells) => `0.75 0 0 -0.75 0 841.92 cm\n${cells.map((c) => tj(...c)).join('')}`)
  // 字の幅：半角の数字・記号は 500、ほかは 1000
  const half = (ch) => /^[\x20-\x7e]$/.test(ch)
  const bfchar = [...chars].map(([ch, code]) => `<${code.toString(16).padStart(4, '0')}> <${[...ch].map((c) => c.charCodeAt(0).toString(16).padStart(4, '0')).join('')}>`)
  const cmap = `/CIDInit /ProcSet findresource begin 12 dict begin begincmap /CMapName /Adobe-Identity-UCS def /CMapType 2 def 1 begincodespacerange <0000> <FFFF> endcodespacerange ${bfchar.length} beginbfchar ${bfchar.join(' ')} endbfchar endcmap end end`
  const widths = `[ ${[...chars].map(([ch, code]) => `${code} [${half(ch) ? 500 : 1000}]`).join(' ')} ]`
  const objs = []
  const add = (body) => objs.push(body) // 番号は 1 から
  const pageNums = pages.map((_, i) => 3 + i * 2)
  add(`<< /Type /Catalog /Pages 2 0 R >>`) // 1
  add(`<< /Type /Pages /Kids [ ${pageNums.map((n) => `${n} 0 R`).join(' ')} ] /Count ${pages.length} >>`) // 2
  const fontNum = 3 + pages.length * 2
  pages.forEach((_, i) => {
    add(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.32 841.92] /Resources << /Font << /F1 ${fontNum} 0 R >> >> /Contents [ ${4 + i * 2} 0 R ] >>`)
    const data = zlib.deflateSync(Buffer.from(contents[i], 'latin1'))
    add({ dict: `<< /Filter /FlateDecode /Length ${data.length} >>`, data })
  })
  add(`<< /Type /Font /Subtype /Type0 /BaseFont /CIDFont+F1 /Encoding /Identity-H /DescendantFonts [ << /Type /Font /Subtype /CIDFontType2 /BaseFont /CIDFont+F1 /W ${fontNum + 2} 0 R /DW 1000 >> ] /ToUnicode ${fontNum + 1} 0 R >>`)
  const cmapData = compressCmap ? zlib.deflateSync(Buffer.from(cmap, 'latin1')) : Buffer.from(cmap, 'latin1')
  add({ dict: `<< ${compressCmap ? '/Filter /FlateDecode ' : ''}/Length ${cmapData.length} >>`, data: cmapData })
  add(widths)
  const chunks = [Buffer.from('%PDF-1.7\n%\xE2\xE3\xCF\xD3\n', 'latin1')]
  objs.forEach((o, i) => {
    if (typeof o === 'string') chunks.push(Buffer.from(`${i + 1} 0 obj\n${o}\nendobj\n`, 'latin1'))
    else chunks.push(Buffer.from(`${i + 1} 0 obj\n${o.dict}\nstream\n`, 'latin1'), o.data, Buffer.from('\nendstream\nendobj\n', 'latin1'))
  })
  chunks.push(Buffer.from('trailer\n<< /Root 1 0 R >>\n%%EOF\n', 'latin1'))
  return new Uint8Array(Buffer.concat(chunks))
}

// 列の位置（NOAH の来院者日報と同じくらい。数字は右寄せ）
const X = { no: 34.4, pt: 73.9, ratio: 302.72, treat: 367.04, nonIns: 572, self: 624.32, goods: 700.64, window: 752.96 }
const HALF = 6 // 12pt の半角1字の幅
/** 3割 のあとに、すき間をはさんで 自費・商品 の数字を同じ TJ で出す（本物の PDF の4行目と同じ作り） */
const gapTo = (from, to) => -Math.round(((to - from) / 12) * 1000)
function row(y, no, ptNo, name, kind, ratio, [treat, burden, collected, nonIns, self, goods, windowAmt], { spanning = false } = {}) {
  const cells = [
    [X.no, y, [String(no)]],
    [X.pt, y, [String(ptNo), -1670, name.split(' ')[0], -1000, name.split(' ')[1], -2280, kind]],
  ]
  if (spanning) {
    const afterRatio = X.ratio + HALF + 12
    cells.push([X.ratio, y, [ratio, gapTo(afterRatio, X.self), self, gapTo(X.self + HALF * self.length, X.goods), goods]])
  } else {
    cells.push([X.ratio, y, [ratio]], [X.self, y, [self]], [X.goods, y, [goods]])
  }
  cells.push([X.treat, y, [treat, -3860, burden, -3860, collected]], [X.nonIns, y, [nonIns]], [X.window, y, [windowAmt]])
  return cells
}
const title = [
  [39.36, 81.76, ['令和', -10, '８年１１月２６日分'], 21.28],
  [445.44, 81.76, ['来院者日報', -1000, 'ゆうき整骨院'], 21.28],
  [20.16, 105.28, ['No.', -420, '受診者No', -2230, '受診者氏名', -2280, '保険種別', -1000, '負担割合']],
  [348.96, 105.28, ['施術額']],
]
const page1 = [
  ...title,
  ...row(137.92, 1, 9001, '架空 一郎', '組合保険', '3割', ['686', '205', '210', '0', '500', '0', '710']),
  ...row(157.12, 2, 9002, '見本 花子', '後期高齢者', '1割', ['686', '68', '70', '0', '1,500', '1,600', '3,170']),
  ...row(176.32, 3, 9003, '試験 次郎', '社会保険', '3割', ['560', '168', '170', '0', '0', '0', '170'], { spanning: true }),
  ...row(195.52, 4, 9004, '架空 四季', '交通事故', '0割', ['0', '0', '0', '0', '0', '0', '0']),
  [80, 205, ['(自賠責)']],
]
const page2 = [
  ...title,
  ...row(137.92, 5, 9005, '見本 五月', '一般国保', '3割', ['0', '0', '0', '0', '4,350', '0', '4,350']),
  ...row(157.12, 6, 9006, '試験 六花', '労災', '0割', ['1,227', '0', '0', '△500', '0', '0', '-500']),
]
const NAMES = ['架空', '一郎', '見本', '花子', '試験', '次郎', '四季', '五月', '六花', '9001', '9003']

await test('PDF の文字を行ごとに読む（上下反転の座標・TJ のすき間・字の幅で、右寄せの数字を正しい列に並べる）', async () => {
  const lines = await extractPdfLines(makePdf([page1]))
  const rows = lines.filter((l) => /^\d+$/.test(l.tokens[0])).map((l) => l.tokens)
  assert.deepEqual(rows[0], ['1', '9001', '架空', '一郎', '組合保険', '3割', '686', '205', '210', '0', '500', '0', '710'])
  // 3行目：「3割」と同じ TJ の中に、右の列（自費・商品）の 0 が入っている。字の幅から位置を出すので、正しい列に入る
  assert.deepEqual(rows[2].slice(5), ['3割', '560', '168', '170', '0', '0', '0', '170'])
  assert.ok(lines.some((l) => l.tokens.join('').includes('令和8年11月26日分')), '全角の数字は半角にそろえる')
  assert.ok(lines[0].y > lines[lines.length - 1].y, '上の行から')
  assert.deepEqual(lines.find((l) => l.tokens[0] === 'No.').tokens.slice(-2), ['負担割合', '施術額'], '同じ高さの別の TJ も1行にまとめ、左から並べる')
})

await test('来院者日報 → その日の合計（2ページ・交通事故の2行目・△のマイナス・圧縮した対応表）', async () => {
  const r = parseNoahDaily(await extractPdfLines(makePdf([page1, page2], { compressCmap: true })))
  assert.equal(r.ok, true, r.error)
  assert.deepEqual(r.sheet, {
    date: '2026-11-26',
    visits: 6,
    treatment: 686 + 686 + 560 + 0 + 0 + 1227,
    burden: 205 + 68 + 168,
    collected: 210 + 70 + 170,
    nonIns: -500,
    self: 500 + 1500 + 4350,
    goods: 1600,
    window: 710 + 3170 + 170 + 4350 - 500,
    counts: { insured: 4, selfOnly: 1, selfAny: 3, goodsAny: 1, accident: 1, workers: 1 },
    pages: 2,
  })
  // お名前・受診者No・保険種別は、合計に入らない
  const text = JSON.stringify(r)
  for (const n of NAMES) assert.ok(!text.includes(n), n)
  assert.ok(!/組合保険|後期高齢者|社会保険/.test(text))
})

await test('読めないときは保存しない（日報でない・日付が無い・数字が欠けた行・番号が飛んだ・日計と合わない）', () => {
  const L = (rows) => rows.map((tokens) => ({ page: 1, tokens }))
  const head = ['令和8年11月26日分', '来院者日報']
  const ok1 = ['1', '9001', '架空', '一郎', '組合保険', '3割', '686', '205', '210', '0', '500', '0', '710']
  assert.match(parseNoahDaily(L([['売上', '一覧'], ok1])).error, /「来院者日報」ではない/)
  assert.match(parseNoahDaily(L([['来院者日報'], ok1])).error, /日付/)
  assert.match(parseNoahDaily(L([head, ok1, ['2', '9002', '見本', '花子', '社会保険', '3割', '686', '205']])).error, /読めなかった行があります（No\.2）/)
  assert.match(parseNoahDaily(L([head, ok1, ['3', ...ok1.slice(1)]])).error, /番号が飛んでいます（No\.2）/)
  assert.match(parseNoahDaily(L([head])).error, /来院の行がありません/)
  // 日計が文字で入っている PDF なら、足した数と比べる
  const total = (w) => ['日計', '来院', '1人', '初検', '0人', '686', '205', '210', '0', '500', '0', w]
  assert.equal(parseNoahDaily(L([head, ok1, total('710')])).ok, true)
  assert.match(parseNoahDaily(L([head, ok1, total('999')])).error, /日計」と合いません/)
})

await test('数字・日付の読み方', () => {
  assert.equal(amountOf('1,227'), 1227)
  assert.equal(amountOf('０'), 0)
  assert.equal(amountOf('△500'), -500)
  assert.equal(amountOf('-1,000'), -1000)
  assert.equal(amountOf('3割'), null)
  assert.equal(amountOf('12,34'), null)
  assert.equal(dateOfTitle('令和８年１１月２５日分'), '2026-11-25')
  assert.equal(dateOfTitle('令和元年5月1日分'), '2019-05-01')
  assert.equal(dateOfTitle('令和8年2月30日分'), '')
  assert.equal(parseToUnicode('beginbfrange <0010> <0012> <0030> endbfrange').get(0x12), '2')
  assert.equal(parseCidWidths('[ 16 [500 600] 20 22 1000 ]').get(17), 600)
  assert.equal(parseCidWidths('[ 16 [500 600] 20 22 1000 ]').get(22), 1000)
})

await test('PDF でないもの・鍵のかかった PDF は読めないと伝える', async () => {
  await assert.rejects(extractPdfLines(new TextEncoder().encode('not a pdf')), /PDF ではない/)
  await assert.rejects(extractPdfLines(new TextEncoder().encode('%PDF-1.4\n1 0 obj << /Encrypt 2 0 R >> endobj')), /鍵のかかった/)
})

await test('サーバーで受け取るとき：数字だけの形か確かめ、決めた項目だけを保存する（お名前などが混じっても捨てる）', () => {
  const good = { date: '2026-11-26', visits: 3, treatment: 1000, burden: 300, collected: 300, nonIns: 0, self: 500, goods: 0, window: 800, pages: 1, counts: { insured: 2, selfOnly: 1, selfAny: 1, goodsAny: 0, accident: 0, workers: 0 } }
  assert.equal(sheetProblem(good), null)
  assert.match(sheetProblem({ ...good, date: '11/26' }), /日付/)
  assert.match(sheetProblem({ ...good, visits: 0 }), /来院の数/)
  assert.match(sheetProblem({ ...good, window: 1.5 }), /窓口領収/)
  assert.match(sheetProblem({ ...good, counts: undefined }), /内訳/)
  const cleaned = cleanSheet({ ...good, names: ['架空 一郎'], rows: [{ name: '見本 花子' }], counts: { ...good.counts, kinds: ['組合保険'] } }, '2026-11-27T06:00:00.000Z')
  assert.ok(!JSON.stringify(cleaned).includes('架空'))
  assert.ok(!JSON.stringify(cleaned).includes('組合保険'))
  assert.equal(cleaned.savedAt, '2026-11-27T06:00:00.000Z')
})

await test('保存：同じ日は置きかえ、月ごとに読める。400日分まで', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'noah-daily-'))
  const cwd = process.cwd()
  const saved = { ...process.env }
  for (const k of Object.keys(process.env)) if (/^(SUPABASE|NEXT_PUBLIC_SUPABASE)/.test(k)) delete process.env[k]
  process.chdir(dir)
  try {
    const S = await imp('src/lib/marketing/noah-daily-server.ts')
    const sheet = (date, window) => ({ date, visits: 1, treatment: 0, burden: 0, collected: 0, nonIns: 0, self: window, goods: 0, window, pages: 1, counts: { insured: 0, selfOnly: 1, selfAny: 1, goodsAny: 0, accident: 0, workers: 0 } })
    await S.saveNoahDaily([sheet('2026-11-25', 1000), sheet('2026-11-26', 2000)])
    await S.saveNoahDaily([sheet('2026-11-26', 2500)])
    assert.equal((await S.getNoahDaily('2026-11-26')).window, 2500)
    assert.equal(await S.getNoahDaily('2026-11-24'), null)
    assert.deepEqual((await S.listNoahDailyMonth('2026-11')).map((s) => s.date), ['2026-11-25', '2026-11-26'])
    const many = Array.from({ length: 420 }, (_, i) => sheet(new Date(Date.UTC(2025, 0, 1 + i)).toISOString().slice(0, 10), i))
    for (let i = 0; i < many.length; i += 31) await S.saveNoahDaily(many.slice(i, i + 31))
    assert.equal(await S.getNoahDaily('2025-01-01'), null, 'いちばん古い日から消える')
    assert.equal(S.NOAH_DAILY_KEEP_DAYS, 400)
  } finally {
    process.chdir(cwd)
    for (const k of Object.keys(process.env)) if (!(k in saved)) delete process.env[k]
    Object.assign(process.env, saved)
    fs.rmSync(dir, { recursive: true, force: true })
  }
})

await test('画面と API：院長だけ。PDF はブラウザの中で読み、送るのは合計の数字だけ。日報の売上の欄に出る', () => {
  const api = read('src/app/api/marketing/noah/daily/route.ts')
  assert.equal((api.match(/const denied = requireAdmin\(request\)/g) ?? []).length, 2, 'GET も POST も院長だけ')
  assert.match(api, /sheetProblem\(s\)/)
  const ui = read('src/components/clinic/NoahDailyPdfImport.tsx')
  assert.match(ui, /parseNoahDaily\(await extractPdfLines\(await file\.arrayBuffer\(\)\)\)/)
  assert.match(ui, /body: JSON\.stringify\(\{ sheets \}\)/, '送るのは合計（sheets）だけ')
  assert.ok(!/FormData|file\b.*fetch\(/.test(ui), 'PDF そのものは送らない')
  const report = read('src/components/clinic/DailyReport.tsx')
  assert.match(report, /\{showSales && \(\s*<div className="space-y-3 print:hidden">\s*<NoahDailyPdfImport/)
  assert.match(report, /fetch\(`\/api\/marketing\/noah\/daily\?date=\$\{day\}`/)
  assert.match(report, /窓口（来院者日報）/)
})

if (process.env.NOAH_DAILY_PDF) {
  const r = parseNoahDaily(await extractPdfLines(fs.readFileSync(process.env.NOAH_DAILY_PDF)))
  console.log('  （本物の PDF）', r.ok ? JSON.stringify(r.sheet) : r.error)
}

console.log(`\n${passed} 件 OK`)
