/**
 * 予約通知エンドポイント（GAS予約システム → LINEプッシュ通知）
 *
 * 用途は2系統:
 * 1) 院長宛（従来）: 新規予約/キャンセル/前日リマインド一覧を院長のLINEへ
 *    - kind: 'new' | 'cancel' | 'reminder' → RESERVATION_NOTIFY_LINE_USER_ID宛
 *    - kind: 'change' … 患者さんが予約ページで日時を変更した（予約システム v3.20〜。date・time が新しい日時、prevDate・prevTime が変更前）
 *      院長のLINEへ知らせ、ご本人のLINEへ「日時を変更しました」を送り、前日のお知らせの控えを新しい日時に直す
 *      （lib/marketing/line-reservation-server.ts の onChangeReservation）。返事の patientDelivered は、ご本人のLINEに届いたか
 * 2) 患者宛（LIFF連携）: 予約完了・キャンセル確認を患者本人のLINEへ
 *    - kind: 'patient-confirm' … ticket（LIFF IDトークン検証済みの短命チケット）
 *      または sealed（過去の予約行に保存済みの長期参照。管理画面からの手動登録で、
 *      LINE連携済みの患者へ完了通知を送るときに使う）
 *      成功時、シート保存用の sealed（長期の署名付き参照）を返す
 *    - kind: 'patient-cancel'  … sealed（予約行に保存済みの参照）
 *    - kind: 'patient-remind'  … sealed＋date・time。前日のお知らせ（予約システムの毎朝の処理から）
 *    - kind: 'patient-waitlist'… sealed＋date・time。キャンセル待ちの方への空き枠のお知らせ（先着順に1人ずつ）
 *    患者宛は、集客 → 自動化設定の「止める／テスト／動かす」・1日の上限に従う。
 *    前日のお知らせ・空き枠のお知らせは、さらに次を確かめる（予約システムは返事を見て、メールに切り替える・あとで送り直す）
 *      - 本人が「予約のお知らせ停止」と送っていたら送らない → { delivered:false, optedOut:true }
 *      - 空き枠のお知らせは送ってよい時間帯（8時〜20時）だけ → 時間外は { delivered:false, deferred:true }
 *      - 同じお知らせは二度送らない → { duplicate:true }（送り済みなら delivered:true）
 *
 * 3) LINE 連携の方（カルテの QR などで院内アプリと結びついた方。予約システムは LINE を知らない）へ（予約システム v3.27〜。
 *    2026-11-21 院長の依頼「予約確定・前日の2回、患者様のLINEに」。lib/marketing/line-reservation-server.ts）
 *    - kind: 'confirm-linked' … 院で登録した予約（管理画面・急患のすぐ登録）。お名前・電話で連携を探し、「確定しました」を1通
 *      → { linked, delivered, result }（院長の LINE には知らせない）
 *    - kind: 'remind-linked'  … 毎朝8時の前日のお知らせ。date＋rows（明日の確定の予約のうち、予約システムが LINE を知らないもの）
 *      → { results: [{ reservationNo, linked, delivered, optedOut }] }。届かなかった方は予約システムがメールで送る
 *
 * 新しい予約（kind: 'new'）のときは、返事のあとで、カルテが無い方のカルテを自動で作る
 * （lib/karte/auto-register-server.ts。2026-11-19 院長の依頼）。
 * さらに、カルテから LINE 連携した方へ「確定しました」を送る
 * （予約システムが LINE を知らない方。LINE から予約した方には予約システムが patient-confirm で送るので、二重には送らない）。
 * 予約を控えて、前日のお知らせも送る（lib/marketing/line-reservation-server.ts。2026-11-05 院長の依頼）
 *
 * キャンセル（kind: 'cancel'）のときは、返事のあとで「空いた枠をInstagramのストーリーで知らせる」も行う
 * （院長の設定がオンのときだけ。lib/marketing/cancel-story-server.ts。患者さんの情報はストーリーに使わない）
 *
 * セキュリティ:
 * - RESERVATION_NOTIFY_SECRET（共有シークレット）で保護。未設定時は503
 * - 患者宛の宛先は【必ず】署名付きticket/sealedから復元する。生のuserIdは受け付けない
 *   （生受付だと他人のIDを指定して公式アカウント名義で通知を送れてしまうため）
 * - 本文に載せる氏名は改行・制御文字を除去し長さを制限（メッセージ偽装の防止）
 * - LINEプッシュには既存の LINE_CHANNEL_ACCESS_TOKEN を使う（トークンはVercelに集約）
 */
