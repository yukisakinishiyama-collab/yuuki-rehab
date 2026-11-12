/**
 * 宣伝の短い動画（YouTubeショート・TikTok）の「承認してから自動で投稿」の決まり（純粋な関数。node で単体テストできる）
 *
 * 流れ（2026-11-12 院長の依頼「LINEに送ってもらって承認するで投稿する形」）:
 *   1. 投稿の前日（30時間前から。朝8時〜夜9時のあいだ）に、動画の見本と「承認して投稿」「今回は見送る」「別の動画にする」を院長のLINEへ
 *   2. 承認されたら、その時刻に Buffer 経由で YouTube・TikTok へ自動で投稿する（時刻を過ぎてからの承認なら、すぐ）
 *   3. 承認されないまま3時間前になったら、一度だけ念押し。時刻から24時間たっても承認が無ければ、今回は出さない
 *   承認したときの動画（URL）をそのまま出す（あとで動画を作り直しても、見て承認したものと違うものは出さない）
 * 自動で出せない媒体（Buffer につないでいない等）は、これまでどおり時間になったら動画と文を LINE へ届けて手で投稿（承認は要らない）。
 */
import { ownerCard, type OwnerMessage } from './owner-notify'

export interface PromoVideoSnapshot {
  url: string
  posterUrl: string
  /** 動画の指紋（作り直すと変わる） */
  hash: string
  aiImages: number
}

export interface PromoApprovalRequest {
  at: string
  delivered: boolean
  video: PromoVideoSnapshot
  /** 届かなかった理由（LINE未設定など） */
  reason?: string
}

export interface PromoApproval {
  status: 'approved' | 'skipped' | 'expired'
  at: string
  by: string
  /** 承認した動画（これを出す） */
  video?: PromoVideoSnapshot
}

/** 週の予定の1本（promo:week:<月曜> の items） */
export interface PromoPlanEntry {
  scheduledAt: string
  videoId: string
  campaign: string
  request?: PromoApprovalRequest
  /** 見本を作ってLINEに送っている途中（重なって2通送らないための目印） */
  requesting?: string
  remindedAt?: string
  approval?: PromoApproval
}

export const PROMO_APPROVAL_RULES = {
  /** 何時間前から承認をお願いするか */
  requestLeadHours: 30,
  /** 何時間前に念押しするか */
  reminderLeadHours: 3,
  /** 時刻から何時間、承認を待つか（過ぎたら今回は出さない） */
  expireAfterHours: 24,
  /** LINEに届かなかったとき、送り直すまで（分） */
  retryRequestMinutes: 60,
  /** 見本を作っている途中の目印が古くなるまで（分） */
  requestingStaleMinutes: 6,
  /** LINEを送ってよい時間（日本時間） */
  dayFrom: 8,
  dayTo: 21,
} as const

/** 'YYYY-MM-DDTHH:MM'（日本時間）に時間を足す */
export function addHoursLocal(local: string, hours: number): string {
  const t = Date.parse(`${local}:00Z`) + hours * 3600 * 1000
  return new Date(t).toISOString().slice(0, 16)
}

/** ISO の時刻を 'YYYY-MM-DDTHH:MM'（日本時間）に */
export function isoToLocal(iso: string): string {
  return new Date(Date.parse(iso) + 9 * 3600 * 1000).toISOString().slice(0, 16)
}

/** LINEを送ってよい時間か（朝8時〜夜9時） */
export function isDaytime(local: string): boolean {
  const h = Number(local.slice(11, 13))
  return h >= PROMO_APPROVAL_RULES.dayFrom && h < PROMO_APPROVAL_RULES.dayTo
}

export type PromoApprovalStatus = 'waiting' | 'approved' | 'skipped' | 'expired'

export function promoApprovalExpired(entry: PromoPlanEntry, nowLocal: string): boolean {
  return nowLocal >= addHoursLocal(entry.scheduledAt, PROMO_APPROVAL_RULES.expireAfterHours)
}

