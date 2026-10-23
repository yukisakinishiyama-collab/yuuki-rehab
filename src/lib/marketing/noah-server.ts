/**
 * NOAH の日別集計（サーバー専用）
 *
 *   fetchNoahStats()    … 予約システム（GAS）の ?api=noahstats から、確認済みの月ごとの集計を受け取る
 *   refreshNoahStore()  … 受け取った集計をハブに保存（月ごとに新しい方で置きかえ）
 *   runNoahNightly()    … 毎晩（21時以降・15分ごとに呼ばれる）その日の集計が届いたら、
 *                         院長LINEへ「今日のまとめ＋次の一手」を1通。空きが多い翌診療日には
 *                         Googleの「空き状況」投稿の下書きを1本（承認するまで投稿しない）
 *
 * 保存先（KV）:
 *   noah:store              … 月ごとの集計（数字だけ。個人情報なし）
 *   noah:nightly:YYYY-MM-DD … その夜のLINEを送ったかの記録（二重送信を防ぐ）
 *   noah:lock:YYYY-MM-DD    … 同時に2回動いたときの二重送信よけ
 */
import { createHmac } from 'node:crypto'
import { SITE_URL } from '@/lib/site/seo'
import { PDCA_KV_KEY, pdcaReminder, type PdcaItem } from './pdca'
import { RESERVE_URL } from './clinic'
import { kvGet, kvSet } from './kv-store-server'
import { fetchHubStats } from './booking-stats'
import { notifyOwner, ownerCard } from './owner-notify'
import { jstParts } from './autopilot-planner'
import { AUTOPILOT_URL, addNextDayAvailabilityDraft } from './autopilot-server'
import {
  dateLabel,
  mergeMonths,
  missingText,
  nextOpenDay,
  nightlyText,
  people,
  pickDraftDay,
  suggestions,
  summarize,
  weekdayAverages,
} from './noah-analysis'
import { NOAH_COLS, type NoahFileError, type NoahMonth, type NoahNightlyMark, type NoahStore } from './noah-types'

export const SALES_URL = `${SITE_URL}/marketing/sales`
const STORE_KEY = 'noah:store'
const MARK_KEY = (date: string) => `noah:nightly:${date}`
const LOCK_KEY = (date: string) => `noah:lock:${date}`
/** この時刻（日本時間）以降に、その日の集計が届いていればまとめを送る */
export const NIGHTLY_FROM_HOUR = 21
/** この時刻を過ぎても届いていなければ「届いていません」を1回だけ送る */
export const MISSING_AFTER_HOUR = 23
const LOCK_MS = 3 * 60 * 1000

interface NoahStatsResponse {
  ok?: boolean
  error?: string
  folderFound?: boolean
  months?: NoahMonth[]
  errors?: NoahFileError[]
  latest?: NoahStore['latest']
}

const isCount = (n: unknown) => typeof n === 'number' && Number.isInteger(n) && n >= 0

/** 受け取った月の形を確かめる（予約システム側でも確認済み。ここでは表示が崩れないための最低限） */
function sanitizeMonth(m: NoahMonth): NoahMonth | null {
  if (!m || !/^\d{4}-\d{2}$/.test(String(m.month)) || !/^\d{4}-\d{2}-\d{2}$/.test(String(m.asOf))) return null
  if (!Array.isArray(m.days) || !m.days.every((r) => Array.isArray(r) && r.length === NOAH_COLS.length && r.every(isCount))) {
    return null
  }
  const items = (list: unknown) =>
    Array.isArray(list)
      ? (list as unknown[])
          .filter((r): r is [string, number, number, number] => Array.isArray(r) && typeof r[0] === 'string' && r.slice(1, 4).every(isCount))
          .map((r) => [r[0].slice(0, 60), r[1], r[2], r[3]] as [string, number, number, number])
      : []
  return {
    month: m.month,
    asOf: m.asOf,
    exportedAt: String(m.exportedAt ?? ''),
    savedAt: m.savedAt ? String(m.savedAt) : undefined,
    file: m.file ? String(m.file).slice(0, 80) : undefined,
    days: m.days,
    total: Array.isArray(m.total) ? m.total : [],
    self: items(m.self),
    goods: items(m.goods),
    rank: Array.isArray(m.rank)
      ? m.rank.filter((r) => Array.isArray(r) && /^\d{4}-\d{2}$/.test(String(r[0])) && isCount(r[1]) && isCount(r[2]))
      : [],
    repeat: m.repeat && typeof m.repeat === 'object' ? m.repeat : undefined,
  }
}

