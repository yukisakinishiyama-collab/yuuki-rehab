/**
 * 自動投稿パイプライン本体（サーバー専用）
 *
 *   runAutopilot()          … 定期実行（GitHub Actions 15分ごと・Vercel Cron）。
 *                             日曜夕方に翌週分の下書きを作って院長へLINE通知／
 *                             承認されないまま時刻が過ぎた案を「期限切れ」に／前日リマインド
 *   applyProposalAction()   … 承認画面・LINEボタンからの操作（承認・見送り・修正・作り直し）
 *   nudgeManualPosts()      … API未接続の媒体（Google・未接続のInstagram）の投稿時刻に、
 *                             本文と「投稿した」ボタンを院長のLINEへ送る
 *   handleOwnerPostback()   … 院長のLINEのボタン（全部承認／投稿した）の処理
 *
 * 大原則: 承認されていない案は絶対に投稿しない。承認は院長（管理者）だけ。
 * 患者さんの情報はAIに送らない（テーマはテーマ集と院長メモのみ）。
 */
import { SITE_URL } from '@/lib/site/seo'
import { DEFAULT_CLINIC_PROFILE } from './clinic'
import { checkGenerated, generateVariants } from './generate-server'
import { createJob, getJob, updateJob, type PublishJob } from './jobs-store-server'
import { fetchHubStats } from './booking-stats'
import { notifyOwner, ownerCard, type OwnerMessage } from './owner-notify'
import {
  addDays,
  addMinutesLocal,
  availabilityText,
  dueWeekStart,
  jstParts,
  manualTargetWeek,
  mondayOf,
  pickThemes,
  planSlots,
  trackingUrl,
  weekdayOf,
} from './autopilot-planner'
import {
  getAutopilotSettings,
  getProposal,
  recentThemeIds,
  saveAutopilotSettings,
  saveProposal,
} from './autopilot-store-server'
import { CATEGORY_PATTERN, THEME_LIBRARY, type ThemeSeed } from './theme-library'
import {
  activeVariants,
  approvalBlocker,
  type AutopilotSettings,
  type ProposalItem,
  type ThemeCategory,
  type WeeklyProposal,
} from './autopilot-types'
import { CHANNEL_LABELS, type Channel, type ClinicProfile, type ContentVariant, type GeneratedContent, type Objective } from './types'

export const AUTOPILOT_URL = `${SITE_URL}/marketing/autopilot`
const GOOGLE_MANAGE_URL = 'https://business.google.com/'
/** 「生成中」の印がこれより古ければ、途中で止まったとみなして作り直す */
const STALE_GENERATING_MS = 10 * 60 * 1000
/** 投稿案を作ってからこの時間が経つまでは前日リマインドを送らない */
const REMIND_AFTER_MS = 12 * 60 * 60 * 1000

const WEEK = ['日', '月', '火', '水', '木', '金', '土']

/** 'YYYY-MM-DDTHH:MM' → '10/27(火) 12:00' */
export function formatSlot(local: string): string {
  const day = local.slice(0, 10)
  return `${Number(day.slice(5, 7))}/${Number(day.slice(8, 10))}(${WEEK[weekdayOf(day)]}) ${local.slice(11, 16)}`
}

export function profileFor(settings: AutopilotSettings): ClinicProfile {
  return { ...DEFAULT_CLINIC_PROFILE, ...(settings.clinicProfile ?? {}) } as ClinicProfile
}

export function channelsFor(settings: AutopilotSettings): Channel[] {
  const channels: Channel[] = []
  if (settings.instagram !== 'off') channels.push(settings.instagram)
  if (settings.google) channels.push('google_business')
  return channels
}

/** 計測リンクの流入元（予約システムの「流入元」列と同じ値） */
function sourceFor(channel: Channel): string {
  if (channel.startsWith('instagram')) return 'instagram'
  if (channel === 'google_business') return 'google_post'
  if (channel === 'line_broadcast') return 'line'
  return 'website'
}

