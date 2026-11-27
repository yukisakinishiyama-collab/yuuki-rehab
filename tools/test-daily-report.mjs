// 日報（1日分の予約・来院予定・キャンセル・カルテ・売上のまとめ）の決まりの確認（2026-11-27 院長の依頼）
// 実行: npx tsx tools/test-daily-report.mjs   （外には送らない・お名前は架空）
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {
  REPORT_AHEAD_DAYS, REPORT_BACK_DAYS, buildDailyReport, endTime, feedRange, isFirstVisit, reportDateLabel, rowStatus, shortDateLabel, sourceShort,
} from '../src/lib/daily-report.ts'

let passed = 0
function test(name, fn) {
  fn()
  passed += 1
  console.log(`  ✓ ${name}`)
}
const read = (p) => fs.readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')

const TODAY = '2026-11-27' // 金曜

test('日付の見せ方', () => {
  assert.equal(reportDateLabel('2026-11-27'), '2026年11月27日（金）')
  assert.equal(shortDateLabel('2026-11-28'), '11/28（土）')
  assert.equal(reportDateLabel('2026-02-30'), '2026-02-30', 'ありえない日はそのまま')
})

test('予約システムへの頼み方：その日と次の日が入る。読めるのは60日前〜13日先', () => {
  assert.deepEqual(feedRange(TODAY, TODAY), { back: 0, days: 2 })
  assert.deepEqual(feedRange('2026-11-26', TODAY), { back: 1, days: 1 }, '昨日なら、昨日と今日（＝次の日）')
  assert.deepEqual(feedRange('2026-11-20', TODAY), { back: 7, days: 1 })
  assert.deepEqual(feedRange('2026-11-30', TODAY), { back: 0, days: 5 })
  assert.deepEqual(feedRange('2026-12-10', TODAY), { back: 0, days: 14 }, '13日先：次の日は入らない（14日が上限）')
  assert.equal(feedRange('2026-12-11', TODAY), null)
  assert.deepEqual(feedRange('2026-09-28', TODAY), { back: 60, days: 1 })
  assert.equal(feedRange('2026-09-27', TODAY), null)
  assert.equal(REPORT_BACK_DAYS, 60)
  assert.equal(REPORT_AHEAD_DAYS, 13)
  // 予約システムの決まり（days は 1〜14・back は 0〜60）と同じ
  const route = read('src/app/api/yoyaku/feed/route.ts')
  assert.match(route, /clampParam\(request\.nextUrl\.searchParams\.get\('back'\), 0, 0, 60\)/)
})

test('予約の状態・初めての方・終わりの時刻・入口の短い名前', () => {
  assert.equal(rowStatus('確定'), 'booked')
  assert.equal(rowStatus(''), 'booked')
  assert.equal(rowStatus('来院済み'), 'visited')
  assert.equal(rowStatus('キャンセル'), 'cancelled')
  assert.equal(rowStatus('保留'), 'other')
  assert.equal(isFirstVisit({ visitType: '初めて', kubun: '自費リハビリ' }), true)
  assert.equal(isFirstVisit({ visitType: '', kubun: '初診（60分）' }), true)
  assert.equal(isFirstVisit({ visitType: '2回目以降', kubun: '自費リハビリ' }), false)
  assert.equal(isFirstVisit({ visitType: '', kubun: '再初診' }), false)
  assert.equal(endTime('9:30', 60), '10:30')
  assert.equal(endTime('17:45', 30), '18:15')
  assert.equal(endTime('', 30), '')
  assert.equal(endTime('10:00', 0), '')
  assert.equal(sourceShort('staff'), '院で登録')
  assert.equal(sourceShort('line'), 'LINE')
  assert.equal(sourceShort('google_profile'), 'Googleマップ')
  assert.equal(sourceShort(''), '')
})

