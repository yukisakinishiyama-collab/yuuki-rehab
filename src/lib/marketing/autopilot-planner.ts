/**
 * 自動下書きの計画（純粋関数のみ。外部通信・保存はしない）
 *
 * - 日本時間での週・日付の計算
 * - いつ下書きを作るか（毎週日曜の夕方に翌週分）
 * - 投稿枠の日時
 * - テーマの選び方（同じテーマを続けない・季節に合うものを優先）
 * - 計測リンク（どこから予約が入ったかを数えるためのリンク）
 * - 「今週の空き状況」投稿の文面
 *
 * 型の import だけにしてあるので、node --experimental-strip-types で単体テストできる。
 */
import type { AutopilotSlot } from './autopilot-types'
import type { ThemeSeed } from './theme-library'

const JST_OFFSET_MS = 9 * 60 * 60 * 1000
const pad = (n: number) => String(n).padStart(2, '0')

/** Date を日本時間の各要素へ */
export function jstParts(date: Date) {
  const shifted = new Date(date.getTime() + JST_OFFSET_MS)
  const day = `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-${pad(shifted.getUTCDate())}`
  const hour = shifted.getUTCHours()
  const minute = shifted.getUTCMinutes()
  return {
    date: day,
    weekday: shifted.getUTCDay(),
    hour,
    minute,
    month: shifted.getUTCMonth() + 1,
    /** 'YYYY-MM-DDTHH:MM'（投稿ジョブの予定日時と同じ形式） */
    local: `${day}T${pad(hour)}:${pad(minute)}`,
  }
}

/** 'YYYY-MM-DD' に日数を足す */
export function addDays(dateString: string, days: number): string {
  const [y, m, d] = dateString.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d + days))
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`
}

/** 'YYYY-MM-DD' の曜日（0=日） */
export function weekdayOf(dateString: string): number {
  const [y, m, d] = dateString.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay()
}

/** その日を含む週（月曜はじまり）の月曜 */
export function mondayOf(dateString: string): string {
  return addDays(dateString, -((weekdayOf(dateString) + 6) % 7))
}

/** 'YYYY-MM-DDTHH:MM' に分を足す（日本時間のまま扱う） */
export function addMinutesLocal(local: string, minutes: number): string {
  const [day, time] = local.split('T')
  const [y, m, d] = day.split('-').map(Number)
  const [hh, mm] = time.split(':').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d, hh, mm + minutes))
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}T${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}`
}

/**
 * いま下書きを作るべき週（対象週の月曜）。無ければ null。
 * - 日曜の generateHour 時以降 → 翌週分
 * - 月曜の正午まで → 今週分（日曜に作れなかったときの取り戻し）
 */
export function dueWeekStart(now: Date, generateHour: number): string | null {
  const jst = jstParts(now)
  const thisMonday = mondayOf(jst.date)
  if (jst.weekday === 0 && jst.hour >= generateHour) return addDays(thisMonday, 7)
  if (jst.weekday === 1 && jst.hour < 12) return thisMonday
  return null
}

/** 「今すぐ作る」で対象にする週：今週の投稿枠がまだ残っていれば今週、なければ翌週 */
export function manualTargetWeek(now: Date, slots: AutopilotSlot[], count: number, hasProposal: (week: string) => boolean): string {
  const jst = jstParts(now)
  const thisMonday = mondayOf(jst.date)
  if (!hasProposal(thisMonday) && planSlots(thisMonday, slots, count, jst.local).length > 0 && jst.weekday !== 0) {
    return thisMonday
  }
  return addDays(thisMonday, 7)
}

/**
 * 対象週の投稿日時（日本時間）を古い順に返す。
 * すでに過ぎた枠・30分以内の枠は外す（承認が間に合わないため）。
 */
export function planSlots(weekStart: string, slots: AutopilotSlot[], count: number, nowLocal: string): string[] {
  const limit = addMinutesLocal(nowLocal, 30)
  return slots
    .slice(0, Math.max(0, count))
    .filter((slot) => /^\d{2}:\d{2}$/.test(slot.time) && slot.weekday >= 0 && slot.weekday <= 6)
    .map((slot) => `${addDays(weekStart, (slot.weekday + 6) % 7)}T${slot.time}`)
    .filter((at) => at > limit)
    .sort()
}

