/**
 * 今日の空き（毎日の決まった時刻に「本日のご予約の空き」を出す）の予定づくり・本文と画像づくり・あと片付け（サーバー専用）
 * 2026-11-19 院長の依頼。決まりは daily-openings.ts（純粋な関数・テストつき）。
 *
 * - scheduleDailyOpenings()      … その日の投稿ジョブを作る（jobs/run の最初に毎回呼ぶ。同じ印は1回だけ）
 * - prepareDailyOpeningsGoogle() … Google の投稿の本文と画像を、出す時刻の空きで作る（publishers.ts から）
 * - afterDailyOpeningsJob()      … 出したあとの片付け：Google は前の「今日の空き」の投稿を消して最新の1本だけ残す
 * - cancelPendingDailyOpenings() … 設定をオフにした・時刻や媒体を変えたとき、まだ出していない分を取り消す
 *
 * 院長がこの設定をオンにしたことを「毎回の承認」の代わりにする（出すのは空き状況の定型の画像・文だけ。患者さんの情報は載せない）。
 * 出したことは毎回は知らせない（1日2回のお知らせは多すぎるため）。出せなかったとき（何度やり直してもだめ）だけ院長のLINEへ。
 */
import { jstParts } from './autopilot-planner'
import { getAutopilotSettings } from './autopilot-store-server'
import type { AutopilotSettings } from './autopilot-types'
import {
  DAILY_OPENINGS_KEY_PREFIX,
  DAILY_OPENINGS_TITLE,
  dailyOpeningsChannels,
  dailyOpeningsText,
  dayLabel,
  googlePaused,
  isStaleDailyPost,
  normalizeTimes,
  oldDailyGooglePosts,
  openSlotsOf,
  parseDailyOpeningsKey,
  planDailyOpenings,
  shortTime,
  type DailyOpeningsChannel,
  type PlannedDailyPost,
} from './daily-openings'
import { createJob, listJobs, updateJob, type PublishJob } from './jobs-store-server'
import type { JobRunResult } from './job-runner'
import type { GeneratedContent } from './types'

const SITE_URL = 'https://yuuki-rehab.vercel.app'

/** Google の「予約」ボタンのもとのリンク（Google へ出すときに院のホームページへ置きかわる。計測名だけ引き継ぐ。gbp-post-rules.ts） */
function googleCtaUrl(date: string, time: string): string {
  const campaign = `openings-${date.replace(/-/g, '')}-${time.replace(':', '')}`
  return `${SITE_URL}/yoyaku-net?${new URLSearchParams({ source: 'google_post', campaign }).toString()}`
}

function contentFor(plan: PlannedDailyPost): GeneratedContent {
  const when = `${dayLabel(plan.date)} ${shortTime(plan.time)}`
  const base = {
    title: DAILY_OPENINGS_TITLE,
    hook: DAILY_OPENINGS_TITLE,
    hashtags: [],
    warnings: ['今日の空き（毎日）の定型の画像・文です（AIは使っていません。院長の設定で自動で出します）'],
  }
  if (plan.channel === 'instagram_story') {
    return {
      ...base,
      body: `【Instagramストーリー】${DAILY_OPENINGS_TITLE}（${when} の自動投稿。出す時刻の空きで画像を作ります。休みの日・空きが無いときは出しません）`,
      cta: { label: '予約', url: '' },
      story: {
        scope: 'day',
        dates: [plan.date],
        snapshot: [],
        title: DAILY_OPENINGS_TITLE,
        edits: { showRemaining: true },
        trigger: 'daily',
        notAfter: plan.notAfter,
      },
    }
  }
  return {
    ...base,
    body: `【Googleの投稿】${DAILY_OPENINGS_TITLE}（${when} の自動投稿。出す時刻の空きで本文と画像を作ります。休みの日・空きが無いときは出しません）`,
    cta: { label: '予約', url: googleCtaUrl(plan.date, plan.time) },
    dailyOpenings: { date: plan.date, time: plan.time, notAfter: plan.notAfter },
  }
}

/** 今日が休みか（予約システムの空きで分かるときだけ true/false。分からなければ undefined） */
async function todayClosed(today: string): Promise<boolean | undefined> {
  try {
    const { fetchHubStats } = await import('./booking-stats')
    const stats = await fetchHubStats(8)
    const day = stats?.openings.find((o) => o.date === today)
    return day ? day.closed : undefined
  } catch {
    return undefined
  }
}