// 架空のカルテと予約
const patients = [
  { id: 'p1', name: '見本 一郎', kana: 'みほん いちろう', phone: '090-1111-0001', createdAt: '2026-01-10T00:00:00Z' },
  { id: 'p2', name: '見本 花子', kana: 'みほん はなこ', phone: '090-1111-0002', createdAt: '2026-11-27T01:00:00Z', autoCreatedFrom: 'reservation' },
  { id: 'p3', name: '試験 三郎', kana: 'しけん さぶろう', phone: '090-1111-0003', createdAt: '2026-11-26T16:30:00Z' }, // 日本時間 11/27 1:30
  { id: 'p4', name: '試験 四季', kana: 'しけん しき', phone: '', createdAt: '2026-11-26T14:00:00Z' }, // 日本時間 11/26 23:00
]
const row = (time, name, over = {}) => ({ time, name, kana: '', phone: '', kubun: '自費リハビリ', status: '確定', reservationNo: `R${time.replace(':', '')}`, memo: '', visitType: '2回目以降', staff: '院長', duration: 60, source: 'staff', ...over })
const rows = [
  row('15:00', '見本 一郎 様', { status: '来院済み', sub: true, memo: '右膝。テーピング希望' }),
  row('9:30', '見本 花子', { visitType: '初めて', source: 'instagram', staff: 'スタッフA', nominated: true, duration: 30 }),
  row('11:00', '試験 三郎', { status: 'キャンセル', reservationNo: 'R-C1' }),
  row('12:00', 'まだ カルテなし', { source: 'line' }),
  row('18:30', '試験 四季', { source: 'direct' }),
]

test('予約：キャンセルを除いて時刻の順。お名前の「様」を除く。カルテが1つに決まる方はカルテへ', () => {
  const r = buildDailyReport({ date: TODAY, today: TODAY, nowTime: '13:00', rows, nextRows: null, plans: [], cancellations: [], patients, notes: [] })
  assert.equal(r.label, '2026年11月27日（金）')
  assert.equal(r.reservationsLoaded, true)
  assert.deepEqual(r.reservations.map((x) => x.time), ['9:30', '12:00', '15:00', '18:30'])
  const hanako = r.reservations[0]
  assert.equal(hanako.name, '見本 花子')
  assert.equal(hanako.end, '10:00')
  assert.equal(hanako.first, true)
  assert.equal(hanako.staff, 'スタッフA')
  assert.equal(hanako.nominated, true)
  assert.equal(hanako.patientId, 'p2')
  const ichiro = r.reservations[2]
  assert.equal(ichiro.name, '見本 一郎')
  assert.equal(ichiro.statusLabel, '来院済み')
  assert.equal(ichiro.member, true)
  assert.equal(ichiro.memo, '右膝。テーピング希望')
  assert.equal(r.reservations[1].patientId, undefined, 'カルテが無い方')
  assert.deepEqual(r.counts, { total: 4, visited: 1, first: 1, member: 1, net: 3, clinic: 1, cancelled: 1, sameDay: 0, noShow: 0, plans: 0 })
  assert.deepEqual(r.byStaff, [{ staff: '院長', count: 3 }, { staff: 'スタッフA', count: 1 }])
  assert.deepEqual(r.bySource.map((s) => [s.label, s.count]), [['Instagram', 1], ['LINE', 1], ['入口不明', 1]], '同じ数なら、予約システムの流入元の並び')
  // 電話番号は日報に出さない
  assert.ok(!JSON.stringify(r).includes('090-'))
})

test('キャンセル：予約システムのキャンセルにカルテの記録（区分・理由）を重ねる。カルテにだけある記録も出す。数えない記録は数に入れない', () => {
  const cancellations = [
    { patientId: 'p3', kind: 'same_day', appointmentDate: TODAY, appointmentTime: '11:00', reason: '発熱', sourceReservationNo: 'R-C1' },
    { patientId: 'p1', kind: 'no_show', appointmentDate: TODAY, appointmentTime: '8:30', reason: '' },
    { patientId: 'p4', kind: 'advance', appointmentDate: TODAY, appointmentTime: '17:00', reason: '入力の重なり', excludedAs: 'input_error' },
    { patientId: 'p1', kind: 'advance', appointmentDate: '2026-11-26', reason: '別の日' },
  ]
  const r = buildDailyReport({ date: TODAY, today: TODAY, rows, plans: [], cancellations, patients, notes: [] })
  assert.deepEqual(
    r.cancels.map((c) => [c.time, c.name, c.kind, c.reason, c.excluded, c.fromYoyaku]),
    [
      ['8:30', '見本 一郎', '無断', '', '', false],
      ['11:00', '試験 三郎', '当日', '発熱', '', true],
      ['17:00', '試験 四季', '予約日前', '入力の重なり', '入力ミス', false],
    ],
  )
  assert.equal(r.counts.cancelled, 2, '入力ミスは数えない')
  assert.equal(r.counts.sameDay, 1)
  assert.equal(r.counts.noShow, 1)
  // 予約が戻った（キャンセルでなくなった）記録は出さない
  const back = buildDailyReport({
    date: TODAY, today: TODAY, rows: [row('11:00', '試験 三郎', { reservationNo: 'R-C1' })], plans: [], patients, notes: [],
    cancellations: [{ patientId: 'p3', kind: 'same_day', appointmentDate: TODAY, sourceReservationNo: 'R-C1' }],
  })
  assert.equal(back.cancels.length, 0)
})

