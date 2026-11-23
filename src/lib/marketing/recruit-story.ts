/**
 * 求人ストーリー（受付スタッフ募集の動画を、毎日決まった時刻に Instagram のストーリーへ出す）の決まり
 * 2026-11-23 院長の依頼「この動画を Instagram のストーリーに毎日 朝9時・昼14時・夜19時に投稿してください」。
 *
 * 純粋な関数だけ（外部通信・保存はしない）。予定づくり・投稿は recruit-story-server.ts と publishers.ts。
 * 型の import だけにしてあるので、tsx で単体テストできる（tools/marketing/test-recruit-story.mjs）。
 *
 * 決まり:
 * - 「今日の空き」と同じ作り。予定は定期実行（jobs/run）が毎回作る。印は recruit-story:<日>T<時刻>（同じ印は1回だけ）
 * - 出すのは院長が設定した動画1本だけ。空き状況のような作り直しはしない（中身が毎回同じなので、時刻になったらそのまま出す）
 * - 求人なので、終わりの日（recruitStoryUntil）を過ぎたら出さない。空のときは、院長が設定をオフにするまで続ける
 * - 定期実行は1時間ごとで、Vercel の Cron は1時間ほどずれることがある。予定の時刻から 3時間たっていたら出さない
 *   （空き状況とちがって中身は古くならないが、夜中に出ないようにするため）
 * - 患者さんの情報は扱わない。動画と、院長が決めた時刻だけ
 */
import type { AutopilotSettings } from './autopilot-types'

export const RECRUIT_STORY_KEY_PREFIX = 'recruit-story:'
/** 予定の時刻から何分たったら、出さないか */
export const RECRUIT_STORY_STALE_MINUTES = 180
/** 定期実行が遅れても、予定の時刻からこの分までなら予定を作る */
export const RECRUIT_STORY_LATE_MINUTES = 150
export const RECRUIT_STORY_TITLE = '受付スタッフ募集'
/** 1日に出せる本数の上限（設定の取り違えで出しすぎないように） */
export const RECRUIT_STORY_MAX_PER_DAY = 4

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const pad = (n: number) => String(n).padStart(2, '0')

/** 'YYYY-MM-DDTHH:MM' に分を足す（日本時間のまま扱う） */
function addMinutes(local: string, minutes: number): string {
  const [day, time] = local.split('T')
  const [y, m, d] = day.split('-').map(Number)
  const [hh, mm] = time.split(':').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d, hh, mm + minutes))
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}T${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}`
}

/** 設定の時刻をそろえる（'9:00' → '09:00'。読めないもの・同じものは捨てて並べる） */
export function normalizeRecruitTimes(times: unknown): string[] {
  const list = Array.isArray(times) ? times : []
  const out = new Set<string>()
  for (const raw of list) {
    const m = /^(\d{1,2}):(\d{2})$/.exec(String(raw ?? '').trim())
    if (!m) continue
    const t = `${pad(Number(m[1]))}:${m[2]}`
    if (TIME_RE.test(t)) out.add(t)
  }
  return [...out].sort().slice(0, RECRUIT_STORY_MAX_PER_DAY)
}

/** 動画の置き場が使えるか（Instagram が外から取りに来るので、http(s) のアドレスであること） */
export function isUsableVideoUrl(url: unknown): boolean {
  const s = String(url ?? '').trim()
  if (!s) return false
  try {
    const u = new URL(s)
    return u.protocol === 'https:'
  } catch {
    return false
  }
}

/** 掲載の終わりの日を過ぎたか（空・読めないときは「終わりなし」＝false） */
export function isRecruitFinished(until: unknown, today: string): boolean {
  const s = String(until ?? '').trim()
  if (!DATE_RE.test(s)) return false
  return today > s
}

/** 投稿ジョブの印（同じ日・同じ時刻は1回だけ） */
export function recruitStoryKey(date: string, time: string): string {
  return `${RECRUIT_STORY_KEY_PREFIX}${date}T${time}`
}

/** 印から、日と時刻を読む（読めなければ null） */
export function parseRecruitStoryKey(key: string): { date: string; time: string } | null {
  const m = /^recruit-story:(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})$/.exec(key)
  return m ? { date: m[1], time: m[2] } : null
}

export interface PlannedRecruitStory {
  key: string
  date: string
  time: string
  /** 'YYYY-MM-DDTHH:MM' */
  scheduledAt: string
  /** これを過ぎたら出さない */
  notAfter: string
  videoUrl: string
}

export type RecruitSettings = Pick<
  AutopilotSettings,
  'recruitStory' | 'recruitStoryTimes' | 'recruitStoryVideoUrl' | 'recruitStoryUntil'
>

/** 予定を作らない理由（設定画面に出す） */
export function recruitStoryBlockedReason(settings: RecruitSettings, today: string): string | null {
  if (!settings.recruitStory) return '求人ストーリーはオフです'
  if (!isUsableVideoUrl(settings.recruitStoryVideoUrl)) return '動画がまだ登録されていません（設定画面から動画を選んでください）'
  if (isRecruitFinished(settings.recruitStoryUntil, today)) return `掲載の終わりの日（${settings.recruitStoryUntil}）を過ぎています`
  if (normalizeRecruitTimes(settings.recruitStoryTimes).length === 0) return '出す時刻が決まっていません'
  return null
}

/**
 * 今日の予定（作るべき投稿ジョブ）を決める。
 * - 設定がオフ・動画が無い・終わりの日を過ぎた・時刻が無いときは空
 * - 予定の時刻から LATE 分を過ぎた時刻の分は作らない（朝の分を夜に出さない）
 * - すでにある印（existingKeys）は作らない
 */
export function planRecruitStories(
  settings: RecruitSettings,
  nowLocal: string,
  existingKeys: Set<string>,
): PlannedRecruitStory[] {
  const today = nowLocal.slice(0, 10)
  if (recruitStoryBlockedReason(settings, today)) return []
  const videoUrl = String(settings.recruitStoryVideoUrl).trim()
  const out: PlannedRecruitStory[] = []
  for (const time of normalizeRecruitTimes(settings.recruitStoryTimes)) {
    const scheduledAt = `${today}T${time}`
    if (nowLocal > addMinutes(scheduledAt, RECRUIT_STORY_LATE_MINUTES)) continue
    const key = recruitStoryKey(today, time)
    if (existingKeys.has(key)) continue
    out.push({ key, date: today, time, scheduledAt, notAfter: addMinutes(scheduledAt, RECRUIT_STORY_STALE_MINUTES), videoUrl })
  }
  return out
}

/** 出す時刻が、出さない時刻（notAfter）を過ぎているか */
export function isStaleRecruitStory(notAfter: string | undefined, nowLocal: string): boolean {
  return Boolean(notAfter) && nowLocal > String(notAfter)
}

/** '09:00' → '9:00'（画面の見せ方） */
export const shortRecruitTime = (time: string) => time.replace(/^0(\d):/, '$1:')
