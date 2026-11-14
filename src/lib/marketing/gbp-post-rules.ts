/**
 * Googleの投稿（Googleビジネスプロフィール）が「拒否」されないための決まり（純粋な関数）
 *
 * 2026-11-12 に Google の投稿一覧（97本・うち拒否13本）を調べて分かったこと:
 * - 「予約」ボタンのリンクが予約システム（script.google.com）の投稿 … 10/22〜10/30 の7本がすべて拒否。
 *   同じ文で、ボタンを「今すぐ電話」にしたもの・公式LINE（lin.ee）にしたものは公開された
 * - 本文に電話番号を書いた投稿 … 拒否（Google のヘルプにも「拒否されることがあります」とある）
 * - 院内アプリは、Google が受け取った時点で「公開済み」にしていた。あとで拒否されても気づけなかった
 *
 * そこで、院内アプリから Google へ出す投稿は
 * - ボタンのリンクは、院のホームページ（shimonoseki-yuuki.com）か公式LINE（lin.ee）だけ。
 *   それ以外（予約システム・院内アプリの転送リンクなど）は、院のホームページのページに置きかえる
 * - 本文から URL と電話番号を取る（「くわしくは：URL」の行は行ごと消す）
 * - 出したあと、Google の審査の結果（公開・拒否）を確かめる（gbp-posts-server.ts）
 *
 * 型の import だけにしてあるので、node で単体テストできる（tools/test-gbp-post-rules.mjs）。
 */
import { GBP_SEO_POSTS, GBP_SITE } from '../../data/gbp-seo-posts'

/** Google の投稿のボタンに入れてよいリンク先（これまで拒否されていない・院の公式の場所） */
export const GOOGLE_BUTTON_HOSTS = ['shimonoseki-yuuki.com', 'www.shimonoseki-yuuki.com', 'lin.ee']

/** 置きかえるときの、ふつうの入口（はじめての方へ。ネット予約・LINE・電話のボタンがある） */
export const GOOGLE_BUTTON_FALLBACK_PATH = '/first-visit'

const CAMPAIGN_RE = /^[A-Za-z0-9_-]{1,60}$/

export function isSafeGoogleButtonUrl(url: string | undefined): boolean {
  if (!url) return false
  try {
    const u = new URL(url)
    return u.protocol === 'https:' && GOOGLE_BUTTON_HOSTS.includes(u.hostname)
  } catch {
    return false
  }
}

/** 計測名（どの投稿から来たか）。もとのリンクの campaign、無ければ投稿ジョブの印（gbpseo:2026-11-09:1 → seo20261109-1） */
export function googleCampaign(ctaUrl: string | undefined, jobKey?: string): string {
  try {
    const u = new URL(ctaUrl ?? '')
    const c = u.searchParams.get('campaign') ?? u.searchParams.get('utm_campaign') ?? ''
    if (CAMPAIGN_RE.test(c)) return c
  } catch {
    /* リンクが無い・読めないときは下へ */
  }
  const seo = /^gbpseo:(\d{4})-(\d{2})-(\d{2}):(\d+)$/.exec(jobKey ?? '')
  if (seo) return `seo${seo[1]}${seo[2]}${seo[3]}-${seo[4]}`
  return 'gbp'
}

/** 院のホームページのページを、ボタンのリンクにする（どの投稿から来たかは utm_source / utm_campaign で残る） */
export function siteButtonUrl(sitePath: string, campaign: string): string {
  const path = sitePath.startsWith('/') ? sitePath : `/${sitePath}`
  const qs = new URLSearchParams({ utm_source: 'google_post', utm_campaign: CAMPAIGN_RE.test(campaign) ? campaign : 'gbp' })
  return `${GBP_SITE}${path}?${qs.toString()}`
}

/**
 * Google へ出すときのボタンのリンク。
 * 入れてよい場所（院のホームページ・公式LINE）ならそのまま。それ以外は、院のホームページのページに置きかえる
 * （Google検索向けの投稿はその症状のページ、ほかは「はじめての方へ」）。リンクが無い投稿は、ボタン無しのまま
 */
