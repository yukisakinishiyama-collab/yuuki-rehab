/**
 * 自動化設定（集客 → 自動化設定）
 *
 * GET … 自動化ごとの状態・上限・止まる条件・動いた記録、公式LINE の今月の通数と上限、監査ログ
 *       （院長・スタッフとも見られる。お名前・LINE の ID は返さない）
 * PUT … 院長だけ。{ key, ... }
 *       - reservation_confirm … { mode: on|test|off, dailyLimit }
 *       - line_auto_reply     … { mode: on|test|off, lineMenu: classic|three }
 *       - autopilot           … { enabled }（自動投稿の「毎週の下書き」。中身の設定は自動投稿の画面）
 *       - cancel_story        … { enabled }（キャンセルのストーリー。時間帯・上限は自動投稿の画面）
 *       - birthday            … { enabled }（誕生日のご挨拶。文面は LINE導線の画面）
 *       変えたら監査ログに残す。
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, ROLE_HEADER } from '@/lib/marketing/auth'
import { getRules, listAudit, listRuns, recordAudit, saveRule } from '@/lib/marketing/automation-store-server'
import { MODE_LABELS, type AutomationMode, type LineMenuVariant } from '@/lib/marketing/automation-types'
import { fetchLineQuota } from '@/lib/marketing/line-quota-server'
import { getAutopilotSettings, listProposals, saveAutopilotSettings } from '@/lib/marketing/autopilot-store-server'
import { getLog as getBirthdayLog, getSettings as getBirthdaySettings, saveSettings as saveBirthdaySettings } from '@/lib/marketing/birthday-server'
import { listJobs } from '@/lib/marketing/jobs-store-server'

export const dynamic = 'force-dynamic'

/** キャンセルのストーリーの投稿ジョブの印（cancel-story-server.ts の CANCEL_STORY_KEY_PREFIX と同じ。
 *  画像を作る処理まで読み込まないよう、ここでは文字だけ持つ） */
const CANCEL_STORY_KEY_PREFIX = 'cancel-story:'

const MODES: AutomationMode[] = ['on', 'test', 'off']
const MENUS: LineMenuVariant[] = ['classic', 'three']

