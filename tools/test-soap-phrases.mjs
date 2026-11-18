// SOAP の「文を選ぶ」の確認（文の形・入れ方・外し方・部位の順）。データはすべて架空
// 実行: npx tsx tools/test-soap-phrases.mjs
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
const D = await import(new URL('src/data/soap-phrases.ts', root).href)
const P = await import(new URL('src/lib/karte/soap-phrases.ts', root).href)

let passed = 0
function test(name, fn) {
  fn()
  passed += 1
  console.log(`  ✓ ${name}`)
}

const fields = Object.keys(D.SOAP_PHRASES)
const allOf = (set) => [...set.common, ...Object.values(set.byRegion ?? {}).flat()]

test('19 の欄に文がある（どの欄も、どの部位でも使う文が5つ以上）', () => {
  assert.equal(fields.length, 19)
  for (const f of fields) assert.ok(D.SOAP_PHRASES[f].common.length >= 5, f)
})

test('文の形：短い（30字まで）・区切りの文字（、。改行）を含まない・前後に空白がない', () => {
  for (const f of fields) {
    for (const p of allOf(D.SOAP_PHRASES[f])) {
      assert.ok(p.length >= 2 && p.length <= 30, `${f}: ${p}`)
      assert.ok(!/[、。\n]/.test(p), `${f}: ${p}`)
      assert.equal(p, p.trim(), `${f}: ${p}`)
    }
  }
})

test('数字を書く場所（＿）は1つの文に1つまで。足した直後に ＿ を選ぶ位置が合っている', () => {
  let withBlank = 0
  for (const f of fields) {
    for (const p of allOf(D.SOAP_PHRASES[f])) {
      const n = p.split(D.PHRASE_BLANK).length - 1
      assert.ok(n <= 1, `${f}: ${p}`)
      const next = P.addPhrase('手で書いた文', p)
      const sel = P.blankSelection(next, p)
      if (n === 0) assert.equal(sel, null, p)
      else {
        withBlank += 1
        assert.equal(next.slice(sel[0], sel[1]), D.PHRASE_BLANK, p)
        // 打った数字に置きかわる
        assert.equal(next.slice(0, sel[0]) + '130' + next.slice(sel[1]), '手で書いた文、' + p.replace(D.PHRASE_BLANK, '130'))
      }
    }
  }
  assert.ok(withBlank >= 40, `数字を書く文 ${withBlank}`)
  assert.deepEqual(P.blankSelection('膝 屈曲 ＿°', '膝 屈曲 ＿°'), [5, 6])
  assert.equal(P.blankSelection('', '膝 屈曲 ＿°'), null) // 外したとき（うしろに無い）は選ばない
})

test('同じ欄で一度に出る文（その部位の文＋どの部位でも使う文）に、同じ文がない', () => {
  for (const f of fields) {
    const set = D.SOAP_PHRASES[f]
    assert.equal(new Set(set.common).size, set.common.length, `${f} 共通`)
    for (const [region, list] of Object.entries(set.byRegion ?? {})) {
      const shown = [...list, ...set.common]
      assert.equal(new Set(shown).size, shown.length, `${f} ${region}`)
    }
  }
})

test('部位ごとの文は、決まった8部位だけ（胸部・その他・機能評価には作らない）', () => {
  for (const f of fields) {
    for (const region of Object.keys(D.SOAP_PHRASES[f].byRegion ?? {})) assert.ok(P.PHRASE_REGIONS.includes(region), `${f} ${region}`)
  }
  for (const r of P.PHRASE_REGIONS) assert.ok(P.PHRASE_REGION_SHORT[r], r)
})

test('治ることを約束する言い方・ほかの院との比べを入れていない', () => {
  const ng = /必ず|完治|治ります|治せ|絶対|保証|他院|No\.?1|最高|最新/
  for (const f of fields) for (const p of allOf(D.SOAP_PHRASES[f])) assert.ok(!ng.test(p), `${f}: ${p}`)
})

test('足す：空の欄にはそのまま。書いてある文字は消さず、うしろに「、」でつなぐ', () => {
  assert.equal(P.addPhrase('', '痛みが軽くなった'), '痛みが軽くなった')
  assert.equal(P.addPhrase('昨日から階段が楽', '痛みが軽くなった'), '昨日から階段が楽、痛みが軽くなった')
  assert.equal(P.addPhrase('昨日から階段が楽  ', '痛みが軽くなった'), '昨日から階段が楽、痛みが軽くなった')
  // 「。」や改行で終わっていれば、区切りを重ねない
  assert.equal(P.addPhrase('階段が楽。', '腫れが引いてきた'), '階段が楽。腫れが引いてきた')
  assert.equal(P.addPhrase('階段が楽\n', '腫れが引いてきた'), '階段が楽\n腫れが引いてきた')
  assert.equal(P.addPhrase('階段が楽、', '腫れが引いてきた'), '階段が楽、腫れが引いてきた')
})

