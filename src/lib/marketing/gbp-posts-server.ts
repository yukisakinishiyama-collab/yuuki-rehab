/**
 * Google へ出した投稿の「審査の結果」を確かめる（サーバー専用）
 *
 * Google は、投稿を受け取ったあとで審査し、決まりに合わないものを「拒否」にする（一般の人には見えない）。
 * これまでのアプリは、受け取ってもらえた時点で「公開済み」にしていたので、拒否に気づけなかった
 * （2026-10-30 の投稿が拒否されていたのに「公開済み」のままだった。2026-11-12 に調べた）。
 *
 * - checkGooglePosts()        … アプリから出した投稿を Google の一覧と照らし合わせる。拒否なら「公開失敗」にして理由を書く。
 *                               アプリの外（Googleの画面・予約投稿）で出した投稿の拒否も、半日に1回だけ見る
 * - notifyGoogleRejections()  … 新しい拒否を院長のLINEへ（1つの投稿につき1回だけ）
 * - googlePostsOverview()     … 「投稿の予定と結果」の画面に出す、Google の投稿の状態（10分は覚えておく）
 *
 * jobs/run から呼ぶ（実際の間隔は、Vercel の Cron で日本時間6〜21時は1時間ごと。GitHub Actions の「15分ごと」は
 * 数時間に1回しか動いていない。2026-11-13 に実行の記録で確かめた）。確かめる番のものが無ければ、Google には問い合わせない。
 * 拒否されないための決まり（ボタンのリンク・本文）は gbp-post-rules.ts。
 */
import { kvGet, kvSet } from './kv-store-server'
import { listJobs, updateJob, type PublishJob } from './jobs-store-server'
import { gbpAccessToken, getGbpCredentials } from './gbp-token'
import { notifyOwner, ownerCard } from './owner-notify'
import {
  GOOGLE_CHECK_DAYS,
  findLocalPost,
  googleButtonHost,
  googleCheckDue,
  googlePostState,
  googlePostTitle,
  isSafeGoogleButtonUrl,
  type GoogleLocalPost,
  type GooglePostState,
} from './gbp-post-rules'

const APP_URL = 'https://yuuki-rehab.vercel.app'
const GOOGLE_MANAGE_URL = 'https://business.google.com/'
const DAY_MS = 24 * 60 * 60 * 1000
/** アプリの外で出した投稿の拒否を見る間隔 */
const OUTSIDE_SCAN_MS = 12 * 60 * 60 * 1000
/** LINEで知らせるのは、この日数より新しい拒否だけ（古いものをまとめて知らせない） */
const NOTIFY_DAYS = 7
const WATCH_KEY = 'gbp:posts:watch'
const CACHE_KEY = 'gbp:posts:cache'
const CACHE_MS = 10 * 60 * 1000

export const GOOGLE_REJECTED_REASON =
  'Googleの審査で拒否され、公開されていません。同じ内容をそのまま出し直すと、また拒否されることがあります（ボタンのリンク・本文の電話番号やURL・同じ文のくり返しを確かめてください）。'

interface Watch {
  /** アプリの外で出した投稿を最後に見た時刻（うまく読めなくても進める） */
  triedAt?: string
  /** 知らせ済みの拒否（Google の投稿の名前。新しい200件） */
  seen?: string[]
}

/** Google の投稿の一覧（新しい順に最大100本）。Google と未接続なら null */
export async function fetchGoogleLocalPosts(): Promise<GoogleLocalPost[] | null> {
  const credentials = await getGbpCredentials()
  if (!credentials) return null
  const token = await gbpAccessToken(credentials)
  const res = await fetch(`https://mybusiness.googleapis.com/v4/${credentials.location}/localPosts?pageSize=100`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
    signal: AbortSignal.timeout(15000),
  })
  const data = (await res.json().catch(() => ({}))) as { localPosts?: GoogleLocalPost[]; error?: { message?: string } }
  if (!res.ok) throw new Error(`Googleの投稿の一覧を読めませんでした（${data.error?.message ?? `HTTP ${res.status}`}）`)
  // 使うところだけ残す（本文は書き出しだけ。画像のURLなどは持たない）
  return (Array.isArray(data.localPosts) ? data.localPosts : [])
    .filter((p) => typeof p?.name === 'string')
    .map((p) => ({
      name: p.name,
      state: p.state,
      summary: (p.summary ?? '').slice(0, 160),
      createTime: p.createTime,
      searchUrl: p.searchUrl,
      callToAction: p.callToAction ? { actionType: p.callToAction.actionType, url: p.callToAction.url } : undefined,
    }))
}

/**
 * Google へ出した時刻。出したときに控えた時刻（google.postedAt）。
 * この仕組みの前に出した古いジョブは、最初にうまくいった試行の時刻
 */
export function googlePublishedAt(job: Pick<PublishJob, 'attempts' | 'updatedAt' | 'google'>): string {
  return job.google?.postedAt ?? job.attempts.find((a) => a.ok)?.at ?? job.updatedAt
}

