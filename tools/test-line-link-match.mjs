// 予約の方の LINE 連携を探す決まり（2026-11-25 院長「予約確定したさいに患者様にlineでの通知が入っていません」「LINE連携は昨日確実にしました」）
// サーバー（確定・前日のお知らせを自動で送る）と、今日の画面が、同じ決まり（lib/line-link-match.ts）で探すことを確かめる
// 実行: npx tsx tools/test-line-link-match.mjs（データはすべて架空）
import assert from 'node:assert/strict'
import fs from 'node:fs'

const M = await import('../src/lib/line-link-match.ts')
const read = (p) => fs.readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')

let passed = 0
function test(name, fn) {
  fn()
  passed += 1
  console.log(`  ✓ ${name}`)
}

const link = (o) => ({ key: `${o.phone ?? ''}|${String(o.name).replace(/\s/g, '')}`, linkedAt: '2030-01-01T00:00:00Z', ...o })
const find = (row, kartes, links) => {
  const m = M.matchLinkForReservation(row, kartes, links)
  return m.linked ? `${m.how}:${m.link.key}` : m.why
}

test('お名前・電話の比べ方：空白・全角・ハイフン・+81・先頭の 0 はちがいにしない。短い番号は比べない', () => {
  assert.equal(M.matchName(' 山田　花子 '), '山田花子')
  assert.equal(M.matchName('ﾔﾏﾀﾞ ﾊﾅｺ'), 'ヤマダハナコ')
  assert.equal(M.matchPhone('090-1111-2222'), '9011112222')
  assert.equal(M.matchPhone('０９０１１１１２２２２'), '9011112222', '全角の数字')
  assert.equal(M.matchPhone('9011112222'), '9011112222', '表計算で先頭の 0 が落ちた番号')
  assert.equal(M.matchPhone('+81 90-1111-2222'), '9011112222')
  assert.equal(M.matchPhone('083-265-0000'), '832650000')
  assert.equal(M.matchPhone('1234'), '')
  assert.equal(M.matchPhone(''), '')
})

test('1. 予約の電話＋お名前で結びついた LINE（電話の書き方がちがっても同じ）', () => {
  const links = [link({ name: '山田花子', phone: '09011112222' })]
  assert.equal(find({ name: '山田 花子', phone: '090-1111-2222' }, [], links), 'direct:09011112222|山田花子')
  assert.equal(find({ name: '山田花子', phone: '9011112222' }, [], links), 'direct:09011112222|山田花子', '先頭の 0 が落ちた予約')
  assert.equal(find({ name: '山田花子', phone: '090-9999-0000' }, [], links), 'no_karte', '電話がちがい、カルテも無い')
  assert.equal(find({ name: '', phone: '090-1111-2222' }, [], links), 'no_name')
})

test('3a. カルテのQRコードで結びついた LINE：予約に電話が無い・電話がちがう・カルテに生年月日が無くても、カルテの ID で見つける', () => {
  const kartes = [{ id: 'p2', name: '鈴木 一郎', phone: '' }]
  const links = [link({ name: '鈴木 一郎', phone: '08012345678', patientId: 'p2' })]
  assert.equal(find({ name: '鈴木一郎', phone: '' }, kartes, links), 'karte_id:08012345678|鈴木一郎')
  assert.equal(find({ name: '鈴木 一郎', phone: '090-0000-1111' }, kartes, links), 'karte_id:08012345678|鈴木一郎')
})

test('3b・3c. カルテの電話＋お名前、お名前＋生年月日で結びついた LINE', () => {
  const kartes = [
    { id: 'p3', name: '高橋 次郎', phone: '070-1111-2222' },
    { id: 'p1', name: '佐藤 太郎', phone: '070-5555-6666', birthDate: '2012-05-06' },
  ]
  const links = [link({ name: '高橋次郎', phone: '07011112222' }), link({ name: '佐藤太郎', phone: '08033334444', birthDate: '2012-05-06' })]
  assert.equal(find({ name: '高橋次郎', phone: '' }, kartes, links), 'karte_phone:07011112222|高橋次郎')
  assert.equal(find({ name: '佐藤太郎', phone: '' }, kartes, links), 'birth:08033334444|佐藤太郎')
  assert.equal(find({ name: '佐藤太郎', phone: '070-5555-6666' }, kartes, links), 'birth:08033334444|佐藤太郎')
})

