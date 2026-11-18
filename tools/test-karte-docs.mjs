// カルテの資料（論文・リハビリプロトコルなどのファイル・リンク）の決まりの確認（データはすべて架空）
// 実行: npx tsx tools/test-karte-docs.mjs
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
const R = await import(new URL('src/lib/karte/doc-rules.ts', root).href)
const D = await import(new URL('src/lib/karte-dedupe.ts', root).href)

let passed = 0
function test(name, fn) {
  fn()
  passed += 1
  console.log(`  ✓ ${name}`)
}

const MB = 1024 * 1024
const doc = (over) => ({
  id: 'd1', patientId: 'pA', kind: 'file', category: 'protocol', title: 'ACL再建術後プロトコル', memo: 'この方は半月板縫合あり',
  fileName: 'ACL_protocol.pdf', ext: 'pdf', bytes: 3 * MB, storagePath: 'pA/d1.pdf',
  addedDate: '2026-11-18', createdAt: '2026-11-18T01:00:00.000Z', updatedAt: '2026-11-18T01:00:00.000Z', ...over,
})

test('入れられる形式：PDF・画像・Word・Excel・PowerPoint（jpeg は jpg にそろえる）', () => {
  for (const [name, ext, view] of [
    ['論文.pdf', 'pdf', 'pdf'], ['scan.JPEG', 'jpg', 'image'], ['図.png', 'png', 'image'], ['a.webp', 'webp', 'image'],
    ['プロトコル.docx', 'docx', 'download'], ['古い.doc', 'doc', 'download'], ['表.xlsx', 'xlsx', 'download'], ['スライド.pptx', 'pptx', 'download'],
  ]) {
    const c = R.checkDocFile(name, 1000)
    assert.ok(c.ok, name)
    assert.equal(c.type.ext, ext, name)
    assert.equal(c.type.view, view, name)
    assert.ok(R.DOC_MIME_TYPES.includes(c.type.mime), name)
  }
  assert.equal(R.checkDocFile('論文.pdf', 1000).type.mime, 'application/pdf')
})

test('入れられないもの：ほかの形式・HEIC・空・20MB を超えるもの（理由を日本語で返す）', () => {
  for (const name of ['a.exe', 'page.html', 'x.svg', 'a.zip', 'noext', 'movie.mp4']) assert.equal(R.checkDocFile(name, 1000).ok, false, name)
  assert.match(R.checkDocFile('IMG_0001.HEIC', 1000).error, /HEIC/)
  assert.match(R.checkDocFile('a.pdf', 0).error, /空/)
  assert.equal(R.checkDocFile('a.pdf', 20 * MB).ok, true)
  const big = R.checkDocFile('a.pdf', 20 * MB + 1)
  assert.equal(big.ok, false)
  assert.match(big.error, /20\.0MB まで/)
  assert.equal(R.MAX_DOC_BYTES, 20 * MB)
  // API を通せる大きさは、Vercel の上限（4.5MB）より小さく
  assert.ok(R.API_UPLOAD_MAX_BYTES < 4.5 * MB)
})

test('保存場所：カルテのID/資料のID.拡張子。おかしな場所は通さない', () => {
  assert.equal(R.docStoragePath('pA', 'd1', 'pdf'), 'pA/d1.pdf')
  assert.ok(R.isValidDocPath('pA/d1.pdf'))
  assert.ok(R.isValidDocPath('V1StGXR8_Z5jdHi6B-myT/abcDEF_123-x.docx'))
  for (const bad of ['../x.pdf', 'pA/d1.exe', 'pA/d1', 'pA/../d1.pdf', 'pA/sub/d1.pdf', '/pA/d1.pdf', 'pA/d1.pdf?x=1', 'pA/d1.jpeg', '']) {
    assert.equal(R.isValidDocPath(bad), false, bad)
  }
  assert.ok(R.isValidDocId('abc_DEF-123'))
  assert.equal(R.isValidDocId('a/b'), false)
  assert.equal(R.isValidDocId(''), false)
})

test('題名はファイル名から（拡張子を取る）。種類の見当：プロトコル・医療機関の書類・それ以外は論文', () => {
  assert.equal(R.titleFromFileName('ACL_rehab_protocol.pdf'), 'ACL rehab protocol')
  assert.equal(R.titleFromFileName('  足関節捻挫 再発予防.PDF '), '足関節捻挫 再発予防')
  assert.equal(R.titleFromFileName('.pdf'), '資料')
  assert.ok(R.titleFromFileName(`${'あ'.repeat(300)}.pdf`).length <= R.MAX_TITLE)
  assert.equal(R.guessCategory('ACL再建術後リハビリプロトコル.pdf'), 'protocol')
  assert.equal(R.guessCategory('rehab_protocol_v2.docx'), 'protocol')
  assert.equal(R.guessCategory('診療情報提供書.pdf'), 'medical')
  assert.equal(R.guessCategory('Hupperets2009.pdf'), 'paper')
  assert.equal(R.formatBytes(300 * 1024), '300KB')
  assert.equal(R.formatBytes(3.25 * MB), '3.3MB')
  assert.equal(R.formatBytes(undefined), '')
})

