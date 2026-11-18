// 再評価の予定日とマーク・前回との比べの確認（データはすべて架空）
// 実行: npx tsx tools/test-reeval.mjs
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
const S = await import(new URL('src/lib/reeval/schedule.ts', root).href)
const C = await import(new URL('src/lib/reeval/compare.ts', root).href)

let passed = 0
function test(name, fn) {
  fn()
  passed += 1
  console.log(`  ✓ ${name}`)
}

const PID = 'p-test'
const NOW = '2026-11-18T01:00:00.000Z'
let seq = 0
const base = (today, extra = {}) => ({ today, now: NOW, eventId: `e${++seq}`, ...extra })
const plan = (due, extra = {}) => ({
  id: PID, patientId: PID, interval: 14, dueDate: due, lastDate: null, active: true, events: [], updatedAt: NOW, ...extra,
})

test('日本時間で今日を決める（UTC 15:00 で日付が変わる）', () => {
  assert.equal(S.jstToday(new Date('2026-11-17T14:59:59Z')), '2026-11-17')
  assert.equal(S.jstToday(new Date('2026-11-17T15:00:00Z')), '2026-11-18')
  assert.equal(S.daysBetween('2026-11-28', '2026-12-02'), 4)
  assert.equal(S.addDaysYmd('2026-12-25', 14), '2027-01-08')
  assert.equal(S.isYmd('2026-02-30'), false)
})

test('予定日の4日以上前は通常表示・3日前〜前日は「評価まもなく」・当日は「要再評価」・過ぎたら「評価期限超過」', () => {
  const today = '2026-11-18'
  const st = (due) => S.reevalStatus(plan(due), today)
  assert.equal(st('2026-11-22').state, 'scheduled') // 4日前
  assert.equal(S.reevalMarkLabel('scheduled'), null)
  for (const due of ['2026-11-21', '2026-11-20', '2026-11-19']) assert.equal(st(due).state, 'soon', due)
  assert.equal(S.reevalMarkLabel('soon'), '評価まもなく')
  assert.equal(st('2026-11-18').state, 'due')
  assert.equal(S.reevalMarkLabel('due'), '要再評価')
  assert.equal(st('2026-11-17').state, 'overdue')
  assert.equal(S.reevalMarkLabel('overdue'), '評価期限超過')
  assert.equal(st('2026-11-15').daysLeft, -3)
  assert.equal(S.daysLeftText(-3), '3日過ぎ')
})

test('予定が未設定・やめた・カルテが終了の方にはマークを出さない', () => {
  assert.equal(S.reevalStatus(null, '2026-11-18').state, 'none')
  assert.equal(S.reevalStatus(plan(null), '2026-11-18').state, 'none')
  assert.equal(S.reevalStatus(plan('2026-11-10', { active: false }), '2026-11-18').state, 'none')
  assert.equal(S.reevalStatus(plan('2026-11-10'), '2026-11-18', { ended: true }).state, 'none')
  // 壊れた日付も出さない
  assert.equal(S.reevalStatus(plan('2026/11/10'), '2026-11-18').state, 'none')
})

test('予定を決める：7・14・28日後、過ぎた日は入れない', () => {
  assert.equal(S.dueFromInterval('2026-11-18', 7), '2026-11-25')
  assert.equal(S.dueFromInterval('2026-11-18', 14), '2026-12-02')
  assert.equal(S.dueFromInterval('2026-11-18', 28), '2026-12-16')
  assert.equal(S.dueFromInterval('2026-11-18', 'custom'), null)
  const r = S.setReevalDue(null, base('2026-11-18', { patientId: PID, due: '2026-12-02', interval: 14 }))
  assert.ok(r.ok)
  assert.equal(r.plan.id, PID)
  assert.equal(r.plan.dueDate, '2026-12-02')
  assert.equal(r.plan.lastDate, null)
  assert.equal(r.plan.events.at(-1).kind, 'set')
  assert.equal(S.reevalStatus(r.plan, '2026-11-18').state, 'scheduled')
  const past = S.setReevalDue(null, base('2026-11-18', { patientId: PID, due: '2026-11-17' }))
  assert.equal(past.ok, false)
})