test('予約を読めなかった日：予約の数は出さず、来院予定・キャンセル（カルテの記録）・新しいカルテは出す', () => {
  const r = buildDailyReport({
    date: TODAY, today: TODAY, rows: null, plans: [{ id: 'v1', date: TODAY, name: '予定 五月', note: '夕方', status: 'planned', createdAt: '', updatedAt: '' }],
    cancellations: [{ patientId: 'p1', kind: 'same_day', appointmentDate: TODAY }], patients, notes: [],
  })
  assert.equal(r.reservationsLoaded, false)
  assert.equal(r.reservations.length, 0)
  assert.equal(r.plans.length, 1)
  assert.equal(r.cancels.length, 1)
  assert.equal(r.next, null)
})

test('来院予定（時間未定）：その日の分だけ、お名前の順。状態の名前つき', () => {
  const plans = [
    { id: 'v1', date: TODAY, name: '予定 五月', note: '夕方ごろ', status: 'planned', createdAt: '', updatedAt: '' },
    { id: 'v2', date: TODAY, name: '見本 一郎', patientId: 'p1', status: 'visited', createdAt: '', updatedAt: '' },
    { id: 'v3', date: '2026-11-28', name: '別の日', status: 'planned', createdAt: '', updatedAt: '' },
  ]
  const r = buildDailyReport({ date: TODAY, today: TODAY, rows: [], plans, cancellations: [], patients, notes: [] })
  assert.deepEqual(r.plans.map((p) => [p.name, p.statusLabel, p.note]), [['見本 一郎', '来院した', ''], ['予定 五月', '予定', '夕方ごろ']])
  assert.equal(r.counts.plans, 2)
})

test('カルテ：SOAP を書いた数と、予約があって SOAP がまだの方（今日は時刻を過ぎた予約・来院済みだけ。先の日は出さない）', () => {
  const notes = [{ patientId: 'p2', visitDate: TODAY }, { patientId: 'p1', visitDate: '2026-11-20' }]
  const r = buildDailyReport({ date: TODAY, today: TODAY, nowTime: '13:00', rows, plans: [], cancellations: [], patients, notes })
  assert.equal(r.karte.written, 1)
  // 9:30 花子＝書いた／12:00 カルテなし＝まだ／15:00 一郎＝来院済みなので時刻の前でも出す／18:30 四季＝まだ時刻の前／11:00 三郎＝キャンセル
  assert.deepEqual(r.karte.missing.map((m) => [m.time, m.name, m.noKarte]), [['12:00', 'まだ カルテなし', true], ['15:00', '見本 一郎', false]])
  const past = buildDailyReport({ date: '2026-11-26', today: TODAY, rows, plans: [], cancellations: [], patients, notes })
  assert.equal(past.karte.missing.length, 4, '前の日は、時刻にかかわらずキャンセル以外のすべて')
  const future = buildDailyReport({ date: '2026-11-28', today: TODAY, rows, plans: [], cancellations: [], patients, notes })
  assert.equal(future.karte, null)
})

test('この日に作ったカルテ（日本時間で数える）。予約から自動で作ったカルテには印', () => {
  const r = buildDailyReport({ date: TODAY, today: TODAY, rows: [], plans: [], cancellations: [], patients, notes: [] })
  assert.deepEqual(r.newCharts.map((n) => [n.name, n.auto]), [['試験 三郎', false], ['見本 花子', true]])
})