test('リンク：https の URL・DOI・PMID を受けつけ、URL に直す', () => {
  const a = R.normalizeDocUrl(' https://pubmed.ncbi.nlm.nih.gov/19589822/ ')
  assert.ok(a.ok)
  assert.equal(a.url, 'https://pubmed.ncbi.nlm.nih.gov/19589822/')
  assert.equal(a.title, 'PubMed 19589822')
  const doi = R.normalizeDocUrl('10.1136/bmj.b2684')
  assert.equal(doi.url, 'https://doi.org/10.1136/bmj.b2684')
  assert.equal(doi.title, 'DOI 10.1136/bmj.b2684')
  assert.equal(R.normalizeDocUrl('doi: 10.1016/j.amjmed.2007.11.018').url, 'https://doi.org/10.1016/j.amjmed.2007.11.018')
  assert.equal(R.normalizeDocUrl('https://doi.org/10.1136/bmj.b2684').title, 'DOI 10.1136/bmj.b2684')
  assert.equal(R.normalizeDocUrl('PMID: 19589822').url, 'https://pubmed.ncbi.nlm.nih.gov/19589822/')
  // https:// を省いても入る
  const bare = R.normalizeDocUrl('www.mhlw.go.jp/bunya/iryouhoken/jyuudou/index.html')
  assert.equal(bare.url, 'https://www.mhlw.go.jp/bunya/iryouhoken/jyuudou/index.html')
  assert.equal(bare.title, 'mhlw.go.jp')
  assert.equal(R.hostOf('https://www.jstage.jst.go.jp/article/x'), 'jstage.jst.go.jp')
})

test('リンク：http・https 以外や、形のおかしいものは入れない', () => {
  for (const bad of ['', '   ', 'javascript:alert(1)', 'data:text/html,<script>', 'file:///C:/a.pdf', 'ftp://example.com/a.pdf', 'ただの文字', 'https://', 'localhost']) {
    assert.equal(R.normalizeDocUrl(bad).ok, false, bad)
  }
  assert.equal(R.normalizeDocUrl(`https://example.com/${'a'.repeat(2100)}`).ok, false)
})

test('開き方：PDF は画面の中・画像・Word などは端末のアプリ・リンク', () => {
  assert.equal(R.docView(doc({})), 'pdf')
  assert.equal(R.docView(doc({ ext: 'png' })), 'image')
  assert.equal(R.docView(doc({ ext: 'docx' })), 'download')
  assert.equal(R.docView(doc({ ext: 'zzz' })), 'download')
  assert.equal(R.docView(doc({ kind: 'link', ext: undefined, url: 'https://example.com' })), 'link')
  assert.equal(R.docTypeLabel(doc({ ext: 'xlsx' })), 'Excel')
  assert.equal(R.docTypeLabel(doc({ kind: 'link' })), 'リンク')
  // 端末に保存するときの名前（題名＋拡張子。使えない記号は取る）
  assert.equal(R.downloadName(doc({ title: 'ACL/術後:プロトコル?', ext: 'docx' })), 'ACL 術後 プロトコル.docx')
  assert.equal(R.downloadName(doc({ title: 'a.docx', ext: 'docx' })), 'a.docx')
  assert.equal(R.downloadName(doc({ title: '', fileName: '', ext: 'pdf' })), '資料.pdf')
})

test('一覧は種類ごと（論文・プロトコル・医療機関の書類・その他の順）、新しい順', () => {
  const list = [
    doc({ id: 'a', category: 'other', createdAt: '2026-11-01T00:00:00Z' }),
    doc({ id: 'b', category: 'paper', createdAt: '2026-11-02T00:00:00Z' }),
    doc({ id: 'c', category: 'paper', createdAt: '2026-11-05T00:00:00Z' }),
    doc({ id: 'd', category: 'protocol', createdAt: '2026-11-03T00:00:00Z' }),
    doc({ id: 'e', category: 'むかしの種類', createdAt: '2026-11-04T00:00:00Z' }),
  ]
  const g = R.groupDocs(list)
  assert.deepEqual(g.map((x) => x.label), ['論文', 'リハビリプロトコル', 'その他'])
  assert.deepEqual(g[0].docs.map((x) => x.id), ['c', 'b'])
  assert.deepEqual(g[2].docs.map((x) => x.id), ['e', 'a']) // 知らない種類は「その他」に
  assert.deepEqual(R.groupDocs([]), [])
})

