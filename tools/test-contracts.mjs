// 契約書のひな形の読み方と、会員プランの日付の決まりの確認
// 実行: node tools/test-contracts.mjs   （Node 22.18+ は .ts をそのまま読める）
import assert from 'node:assert/strict'
import { register } from 'node:module'
register(
  'data:text/javascript,' +
    encodeURIComponent(
      "export async function resolve(s, c, next) { if (s.startsWith('@/')) s = new URL('../src/' + s.slice(2), import.meta.url.replace(/[^/]*$/, '') + 'x').href.replace('/x/../', '/'); try { return await next(s, c) } catch (e) { if (!/\\\\.[a-z]+$/.test(s.split('?')[0])) return next(s + '.ts', c); throw e } }",
    ),
)

const root = new URL('../', import.meta.url)
const { CONTRACT_TEMPLATES } = await import(new URL('src/data/contract-templates.ts', root).href)
const { parseTemplate, renderTemplateHtml } = await import(new URL('src/lib/contracts/template.ts', root).href)
const member = await import(new URL('src/lib/contracts/member.ts', root).href)
const autofill = await import(new URL('src/lib/contracts/autofill.ts', root).href)

let passed = 0
function test(name, fn) {
  fn()
  passed += 1
  console.log(`  ✓ ${name}`)
}

test('6種類のひな形が読める（題名・チェック・記入欄の数）', () => {
  assert.equal(CONTRACT_TEMPLATES.length, 6)
  for (const t of CONTRACT_TEMPLATES) {
    const p = parseTemplate(t.body)
    assert.equal(p.blocks[0].type, 'title', t.id)
    assert.equal(p.blocks[0].text, t.title, t.id)
    assert.ok(p.checkCount > 0 || t.id === 'fee-cancel-policy', `${t.id} のチェック`)
    // 文面に署名欄の表を残さない（署名は画面の署名欄で行う）
    assert.ok(!/患者様氏名|説明担当者（氏名）/.test(t.body), `${t.id} に署名欄が残っている`)
  }
})

test('□・＿＿・日付・（　）・表の空のマスを、上から順に番号を振る', () => {
  const p = parseTemplate('# 題\n□ A　□ B\n日付：　　　年　　　月　　　日　（　　　）\n| **項目** | **内容** |\n| 名前 |   |\n| 学校 | ＿＿＿ |')
  assert.equal(p.checkCount, 2)
  assert.equal(p.blankCount, 4)
  const kinds = p.blocks.flatMap((b) => (b.parts ?? []).concat(...(b.rows ?? []).flat())).filter((x) => x.t === 'blank').map((x) => x.kind)
  assert.deepEqual(kinds, ['date', 'text', 'text', 'text'])
})

test('印刷の形：チェックは ☑、記入は下線つき、白紙は ☐ と空欄', () => {
  const p = parseTemplate('# 題\n□ はい　□ いいえ\n氏名：＿＿＿＿　日付：　　　年　　　月　　　日')
  const filled = renderTemplateHtml(p, [true, false], ['山田 太郎', '2026-11-20'])
  assert.match(filled, /☑/)
  assert.match(filled, /☐/)
  assert.match(filled, /<span class="fill">山田 太郎<\/span>/)
  assert.match(filled, /2026年11月20日/)
  const blank = renderTemplateHtml(p, null, null)
  assert.equal((blank.match(/☐/g) ?? []).length, 2)
  assert.doesNotMatch(blank, /☑/)
})

test('記入欄の文字は HTML として読まない（<script> などはそのままの文字）', () => {
  const p = parseTemplate('# 題\n氏名：＿＿＿＿')
  const html = renderTemplateHtml(p, [], ['<script>alert(1)</script>'])
  assert.doesNotMatch(html, /<script>/)
  assert.match(html, /&lt;script&gt;/)
})

test('最低利用期間：開始日の3か月後の前日（休会の月数だけ後ろへ）', () => {
  assert.equal(member.minEndOf('2026-11-20'), '2027-02-19')
  assert.equal(member.minEndOf('2026-11-01'), '2027-01-31')
  assert.equal(member.minEndOf('2026-11-30', 0), '2027-02-28') // 2月30日は無いので2月の末日まで（民法143条）
  assert.equal(member.minEndOf('2026-11-28', 0), '2027-02-27')
  assert.equal(member.minEndOf('2026-11-20', 2), '2027-04-19')
})

test('解約：15日までの提出は当月末、16日以降は翌月末', () => {
  assert.equal(member.cancelEndOf('2026-11-15'), '2026-11-30')
  assert.equal(member.cancelEndOf('2026-11-16'), '2026-12-31')
  assert.equal(member.cancelEndOf('2026-12-20'), '2027-01-31')
  assert.equal(member.cancelEndOf('2027-02-01'), '2027-02-28')
})

const rec = (signedAt, m) => ({ id: signedAt, patientId: 'p', docId: 'x', title: '', version: '', bodyHash: '0', signedAt, signedDate: signedAt.slice(0, 10), patientName: 'a', staffLabel: '', staffName: 's', checked: 0, written: 0, member: m })