/** 予約システムから受け取る（未設定・未対応・通信失敗は null） */
export async function fetchNoahStats(months = 13): Promise<NoahStatsResponse | null> {
  const secret = process.env.RESERVATION_NOTIFY_SECRET
  if (!secret || process.env.MARKETING_MODE === 'mock') return null
  const ts = String(Date.now())
  const sig = createHmac('sha256', secret).update(`noahstats:${ts}`).digest('hex')
  const span = Math.min(Math.max(Math.floor(months), 1), 36)
  try {
    const res = await fetch(`${RESERVE_URL}?api=noahstats&ts=${ts}&sig=${sig}&months=${span}`, {
      redirect: 'follow',
      cache: 'no-store',
      signal: AbortSignal.timeout(25_000),
    })
    const data = (await res.json().catch(() => null)) as NoahStatsResponse | null
    if (!data || data.ok !== true || !Array.isArray(data.months)) return data && data.ok === false ? data : null
    return data
  } catch {
    return null
  }
}

export async function getNoahStore(): Promise<NoahStore | null> {
  return kvGet<NoahStore>(STORE_KEY)
}

/** 予約システムから取り直して保存。取れなければ保存済みのものを返す */
export async function refreshNoahStore(): Promise<{ store: NoahStore | null; fetched: boolean; error?: string }> {
  const existing = await getNoahStore()
  const data = await fetchNoahStats()
  if (!data || data.ok !== true || !Array.isArray(data.months)) {
    const error = data?.error
      ? `予約システムからの返事: ${data.error}`
      : '予約システムから集計を受け取れませんでした（予約システムが未更新、または通信の失敗）'
    return { store: existing, fetched: false, error }
  }
  const incoming = data.months.map(sanitizeMonth).filter((m): m is NoahMonth => m !== null)
  const store: NoahStore = {
    months: mergeMonths(existing?.months ?? [], incoming),
    latest: data.latest ?? existing?.latest ?? null,
    errors: Array.isArray(data.errors) ? data.errors.slice(0, 10) : [],
    folderFound: data.folderFound !== false,
    fetchedAt: new Date().toISOString(),
  }
  await kvSet(STORE_KEY, store)
  return { store, fetched: true }
}

export interface NightlyResult {
  status: 'skip' | 'waiting' | 'done' | 'sent' | 'missing' | 'dry'
  reason?: string
  delivered?: boolean
  text?: string
  draft?: { made: boolean; week?: string; itemId?: string; reason?: string }
}

/**
 * 毎晩のまとめ。
 * - force … 時刻・曜日・送信済みを気にせず送り直す（管理者の手動実行用）
 * - dry   … 文面を作って返すだけ（LINE・下書き・記録はしない）
 */