test('ほかのカルテの資料：論文・プロトコルだけ出す（医療機関の書類・その他は出さない）。同じ資料は1つ・もう入っているものは出さない', () => {
  const all = [
    doc({ id: 'a1', patientId: 'pA', storagePath: 'pA/a1.pdf', category: 'protocol', createdAt: '2026-11-01T00:00:00Z' }),
    doc({ id: 'a2', patientId: 'pA', storagePath: 'pA/a2.pdf', category: 'medical', title: '診療情報提供書' }),
    doc({ id: 'a3', patientId: 'pA', storagePath: 'pA/a3.pdf', category: 'other' }),
    doc({ id: 'a4', patientId: 'pA', kind: 'link', storagePath: undefined, url: 'https://doi.org/10.1136/bmj.b2684', category: 'paper', createdAt: '2026-11-03T00:00:00Z' }),
    // pB には a1 と同じファイルが入っている（pA から入れたもの）
    doc({ id: 'b1', patientId: 'pB', storagePath: 'pA/a1.pdf', category: 'protocol', createdAt: '2026-11-02T00:00:00Z' }),
    doc({ id: 'c1', patientId: 'pC', storagePath: 'pC/c1.pdf', category: 'paper', createdAt: '2026-11-04T00:00:00Z' }),
  ]
  // pD（何も無い）：a1（=b1 と同じ。1つだけ）・リンク・c1。新しい順
  assert.deepEqual(R.reusableDocs(all, 'pD').map((d) => R.docKey(d)), ['f:pC/c1.pdf', 'u:https://doi.org/10.1136/bmj.b2684', 'f:pA/a1.pdf'])
  // pB：a1 はもう入っているので出さない
  assert.deepEqual(R.reusableDocs(all, 'pB').map((d) => d.id), ['c1', 'a4'])
  // 医療機関の書類・その他は、どのカルテにも出さない
  for (const pid of ['pB', 'pC', 'pD']) assert.ok(R.reusableDocs(all, pid).every((d) => d.category === 'paper' || d.category === 'protocol'))
})

test('ほかのカルテへ入れる：同じ保存場所を指す新しい1件。メモは写さない', () => {
  const src = doc({})
  const copy = R.copyDocFor(src, 'pB', 'new1', '2026-11-20T00:00:00.000Z', '2026-11-20')
  assert.equal(copy.id, 'new1')
  assert.equal(copy.patientId, 'pB')
  assert.equal(copy.storagePath, 'pA/d1.pdf')
  assert.equal(copy.title, src.title)
  assert.equal(copy.category, 'protocol')
  assert.equal(copy.memo, '')
  assert.equal(copy.addedDate, '2026-11-20')
  assert.equal(src.memo, 'この方は半月板縫合あり') // もとは変えない
})

test('ファイルを消すのは、同じ保存場所を指す資料がほかに無いときだけ', () => {
  const a = doc({ id: 'a1', patientId: 'pA' })
  const b = doc({ id: 'b1', patientId: 'pB' }) // 同じ storagePath
  assert.equal(R.isFileShared(a, [a, b]), true)
  assert.equal(R.isFileShared(a, [a]), false)
  assert.equal(R.isFileShared(doc({ kind: 'link', storagePath: undefined, url: 'https://example.com' }), [a, b]), false)
})

test('バックアップ：資料のファイルの保存場所を集める（同じ場所は1つ・リンクや形のおかしいものは除く）', () => {
  const raw = JSON.stringify([
    doc({ id: 'a', storagePath: 'pA/a.pdf' }),
    doc({ id: 'b', patientId: 'pB', storagePath: 'pA/a.pdf' }),
    doc({ id: 'c', storagePath: 'pA/c.docx' }),
    doc({ id: 'd', kind: 'link', storagePath: undefined, url: 'https://example.com' }),
    doc({ id: 'e', storagePath: '../secret.pdf' }),
  ])
  assert.deepEqual(R.docFilePathsOf(raw), ['pA/a.pdf', 'pA/c.docx'])
  assert.deepEqual(R.docFilePathsOf(undefined), [])
  assert.deepEqual(R.docFilePathsOf('こわれた文字'), [])
  assert.deepEqual(R.docFilePathsOf('{"a":1}'), [])
})

test('重複したカルテをまとめるとき、資料も残すカルテへ移る', () => {
  assert.ok(D.PATIENT_RECORD_KEYS.includes('pt_karte_docs'))
})

console.log(`\n${passed} 件成功・0 件失敗`)