test('会員の状態：入会→休会→再開→解約予定→退会', () => {
  const join = rec('2026-11-20T01:00:00Z', { kind: 'join', plan: '一般会員', start: '2026-11-20' })
  assert.equal(member.memberStatusOf([], '2026-11-20').state, 'none')
  assert.equal(member.memberStatusOf([join], '2026-11-19').state, 'upcoming')
  const s1 = member.memberStatusOf([join], '2026-12-01')
  assert.equal(s1.state, 'active')
  assert.equal(s1.minEnd, '2027-02-19')
  const pause = rec('2026-12-05T01:00:00Z', { kind: 'pause', pauseFrom: '2027-01', pauseMonths: 2 })
  assert.equal(member.memberStatusOf([join, pause], '2027-01-10').state, 'paused')
  assert.equal(member.memberStatusOf([join, pause], '2027-01-10').resumeMonth, '2027-03')
  assert.equal(member.memberStatusOf([join, pause], '2027-03-01').state, 'active')
  assert.equal(member.memberStatusOf([join, pause], '2027-03-01').minEnd, '2027-04-19')
  const cancel = rec('2027-04-10T01:00:00Z', { kind: 'cancel', submitted: '2027-04-10', end: '2027-04-30' })
  assert.equal(member.memberStatusOf([join, pause, cancel], '2027-04-20').state, 'ending')
  assert.equal(member.memberStatusOf([join, pause, cancel], '2027-05-01').state, 'ended')
  // 取り消した書類は数えない
  assert.equal(member.memberStatusOf([join, pause, { ...cancel, voided: { at: 'x', reason: 'y' } }], '2027-05-01').state, 'active')
})

test('入会・休会・解約の手続きの確認（できないときは理由を出す）', () => {
  const join = rec('2026-11-20T01:00:00Z', { kind: 'join', plan: '一般会員', start: '2026-11-20' })
  // 入会：すでに会員なら断る。種別と開始日が要る
  assert.equal(member.buildMemberEvent('join', { plan: '一般会員', start: '2026-11-20' }, [], '2026-11-20').ok, true)
  assert.equal(member.buildMemberEvent('join', { plan: '一般会員', start: '2026-12-01' }, [join], '2026-11-25').ok, false)
  assert.equal(member.buildMemberEvent('join', { start: '2026-11-20' }, [], '2026-11-20').ok, false)
  // 休会：会員のときだけ。開始月は今月以降、1〜6か月
  assert.equal(member.buildMemberEvent('pause', { pauseFrom: '2026-12', pauseMonths: 1 }, [join], '2026-11-25').ok, true)
  assert.equal(member.buildMemberEvent('pause', { pauseFrom: '2026-10', pauseMonths: 1 }, [join], '2026-11-25').ok, false)
  assert.equal(member.buildMemberEvent('pause', { pauseFrom: '2026-12', pauseMonths: 7 }, [join], '2026-11-25').ok, false)
  assert.equal(member.buildMemberEvent('pause', { pauseFrom: '2026-12', pauseMonths: 1 }, [], '2026-11-25').ok, false)
  // 解約：最低利用期間の途中は特別な事情が要る
  const early = member.buildMemberEvent('cancel', {}, [join], '2026-12-10')
  assert.equal(early.ok, false)
  assert.match(early.error, /最低利用期間/)
  const special = member.buildMemberEvent('cancel', { special: true, specialReason: '転居' }, [join], '2026-12-10')
  assert.equal(special.ok, true)
  assert.equal(special.event.end, '2026-12-31')
  assert.equal(special.event.specialReason, '転居')
  const normal = member.buildMemberEvent('cancel', {}, [join], '2027-02-10')
  assert.equal(normal.ok, true)
  assert.equal(normal.event.end, '2027-02-28')
  assert.equal(normal.event.special, undefined)
})

test('印刷に入れる「会員の手続き」の枠', () => {
  const html = member.memberEventHtml({ kind: 'cancel', submitted: '2026-11-16', end: '2026-12-31' }, { state: 'active', label: '会員', start: '2026-08-01', minEnd: '2026-10-31', pausedMonths: 0 })
  assert.match(html, /2026年12月31日（16日以降の提出のため翌月末）/)
  assert.match(html, /最後の決済月/)
  assert.match(html, /満了（2026年10月31日）/)
})

test('兄弟・親子プラン：もう1名の名前と続柄が要る・印刷の枠にもう1名が出る', () => {
  assert.deepEqual(member.MEMBER_PLANS, ['一般会員', '学生会員', '兄弟・親子プラン'])
  assert.equal(member.MEMBER_FEES['兄弟・親子プラン'], '月額30,000円・2名まで')
  const noName = member.buildMemberEvent('join', { plan: '兄弟・親子プラン', start: '2026-11-20' }, [], '2026-11-20')
  assert.equal(noName.ok, false)
  assert.match(noName.error, /もう1名/)
  const noRel = member.buildMemberEvent('join', { plan: '兄弟・親子プラン', start: '2026-11-20', partnerName: '山田 次郎' }, [], '2026-11-20')
  assert.equal(noRel.ok, false)
  const ok = member.buildMemberEvent(
    'join',
    { plan: '兄弟・親子プラン', start: '2026-11-20', partnerName: ' 山田 次郎 ', partnerRelation: '弟', partnerBirthDate: '2012-04-01', partnerPatientId: 'p2' },
    [],
    '2026-11-20',
  )
  assert.equal(ok.ok, true)
  assert.deepEqual(ok.event.partner, { name: '山田 次郎', relation: '弟', birthDate: '2012-04-01', patientId: 'p2' })
  // 一般会員では、もう1名を入れても残さない
  const single = member.buildMemberEvent('join', { plan: '一般会員', start: '2026-11-20', partnerName: 'x', partnerRelation: '弟' }, [], '2026-11-20')
  assert.equal(single.event.partner, undefined)
  const html = member.memberEventHtml(ok.event, { state: 'none', label: '', pausedMonths: 0 })
  assert.match(html, /兄弟・親子プラン（月額30,000円・2名まで）/)
  assert.match(html, /山田 次郎（弟・2012年4月1日生）/)
  assert.match(html, /来院した方ごと・施術した部位ごとに1,500円（健康保険を使わない場合）/)
  assert.ok(!html.includes('1,000円'))
})