import { after, NextRequest, NextResponse } from 'next/server'
import { readTicket, sealUserId, unsealUserId } from '@/lib/liff-ticket'
import { getRule, markSent, recordRun, sentToday, wasSent } from '@/lib/marketing/automation-store-server'
import { TEST_SAMPLES_PER_DAY, type AutomationKey } from '@/lib/marketing/automation-types'
import { checkConsent, lineMark } from '@/lib/marketing/consent-store-server'
import { CONSENT_KEYWORDS, inSendHours } from '@/lib/marketing/consent'
import { LIFF_RESERVE_URL } from '@/lib/marketing/clinic'
import { patientConfirmText, patientRemindText } from '@/lib/reservation-message'
import { reservationChangeUrl } from '@/lib/reservation-change-link'

export const dynamic = 'force-dynamic'
// キャンセルのストーリー（予約システムへの返事のあとで、空きの取り直し→画像→Instagramへの公開まで）に使う時間
export const maxDuration = 120

type NotifyBody = {
  kind?: 'new' | 'cancel' | 'change' | 'reminder' | 'confirm-linked' | 'remind-linked' | PatientKind
  /** kind:'remind-linked' 用：明日の予約（予約番号・お名前・電話・時刻） */
  rows?: unknown
  /** patient-confirm用：LIFF検証済みの短命チケット */
  ticket?: string
  /** patient-cancel用：予約行に保存された長期参照 */
  sealed?: string
  reservationNo?: string
  name?: string
  kana?: string
  phone?: string
  menu?: string
  date?: string
  time?: string
  /** kind:'change' 用：変更前の日時 */
  prevDate?: string
  prevTime?: string
  symptom?: string
  /** 予約の区分（初診・再診 など。予約システムが送ってきたときだけ。カルテの自動登録で初回来院の日に使う） */
  kubun?: string
  /** kind:'reminder' 用。指定時はこの本文をそのまま送る（GAS側で整形済みの前提） */
  text?: string
}

const PATIENT_KINDS = ['patient-confirm', 'patient-cancel', 'patient-remind', 'patient-waitlist'] as const
type PatientKind = (typeof PATIENT_KINDS)[number]

/** 患者宛の通知 → 自動化設定のどれに従うか */
const PATIENT_AUTOMATION: Record<PatientKind, AutomationKey> = {
  'patient-confirm': 'reservation_confirm',
  'patient-cancel': 'reservation_confirm',
  'patient-remind': 'reservation_remind',
  'patient-waitlist': 'waitlist_notify',
}

