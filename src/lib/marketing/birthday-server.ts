/**
 * 誕生日のご挨拶（公式LINE）— サーバー側
 *
 * カルテ連携で結びついた方（linelink:）の生年月日を見て、誕生日の朝に1通送る。
 * - 設定は KV の keiei:birthday（オン／オフ・文面）。文面の {name} はお名前に置き換える
 * - 同じ年に2回送らないよう、送った年を keiei:birthday-log に残す
 * - 2/29 生まれは、うるう年でない年は 2/28 に送る（lib/birthday.ts と同じ決め方）
 * - 送る相手は封印（sealed）から取り出した userId。生の userId は保存しない
 */
import { kvGet, kvList, kvSet } from './kv-store-server'
import { unsealUserId } from '@/lib/liff-ticket'
import { daysUntilBirthday } from '@/lib/birthday'
import type { LineLink } from '@/lib/line-link'
import { DEFAULT_CLINIC_PROFILE } from './clinic'

export const BIRTHDAY_KEY = 'keiei:birthday'
const LOG_KEY = 'keiei:birthday-log'

export interface BirthdaySettings {
  enabled: boolean
  template: string
  updatedAt?: string
}

export const DEFAULT_TEMPLATE = [
  '{name}さん、お誕生日おめでとうございます🎂',
  '今年も元気に動ける一年になりますように。',
  '体のことで気になることがあれば、いつでもご相談ください。',
  '',
  DEFAULT_CLINIC_PROFILE.name,
].join('\n')

export const DEFAULT_SETTINGS: BirthdaySettings = { enabled: false, template: DEFAULT_TEMPLATE }

interface LogStore {
  /** key → 送った年（'YYYY'） */
  sentYear: Record<string, string>
  /** 最近の送信（新しい順・100件まで。名前と日付だけ） */
  recent: Array<{ at: string; name: string; ok: boolean; error?: string }>
}

export async function getSettings(): Promise<BirthdaySettings> {
  const s = await kvGet<BirthdaySettings>(BIRTHDAY_KEY)
  return s ? { ...DEFAULT_SETTINGS, ...s } : DEFAULT_SETTINGS
}

export async function saveSettings(s: BirthdaySettings): Promise<void> {
  await kvSet(BIRTHDAY_KEY, { ...s, updatedAt: new Date().toISOString() })
}

export async function getLog(): Promise<LogStore> {
  const l = await kvGet<LogStore>(LOG_KEY)
  return l ?? { sentYear: {}, recent: [] }
}

export function render(template: string, name: string): string {
  return template.replace(/\{name\}/g, name).replace(/\{氏名\}/g, name)
}

/** 誕生日が今日〜days 日以内の、結びついている方（名前・日付だけ） */
export async function upcoming(days = 14, now = new Date()): Promise<Array<{ key: string; name: string; birthDate: string; inDays: number }>> {
  const links = (await kvList<LineLink>('linelink:')).map((r) => r.value).filter((l) => l && l.birthDate)
  return links
    .map((l) => ({ key: l.key, name: l.name, birthDate: l.birthDate!, inDays: daysUntilBirthday(l.birthDate, now) ?? 999 }))
    .filter((x) => x.inDays <= days)
    .sort((a, b) => a.inDays - b.inDays)
}

async function push(userId: string, text: string): Promise<{ ok: boolean; error?: string }> {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN
  if (!token) return { ok: false, error: 'LINE未接続' }
  const res = await fetch('https://api.line.me/v2/bot/message/push', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ to: userId, messages: [{ type: 'text', text }] }),
  })
  if (res.ok) return { ok: true }
  const data = (await res.json().catch(() => ({}))) as { message?: string }
  return { ok: false, error: data.message ?? `HTTP ${res.status}` }
}

/** 院長のLINEへ見本を送る（文面の確認用） */
export async function sendSample(template: string): Promise<{ ok: boolean; error?: string }> {
  const owner = process.env.RESERVATION_NOTIFY_LINE_USER_ID
  if (!owner) return { ok: false, error: '院長のLINE（RESERVATION_NOTIFY_LINE_USER_ID）が未設定' }
  return push(owner, `【見本】\n${render(template, '山田 太郎')}`)
}

export interface RunResult {
  date: string
  sent: number
  skipped: number
  errors: number
  details: Array<{ name: string; ok: boolean; error?: string }>
}

/** 今日が誕生日の方へ送る（毎朝の定期実行から。何度呼ばれても同じ年に2回は送らない） */
export async function runBirthday(now = new Date()): Promise<RunResult> {
  const jst = new Date(now.getTime() + 9 * 3_600_000)
  const date = jst.toISOString().slice(0, 10)
  const year = date.slice(0, 4)
  const result: RunResult = { date, sent: 0, skipped: 0, errors: 0, details: [] }
  const settings = await getSettings()
  if (!settings.enabled) return result
  const secret = process.env.RESERVATION_NOTIFY_SECRET
  if (!secret) return result
  const log = await getLog()
  const links = (await kvList<LineLink>('linelink:')).map((r) => r.value).filter((l) => l && l.birthDate && l.sealed)
  for (const l of links) {
    if (daysUntilBirthday(l.birthDate, now) !== 0) continue
    if (log.sentYear[l.key] === year) {
      result.skipped += 1
      continue
    }
    const userId = unsealUserId(l.sealed, secret)
    if (!userId) {
      result.errors += 1
      result.details.push({ name: l.name, ok: false, error: '封印を開けません' })
      continue
    }
    const r = await push(userId, render(settings.template, l.name))
    if (r.ok) {
      result.sent += 1
      log.sentYear[l.key] = year
    } else {
      result.errors += 1
    }
    result.details.push({ name: l.name, ok: r.ok, error: r.error })
    log.recent.unshift({ at: new Date().toISOString(), name: l.name, ok: r.ok, error: r.error })
  }
  log.recent = log.recent.slice(0, 100)
  await kvSet(LOG_KEY, log)
  return result
}