test('兄弟・親子プラン：もう1名の方のカルテにも、代表の方の契約から状態が出る', () => {
  const r = (id, patientId, patientName, signedAt, m) => ({ ...rec(signedAt, m), id, patientId, patientName })
  const join = r('j1', 'p1', '山田 太郎', '2026-11-20T01:00:00Z', { kind: 'join', plan: '兄弟・親子プラン', start: '2026-11-20', partner: { name: '山田 次郎', relation: '弟', patientId: 'p2' } })
  const all = [join]
  const rep = member.memberStatusForPatient('p1', all, '2026-12-01')
  assert.equal(rep.state, 'active')
  assert.equal(rep.partner.name, '山田 次郎')
  assert.equal(rep.via, undefined)
  const sib = member.memberStatusForPatient('p2', all, '2026-12-01')
  assert.equal(sib.state, 'active')
  assert.deepEqual(sib.via, { patientId: 'p1', name: '山田 太郎' })
  assert.equal(member.memberStatusForPatient('p3', all, '2026-12-01').state, 'none')
  // 代表の方の休会・解約は、もう1名の方にも出る
  const pause = r('pz', 'p1', '山田 太郎', '2026-12-05T01:00:00Z', { kind: 'pause', pauseFrom: '2027-01', pauseMonths: 1 })
  assert.equal(member.memberStatusForPatient('p2', [join, pause], '2027-01-10').state, 'paused')
  const cancel = r('c1', 'p1', '山田 太郎', '2027-03-01T01:00:00Z', { kind: 'cancel', submitted: '2027-03-01', end: '2027-03-31' })
  assert.equal(member.memberStatusForPatient('p2', [join, pause, cancel], '2027-03-10').state, 'ending')
  // 代表の方が一般会員で入りなおしたら、もう1名ではなくなる
  const rejoin = r('j2', 'p1', '山田 太郎', '2027-05-01T01:00:00Z', { kind: 'join', plan: '一般会員', start: '2027-05-01' })
  assert.equal(member.memberStatusForPatient('p2', [join, pause, cancel, rejoin], '2027-05-10').state, 'none')
  // もう1名の方のカルテで休会・解約・別の入会をしようとすると、代表の方のカルテへ案内する
  const covered = member.memberStatusForPatient('p2', all, '2026-12-01')
  const p = member.buildMemberEvent('pause', { pauseFrom: '2027-01', pauseMonths: 1 }, [], '2026-12-01', covered)
  assert.equal(p.ok, false)
  assert.match(p.error, /山田 太郎さんのカルテ/)
  assert.equal(member.buildMemberEvent('join', { plan: '一般会員', start: '2026-12-01' }, [], '2026-12-01', covered).ok, false)
})

test('書類の文面：兄弟・親子プランの欄と、休会・解約・料金案内の種別', async () => {
  const get = (id) => CONTRACT_TEMPLATES.find((t) => t.id === id)
  assert.match(get('member-contract').body, /\| 兄弟・親子プラン（2名まで） \| 30,000円 \| □ 申し込む \|/)
  assert.match(get('member-contract').body, /3名以上での利用や、届け出た方以外の利用はできません/)
  for (const id of ['member-pause', 'member-cancel']) assert.match(get(id).body, /□ 兄弟・親子プラン（月額30,000円・2名分）/)
  assert.match(get('fee-cancel-policy').body, /\| 兄弟・親子プラン（2名まで・月額） \| 30,000円 \|/)
  for (const id of ['member-pause', 'member-cancel']) assert.equal(get(id).version, '2026-11-11.2')
  // 2026-11-13 会員プランの1部位施術料を 1,000円 → 1,500円（健康保険を使わない場合）に（院長の指示）。文面が変わったので版も変える
  for (const id of ['member-contract', 'fee-cancel-policy']) assert.equal(get(id).version, '2026-11-13')
  assert.match(get('member-contract').body, /\| 来院ごとの1部位施術料（別途・健康保険を使わない場合） \| 1,500円 \| □ 確認しました \|/)
  assert.match(get('member-contract').body, /□ 1部位施術料（健康保険を使わない場合 1,500円）は、来院した方ごと・施術した部位ごとにかかります。/)
  assert.match(get('fee-cancel-policy').body, /\| 来院ごとの1部位施術料（別途・健康保険を使わない場合） \| 1,500円 \|/)
  // 会員の1部位施術料に 1,000円 は残っていない
  for (const id of ['member-contract', 'fee-cancel-policy']) assert.ok(!/1部位施術料[^\n]*1,000円/.test(get(id).body), id)
  assert.ok(!get('member-contract').body.includes('1,000円'))
  // 変えていないもの：健康保険を使う場合の「別途1,000円」と、非会員の施術料金（1部位）1,500円
  assert.match(get('fee-cancel-policy').body, /健康保険をご利用いただく場合であっても、施術料金として別途1,000円を頂戴いたします/)
  assert.match(get('fee-cancel-policy').body, /\| 施術料金（1部位） \| 1,500円 \|/)
  // もう1名の欄（氏名・生年月日・続柄・目的）は4つの記入欄、確認のチェックは5つ
  const body = get('member-contract').body
  const start = body.indexOf('### 兄弟・親子プランを申し込む場合')
  const end = body.indexOf('## 3. 会員プランに含まれる内容')
  const full = parseTemplate(body)
  const without = parseTemplate(body.slice(0, start) + body.slice(end))
  assert.equal(full.blankCount - without.blankCount, 4)
  assert.equal(full.checkCount - without.checkCount, 5)
})

