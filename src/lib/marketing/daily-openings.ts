/**
 * 今日の空き（毎日の決まった時刻に、Instagram のストーリーと Google の投稿へ「本日のご予約の空き」を出す）の決まり
 * 2026-11-19 院長の依頼「朝8時・昼13時に、その日の空き情報を」。
 *
 * 純粋な関数だけ（外部通信・保存はしない）。保存・投稿は daily-openings-server.ts。
 * 型の import だけにしてあるので、tsx で単体テストできる（tools/marketing/test-daily-openings.mjs）。
 *
 * 決まり:
 * - 予定は、その日の朝に毎日作る（定期実行 jobs/run）。投稿ジョブの印は daily-openings:<日>T<時刻>:<媒体>（同じ印は1回だけ）
 * - 出す時刻に予約システムから空きを取り直して、本文と画像を作る。休みの日・空きが無いときは出さない
 * - 予定の時刻から 2時間たっても出せていなければ出さない（古い空きになるため。次の時刻の投稿に任せる）
 * - 本文・画像に患者さんの情報は入れない（空きの時刻と数だけ）。Google の本文には電話番号・URL を書かない（gbp-post-rules.ts）
 * - 初めての方（初診・既定60分）もえらべる時間には ◎ を付ける（予約システムが印を返すとき＝v3.22 以降）
 */
import type { OpeningDay, StorySlot } from './autopilot-planner'
import type { AutopilotSettings } from './autopilot-types'

export const DAILY_OPENINGS_KEY_PREFIX = 'daily-openings:'
/** 予定の時刻から何分たったら、出さないか */
export const DAILY_OPENINGS_STALE_MINUTES = 120
/** その日の最初の定期実行が遅れても、予定の時刻からこの分までなら予定を作る（それより後は作らない） */
export const DAILY_OPENINGS_LATE_MINUTES = 90
export const DAILY_OPENINGS_TITLE = '本日のご予約の空き'

export type DailyOpeningsChannel = 'instagram_story' | 'google_business'

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/
const WEEK = ['日', '月', '火', '水', '木', '金', '土']
const pad = (n: number) => String(n).padStart(2, '0')