test('同じお名前のカルテが2つ以上：電話で決まればその方。決められなければ送らない（karte_ambiguous）', () => {
  const kartes = [
    { id: 'p4', name: '田村 三郎', phone: '080-4444-0001' },
    { id: 'p5', name: '田村 三郎', phone: '080-4444-0002' },
  ]
  const links = [link({ name: '田村 三郎', phone: '09077778888', patientId: 'p4' })]
  assert.equal(find({ name: '田村三郎', phone: '' }, kartes, links), 'karte_ambiguous')
  assert.equal(find({ name: '田村三郎', phone: '090-0000-0000' }, kartes, links), 'karte_ambiguous', '予約の電話がどちらのカルテともちがう')
  assert.equal(find({ name: '田村三郎', phone: '080-4444-0001' }, kartes, links), 'karte_id:09077778888|田村三郎')
  assert.equal(find({ name: '田村三郎', phone: '080-4444-0002' }, kartes, links), 'karte_not_linked', '電話でわかったのは結びついていない方のカルテ')
})

test('お名前も電話も同じカルテが2つ（同じ方のカルテが重なっている）：どちらかに結びついた LINE を使う', () => {
  const kartes = [
    { id: 'rsv1', name: '中村 四郎', phone: '080-5555-0001' },
    { id: 'p9', name: '中村四郎', phone: '08055550001' },
  ]
  const links = [link({ name: '中村四郎', phone: '09012340000', patientId: 'p9' })]
  assert.equal(find({ name: '中村 四郎', phone: '080-5555-0001' }, kartes, links), 'karte_id:09012340000|中村四郎')
  // 電話が無い予約では、同じ方かどうか決められない（お名前が同じ別の方かもしれない）
  assert.equal(find({ name: '中村 四郎', phone: '' }, kartes, links), 'karte_ambiguous')
})

test('同じカルテに LINE が2つ（結びつけ直し）：新しいほうを使う', () => {
  const kartes = [{ id: 'p2', name: '鈴木 一郎', phone: '' }]
  const links = [
    link({ name: '鈴木 一郎', phone: '08012345678', patientId: 'p2', linkedAt: '2030-01-01T00:00:00Z' }),
    link({ name: '鈴木 一郎', phone: '09099990000', patientId: 'p2', linkedAt: '2030-02-01T00:00:00Z' }),
  ]
  assert.equal(find({ name: '鈴木一郎', phone: '' }, kartes, links), 'karte_id:09099990000|鈴木一郎')
})

test('電話だけ同じ（お名前がちがう）カルテの LINE は使わない：同じ電話のご家族へ、ちがう方の予約を送らない', () => {
  const kartes = [{ id: 'p6', name: '小林 太郎', phone: '090-2222-3333' }]
  const links = [link({ name: '小林 太郎', phone: '09022223333', patientId: 'p6' })]
  assert.equal(find({ name: '小林 次郎', phone: '090-2222-3333' }, kartes, links), 'no_karte')
  // 画面には「近いカルテ」として出す（字のちがいなら、院長がそろえられる）
  const near = M.nearMissFor({ name: '小林 次郎', phone: '090-2222-3333' }, kartes, links)
  assert.equal(near.kind, 'other_name')
  assert.deepEqual(near.kartes.map((k) => [k.id, k.name, k.link.key]), [['p6', '小林 太郎', '09022223333|小林太郎']])
  assert.match(M.nearMissText(near), /小林 太郎 様/)
  assert.match(M.nearMissText(near), /同じ方なら/)
  assert.match(M.nearMissText(near), /自動のLINE（確定・前日のお知らせ）は届きません/)
})

