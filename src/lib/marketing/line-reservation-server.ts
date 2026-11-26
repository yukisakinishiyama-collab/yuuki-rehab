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
 *    → 予約システム v3.27〜が毎朝その日の分を送ったら（7.）、控えからは送らない（予約システムが動かなかった日の予備）
 * 4. 「今日」の画面の「LINEで予約日時を送る」を開いたとき、その一覧（予約システムから読んだもの）で控えを最新にする
 * 5. 患者さんが予約ページで日時を変更した（kind:'change'。予約システム v3.20〜。2026-11-16 院長の依頼）
 *    → 控えの日時を直し（前日のお知らせは新しい日にちで送る）、ご本人の LINE へ「日時を変更しました」を1通
 *
 * 6. 院で登録した予約（予約システム v3.27〜。kind:'confirm-linked'。2026-11-21 院長の依頼「予約確定・前日の2回、患者様のLINEに」）
 *    → 予約システムが LINE を知らない方（カルテの QR などで連携した方）へ、その場で「確定しました」を1通
 * 7. 前日のお知らせ（予約システム v3.27〜の毎朝8時の処理。kind:'remind-linked'）
 *    → 明日の確定の予約（予約システムの表がそのときの正しい予約）のうち、LINE 連携の方へ送る。
 *      予約システムが送った日は、3. の控えからは送らない（院の画面でのキャンセル・日時の変更は、控えに届かないため）
 *
 * 確定・前日・変更のお知らせには、日時の変更・キャンセルを入力なしで開けるリンクを入れる（lib/reservation-change-link.ts）。
 *
 * 控えに持つのは、予約番号・日付・時刻・LINE連携のキー（連携の記録 linelink: と同じ「電話番号|お名前」）だけ。
 * LINE の宛先は持たない（送るときに連携の記録の封印から開く）。
 * 8. 見張り（2026-11-25）：10時を過ぎても、予約システムの毎朝の依頼（7.）が届いていなければ、院長の LINE へ1日1回知らせる
 *    （予約システムの許可が外れるなどで、確定・前日のお知らせが止まったことに気づけるように）
 */
import { kvDelete, kvGet, kvList, kvSet } from './kv-store-server'
import { getLineLink, listLineLinks } from '@/lib/line-link-server'
import { patientLinkKey, type LineLink } from '@/lib/line-link'
import { LINK_MISS_TEXT, matchLinkForReservation, type LinkMatchHow, type LinkMatchMiss } from '@/lib/line-link-match'
import { unsealUserId } from '@/lib/liff-ticket'
import { lineMark } from './consent-store-server'
import { getRule, markSent } from './automation-store-server'
import { dedupeMark, pushToPatient, type PushResult } from './patient-line-push-server'
import { jstTomorrow, patientChangeText, patientConfirmText, patientRemindText } from '@/lib/reservation-message'
import { reservationChangeUrl } from '@/lib/reservation-change-link'

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
  /** 前日のお知らせを「テスト」の見本（院長あて）で済ませた。あとで「動かす」にしたら、ご本人へ送り直す */
  remindedTest?: boolean
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

/** LINE 連携を探すときに一度だけ読むもの（前日のお知らせのように、何人分も続けて探すときに使い回す） */
export interface LinkFinderCache {
  patients?: Array<{ id?: string; name?: string; phone?: string; birthDate?: string }>
  links?: Awaited<ReturnType<typeof listLineLinks>>
}

export async function cloudPatients(cache: LinkFinderCache): Promise<NonNullable<LinkFinderCache['patients']>> {
  if (!cache.patients) {
    try {
      const record = await kvGet<{ payload?: Record<string, string> }>('sync:clinic')
      const raw = record?.payload?.pt_patients
      cache.patients = raw ? (JSON.parse(raw) as NonNullable<LinkFinderCache['patients']>) : []
    } catch {
      cache.patients = []
    }
  }
  return cache.patients
}

/** 見つけた道すじ・見つからなかった理由（お名前などは入れない。予約システムへの返事と記録に使う） */
export type LinkWhy = LinkMatchHow | LinkMatchMiss | 'error'

/** 見つからなかった理由を、記録むけの短い言葉に */
export const linkWhyText = (why: LinkWhy): string => (why in LINK_MISS_TEXT ? LINK_MISS_TEXT[why as LinkMatchMiss] : why === 'error' ? 'カルテ・LINE連携を読めませんでした' : '')

