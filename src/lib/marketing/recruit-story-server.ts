/**
 * 求人ストーリー（受付スタッフ募集の動画を、毎日決まった時刻に Instagram のストーリーへ出す）の
 * 予定づくり・あと片付け（サーバー専用）。2026-11-23 院長の依頼。決まりは recruit-story.ts（純粋な関数・テストつき）。
 *
 * - scheduleRecruitStories()      … その日の投稿ジョブを作る（jobs/run の最初に毎回呼ぶ。同じ印は1回だけ）
 * - cancelPendingRecruitStories() … 設定をオフにした・時刻や動画を変えたとき、まだ出していない分を取り消す
 * - afterRecruitStoryJob()        … 何度やり直しても出せなかったら院長のLINEへ
 * - recentRecruitStories()        … 設定画面に出す、最近の求人ストーリー
 *
 * 院長がこの設定をオンにしたことを「毎回の承認」の代わりにする（出すのは院長が選んだ動画1本だけ。
 * 中身は毎回同じで、患者さんの情報は載せない）。出したことは毎回は知らせない（1日3回のお知らせは多すぎるため）。
 */
import { jstParts } from './autopilot-planner'
import { getAutopilotSettings } from './autopilot-store-server'
import type { AutopilotSettings } from './autopilot-types'
import {
  RECRUIT_STORY_KEY_PREFIX,
  RECRUIT_STORY_TITLE,
  isUsableVideoUrl,
  normalizeRecruitTimes,
  parseRecruitStoryKey,
  planRecruitStories,
  recruitStoryBlockedReason,
  shortRecruitTime,
  type PlannedRecruitStory,
} from './recruit-story'
import { createJob, listJobs, updateJob, type PublishJob } from './jobs-store-server'
import type { JobRunResult } from './job-runner'
import type { GeneratedContent } from './types'

function contentFor(plan: PlannedRecruitStory): GeneratedContent {
  return {
    title: RECRUIT_STORY_TITLE,
    hook: RECRUIT_STORY_TITLE,
    body: `【Instagramストーリー】${RECRUIT_STORY_TITLE}（${plan.date} ${shortRecruitTime(plan.time)} の自動投稿。院長が登録した動画をそのまま出します）`,
    cta: { label: '', url: '' },
    hashtags: [],
    warnings: [
      '求人ストーリーの自動投稿です（AIは使っていません。院長が登録した動画を、設定した時刻にそのまま出します）',
      '詳しい労働条件は、DM・お電話でお伝えする案内にしています（ストーリーには投稿文が付けられないため）',
    ],
    recruitStory: { videoUrl: plan.videoUrl, notAfter: plan.notAfter, time: plan.time },
  }
}

export interface RecruitScheduleResult {
  made: number
  skipped?: string
}

/** その日の求人ストーリーの投稿ジョブを作る（同じ印のジョブがあれば作らない。取り消し・出さなかったものも作り直さない） */
export async function scheduleRecruitStories(now = new Date(), settingsIn?: AutopilotSettings): Promise<RecruitScheduleResult> {
  const settings = settingsIn ?? (await getAutopilotSettings())
  const jst = jstParts(now)
  const blocked = recruitStoryBlockedReason(settings, jst.date)
  if (blocked) return { made: 0, skipped: blocked }
  const jobs = await listJobs()
  const existing = new Set(jobs.filter((j) => j.idempotencyKey.startsWith(RECRUIT_STORY_KEY_PREFIX)).map((j) => j.idempotencyKey))
  const candidates = planRecruitStories(settings, jst.local, existing)
  if (candidates.length === 0) return { made: 0 }
  let made = 0
  for (const plan of candidates) {
    const { duplicated } = await createJob({
      idempotencyKey: plan.key,
      projectId: 'recruit-story',
      variantId: plan.key,
      channel: 'instagram_story',
      theme: `求人ストーリー（${plan.date} ${shortRecruitTime(plan.time)}）`,
      content: contentFor(plan),
      scheduledAt: plan.scheduledAt,
    })
    if (!duplicated) made += 1
  }
  return { made }
}

/**
 * まだ出していない求人ストーリーを取り消す。
 * settings … いまの設定（オフ・動画なしなら全部取り消す。時刻を変えたときは、残る時刻の分だけ残す）
 */
export async function cancelPendingRecruitStories(settings?: AutopilotSettings): Promise<number> {
  const live = Boolean(settings?.recruitStory) && isUsableVideoUrl(settings?.recruitStoryVideoUrl)
  const times = live ? new Set(normalizeRecruitTimes(settings?.recruitStoryTimes)) : new Set<string>()
  const videoUrl = String(settings?.recruitStoryVideoUrl ?? '').trim()
  let cancelled = 0
  for (const job of await listJobs()) {
    if (job.status !== 'pending' || !job.idempotencyKey.startsWith(RECRUIT_STORY_KEY_PREFIX)) continue
    const parsed = parseRecruitStoryKey(job.idempotencyKey)
    const sameVideo = job.content?.recruitStory?.videoUrl === videoUrl
    if (parsed && times.has(parsed.time) && sameVideo) continue
    await updateJob(job.id, (j) => {
      if (j.status !== 'pending') return
      j.status = 'cancelled'
      j.actionReason = '設定を変えたため取り消しました（求人ストーリー）'
    })
    cancelled += 1
  }
  return cancelled
}

/** 何度やり直しても出せなかったら、院長のLINEへ（1回だけ） */
export async function afterRecruitStoryJob(job: PublishJob, r: JobRunResult): Promise<void> {
  if (!r.ran || !job.idempotencyKey.startsWith(RECRUIT_STORY_KEY_PREFIX)) return
  if (r.job?.status !== 'failed') return
  const parsed = parseRecruitStoryKey(job.idempotencyKey)
  const when = parsed ? `${parsed.date} ${shortRecruitTime(parsed.time)}` : ''
  try {
    const { notifyOwner } = await import('./owner-notify')
    await notifyOwner([
      `求人ストーリー（${when}）を Instagram に出せませんでした（何度かやり直しましたが失敗しました）。「投稿の予定と結果」の画面で理由を確認できます。次の時刻の分は、いつもどおり出します。`,
    ])
  } catch (error) {
    console.error('[recruit-story] 院長への通知に失敗しました', error)
  }
}

/** 設定画面に出す、最近の求人ストーリー（出した・出さなかった・予定）。新しい順に最大9件 */
export async function recentRecruitStories(): Promise<Array<{ key: string; scheduledAt: string; status: string; reason?: string; url?: string }>> {
  return (await listJobs())
    .filter((j) => j.idempotencyKey.startsWith(RECRUIT_STORY_KEY_PREFIX))
    .sort((a, b) => b.scheduledAt.localeCompare(a.scheduledAt))
    .slice(0, 9)
    .map((j) => ({ key: j.idempotencyKey, scheduledAt: j.scheduledAt, status: j.status, reason: j.actionReason, url: j.publishedUrl }))
}