export async function GET() {
  try {
    const [rules, runs, quota, autopilot, proposals, birthday, birthdayLog, jobs, audit] = await Promise.all([
      getRules(),
      listRuns(7).catch(() => []),
      fetchLineQuota(),
      getAutopilotSettings().catch(() => null),
      listProposals().catch(() => []),
      getBirthdaySettings().catch(() => null),
      getBirthdayLog().catch(() => null),
      listJobs().catch(() => []),
      listAudit(20).catch(() => []),
    ])
    const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    const cancelStories = jobs
      .filter((j) => j.idempotencyKey.startsWith(CANCEL_STORY_KEY_PREFIX))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 5)
      .map((j) => ({ at: j.createdAt, scheduledAt: j.scheduledAt, status: j.status }))

    return NextResponse.json({
      ok: true,
      rules,
      runs: runs.slice(0, 100),
      quota,
      ownerLineSet: Boolean(process.env.RESERVATION_NOTIFY_LINE_USER_ID),
      lineConfigured: Boolean(process.env.LINE_CHANNEL_SECRET && process.env.LINE_CHANNEL_ACCESS_TOKEN),
      bookingConfigured: Boolean(process.env.RESERVATION_NOTIFY_SECRET),
      autopilot: autopilot
        ? {
            enabled: autopilot.enabled,
            postsPerWeek: autopilot.postsPerWeek,
            generateHour: autopilot.generateHour,
            cancelStory: autopilot.cancelStory,
            cancelStoryDays: autopilot.cancelStoryDays,
            cancelStoryLeadMinutes: autopilot.cancelStoryLeadMinutes,
            cancelStoryFromHour: autopilot.cancelStoryFromHour,
            cancelStoryToHour: autopilot.cancelStoryToHour,
            cancelStoryMaxPerDay: autopilot.cancelStoryMaxPerDay,
          }
        : null,
      autopilotHistory: proposals.slice(0, 4).map((p) => ({
        weekStart: p.weekStart,
        createdAt: p.createdAt,
        status: p.status,
        items: p.items.length,
        proposed: p.items.filter((i) => i.status === 'proposed').length,
        approved: p.items.filter((i) => i.status === 'approved').length,
        notifiedAt: p.notifiedAt ?? null,
      })),
      cancelStories,
      birthday: birthday
        ? {
            enabled: birthday.enabled,
            // お名前は返さない（数だけ）
            sent30: (birthdayLog?.recent ?? []).filter((r) => r.ok && r.at >= monthAgo).length,
            failed30: (birthdayLog?.recent ?? []).filter((r) => !r.ok && r.at >= monthAgo).length,
          }
        : null,
      audit,
    })
  } catch (error) {
    console.error('自動化設定の読み込みに失敗:', error instanceof Error ? error.message : error)
    return NextResponse.json({ ok: false, error: '自動化設定を読めませんでした' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  const denied = requireAdmin(request)
  if (denied) return denied
  let body: { key?: unknown; mode?: unknown; dailyLimit?: unknown; lineMenu?: unknown; enabled?: unknown }
  try {
    body = (await request.json()) as typeof body
  } catch {
    return NextResponse.json({ ok: false, error: '内容を読み取れませんでした' }, { status: 400 })
  }
  const role = request.headers.get(ROLE_HEADER) ?? 'local'
  const key = String(body.key ?? '')

  if (key === 'reservation_confirm' || key === 'line_auto_reply') {
    const mode = body.mode as AutomationMode
    if (!MODES.includes(mode)) return NextResponse.json({ ok: false, error: '動かし方の指定が正しくありません' }, { status: 400 })
    const rule: Parameters<typeof saveRule>[1] = { mode, updatedBy: role }
    if (key === 'reservation_confirm' && body.dailyLimit !== undefined) {
      const limit = Number(body.dailyLimit)
      if (!Number.isInteger(limit) || limit < 1 || limit > 500) {
        return NextResponse.json({ ok: false, error: '1日の上限は 1〜500 の数で入れてください' }, { status: 400 })
      }
      rule.dailyLimit = limit
    }
    if (key === 'line_auto_reply' && body.lineMenu !== undefined) {
      if (!MENUS.includes(body.lineMenu as LineMenuVariant)) {
        return NextResponse.json({ ok: false, error: '選択肢の形の指定が正しくありません' }, { status: 400 })
      }
      rule.lineMenu = body.lineMenu as LineMenuVariant
    }
    const before = (await getRules())[key]
    const rules = await saveRule(key, rule)
    const after = rules[key]
    const changes = [
      before.mode !== after.mode ? `${MODE_LABELS[before.mode]} → ${MODE_LABELS[after.mode]}` : '',
      before.dailyLimit !== after.dailyLimit ? `1日の上限 ${before.dailyLimit ?? '-'} → ${after.dailyLimit ?? '-'}` : '',
      before.lineMenu !== after.lineMenu ? `選択肢 ${before.lineMenu ?? '-'} → ${after.lineMenu ?? '-'}` : '',
    ].filter(Boolean)
    await recordAudit({
      role,
      action: '自動化設定を変更',
      target: key === 'reservation_confirm' ? '予約確認の LINE' : 'LINE の自動案内',
      detail: changes.join('、') || '変更なし',
    })
    return NextResponse.json({ ok: true, rules })
  }

  if (key === 'autopilot' || key === 'cancel_story' || key === 'birthday') {
    if (typeof body.enabled !== 'boolean') {
      return NextResponse.json({ ok: false, error: 'ON/OFF の指定が正しくありません' }, { status: 400 })
    }
    const enabled = body.enabled
    if (key === 'birthday') {
      const current = await getBirthdaySettings()
      await saveBirthdaySettings({ ...current, enabled })
    } else {
      const current = await getAutopilotSettings()
      await saveAutopilotSettings(key === 'autopilot' ? { ...current, enabled } : { ...current, cancelStory: enabled })
    }
    await recordAudit({
      role,
      action: '自動化設定を変更',
      target: key === 'autopilot' ? '投稿案の自動作成' : key === 'cancel_story' ? 'キャンセルの空き枠ストーリー' : '誕生日のご挨拶',
      detail: enabled ? 'ON にした' : 'OFF にした',
    })
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ ok: false, error: '不明な自動化です' }, { status: 400 })
}