/** 投稿ごとの計測名（例: ap20261026-1）。予約システムに残り、どの投稿から予約が入ったかが分かる */
export function campaignFor(week: string, index: number): string {
  return `ap${week.replace(/-/g, '')}-${index}`
}

/** CTAのリンクを計測リンクに差し替える（AIが書いたURLは使わない） */
function withTracking(variant: ContentVariant, week: string, index: number): ContentVariant {
  const url = trackingUrl(SITE_URL, sourceFor(variant.channel), campaignFor(week, index))
  const label = variant.content.cta?.label || (variant.channel === 'google_business' ? '予約' : 'ネット予約')
  return { ...variant, content: { ...variant.content, cta: { label, url } } }
}

interface Seed {
  id: string
  category: ThemeCategory
  objective: Objective
  theme: string
  keyMessage: string
  audience: string
  sitePath?: string
}

const COMMON_NOTES = [
  '「治療」ではなく「施術」と書く（柔道整復の広告ルールに配慮）。',
  '患者さんの体験談・症例・ビフォーアフター・満足度などは書かない。',
  '一般的な情報提供として書き、強い痛み・しびれ・腫れが続くなどの場合は医療機関の受診も案内する。',
]

function channelNotesFor(seed: Seed): Partial<Record<Channel, string>> {
  const site = seed.sitePath ? `${SITE_URL}${seed.sitePath}` : ''
  const instagram =
    'キャプション内のURLはタップできないため、URLは書かずに「ご予約・ご相談はプロフィールのリンクから」と案内する。'
  return {
    instagram_feed: instagram,
    instagram_carousel: `${instagram} 最後のスライドは「ご予約はプロフィールのリンクから／ネット予約24時間受付」にする。`,
    google_business: site
      ? `予約ボタンは別に付くので、本文の最後に「くわしくはこちら：${site}」を1回だけ載せてよい（ほかのURLは書かない）。`
      : '予約ボタンは別に付くので、本文にURLは書かない。',
  }
}

async function draftItem(
  seed: Seed,
  scheduledAt: string,
  index: number,
  week: string,
  settings: AutopilotSettings,
  month: number,
): Promise<ProposalItem> {
  const profile = profileFor(settings)
  const channels = channelsFor(settings)
  const notes = [...COMMON_NOTES, `投稿する時期: ${month}月。`].join('\n')
  const result = await generateVariants(
    {
      objective: seed.objective,
      theme: seed.theme,
      audience: seed.audience,
      keyMessage: seed.keyMessage,
      notes,
      tone: profile.defaultTone,
      channels,
      channelNotes: channelNotesFor(seed),
      profile,
    },
    { parallel: true },
  )
  return {
    id: crypto.randomUUID(),
    scheduledAt,
    category: seed.category,
    themeId: seed.id,
    objective: seed.objective,
    theme: seed.theme,
    sitePath: seed.sitePath,
    campaign: campaignFor(week, index),
    variants: result.variants.map((v) => withTracking(v, week, index)),
    status: 'proposed',
    errors: result.errors.map((e) => `${CHANNEL_LABELS[e.channel]}: ${e.error}`),
  }
}

/** 「今週の空き状況」（Googleのみ・定型文）。空きの少ない週や予約システム未対応なら作らない */
async function draftAvailability(
  week: string,
  nowLocal: string,
  settings: AutopilotSettings,
  index: number,
): Promise<ProposalItem | null> {
  const limit = addMinutesLocal(nowLocal, 30)
  let scheduledAt = ''
  for (let i = 0; i < 5; i += 1) {
    const at = `${addDays(week, i)}T08:30`
    if (at > limit) {
      scheduledAt = at
      break
    }
  }
  if (!scheduledAt) return null
  const stats = await fetchHubStats(1)
  if (!stats || stats.openings.length === 0) return null
  const profile = profileFor(settings)
  const text = availabilityText(stats.openings, week, nowLocal, profile.phone)
  if (!text) return null

  const content: GeneratedContent = {
    title: text.title,
    hook: text.title,
    body: text.body,
    cta: { label: '予約', url: profile.reserveUrl },
    hashtags: [],
    warnings: ['予約システムの空き枠数から自動で作った定型文です（AIは使っていません）'],
  }
  const variant: ContentVariant = {
    id: crypto.randomUUID(),
    channel: 'google_business',
    content,
    compliance: checkGenerated(content, profile.bannedPhrases),
    status: 'draft',
  }
  return {
    id: crypto.randomUUID(),
    scheduledAt,
    category: 'availability',
    themeId: 'availability',
    objective: '予約枠案内',
    theme: text.title,
    campaign: campaignFor(week, index),
    variants: [withTracking(variant, week, index)],
    status: 'proposed',
  }
}