/** 'YYYY-MM-DDTHH:MM' に分を足す（日本時間のまま扱う） */
function addMinutes(local: string, minutes: number): string {
  const [day, time] = local.split('T')
  const [y, m, d] = day.split('-').map(Number)
  const [hh, mm] = time.split(':').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d, hh, mm + minutes))
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}T${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}`
}

function weekday(date: string): number {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay()
}

/** '11/19（木）' */
export function dayLabel(date: string): string {
  return `${Number(date.slice(5, 7))}/${Number(date.slice(8, 10))}（${WEEK[weekday(date)]}）`
}

/** '09:30' → '9:30'（画像・本文の見せ方） */
export const shortTime = (time: string) => time.replace(/^0(\d):/, '$1:')

/** 設定の時刻をそろえる（'8:00' → '08:00'。読めないもの・同じものは捨てて並べる。最大3つ） */
export function normalizeTimes(times: unknown): string[] {
  const list = Array.isArray(times) ? times : []
  const out = new Set<string>()
  for (const raw of list) {
    const m = /^(\d{1,2}):(\d{2})$/.exec(String(raw ?? '').trim())
    if (!m) continue
    const t = `${pad(Number(m[1]))}:${m[2]}`
    if (TIME_RE.test(t)) out.add(t)
  }
  return [...out].sort().slice(0, 3)
}

/** 出す媒体（設定でオンのもの） */
export function dailyOpeningsChannels(settings: Pick<AutopilotSettings, 'dailyOpeningsStory' | 'dailyOpeningsGoogle'>): DailyOpeningsChannel[] {
  return [
    ...(settings.dailyOpeningsStory ? (['instagram_story'] as const) : []),
    ...(settings.dailyOpeningsGoogle ? (['google_business'] as const) : []),
  ]
}

/** 投稿ジョブの印（同じ日・同じ時刻・同じ媒体は1回だけ） */
export function dailyOpeningsKey(date: string, time: string, channel: DailyOpeningsChannel): string {
  return `${DAILY_OPENINGS_KEY_PREFIX}${date}T${time}:${channel}`
}

/** 印から、日・時刻・媒体を読む（読めなければ null） */
export function parseDailyOpeningsKey(key: string): { date: string; time: string; channel: DailyOpeningsChannel } | null {
  const m = /^daily-openings:(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2}):(instagram_story|google_business)$/.exec(key)
  return m ? { date: m[1], time: m[2], channel: m[3] as DailyOpeningsChannel } : null
}

export interface PlannedDailyPost {
  key: string
  channel: DailyOpeningsChannel
  date: string
  time: string
  /** 'YYYY-MM-DDTHH:MM' */
  scheduledAt: string
  /** これを過ぎたら出さない */
  notAfter: string
}

/**
 * 今日の予定（作るべき投稿ジョブ）を決める。
 * - 設定がオフ・媒体が無いときは空
 * - 今日が休み（予約システムの空きで closed）と分かっているときは空
 * - 予定の時刻から LATE 分を過ぎた時刻の分は作らない（朝の分を昼に出さない）
 * - すでにある印（existingKeys）は作らない
 * - pausedChannels … いまは止めている媒体（Google の審査で拒否が続いたときなど）
 */
export function planDailyOpenings(
  settings: Pick<AutopilotSettings, 'dailyOpenings' | 'dailyOpeningsTimes' | 'dailyOpeningsStory' | 'dailyOpeningsGoogle'>,
  nowLocal: string,
  existingKeys: Set<string>,
  opts: { todayClosed?: boolean; pausedChannels?: DailyOpeningsChannel[] } = {},
): PlannedDailyPost[] {
  if (!settings.dailyOpenings || opts.todayClosed) return []
  const paused = new Set(opts.pausedChannels ?? [])
  const channels = dailyOpeningsChannels(settings).filter((c) => !paused.has(c))
  if (channels.length === 0) return []
  const today = nowLocal.slice(0, 10)
  const out: PlannedDailyPost[] = []
  for (const time of normalizeTimes(settings.dailyOpeningsTimes)) {
    const scheduledAt = `${today}T${time}`
    if (nowLocal > addMinutes(scheduledAt, DAILY_OPENINGS_LATE_MINUTES)) continue
    for (const channel of channels) {
      const key = dailyOpeningsKey(today, time, channel)
      if (existingKeys.has(key)) continue
      out.push({ key, channel, date: today, time, scheduledAt, notAfter: addMinutes(scheduledAt, DAILY_OPENINGS_STALE_MINUTES) })
    }
  }
  return out
}

/** 出す時刻が、出さない時刻（notAfter）を過ぎているか */
export function isStaleDailyPost(notAfter: string | undefined, nowLocal: string): boolean {
  return Boolean(notAfter) && nowLocal > String(notAfter)
}

/** その日の、いま予約できる時間（予約システムが返す時間。残りが0のもの・読めないものは捨てる） */
export function openSlotsOf(day: OpeningDay | undefined): StorySlot[] {
  if (!day || day.closed || !Array.isArray(day.slots)) return []
  return day.slots
    .filter((s) => s && /^\d{1,2}:\d{2}$/.test(String(s.time)) && Number(s.remaining) > 0)
    .map((s) => ({
      time: String(s.time).padStart(5, '0'),
      remaining: Math.floor(Number(s.remaining)),
      ...(typeof s.first === 'boolean' ? { first: s.first } : {}),
    }))
    .sort((a, b) => a.time.localeCompare(b.time))
}

/** 初めての方の印（◎）を出せるか（予約システムが時間ごとに印を返しているか） */
export function hasFirstMarks(slots: StorySlot[]): boolean {
  return slots.some((s) => typeof s.first === 'boolean')
}

/**
 * Google の投稿の本文（定型文。AIは使わない）。案内できる空きが無ければ null（出さない）。
 * 電話番号・URL は書かない（Google に拒否されるため。予約は投稿の「予約」ボタンから）
 */
export function dailyOpeningsText(day: OpeningDay | undefined, asOfLocal: string): { title: string; body: string } | null {
  if (!day) return null
  const slots = openSlotsOf(day)
  if (slots.length === 0) return null
  const marks = hasFirstMarks(slots)
  const line = (items: StorySlot[]) => items.map((s) => `${shortTime(s.time)}${marks && s.first ? '◎' : ''}`).join('　')
  const am = slots.filter((s) => s.time < '13:00')
  const pm = slots.filter((s) => s.time >= '13:00')
  const asOf = `${shortTime(asOfLocal.slice(11, 16))}時点`
  const title = `本日 ${dayLabel(day.date)}のご予約の空き`
  const body = [
    `【${title}】（${asOf}）`,
    '',
    ...(am.length ? [`午前　${line(am)}`] : []),
    ...(pm.length ? [`午後　${line(pm)}`] : []),
    '',
    ...(marks
      ? [
          slots.some((s) => s.first)
            ? '◎ … 初めての方（約60分）もご予約いただける時間です。'
            : '初めての方は約60分のお時間をいただくため、本日はご予約いただける時間がありません。',
        ]
      : ['初めての方は約60分のお時間をいただきます。']),
    'ネット予約は24時間受付。空き時間を見て、その場で予約が確定します。下の「予約」からどうぞ。',
    '',
    '※空き状況は変わることがあります。最新の空きは予約ページでご確認ください。',
  ].join('\n')
  return { title, body }
}

/**
 * Google に残す「今日の空き」の投稿は最新の1本だけ。新しく出したあと、消す投稿（前に出したもの）を選ぶ。
 * jobs … 今日の空きの Google の投稿ジョブ（公開済みで、Google の投稿の名前があるもの）
 */
export function oldDailyGooglePosts<T extends { id: string; idempotencyKey: string; google?: { name?: string; postedAt?: string; deletedAt?: string } }>(
  jobs: T[],
  keepId: string,
): T[] {
  return jobs.filter(
    (j) =>
      j.id !== keepId &&
      j.idempotencyKey.startsWith(DAILY_OPENINGS_KEY_PREFIX) &&
      j.idempotencyKey.endsWith(':google_business') &&
      Boolean(j.google?.name) &&
      !j.google?.deletedAt,
  )
}

/**
 * Google の審査で拒否が続いたら、Google への今日の空きは止める（毎日2回、拒否のお知らせが届かないように）。
 * 直近 days 日のうちに、拒否が limit 回以上あれば止める
 */
export function googlePaused<T extends { idempotencyKey: string; createdAt: string; google?: { state?: string } }>(
  jobs: T[],
  nowIso: string,
  opts: { days?: number; limit?: number } = {},
): boolean {
  const days = opts.days ?? 3
  const limit = opts.limit ?? 2
  const since = Date.parse(nowIso) - days * 24 * 60 * 60 * 1000
  const rejected = jobs.filter(
    (j) =>
      j.idempotencyKey.startsWith(DAILY_OPENINGS_KEY_PREFIX) &&
      j.idempotencyKey.endsWith(':google_business') &&
      j.google?.state === 'rejected' &&
      Date.parse(j.createdAt) >= since,
  )
  return rejected.length >= limit
}
