// 経営の「CSVを入れて最新にする」の読み方（純粋関数）の確認。数字・お名前はすべて架空
// 実行: node tools/marketing/test-keiei-csv.mjs   （Node 22.18+ は .ts をそのまま読める）
import assert from 'node:assert/strict'
import {
  decodeCsvBytes,
  detectCsvKind,
  extraFromSummary,
  parseAlphaCashless,
  parseAlphaCredit,
  parseCsv,
  parseNoahKingaku,
  summarizeAlpha,
} from '../../src/lib/marketing/keiei-csv.ts'

let passed = 0
function test(name, fn) {
  fn()
  passed += 1
  console.log(`ok - ${name}`)
}

const NOAH = [
  '<金額分析>',
  '',
  '抽出年月',
  '209901',
  '',
  '<金額集計>',
  '年月日,全体人数,全体金額,保険人数,保険金額,保険比率,自費・商品人数,自費・商品金額,自費・商品比率,保険外人数,保険外金額,保険外比率,交通事故人数,交通事故金額,労災人数,労災金額',
  '"2099/01/01","10","20,000","4","3,000","15%","5","12,000","60%","0","0","0%","1","5,000","0","0"',
  '"2099/01/02","0","0","0","0","0%","0","0","0%","0","0","0%","0","0","0","0"',
  '"2099/01/03","8","16,000","3","2,500","16%","5","13,500","84%","0","0","0%","0","0","0","0"',
  '',
  '<自費売上構成>',
  '自費名,単価,金額,点数,比率',
  '"施術A","1,000","5,000","5","50%"',
  '',
  '<商品売上構成>',
  '商品名,単価,金額,点数,比率',
  '"物品B","500","1,500","3","10%"',
  '',
  '<エリアランキング>',
  '年月,院数,順位',
  '"2098/12","700","30"',
  '',
].join('\r\n')

const header = (cols) => cols.map((c) => `"${c}"`).join(',')
const CREDIT = [
  header(['取引ID', '顧客名', 'カード名義', 'カード番号', '入力通貨', '入力金額', '決済日', '決済日時', '支払タイプ', 'ステータス']),
  '"1","テスト 花子","TEST/HANAKO","4111-XXXX","JPY","20000","2099/01/01","2099/01/01 12:00","継続(2回目以降)","売上確定"',
  '"2",,"NONE","5111-XXXX","JPY","3000","2099/01/01","2099/01/01 18:00","一括","売上確定"',
  '"3",,"NONE","5111-XXXX","JPY","8000","2099/01/02","2099/01/02 18:00","一括","売上確定"',
  '"4",,"NONE","5111-XXXX","JPY","9999","2099/01/03","2099/01/03 18:00","一括","取消"',
].join('\r\n')
const CASHLESS = [
  header(['取引ID', '顧客名', 'ブランド', '入力金額', '決済日', '決済日時', 'ステータス', '取消日']),
  '"5",,"PAYPAY","1000","2099/01/01","2099/01/01 15:00","売上",""',
  '"6",,"PAYPAY","12000","2099/01/03","2099/01/03 15:00","売上",""',
  '"7",,"D払い","700","2099/01/03","2099/01/03 16:00","売上","2099/01/04"',
].join('\r\n')

test('CSV のマス（カンマ・引用符・空のマス）を読む', () => {
  assert.deepEqual(parseCsv('a,"b,c","d""e",\r\n1,2'), [['a', 'b,c', 'd"e', ''], ['1', '2']])
})

test('UTF-8（BOMつき）はそのまま読む', () => {
  const bytes = new TextEncoder().encode('﻿<金額集計>')
  assert.equal(decodeCsvBytes(bytes), '<金額集計>')
})

test('どの CSV かを見分ける', () => {
  assert.equal(detectCsvKind(NOAH), 'noah')
  assert.equal(detectCsvKind(CREDIT), 'alpha-credit')
  assert.equal(detectCsvKind(CASHLESS), 'alpha-cashless')
  assert.equal(detectCsvKind('a,b\n1,2'), null)
})