test('近いカルテ：同じお名前のカルテが2つ以上で決められないとき、LINE のあるカルテを返す。届く方・ほんとうに連携の無い方には何も出さない', () => {
  const kartes = [
    { id: 'p4', name: '田村 三郎', phone: '080-4444-0001' },
    { id: 'p5', name: '田村 三郎', phone: '080-4444-0002' },
    { id: 'p7', name: '架空 花子', phone: '080-7777-0000' },
  ]
  const links = [link({ name: '田村 三郎', phone: '09077778888', patientId: 'p4' })]
  const near = M.nearMissFor({ name: '田村三郎', phone: '' }, kartes, links)
  assert.equal(near.kind, 'ambiguous')
  assert.deepEqual(near.kartes.map((k) => k.id), ['p4'])
  assert.match(M.nearMissText(near), /同じお名前のカルテが2つ以上/)
  assert.equal(M.nearMissFor({ name: '田村三郎', phone: '080-4444-0001' }, kartes, links), null, '届く方')
  assert.equal(M.nearMissFor({ name: '架空花子', phone: '080-7777-0000' }, kartes, links), null, 'カルテはあるが LINE が無い方')
  assert.equal(M.nearMissFor({ name: '初めての方', phone: '080-0000-9999' }, kartes, links), null, 'カルテも LINE も無い方')
})

test('カルテの「LINE連携済み」（matchLinkForKarte）：カルテの ID → 電話＋お名前 → お名前＋生年月日', () => {
  const links = [
    link({ name: '鈴木 一郎', phone: '08012345678', patientId: 'p2' }),
    link({ name: '高橋次郎', phone: '07011112222' }),
    link({ name: '佐藤太郎', phone: '08033334444', birthDate: '2012-05-06' }),
  ]
  assert.equal(M.matchLinkForKarte({ id: 'p2', name: '鈴木 一郎', phone: '' }, links).key, '08012345678|鈴木一郎')
  assert.equal(M.matchLinkForKarte({ id: 'p3', name: '高橋 次郎', phone: '070-1111-2222' }, links).key, '07011112222|高橋次郎')
  assert.equal(M.matchLinkForKarte({ id: 'p1', name: '佐藤 太郎', phone: '', birthDate: '2012-05-06' }, links).key, '08033334444|佐藤太郎')
  assert.equal(M.matchLinkForKarte({ id: 'p8', name: '佐藤 太郎', phone: '', birthDate: '2011-01-01' }, links), null, '生年月日がちがう同じお名前の方')
  assert.equal(M.matchLinkForKarte({ id: 'p9', name: '架空 花子', phone: '080-7777-0000' }, links), null)
})

test('理由の言葉：お名前・電話などは入らない。どの理由にも言葉がある', () => {
  for (const why of ['no_name', 'no_karte', 'karte_ambiguous', 'karte_not_linked']) assert.ok(M.LINK_MISS_TEXT[why].length > 5, why)
})

test('探し方は1か所：サーバーも今日の画面も、この決まりを使う（別の探し方を持たない）', () => {
  const server = read('src/lib/marketing/line-reservation-server.ts')
  assert.match(server, /matchLinkForReservation\(\{ name, phone \}, patients, cache\.links\)/)
  assert.doesNotMatch(server, /nameNoSpace|phoneDigits/, 'サーバーに、別の比べ方を残さない')
  const reach = read('src/components/clinic/ReminderReachPanel.tsx')
  assert.match(reach, /matchLinkForReservation\(row, patients, links\)\.linked/)
  assert.doesNotMatch(reach, /patientLinkKey|linkFor\(/, '画面に、別の探し方を残さない')
  assert.match(reach, /nearMissText\(near\)/, '届かない理由と直し方を出す')
  const send = read('src/components/clinic/LineReservationPanel.tsx')
  assert.match(send, /matchLinkForReservation\(row, patients, links\)/)
  assert.doesNotMatch(send, /patientLinkKey|matchKartePatients|linkFor\(/)
  assert.match(send, /items\.filter\(\(i\) => !i\.caution\)/, '自動では決められない予約は、前日のお知らせの控えに入れない')
  assert.match(send, /同じ方のLINEであることを確かめてから/, '手で送る前に、送る先を確かめてもらう')
  const client = read('src/lib/line-link-client.ts')
  assert.match(client, /matchLinkForKarte\(patient, links\)/)
  // 予約システムへの返事に理由（why）を入れる（実行ログで原因がわかる。お名前などは入れない）
  const route = read('src/app/api/marketing/reservation-notify/route.ts')
  assert.match(route, /result: r\.result, why: r\.why/)
})

console.log(`\n${passed} 件 OK`)