export function promoApprovalStatus(entry: PromoPlanEntry, nowLocal: string): PromoApprovalStatus {
  if (entry.approval?.status === 'approved') return 'approved'
  if (entry.approval?.status === 'skipped') return 'skipped'
  if (entry.approval?.status === 'expired' || promoApprovalExpired(entry, nowLocal)) return 'expired'
  return 'waiting'
}

/** 承認のお願い（見本つき）をLINEへ送る時か */
export function needsApprovalRequest(entry: PromoPlanEntry, nowLocal: string, nowIso: string): boolean {
  if (promoApprovalStatus(entry, nowLocal) !== 'waiting') return false
  if (nowLocal < addHoursLocal(entry.scheduledAt, -PROMO_APPROVAL_RULES.requestLeadHours)) return false
  if (entry.requesting && Date.parse(nowIso) - Date.parse(entry.requesting) < PROMO_APPROVAL_RULES.requestingStaleMinutes * 60 * 1000) return false
  if (!entry.request) return true
  // 届かなかったときだけ、しばらくおいて送り直す
  return !entry.request.delivered && Date.parse(nowIso) - Date.parse(entry.request.at) >= PROMO_APPROVAL_RULES.retryRequestMinutes * 60 * 1000
}

/** 念押しを送る時か（お願いが届いていて、まだ承認が無く、時刻の3時間前を過ぎた。お願い自体が3時間前より後なら送らない） */
export function needsApprovalReminder(entry: PromoPlanEntry, nowLocal: string): boolean {
  if (promoApprovalStatus(entry, nowLocal) !== 'waiting') return false
  if (!entry.request?.delivered || entry.remindedAt) return false
  const remindAt = addHoursLocal(entry.scheduledAt, -PROMO_APPROVAL_RULES.reminderLeadHours)
  return nowLocal >= remindAt && isoToLocal(entry.request.at) < remindAt
}

// ── LINE のボタン ─────────────────────────────────

export type PromoPostbackAction = 'ok' | 'skip' | 'swap'

/** 見本の目印（動画の指紋の頭8文字）。別の動画に変えたあと、古い見本のボタンで承認されないように */
export function promoVideoToken(hash: string): string {
  return hash.slice(0, 8)
}

/** ボタンの中身（ap:pv_<操作>:<週>:<番号>:<見本の目印>） */
export function promoPostback(action: PromoPostbackAction, week: string, n: number, token: string): string {
  return `ap:pv_${action}:${week}:${n}:${token}`
}

export function parsePromoPostback(data: string): { action: PromoPostbackAction; week: string; n: number; token: string } | null {
  const m = /^ap:pv_(ok|skip|swap):(\d{4}-\d{2}-\d{2}):(\d{1,2}):([A-Za-z0-9_-]{1,16})$/.exec(data)
  if (!m) return null
  return { action: m[1] as PromoPostbackAction, week: m[2], n: Number(m[3]), token: m[4] }
}

/** 別の動画にするとき：いまの動画の次から、予定に入っていない動画を選ぶ */
export function pickSwapVideo<T extends { id: string }>(currentId: string, avoid: string[], videos: T[]): T | null {
  if (videos.length < 2) return null
  const start = videos.findIndex((v) => v.id === currentId)
  for (let k = 1; k <= videos.length; k++) {
    const v = videos[(start + k + videos.length) % videos.length]
    if (v.id !== currentId && !avoid.includes(v.id)) return v
  }
  return videos.find((v) => v.id !== currentId) ?? null
}

// ── LINE の文 ─────────────────────────────────

const WEEK = '日月火水木金土'

/** '2026-11-18T13:30' → '11/18(水) 13:30' */
export function slotText(local: string): string {
  const [y, m, d] = local.slice(0, 10).split('-').map(Number)
  const day = new Date(Date.UTC(y, m - 1, d)).getUTCDay()
  return `${m}/${d}(${WEEK[day]}) ${local.slice(11, 16)}`
}

export type PromoRouteName = 'buffer' | 'youtube_api' | 'instagram_api' | 'manual'

export interface ApprovalMessageInput {
  week: string
  n: number
  entry: PromoPlanEntry
  title: string
  video: PromoVideoSnapshot
  /** 媒体ごとの出し方（オンの媒体だけ） */
  routes: Partial<Record<'youtube_short' | 'tiktok' | 'instagram_reel', PromoRouteName>>
  youtubeTitle?: string
  tiktokCaption?: string
  instagramCaption?: string
  appUrl: string
  nowLocal: string
}

