/**
 * 自動化設定・動いた記録・監査ログの保存（サーバー専用）
 *
 * 置き場所は集客と同じ KV（頭 `mkt:`）。指示書の automation_rules / automation_runs / audit_logs にあたる。
 * - mkt:automation:rules       … 設定（院長だけが変えられる。API 側で requireAdmin）
 * - mkt:runs:YYYY-MM-DD        … 動いた記録（日本時間の日ごと。1日 1000 件まで）
 * - mkt:audit:YYYY-MM          … 監査ログ（月ごと。1か月 2000 件まで）
 * どれも、お名前・LINE の ID・電話番号など個人を特定できるものは入れない。
 *
 * 設定が読めないとき（保存先の障害）は、今までどおりの既定（DEFAULT_AUTOMATION_RULES）で動かす。
 * 予約確認・LINE案内は以前から動いているもので、保存先の障害で急に止まると困るため。
 */
import { kvGet, kvList, kvSet } from './kv-store-server'
import {
  DEFAULT_AUTOMATION_RULES,
  type AuditEntry,
  type AutomationKey,
  type AutomationRule,
  type AutomationRules,
  type AutomationRun,
} from './automation-types'

const RULES_KEY = 'mkt:automation:rules'
const RUNS_KEY = (day: string) => `mkt:runs:${day}`
const AUDIT_KEY = (month: string) => `mkt:audit:${month}`

/** 日本時間の 'YYYY-MM-DD' */
export function jstDay(at: Date = new Date()): string {
  return new Date(at.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10)
}

export async function getRules(): Promise<AutomationRules> {
  const stored = await kvGet<Partial<AutomationRules>>(RULES_KEY).catch(() => null)
  return {
    reservation_confirm: { ...DEFAULT_AUTOMATION_RULES.reservation_confirm, ...(stored?.reservation_confirm ?? {}) },
    line_auto_reply: { ...DEFAULT_AUTOMATION_RULES.line_auto_reply, ...(stored?.line_auto_reply ?? {}) },
  }
}

export async function getRule(key: AutomationKey): Promise<AutomationRule> {
  return (await getRules())[key]
}

export async function saveRule(key: AutomationKey, rule: AutomationRule): Promise<AutomationRules> {
  const rules = await getRules()
  rules[key] = { ...rules[key], ...rule, updatedAt: new Date().toISOString() }
  await kvSet(RULES_KEY, rules)
  return rules
}

/** 動いた記録を足す（失敗しても呼び出し元の処理は止めない） */
export async function recordRun(run: Omit<AutomationRun, 'at'>): Promise<void> {
  try {
    const at = new Date()
    const key = RUNS_KEY(jstDay(at))
    const bucket = (await kvGet<AutomationRun[]>(key)) ?? []
    bucket.push({ ...run, note: run.note.slice(0, 80), at: at.toISOString() })
    await kvSet(key, bucket.slice(-1000))
  } catch (error) {
    console.error('自動化の記録に失敗:', error instanceof Error ? error.message : error)
  }
}

/** 直近 days 日の動いた記録（新しい順） */
export async function listRuns(days = 7): Promise<AutomationRun[]> {
  const since = jstDay(new Date(Date.now() - (days - 1) * 24 * 60 * 60 * 1000))
  const buckets = await kvList<AutomationRun[]>('mkt:runs:')
  return buckets
    .filter((b) => b.key.slice('mkt:runs:'.length) >= since && Array.isArray(b.value))
    .flatMap((b) => b.value)
    .sort((a, b) => b.at.localeCompare(a.at))
}

/** 今日（日本時間）に「送った」数。1日の上限の判定に使う */
export async function sentToday(key: AutomationKey): Promise<number> {
  const bucket = (await kvGet<AutomationRun[]>(RUNS_KEY(jstDay())).catch(() => null)) ?? []
  return bucket.filter((r) => r.automation === key && r.result === 'sent').length
}

export async function recordAudit(entry: Omit<AuditEntry, 'at'>): Promise<void> {
  try {
    const at = new Date()
    const key = AUDIT_KEY(jstDay(at).slice(0, 7))
    const bucket = (await kvGet<AuditEntry[]>(key)) ?? []
    bucket.push({ ...entry, at: at.toISOString() })
    await kvSet(key, bucket.slice(-2000))
  } catch (error) {
    console.error('監査ログの記録に失敗:', error instanceof Error ? error.message : error)
  }
}

/** 直近の監査ログ（新しい順） */
export async function listAudit(limit = 50): Promise<AuditEntry[]> {
  const buckets = await kvList<AuditEntry[]>('mkt:audit:')
  return buckets
    .filter((b) => Array.isArray(b.value))
    .flatMap((b) => b.value)
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, limit)
}