/**
 * 予約の方の LINE 連携を探す。決まりは lib/line-link-match.ts（院内アプリの画面と同じ決まり）：
 * 予約の電話＋お名前 → 無ければ、クラウドのカルテから同じ方を決めて、そのカルテの LINE
 * （カルテの画面のQRコード＝カルテの ID → カルテの電話＋お名前 → お名前＋生年月日）。
 * 2026-11-25：QRコードで結びついた方に、院で入れた予約の「確定しました」が届かなかった（予約に電話が無い・カルテに生年月日が無いと
 * 見つけられなかった）。同じ日に、画面と同じ決まりにそろえ、見つからない理由（why）も返すようにした。
 * 同じお名前のカルテが2人以上で決められないとき・電話だけ同じでお名前がちがうカルテは、送らない
 */
export async function resolveLinkForPerson(name: string, phone: string, cache: LinkFinderCache = {}): Promise<{ link: LineLink | null; why: LinkWhy }> {
  // いちばん多い形（予約の電話＋お名前がそのまま連携のキー）は、一覧を読まずに決める
  const key = patientLinkKey(name, phone)
  if (key) {
    const direct = await getLineLink(key)
    if (direct) return { link: direct, why: 'direct' }
  }
  try {
    const patients = await cloudPatients(cache)
    if (!cache.links) cache.links = await listLineLinks()
    const m = matchLinkForReservation({ name, phone }, patients, cache.links)
    if (!m.linked) return { link: null, why: m.why }
    const link = await getLineLink(m.link.key)
    return link ? { link, why: m.how } : { link: null, why: 'karte_not_linked' }
  } catch {
    return { link: null, why: 'error' }
  }
}