export interface DailyScheduleResult {
  made: number
  skipped?: string
  paused?: DailyOpeningsChannel[]
}

/** その日の「今日の空き」の投稿ジョブを作る（同じ印のジョブがあれば作らない。取り消し・出さなかったものも作り直さない） */
export async function scheduleDailyOpenings(now = new Date(), settingsIn?: AutopilotSettings): Promise<DailyScheduleResult> {
  const settings = settingsIn ?? (await getAutopilotSettings())
  if (!settings.dailyOpenings) return { made: 0, skipped: '今日の空き（毎日）はオフです' }
  const jst = jstParts(now)
  const jobs = await listJobs()
  const existing = new Set(jobs.filter((j) => j.idempotencyKey.startsWith(DAILY_OPENINGS_KEY_PREFIX)).map((j) => j.idempotencyKey))
  const paused: DailyOpeningsChannel[] = googlePaused(jobs, now.toISOString()) ? ['google_business'] : []
  // 予定があるときだけ、今日が休みかを予約システムに聞く（無駄に問い合わせない）
  const candidates = planDailyOpenings(settings, jst.local, existing, { pausedChannels: paused })
  if (candidates.length === 0) return { made: 0, paused }
  if ((await todayClosed(jst.date)) === true) return { made: 0, skipped: '今日は休みの日です', paused }
  let made = 0
  for (const plan of candidates) {
    const { duplicated } = await createJob({
      idempotencyKey: plan.key,
      projectId: 'daily-openings',
      variantId: plan.key,
      channel: plan.channel,
      theme: `今日の空き（${dayLabel(plan.date)} ${shortTime(plan.time)}）`,
      content: contentFor(plan),
      scheduledAt: plan.scheduledAt,
    })
    if (!duplicated) made += 1
  }
  return { made, paused }
}

/**
 * まだ出していない「今日の空き」を取り消す。
 * keep … 残すもの（いまの設定の時刻・媒体）。省けば全部取り消す（設定をオフにしたとき）
 */
export async function cancelPendingDailyOpenings(settings?: AutopilotSettings): Promise<number> {
  const times = settings?.dailyOpenings ? new Set(normalizeTimes(settings.dailyOpeningsTimes)) : new Set<string>()
  const channels = settings?.dailyOpenings ? new Set<string>(dailyOpeningsChannels(settings)) : new Set<string>()
  let cancelled = 0
  for (const job of await listJobs()) {
    if (job.status !== 'pending' || !job.idempotencyKey.startsWith(DAILY_OPENINGS_KEY_PREFIX)) continue
    const parsed = parseDailyOpeningsKey(job.idempotencyKey)
    if (parsed && times.has(parsed.time) && channels.has(parsed.channel)) continue
    await updateJob(job.id, (j) => {
      if (j.status !== 'pending') return
      j.status = 'cancelled'
      j.actionReason = '設定を変えたため取り消しました（今日の空き）'
    })
    cancelled += 1
  }
  return cancelled
}

export type DailyGooglePrepared =
  | { kind: 'ok'; title: string; body: string; imageUrl?: string }
  | { kind: 'skipped'; message: string }
  | { kind: 'error'; message: string }

/**
 * Google の投稿の本文と画像を、いまの空きで作る（publishers.ts の Google の投稿から呼ぶ）。
 * 画像が作れなくても、本文だけで出す（imageUrl なし）
 */