const LABEL = { youtube_short: 'YouTube', tiktok: 'TikTok', instagram_reel: 'Instagramリール' } as const

function lists(routes: ApprovalMessageInput['routes']) {
  const auto = (Object.keys(routes) as Array<keyof typeof routes>).filter((c) => routes[c] && routes[c] !== 'manual').map((c) => LABEL[c])
  const manual = (Object.keys(routes) as Array<keyof typeof routes>).filter((c) => routes[c] === 'manual').map((c) => LABEL[c])
  return { auto, manual }
}

function approvalButtons(input: ApprovalMessageInput) {
  const token = promoVideoToken(input.video.hash)
  return [
    { label: '承認して投稿', postback: promoPostback('ok', input.week, input.n, token), primary: true },
    { label: '今回は見送る', postback: promoPostback('skip', input.week, input.n, token) },
    { label: '別の動画にする', postback: promoPostback('swap', input.week, input.n, token) },
    { label: 'アプリで見る', uri: `${input.appUrl}/marketing/autopilot?open=settings#promo-video` },
  ]
}

/** 承認のお願い（文・動画・貼る文・ボタン。LINE1通＝吹き出し4つまで） */
export function approvalRequestMessages(input: ApprovalMessageInput): OwnerMessage[] {
  const { auto, manual } = lists(input.routes)
  const past = input.nowLocal >= input.entry.scheduledAt
  const head = [
    '🎬 動画の確認のお願い',
    `${slotText(input.entry.scheduledAt)} に出す動画です。`,
    `「${input.title}」`,
    `→ ${auto.join('・')}${past ? '（承認すると、すぐに自動で投稿します）' : '（承認すると、時間になったら自動で投稿します）'}`,
    manual.length ? `※${manual.join('・')}は自動で出す連携がまだのため、時間になったらLINEで動画をお送りします（手で投稿）。` : null,
    '',
    '動画を見て、よければ「承認して投稿」を押してください。押さなければ投稿しません。',
    input.video.aiImages > 0 ? '※前半の絵はAIで作ったイメージです（投稿には「AIで作成」の申告を付けます）。' : null,
  ]
    .filter((x): x is string => x !== null)
    .join('\n')
  const out: OwnerMessage[] = [head]
  // LINE の動画は https のURLだけ（院内アプリのURLはパスワードの内側なので LINE からは読めない）
  const lineCanRead = (u: string) => /^https:\/\//.test(u) && !u.startsWith(input.appUrl)
  if (lineCanRead(input.video.url) && lineCanRead(input.video.posterUrl)) out.push({ type: 'video', originalContentUrl: input.video.url, previewImageUrl: input.video.posterUrl })
  const texts = [input.youtubeTitle ? `【YouTube 題名】\n${input.youtubeTitle}` : null, input.tiktokCaption ? `【TikTok の文】\n${input.tiktokCaption}` : null, input.instagramCaption ? `【Instagram の文】\n${input.instagramCaption}` : null].filter(Boolean)
  if (texts.length) out.push(texts.join('\n\n'))
  out.push(ownerCard('動画の確認のお願い', '承認しなかった動画は投稿しません。', approvalButtons(input)))
  return out
}

/** 念押し（文とボタンだけ。動画は前のメッセージ） */
export function approvalReminderMessages(input: ApprovalMessageInput): OwnerMessage[] {
  const expire = slotText(addHoursLocal(input.entry.scheduledAt, PROMO_APPROVAL_RULES.expireAfterHours))
  const text = [
    `⏰ ${slotText(input.entry.scheduledAt)} に出す動画「${input.title}」が、まだ承認されていません。`,
    '動画は前のメッセージにあります。承認すると自動で投稿します（時刻を過ぎていたら、すぐに）。',
    `${expire} までに承認が無ければ、今回は出しません。`,
  ].join('\n')
  return [ownerCard('動画の承認をお待ちしています', text, approvalButtons(input))]
}
