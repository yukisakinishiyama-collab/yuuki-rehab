/**
 * 自動投稿パイプラインの保存先（KVストア。Supabase設定時はPostgres）
 *
 *   autopilot:settings          … 設定（本数・投稿枠・媒体・院長メモ）
 *   autopilot:week:YYYY-MM-DD   … 週ごとの投稿案（キーは対象週の月曜）
 */
import { kvGet, kvList, kvSet } from './kv-store-server'
import { DEFAULT_AUTOPILOT_SETTINGS, type AutopilotSettings, type WeeklyProposal } from './autopilot-types'

const SETTINGS_KEY = 'autopilot:settings'
const WEEK_KEY = (weekStart: string) => `autopilot:week:${weekStart}`

export async function getAutopilotSettings(): Promise<AutopilotSettings> {
  const stored = await kvGet<Partial<AutopilotSettings>>(SETTINGS_KEY)
  return { ...DEFAULT_AUTOPILOT_SETTINGS, ...(stored ?? {}) }
}

export async function saveAutopilotSettings(settings: AutopilotSettings): Promise<void> {
  await kvSet(SETTINGS_KEY, { ...settings, updatedAt: new Date().toISOString() })
}

export async function getProposal(weekStart: string): Promise<WeeklyProposal | null> {
  return kvGet<WeeklyProposal>(WEEK_KEY(weekStart))
}

export async function saveProposal(proposal: WeeklyProposal): Promise<void> {
  proposal.updatedAt = new Date().toISOString()
  await kvSet(WEEK_KEY(proposal.weekStart), proposal)
}

/** 投稿案の一覧（新しい週が先頭） */
export async function listProposals(): Promise<WeeklyProposal[]> {
  const rows = await kvList<WeeklyProposal>('autopilot:week:')
  return rows.map((r) => r.value).sort((a, b) => b.weekStart.localeCompare(a.weekStart))
}

/** 直近に使ったテーマID（新しい順）。同じテーマを続けて出さないために使う */
export async function recentThemeIds(limitWeeks = 12): Promise<string[]> {
  const proposals = (await listProposals()).slice(0, limitWeeks)
  return proposals.flatMap((p) => [...p.items].sort((a, b) => b.scheduledAt.localeCompare(a.scheduledAt)).map((i) => i.themeId))
}
