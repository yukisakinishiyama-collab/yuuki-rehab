// 紙の入会申込書で入会した方の解約届（2026-11-20 院長の依頼）
// 「会員解約は今回作成したもの以前に紙で契約しているかたもいますので、その方も解約届を記入できるように」
// 実行: npx tsx tools/test-paper-cancel.mjs
import assert from 'node:assert/strict'

const member = await import('../src/lib/contracts/member.ts')
const summary = await import('../src/lib/contracts/summary.ts')
const autofill = await import('../src/lib/contracts/autofill.ts')
const handoff = await import('../src/lib/contracts/handoff.ts')
const { getContractTemplate } = await import('../src/data/contract-templates.ts')
const { parseTemplate } = await import('../src/lib/contracts/template.ts')

let passed = 0
function test(name, fn) {
  fn()
  passed += 1
  console.log(`  ✓ ${name}`)
}

const TODAY = '2026-11-20'
const rec = (patientId, ev, signedAt, extra = {}) => ({
  id: `c-${signedAt}`,
  patientId,
  docId: 'member-cancel',
  title: '会員プラン 解約届',
  version: 'x',
  bodyHash: 'abcdef12',
  signedAt,
  signedDate: signedAt.slice(0, 10),
  patientName: '架空 太郎',
  staffLabel: '受付担当者',
  staffName: '架空',
  checked: 0,
  written: 0,
  member: ev,
  ...extra,
})

test('アプリに入会の記録が無い方：紙の申込書にチェックしないと、解約届は書けない（理由に案内が出る）', () => {
  const r = member.buildMemberEvent('cancel', {}, [], TODAY)
  assert.equal(r.ok, false)
  assert.match(r.error, /紙の入会申込書/)
})

test('紙の申込書：プランと利用開始日を入れると解約届が書ける（最低利用期間は紙の利用開始日から）', () => {
  const r = member.buildMemberEvent('cancel', { paper: true, plan: '一般会員', paperStart: '2026-05-10' }, [], TODAY)
  assert.equal(r.ok, true, r.error)
  assert.deepEqual(r.event.paper, { plan: '一般会員', start: '2026-05-10', partner: undefined })
  assert.equal(r.event.submitted, TODAY)
  assert.equal(r.event.end, '2026-12-31', '16日以降の提出なので翌月末')
  assert.equal(r.event.special, undefined, '5/10 開始なら最低利用期間は満了')
})

test('紙の申込書：足りないもの・おかしな日付は理由を返す', () => {
  assert.match(member.buildMemberEvent('cancel', { paper: true, plan: '', paperStart: '2026-05-10' }, [], TODAY).error, /種別/)
  assert.match(member.buildMemberEvent('cancel', { paper: true, plan: '学生会員', paperStart: '' }, [], TODAY).error, /利用開始日/)
  assert.match(member.buildMemberEvent('cancel', { paper: true, plan: '学生会員', paperStart: '2026-12-01' }, [], TODAY).error, /今日より後/)
  assert.match(member.buildMemberEvent('cancel', { paper: true, plan: '兄弟・親子プラン', paperStart: '2026-05-10' }, [], TODAY).error, /もう1名/)
})

test('紙の申込書：最低利用期間の途中なら、特別な事情が要る（今までの解約と同じ決まり）', () => {
  const input = { paper: true, plan: '一般会員', paperStart: '2026-10-15' }
  const r = member.buildMemberEvent('cancel', input, [], TODAY)
  assert.equal(r.ok, false)
  assert.match(r.error, /最低利用期間（2027年1月14日まで）/)
  const ok = member.buildMemberEvent('cancel', { ...input, special: true, specialReason: '転居' }, [], TODAY)
  assert.equal(ok.ok, true)
  assert.equal(ok.event.special, true)
  assert.equal(ok.event.specialReason, '転居')
})

test('紙の申込書の解約届に署名すると、状態は「解約予定」→ 契約終了日の翌日から「退会」', () => {
  const r = member.buildMemberEvent('cancel', { paper: true, plan: '学生会員', paperStart: '2026-04-01' }, [], TODAY)
  const list = [rec('p1', r.event, '2026-11-20T03:00:00.000Z')]
  const st = member.memberStatusOf(list, TODAY)
  assert.equal(st.state, 'ending')
  assert.equal(st.plan, '学生会員')
  assert.equal(st.start, '2026-04-01')
  assert.equal(st.end, '2026-12-31')
  assert.equal(member.memberStatusOf(list, '2027-01-01').state, 'ended')
  // もう一度の解約届は「すでに受け付けています」
  const again = member.buildMemberEvent('cancel', {}, list, TODAY)
  assert.equal(again.ok, false)
  assert.match(again.error, /すでに解約届/)
  // 取り消した届は数えない（また紙の申込書から書ける）
  const voided = [{ ...list[0], voided: { at: 'x', reason: 'まちがい' } }]
  assert.equal(member.memberStatusOf(voided, TODAY).state, 'none')
})