function seedFromLibrary(t: ThemeSeed): Seed {
  return { ...t }
}

function ownerSeed(week: string, note: string): Seed {
  return {
    id: `owner-${week}`,
    category: 'owner',
    objective: 'その他',
    theme: note.slice(0, 200),
    keyMessage: '',
    audience: '',
  }
}

/** 週の投稿案を作る（保存・院長への通知まで）。作るものが無ければ null */
export async function generateWeek(week: string, now: Date): Promise<{ proposal: WeeklyProposal | null; message: string }> {
  const settings = await getAutopilotSettings()
  const jst = jstParts(now)
  const count = Math.min(Math.max(Math.floor(settings.postsPerWeek), 1), 5)
  const slots = planSlots(week, settings.slots, count, jst.local)
  const channels = channelsFor(settings)
  const wantsAvailability = settings.availabilityPost && settings.google

  if ((slots.length === 0 || channels.length === 0) && !wantsAvailability) {
    return { proposal: null, message: 'この週に作れる投稿枠がありません（時刻が過ぎているか、媒体がすべてオフです）' }
  }

  // 二重に作らないよう、先に「生成中」の印を置く
  const proposal: WeeklyProposal = { weekStart: week, createdAt: now.toISOString(), status: 'generating', items: [] }
  await saveProposal(proposal)

  const month = Number(addDays(week, 2).slice(5, 7))
  const pattern = (CATEGORY_PATTERN[count] ?? CATEGORY_PATTERN[3]).slice(0, slots.length)
  const recent = await recentThemeIds()
  const seeds: Seed[] = pickThemes(THEME_LIBRARY, pattern, recent, month, week).map(seedFromLibrary)
  const note = settings.ownerNote.trim()
  const usedNote = Boolean(note && seeds.length > 0)
  if (usedNote) seeds[0] = ownerSeed(week, note)

  const items: ProposalItem[] = []
  if (channels.length > 0) {
    const drafted = await Promise.all(
      seeds.map((seed, i) => draftItem(seed, slots[i], i + 1, week, settings, month)),
    )
    items.push(...drafted)
  }
  if (wantsAvailability) {
    try {
      const availability = await draftAvailability(week, jst.local, settings, items.length + 1)
      if (availability) items.push(availability)
    } catch {
      // 空き状況が取れない週は、その1本を作らないだけ
    }
  }

  proposal.items = items.sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt))
  proposal.status = 'ready'
  proposal.mode = process.env.MARKETING_MODE === 'mock' || !process.env.ANTHROPIC_API_KEY ? 'mock' : 'live'
  await saveProposal(proposal)

  if (usedNote) {
    await saveAutopilotSettings({ ...settings, ownerNote: '' })
  }

  const usable = proposal.items.filter((i) => i.variants.length > 0)
  if (usable.length > 0) {
    const result = await notifyOwner(weeklyNotice(proposal))
    proposal.notifiedAt = result.delivered ? new Date().toISOString() : undefined
    proposal.notifyResult = result.delivered ? 'LINEで通知しました' : `LINE通知なし（${result.reason ?? '不明'}）`
    await saveProposal(proposal)
  }

  return { proposal, message: `${usable.length}本の投稿案を作りました` }
}

