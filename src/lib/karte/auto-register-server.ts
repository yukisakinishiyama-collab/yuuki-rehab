/**
 * 予約が入ったら、カルテが無い方のカルテを自動で作る（サーバー専用。2026-11-19 院長の依頼）
 *
 * 「新規患者が予約で入った場合、自動的に患者情報の登録を」
 *
 * 予約システムからの「新しい予約」の通知（api/marketing/reservation-notify の kind:'new'）を受けたあとに呼ぶ。
 * クラウドのカルテの控え（sync:clinic の pt_patients）を見て、同じ方のカルテが無ければ、予約のお名前・ふりがな・電話で
 * カルテを1つ足す。開いている端末は15秒以内に取り込む（「予約から自動で登録」の印が付く）。
 *
 * 二重に作らないために:
 * - 同じ方か … お名前が同じ、または電話とふりがなが同じ（lib/karte-from-reservation.ts の sameChartsForReservation）
 * - カルテの ID は「お名前＋電話」から決まった値にする（同じ方の通知が同時に2つ来ても、1つのカルテになる）
 * - 足したあとに入ったかを確かめ、端末からの保存と重なって消えていたら、やり直す
 * 今あるカルテは書きかえない。お名前・電話などは記録（ログ）に出さない。
 * 止めたいときは、Vercel の環境変数 KARTE_AUTO_REGISTER を off にする。
 */
import { createHmac } from 'node:crypto'
import { nanoid } from 'nanoid'
import { asIdArray } from '@/lib/sync-merge'
import { applySyncOps, readSyncRecord } from '@/lib/sync-store-server'
import {
  buildPatientFromReservation,
  personNameKey,
  reservationName,
  sameChartsForReservation,
  type ChartPerson,
} from '@/lib/karte-from-reservation'
import { phoneDigits } from '@/lib/karte-link'

const PATIENTS_KEY = 'pt_patients'
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

export interface NewReservationInput {
  reservationNo?: string
  name?: string
  kana?: string
  phone?: string
  date?: string
  time?: string
  menu?: string
  symptom?: string
  /** 予約の区分（初診・再診 など。予約システムが送ってきたときだけ） */
  kubun?: string
}

export type AutoRegisterResult =
  | { kind: 'created'; patientId: string }
  | { kind: 'exists'; count: number }
  | { kind: 'skipped'; reason: string }

/** 外から来た文字を1行にする（改行・制御文字を除く・長さを切る） */
function clean(value: unknown, max: number): string {
  return String(value ?? '')
    .replace(/[\p{Cc}\p{Zl}\p{Zp}]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max)
}

/** 「お名前＋電話」から決まるカルテの ID（鍵つきの指紋。お名前や電話は逆算できない） */
export function reservationPatientId(name: string, phone: string, secret: string): string {
  if (!secret) return nanoid()
  const mark = createHmac('sha256', secret).update(`karte-auto|${personNameKey(name)}|${phoneDigits(phone)}`).digest('hex')
  return `rsv${mark.slice(0, 20)}`
}

/** 担当者メモに残す、予約のときのご記入（無ければ空） */
function noteOf(symptom: string, date: string): string {
  if (!symptom) return ''
  const when = DATE_RE.test(date) ? `（${Number(date.slice(5, 7))}/${Number(date.slice(8, 10))}の予約）` : ''
  return `予約のときのご記入${when}：${symptom}`
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

export async function registerPatientFromReservation(
  input: NewReservationInput,
  opts: { settleMs?: number[]; now?: string } = {},
): Promise<AutoRegisterResult> {
  if ((process.env.KARTE_AUTO_REGISTER ?? '').trim().toLowerCase() === 'off') {
    return { kind: 'skipped', reason: '自動登録を止めている（KARTE_AUTO_REGISTER=off）' }
  }
  const name = reservationName(clean(input.name, 40))
  if (!personNameKey(name)) return { kind: 'skipped', reason: 'お名前が無い' }
  const kana = clean(input.kana, 60)
  const phone = clean(input.phone, 24).replace(/[^0-9+\-() ]/g, '').trim()
  const date = DATE_RE.test(String(input.date ?? '')) ? String(input.date) : ''
  const kubun = clean([input.kubun, input.menu].filter(Boolean).join(' '), 80)
  const person = { name, kana, phone, date, kubun }

  const id = reservationPatientId(name, phone, process.env.RESERVATION_NOTIFY_SECRET ?? '')
  const patient = buildPatientFromReservation(person, noteOf(clean(input.symptom, 300), date), { id, now: opts.now })
  const settle = opts.settleMs ?? [400, 1200, 2500]

  for (let attempt = 0; attempt < settle.length; attempt += 1) {
    const record = await readSyncRecord()
    // クラウドの控えがまだ無い院（同期を使っていない）では作らない。ここで控えを作ると、
    // 初めて同期する端末のカルテの一覧を、この1件で置きかえてしまうため
    if (!record) return { kind: 'skipped', reason: 'クラウドのカルテの控えがまだ無い' }
    const raw = record.payload[PATIENTS_KEY]
    const patients = raw == null ? [] : asIdArray(raw)
    if (!patients) return { kind: 'skipped', reason: 'カルテの一覧を読めない' }
    const same = sameChartsForReservation(patients as unknown as ChartPerson[], person)
    if (same.length > 0) {
      // やり直しの途中で、さっき足したカルテが入っていた
      if (attempt > 0 && same.some((p) => p.id === id)) return { kind: 'created', patientId: id }
      return { kind: 'exists', count: same.length }
    }
    await applySyncOps([{ key: PATIENTS_KEY, type: 'merge', upserts: [patient as unknown as Record<string, unknown>], deletes: [] }])
    // 同じときに端末からの保存が重なると、あとから書いた方で消えることがある。少し待って、入ったかを確かめる
    await sleep(settle[attempt])
    const after = await readSyncRecord()
    const list = asIdArray(after?.payload[PATIENTS_KEY])
    if (list?.some((p) => p.id === id)) return { kind: 'created', patientId: id }
  }
  return { kind: 'skipped', reason: '保存できたかを確かめられなかった' }
}