test('延期は理由が要り、変えた日・前の予定日・新しい予定日・理由を残す', () => {
  const p = plan('2026-11-18')
  const noReason = S.setReevalDue(p, base('2026-11-18', { patientId: PID, due: '2026-11-25' }))
  assert.equal(noReason.ok, false)
  const r = S.setReevalDue(p, base('2026-11-18', { patientId: PID, due: '2026-11-25', reason: '  発熱で来院できない  ' }))
  assert.ok(r.ok)
  const ev = r.plan.events.at(-1)
  assert.equal(ev.kind, 'postpone')
  assert.equal(ev.date, '2026-11-18')
  assert.equal(ev.prevDue, '2026-11-18')
  assert.equal(ev.nextDue, '2026-11-25')
  assert.equal(ev.reason, '発熱で来院できない')
  assert.equal(S.reevalStatus(r.plan, '2026-11-18').state, 'scheduled')
  // 前倒しは理由なしでよい（延期ではない）
  const early = S.setReevalDue(plan('2026-12-02'), base('2026-11-18', { patientId: PID, due: '2026-11-20' }))
  assert.ok(early.ok)
  assert.equal(early.plan.events.at(-1).kind, 'set')
})

test('正式な再評価を完了するとマークが外れ、次回の予定日が入る（前回の再評価日も残る）', () => {
  const p = plan('2026-11-17') // 期限超過
  assert.equal(S.reevalStatus(p, '2026-11-18').state, 'overdue')
  const r = S.completeReeval(p, base('2026-11-18', { patientId: PID, date: '2026-11-18', next: { interval: 14 }, summary: ['痛み NRS：6 → 3'] }))
  assert.ok(r.ok)
  assert.equal(r.plan.lastDate, '2026-11-18')
  assert.equal(r.plan.dueDate, '2026-12-02')
  assert.equal(S.reevalStatus(r.plan, '2026-11-18').state, 'scheduled')
  const ev = r.plan.events.at(-1)
  assert.equal(ev.kind, 'complete')
  assert.equal(ev.prevDue, '2026-11-17')
  assert.deepEqual(ev.summary, ['痛み NRS：6 → 3'])
  // 次回を決めない → マークなし
  const none = S.completeReeval(p, base('2026-11-18', { patientId: PID, date: '2026-11-18', next: null }))
  assert.ok(none.ok)
  assert.equal(S.reevalStatus(none.plan, '2026-11-18').state, 'none')
  // 日付をえらぶ
  const custom = S.completeReeval(p, base('2026-11-18', { patientId: PID, date: '2026-11-18', next: { interval: 'custom', due: '2026-12-10' } }))
  assert.equal(custom.plan.dueDate, '2026-12-10')
  assert.equal(S.completeReeval(p, base('2026-11-18', { patientId: PID, date: '2026-11-18', next: { interval: 'custom' } })).ok, false)
})

test('完了の日付のまちがいを止める（未来の日・次回が過ぎている）', () => {
  const p = plan('2026-11-18')
  assert.equal(S.completeReeval(p, base('2026-11-18', { patientId: PID, date: '2026-11-19', next: { interval: 14 } })).ok, false)
  // 3週間前の再評価をあとから入れて14日後＝すでに過ぎている
  assert.equal(S.completeReeval(p, base('2026-11-18', { patientId: PID, date: '2026-10-28', next: { interval: 14 } })).ok, false)
  // 前回より古い日の完了を入れても、前回の再評価日は新しいほうのまま
  const later = plan('2026-12-02', { lastDate: '2026-11-18' })
  const r = S.completeReeval(later, base('2026-11-18', { patientId: PID, date: '2026-11-10', next: { interval: 28 } }))
  assert.ok(r.ok)
  assert.equal(r.plan.lastDate, '2026-11-18')
})