test('次の日の予約の数（キャンセルを除く・初めての方）', () => {
  const nextRows = [row('10:00', 'あ', { visitType: '初めて' }), row('11:00', 'い'), row('12:00', 'う', { status: 'キャンセル' })]
  const r = buildDailyReport({ date: TODAY, today: TODAY, rows: [], nextRows, plans: [], cancellations: [], patients, notes: [] })
  assert.deepEqual(r.next, { date: '2026-11-28', total: 2, first: 1 })
})

test('売上（NOAH）は、渡されたときだけ載せる（院長が経営を開いているときだけ、画面の側で渡す）', () => {
  const noah = { visits: 22, sales: 98000, ins: [15, 60000], self: [7, 38000], nonIns: [0, 0], acc: [0, 0], work: [0, 0] }
  assert.equal(buildDailyReport({ date: TODAY, today: TODAY, rows: [], plans: [], cancellations: [], patients, notes: [] }).noah, null)
  assert.deepEqual(buildDailyReport({ date: TODAY, today: TODAY, rows: [], plans: [], cancellations: [], patients, notes: [], noah }).noah, noah)
  const ui = read('src/components/clinic/DailyReport.tsx')
  assert.match(ui, /const salesAllowed = isAdmin && keieiOpen/)
  assert.match(ui, /noah: showSales \? noahDay\.day : null/)
  assert.match(ui, /if \(!salesAllowed\) return/, '経営を開いていないときは、売上を読みに行かない')
})

test('売上の CSV：院長が経営を開いているときだけ、日報の画面からも入れられる。保存したら売上を読み直す（紙には出さない）', () => {
  const ui = read('src/components/clinic/DailyReport.tsx')
  // 売上を入れる入口（NOAH の日報の PDF・CSV）は、院長が経営を開いているときだけ・紙には出さない
  assert.match(ui, /\{showSales && \(\s*<div className="space-y-3 print:hidden">/)
  // PDF は日報のいちばん上（見出しより前）。院長には上の「NOAH の PDF を入れる」ボタン（経営が閉じていれば開いて、そこへ移る）
  assert.match(ui, /\{showSales && \(\s*<div id=\{PDF_IMPORT_ID\} className="scroll-mt-20 print:hidden">\s*<NoahDailyPdfImport/)
  assert.ok(ui.indexOf('<NoahDailyPdfImport') < ui.indexOf('{/* 見出し（画面と紙） */}'), 'PDF の欄は見出しより上')
  assert.match(ui, /\{isAdmin && \(\s*<Button[^>]*onClick=\{goToPdfImport\}>/)
  assert.match(ui, /if \(!keieiOpen\) openKeiei\(\)/)
  assert.match(ui, /\{noah && !noah\.error && <KeieiCsvImport storeMonths=\{noah\.store\?\.months \?\? \[\]\} onSaved=\{\(\) => setTick\(\(t\) => t \+ 1\)\} \/>\}/)
  assert.match(ui, /\}, \[salesAllowed, tick\]\)/, '読み直す（tick）で NOAH も読み直す')
  // 入れる先は、経営の「CSVを入れて最新にする」と同じ（院長だけの API）
  assert.match(read('src/components/clinic/KeieiCsvImport.tsx'), /\/api\/marketing\/noah\/import/)
  assert.match(read('src/app/api/marketing/noah/import/route.ts'), /const denied = requireAdmin\(request\)/)
})

test('画面：印刷は A4 縦。メニュー・ボタンは紙に出さない。電話番号は出さない。予約の画面から開ける', () => {
  const ui = read('src/components/clinic/DailyReport.tsx')
  assert.match(ui, /@page \{ size: A4 portrait;/)
  assert.match(ui, /onClick=\{\(\) => window\.print\(\)\}/)
  assert.match(ui, /print:hidden/)
  assert.ok(!/\.phone\b/.test(ui), '電話番号を画面に出さない')
  assert.match(ui, /院の外へ持ち出さず、要らなくなったらシュレッダーで処分してください/)
  assert.match(read('src/components/rehab/YoyakuFrame.tsx'), /href="\/yoyaku\/daily"/)
  assert.match(read('src/components/clinic/ClinicShell.tsx'), /no-print fixed inset-y-0 left-0/, 'PC の左のメニューは紙に出ない')
})

console.log(`\n${passed} 件 OK`)
