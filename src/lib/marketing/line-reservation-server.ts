/**
 * LINE連携している患者さんへの、予約のお知らせ（サーバー専用。2026-11-05 院長の依頼）
 *
 * 「予約確定の LINE は即時送ってください（連携済みの方は）」「前日にも LINE を自動で送ってください」「承認は待たずに良い」
 *
 * 予約システムが LINE を知っているのは、LINE から予約した方だけ（予約の行に封印がある）。カルテから LINE 連携した方
 * （linelink:<キー>）は予約システムが知らないので、こちらで送る。
 *
 * 1. 予約が入った（予約システムからの通知 kind:'new'）
 *    → 電話＋お名前（無ければカルテのお名前＋生年月日）で LINE 連携を探す → 見つかれば予約を控える（linersv:<予約番号>）
 *    → 少し待って、予約システムが同じ予約の「確定しました」を送っていなければ、こちらから送る（予約確認の LINE の設定に従う）
 * 2. 予約のキャンセル（kind:'cancel'）→ 控えを消す（前日のお知らせを送らない）
 * 3. 前日のお知らせ（投稿ジョブの定期実行から。日本時間 REMIND_FROM_HOUR〜REMIND_TO_HOUR 時）
 *    → 明日の控えの方へ送る（前日のお知らせの設定・本人の受け取りに従う）。予約システムと同じ印を使うので1通だけ
 * 4. 「今日」の画面の「LINEで予約日時を送る」を開いたとき、その一覧（予約システムから読んだもの）で控えを最新にする
 *
 * 控えに持つのは、予約番号・日付・時刻・LINE連携のキーだけ（お名前・電話は持たない）。
 */
import { kvDelete, kvGet, kvList, kvSet } from './kv-store-server'
import { getLineLink, listLineLinks } from '@/lib/line-link-server'
import { patientLinkKey, nameNoSpace, phoneDigits, type LineLink } from '@/lib/line-link'
import { unsealUserId } from '@/lib/liff-ticket'
import { lineMark } from './consent-store-server'
import { markSent } from './automation-store-server'
import { dedupeMark, pushToPatient } from './patient-line-push-server'
import { jstTomorrow, patientConfirmText, patientRemindText } from '@/lib/reservation-message'

const RSV_PREFIX = 'linersv:'
const SENT_PREFIX = 'linesent:'
/** 前日のお知らせを送る時間帯（日本時間） */
export const REMIND_FROM_HOUR = 10
export const REMIND_TO_HOUR = 20
/** 予約が入ってから、こちらで確定の LINE を送るまで待つ秒数（LINE から予約した方には予約システムが送るため） */
const CONFIRM_WAIT_MS = 15_000

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const NO_RE = /^[A-Za-z0-9-]{1,20}$/

export interface LineReservation {
  reservationNo: string
  /** LINE連携のキー（電話＋お名前） */
  key: string
  date: string
  time: string
  savedAt: string
  confirmedAt?: string
  remindedAt?: string
}

interface SentRecord {
  reservationNo: string
  key: string
  date: string
  time: string
  sentAt: string
}

const hhmm = (time: unknown): string => {
  const m = /^(\d{1,2}):(\d{2})/.exec(String(time ?? '').trim())
  return m ? `${m[1].padStart(2, '0')}:${m[2]}` : ''
}

function jstParts(now = new Date()): { date: string; hour: number } {
  const t = new Date(now.getTime() + 9 * 60 * 60 * 1000)
  return { date: t.toISOString().slice(0, 10), hour: t.getUTCHours() }
}

/** 予約の方の LINE 連携を探す（電話＋お名前 → 無ければ、クラウドのカルテの「お名前＋生年月日」） */
export async function findLinkForPerson(name: string, phone: string): Promise<LineLink | null> {
  const key = patientLinkKey(name, phone)
  if (key) {
    const direct = await getLineLink(key)
    if (direct) return direct
  }
  const compact = nameNoSpace(name).normalize('NFKC')
  const digits = phoneDigits(phone)
  if (!compact) return null
  try {
    const record = await kvGet<{ payload?: Record<string, string> }>('sync:clinic')
    const raw = record?.payload?.pt_patients
    if (!raw) return null
    const patients = JSON.parse(raw) as Array<{ name?: string; phone?: string; birthDate?: string }>
    const same = patients.filter((p) => nameNoSpace(p.name ?? '').normalize('NFKC') === compact)
    // 同じお名前のカルテが1人だけ（または電話も同じ方が1人だけ）のときに使う
    const byPhone = digits ? same.filter((p) => phoneDigits(p.phone ?? '') === digits) : []
    const karte = byPhone.length === 1 ? byPhone[0] : same.length === 1 ? same[0] : null
    if (!karte?.birthDate) return null
    const links = await listLineLinks()
    const hit = links.filter((l) => l.birthDate === karte.birthDate && nameNoSpace(l.name).normalize('NFKC') === compact)
    return hit.length === 1 ? getLineLink(hit[0].key) : null
  } catch {
    return null
  }
}