export interface GoogleCheckResult {
  checked: number
  live: number
  /** 今回の確認で、拒否と分かったアプリの投稿 */
  rejected: PublishJob[]
  /** アプリの外で出した投稿のうち、新しく拒否と分かったもの */
  outside: GoogleLocalPost[]
}

export async function checkGooglePosts(now = new Date()): Promise<GoogleCheckResult> {
  const result: GoogleCheckResult = { checked: 0, live: 0, rejected: [], outside: [] }
  const all = (await listJobs()).filter((j) => j.channel === 'google_business')
  const jobs = all.filter((j) => j.status === 'published')
  const due: PublishJob[] = []
  for (const job of jobs) {
    const verdict = googleCheckDue({ publishedAt: googlePublishedAt(job), checkedAt: job.google?.checkedAt, done: job.google?.done }, now)
    if (verdict === 'check') due.push(job)
    else if (verdict === 'finish') {
      await updateJob(job.id, (j) => {
        j.google = { ...(j.google ?? {}), done: true }
      })
    }
  }
  const watch = (await kvGet<Watch>(WATCH_KEY)) ?? {}
  const scanOutside = !watch.triedAt || now.getTime() - Date.parse(watch.triedAt) >= OUTSIDE_SCAN_MS
  if (due.length === 0 && !scanOutside) return result

  if (scanOutside) await kvSet(WATCH_KEY, { ...watch, triedAt: now.toISOString() } satisfies Watch)
  let posts: GoogleLocalPost[] | null
  try {
    posts = await fetchGoogleLocalPosts()
  } catch (error) {
    console.warn('[gbp-posts] Googleの投稿の状態を読めませんでした', error instanceof Error ? error.message : error)
    return result
  }
  if (!posts) return result
  await kvSet(CACHE_KEY, { at: now.toISOString(), posts })

  // アプリから出した投稿の名前（拒否と分かって「公開失敗」にしたものも入れる。アプリの外の投稿と取りちがえないように）
  const appNames = new Set<string>()
  for (const job of all) if (job.google?.name) appNames.add(job.google.name)

  for (const job of due.slice(0, 12)) {
    const publishedAt = googlePublishedAt(job)
    const post = findLocalPost({ name: job.google?.name, body: job.content.body, publishedAt }, posts)
    const state: GooglePostState = post ? googlePostState(post.state) : 'unknown'
    const before = job.google?.state
    const finished = now.getTime() - Date.parse(publishedAt) > GOOGLE_CHECK_DAYS * DAY_MS
    if (post) appNames.add(post.name)
    result.checked += 1
    if (state === 'rejected') {
      const updated = await updateJob(job.id, (j) => {
        j.status = 'failed'
        j.actionReason = GOOGLE_REJECTED_REASON
        j.google = { ...(j.google ?? {}), name: post?.name ?? j.google?.name, state, checkedAt: now.toISOString(), done: true }
        j.attempts.push({ at: now.toISOString(), ok: false, message: 'Googleの審査で拒否されました（公開されていません）' })
      })
      if (updated) result.rejected.push(updated)
      continue
    }
    if (state === 'live') result.live += 1
    await updateJob(job.id, (j) => {
      j.google = { ...(j.google ?? {}), name: post?.name ?? j.google?.name, state, checkedAt: now.toISOString(), ...(finished ? { done: true } : {}) }
      if (state === 'live' && before !== 'live') {
        j.attempts.push({ at: now.toISOString(), ok: true, message: 'Googleで公開されていることを確かめました' })
        if (post?.searchUrl && !j.publishedUrl) j.publishedUrl = post.searchUrl
      }
      if (state === 'unknown' && finished && before !== 'live') {
        j.attempts.push({ at: now.toISOString(), ok: true, message: 'Googleの投稿の一覧に見つからず、公開を確かめられませんでした。Googleの画面で確かめてください' })
      }
    })
  }

  // アプリの外（Googleの画面・予約投稿）で出した投稿の拒否。知らせるのは新しいものを1回だけ
  if (scanOutside) {
    const seen = new Set(watch.seen ?? [])
    const fresh = posts.filter(
      (p) =>
        googlePostState(p.state) === 'rejected' &&
        !appNames.has(p.name) &&
        !seen.has(p.name) &&
        now.getTime() - Date.parse(p.createTime ?? '') <= NOTIFY_DAYS * DAY_MS,
    )
    result.outside = fresh
  }
  return result
}

function formatAt(iso: string | undefined): string {
  const t = Date.parse(iso ?? '')
  if (!Number.isFinite(t)) return ''
  const jst = new Date(t + 9 * 60 * 60 * 1000)
  return `${jst.getUTCMonth() + 1}/${jst.getUTCDate()} ${String(jst.getUTCHours()).padStart(2, '0')}:${String(jst.getUTCMinutes()).padStart(2, '0')}`
}