test('表の中の「　　　年　　　月　　　日」も日付の記入欄になる（全角の空白を落とさない）', () => {
  const p = parseTemplate('# 題\n| **開始日** | 　　　年　　　月　　　日 |\n| **予約** | 　　　年　　　月　　　日　　時間　　　時　　　分 |\n| 全角だけ | 　 |')
  const blanks = p.blocks[1].rows.flat(2).filter((x) => x.t === 'blank')
  assert.deepEqual(blanks.map((x) => x.kind), ['date', 'date', 'time', 'text'])
  // 医療連携の書類：開始日・初回再評価・1か月・3か月・受診予定日・結果確認予約日が日付の欄
  const med = parseTemplate(CONTRACT_TEMPLATES.find((t) => t.id === 'medical-cooperation').body)
  const { blanks: info } = autofill.describeTemplate(med)
  const dates = info.filter((b) => b.kind === 'date').map((b) => b.label)
  assert.deepEqual(dates, ['開始日', '初回再評価予定日', '1か月評価予定日', '3か月評価予定日', '受診予定日', '結果確認予約日'])
})

const tplOf = (id) => {
  const t = CONTRACT_TEMPLATES.find((x) => x.id === id)
  return { t, p: parseTemplate(t.body) }
}
const byLabel = (p, auto, pred) => {
  const { blanks } = autofill.describeTemplate(p)
  const b = blanks.find(pred)
  assert.ok(b, '欄が見つからない')
  return auto[b.i]
}
const pt = { mainComplaint: '走ると右膝が痛い', diagnosisLabel: '膝蓋腱炎', occupation: '下関市立彦島中学校' }

test('自動入力：入会書（学校名・利用開始日・目的・兄弟・親子プランのもう1名）', () => {
  const { p } = tplOf('member-contract')
  const m = { plan: '学生会員', start: '2026-11-20' }
  let auto = autofill.autofillContract(p, { docId: 'member-contract', today: '2026-11-11', patient: pt, member: m })
  assert.equal(byLabel(p, auto, (b) => b.label === '学校名').value, '下関市立彦島中学校')
  assert.deepEqual(byLabel(p, auto, (b) => b.label === '利用開始日'), { value: '2026年11月20日', source: 'member', locked: true })
  assert.equal(byLabel(p, auto, (b) => b.label.startsWith('主な目的') && !/もう1名/.test(b.section)).value, '膝蓋腱炎（走ると右膝が痛い）')
  // 一般会員なら学校名は入れない・もう1名の欄も空のまま
  auto = autofill.autofillContract(p, { docId: 'member-contract', today: '2026-11-11', patient: pt, member: { plan: '一般会員', start: '2026-11-20' } })
  assert.equal(byLabel(p, auto, (b) => b.label === '学校名'), null)
  assert.equal(byLabel(p, auto, (b) => b.row === '氏名'), null)
  // 職業が学校でなければ入れない
  auto = autofill.autofillContract(p, { docId: 'member-contract', today: '2026-11-11', patient: { ...pt, occupation: '会社員' }, member: m })
  assert.equal(byLabel(p, auto, (b) => b.label === '学校名'), null)
  // 兄弟・親子プラン：もう1名の欄は下の欄から（読むだけ）、目的はその方のカルテから
  auto = autofill.autofillContract(p, {
    docId: 'member-contract',
    today: '2026-11-11',
    patient: pt,
    member: { plan: '兄弟・親子プラン', start: '2026-11-20', partnerName: '山田 次郎', partnerRelation: '弟', partnerBirthDate: '2014-05-03' },
    partnerPatient: { mainComplaint: '投げると肘が痛い', diagnosisLabel: '' },
  })
  assert.deepEqual(byLabel(p, auto, (b) => b.row === '氏名'), { value: '山田 次郎', source: 'member', locked: true })
  assert.equal(byLabel(p, auto, (b) => b.row === '生年月日').value, '2014年5月3日')
  assert.equal(byLabel(p, auto, (b) => b.row.startsWith('続柄')).value, '弟')
  assert.deepEqual(byLabel(p, auto, (b) => b.row.startsWith('主な目的') && /もう1名/.test(b.section)), { value: '投げると肘が痛い', source: 'karte' })
  // 「その他（　）」は自動にしない
  assert.equal(byLabel(p, auto, (b) => b.label === 'その他'), null)
})