/** 動いた記録に残す「何のときか」（個人の情報は入れない） */
const PATIENT_NOTE: Record<PatientKind, string> = {
  'patient-confirm': '予約の確定',
  'patient-cancel': 'キャンセルの確認',
  'patient-remind': '前日のお知らせ',
  'patient-waitlist': 'キャンセル待ちの空き枠',
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const TIME_RE = /^\d{2}:\d{2}$/

function authorized(request: NextRequest): boolean {
  const secret = process.env.RESERVATION_NOTIFY_SECRET
  if (!secret) return false
  const header = request.headers.get('x-reservation-secret') ?? ''
  return header === secret
}

/** 患者名など、外部入力を本文へ埋める前の無害化（改行・制御文字除去＋長さ制限） */
function safeName(value?: string): string {
  return String(value ?? '')
    // 改行・制御文字・行区切りを除去（メッセージ本文の偽装を防ぐ）
    .replace(/[\p{Cc}\p{Zl}\p{Zp}]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 40)
}

/** 'yyyy-MM-dd' を「M月D日（曜）」へ。形式外はそのまま返す */
function formatDateJa(dateString?: string): string {
  if (!dateString || !/^\d{4}-\d{2}-\d{2}$/.test(dateString)) return dateString ?? ''
  const [year, month, day] = dateString.split('-').map(Number)
  const youbi = ['日', '月', '火', '水', '木', '金', '土'][new Date(year, month - 1, day).getDay()]
  return `${month}月${day}日（${youbi}）`
}

/** 院長宛の通知本文（一目で分かる形式） */
function buildMessage(b: NotifyBody): string {
  // リマインド等、GAS側で整形済みの本文はそのまま送る
  if (b.text) return b.text
  const head =
    b.kind === 'cancel' ? '❌ 予約キャンセル' : b.kind === 'change' ? '🔁 患者さんが予約の日時を変更しました' : '🗓 新規予約が入りました'
  const lines = [
    head,
    '',
    b.name ? `氏名：${b.name}${b.kana ? `（${b.kana}）` : ''}` : undefined,
    b.date || b.time ? `${b.kind === 'change' ? '新しい日時' : '日時'}：${b.date ?? ''} ${b.time ?? ''}`.trim() : undefined,
    b.kind === 'change' && (b.prevDate || b.prevTime) ? `変更前：${b.prevDate ?? ''} ${b.prevTime ?? ''}`.trim() : undefined,
    b.menu ? `メニュー：${b.menu}` : undefined,
    b.phone ? `電話：${b.phone}` : undefined,
    b.reservationNo ? `予約番号：${b.reservationNo}` : undefined,
    b.symptom ? `症状・ご要望：${b.symptom}` : undefined,
  ].filter((x): x is string => Boolean(x))
  return lines.join('\n')
}

/** 患者宛の通知本文（予約完了・キャンセル確認） */
function buildPatientMessage(b: NotifyBody): string {
  const name = safeName(b.name)
  const reservationNo = /^[A-Za-z0-9]{1,12}$/.test(String(b.reservationNo ?? ''))
    ? String(b.reservationNo)
    : ''
  const when = `${formatDateJa(b.date)} ${String(b.time ?? '').slice(0, 5)}`.trim()

  // 日時の変更・キャンセルを入力なしで開けるリンク（予約番号の形が違う・鍵が無いときは ''＝今までどおりの文面）
  const changeUrl = reservationChangeUrl(b.reservationNo)
  if (b.kind === 'patient-remind') {
    // 文面は院内アプリからの前日のお知らせ（LINE連携の方）と共通（lib/reservation-message.ts）
    return patientRemindText({ name: b.name, date: b.date, time: b.time, reservationNo: b.reservationNo, changeUrl })
  }
  if (b.kind === 'patient-waitlist') {
    return [
      name ? `${name} 様` : undefined,
      name ? '' : undefined,
      'ゆうき整骨院です。キャンセル待ちにご登録の日に、空きが出ました。',
      '',
      `📅 空いた枠：${when}〜`,
      '',
      '先着順のため、このご連絡はご予約の確定ではありません。',
      'ご希望の場合は、こちら（またはメニューの「ネット予約」）からお手続きください。',
      LIFF_RESERVE_URL,
      '',
      `※キャンセル待ちのご案内が不要な方は「${CONSENT_KEYWORDS.stopReservation}」と送ってください。`,
    ]
      .filter((x): x is string => x !== undefined)
      .join('\n')
  }
  if (b.kind === 'patient-cancel') {
    return [
      `${name} 様`,
      '',
      'ゆうき整骨院です。以下のご予約のキャンセルを承りました。',
      '',
      `📅 日時：${when}`,
      reservationNo ? `予約番号：${reservationNo}` : undefined,
      '',
      'またのご利用をお待ちしております。',
      'ご予約はメニューの「ネット予約」からいつでもどうぞ😊',
    ]
      .filter((x): x is string => x !== undefined)
      .join('\n')
  }
  // 予約の確定：文面は院内アプリからの確定のお知らせ（LINE連携の方）と共通（lib/reservation-message.ts）
  return patientConfirmText({ name: b.name, date: b.date, time: b.time, reservationNo: b.reservationNo, changeUrl })
}

export async function POST(request: NextRequest) {
  const secret = process.env.RESERVATION_NOTIFY_SECRET
  if (!secret) {
    return NextResponse.json({ error: 'not configured' }, { status: 503 })
  }
  if (!authorized(request)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  let body: NotifyBody
  try {
    body = (await request.json()) as NotifyBody
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 })
  }

  // LINE 連携の方への確定・前日のお知らせ（予約システム v3.27〜）。院長の LINE には知らせない
  if (body.kind === 'confirm-linked') {
    const { confirmClinicReservation } = await import('@/lib/marketing/line-reservation-server')
    const r = await confirmClinicReservation({ reservationNo: body.reservationNo, name: body.name, phone: body.phone, date: body.date, time: body.time })
    console.log('[line-reservation] 院で登録した予約の確定:', r.note)
    return NextResponse.json({ ok: true, linked: r.linked, delivered: r.delivered, result: r.result })
  }
  if (body.kind === 'remind-linked') {
    const rows = Array.isArray(body.rows) ? (body.rows as Array<Record<string, unknown>>) : null
    if (!DATE_RE.test(String(body.date ?? '')) || !rows) {
      return NextResponse.json({ ok: false, error: 'date（YYYY-MM-DD）と rows が要ります' }, { status: 400 })
    }
    const { remindLinkedReservations } = await import('@/lib/marketing/line-reservation-server')
    const results = await remindLinkedReservations({
      date: String(body.date),
      rows: rows
        .filter((r) => r && typeof r === 'object')
        .map((r) => ({ reservationNo: String(r.reservationNo ?? ''), name: String(r.name ?? ''), phone: String(r.phone ?? ''), time: String(r.time ?? '') })),
    })
    const delivered = results.filter((r) => r.delivered).length
    console.log('[line-reservation] 前日のお知らせ（LINE連携の方）:', `${rows.length}件中 連携 ${results.filter((r) => r.linked).length}・届いた ${delivered}`)
    // お名前・宛先は返さない（予約番号と結果だけ）
    return NextResponse.json({
      ok: true,
      results: results.map((r) => ({ reservationNo: r.reservationNo, linked: r.linked, delivered: r.delivered, optedOut: r.optedOut, result: r.result })),
    })
  }

  // キャンセル：空いた枠をストーリーで知らせる（予約システムへの返事を待たせないよう、返事のあとで行う。
  // 日時だけを渡す。お名前・電話などは渡さない）
  // 新しい予約：カルテから LINE 連携した方へ「確定しました」（予約システムへの返事を待たせないよう、返事のあとで）
  if (body.kind === 'new') {
    // カルテが無い方のカルテを、予約のお名前・ふりがな・電話で自動で作る（2026-11-19 院長の依頼。
    // lib/karte/auto-register-server.ts。今あるカルテは書きかえない。お名前などは記録に出さない）
    const person = {
      reservationNo: body.reservationNo,
      name: body.name,
      kana: body.kana,
      phone: body.phone,
      date: body.date,
      time: body.time,
      menu: body.menu,
      symptom: body.symptom,
      kubun: body.kubun,
    }
    after(async () => {
      try {
        const { registerPatientFromReservation } = await import('@/lib/karte/auto-register-server')
        const r = await registerPatientFromReservation(person)
        console.log('[karte-auto-register]', r.kind === 'created' ? 'カルテを作りました' : r.kind === 'exists' ? 'カルテがある方' : `作りません（${r.reason}）`)
      } catch (error) {
        console.error('[karte-auto-register] 失敗しました', error instanceof Error ? error.message : String(error))
      }
    })
    const rsv = { reservationNo: body.reservationNo, name: body.name, phone: body.phone, date: body.date, time: body.time }
    after(async () => {
      try {
        const { onNewReservation } = await import('@/lib/marketing/line-reservation-server')
        console.log('[line-reservation] 予約の確定:', await onNewReservation(rsv))
      } catch (error) {
        console.error('[line-reservation] 失敗しました', error)
      }
    })
  }

  // 日時の変更：ご本人のLINEへ「日時を変更しました」・前日のお知らせの控えを新しい日時に（予約システムの画面に
  // 「LINEに確認をお送りしました」と出すため、返事の前に行う。予約のロックは放してから呼ばれるので、待たせてよい）
  let patientDelivered: boolean | undefined
  if (body.kind === 'change') {
    if (!/^[A-Za-z0-9]{1,12}$/.test(String(body.reservationNo ?? '')) || !DATE_RE.test(String(body.date ?? '')) || !TIME_RE.test(String(body.time ?? '').slice(0, 5))) {
      return NextResponse.json({ ok: false, delivered: false, error: 'reservationNo・date（YYYY-MM-DD）・time（HH:MM）が要ります' }, { status: 400 })
    }
    patientDelivered = false
    try {
      const { onChangeReservation } = await import('@/lib/marketing/line-reservation-server')
      const r = await onChangeReservation({
        reservationNo: body.reservationNo,
        name: body.name,
        phone: body.phone,
        date: body.date,
        time: body.time,
        prevDate: body.prevDate,
        prevTime: body.prevTime,
        sealed: body.sealed,
      })
      patientDelivered = r.delivered
      console.log('[line-reservation] 日時の変更:', r.note)
    } catch (error) {
      console.error('[line-reservation] 日時の変更を反映できませんでした', error)
    }
  }

  if (body.kind === 'cancel') {
    const notice = { date: body.date, time: body.time }
    const cancelledNo = body.reservationNo
    after(async () => {
      try {
        const { onCancelReservation } = await import('@/lib/marketing/line-reservation-server')
        await onCancelReservation(cancelledNo)
      } catch (error) {
        console.error('[line-reservation] キャンセルの控えを消せませんでした', error)
      }
    })
    after(async () => {
      try {
        const { handleCancelStory } = await import('@/lib/marketing/cancel-story-server')
        const r = await handleCancelStory(notice)
        if (r.plan.action === 'skip') console.log('[cancel-story] 出しません:', r.plan.reason)
      } catch (error) {
        console.error('[cancel-story] 失敗しました', error)
      }
    })
  }

  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN
  const patientKind = PATIENT_KINDS.find((k) => k === body.kind)
  const isPatientPush = Boolean(patientKind)

  let to: string | undefined
  let text: string
  let sealed: string | undefined
  /** 自動化設定が「テスト」で、院長の LINE に見本を送るとき */
  let testRun = false
  const automation: AutomationKey = patientKind ? PATIENT_AUTOMATION[patientKind] : 'reservation_confirm'
  const patientNote = patientKind ? PATIENT_NOTE[patientKind] : ''
  /** 送れたら残す「送り済み」の印（前日のお知らせ・空き枠のお知らせ） */
  let sentMark: { day: string; mark: string } | undefined

  if (patientKind) {
    // 前日のお知らせ・空き枠のお知らせ（本人のお手続きへの返事ではなく、院から知らせるもの）
    const isNotice = patientKind === 'patient-remind' || patientKind === 'patient-waitlist'
    const day = String(body.date ?? '')
    const hhmm = String(body.time ?? '').slice(0, 5)
    if (isNotice && (!DATE_RE.test(day) || !TIME_RE.test(hhmm))) {
      return NextResponse.json({ ok: false, delivered: false, error: 'date（YYYY-MM-DD）と time（HH:MM）が要ります' }, { status: 400 })
    }
    // 患者宛：宛先は必ず署名付きticket/sealedから復元する（生のuserIdは受け付けない）
    // patient-confirm は ticket（LIFF予約）優先。無ければ sealed（管理画面からの手動登録）
    const userId =
      body.kind === 'patient-confirm'
        ? (readTicket(String(body.ticket ?? ''), secret) ??
           unsealUserId(String(body.sealed ?? ''), secret))
        : unsealUserId(String(body.sealed ?? ''), secret)
    if (!userId) {
      return NextResponse.json(
        { ok: false, delivered: false, error: 'invalid or expired ticket' },
        { status: 400 },
      )
    }
    to = userId
    text = buildPatientMessage(body)
    // 予約確定時は、以後のキャンセル通知に使う長期参照をGASへ返す
    if (body.kind === 'patient-confirm') {
      sealed = sealUserId(userId, secret)
    }

    // 集客 → 自動化設定（止める／テスト／動かす・1日の上限）。
    // 止めている・上限のときも sealed は返す（あとで動かしたとき、キャンセルの確認を送れるように）
    const rule = await getRule(automation)

    if (isNotice) {
      // 本人が止めていないか（読めないときは送らない。予約システムはメールに切り替える／あとで送り直す）
      const consent = await checkConsent(userId, 'reservation')
      if (consent !== 'allowed') {
        await recordRun({
          automation,
          result: consent === 'opted_out' ? 'opted_out' : 'error',
          note: consent === 'opted_out' ? patientNote : `${patientNote}（受け取りの記録を読めない）`,
        })
        return NextResponse.json({
          ok: true,
          delivered: false,
          optedOut: consent === 'opted_out' || undefined,
          reason: consent === 'opted_out' ? 'ご本人が予約のお知らせを止めています' : '受け取りの記録を読めないため送っていません',
        })
      }
      // 空き枠のお知らせは、送ってよい時間帯だけ（時間外は予約システムがあとで送り直す）
      if (patientKind === 'patient-waitlist' && !inSendHours(new Date(), rule.fromHour, rule.toHour)) {
        await recordRun({ automation, result: 'deferred', note: patientNote })
        return NextResponse.json({
          ok: true,
          delivered: false,
          deferred: true,
          reason: `送る時間外です（${rule.fromHour}時〜${rule.toHour}時）`,
        })
      }
    }

    if (rule.mode === 'off') {
      await recordRun({ automation, result: 'skipped', note: patientNote })
      return NextResponse.json({ ok: true, delivered: false, reason: '自動化設定で止めています', sealed })
    }

    // カルテから LINE 連携した方へ、こちらから先に同じ予約の「確定しました」を送っていたら二重に送らない
    if (body.kind === 'patient-confirm' && rule.mode !== 'test') {
      const { confirmSentFor } = await import('@/lib/marketing/line-reservation-server')
      if (await confirmSentFor(body.reservationNo, body.date, body.time).catch(() => false)) {
        await recordRun({ automation, result: 'duplicate', note: patientNote })
        return NextResponse.json({ ok: true, delivered: true, duplicate: true, reason: '同じお知らせは送り済みです', sealed })
      }
    }

    if (isNotice) {
      // 同じお知らせを二度送らない（印は LINE の ID のハッシュ・時刻・予約番号だけ）
      const reservationNo = /^[A-Za-z0-9]{1,12}$/.test(String(body.reservationNo ?? '')) ? String(body.reservationNo) : ''
      const mark = [patientKind, rule.mode === 'test' ? 'test' : 'live', lineMark(userId), hhmm, reservationNo].join('|')
      if (await wasSent(day, mark)) {
        await recordRun({ automation, result: 'duplicate', note: patientNote })
        return NextResponse.json({
          ok: true,
          delivered: rule.mode !== 'test',
          test: rule.mode === 'test' || undefined,
          duplicate: true,
          reason: '同じお知らせは送り済みです',
        })
      }
      sentMark = { day, mark }
    }

    if (rule.mode === 'test') {
      // テスト：患者さんには送らず、同じ文を院長の LINE にだけ送る
      const owner = process.env.RESERVATION_NOTIFY_LINE_USER_ID
      if (!owner) {
        await recordRun({ automation, result: 'skipped', note: `${patientNote}（テストの送り先が未設定）` })
        return NextResponse.json({ ok: true, delivered: false, test: true, reason: 'テスト中（院長の送り先が未設定）', sealed })
      }
      // 見本は1日に数通まで（予約が多い日に何十通も届かないように）
      if ((await sentToday(automation, 'test')) >= TEST_SAMPLES_PER_DAY) {
        await recordRun({ automation, result: 'limited', note: `${patientNote}（テストの見本は1日${TEST_SAMPLES_PER_DAY}通まで）` })
        return NextResponse.json({
          ok: true,
          delivered: false,
          test: true,
          reason: `テスト中（今日の見本は${TEST_SAMPLES_PER_DAY}通送りました）`,
          sealed,
        })
      }
      to = owner
      text = `【テスト】患者さんにはまだ送っていません。「動かす」にすると、次の文が患者さんの LINE に届きます。\n\n${text}`
      testRun = true
    } else if (rule.dailyLimit && (await sentToday(automation)) >= rule.dailyLimit) {
      await recordRun({ automation, result: 'limited', note: patientNote })
      return NextResponse.json({ ok: true, delivered: false, reason: '1日の上限に達したため送っていません', sealed })
    }
  } else {
    // 院長宛（従来動作）
    to = process.env.RESERVATION_NOTIFY_LINE_USER_ID
    text = buildMessage(body)
  }

  // 送信先未設定・トークン未設定でも、予約自体は成功させたいので 200 で握る（設定を段階的に進められる）
  if (!token || !to) {
    return NextResponse.json({ ok: true, delivered: false, reason: '送信先またはトークン未設定', patientDelivered })
  }

  try {
    // LINE_API_BASE_URL は動作確認用（ふだんは設定しない）
    const res = await fetch(`${(process.env.LINE_API_BASE_URL ?? 'https://api.line.me').replace(/\/$/, '')}/v2/bot/message/push`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ to, messages: [{ type: 'text', text }] }),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      if (isPatientPush) await recordRun({ automation, result: 'error', note: patientNote })
      return NextResponse.json(
        { ok: false, delivered: false, error: (data as { message?: string }).message ?? `HTTP ${res.status}`, patientDelivered },
        { status: 502 },
      )
    }
    if (isPatientPush) await recordRun({ automation, result: testRun ? 'test' : 'sent', note: patientNote })
    if (sentMark) await markSent(sentMark.day, sentMark.mark)
    // 予約システムが本人へ「確定しました」を送った → カルテ連携の方への自動の確定を二重に送らない
    if (patientKind === 'patient-confirm' && !testRun && to) {
      const { markConfirmSent } = await import('@/lib/marketing/line-reservation-server')
      await markConfirmSent({ reservationNo: body.reservationNo, date: body.date, time: body.time, userId: to }).catch(() => {})
    }
    return NextResponse.json({ ok: true, delivered: !testRun, test: testRun || undefined, sealed, patientDelivered })
  } catch (error) {
    if (isPatientPush) await recordRun({ automation, result: 'error', note: patientNote })
    return NextResponse.json(
      { ok: false, delivered: false, error: error instanceof Error ? error.message : '不明' },
      { status: 502 },
    )
  }
}