/** 下書き完成のお知らせ（本文＋「全部承認」「内容を確認」ボタン） */
function weeklyNotice(proposal: WeeklyProposal): OwnerMessage[] {
  const items = proposal.items.filter((i) => i.variants.length > 0)
  const lines = items.map((item) => {
    const channels = activeVariants(item)
      .map((v) => (v.channel === 'google_business' ? 'Google' : 'Instagram'))
      .join('＋')
    const flag = item.variants.some((v) => v.compliance.status === 'blocked')
      ? ' ⛔要修正'
      : item.variants.some((v) => v.compliance.status === 'review')
        ? ' ⚠注意点あり'
        : ''
    const hook = item.variants[0]?.content.hook ?? ''
    return `■ ${formatSlot(item.scheduledAt)}［${channels}］${flag}\n${item.theme}${hook && hook !== item.theme ? `\n「${hook.slice(0, 40)}」` : ''}`
  })
  const text = [
    `📝 ${formatSlot(items[0].scheduledAt).split(' ')[0]}からの投稿案ができました（${items.length}本）`,
    '',
    ...lines,
    '',
    '内容を確認して承認すると、予定の時刻に投稿されます。',
    '承認しなかった投稿は出ません。',
  ].join('\n')
  return [
    ownerCard('来週の投稿案ができました', text, [
      { label: '内容を確認する', uri: `${AUTOPILOT_URL}?week=${proposal.weekStart}`, primary: true },
      { label: 'このまま全部承認', postback: `ap:approve_all:${proposal.weekStart}` },
    ]),
  ]
}

export interface RunSummary {
  ok: true
  generated?: { week: string; items: number; message: string }
  expired: number
  reminded: boolean
  skippedReason?: string
}

/** 定期実行。重い処理（AI生成）は週1回だけ */
export async function runAutopilot(now = new Date()): Promise<RunSummary> {
  const settings = await getAutopilotSettings()
  const jst = jstParts(now)
  const thisMonday = mondayOf(jst.date)
  const summary: RunSummary = { ok: true, expired: 0, reminded: false }

  // 1) 承認されないまま時刻が過ぎた案は「期限切れ」に（投稿しない）／前日リマインド
  for (const week of [thisMonday, addDays(thisMonday, 7)]) {
    const proposal = await getProposal(week)
    if (!proposal || proposal.status !== 'ready') continue
    let changed = false
    for (const item of proposal.items) {
      if (item.status === 'proposed' && item.scheduledAt <= jst.local) {
        item.status = 'expired'
        summary.expired += 1
        changed = true
      }
    }
    const soon = proposal.items.filter(
      (i) => i.status === 'proposed' && i.variants.length > 0 && i.scheduledAt <= addMinutesLocal(jst.local, 24 * 60),
    )
    // 作った直後（12時間以内）はリマインドしない（「できました」のお知らせと重ならないように）
    const settled = now.getTime() - new Date(proposal.createdAt).getTime() > REMIND_AFTER_MS
    if (!proposal.remindedAt && settled && soon.length > 0 && settings.enabled) {
      const result = await notifyOwner([
        ownerCard(
          '投稿案の承認をお待ちしています',
          [
            '⏰ まもなく予定の投稿が、まだ承認されていません',
            '',
            ...soon.map((i) => `■ ${formatSlot(i.scheduledAt)}\n${i.theme}`),
            '',
            '承認しないと投稿されません（見送る場合はそのままで大丈夫です）。',
          ].join('\n'),
          [
            { label: '内容を確認する', uri: `${AUTOPILOT_URL}?week=${week}`, primary: true },
            { label: 'このまま全部承認', postback: `ap:approve_all:${week}` },
          ],
        ),
      ])
      proposal.remindedAt = new Date().toISOString()
      summary.reminded = result.delivered
      changed = true
    }
    if (changed) await saveProposal(proposal)
  }

  // 2) 週に1回の下書き作成
  if (!settings.enabled) {
    summary.skippedReason = '自動下書きはオフです'
    return summary
  }
  const due = dueWeekStart(now, settings.generateHour)
  if (!due) return summary
  const existing = await getProposal(due)
  const stale = existing?.status === 'generating' && now.getTime() - new Date(existing.createdAt).getTime() > STALE_GENERATING_MS
  if (existing && !stale) return summary

  const { proposal, message } = await generateWeek(due, now)
  summary.generated = { week: due, items: proposal?.items.length ?? 0, message }
  return summary
}

