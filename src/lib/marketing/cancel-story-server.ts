/**
 * キャンセルが出たら、空いた枠を Instagram のストーリーですぐ知らせる（サーバー専用）
 *
 * きっかけ: 予約システム（GAS）がキャンセルのたびに /api/marketing/reservation-notify へ送る通知（kind: 'cancel'）。
 * 院長の設定（自動投稿 → 設定「キャンセルが出たらストーリーで知らせる」）がオンのときだけ動く。
 * 院長がこの設定をオンにしたことを、毎回の承認の代わりにする（2026-11-02 院長の依頼）。
 *
 * 出すもの: 予約の空き状況の定型の画像（AIは使わない）。見出し「キャンセルが出ました」、ひとこと「本日 15:00 に空きが出ました」。
 * 患者さんのお名前・症状などは、画像にも記録にも入れない（通知に入っていても使わない）。
 *
 * 出さないとき:
 * - 設定がオフ／当日（または翌日）以外の枠／枠まで「何分前」より近い／1日の上限に達した
 * - 出す時刻にその枠がもう埋まっていた（publishers.ts で、いまの空きを取り直して確かめる）
 * 出してよい時間帯の外のキャンセルは、時間帯のはじめ（例 7時）に出す。枠に間に合わなければ出さない。
 * 同じ枠のキャンセルが2件来ても、ストーリーは1回だけ（同じ枠は idempotencyKey でまとめる）。
 */
import { addDays, addMinutesLocal, jstParts, storyDayLabel } from './autopilot-planner'
import { getAutopilotSettings } from './autopilot-store-server'
import type { AutopilotSettings } from './autopilot-types'
import { createJob, listJobs, type PublishJob } from './jobs-store-server'
import type { JobRunResult } from './job-runner'
import type { GeneratedContent } from './types'

export const CANCEL_STORY_KEY_PREFIX = 'cancel-story:'
const CANCEL_STORY_TITLE = 'キャンセルが出ました'

export interface CancelNotice {
  date?: string
  time?: string
}

export type CancelStoryPlan =
  | { action: 'skip'; reason: string }
  | { action: 'post_now' | 'post_later'; date: string; time: string; scheduledAt: string; note: string; key: string }

const pad = (n: number) => String(n).padStart(2, '0')
/** '09:30' → '9:30'（画像・お知らせの見せ方） */
const shortTime = (time: string) => time.replace(/^0(\d):/, '$1:')

/** 'YYYY-MM-DD' / 'YYYY/M/D' → 'YYYY-MM-DD'。読めなければ '' */
export function normalizeDate(value: unknown): string {
  const m = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/.exec(String(value ?? '').trim())
  return m ? `${m[1]}-${pad(Number(m[2]))}-${pad(Number(m[3]))}` : ''
}

/** 'H:MM' / 'HH:MM' / 'HH:MM:SS' → 'HH:MM'。読めなければ '' */
export function normalizeTime(value: unknown): string {
  const m = /^(\d{1,2}):(\d{2})/.exec(String(value ?? '').trim())
  if (!m) return ''
  const h = Number(m[1])
  const mm = Number(m[2])
  return h < 24 && mm < 60 ? `${pad(h)}:${pad(mm)}` : ''
}

/** 同じ日（日本時間）に作ったキャンセルのストーリー（出した・出す予定・出している途中）の数 */
function countToday(jobs: PublishJob[], today: string): number {
  return jobs.filter((j) => {
    if (!j.idempotencyKey.startsWith(CANCEL_STORY_KEY_PREFIX)) return false
    if (j.status === 'cancelled' || j.status === 'failed') return false
    return jstParts(new Date(j.createdAt)).date === today
  }).length
}

/**
 * キャンセルの通知から、ストーリーを出すか・いつ出すかを決める（保存も投稿もしない）
 * nowLocal … 'YYYY-MM-DDTHH:MM'（日本時間）
 */