test('入っているか：区切りごとのかたまりが、文とぴったり同じときだけ（「陽性」と「疑陽性…」を取りちがえない）', () => {
  assert.equal(P.hasPhrase('疑陽性（判定しにくい）', '陽性'), false)
  assert.equal(P.hasPhrase('陰性、陽性', '陽性'), true)
  assert.equal(P.hasPhrase('MMT 4+', 'MMT 4'), false)
  assert.equal(P.hasPhrase('左右差なし。最終域で痛みあり', '最終域で痛みあり'), true)
  assert.equal(P.hasPhrase('膝 屈曲 130°', '膝 屈曲 ＿°'), false) // 数字を書いた文は別のもの（もう一度押すと、もう1つ足せる）
  assert.equal(P.hasPhrase('膝 屈曲 ＿°', '膝 屈曲 ＿°'), true)
})

test('外す：その文だけ。手で書いた文字・ほかの文は残す', () => {
  assert.equal(P.removePhrase('A、B、C', 'B'), 'A、C')
  assert.equal(P.removePhrase('A、B、C', 'A'), 'B、C')
  assert.equal(P.removePhrase('A、B、C', 'C'), 'A、B')
  assert.equal(P.removePhrase('A', 'A'), '')
  assert.equal(P.removePhrase('階段が楽。腫れが引いてきた', '腫れが引いてきた'), '階段が楽。')
  assert.equal(P.removePhrase('疑陽性（判定しにくい）', '陽性'), '疑陽性（判定しにくい）') // 中の文字は消さない
  assert.equal(P.removePhrase('手で書いた文', '無い文'), '手で書いた文')
})

test('押す：無ければ足す・あれば外す（2回押すと元どおり）', () => {
  for (const f of fields) {
    if (D.SOAP_PHRASES[f].single) continue
    for (const p of allOf(D.SOAP_PHRASES[f])) {
      const base = '手で書いた文'
      const once = P.togglePhrase(base, p)
      assert.ok(P.hasPhrase(once, p), `${f}: ${p}`)
      assert.equal(P.togglePhrase(once, p), base, `${f}: ${p}`)
      assert.equal(P.togglePhrase(P.togglePhrase('', p), p), '', `${f}: ${p}`)
    }
  }
})

test('通院目安は1つだけ選ぶ（押すと入れかわる。同じものをもう一度で空に）', () => {
  assert.equal(P.isSinglePhraseField('recommendedFrequency'), true)
  assert.equal(P.isSinglePhraseField('treatmentToday'), false)
  assert.equal(P.togglePhrase('週2回', '週1回', true), '週1回')
  assert.equal(P.togglePhrase('週1回', '週1回', true), '')
})

test('その方の部位：経過中の部位別NRS → 人体図で押した関節 → （どちらも無ければ）表紙の部位', () => {
  assert.deepEqual(
    P.regionsForPhrases({
      complaints: [{ bodyRegion: 'knee' }, { bodyRegion: 'lumbar', status: 'resolved' }, { bodyRegion: 'ankle', status: 'active' }],
      joints: ['肩関節', '膝関節'],
      patientRegion: 'hip',
    }),
    ['knee', 'ankle', 'shoulder'],
  )
  assert.deepEqual(P.regionsForPhrases({ complaints: [], joints: [], patientRegion: 'hip' }), ['hip'])
  assert.deepEqual(P.regionsForPhrases({ patientRegion: 'functional' }), []) // 文を持たない部位は出さない
  assert.deepEqual(P.regionsForPhrases({}), [])
})

test('出す文：その部位の文 → どの部位でも使う文。部位の文が無い欄は共通だけ', () => {
  const g = P.phraseGroups('romFindings', 'knee')
  assert.equal(g.length, 2)
  assert.equal(g[0].label, '膝関節')
  assert.ok(g[0].phrases.includes('膝 屈曲 ＿°'))
  assert.equal(g[1].label, 'どの部位でも')
  const none = P.phraseGroups('romFindings', null)
  assert.equal(none.length, 1)
  assert.equal(none[0].label, '')
  assert.equal(P.phraseGroups('improvements', 'knee').length, 1) // 部位の文を持たない欄
  assert.deepEqual(P.phraseRegions('improvements'), [])
  assert.deepEqual(P.phraseRegions('romFindings'), P.PHRASE_REGIONS)
})

test('SOAP の画面：19 の欄すべてに「文を選ぶ」が付いている（データの欄と画面の欄が同じ）', () => {
  const src = readFileSync(new URL('src/components/rehab-management/SOAPForm.tsx', root), 'utf8')
  const used = [...src.matchAll(/<SoapPhraseField label="[^"]+" \{\.\.\.phrase\('([A-Za-z]+)'\)\}>/g)].map((m) => m[1])
  assert.deepEqual([...used].sort(), [...fields].sort())
  assert.equal(new Set(used).size, used.length)
})

console.log(`\n${passed} 件成功・0 件失敗`)