/** この予約に「確定しました」を送ったか（予約システムから・この仕組みから・「LINEで送る」ボタンから） */
async function alreadyConfirmed(reservationNo: string): Promise<boolean> {
  return Boolean(await kvGet<SentRecord>(`${SENT_PREFIX}${reservationNo}`))
}

/** この予約（同じ日時）に「確定しました」を送ってあるか（予約システムの patient-confirm が遅れて来たときに二重に送らない） */
export async function confirmSentFor(reservationNo?: string, date?: string, time?: string): Promise<boolean> {
  const no = String(reservationNo ?? '')
  if (!NO_RE.test(no)) return false
  const record = await kvGet<SentRecord>(`${SENT_PREFIX}${no}`)
  return Boolean(record && record.date === String(date ?? '') && record.time === hhmm(time))
}

/** 予約システムが本人へ「確定しました」を送ったときの印（こちらから二重に送らない） */
export async function markConfirmSent(input: { reservationNo?: string; date?: string; time?: string; userId: string }): Promise<void> {
  const no = String(input.reservationNo ?? '')
  const date = String(input.date ?? '')
  const time = hhmm(input.time)
  if (!NO_RE.test(no) || !DATE_RE.test(date)) return
  const record: SentRecord = { reservationNo: no, key: '', date, time, sentAt: new Date().toISOString() }
  await kvSet(`${SENT_PREFIX}${no}`, record)
  await markSent(date, dedupeMark({ kind: 'patient-confirm', userMark: lineMark(input.userId), time, reservationNo: no }, false))
}

/** 1. 予約が入った（予約システムからの通知。返事のあとで呼ぶ） */
export async function onNewReservation(body: { reservationNo?: string; name?: string; phone?: string; date?: string; time?: string }): Promise<string> {
  const no = String(body.reservationNo ?? '')
  const date = String(body.date ?? '')
  const time = hhmm(body.time)
  if (!NO_RE.test(no) || !DATE_RE.test(date) || !time) return '予約番号・日時が読めません'
  const link = await findLinkForPerson(String(body.name ?? ''), String(body.phone ?? ''))
  if (!link) return 'LINE連携していない方'
  const secret = process.env.RESERVATION_NOTIFY_SECRET ?? ''
  const userId = unsealUserId(link.sealed, secret)
  if (!userId) return 'LINEの宛先を開けません'

  const today = jstParts().date
  if (date < today) return '過ぎた日の予約'
  const rsv: LineReservation = { reservationNo: no, key: link.key, date, time, savedAt: new Date().toISOString() }
  await kvSet(`${RSV_PREFIX}${no}`, rsv)

  // LINE から予約した方には、予約システムが「確定しました」を送る。少し待ってから、送られていなければこちらから
  await new Promise((r) => setTimeout(r, CONFIRM_WAIT_MS))
  if (await alreadyConfirmed(no)) return '確定の LINE は送り済み'
  const r = await pushToPatient({
    automation: 'reservation_confirm',
    userId,
    text: patientConfirmText({ name: link.name, date, time, reservationNo: no }),
    note: '予約の確定（LINE連携の方）',
    dedupe: { day: date, mark: (test) => dedupeMark({ kind: 'patient-confirm', userMark: lineMark(userId), time, reservationNo: no }, test) },
  })
  if (r.delivered) {
    const sent: SentRecord = { reservationNo: no, key: link.key, date, time, sentAt: new Date().toISOString() }
    await kvSet(`${SENT_PREFIX}${no}`, sent)
    await kvSet(`${RSV_PREFIX}${no}`, { ...rsv, confirmedAt: sent.sentAt })
  }
  return r.reason ?? r.result
}

/** 2. 予約のキャンセル → 控えを消す */
export async function onCancelReservation(reservationNo?: string): Promise<void> {
  const no = String(reservationNo ?? '')
  if (NO_RE.test(no)) await kvDelete(`${RSV_PREFIX}${no}`)
}