export async function prepareDailyOpeningsGoogle(daily: NonNullable<GeneratedContent['dailyOpenings']>, now = new Date()): Promise<DailyGooglePrepared> {
  const jst = jstParts(now)
  if (isStaleDailyPost(daily.notAfter, jst.local)) {
    return { kind: 'skipped', message: '予定の時刻から2時間たったため出しませんでした（古い空きになるため。次の時刻の分で出します）' }
  }
  const { fetchHubStats } = await import('./booking-stats')
  const fresh = await fetchHubStats(1, { fresh: true }).catch(() => null)
  if (!fresh) return { kind: 'error', message: '予約システムからいまの空きを取れませんでした（やり直します）' }
  const day = fresh.openings.find((o) => o.date === daily.date)
  if (day?.closed) return { kind: 'skipped', message: '今日は休みの日のため出しませんでした' }
  const text = dailyOpeningsText(day, jst.local)
  if (!text) return { kind: 'skipped', message: 'いま案内できる空きが無かったため出しませんでした' }
  let imageUrl: string | undefined
  try {
    const { renderOpeningsCardImage } = await import('./image-template')
    const { put } = await import('@vercel/blob')
    const buf = await renderOpeningsCardImage({
      title: DAILY_OPENINGS_TITLE,
      dayLabel: dayLabel(daily.date),
      asOfLabel: `${shortTime(jst.local.slice(11, 16))} 時点`,
      slots: openSlotsOf(day),
    })
    imageUrl = (await put(`marketing/openings-${Date.now()}.png`, buf, { access: 'public', contentType: 'image/png' })).url
  } catch (error) {
    console.error('[daily-openings] Googleの投稿の画像を作れませんでした（本文だけで出します）', error)
  }
  return { kind: 'ok', title: text.title, body: text.body, imageUrl }
}

/** Google の投稿を1本消す（失敗しても止めない。消せなかったら false） */
async function deleteGooglePost(name: string): Promise<boolean> {
  try {
    const { gbpAccessToken, getGbpCredentials } = await import('./gbp-token')
    const credentials = await getGbpCredentials()
    if (!credentials) return false
    const token = await gbpAccessToken(credentials)
    const res = await fetch(`https://mybusiness.googleapis.com/v4/${name}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(15000),
    })
    // すでに無い（404）も、消せたことにする
    return res.ok || res.status === 404
  } catch (error) {
    console.warn('[daily-openings] Googleの前の投稿を消せませんでした', error instanceof Error ? error.message : error)
    return false
  }
}

/**
 * 「今日の空き」のジョブを動かしたあと（jobs/run から）。
 * - Google に出せたら、前に出した「今日の空き」の投稿を消す（最新の1本だけ残す。古い空きを見せないため）
 * - 何度やり直しても出せなかったら、院長のLINEへ（1回だけ）
 */
export async function afterDailyOpeningsJob(job: PublishJob, r: JobRunResult): Promise<void> {
  if (!r.ran || !job.idempotencyKey.startsWith(DAILY_OPENINGS_KEY_PREFIX)) return
  if (r.outcome === 'published' && job.channel === 'google_business') {
    const old = oldDailyGooglePosts(await listJobs(), job.id)
    for (const prev of old) {
      const ok = await deleteGooglePost(prev.google!.name!)
      if (!ok) continue
      await updateJob(prev.id, (j) => {
        j.google = { ...(j.google ?? {}), deletedAt: new Date().toISOString(), done: true }
        j.attempts.push({ at: new Date().toISOString(), ok: true, message: '新しい「今日の空き」を出したので、この投稿はGoogleから消しました' })
      })
    }
    return
  }
  if (r.job?.status === 'failed') {
    const parsed = parseDailyOpeningsKey(job.idempotencyKey)
    const where = job.channel === 'google_business' ? 'Googleの投稿' : 'Instagramのストーリー'
    try {
      const { notifyOwner } = await import('./owner-notify')
      await notifyOwner([
        `今日の空き（${parsed ? `${dayLabel(parsed.date)} ${shortTime(parsed.time)}` : ''}）を${where}に出せませんでした（何度かやり直しましたが失敗しました）。「投稿の予定と結果」の画面で理由を確認できます。次の時刻の分は、いつもどおり出します。`,
      ])
    } catch (error) {
      console.error('[daily-openings] 院長への通知に失敗しました', error)
    }
  }
}

/** 設定画面に出す、最近の「今日の空き」（出した・出さなかった・予定）。新しい順に最大8件 */
export async function recentDailyOpenings(): Promise<Array<{ key: string; channel: string; scheduledAt: string; status: string; reason?: string; url?: string }>> {
  return (await listJobs())
    .filter((j) => j.idempotencyKey.startsWith(DAILY_OPENINGS_KEY_PREFIX))
    .sort((a, b) => b.scheduledAt.localeCompare(a.scheduledAt) || a.channel.localeCompare(b.channel))
    .slice(0, 8)
    .map((j) => ({ key: j.idempotencyKey, channel: j.channel, scheduledAt: j.scheduledAt, status: j.status, reason: j.actionReason, url: j.publishedUrl }))
}
