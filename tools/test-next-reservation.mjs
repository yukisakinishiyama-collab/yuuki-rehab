// 氏名から次の予約を探す（純粋な関数）の検査。架空データのみ
import assert from 'node:assert/strict'
import { findReservations, dateLabelJa, daysFromToday } from '../src/lib/karte/next-reservation.ts'

const row = (o) => ({ time: '10:00', name: '', kana: '', phone: '', kubun: '整体', status: '予約確定', reservationNo: 'R1', memo: '', ...o })
const feed = { ok: true, days: [
  { date: '2026-11-01', rows: [row({ name: '架空 太郎', kana: 'カクウ タロウ', phone: '090-1111-2222' })] },
  { date: '2026-11-10', rows: [row({ name: '架空 太郎', kana: 'カクウ タロウ', phone: '090-1111-2222', time: '15:30', reservationNo: 'R2' }), row({ name: '架空 花子', kana: 'カクウ ハナコ', time: '09:00', reservationNo: 'R3' })] },
  { date: '2026-11-09', rows: [row({ name: '架空 太郎', status: 'キャンセル', reservationNo: 'R4' })] },
  { date: '2026-11-20', rows: [row({ name: '別人 次郎', kana: 'ベツジン ジロウ', phone: '080-3333-4444', reservationNo: 'R5' })] },
] }
const today = '2026-11-08'
let n = 0
const t = (name, fn) => { fn(); n++; console.log('✓', name) }

t('氏名の一部で今後の予約だけ（過去・キャンセルは除く）、日付順', () => {
  const r = findReservations(feed, '太郎', today)
  assert.deepEqual(r.map(x => x.reservationNo), ['R2'])
})
t('姓だけなら家族もまとめて出る', () => {
  assert.deepEqual(findReservations(feed, '架空', today).map(x => x.reservationNo), ['R3', 'R2'])
})
t('ひらがなでフリガナに当たる', () => {
  assert.deepEqual(findReservations(feed, 'はなこ', today).map(x => x.reservationNo), ['R3'])
})
t('空白ありの入力でも当たる', () => {
  assert.equal(findReservations(feed, '架空　太郎', today).length, 1)
})
t('電話番号の一部（4桁以上）で当たる', () => {
  assert.deepEqual(findReservations(feed, '3333', today).map(x => x.reservationNo), ['R5'])
})
t('空の入力・フィード無しは空', () => {
  assert.equal(findReservations(feed, '  ', today).length, 0)
  assert.equal(findReservations(null, '架空', today).length, 0)
})
t('日付の表記と日数', () => {
  assert.equal(dateLabelJa('2026-11-10'), '11/10（火）')
  assert.equal(daysFromToday('2026-11-10', today), 2)
})
console.log(`${n}件成功 / 0件失敗`)