/** 承認画面の「今すぐ作る」。今週の枠が残っていれば今週、なければ来週の分 */
export async function generateNow(now = new Date()): Promise<{ ok: boolean; week?: string; message: string }> {
  const settings = await getAutopilotSettings()
  const count = Math.min(Math.max(Math.floor(settings.postsPerWeek), 1), 5)
  const jst = jstParts(now)
  const thisMonday = mondayOf(jst.date)
  const thisWeek = await getProposal(thisMonday)
  const week = manualTargetWeek(now, settings.slots, count, (w) => w === thisMonday && Boolean(thisWeek))
  const existing = await getProposal(week)
  if (existing) {
    const stale = existing.status === 'generating' && now.getTime() - new Date(existing.createdAt).getTime() > STALE_GENERATING_MS
    if (!stale) {
      return {
        ok: false,
        week,
        message:
          existing.status === 'generating'
            ? 'いま作成中です。1〜2分ほど待ってから画面を更新してください'
            : 'この週の投稿案はもうあります。1本ずつ「作り直す」が使えます',
      }
    }
  }
  const { proposal, message } = await generateWeek(week, now)
  return { ok: Boolean(proposal), week, message }
}

// ── 承認画面・LINEボタンからの操作 ───────────────────────────────

export type ProposalAction =
  | { action: 'approve_item'; itemId: string }
  | { action: 'approve_all' }
  | { action: 'unapprove_item'; itemId: string }
  | { action: 'skip_item'; itemId: string }
  | { action: 'restore_item'; itemId: string }
  | { action: 'toggle_channel'; itemId: string; channel: Channel; exclude: boolean }
  | {
      action: 'edit_variant'
      itemId: string
      variantId: string
      title?: string
      hook?: string
      body?: string
      hashtags?: string[]
    }
  | { action: 'regenerate_item'; itemId: string; theme?: string }

/** 公開を左右する操作（院長＝管理者だけ） */
export const ADMIN_ACTIONS = new Set(['approve_item', 'approve_all', 'unapprove_item', 'skip_item', 'restore_item'])

export interface ActionResult {
  ok: boolean
  message: string
  proposal?: WeeklyProposal
}

async function approveOne(week: string, item: ProposalItem, actor: string, nowLocal: string): Promise<string | null> {
  const blocker = approvalBlocker(item)
  if (blocker) return blocker
  const scheduledAt = item.scheduledAt > nowLocal ? item.scheduledAt : nowLocal
  const jobIds: string[] = []
  for (const variant of activeVariants(item)) {
    const { job } = await createJob({
      idempotencyKey: `autopilot:${week}:${item.id}:${variant.channel}`,
      projectId: `autopilot:${week}`,
      variantId: variant.id,
      channel: variant.channel,
      theme: item.theme,
      content: variant.content,
      scheduledAt,
    })
    jobIds.push(job.id)
  }
  item.status = 'approved'
  item.approvedAt = new Date().toISOString()
  item.approvedBy = actor
  item.jobIds = jobIds
  return null
}

function nextSeedFor(item: ProposalItem, proposal: WeeklyProposal, recent: string[], month: number): Seed | null {
  const category = item.category === 'owner' ? 'expertise' : item.category
  if (category === 'availability') return null
  const used = new Set([item.themeId, ...proposal.items.map((i) => i.themeId)])
  const pool = THEME_LIBRARY.filter((t) => !used.has(t.id))
  const [pick] = pickThemes(pool, [category], recent, month, `${proposal.weekStart}:${Date.now()}`)
  return pick ? seedFromLibrary(pick) : null
}