/** 文字列から決まる小さな数（同じ週なら同じ順番になるようにするための揺らぎ） */
function stableHash(value: string): number {
  let hash = 0
  for (let i = 0; i < value.length; i += 1) hash = (hash * 31 + value.charCodeAt(i)) | 0
  return Math.abs(hash) % 997
}

/**
 * 系統の並び（例: 症状→予防→案内）に沿ってテーマを選ぶ。
 * - 季節が合わないテーマは候補にしない
 * - 一度も使っていないテーマ → 使ってから日が経ったテーマ の順に優先
 * - 季節限定のテーマは、その時期だけ少し優先する
 * recentThemeIds は新しい順（先頭が先週）。
 */
export function pickThemes(
  library: ThemeSeed[],
  pattern: Array<ThemeSeed['category']>,
  recentThemeIds: string[],
  month: number,
  seed: string,
): ThemeSeed[] {
  const chosen: ThemeSeed[] = []
  for (const category of pattern) {
    const candidates = library.filter(
      (t) =>
        t.category === category &&
        (!t.months || t.months.length === 0 || t.months.includes(month)) &&
        !chosen.some((c) => c.id === t.id),
    )
    if (candidates.length === 0) continue
    const score = (t: ThemeSeed) => {
      const usedAt = recentThemeIds.indexOf(t.id)
      const freshness = usedAt === -1 ? 10_000 : usedAt * 100
      const seasonal = t.months && t.months.length > 0 ? 150 : 0
      return freshness + seasonal + stableHash(`${seed}:${t.id}`) / 10
    }
    candidates.sort((a, b) => score(b) - score(a))
    chosen.push(candidates[0])
  }
  return chosen
}

/**
 * 計測リンク。タップを数えてから予約ページへ移り、予約システム側でも
 * 「どこから来た予約か」を記録する（/api/marketing/go → 予約ページ?source=…）。
 */
export function trackingUrl(siteUrl: string, source: string, campaign: string, dest = 'reserve'): string {
  const qs = new URLSearchParams({ d: dest, source, campaign })
  return `${siteUrl}/api/marketing/go?${qs.toString()}`
}

/** 予約システムから受け取る1日分の空き（午前・午後の空き枠数） */
export interface OpeningDay {
  date: string
  closed: boolean
  am: number
  pm: number
}

/**
 * 「今週の空き状況」の文面を作る（AIは使わず定型文。数字は予約システムの実データ）。
 * 空きが多い時間帯を最大3つ挙げる。挙げられる空きがなければ null（投稿しない）。
 */
export function availabilityText(
  days: OpeningDay[],
  weekStart: string,
  asOfLocal: string,
  phone: string,
): { title: string; body: string } | null {
  const end = addDays(weekStart, 6)
  const fromDay = asOfLocal.slice(0, 10) > weekStart ? asOfLocal.slice(0, 10) : weekStart
  const halves: Array<{ date: string; half: '午前' | '午後'; count: number }> = []
  for (const day of days) {
    if (day.closed || day.date < fromDay || day.date > end) continue
    if (day.am >= 2) halves.push({ date: day.date, half: '午前', count: day.am })
    if (day.pm >= 2) halves.push({ date: day.date, half: '午後', count: day.pm })
  }
  if (halves.length === 0) return null

  const picks = halves
    .sort((a, b) => b.count - a.count || a.date.localeCompare(b.date))
    .slice(0, 3)
    .sort((a, b) => a.date.localeCompare(b.date) || (a.half === '午前' ? -1 : 1))
  const WEEK = ['日', '月', '火', '水', '木', '金', '土']
  const label = (date: string) => `${Number(date.slice(5, 7))}/${Number(date.slice(8, 10))}（${WEEK[weekdayOf(date)]}）`
  const asOf = `${Number(asOfLocal.slice(5, 7))}/${Number(asOfLocal.slice(8, 10))}`

  const body = [
    `【今週のご予約の空き状況】（${asOf}時点）`,
    '',
    '比較的ご予約に空きがある時間帯です。',
    ...picks.map((p) => `・${label(p.date)} ${p.half}`),
    '',
    'ネット予約は24時間受付。空き時間を見て、その場で予約が確定します。',
    `急なケガや強い痛みのときは、お電話（${phone}）のほうが早く対応できます。`,
    '',
    '※空き状況は変わることがあります。最新の空きは予約ページでご確認ください。',
  ].join('\n')
  return { title: '今週のご予約の空き状況', body }
}