test('アプリで入会した方は、今までどおり（紙のチェックは使わない）', () => {
  const join = rec('p2', { kind: 'join', plan: '一般会員', start: '2026-06-01' }, '2026-06-01T01:00:00.000Z', { docId: 'member-contract' })
  const r = member.buildMemberEvent('cancel', { paper: true, plan: '学生会員', paperStart: '2026-01-01' }, [join], TODAY)
  assert.equal(r.ok, true)
  assert.equal(r.event.paper, undefined, 'アプリの記録があるときは紙の内容を入れない')
  assert.equal(member.canUsePaperCancel(member.memberStatusOf([join], TODAY)), false)
  assert.equal(member.canUsePaperCancel(member.memberStatusOf([], TODAY)), true)
})

test('兄弟・親子プランの紙の契約：もう1名の方のカルテにも状態が出る', () => {
  const r = member.buildMemberEvent(
    'cancel',
    { paper: true, plan: '兄弟・親子プラン', paperStart: '2026-03-01', partnerName: '架空 花子', partnerRelation: '妹', partnerPatientId: 'p4' },
    [],
    TODAY,
  )
  assert.equal(r.ok, true, r.error)
  assert.equal(r.event.paper.partner.patientId, 'p4')
  const all = [rec('p3', r.event, '2026-11-20T03:00:00.000Z')]
  const st = member.memberStatusForPatient('p4', all, TODAY)
  assert.equal(st.state, 'ending')
  assert.equal(st.via.patientId, 'p3')
  // もう1名の方のカルテでは、紙の申込書の解約届は使えない（代表の方のカルテで）
  assert.equal(member.canUsePaperCancel(st), false)
})

test('「ご契約内容」の枠と一覧の1行に、紙の申込書のプラン・利用開始日が出る', () => {
  const input = { paper: true, plan: '一般会員', paperStart: '2026-05-10' }
  const r = member.buildMemberEvent('cancel', input, [], TODAY)
  const before = member.statusBeforeOf('cancel', input, member.memberStatusOf([], TODAY), TODAY)
  assert.equal(before.minEnd, '2026-08-09')
  const rows = member.memberEventRows(r.event, before)
  assert.deepEqual(rows.find((x) => x[0] === '会員の種別'), ['会員の種別', '一般会員（月額23,000円）'])
  assert.deepEqual(rows.find((x) => x[0] === 'ご入会'), ['ご入会', '紙の入会申込書（利用開始日 2026年5月10日）'])
  assert.ok(rows.some((x) => x[0] === '最低利用期間' && /満了/.test(x[1])))
  const line = summary.memberLineOf(rec('p5', r.event, '2026-11-20T03:00:00.000Z'))
  assert.match(line, /紙の入会申込書：一般会員・利用開始 2026年5月10日/)
  assert.match(line, /契約終了日 2026年12月31日/)
})

test('解約届の記入欄：利用開始日に紙の申込書の日付が入る', () => {
  const tpl = getContractTemplate('member-cancel')
  const parsed = parseTemplate(tpl.body)
  const input = { paper: true, plan: '一般会員', paperStart: '2026-05-10' }
  const before = member.statusBeforeOf('cancel', input, member.memberStatusOf([], TODAY), TODAY)
  const auto = autofill.autofillContract(parsed, { docId: 'member-cancel', today: TODAY, patient: { name: '架空' }, member: input, status: before })
  const { blanks } = autofill.describeTemplate(parsed)
  const startBlank = blanks.find((b) => b.label === '利用開始日')
  assert.equal(auto[startBlank.i].value, '2026年5月10日')
})

test('解約届の文面の「会員種別」の □ がどの種別かわかる', () => {
  const tpl = getContractTemplate('member-cancel')
  const { checks } = autofill.describeTemplate(parseTemplate(tpl.body))
  const plans = checks.map((c) => autofill.cancelPlanOfCheck(c)).filter(Boolean)
  assert.deepEqual(plans, ['一般会員', '学生会員', '兄弟・親子プラン'])
})

test('iPad への受け渡しでも、紙の申込書の欄がそのまま渡る', () => {
  const d = handoff.sanitizeHandoffDraft({
    docId: 'member-cancel',
    version: '2026-11-11.2',
    bodyHash: 'abcdef12',
    checks: [false],
    inputs: [null],
    member: { paper: true, paperStart: '2026-05-10', plan: '一般会員' },
    patientName: '架空',
  })
  assert.ok(d)
  assert.equal(d.member.paper, true)
  assert.equal(d.member.paperStart, '2026-05-10')
  const bad = handoff.sanitizeHandoffDraft({ docId: 'member-cancel', version: 'x', bodyHash: 'abcdef12', checks: [], inputs: [], member: { paper: 'yes', paperStart: '2026/5/10' } })
  assert.equal(bad.member.paper, false)
  assert.equal(bad.member.paperStart, '')
})

console.log(`\n${passed} 件 OK`)