test('自動入力：休会届・解約届（利用開始日・提出日・休会の月・契約終了日・最後の決済月）', () => {
  const status = { state: 'active', start: '2026-08-05', pausedMonths: 0 }
  let { p } = tplOf('member-pause')
  let auto = autofill.autofillContract(p, { docId: 'member-pause', today: '2026-11-11', patient: pt, member: { pauseFrom: '2026-12', pauseMonths: 2 }, status })
  assert.equal(byLabel(p, auto, (b) => b.label === '利用開始日').value, '2026年8月5日')
  assert.deepEqual(byLabel(p, auto, (b) => b.label === '休会届の提出日'), { value: '2026年11月11日', source: 'today' })
  assert.equal(byLabel(p, auto, (b) => b.label === '休会の開始月').value, '2026年12月')
  assert.equal(byLabel(p, auto, (b) => b.label === '再開予定月').value, '2027年2月')
  assert.equal(byLabel(p, auto, (b) => b.row === '休会の月数').value, '')
  auto = autofill.autofillContract(p, { docId: 'member-pause', today: '2026-11-11', patient: pt, member: { pauseFrom: '2026-12', pauseMonths: 5 }, status })
  assert.equal(byLabel(p, auto, (b) => b.row === '休会の月数').value, '5か月')
  ;({ p } = tplOf('member-cancel'))
  auto = autofill.autofillContract(p, { docId: 'member-cancel', today: '2026-11-16', patient: pt, member: {}, status })
  assert.equal(byLabel(p, auto, (b) => b.label === '解約届の提出日').value, '2026年11月16日')
  assert.equal(byLabel(p, auto, (b) => b.label === '契約終了日').value, '2026年12月31日')
  assert.equal(byLabel(p, auto, (b) => b.label === '最後の決済月').value, '2026年12月')
  // 契約が無い（アプリより前に入会した方など）なら、利用開始日は空欄のまま
  auto = autofill.autofillContract(p, { docId: 'member-cancel', today: '2026-11-16', patient: pt, member: {}, status: { state: 'none', pausedMonths: 0 } })
  assert.equal(byLabel(p, auto, (b) => b.label === '利用開始日'), null)
})

test('自動入力：通院頻度の変更・医療連携（部位・変更日・開始日から1か月後と3か月後）', () => {
  let { p } = tplOf('visit-frequency')
  let auto = autofill.autofillContract(p, { docId: 'visit-frequency', today: '2026-11-11', patient: pt })
  assert.equal(byLabel(p, auto, (b) => b.label.startsWith('部位')).value, '膝蓋腱炎（走ると右膝が痛い）')
  assert.equal(byLabel(p, auto, (b) => b.label === '変更日').value, '2026/11/11')
  assert.equal(byLabel(p, auto, (b) => b.label === '次回の再評価予定日'), null)
  ;({ p } = tplOf('medical-cooperation'))
  auto = autofill.autofillContract(p, { docId: 'medical-cooperation', today: '2026-11-30', patient: pt })
  assert.equal(byLabel(p, auto, (b) => b.label === '開始日').value, '2026-11-30')
  assert.equal(byLabel(p, auto, (b) => b.label === '1か月評価予定日').value, '2026-12-30')
  assert.equal(byLabel(p, auto, (b) => b.label === '3か月評価予定日').value, '2027-02-28')
  assert.equal(byLabel(p, auto, (b) => b.label === '初回再評価予定日'), null)
  assert.equal(byLabel(p, auto, (b) => b.label === '医療機関名'), null)
  // 開始日を手で直すと、1か月後・3か月後もそれに合わせる
  const { blanks } = autofill.describeTemplate(p)
  const inputs = Array(p.blankCount).fill(null)
  inputs[blanks.find((b) => b.label === '開始日').i] = '2026-12-01'
  auto = autofill.autofillContract(p, { docId: 'medical-cooperation', today: '2026-11-30', patient: pt, inputs })
  assert.equal(byLabel(p, auto, (b) => b.label === '1か月評価予定日').value, '2027-01-01')
  // 画面の値：手で入れたものが先、会員の手続きの欄から入るものは手で入れても変わらない
  assert.deepEqual(
    autofill.effectiveInputs(['手', null, null, 'x'], [{ value: '自動', source: 'karte' }, { value: '自動2', source: 'today' }, null, { value: '会員', source: 'member', locked: true }]),
    ['手', '自動2', '', '会員'],
  )
})

test('自動入力：署名・お名前の欄・□ のチェックは入れない（料金案内は記入欄なし）', () => {
  for (const t of CONTRACT_TEMPLATES) {
    const p = parseTemplate(t.body)
    const auto = autofill.autofillContract(p, {
      docId: t.id,
      today: '2026-11-11',
      patient: pt,
      member: { plan: '兄弟・親子プラン', start: '2026-11-20', partnerName: '山田 次郎', partnerRelation: '弟', pauseFrom: '2026-12', pauseMonths: 1 },
      status: { state: 'active', start: '2026-08-05', pausedMonths: 0 },
    })
    assert.equal(auto.length, p.blankCount, t.id)
    const { blanks } = autofill.describeTemplate(p)
    for (const b of blanks) {
      // お名前を入れてよいのは、兄弟・親子プランのもう1名（下の欄で入れたもの）だけ
      if (/氏名|名前/.test(b.label + b.row) && auto[b.i]) assert.ok(auto[b.i].locked && /もう1名/.test(b.section), `${t.id} ${b.label}`)
    }
  }
  assert.equal(parseTemplate(CONTRACT_TEMPLATES.find((t) => t.id === 'fee-cancel-policy').body).blankCount, 0)
})