export async function applyProposalAction(week: string, input: ProposalAction, actor: string): Promise<ActionResult> {
  const proposal = await getProposal(week)
  if (!proposal) return { ok: false, message: 'この週の投稿案が見つかりません' }
  if (proposal.status !== 'ready') return { ok: false, message: '投稿案を作成中です。少し待ってから操作してください' }
  const nowLocal = jstParts(new Date()).local

  if (input.action === 'approve_all') {
    const targets = proposal.items.filter((i) => i.status === 'proposed' && i.variants.length > 0)
    if (targets.length === 0) return { ok: false, message: '承認待ちの投稿案はありません', proposal }
    let approved = 0
    const skipped: string[] = []
    for (const item of targets) {
      const blocker = await approveOne(week, item, actor, nowLocal)
      if (blocker) skipped.push(`${formatSlot(item.scheduledAt)}「${item.theme.slice(0, 20)}」: ${blocker}`)
      else approved += 1
    }
    await saveProposal(proposal)
    const message = [`${approved}本を承認しました。予定の時刻に投稿します。`, ...(skipped.length ? ['承認できなかった案:', ...skipped] : [])].join('\n')
    return { ok: approved > 0, message, proposal }
  }

  const item = proposal.items.find((i) => i.id === input.itemId)
  if (!item) return { ok: false, message: '投稿案が見つかりません', proposal }
  const editable = item.status === 'proposed' || item.status === 'expired'

  switch (input.action) {
    case 'approve_item': {
      const blocker = await approveOne(week, item, actor, nowLocal)
      if (blocker) return { ok: false, message: blocker, proposal }
      await saveProposal(proposal)
      const when = item.scheduledAt > nowLocal ? `${formatSlot(item.scheduledAt)}に投稿します` : '時刻を過ぎているため、次の実行（15分以内）で投稿します'
      return { ok: true, message: `承認しました。${when}`, proposal }
    }
    case 'unapprove_item': {
      if (item.status !== 'approved') return { ok: false, message: '承認済みの案ではありません', proposal }
      const started: string[] = []
      for (const jobId of item.jobIds ?? []) {
        const job = await getJob(jobId)
        if (!job) continue
        if (job.status === 'pending' || job.status === 'action_required') {
          await updateJob(jobId, (j) => {
            j.status = 'cancelled'
          })
        } else if (job.status !== 'cancelled') {
          started.push(CHANNEL_LABELS[job.channel])
        }
      }
      if (started.length > 0) {
        await saveProposal(proposal)
        return { ok: false, message: `${started.join('・')}はすでに投稿処理が始まっているため取り消せません（投稿ジョブ画面で確認してください）`, proposal }
      }
      item.status = item.scheduledAt <= nowLocal ? 'expired' : 'proposed'
      item.jobIds = []
      item.approvedAt = undefined
      item.approvedBy = undefined
      await saveProposal(proposal)
      return { ok: true, message: '承認を取り消しました（投稿されません）', proposal }
    }
    case 'skip_item': {
      if (!editable) return { ok: false, message: '承認済みの案は、先に承認を取り消してください', proposal }
      item.status = 'skipped'
      await saveProposal(proposal)
      return { ok: true, message: 'この案は見送りにしました', proposal }
    }
    case 'restore_item': {
      if (item.status !== 'skipped') return { ok: false, message: '見送りの案ではありません', proposal }
      item.status = item.scheduledAt <= nowLocal ? 'expired' : 'proposed'
      await saveProposal(proposal)
      return { ok: true, message: '承認待ちに戻しました', proposal }
    }
    case 'toggle_channel': {
      if (!editable) return { ok: false, message: '承認済みの案は変更できません', proposal }
      const set = new Set(item.excludedChannels ?? [])
      if (input.exclude) set.add(input.channel)
      else set.delete(input.channel)
      item.excludedChannels = [...set]
      await saveProposal(proposal)
      return { ok: true, message: input.exclude ? `${CHANNEL_LABELS[input.channel]}には出さない設定にしました` : `${CHANNEL_LABELS[input.channel]}にも出します`, proposal }
    }
    case 'edit_variant': {
      if (!editable) return { ok: false, message: '承認済みの案は、先に承認を取り消してから直してください', proposal }
      const variant = item.variants.find((v) => v.id === input.variantId)
      if (!variant) return { ok: false, message: '媒体が見つかりません', proposal }
      const content = { ...variant.content }
      if (typeof input.title === 'string') content.title = input.title.slice(0, 200)
      if (typeof input.hook === 'string') content.hook = input.hook.slice(0, 300)
      if (typeof input.body === 'string' && input.body.trim()) content.body = input.body.slice(0, 5000)
      if (Array.isArray(input.hashtags)) content.hashtags = input.hashtags.map((h) => String(h).slice(0, 50)).slice(0, 30)
      variant.content = content
      variant.editedAt = new Date().toISOString()
      // 直したら必ず表現チェックをやり直す
      variant.compliance = checkGenerated(content, profileFor(await getAutopilotSettings()).bannedPhrases)
      await saveProposal(proposal)
      const status = variant.compliance.status === 'blocked' ? '（まだNG表現があります）' : variant.compliance.status === 'review' ? '（注意点があります）' : ''
      return { ok: true, message: `保存して表現チェックをやり直しました${status}`, proposal }
    }
    case 'regenerate_item': {
      if (!editable) return { ok: false, message: '承認済みの案は作り直せません', proposal }
      const settings = await getAutopilotSettings()
      const month = Number(addDays(week, 2).slice(5, 7))
      const index = proposal.items.indexOf(item) + 1
      let replacement: ProposalItem | null
      if (item.category === 'availability') {
        replacement = await draftAvailability(week, nowLocal, settings, index)
        if (replacement) replacement.scheduledAt = item.scheduledAt
      } else {
        const theme = input.theme?.trim()
        const seed = theme ? ownerSeed(week, theme) : nextSeedFor(item, proposal, await recentThemeIds(), month)
        if (!seed) return { ok: false, message: '別のテーマが見つかりませんでした。テーマを入力して作り直してください', proposal }
        if (theme) seed.id = `owner-${week}-${index}`
        replacement = await draftItem(seed, item.scheduledAt, index, week, settings, month)
      }
      if (!replacement) return { ok: false, message: '作り直せませんでした（空き状況を取得できません）', proposal }
      replacement.id = item.id
      replacement.status = item.status
      Object.assign(item, replacement)
      await saveProposal(proposal)
      return {
        ok: item.variants.length > 0,
        message: item.variants.length > 0 ? `「${item.theme.slice(0, 30)}」で作り直しました` : '作り直しに失敗しました。時間をおいてもう一度お試しください',
        proposal,
      }
    }
  }
  return { ok: false, message: '不明な操作です', proposal }
}