export function planCancelStory(
  notice: CancelNotice,
  settings: AutopilotSettings,
  nowLocal: string,
  jobs: PublishJob[],
): CancelStoryPlan {
  if (!settings.cancelStory) return { action: 'skip', reason: 'キャンセルのストーリーはオフです' }
  const date = normalizeDate(notice.date)
  const time = normalizeTime(notice.time)
  if (!date || !time) return { action: 'skip', reason: 'キャンセルの日時が読めませんでした' }

  const today = nowLocal.slice(0, 10)
  const tomorrow = addDays(today, 1)
  const okDay = date === today || (settings.cancelStoryDays === 'tomorrow' && date === tomorrow)
  if (!okDay) {
    return { action: 'skip', reason: settings.cancelStoryDays === 'today' ? '当日のキャンセルではありません' : '当日・翌日のキャンセルではありません' }
  }

  const slot = `${date}T${time}`
  // この時刻までに出せば、見た方が枠に間に合う
  const latest = addMinutesLocal(slot, -settings.cancelStoryLeadMinutes)
  if (nowLocal > latest) return { action: 'skip', reason: `枠まで${settings.cancelStoryLeadMinutes}分を切っているため出しません` }

  const key = `${CANCEL_STORY_KEY_PREFIX}${slot}`
  const same = jobs.find((j) => j.idempotencyKey === key && j.status !== 'cancelled' && j.status !== 'failed')
  if (same) return { action: 'skip', reason: 'この枠のキャンセルは、すでにストーリーにしています' }
  if (countToday(jobs, today) >= settings.cancelStoryMaxPerDay) {
    return { action: 'skip', reason: `今日のキャンセルのストーリーが上限（${settings.cancelStoryMaxPerDay}回）に達しました` }
  }

  // 出してよい時間帯（from 時〜to 時）。外なら次の from 時に出す
  const from = Math.min(Math.max(settings.cancelStoryFromHour, 0), 23)
  const to = Math.min(Math.max(settings.cancelStoryToHour, from + 1), 24)
  const hour = Number(nowLocal.slice(11, 13))
  let scheduledAt = nowLocal
  let action: 'post_now' | 'post_later' = 'post_now'
  if (hour < from) {
    scheduledAt = `${today}T${pad(from)}:00`
    action = 'post_later'
  } else if (hour >= to) {
    scheduledAt = `${tomorrow}T${pad(from)}:00`
    action = 'post_later'
  }
  if (scheduledAt > latest) return { action: 'skip', reason: '出してよい時間帯になる前に枠の時刻が来るため出しません' }

  // 「本日」「明日」は、ストーリーを出す日から見た言い方にする（夜のキャンセルを翌朝に出すときにずれないように）
  const postDay = scheduledAt.slice(0, 10)
  const dayWord = date === postDay ? '本日' : date === addDays(postDay, 1) ? '明日' : storyDayLabel(date)
  return { action, date, time, scheduledAt, note: `${dayWord} ${shortTime(time)} に空きが出ました`, key }
}

/** ストーリーのジョブの中身（患者さんの情報は入れない） */
function storyContent(date: string, time: string, note: string): GeneratedContent {
  return {
    title: CANCEL_STORY_TITLE,
    hook: CANCEL_STORY_TITLE,
    body: `【Instagramストーリー】${note}（キャンセルで空いた枠のお知らせ。出す時刻の空きで画像を作り、その枠が埋まっていたら出しません）`,
    cta: { label: '予約', url: '' },
    hashtags: [],
    warnings: ['キャンセルの通知から自動で作る定型の画像です（AIは使っていません。院長の設定で自動で出します）'],
    story: {
      scope: 'day',
      dates: [date],
      snapshot: [],
      title: CANCEL_STORY_TITLE,
      edits: { note, showRemaining: true },
      requireSlot: time,
      trigger: 'cancel',
    },
  }
}

export interface CancelStoryResult {
  plan: CancelStoryPlan
  /** 作ったジョブ（出さないときは無し） */
  job?: PublishJob
  /** すぐ出した結果 */
  outcome?: string
}