test('入会書の「□ 申し込む」で会員の種別、休会届の「□ ○か月」で月数が分かる', () => {
  let { p } = tplOf('member-contract')
  const { checks } = autofill.describeTemplate(p)
  const plans = checks.map((c) => autofill.planOfCheck(c)).filter(Boolean)
  assert.deepEqual(plans, ['一般会員', '学生会員', '兄弟・親子プラン'])
  ;({ p } = tplOf('member-pause'))
  const months = autofill.describeTemplate(p).checks.map((c) => autofill.pauseMonthsOfCheck(c)).filter(Boolean)
  assert.deepEqual(months, [1, 2, 3])
  assert.equal(autofill.addMonthsYmd('2026-01-31', 1), '2026-02-28')
  assert.equal(autofill.schoolOf({ occupation: '会社員' }), '')
})

// ── 書類の頭の「ご契約内容」の枠（2026-11-13 院長の依頼：プリントで契約内容が分かるように・患者様控えにも直筆の署名） ──
const summary = await import(new URL('src/lib/contracts/summary.ts', root).href)
const { signatureBlockHtml } = await import(new URL('src/lib/contracts/print.ts', root).href)
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='

/** 入会の書類に署名したときと同じ材料を作る（数字・名前は架空） */
function signedJoin({ plan = '一般会員', partner, guardian, freq = ['週2回'], purpose = '右膝（ACL術後）', school = '' } = {}) {
  const { t, p } = tplOf('member-contract')
  const described = autofill.describeTemplate(p)
  const checks = Array(p.checkCount).fill(false)
  const values = Array(p.blankCount).fill('')
  for (const c of described.checks) {
    if (autofill.planOfCheck(c) === plan) checks[c.i] = true
    if (c.section.includes('通院頻度') && freq.some((f) => c.after.startsWith(f))) checks[c.i] = true
  }
  for (const b of described.blanks) {
    if (b.label === '主な目的・部位' && !b.row) values[b.i] = purpose
    if (b.label === '学校名') values[b.i] = school
    if (b.label === 'その他' && b.section.includes('通院頻度')) values[b.i] = '月2回'
  }
  const record = {
    id: 'ctest1', patientId: 'p1', docId: t.id, title: t.title, version: t.version, bodyHash: 'h', signedAt: '2026-11-20T01:00:00Z', signedDate: '2026-11-20',
    patientName: '試験 太郎', guardianName: guardian?.name, relation: guardian?.relation, staffLabel: t.staffLabel, staffName: '担当 花子', checked: 1, written: 1,
    member: { kind: 'join', plan, start: '2026-11-20', partner },
  }
  const signatures = [
    { label: '患者様', name: record.patientName, image: PNG },
    ...(guardian ? [{ label: `保護者（${guardian.relation}）`, name: guardian.name, image: PNG }] : []),
    { label: t.staffLabel, name: record.staffName, image: PNG },
  ]
  const before = { state: 'none', label: '', pausedMonths: 0 }
  const box = summary.contractSummaryHtml({ record, before, parsed: p, described, checks, values, signatures })
  const doc = renderTemplateHtml(p, checks, values)
  const html =
    summary.insertSummary(doc, box) +
    signatureBlockHtml({ date: record.signedDate, patientName: record.patientName, guardianName: record.guardianName, relation: record.relation, staffLabel: t.staffLabel, staffName: record.staffName, sigPatient: PNG, sigGuardian: guardian ? PNG : null, sigStaff: PNG })
  return { t, p, described, checks, values, record, box, doc, html }
}
const rowOf = (box, head) => (new RegExp(`<tr><th>${head.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}</th><td>([^<]*)</td></tr>`).exec(box) ?? [])[1]