export async function findLinkForPerson(name: string, phone: string, cache: LinkFinderCache = {}): Promise<LineLink | null> {
  return (await resolveLinkForPerson(name, phone, cache)).link
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
export async function onNewReservation(
  body: { reservationNo?: string; name?: string; phone?: string; date?: string; time?: string },
  opts: { waitMs?: number; now?: Date } = {},
): Promise<string> {
  const no = String(body.reservationNo ?? '')
  const date = String(body.date ?? '')
  const time = hhmm(body.time)
  if (!NO_RE.test(no) || !DATE_RE.test(date) || !time) return '予約番号・日時が読めません'
  const { link, why } = await resolveLinkForPerson(String(body.name ?? ''), String(body.phone ?? ''))
  // 近いカルテがあるのに決められなかったとき（同じお名前が2人以上）は、記録に理由を残す（お名前は入れない）
  if (!link) return why === 'karte_ambiguous' || why === 'error' ? `LINE連携していない方（${linkWhyText(why)}）` : 'LINE連携していない方'
  const secret = process.env.RESERVATION_NOTIFY_SECRET ?? ''
  const userId = unsealUserId(link.sealed, secret)
  if (!userId) return 'LINEの宛先を開けません'

  const today = jstParts(opts.now).date
  if (date < today) return '過ぎた日の予約'
  const rsv: LineReservation = { reservationNo: no, key: link.key, date, time, savedAt: new Date().toISOString() }
  await kvSet(`${RSV_PREFIX}${no}`, rsv)

  // LINE から予約した方には、予約システムが「確定しました」を送る。少し待ってから、送られていなければこちらから
  await new Promise((r) => setTimeout(r, opts.waitMs ?? CONFIRM_WAIT_MS))
  if (await alreadyConfirmed(no)) return '確定の LINE は送り済み'
  const r = await pushToPatient({
    automation: 'reservation_confirm',
    userId,
    text: patientConfirmText({ name: link.name, date, time, reservationNo: no, changeUrl: reservationChangeUrl(no) }),
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

/** 予約システムが毎朝の前日のお知らせを済ませた日の印（linesent:_remindrun:<予約の日>。予約番号とは重ならない形） */
const remindRunKey = (date: string) => `${SENT_PREFIX}_remindrun:${date}`

/** 院で登録した予約・前日のお知らせで、LINE 連携の方に送ったか（予約システムへ返す。お名前・宛先は返さない） */
export interface LinkedNotice {
  reservationNo: string
  /** LINE 連携の方だった */
  linked: boolean
  /** ご本人の LINE に届いた（テストの見本は false） */
  delivered: boolean
  /** ご本人が「予約のお知らせ停止」と送っている（メールにも切り替えない） */
  optedOut?: boolean
  result?: PushResult['result'] | 'not_linked' | 'invalid'
  /** LINE 連携を見つけた道すじ・見つからなかった理由（lib/line-link-match.ts。お名前などは入らない） */
  why?: LinkWhy | 'seal'
  note: string
}

/**
 * 6. 院で登録した予約（予約システムの管理画面・急患のすぐ登録。v3.27〜）
 * 予約システムが LINE を知らない方（LINE から予約したことが無い）へ、その場で「確定しました」を1通。
 * 予約システムの返事（「LINE に確定を送りました」の表示）に使うので、待たずに送る。控え（linersv:）は作らない
 * （前日のお知らせは、予約システムの毎朝の処理がそのときの予約の表から頼む＝7.）
 */
export async function confirmClinicReservation(
  body: { reservationNo?: string; name?: string; phone?: string; date?: string; time?: string },
  opts: { now?: Date } = {},
): Promise<LinkedNotice> {
  const no = String(body.reservationNo ?? '')
  const date = String(body.date ?? '')
  const time = hhmm(body.time)
  if (!NO_RE.test(no) || !DATE_RE.test(date) || !time) return { reservationNo: no, linked: false, delivered: false, result: 'invalid', note: '予約番号・日時が読めません' }
  const { link, why } = await resolveLinkForPerson(String(body.name ?? ''), String(body.phone ?? ''))
  if (!link) return { reservationNo: no, linked: false, delivered: false, result: 'not_linked', why, note: `LINE連携していない方（${linkWhyText(why)}）` }
  const userId = unsealUserId(link.sealed, process.env.RESERVATION_NOTIFY_SECRET ?? '')
  if (!userId) return { reservationNo: no, linked: false, delivered: false, result: 'not_linked', why: 'seal', note: 'LINEの宛先を開けません' }
  if (date < jstParts(opts.now).date) return { reservationNo: no, linked: true, delivered: false, result: 'skipped', why, note: '過ぎた日の予約' }
  const r = await pushToPatient({
    automation: 'reservation_confirm',
    userId,
    text: patientConfirmText({ name: link.name, date, time, reservationNo: no, changeUrl: reservationChangeUrl(no) }),
    note: '予約の確定（院で登録・LINE連携の方）',
    // ネット予約の確定（1.）・予約システムの確定と同じ印（同じ予約・同じ日時なら1通）
    dedupe: { day: date, mark: (test) => dedupeMark({ kind: 'patient-confirm', userMark: lineMark(userId), time, reservationNo: no }, test) },
  })
  if (r.delivered) {
    const sent: SentRecord = { reservationNo: no, key: link.key, date, time, sentAt: new Date().toISOString() }
    await kvSet(`${SENT_PREFIX}${no}`, sent)
  }
  return { reservationNo: no, linked: true, delivered: r.delivered, result: r.result, why, note: r.reason ?? r.result }
}

/**
 * 7. 前日のお知らせ（予約システムの毎朝8時の処理から。v3.27〜）
 * rows … 明日の確定の予約のうち、予約システムが LINE を知らないもの（予約の表のそのときの中身）。
 * LINE 連携の方へ送る（前日のお知らせの設定・本人の受け取り・二度送りの印は、今までの前日のお知らせと同じ）。
 * 届かなかった方は、予約システムがメールのある方へメールで送る。rows が空でも呼ばれ、その日は控え（3.）から送らない。
 */
export async function remindLinkedReservations(
  input: { date: string; rows: Array<{ reservationNo?: string; name?: string; phone?: string; time?: string }> },
  opts: { now?: Date } = {},
): Promise<LinkedNotice[]> {
  const now = opts.now ?? new Date()
  const date = String(input.date ?? '')
  if (!DATE_RE.test(date)) throw new Error('date（YYYY-MM-DD）が要ります')
  await kvSet(remindRunKey(date), { at: now.toISOString() })
  const secret = process.env.RESERVATION_NOTIFY_SECRET ?? ''
  const cache: LinkFinderCache = {}
  const results: LinkedNotice[] = []
  for (const row of input.rows.slice(0, 50)) {
    const no = String(row.reservationNo ?? '')
    const time = hhmm(row.time)
    if (!NO_RE.test(no) || !time) {
      results.push({ reservationNo: no, linked: false, delivered: false, result: 'invalid', note: '予約番号・時刻が読めません' })
      continue
    }
    const { link, why } = await resolveLinkForPerson(String(row.name ?? ''), String(row.phone ?? ''), cache)
    const userId = link ? unsealUserId(link.sealed, secret) : null
    if (!link || !userId) {
      results.push({ reservationNo: no, linked: false, delivered: false, result: 'not_linked', why: link ? 'seal' : why, note: link ? 'LINEの宛先を開けません' : `LINE連携していない方（${linkWhyText(why)}）` })
      continue
    }
    const r = await pushToPatient({
      automation: 'reservation_remind',
      userId,
      text: patientRemindText({ name: link.name, date, time, reservationNo: no, changeUrl: reservationChangeUrl(no) }, now),
      note: '前日のお知らせ（LINE連携の方）',
      requireConsent: true,
      // 予約システムの前日のお知らせ・控え（3.）と同じ印（どこから送っても1通）
      dedupe: { day: date, mark: (test) => dedupeMark({ kind: 'patient-remind', userMark: lineMark(userId), time, reservationNo: no }, test) },
    })
    results.push({
      reservationNo: no,
      linked: true,
      delivered: r.delivered,
      optedOut: r.result === 'opted_out' || undefined,
      result: r.result,
      why,
      note: r.reason ?? r.result,
    })
  }
  return results
}

/** 見張りの知らせを出した日の印（linesent:_remindwatch:<今日>） */
const watchKey = (today: string) => `${SENT_PREFIX}_remindwatch:${today}`

/** 見張りの知らせの文（院長の LINE へ） */
export const HEARTBEAT_ALERT_TEXT = [
  '⚠️ 予約システムからの毎朝の連絡が、今日は届いていません。',
  '',
  'LINE連携の方への「予約が確定しました」「前日のお知らせ」が止まっているおそれがあります。',
  '',
  '・明日のご予約の方には、院内アプリの控えにある分だけ、このあと前日のお知らせをお送りします',
  '・院の画面で入れた予約の「確定しました」は、直るまで届きません',
  '',
  '予約システム（Apps Script）の実行ログの確認が必要です。システムの担当（Claude）へ「予約システムからの連絡が止まっている」とお伝えください。',
].join('\n')

/**
 * 8. 見張り：予約システムの毎朝の依頼（7.）が今日は届いていない → 院長の LINE へ1日1回（投稿ジョブの定期実行から）
 * 2026-11-25：予約システム（Apps Script）の外への接続の許可が外れ、院で入れた予約の確定と毎朝の前日のお知らせが止まっていたが、
 * だれも気づけなかった（予約システムは、失敗しても画面に出さず次へ進む）。
 * 予約システム v3.27〜は、毎朝8時に、明日の予約が無い日も1回は依頼してくる（remindRunKey の印が付く）。
 * 10時を過ぎても明日の分の印が無ければ、予約システムから院内アプリへの連絡が止まっているとみて知らせる。
 * 一度も依頼を受けたことが無い（予約システムが古い）ときは知らせない。知らせを送れなかったら、次の回にもう一度
 */
export async function watchReminderHeartbeat(now = new Date()): Promise<{ ok: boolean; alerted: boolean; reason?: string }> {
  const { date: today, hour } = jstParts(now)
  if (hour < REMIND_FROM_HOUR || hour >= REMIND_TO_HOUR) return { ok: true, alerted: false, reason: '見る時間外' }
  if (await kvGet(remindRunKey(jstTomorrow(now)))) return { ok: true, alerted: false }
  if (await kvGet(watchKey(today))) return { ok: false, alerted: false, reason: '今日は知らせ済み' }
  const everRan = (await kvList(`${SENT_PREFIX}_remindrun:`)).length > 0
  if (!everRan) return { ok: true, alerted: false, reason: '予約システムからの毎朝の依頼を、まだ受けたことがない' }
  const { notifyOwner } = await import('./owner-notify')
  const r = await notifyOwner([HEARTBEAT_ALERT_TEXT])
  if (r.delivered) await kvSet(watchKey(today), { at: now.toISOString() })
  return { ok: false, alerted: r.delivered, reason: r.delivered ? undefined : r.reason }
}

/**
 * 5. 患者さんが予約ページで日時を変更した（予約システムからの通知 kind:'change'）
 * - 控え（linersv:<予約番号>）の日時を直す。前日のお知らせは、新しい日にちで送れるように戻す
 * - 控えが無い方（予約システムの「新しい予約」の通知より前に入っていた予約など）は、電話＋お名前で LINE 連携を探して控える
 * - ご本人の LINE へ「日時を変更しました」を1通（予約確認の LINE の設定に従う。同じ変更の知らせが二度来ても1通）
 *   宛先は、LINE 連携の記録から。無ければ、予約の行の封印（LINE から予約した方）から
 */
export async function onChangeReservation(
  body: { reservationNo?: string; name?: string; phone?: string; date?: string; time?: string; prevDate?: string; prevTime?: string; sealed?: string },
  opts: { now?: Date } = {},
): Promise<{ delivered: boolean; note: string }> {
  const no = String(body.reservationNo ?? '')
  const date = String(body.date ?? '')
  const time = hhmm(body.time)
  if (!NO_RE.test(no) || !DATE_RE.test(date) || !time) return { delivered: false, note: '予約番号・日時が読めません' }
  const secret = process.env.RESERVATION_NOTIFY_SECRET ?? ''
  const today = jstParts(opts.now).date

  // 控えを直す（無ければ、LINE 連携の方かを探して作る）
  const existing = await kvGet<LineReservation>(`${RSV_PREFIX}${no}`)
  let link: LineLink | null = existing ? await getLineLink(existing.key) : null
  if (!link) link = await findLinkForPerson(String(body.name ?? ''), String(body.phone ?? ''))
  if (link && date >= today) {
    const next: LineReservation = { ...(existing ?? {}), reservationNo: no, key: link.key, date, time, savedAt: new Date().toISOString() }
    delete next.remindedAt
    delete next.remindedTest
    await kvSet(`${RSV_PREFIX}${no}`, next)
  } else if (existing) {
    // 連携が外れた・過ぎた日にちへの変更 → 古い日時のまま前日のお知らせを送らないように消す
    await kvDelete(`${RSV_PREFIX}${no}`)
  }
  if (date < today) return { delivered: false, note: '過ぎた日の予約' }

  const userId = (link ? unsealUserId(link.sealed, secret) : null) ?? unsealUserId(String(body.sealed ?? ''), secret)
  if (!userId) return { delivered: false, note: link ? 'LINEの宛先を開けません' : 'LINE連携していない方' }
  const prevDate = DATE_RE.test(String(body.prevDate ?? '')) ? String(body.prevDate) : ''
  const r = await pushToPatient({
    automation: 'reservation_confirm',
    userId,
    text: patientChangeText({
      // LINE から予約した方（連携の記録が無い）は、予約のときのお名前
      name: link ? link.name : String(body.name ?? ''),
      date,
      time,
      prevDate,
      prevTime: hhmm(body.prevTime),
      reservationNo: no,
      changeUrl: reservationChangeUrl(no),
    }),
    note: '予約の日時の変更',
    // 同じ変更の知らせが二度来ても1通（別の日時へ変えて、また戻したときは別の変更として送る）
    dedupe: {
      day: date,
      mark: (test) => dedupeMark({ kind: 'patient-change', userMark: lineMark(userId), time: `${time}<${prevDate} ${hhmm(body.prevTime)}`, reservationNo: no }, test),
    },
  })
  return { delivered: r.delivered, note: r.reason ?? r.result }
}

/** 3. 前日のお知らせ（定期実行から。時間帯の外・送り済みは何もしない） */
export async function runLineReminders(now = new Date()): Promise<{ sent: number; skipped: number; reason?: string }> {
  const { date: today, hour } = jstParts(now)
  if (hour < REMIND_FROM_HOUR || hour >= REMIND_TO_HOUR) return { sent: 0, skipped: 0, reason: `送る時間外（${REMIND_FROM_HOUR}〜${REMIND_TO_HOUR}時）` }
  const tomorrow = jstTomorrow(now)
  const rows = await kvList<LineReservation>(RSV_PREFIX)
  const secret = process.env.RESERVATION_NOTIFY_SECRET ?? ''
  const testing = (await getRule('reservation_remind')).mode === 'test'
  // 予約システム（v3.27〜）が毎朝、そのときの予約の表から明日の分を送った日は、控えからは送らない
  // （控えは、院の画面でのキャンセル・日時の変更を知らないため。予約システムが動かなかった日だけ、控えから送る）
  const handledBySystem = Boolean(await kvGet(remindRunKey(tomorrow)))
  let sent = 0
  let skipped = 0
  for (const { key, value } of rows) {
    if (!value || !DATE_RE.test(String(value.date))) continue
    // 過ぎた予約の控えは消す
    if (value.date < today) {
      await kvDelete(key)
      continue
    }
    if (value.date !== tomorrow || handledBySystem) continue
    // 送り済み（見本だけのものは、「動かす」になったらご本人へ）
    if (value.remindedAt && (!value.remindedTest || testing)) continue
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
      text: patientRemindText(
        { name: link.name, date: value.date, time: value.time, reservationNo: value.reservationNo, changeUrl: reservationChangeUrl(value.reservationNo) },
        now,
      ),
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
    if (r.result !== 'limited' && r.result !== 'error') {
      // 見本（テスト）で済んだものは印をつけておき、「動かす」になったらご本人へ送る
      const sample = r.result === 'test' || (r.result === 'duplicate' && !r.delivered)
      await kvSet(key, { ...value, remindedAt: new Date().toISOString(), remindedTest: sample || undefined })
    }
  }
  return handledBySystem ? { sent, skipped, reason: '明日の分は予約システムの毎朝の処理で送りました' } : { sent, skipped }
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
      delete next.remindedTest
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
