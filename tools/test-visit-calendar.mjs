// 来院カレンダーの元データの試験（架空データ）
// 実行: npx tsx tools/test-visit-calendar.mjs
import { buildVisitDays, monthShape, reservationsForPatient, summarize, ymd } from '../src/lib/karte/visit-calendar.ts'

let passed = 0, failed = 0
const check = (label, ok, detail) => { if (ok) { passed++; console.log(`  ✓ ${label}`) } else { failed++; console.log(`  ✗ ${label}${detail !== undefined ? `\n      実際: ${JSON.stringify(detail)}` : ''}`) } }

const patient = { id: 'p1', name: '架空 太郎', kana: 'カクウ タロウ', phone: '090-0000-1234', bodyRegion: 'knee' }
const soap = (d, n, pain) => ({ id: `s${n}`, patientId: 'p1', visitDate: d, visitNumber: n, painToday: pain, treatmentToday: 'セッティング指導', priorityIssue: '' })
const today = '2026-11-07'

console.log('月の形')
check('2026年11月は日曜はじまり・30日', JSON.stringify(monthShape(2026, 11)) === JSON.stringify({ firstDow: 0, daysInMonth: 30 }), monthShape(2026, 11))
check('ymd', ymd(2026, 1, 5) === '2026-01-05')

console.log('日ごとの出来事')
const days = buildVisitDays({
  patient, today,
  soapNotes: [soap('2026-11-03', 2, 3), soap('2026-10-20', 1, 6)],
  attendance: [{ id: 'a1', patientId: 'p1', visitDate: '2026-10-27', status: 'visited' }, { id: 'a2', patientId: 'p1', visitDate: '2026-11-03', status: 'visited' }],
  cancellations: [
    { id: 'c1', patientId: 'p1', kind: 'same_day', appointmentDate: '2026-10-30', appointmentTime: '10:30' },
    { id: 'c2', patientId: 'p1', kind: 'advance', appointmentDate: '2026-11-01', excludedAs: 'clinic' },
  ],
  intakes: [{ id: 'i1', patientId: 'p1', intakeDate: '2026-10-20' }],
  photos: [{ id: 'ph', patientId: 'p1', takenDate: '2026-11-03' }],
})
check('SOAPの日は来院', days.get('2026-11-03')?.visited === true)
check('来院記録だけの日も来院', days.get('2026-10-27')?.visited === true && days.get('2026-10-27')?.events.length === 1)
check('SOAPと来院記録が同じ日なら1件', days.get('2026-11-03')?.events.filter(e => e.kind === 'visit').length === 1)
check('当日キャンセル', days.get('2026-10-30')?.cancelled === true && /当日キャンセル（10:30）/.test(days.get('2026-10-30')?.events[0].label))
check('数えないキャンセルは cancelled にしない', days.get('2026-11-01')?.cancelled === false && days.get('2026-11-01')?.events[0].muted === true)
check('来院の説明に痛みと施術', /2回目 · 痛み 3\/10・セッティング指導/.test(days.get('2026-11-03')?.events[0].label), days.get('2026-11-03')?.events[0].label)
check('問診と写真の印', days.get('2026-10-20')?.events.some(e => e.kind === 'intake') && days.get('2026-11-03')?.events.some(e => e.kind === 'photo'))

console.log('まとめ')
const sm = summarize(days, today)
check('通算3回・今月1回・最後は11/3（4日前）', sm.total === 3 && sm.thisMonth === 1 && sm.lastVisit === '2026-11-03' && sm.daysSince === 4, sm)

console.log('予約（本人と確実に分かるものだけ）')
const feed = { ok: true, days: [
  { date: '2026/11/08', rows: [
    { time: '10:00', name: '架空 太郎', kana: 'カクウ タロウ', phone: '09000001234', kubun: '再診', status: '確定', reservationNo: 'R1', memo: '' },
    { time: '11:00', name: '架空 花子', kana: '', phone: '09000001234', kubun: '', status: '確定', reservationNo: 'R2', memo: '' },
    { time: '12:00', name: '架空 太郎', kana: '', phone: '', kubun: '', status: 'キャンセル', reservationNo: 'R3', memo: '' },
  ] },
  { date: '2026-11-06', rows: [{ time: '09:00', name: '架空 太郎', kana: 'カクウ タロウ', phone: '09000001234', kubun: '', status: '確定', reservationNo: 'R0', memo: '' }] },
] }
const rs = reservationsForPatient(feed, patient, today)
check('本人の確定予約だけ1件（家族・キャンセル・過去は除く）', rs.length === 1 && rs[0].date === '2026-11-08' && /10:00 予約（再診）/.test(rs[0].label), rs)
const withFeed = buildVisitDays({ patient, today, soapNotes: [], feed })
check('次の予約は 11/8', summarize(withFeed, today).nextReservation === '2026-11-08')

console.log(`\n${passed}件成功 / ${failed}件失敗`)
if (failed > 0) process.exit(1)
