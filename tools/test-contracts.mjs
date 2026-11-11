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
  assert.match(html, /来院した方ごと/)
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
  for (const id of ['member-contract', 'member-pause', 'member-cancel', 'fee-cancel-policy']) assert.equal(get(id).version, '2026-11-11.2')
  // もう1名の欄（氏名・生年月日・続柄・目的）は4つの記入欄、確認のチェックは5つ
  const body = get('member-contract').body
  const start = body.indexOf('### 兄弟・親子プランを申し込む場合')
  const end = body.indexOf('## 3. 会員プランに含まれる内容')
  const full = parseTemplate(body)
  const without = parseTemplate(body.slice(0, start) + body.slice(end))
  assert.equal(full.blankCount - without.blankCount, 4)
  assert.equal(full.checkCount - without.checkCount, 5)
})

console.log(`\n${passed} 件 OK`)