// ── 手動投稿のお知らせ（Google・未接続のInstagram） ─────────────────

/** 自動投稿のジョブか（idempotencyKey = autopilot:<週>:<案ID>:<媒体>） */
function autopilotItemKey(job: PublishJob): string | null {
  const parts = job.idempotencyKey.split(':')
  return parts[0] === 'autopilot' && parts.length >= 4 ? `${parts[1]}:${parts[2]}` : null
}

/**
 * 投稿の時刻になったが手動対応になったジョブを、案ごとに1通（＝LINE1通分）にまとめて院長へ送る。
 * 送る内容: やり方 → 各媒体の本文（長押しでコピー） → 「投稿した」ボタン
 */
export async function nudgeManualPosts(jobs: PublishJob[]): Promise<number> {
  const groups = new Map<string, PublishJob[]>()
  for (const job of jobs) {
    const key = autopilotItemKey(job)
    if (!key) continue
    groups.set(key, [...(groups.get(key) ?? []), job])
  }
  let sent = 0
  for (const group of groups.values()) {
    const google = group.find((j) => j.channel === 'google_business')
    const instagram = group.find((j) => j.channel.startsWith('instagram'))
    const head = [
      `📌 投稿の時間です（${formatSlot(group[0].scheduledAt)}）`,
      `「${group[0].theme}」`,
      '',
      google
        ? `▶ Google：次の吹き出しを長押し→コピー。Googleマップアプリ（またはビジネスプロフィール）の「投稿を追加」に貼り付け、ボタンは「予約」・リンクは\n${google.content.cta?.url ?? ''}`
        : null,
      instagram
        ? '▶ Instagram：連携がまだのため手動です。本文の吹き出しをコピーし、「画像を開く」の画像（または院の写真）と一緒にInstagramアプリから投稿してください。'
        : null,
      '',
      '投稿したら、いちばん下のボタンを押してください。',
    ]
      .filter((x): x is string => x !== null)
      .join('\n')
    const messages: OwnerMessage[] = [head]
    if (google) messages.push(google.content.body)
    if (instagram) messages.push(`${instagram.content.body}\n\n${(instagram.content.hashtags ?? []).join(' ')}`.trim())
    const imageUrl = instagram
      ? `${SITE_URL}/api/marketing/image?${new URLSearchParams({
          title: (instagram.content.imageText || instagram.content.slides?.[0]?.heading || instagram.content.title || instagram.theme).slice(0, 30),
          subtitle: instagram.content.hook.slice(0, 30),
          size: 'instagram',
        }).toString()}`
      : ''
    const buttons = [
      ...(google ? [{ label: 'Googleに投稿した', postback: `ap:done:${google.id}`, primary: true }] : []),
      ...(instagram ? [{ label: 'Instagramに投稿した', postback: `ap:done:${instagram.id}`, primary: !google }] : []),
      ...(instagram ? [{ label: '画像を開く', uri: imageUrl }] : []),
      ...(google ? [{ label: 'Googleを開く', uri: GOOGLE_MANAGE_URL }] : []),
      { label: '投稿ジョブ画面', uri: `${SITE_URL}/marketing/jobs` },
    ].slice(0, 4)
    messages.push(ownerCard('投稿の時間です', '投稿が終わったら押してください（記録が残ります）', buttons))
    const result = await notifyOwner(messages)
    if (result.delivered) sent += 1
  }
  return sent
}