/** キャンセルの通知を受けて、ストーリーを出す（または出す予定にする）。予約システムへの返事のあとで呼ぶ */
export async function handleCancelStory(notice: CancelNotice, now = new Date()): Promise<CancelStoryResult> {
  const settings = await getAutopilotSettings()
  if (!settings.cancelStory) return { plan: { action: 'skip', reason: 'キャンセルのストーリーはオフです' } }
  const jobs = await listJobs()
  const plan = planCancelStory(notice, settings, jstParts(now).local, jobs)
  if (plan.action === 'skip') return { plan }

  const { job, duplicated } = await createJob({
    idempotencyKey: plan.key,
    projectId: 'cancel-story',
    variantId: plan.key,
    channel: 'instagram_story',
    theme: `キャンセルで空いた枠（${storyDayLabel(plan.date)} ${plan.time}）`,
    content: storyContent(plan.date, plan.time, plan.note),
    scheduledAt: plan.scheduledAt,
  })
  if (duplicated) return { plan: { action: 'skip', reason: 'この枠のキャンセルは、すでにストーリーにしています' } }
  if (plan.action === 'post_later') {
    await notifyCancelStory(`⏰ キャンセルが出ました（${storyDayLabel(plan.date)} ${shortTime(plan.time)}）。\nストーリーを出す時間帯の外なので、${shortTime(plan.scheduledAt.slice(11, 16))} に出します（その時に枠が空いていれば）。`)
    return { plan, job }
  }

  const { runOneJob } = await import('./job-runner')
  const r = await runOneJob(job)
  if (!r.ran) return { plan, job }
  await reportCancelStory(job, r)
  return { plan, job, outcome: r.outcome }
}

/** キャンセルのストーリーを出した（出せなかった）ことを院長のLINEへ。定期実行で出したときも使う */
export async function reportCancelStory(job: PublishJob, r: JobRunResult): Promise<void> {
  if (!r.ran || !job.idempotencyKey.startsWith(CANCEL_STORY_KEY_PREFIX)) return
  const date = job.content.story?.dates[0] ?? ''
  const time = job.content.story?.requireSlot ?? ''
  const label = `${date ? storyDayLabel(date) : ''} ${shortTime(time)}`.trim()
  if (r.outcome === 'published') {
    const url = r.detail?.kind === 'published' ? r.detail.url : undefined
    await notifyCancelStory(`📣 キャンセルで空いた枠（${label}）を、Instagramのストーリーで知らせました。${url ? `\n${url}` : ''}`)
  } else if (r.outcome === 'skipped') {
    await notifyCancelStory(`キャンセル（${label}）のストーリーは出しませんでした：${r.detail?.kind === 'skipped' ? r.detail.message : ''}`)
  } else if (r.outcome === 'action_required') {
    const manual = r.detail?.kind === 'action_required' ? r.detail.manualUrl : ''
    await notifyCancelStory(`キャンセル（${label}）のストーリーは、Instagramとつながっていないため出せませんでした。画像を保存して手で出してください。\n${manual}`)
  } else if (r.job?.status === 'failed') {
    await notifyCancelStory(`キャンセル（${label}）のストーリーを出せませんでした（何度かやり直しましたが失敗しました。「投稿の予定と結果」の画面で理由を確認できます）。`)
  } else if (r.job?.attempts.length === 1) {
    // 1回目の失敗だけ知らせる（やり直しのたびには送らない）
    await notifyCancelStory(`キャンセル（${label}）のストーリーをまだ出せていません。5分後からやり直します。`)
  }
}

/** 院長のLINEへ短く知らせる（失敗しても止めない） */
async function notifyCancelStory(text: string): Promise<void> {
  try {
    const { notifyOwner } = await import('./owner-notify')
    await notifyOwner([text])
  } catch (error) {
    console.error('[cancel-story] 院長への通知に失敗しました', error)
  }
}
