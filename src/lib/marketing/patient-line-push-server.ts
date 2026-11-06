/**
 * 患者さんの LINE へ1通送る（サーバー専用）。集客 → 自動化設定の決まりに従う
 *
 * - 止める … 送らない
 * - テスト … 患者さんには送らず、院長の LINE に見本（1日 TEST_SAMPLES_PER_DAY 通まで）
 * - 動かす … 送る（1日の上限まで）
 * - requireConsent … 本人が「予約のお知らせ停止」と送っていたら送らない（前日のお知らせ・空き枠のお知らせ）
 * - dedupe … 同じお知らせは二度送らない（予約システムから送るものと同じ印を使うので、どちらから送っても1通）
 * 動いた記録（個人の情報なし）を残す。予約の通知（reservation-notify）と同じ考え方。
 */
import { markSent, recordRun, getRule, sentToday, wasSent } from './automation-store-server'
import { TEST_SAMPLES_PER_DAY, type AutomationKey, type RunResult } from './automation-types'
import { checkConsent } from './consent-store-server'

export interface PushResult {
  /** 患者さんに届いた（テストの見本は false） */
  delivered: boolean
  result: RunResult
  reason?: string
}

// LINE_API_BASE_URL は動作確認用（ふだんは設定しない）
const pushUrl = () => `${(process.env.LINE_API_BASE_URL ?? 'https://api.line.me').replace(/\/$/, '')}/v2/bot/message/push`

async function push(to: string, text: string): Promise<{ ok: boolean; error?: string }> {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN
  if (!token) return { ok: false, error: 'LINEの設定がありません' }
  try {
    const res = await fetch(pushUrl(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ to, messages: [{ type: 'text', text }] }),
      signal: AbortSignal.timeout(20_000),
    })
    if (!res.ok) return { ok: false, error: `HTTP ${res.status} ${(await res.text().catch(() => '')).slice(0, 200)}` }
    return { ok: true }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) }
  }
}

/** dedupe.mark の先頭の「live」を、テストのときは「test」にした印（予約システム側と同じ作り） */
export function dedupeMark(parts: { kind: string; userMark: string; time: string; reservationNo: string }, test: boolean): string {
  // 予約番号は予約システム側と同じく、英数字12文字までのときだけ入れる（それ以外は空）
  const no = /^[A-Za-z0-9]{1,12}$/.test(parts.reservationNo) ? parts.reservationNo : ''
  return [parts.kind, test ? 'test' : 'live', parts.userMark, parts.time, no].join('|')
}

export async function pushToPatient(opts: {
  automation: AutomationKey
  userId: string
  text: string
  /** 動いた記録に残す「何のときか」（個人の情報は入れない） */
  note: string
  requireConsent?: boolean
  /** day（予約の日）と、テスト／本番の印を作る関数 */
  dedupe?: { day: string; mark: (test: boolean) => string }
}): Promise<PushResult> {
  const { automation, userId, note } = opts
  const rule = await getRule(automation)

  if (opts.requireConsent) {
    const consent = await checkConsent(userId, 'reservation')
    if (consent !== 'allowed') {
      const result: RunResult = consent === 'opted_out' ? 'opted_out' : 'error'
      await recordRun({ automation, result, note: consent === 'opted_out' ? note : `${note}（受け取りの記録を読めない）` })
      return { delivered: false, result, reason: consent === 'opted_out' ? 'ご本人が予約のお知らせを止めています' : '受け取りの記録を読めません' }
    }
  }
  if (rule.mode === 'off') {
    await recordRun({ automation, result: 'skipped', note })
    return { delivered: false, result: 'skipped', reason: '自動化設定で止めています' }
  }
  const test = rule.mode === 'test'
  const mark = opts.dedupe ? opts.dedupe.mark(test) : ''
  if (opts.dedupe && (await wasSent(opts.dedupe.day, mark))) {
    await recordRun({ automation, result: 'duplicate', note })
    return { delivered: !test, result: 'duplicate', reason: '同じお知らせは送り済みです' }
  }

  let to = userId
  let text = opts.text
  if (test) {
    const owner = process.env.RESERVATION_NOTIFY_LINE_USER_ID
    if (!owner) {
      await recordRun({ automation, result: 'skipped', note: `${note}（テストの送り先が未設定）` })
      return { delivered: false, result: 'skipped', reason: 'テスト中（院長の送り先が未設定）' }
    }
    if ((await sentToday(automation, 'test')) >= TEST_SAMPLES_PER_DAY) {
      await recordRun({ automation, result: 'limited', note: `${note}（テストの見本は1日${TEST_SAMPLES_PER_DAY}通まで）` })
      return { delivered: false, result: 'limited', reason: `テスト中（今日の見本は${TEST_SAMPLES_PER_DAY}通送りました）` }
    }
    to = owner
    text = `【テスト】患者さんにはまだ送っていません。「動かす」にすると、次の文が患者さんの LINE に届きます。\n\n${text}`
  } else if (rule.dailyLimit && (await sentToday(automation)) >= rule.dailyLimit) {
    await recordRun({ automation, result: 'limited', note })
    return { delivered: false, result: 'limited', reason: '1日の上限に達したため送っていません' }
  }

  const r = await push(to, text)
  if (!r.ok) {
    await recordRun({ automation, result: 'error', note })
    return { delivered: false, result: 'error', reason: r.error }
  }
  await recordRun({ automation, result: test ? 'test' : 'sent', note })
  if (opts.dedupe) await markSent(opts.dedupe.day, mark)
  return { delivered: !test, result: test ? 'test' : 'sent' }
}