test('NOAH の金額集計：終わった月は最終日までの集計になる', () => {
  const r = parseNoahKingaku(NOAH, '2099-02-10', '2099-02-10T08:00', 'x.csv')
  assert.equal(r.ok, true)
  assert.equal(r.month.month, '2099-01')
  assert.equal(r.month.asOf, '2099-01-31')
  assert.equal(r.month.days.length, 3)
  assert.deepEqual(r.month.days[0], [1, 10, 20000, 4, 3000, 5, 12000, 0, 0, 1, 5000, 0, 0])
  assert.equal(r.month.total[0], 18)
  assert.equal(r.month.total[1], 36000)
  assert.deepEqual(r.month.self, [['施術A', 1000, 5000, 5]])
  assert.deepEqual(r.month.goods, [['物品B', 500, 1500, 3]])
  assert.deepEqual(r.month.rank, [['2098-12', 700, 30]])
})

test('NOAH の金額集計：今月の分は今日までの行だけ', () => {
  const r = parseNoahKingaku(NOAH, '2099-01-02', '2099-01-02T08:00')
  assert.equal(r.ok, true)
  assert.equal(r.month.asOf, '2099-01-02')
  assert.equal(r.month.days.length, 2)
})

test('NOAH の金額集計：まだ来ていない月は入れない', () => {
  const r = parseNoahKingaku(NOAH, '2098-12-31', '2098-12-31T08:00')
  assert.equal(r.ok, false)
})

test('カード：継続はサブスク、一括は窓口。取消は数えない。お名前・カード番号は持たない', () => {
  const r = parseAlphaCredit(CREDIT)
  assert.equal(r.ok, true)
  assert.equal(r.skipped, 1)
  assert.deepEqual(r.payments, [
    { date: '2099-01-01', amount: 20000, kind: 'subscription' },
    { date: '2099-01-01', amount: 3000, kind: 'card' },
    { date: '2099-01-02', amount: 8000, kind: 'card' },
  ])
  for (const p of r.payments) assert.deepEqual(Object.keys(p).sort(), ['amount', 'date', 'kind'])
})

test('QR：取消日のあるものは数えない', () => {
  const r = parseAlphaCashless(CASHLESS)
  assert.equal(r.ok, true)
  assert.equal(r.skipped, 1)
  assert.deepEqual(r.payments.map((p) => p.amount), [1000, 12000])
})

test('月のまとめ：サブスクは足し、一括・QR は NOAH と重なる。怪しいものを拾う', () => {
  const noah = parseNoahKingaku(NOAH, '2099-02-10', '2099-02-10T08:00').month
  const payments = [...parseAlphaCredit(CREDIT).payments, ...parseAlphaCashless(CASHLESS).payments]
  const [s] = summarizeAlpha(payments, [noah])
  assert.equal(s.month, '2099-01')
  assert.deepEqual(s.subscription, { sum: 20000, count: 1 })
  assert.deepEqual(s.card, { sum: 11000, count: 2 })
  assert.deepEqual(s.qr, { sum: 13000, count: 2 })
  // 1/2 は NOAH に来院の記録が無い日（しかも 5,000円以上）、1/3 の QR 12,000円は 5,000円以上で、その日の窓口の金額もこえる
  const byDate = Object.fromEntries(s.candidates.map((c) => [c.date + c.kind, c.reasons]))
  assert.deepEqual(byDate['2099-01-02card'], ['NOAHに来院の記録が無い日', '1回5,000円以上'])
  assert.deepEqual(byDate['2099-01-03qr'], ['1回5,000円以上'])
  assert.equal(s.candidates.length, 2)

  // 印を付けなければ、一括・QR はぜんぶ重なる分（足さない）
  const none = extraFromSummary(s, new Set(), '2099-02-10')
  assert.equal(none.subscription, 20000)
  assert.equal(none.cashless, 24000)
  assert.equal(none.overlap, 24000)
  // 「NOAHに入っていない」に印を付けた分だけ足す
  const id = s.candidates.find((c) => c.date === '2099-01-02').id
  const one = extraFromSummary(s, new Set([id]), '2099-02-10')
  assert.equal(one.overlap, 24000 - 8000)
  assert.ok(one.note.length <= 200)
  assert.ok(!one.note.includes('花子'))
})

test('NOAH の CSV が無い月は、日ごとの見比べをしない', () => {
  const [s] = summarizeAlpha(parseAlphaCashless(CASHLESS).payments, [])
  assert.equal(s.noahMissing, true)
  assert.deepEqual(s.candidates.map((c) => c.reasons), [['1回5,000円以上']])
})

console.log(`\n${passed} 件すべて OK`)