/** 3. 前日のお知らせ（定期実行から。時間帯の外・送り済みは何もしない） */
export async function runLineReminders(now = new Date()): Promise<{ sent: number; skipped: number; reason?: string }> {
  const { date: today, hour } = jstParts(now)
  if (hour < REMIND_FROM_HOUR || hour >= REMIND_TO_HOUR) return { sent: 0, skipped: 0, reason: `送る時間外（${REMIND_FROM_HOUR}〜${REMIND_TO_HOUR}時）` }
  const tomorrow = jstTomorrow(now)
  const rows = await kvList<LineReservation>(RSV_PREFIX)
  const secret = process.env.RESERVATION_NOTIFY_SECRET ?? ''
  let sent = 0
  let skipped = 0
  for (const { key, value } of rows) {
    if (!value || !DATE_RE.test(String(value.date))) continue
    // 過ぎた予約の控えは消す
    if (value.date < today) {
      await kvDelete(key)
      continue
    }
    if (value.date !== tomorrow || value.remindedAt) continue
    const link = await getLineLink(value.key)
    const userId = link ? unsealUserId(link.sealed, secret) : null
    if (!link || !userId) {
      skipped += 1
      await kvSet(key, { ...value, remindedAt: `skipped:${new Date().toISOString()}` })
      continue
    }
    const r = await pushToPatient({
      automation: 'reservation_remind',
      userId,
      text: patientRemindText({ name: link.name, date: value.date, time: value.time, reservationNo: value.reservationNo }, now),
      note: '前日のお知らせ（LINE連携の方）',
      requireConsent: true,
      // 予約システムの前日のお知らせと同じ印（どちらが先に送っても1通）
      dedupe: {
        day: value.date,
        mark: (test) => dedupeMark({ kind: 'patient-remind', userMark: lineMark(userId), time: value.time, reservationNo: value.reservationNo }, test),
      },
    })
    if (r.result === 'sent') sent += 1
    else skipped += 1
    // 上限・送れなかったときは、次の回にもう一度（それ以外は、その予約は終わり）
    if (r.result !== 'limited' && r.result !== 'error') await kvSet(key, { ...value, remindedAt: new Date().toISOString() })
  }
  return { sent, skipped }
}

/**
 * 4. 「今日」の画面で読んだ予約で控えを最新にする
 * - rows  … 予約システムのこれからの予約すべて（予約番号・日付・時刻だけ。お名前・電話は来ない）
 * - items … そのうち、画面で LINE 連携の方とわかったもの（連携のキーつき）→ 控えが無ければ足す
 * 控えを消すのは、from〜to の間で、予約番号が rows に無くなったもの（キャンセル・来院済み）だけ。
 * 画面で LINE 連携の方とわからなかった予約（その端末のカルテが違うときなど）の控えは消さない。
 * rows が空のとき（読み込みの不具合かもしれない）は何も消さない。日時が変わったものは控えの日時を直す。
 */
export async function syncLineReservations(input: {
  from: string
  to: string
  rows: Array<{ reservationNo: string; date: string; time: string }>
  items: Array<{ key: string; reservationNo: string; date: string; time: string }>
}): Promise<{ saved: number; updated: number; removed: number }> {
  const { from, to } = input
  if (!DATE_RE.test(from) || !DATE_RE.test(to)) throw new Error('期間の形が正しくありません')
  const inWindow = (date: string) => DATE_RE.test(date) && date >= from && date <= to
  const present = new Map<string, { date: string; time: string }>()
  for (const r of input.rows.slice(0, 1000)) {
    const time = hhmm(r.time)
    if (NO_RE.test(String(r.reservationNo)) && inWindow(String(r.date)) && time) present.set(r.reservationNo, { date: r.date, time })
  }

  let saved = 0
  let updated = 0
  let removed = 0
  const existing = new Map((await kvList<LineReservation>(RSV_PREFIX)).map((r) => [r.key.slice(RSV_PREFIX.length), r.value]))
  for (const [no, value] of existing) {
    if (!value || !inWindow(String(value.date))) continue
    const now = present.get(no)
    if (!now) {
      if (present.size === 0) continue
      await kvDelete(`${RSV_PREFIX}${no}`)
      removed += 1
      continue
    }
    if (now.date !== value.date || now.time !== value.time) {
      // 日時が変わった → 新しい日時で前日のお知らせを送り直せるように
      const next: LineReservation = { ...value, date: now.date, time: now.time, savedAt: new Date().toISOString() }
      delete next.remindedAt
      await kvSet(`${RSV_PREFIX}${no}`, next)
      updated += 1
    }
  }
  for (const it of input.items.slice(0, 300)) {
    const no = String(it.reservationNo)
    const time = hhmm(it.time)
    if (existing.has(no) || !NO_RE.test(no) || !inWindow(String(it.date)) || !time || !/^\d{10,11}\|.{1,60}$/.test(String(it.key))) continue
    await kvSet(`${RSV_PREFIX}${no}`, { reservationNo: no, key: it.key, date: it.date, time, savedAt: new Date().toISOString() } satisfies LineReservation)
    saved += 1
  }
  return { saved, updated, removed }
}