export function googleButtonUrl(input: { ctaUrl?: string; seoPostId?: string; jobKey?: string }): string | undefined {
  const { ctaUrl, seoPostId, jobKey } = input
  if (!ctaUrl || !/^https:\/\//.test(ctaUrl)) return undefined
  if (isSafeGoogleButtonUrl(ctaUrl)) return ctaUrl
  const post = seoPostId ? GBP_SEO_POSTS.find((p) => p.id === seoPostId) : undefined
  return siteButtonUrl(post?.sitePath ?? GOOGLE_BUTTON_FALLBACK_PATH, googleCampaign(ctaUrl, jobKey))
}

const URL_RE = /https?:\/\/[^\s<>「」『』（）()、。]+/g
/** 電話番号（市外局番から。全角の数字・いろいろな横棒・かっこ区切りも。日付や時刻・郵便番号は当たらない） */
const PHONE_RE = /(?<![0-9０-９])(?:[0０][0-9０-９]{1,4}[-‐‑–—―ー－(（][0-9０-９]{1,4}[-‐‑–—―ー－)）][0-9０-９]{3,4}|[0０][0-9０-９]{9,10})(?![0-9０-９])/g
/** URL・電話番号を取ったあと、見出しだけが残った行（「くわしくは：」「■お電話：」「TEL」「☎」など）は、行ごと消す */
const LABEL_WORDS_RE = /^(TEL|Tel|tel|ＴＥＬ|電話|お電話|電話番号|お電話番号|くわしくは|詳しくは|詳細は|くわしくはこちら|詳しくはこちら|ホームページ|HP|公式サイト|ウェブサイト|URL)?$/
function isLabelOnly(line: string): boolean {
  if (/[:：]\s*$/.test(line)) return true
  return LABEL_WORDS_RE.test(line.replace(/[\s・■□●◆▶▷※☎📞\-–—―／/]/gu, ''))
}

/**
 * Google へ出す本文。URL と電話番号を取る（Google に拒否されるため）。
 * 取ったあと見出しだけになった行（「くわしくは：」「■お電話：」）は行ごと消し、空のかっこも消す。
 * URL も電話番号も無い行は、1文字も変えない
 */
export function googleSummary(body: string): { text: string; urls: number; phones: number } {
  let urls = 0
  let phones = 0
  const lines: string[] = []
  for (const raw of body.replace(/\r\n?/g, '\n').split('\n')) {
    let line = raw.replace(URL_RE, () => {
      urls += 1
      return ''
    })
    line = line.replace(PHONE_RE, () => {
      phones += 1
      return ''
    })
    if (line === raw) {
      lines.push(raw)
      continue
    }
    line = line
      .replace(/[（(]\s*[）)]/g, '')
      .replace(/ {2,}/g, ' ')
      .replace(/[ \t\u3000]+$/g, '')
    if (isLabelOnly(line)) continue
    lines.push(line)
  }
  const text = lines
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
  return { text, urls, phones }
}

// ── 出したあとの確認（Google の審査の結果） ─────────────────

export type GooglePostState = 'live' | 'rejected' | 'processing' | 'unknown'

/** Google の API の state（LIVE / REJECTED / PROCESSING）を、アプリの中の言い方に */
export function googlePostState(raw: string | undefined): GooglePostState {
  if (raw === 'LIVE') return 'live'
  if (raw === 'REJECTED') return 'rejected'
  if (raw === 'PROCESSING') return 'processing'
  return 'unknown'
}

/** Google の投稿の一覧の1件（使うところだけ） */
export interface GoogleLocalPost {
  name: string
  state?: string
  summary?: string
  createTime?: string
  searchUrl?: string
  callToAction?: { actionType?: string; url?: string }
}

function norm(text: string | undefined): string {
  return (text ?? '').replace(/\s+/g, '')
}

/**
 * 投稿ジョブに当たる Google の投稿を探す。
 * 名前（accounts/…/localPosts/…）が分かっていればそれで。分からない古いジョブは、本文の書き出し（40字）が同じもののうち、
 * 出した時刻にいちばん近いもの（前後3日まで）
 */
export function findLocalPost(
  job: { name?: string; body: string; publishedAt: string },
  posts: GoogleLocalPost[],
): GoogleLocalPost | null {
  if (job.name) return posts.find((p) => p.name === job.name) ?? null
  const head = norm(googleSummary(job.body).text).slice(0, 40)
  const rawHead = norm(job.body).slice(0, 40)
  if (head.length < 12) return null
  const at = Date.parse(job.publishedAt)
  let best: GoogleLocalPost | null = null
  let bestGap = 3 * 24 * 60 * 60 * 1000
  for (const p of posts) {
    const s = norm(p.summary)
    if (!s.startsWith(head) && !s.startsWith(rawHead)) continue
    const gap = Math.abs(Date.parse(p.createTime ?? '') - at)
    if (Number.isFinite(gap) && gap <= bestGap) {
      best = p
      bestGap = gap
    }
  }
  return best
}

/** 確かめるのをやめるまでの日数（公開されたあとで取り下げられることがあるので、しばらく見る） */
export const GOOGLE_CHECK_DAYS = 7

/**
 * いま確かめる番か。出してから2時間は jobs/run のたびに（10分より間を空けて。実際はおよそ1時間ごと）、そのあとは6時間おき、7日たったら終わり。
 * まだ一度も確かめていない古いジョブ（この仕組みの前に出したもの）は、45日前までなら1回だけ確かめる
 */
export function googleCheckDue(
  job: { publishedAt: string; checkedAt?: string; done?: boolean },
  now: Date,
): 'check' | 'wait' | 'finish' {
  if (job.done) return 'wait'
  const age = now.getTime() - Date.parse(job.publishedAt)
  if (!Number.isFinite(age) || age < 0) return 'wait'
  const day = 24 * 60 * 60 * 1000
  if (!job.checkedAt) return age <= 45 * day ? 'check' : 'finish'
  if (age > GOOGLE_CHECK_DAYS * day) return 'finish'
  const since = now.getTime() - Date.parse(job.checkedAt)
  const every = age <= 2 * 60 * 60 * 1000 ? 10 * 60 * 1000 : 6 * 60 * 60 * 1000
  return since >= every ? 'check' : 'wait'
}

/** 画面に出す1行目（【…】の見出し。無ければ書き出し） */
export function googlePostTitle(summary: string | undefined): string {
  const first = (summary ?? '').trim().split('\n')[0] ?? ''
  return first.length > 40 ? `${first.slice(0, 39)}…` : first
}

/** ボタンのリンク先の名前（画面に出す。くわしい住所は出さない） */
export function googleButtonHost(url: string | undefined): string {
  try {
    return new URL(url ?? '').hostname
  } catch {
    return ''
  }
}
