'use client'
// ──────────────────────────────────────────────
// 予約の方のカルテを開く。カルテが無ければ、予約の情報から自動で作って開く
// （2026-11-02 院長の依頼「カルテを開いて書けない人も自動的にカルテが登録され記入できるように」）
//
// 使うところ: 「今日」の予約一覧の「カルテ」、予約管理画面でお名前を押したとき（/patients?karte=お名前&tel=電話）
//
// 二重に作らないために:
// 1. 起動時のクラウドの控えの取り込みが終わるのを待ってから探す（終わる前に作ると、取り込みで消えたり二重になったりする）
// 2. 「電話＋お名前」→「電話」→「お名前（空白を除く）」の順で探す（予約管理画面から開くときと同じ）
// 3. 作ったらすぐクラウドへ控えを送る（次に開いたときの取り込みで消えないように）
// 4. 見つからないときは、作る前にもう一度クラウドとそろえる（予約が入ったときにサーバーが作ったカルテを取りこぼさない）
// 同じ方のカルテが2つ以上見つかったときは作らずに、候補を一覧で見せる。
// お名前・ふりがな・電話は予約のものをそのまま使う。生年月日などは NOAH の取り込みで足せる。
// ──────────────────────────────────────────────
import type { Patient } from '@/types/patient'
import { getPatients, savePatient } from './patient-store'
import { matchKartePatients, nameKey } from './karte-link'
import { buildPatientFromReservation, reservationName, type ReservationPerson } from './karte-from-reservation'

// 作り方そのものは、サーバー（予約が入ったときの自動登録）と共通（lib/karte-from-reservation.ts）
export { buildPatientFromReservation, reservationName, type ReservationPerson }

export type OpenKarteResult =
  | { kind: 'open'; patient: Patient }
  | { kind: 'created'; patient: Patient }
  | { kind: 'ambiguous'; candidates: Patient[] }
  /** 起動時の取り込みでカルテが変わり、画面を読み直すところ（読み直したあと、もう一度探す） */
  | { kind: 'reload' }
  /** お名前が無く、作れない */
  | { kind: 'none' }

async function startupPull(): Promise<{ changed: boolean; enabled: boolean }> {
  try {
    const { pullAtStartup, isSyncEnabled } = await import('./sync-service')
    if (!isSyncEnabled()) return { changed: false, enabled: false }
    const { changed } = await pullAtStartup()
    return { changed, enabled: true }
  } catch {
    return { changed: false, enabled: false }
  }
}

/** いま探している・作っている途中の方（2回押した・画面が2回動いたときに、同じ方を2つ作らない） */
const inflight = new Map<string, Promise<OpenKarteResult>>()

/** 予約の方のカルテを探す。無ければ作る */
export function openOrCreateKarte(person: ReservationPerson): Promise<OpenKarteResult> {
  const key = `${nameKey(reservationName(person.name))}|${(person.phone ?? '').replace(/[^0-9]/g, '')}`
  const running = inflight.get(key)
  if (running) return running
  const task = findOrCreate(person).finally(() => inflight.delete(key))
  inflight.set(key, task)
  return task
}

async function findOrCreate(person: ReservationPerson): Promise<OpenKarteResult> {
  const sync = await startupPull()
  if (sync.changed) return { kind: 'reload' }

  const name = reservationName(person.name)
  let found = matchKartePatients(getPatients(), name, person.phone)
  if (found.length === 0 && sync.enabled && nameKey(name)) {
    // 予約が入ったときにサーバーが作ったカルテ（lib/karte/auto-register-server.ts）や、ほかの端末が作ったばかりのカルテが、
    // まだこの端末に届いていないことがある。作る前にもう一度クラウドとそろえて探す（同じ方を2つ作らない）
    try {
      const { syncNow } = await import('./sync-service')
      await syncNow()
      found = matchKartePatients(getPatients(), name, person.phone)
    } catch {
      // そろえられなくても、今までどおりこの端末で作る
    }
  }
  if (found.length === 1) return { kind: 'open', patient: found[0] }
  if (found.length > 1) return { kind: 'ambiguous', candidates: found }
  if (!nameKey(name)) return { kind: 'none' }

  const patient = buildPatientFromReservation(person)
  savePatient(patient)
  // 次に開いたときの取り込みで消えないよう、すぐクラウドへ控えを送る（失敗しても、あとの保存のときにまた送る）
  if (sync.enabled) {
    try {
      const { pushToCloud } = await import('./sync-service')
      await pushToCloud()
    } catch {
      // 同期は付加機能。カルテはこの端末に保存できている
    }
  }
  return { kind: 'created', patient }
}