/** 新しい拒否を院長のLINEへ（アプリの投稿は1つにつき1回・アプリの外の投稿も1回だけ）。送れた件数を返す */
export async function notifyGoogleRejections(result: Pick<GoogleCheckResult, 'rejected' | 'outside'>, now = new Date()): Promise<number> {
  const jobs = result.rejected.filter((j) => !j.google?.notifiedAt && now.getTime() - Date.parse(googlePublishedAt(j)) <= NOTIFY_DAYS * DAY_MS)
  const outside = result.outside
  if (jobs.length === 0 && outside.length === 0) return 0
  const lines = [
    ...jobs.map((j) => `・「${j.content.title || googlePostTitle(j.content.body)}」（${formatAt(googlePublishedAt(j))} に院内アプリから）`),
    ...outside.map((p) => `・「${googlePostTitle(p.summary)}」（${formatAt(p.createTime)} にGoogleの画面から）`),
  ]
  const text = [
    '⚠ Googleの投稿が、Googleの審査で拒否されました（公開されていません）',
    '',
    ...lines.slice(0, 8),
    '',
    'よくある理由：',
    '・ボタンのリンクが、院のホームページ以外（予約システムのアドレスなど）',
    '・本文に電話番号やURLが入っている',
    '・同じ文をくり返し出している',
    '同じ内容をそのまま出し直すと、また拒否されることがあります。',
  ].join('\n')
  const card = ownerCard('Googleの投稿が拒否されました', '投稿の状態は、下のボタンから確かめられます', [
    { label: '投稿の予定と結果', uri: `${APP_URL}/marketing/jobs`, primary: true },
    { label: 'Googleを開く', uri: GOOGLE_MANAGE_URL },
  ])
  const sent = await notifyOwner([text, card])
  if (!sent.delivered) return 0
  for (const job of jobs) {
    await updateJob(job.id, (j) => {
      j.google = { ...(j.google ?? {}), notifiedAt: now.toISOString() }
    })
  }
  if (outside.length > 0) {
    const watch = (await kvGet<Watch>(WATCH_KEY)) ?? {}
    await kvSet(WATCH_KEY, { ...watch, seen: [...(watch.seen ?? []), ...outside.map((p) => p.name)].slice(-200) } satisfies Watch)
  }
  return jobs.length + outside.length
}

export interface GooglePostRow {
  createTime: string
  state: GooglePostState
  title: string
  /** ボタンの種類（BOOK＝予約・CALL＝今すぐ電話・LEARN_MORE＝詳細 など。無ければ ''） */
  button: string
  /** ボタンのリンク先の名前（例 shimonoseki-yuuki.com）。電話のボタンは '' */
  linkHost: string
  /** リンク先が、入れてよい場所（院のホームページ・公式LINE）か。リンクが無ければ true */
  linkOk: boolean
  /** 院内アプリから出した投稿 */
  fromApp: boolean
  searchUrl?: string
}

export interface GooglePostsOverview {
  connected: boolean
  at?: string
  counts: { total: number; live: number; rejected: number; processing: number }
  /** 拒否された投稿（新しい順） */
  rejected: GooglePostRow[]
  /** 新しい投稿（状態によらず、新しい順に8本） */
  recent: GooglePostRow[]
  error?: string
}

/** 「投稿の予定と結果」の画面に出す、Google の投稿の状態。10分は覚えておく（force で読み直す） */
export async function googlePostsOverview(force = false, now = new Date()): Promise<GooglePostsOverview> {
  const empty = { total: 0, live: 0, rejected: 0, processing: 0 }
  if (!(await getGbpCredentials())) return { connected: false, counts: empty, rejected: [], recent: [] }
  let cache = await kvGet<{ at: string; posts: GoogleLocalPost[] }>(CACHE_KEY)
  let error: string | undefined
  if (force || !cache || now.getTime() - Date.parse(cache.at) > CACHE_MS) {
    try {
      const posts = await fetchGoogleLocalPosts()
      if (posts) {
        cache = { at: now.toISOString(), posts }
        await kvSet(CACHE_KEY, cache)
      }
    } catch (e) {
      error = e instanceof Error ? e.message : 'Googleの投稿の一覧を読めませんでした'
    }
  }
  if (!cache) return { connected: true, counts: empty, rejected: [], recent: [], error }
  const appNames = new Set((await listJobs()).map((j) => j.google?.name).filter((n): n is string => Boolean(n)))
  const rows = cache.posts.map((p): GooglePostRow => {
    const url = p.callToAction?.url
    return {
      createTime: p.createTime ?? '',
      state: googlePostState(p.state),
      title: googlePostTitle(p.summary),
      button: p.callToAction?.actionType ?? '',
      linkHost: googleButtonHost(url),
      linkOk: !url || isSafeGoogleButtonUrl(url),
      fromApp: appNames.has(p.name),
      searchUrl: p.searchUrl,
    }
  })
  rows.sort((a, b) => b.createTime.localeCompare(a.createTime))
  const count = (s: GooglePostState) => rows.filter((r) => r.state === s).length
  return {
    connected: true,
    at: cache.at,
    counts: { total: rows.length, live: count('live'), rejected: count('rejected'), processing: count('processing') },
    rejected: rows.filter((r) => r.state === 'rejected').slice(0, 20),
    recent: rows.slice(0, 8),
    error,
  }
}
