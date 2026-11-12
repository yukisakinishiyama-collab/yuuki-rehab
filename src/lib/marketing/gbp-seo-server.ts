/**
 * Google検索向けの投稿を、投稿ジョブとして予約する（サーバー専用）
 *
 * runAutopilot（毎日12時・日曜夕方・月曜朝）から呼ぶ。今週と来週の分を、週ごとに1回だけ決めて予約する。
 * - 決めた週は KV の gbpseo:week:<月曜> に残す（同じ週を二度決めない）
 * - 出した順は gbpseo:history（投稿の id。次は続きから）
 * - 予約はふつうの投稿ジョブ（idempotencyKey = gbpseo:<週>:<番号>）。時刻になると jobs/run が Google へ出す。
 *   Google と未接続なら「手動対応」になり、院長のLINEへ本文と画像のリンクを届ける（nudgeManualPosts）
 */
import { kvDelete, kvGet, kvSet } from './kv-store-server'
import { createJob, listJobs, updateJob } from './jobs-store-server'
import { getAutopilotSettings } from './autopilot-store-server'
import { addDays, jstParts, mondayOf } from './autopilot-planner'
import { pickSeoPosts, seoCampaign, seoContent, seoSlotsForWeek } from './gbp-seo'

const WEEK_KEY = (week: string) => `gbpseo:week:${week}`
const HISTORY_KEY = 'gbpseo:history'

export interface SeoWeekPlan {
  weekStart: string
  createdAt: string
  items: Array<{ scheduledAt: string; postId: string; jobId: string; campaign: string }>
}

export function isSeoJobKey(key: string): boolean {
  return key.startsWith('gbpseo:')
}

export async function getSeoWeekPlan(week: string): Promise<SeoWeekPlan | null> {
  return kvGet<SeoWeekPlan>(WEEK_KEY(week))
}

/** 今週（まだ来ていない時刻だけ）と来週の分を予約する。オフのときは何もしない */
export async function scheduleSeoPosts(now = new Date()): Promise<{ scheduled: number; weeks: string[]; skipped?: string }> {
  const settings = await getAutopilotSettings()
  if (!settings.googleSeo) return { scheduled: 0, weeks: [], skipped: 'Google検索向けの投稿はオフです' }
  const jst = jstParts(now)
  const thisMonday = mondayOf(jst.date)
  let scheduled = 0
  const weeks: string[] = []
  for (const week of [thisMonday, addDays(thisMonday, 7)]) {
    if (await getSeoWeekPlan(week)) continue
    const slots = seoSlotsForWeek(week, settings.googleSeoPerWeek).filter((s) => s > jst.local)
    const history = (await kvGet<string[]>(HISTORY_KEY)) ?? []
    const posts = pickSeoPosts(history, slots.length)
    const plan: SeoWeekPlan = { weekStart: week, createdAt: new Date().toISOString(), items: [] }
    for (let i = 0; i < slots.length; i++) {
      const post = posts[i]
      const campaign = seoCampaign(week, i + 1)
      const { job } = await createJob({
        idempotencyKey: `gbpseo:${week}:${i + 1}`,
        projectId: `gbpseo:${week}`,
        variantId: `gbpseo-${post.id}`,
        channel: 'google_business',
        theme: `Google検索向け：${post.title}`,
        content: seoContent(post, campaign),
        scheduledAt: slots[i],
      })
      plan.items.push({ scheduledAt: slots[i], postId: post.id, jobId: job.id, campaign })
      scheduled += 1
    }
    await kvSet(WEEK_KEY(week), plan)
    if (plan.items.length > 0) await kvSet(HISTORY_KEY, [...history, ...plan.items.map((x) => x.postId)].slice(-60))
    weeks.push(week)
  }
  return { scheduled, weeks }
}

/** 設定をオフにしたとき：予約済みでまだ出していない Google検索向けの投稿を取り消す */
export async function cancelPendingSeoPosts(): Promise<number> {
  let n = 0
  const weeks = new Set<string>()
  for (const job of await listJobs()) {
    if (!isSeoJobKey(job.idempotencyKey) || job.status !== 'pending') continue
    await updateJob(job.id, (j) => {
      j.status = 'cancelled'
      j.actionReason = 'Google検索向けの投稿をオフにしたため取り消し'
    })
    weeks.add(job.idempotencyKey.split(':')[1])
    n += 1
  }
  // 取り消した週の予定も消す（またオンにしたら、その週の残りの時刻で決め直す）
  for (const week of weeks) await kvDelete(WEEK_KEY(week))
  return n
}