test('ご契約内容の枠：だれが・どのプランを・いくらで・いつから、が1つの枠で分かる', () => {
  const { box, t } = signedJoin()
  assert.match(box, /^<div class="contract-summary"><h3>ご契約内容<\/h3>/)
  assert.equal(rowOf(box, 'ご契約者'), '試験 太郎 様')
  assert.equal(rowOf(box, 'プラン'), '一般会員')
  assert.equal(rowOf(box, '月額料金'), '23,000円（税込）')
  // 1部位施術料は、文面の表の行と同じ見出し・同じ金額（別の数字を持たない）
  const fee = summary.visitFeeOf(parseTemplate(t.body))
  assert.ok(fee && fee.label.startsWith('来院ごとの1部位施術料') && /^[\d,]+円$/.test(fee.amount), JSON.stringify(fee))
  assert.equal(rowOf(box, fee.label), fee.amount)
  assert.ok(t.body.includes(`| ${fee.label} | ${fee.amount} |`))
  assert.equal(rowOf(box, '利用開始日（最初の決済日）'), '2026年11月20日')
  assert.equal(rowOf(box, '最低利用期間'), '利用開始日から3か月（2027年2月19日まで）')
  assert.equal(rowOf(box, '満了後'), '解約のお申し出がない場合は、1か月ごとに自動更新')
  assert.equal(rowOf(box, 'お支払い'), 'クレジットカード決済（毎月の決済日に月額料金）')
  assert.equal(rowOf(box, '通院頻度の目安（開始時）'), '週2回')
  assert.equal(rowOf(box, '主な目的・部位'), '右膝（ACL術後）')
  assert.equal(rowOf(box, '解約するとき'), '解約届を15日までに提出すると当月末、16日以降は翌月末で終了')
  assert.equal(rowOf(box, 'ご署名日'), '2026年11月20日')
  // 枠の言い方は、文面の条件と同じ（最低3か月・カード決済・15日）
  assert.ok(t.body.includes('最低利用期間は、利用開始日から3か月間です') && t.body.includes('お支払いはクレジットカード決済のみです') && t.body.includes('解約希望月の15日までに提出：当月末で契約終了'))
})

