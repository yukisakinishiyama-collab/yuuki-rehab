// ──────────────────────────────────────────────
// 予約の情報からカルテを作る・同じ方のカルテを探す（純粋な関数。画面からもサーバーからも使う）
//
// - 画面：予約の方のカルテを開いたとき、無ければ作る（lib/karte-auto-create.ts）
// - サーバー：予約システムから「新しい予約」が届いたとき、無ければ作る（lib/karte/auto-register-server.ts。
//   2026-11-19 院長の依頼「新規患者が予約で入った場合、自動的に患者情報の登録を」）
// お名前・ふりがな・電話は予約のものをそのまま使う。生年月日・住所などは、問診票の読み取りか NOAH の取り込みで足す。
// ──────────────────────────────────────────────
import { nanoid } from 'nanoid'
import type { Patient } from '@/types/patient'
import { nameKey, phoneDigits, samePhone } from './karte-link'

export interface ReservationPerson {
  name: string
  kana?: string
  phone?: string
  /** 予約の日（初診のときは初回来院の日にする） */
  date?: string
  /** 予約の区分（初診・再診 など） */
  kubun?: string
}

/** 予約のお名前を、カルテのお名前の形にする（前後の空白・「様」を除く） */
export function reservationName(name: string): string {
  return String(name || '')
    .trim()
    .replace(/\s*(様|さま)$/, '')
    .trim()
}

/** 予約の情報からカルテを作る（保存はしない）。id・時刻は、決まった値を使いたいときだけ渡す */
export function buildPatientFromReservation(
  person: ReservationPerson,
  note = '',
  fixed: { id?: string; now?: string } = {},
): Patient {
  const now = fixed.now ?? new Date().toISOString()
  return {
    id: fixed.id ?? nanoid(),
    name: reservationName(person.name),
    kana: (person.kana ?? '').trim(),
    birthDate: '',
    gender: 'other',
    phone: (person.phone ?? '').trim(),
    emergencyContact: '',
    mainComplaint: '',
    bodyRegion: 'other',
    diagnosisLabel: '',
    onsetDate: '',
    firstVisitDate: person.kubun?.includes('初診') ? (person.date ?? '') : '',
    status: 'active',
    therapistNotes: note,
    createdAt: now,
    updatedAt: now,
    autoCreatedFrom: 'reservation',
  }
}

/** お名前を比べる形にする（空白を除く・全角半角をそろえる） */
export function personNameKey(value: string | undefined): string {
  return nameKey(reservationName(String(value ?? ''))).normalize('NFKC')
}

/** ふりがなを比べる形にする（空白を除く・全角半角をそろえる・カタカナはひらがなに） */
export function kanaKey(value: string | undefined): string {
  return personNameKey(value).replace(/[ァ-ヶ]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0x60))
}

export interface ChartPerson {
  id: string
  name?: string
  kana?: string
  phone?: string
}

/**
 * 予約の方と「同じ方」のカルテ（自動で作る前に確かめる）。1つでもあれば、新しいカルテは作らない。
 * - お名前が同じ（電話がちがっても同じ方として扱う。NOAH のカルテは固定電話、予約は携帯のことが多いため）
 * - 電話が同じで、ふりがなが同じ（お名前の漢字の書き方がちがう・かなで予約した）
 * 電話だけ同じでお名前もふりがなもちがう方（ご家族）は、別の方として扱う。
 */
export function sameChartsForReservation<T extends ChartPerson>(patients: T[], person: ReservationPerson): T[] {
  const name = personNameKey(person.name)
  const nameAsKana = kanaKey(person.name)
  const kana = kanaKey(person.kana)
  const digits = phoneDigits(person.phone)
  if (!name && !kana) return []
  return patients.filter((p) => {
    const chartName = personNameKey(p.name)
    if (name && chartName === name) return true
    if (!digits || !samePhone(phoneDigits(p.phone), digits)) return false
    const chartKana = kanaKey(p.kana)
    const chartNameAsKana = kanaKey(p.name)
    if (kana && (chartKana === kana || chartNameAsKana === kana)) return true
    // 予約のお名前がかな書きで、カルテのふりがなと同じ
    return Boolean(nameAsKana && chartKana && chartKana === nameAsKana)
  })
}