test('SOAP の「再評価予定」は予定日に入るが、完了にはしない。過ぎた日・同じ日は入れない', () => {
  const p = plan('2026-11-20', { lastDate: '2026-11-06' })
  const next = S.reevalFromSoap(p, base('2026-11-18', { patientId: PID, nextReassessment: '2026-12-01', visitDate: '2026-11-18' }))
  assert.ok(next)
  assert.equal(next.dueDate, '2026-12-01')
  assert.equal(next.lastDate, '2026-11-06') // 完了ではない
  assert.equal(next.events.at(-1).source, 'soap')
  assert.equal(next.events.at(-1).kind, 'postpone')
  assert.match(next.events.at(-1).reason, /SOAP/)
  assert.equal(S.reevalFromSoap(p, base('2026-11-18', { patientId: PID, nextReassessment: '2026-11-10', visitDate: '2026-11-01' })), null)
  assert.equal(S.reevalFromSoap(p, base('2026-11-18', { patientId: PID, nextReassessment: '2026-11-20', visitDate: '2026-11-18' })), null)
  assert.equal(S.reevalFromSoap(p, base('2026-11-18', { patientId: PID, nextReassessment: '', visitDate: '2026-11-18' })), null)
  // 予定が無い方でも、SOAP に書いた日から予定が始まる
  const fresh = S.reevalFromSoap(null, base('2026-11-18', { patientId: PID, nextReassessment: '2026-11-21', visitDate: '2026-11-18' }))
  assert.equal(S.reevalStatus(fresh, '2026-11-18').state, 'soon')
})

test('前に書いた SOAP の再評価予定は「候補」に出すだけ（自動で期限超過にしない）', () => {
  const notes = [
    { visitDate: '2026-09-01', nextReassessment: '2026-09-15', createdAt: '2026-09-01T01:00:00Z' },
    { visitDate: '2026-09-08', nextReassessment: '', createdAt: '2026-09-08T01:00:00Z' },
  ]
  assert.deepEqual(S.soapReassessmentHint(notes), { date: '2026-09-15', visitDate: '2026-09-01' })
  assert.equal(S.soapReassessmentHint([]), null)
  // 予定（plan）が無ければ、候補があってもマークは出ない
  assert.equal(S.reevalStatus(null, '2026-11-18').state, 'none')
})

test('予定をやめると理由を残してマークを外す。決め直すとまた出る', () => {
  const p = plan('2026-11-17')
  assert.equal(S.stopReeval(p, base('2026-11-18', { reason: '' })).ok, false)
  const r = S.stopReeval(p, base('2026-11-18', { reason: '施術終了' }))
  assert.ok(r.ok)
  assert.equal(S.reevalStatus(r.plan, '2026-11-18').state, 'none')
  assert.equal(r.plan.events.at(-1).reason, '施術終了')
  const again = S.setReevalDue(r.plan, base('2026-11-18', { patientId: PID, due: '2026-11-19' }))
  assert.ok(again.ok)
  assert.equal(S.reevalStatus(again.plan, '2026-11-18').state, 'soon')
})

test('履歴は増えすぎない（古いものから落とす）', () => {
  let p = null
  for (let i = 0; i < 80; i++) {
    const r = S.setReevalDue(p, base('2026-11-18', { patientId: PID, due: S.addDaysYmd('2026-11-18', 80 - i) }))
    p = r.plan
  }
  assert.ok(p.events.length <= 60)
})