export async function runNoahNightly(
  now = new Date(),
  options: { force?: boolean; dry?: boolean } = {},
): Promise<NightlyResult> {
  const { force = false, dry = false } = options
  const jst = jstParts(now)
  const date = jst.date
  if (!force && !dry) {
    if (jst.weekday === 0) return { status: 'skip', reason: '日曜（休診）' }
    if (jst.hour < NIGHTLY_FROM_HOUR) return { status: 'skip', reason: `${NIGHTLY_FROM_HOUR}時より前` }
  }
  // まとめを送った夜は終わり（「届いていません」を送ったあとに届いた場合は、まとめを送る）
  const mark = await kvGet<NoahNightlyMark>(MARK_KEY(date))
  if (!force && !dry && mark?.kind === 'summary') return { status: 'done' }

  const { store, error } = await refreshNoahStore()
  const months = store?.months ?? []
  const fresh = months[0]?.asOf === date

  if (!fresh) {
    if (dry) return { status: 'dry', reason: '今日の集計はまだ届いていません', text: missingText(date, error) }
    if (!force && jst.hour < MISSING_AFTER_HOUR) return { status: 'waiting', reason: error ?? '今日の集計待ち' }
    if (!force && mark) return { status: 'done' }
    const stats = await fetchHubStats(1)
    const opening = stats?.openings.find((d) => d.date === date)
    if (opening?.closed && !force) {
      await kvSet(MARK_KEY(date), { date, kind: 'missing', sentAt: new Date().toISOString(), delivered: false, reason: '休診日' })
      return { status: 'skip', reason: '休診日' }
    }
    if (!(await takeLock(date))) return { status: 'done', reason: 'ほかの実行が処理中' }
    const recent = store?.errors?.[0]
    const detail = recent
      ? `（集計ファイル「${recent.file}」を確認できませんでした：${recent.message}）`
      : error
    const result = await notifyOwner([
      ownerCard('NOAHの集計が届いていません', missingText(date, detail), [{ label: 'グラフを開く', uri: SALES_URL }]),
    ])
    await kvSet(MARK_KEY(date), {
      date,
      kind: 'missing',
      sentAt: new Date().toISOString(),
      delivered: result.delivered,
      reason: result.reason,
    } satisfies NoahNightlyMark)
    return { status: 'missing', delivered: result.delivered, reason: result.reason }
  }

  const summary = summarize(months)
  if (!summary) return { status: 'skip', reason: '集計が空です' }
  // 来院の記録が無い日（祝日・臨時休診など）は送らない（LINEの通数を使わない）
  if (!dry && !force && (!summary.today || summary.today.visits === 0)) {
    await kvSet(MARK_KEY(date), {
      date,
      kind: 'summary',
      sentAt: new Date().toISOString(),
      delivered: false,
      reason: '来院の記録なし（休診日）',
    } satisfies NoahNightlyMark)
    return { status: 'skip', reason: '来院の記録なし（休診日）' }
  }
  const stats = await fetchHubStats(1)
  const openings = stats?.openings ?? []
  const next = nextOpenDay(openings, date)
  const draftDay = pickDraftDay(openings, date)

  if (!dry && !(await takeLock(date))) return { status: 'done', reason: 'ほかの実行が処理中' }
  let draft: NightlyResult['draft'] = { made: false }
  if (draftDay && !dry) {
    try {
      draft = await addNextDayAvailabilityDraft(draftDay, now)
    } catch (e) {
      draft = { made: false, reason: e instanceof Error ? e.message : '下書きを作れませんでした' }
    }
  }
  const draftMade = dry ? Boolean(draftDay) : draft.made
  const tips = suggestions(summary, {
    draftDay,
    draftMade,
    weekly: jst.weekday === 6,
    weekdays: weekdayAverages(months, date),
  })
  // PDCA（施策）で手をつけたいこと（振り返りの時期・まもなく終わる・記録が止まっている）
  const pdca = await kvGet<{ items?: PdcaItem[] }>(PDCA_KV_KEY).catch(() => null)
  const pdcaLines = Array.isArray(pdca?.items) ? pdcaReminder(pdca.items, date) : []
  const base = nightlyText(summary, { next, draftDay, draftMade, tips })
  const text = pdcaLines.length ? `${base}\n\n【PDCA】\n${pdcaLines.map((l) => `・${l}`).join('\n')}` : base
  if (dry) return { status: 'dry', text, draft: { made: false, reason: draftDay ? '（試しの実行のため作っていません）' : undefined } }

  const visits = summary.today?.visits ?? 0
  const buttons = [{ label: 'グラフを見る', uri: SALES_URL, primary: true }]
  if (draft.made && draft.week) buttons.push({ label: '下書きを確認', uri: `${AUTOPILOT_URL}?week=${draft.week}`, primary: false })
  if (pdcaLines.length) buttons.push({ label: 'PDCAを開く', uri: `${SITE_URL}/marketing/sales/pdca`, primary: false })
  const result = await notifyOwner([ownerCard(`${dateLabel(date)}の締め：来院${people(visits)}`, text, buttons)])
  await kvSet(MARK_KEY(date), {
    date,
    kind: 'summary',
    sentAt: new Date().toISOString(),
    delivered: result.delivered,
    reason: result.reason,
    draftItemId: draft.itemId,
  } satisfies NoahNightlyMark)
  return { status: 'sent', delivered: result.delivered, reason: result.reason, text, draft }
}

/** 同じ夜に2つの定期実行が重なっても、LINEを1通にする（数分だけ有効な目印） */
async function takeLock(date: string): Promise<boolean> {
  const lock = await kvGet<{ at: number }>(LOCK_KEY(date))
  if (lock && Date.now() - lock.at < LOCK_MS) return false
  await kvSet(LOCK_KEY(date), { at: Date.now() })
  return true
}