/** 院長のLINEのボタン（webhookで送り主が院長本人と確認済みのときだけ呼ぶ） */
export async function handleOwnerPostback(data: string): Promise<string[]> {
  const [, action, arg] = data.split(':')
  if (action === 'approve_all' && /^\d{4}-\d{2}-\d{2}$/.test(arg ?? '')) {
    const result = await applyProposalAction(arg, { action: 'approve_all' }, 'LINE（院長）')
    const tail = result.ok ? '\n\n内容の確認・取り消しはこちら：\n' + `${AUTOPILOT_URL}?week=${arg}` : ''
    return [`${result.ok ? '✅ ' : ''}${result.message}${tail}`]
  }
  if (action === 'done' && arg) {
    const job = await getJob(arg)
    if (!job) return ['投稿ジョブが見つかりませんでした']
    if (job.status === 'published') return ['すでに完了になっています👍']
    if (job.status !== 'action_required' && job.status !== 'pending') return ['このジョブは完了にできない状態です（投稿ジョブ画面で確認してください）']
    await updateJob(job.id, (j) => {
      j.status = 'published'
      j.attempts.push({ at: new Date().toISOString(), ok: true, message: '院長がLINEから手動投稿の完了を記録' })
    })
    return [`✅ ${CHANNEL_LABELS[job.channel]}の投稿を完了にしました。おつかれさまです！`]
  }
  return ['このボタンは期限切れか、無効です']
}