test('ご契約内容の枠：直筆の署名（患者様・保護者・担当者）が並ぶ。おかしな画像は入れない', () => {
  const { box } = signedJoin({ guardian: { name: '試験 花子', relation: '母' } })
  assert.equal(rowOf(box, 'ご契約者'), '試験 太郎 様（保護者：試験 花子・母）')
  const sigs = [...box.matchAll(/<div class="sum-sig"><span>([^<]*)<\/span>(<img src="data:image\/png;base64,[A-Za-z0-9+\/=]+" alt="[^"]*">)?<\/div>/g)]
  assert.deepEqual(sigs.map((m) => m[1]), ['患者様：試験 太郎', '保護者（母）：試験 花子', '説明担当者：担当 花子'])
  assert.ok(sigs.every((m) => m[2]), '3人とも署名の画像がある')
  const bad = summary.summaryBoxHtml('ご契約内容', [['a', 'b']], [{ label: '患者様', name: '<b>x</b>', image: 'javascript:alert(1)' }, { label: '担当', name: 'y', image: 'data:image/svg+xml;base64,AAAA' }])
  assert.ok(!bad.includes('<img') && !bad.includes('javascript:') && bad.includes('&lt;b&gt;x&lt;/b&gt;'))
  assert.equal(summary.summaryBoxHtml('ご契約内容', [], []), '')
})

test('ご契約内容の枠：学生会員は学校名、兄弟・親子プランはもう1名と「来院した方ごと」、その他の頻度は書いた内容', () => {
  const st = signedJoin({ plan: '学生会員', school: '試験中学校', freq: ['その他'] })
  assert.equal(rowOf(st.box, 'プラン'), '学生会員（学校名：試験中学校）')
  assert.equal(rowOf(st.box, '月額料金'), '19,000円（税込）')
  assert.equal(rowOf(st.box, '通院頻度の目安（開始時）'), 'その他（月2回）')
  const pair = signedJoin({ plan: '兄弟・親子プラン', partner: { name: '試験 次郎', relation: '弟', birthDate: '2012-04-01' }, freq: [] })
  assert.equal(rowOf(pair.box, '月額料金'), '30,000円・2名まで（税込）')
  assert.equal(rowOf(pair.box, 'もう1名の利用者'), '試験 次郎 様（弟・2012年4月1日生）')
  const fee = summary.visitFeeOf(pair.p)
  assert.equal(rowOf(pair.box, fee.label), `${fee.amount}（来院した方ごと・施術した部位ごと）`)
  assert.equal(rowOf(pair.box, '通院頻度の目安（開始時）'), undefined, 'チェックが無ければ行を出さない')
})

test('ご契約内容の枠：書類の題名のすぐ下（最初の見出しの前）に入る。本文と署名欄はそのまま残る', () => {
  const { html, doc, box } = signedJoin()
  const at = html.indexOf('<div class="contract-summary">')
  assert.ok(at > html.indexOf('<h2 class="doc-title">') && at > html.indexOf('doc-note') && at < html.indexOf('<h3>1. 会員プランの目的</h3>'))
  assert.equal(html.replace(`${box}\n`, '').startsWith(doc), true, '枠を外すと、もとの本文と同じ')
  assert.ok(html.includes('<h3>署名欄</h3><table class="sigtable">'))
  assert.ok(!html.includes('member-box'), '下の「院の記録」の枠は、上の枠にまとめた')
  assert.equal(summary.hasContractSummary(html), true)
  assert.equal(summary.insertSummary('<p>x</p>', '<div>b</div>'), '<div>b</div><p>x</p>')
  assert.equal(summary.insertSummary(doc, ''), doc)
})

test('休会届・解約届にも、同じ形の枠（休会の内容・解約の内容）', () => {
  const before = { state: 'active', label: '会員', plan: '一般会員', start: '2026-08-01', minEnd: '2026-10-31', pausedMonths: 0 }
  const base = { id: 'c2', patientId: 'p1', title: '', version: '', bodyHash: 'h', signedAt: '', signedDate: '2026-11-16', patientName: '試験 太郎', staffLabel: '受付担当者', staffName: '担当 花子', checked: 0, written: 0 }
  const mk = (docId, m) => {
    const { p } = tplOf(docId)
    const described = autofill.describeTemplate(p)
    return summary.contractSummaryHtml({ record: { ...base, docId, member: m }, before, parsed: p, described, checks: Array(p.checkCount).fill(false), values: Array(p.blankCount).fill(''), signatures: [{ label: '患者様', name: '試験 太郎', image: PNG }] })
  }
  const pause = mk('member-pause', { kind: 'pause', pauseFrom: '2026-12', pauseMonths: 2 })
  assert.match(pause, /<h3>休会の内容<\/h3>/)
  assert.equal(rowOf(pause, '休会の期間'), '2026年12月から2か月（請求を止める月：2026年12月〜）')
  assert.equal(rowOf(pause, '再開予定月'), '2027年2月')
  const cancel = mk('member-cancel', { kind: 'cancel', submitted: '2026-11-16', end: '2026-12-31' })
  assert.match(cancel, /<h3>解約の内容<\/h3>/)
  assert.equal(rowOf(cancel, '契約終了日'), '2026年12月31日（16日以降の提出のため翌月末）')
  assert.equal(rowOf(cancel, 'ご契約者'), '試験 太郎 様')
  // 会員の書類でなければ、枠は作らない
  const { p } = tplOf('fee-cancel-policy')
  assert.equal(summary.contractSummaryHtml({ record: { ...base, docId: 'fee-cancel-policy' }, before, parsed: p, described: autofill.describeTemplate(p), checks: [], values: [], signatures: [] }), '')
})

test('前に署名した入会の書類（枠なし）：見るとき・印刷するときにだけ、同じ形の枠を足す。保存した本文は変えない', () => {
  const { t, p, checks, values, record } = signedJoin({ guardian: { name: '試験 花子', relation: '母' } })
  // 2026-11-13 より前の形：下に「院の記録」の枠、上の枠は無い
  const old =
    renderTemplateHtml(p, checks, values) +
    member.memberEventHtml(record.member, { state: 'none', label: '', pausedMonths: 0 }) +
    signatureBlockHtml({ date: record.signedDate, patientName: record.patientName, guardianName: record.guardianName, relation: record.relation, staffLabel: t.staffLabel, staffName: record.staffName, sigPatient: PNG, sigGuardian: PNG, sigStaff: PNG })
  const keep = old
  const shown = summary.withContractSummary(old, record)
  assert.equal(old, keep)
  assert.equal(summary.hasContractSummary(old), false)
  assert.equal(summary.hasContractSummary(shown), true)
  const box = shown.slice(shown.indexOf('<div class="contract-summary">'), shown.indexOf('<h3>1. 会員プランの目的</h3>'))
  assert.equal(rowOf(box, 'プラン'), '一般会員')
  assert.equal(rowOf(box, '利用開始日（最初の決済日）'), '2026年11月20日')
  const fee = summary.visitFeeOf(p)
  assert.equal(rowOf(box, fee.label), fee.amount, '施術料は、保存した本文に書いてある金額')
  assert.deepEqual(summary.signaturesFromHtml(old).map((s) => `${s.label}：${s.name}：${s.image ? '署名あり' : 'なし'}`), ['患者様：試験 太郎：署名あり', '保護者（母）：試験 花子：署名あり', '説明担当者：担当 花子：署名あり'])
  assert.equal((box.match(/<img /g) ?? []).length, 3)
  // 枠を外すと、保存した本文と同じ。もう一度かけても増えない
  assert.equal(shown.replace(/<div class="contract-summary">[\s\S]*?<\/p><\/div>\n/, ''), old)
  assert.equal(summary.withContractSummary(shown, record), shown)
  // 会員の書類でないもの・休会届は、そのまま
  assert.equal(summary.withContractSummary('<p>x</p>', { ...record, member: undefined }), '<p>x</p>')
  assert.equal(summary.withContractSummary('<p>x</p>', { ...record, member: { kind: 'pause', pauseFrom: '2026-12', pauseMonths: 1 } }), '<p>x</p>')
})

test('一覧の1行と、画面に出す前の確認', () => {
  const { record, html } = signedJoin({ plan: '兄弟・親子プラン', partner: { name: '試験 次郎', relation: '弟' } })
  assert.equal(summary.memberLineOf(record), '兄弟・親子プラン（月額30,000円・2名まで）・もう1名：試験 次郎さん・利用開始 2026年11月20日・最低利用期間 2027年2月19日まで')
  assert.equal(summary.memberLineOf({ ...record, member: { kind: 'pause', pauseFrom: '2026-12', pauseMonths: 2 } }), '休会：2026年12月から2か月')
  assert.equal(summary.memberLineOf({ ...record, member: { kind: 'cancel', submitted: '2026-11-16', end: '2026-12-31' } }), '解約：契約終了日 2026年12月31日')
  assert.equal(summary.memberLineOf({ ...record, member: undefined }), '')
  assert.equal(summary.isSafeContractHtml(html), true)
  for (const bad of ['<script>alert(1)</script>', '<img src="x" onerror="a()">', '<a href="javascript:a()">x</a>', '<iframe src="x"></iframe>']) assert.equal(summary.isSafeContractHtml(bad), false, bad)
})

console.log(`\n${passed} 件 OK`)