test('前回の再評価をはさんで、前回と今回を並べる（良い方向・悪い方向は項目の向きで）', () => {
  const series = C.seriesFromKarte({
    soapNotes: [
      { visitDate: '2026-11-01', painToday: 7, createdAt: '2026-11-01T01:00:00Z' },
      { visitDate: '2026-11-04', painToday: 6, createdAt: '2026-11-04T01:00:00Z' },
      { visitDate: '2026-11-15', painToday: 3, createdAt: '2026-11-15T01:00:00Z' },
      { visitDate: '2026-11-16', painToday: -1, createdAt: '2026-11-16T01:00:00Z' }, // 未入力は使わない
    ],
    outcomes: [
      { id: 'o1', patientId: PID, date: '2026-11-04', metric: 'rom_knee_flex', value: 110, createdAt: '2026-11-04T02:00:00Z' },
      { id: 'o2', patientId: PID, date: '2026-11-18', metric: 'rom_knee_flex', value: 125, createdAt: '2026-11-18T02:00:00Z' },
      { id: 'o3', patientId: PID, date: '2026-11-04', metric: 'lsi_quad', value: 70, involved: 14, uninvolved: 20, createdAt: '2026-11-04T02:00:00Z' },
    ],
    rom: [
      { id: 'r1', patientId: PID, measuredDate: '2026-11-04', bodyRegion: 'knee', joint: '膝', movement: '伸展', side: 'right', activeRom: -10, passiveRom: null, normalValue: 0, unit: 'deg', pain: false, painLocation: '', endFeel: '', limitationFactor: '', memo: '', createdAt: '2026-11-04T03:00:00Z' },
      { id: 'r2', patientId: PID, measuredDate: '2026-11-17', bodyRegion: 'knee', joint: '膝', movement: '伸展', side: 'right', activeRom: null, passiveRom: -5, normalValue: 0, unit: 'deg', pain: false, painLocation: '', endFeel: '', limitationFactor: '', memo: '', createdAt: '2026-11-17T03:00:00Z' },
    ],
    strength: [
      { id: 's1', patientId: PID, measuredDate: '2026-11-04', bodyRegion: 'knee', muscleGroup: '大腿四頭筋', movement: '膝伸展', side: 'right', mmt: '4-', hhdValue: null, unit: 'kg', bodyWeightRatio: null, contralateralRatio: null, pain: false, compensation: '', testPosition: '', createdAt: 'x' },
      { id: 's2', patientId: PID, measuredDate: '2026-11-18', bodyRegion: 'knee', muscleGroup: '大腿四頭筋', movement: '膝伸展', side: 'right', mmt: 4, hhdValue: null, unit: 'kg', bodyWeightRatio: null, contralateralRatio: null, pain: false, compensation: '', testPosition: '', createdAt: 'y' },
    ],
    scores: [
      { key: 'odi', label: 'ODI', unit: '%', higherIsBetter: false, date: '2026-11-04', total: 30, createdAt: 'a' },
      { key: 'odi', label: 'ODI', unit: '%', higherIsBetter: false, date: '2026-11-18', total: 36, createdAt: 'b' },
    ],
  })
  const rows = C.compareSeries(series, '2026-11-04')
  const by = (k) => rows.find((r) => r.key.startsWith(k))
  assert.equal(by('soap:nrs').prev.value, 6)
  assert.equal(by('soap:nrs').curr.value, 3)
  assert.equal(by('soap:nrs').trend, 'better') // 痛みは下がると良い方向
  assert.equal(by('outcome:rom_knee_flex').trend, 'better')
  assert.equal(by('outcome:lsi_quad').curr, null) // 今回まだ測っていない
  assert.equal(by('mmt:').trend, 'better')
  assert.equal(by('score:odi').trend, 'worse') // ODI は高いほど悪い
  // 自動と他動は別の項目（混ぜて比べない）
  const romRows = rows.filter((r) => r.key.startsWith('rom:'))
  assert.equal(romRows.length, 2)
  assert.ok(romRows.every((r) => r.trend === null))
  // 前回測った項目が先に並ぶ
  assert.ok(rows.findIndex((r) => !r.prev) > rows.findIndex((r) => r.key === 'soap:nrs'))
  const lines = C.compareSummary(rows)
  assert.ok(lines.some((l) => /痛み NRS（SOAP）：6（2026-11-04）→ 3（2026-11-15）・良い方向/.test(l)))
  assert.ok(lines.some((l) => /今回は測っていない/.test(l)))
})

test('前回の再評価が無いときは、最初と最新を並べる（1回しか無いものは今回なし）', () => {
  const series = C.seriesFromKarte({
    soapNotes: [
      { visitDate: '2026-11-01', painToday: 8, createdAt: '1' },
      { visitDate: '2026-11-10', painToday: 8, createdAt: '2' },
    ],
    outcomes: [{ id: 'o1', patientId: PID, date: '2026-11-10', metric: 'nrs', value: 4, createdAt: '3' }],
  })
  const rows = C.compareSeries(series, null)
  const nrs = rows.find((r) => r.key === 'soap:nrs')
  assert.equal(nrs.prev.date, '2026-11-01')
  assert.equal(nrs.curr.date, '2026-11-10')
  assert.equal(nrs.trend, 'same')
  assert.equal(rows.find((r) => r.key.startsWith('outcome:nrs')).curr, null)
  assert.deepEqual(C.compareSeries([], null), [])
})

console.log(`\n${passed} 件成功・0 件失敗`)
