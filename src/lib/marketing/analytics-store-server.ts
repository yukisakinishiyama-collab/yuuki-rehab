/**
 * 効果測定イベントストア（指示書17章）
 *
 * 個人を特定しない集計用イベントのみを記録する（userIdはLINE内部IDの
 * 末尾ハッシュのみ保持し、氏名等は保存しない）。
 */
import fs from 'node:fs'
import path from 'node:path'

export type AnalyticsEventKind =
  | 'line_follow' // 友だち追加
  | 'line_intent' // 相談入口を選択
  | 'line_guide' // 来院案内まで到達
  | 'line_urgent' // 緊急案内
  | 'line_handoff' // 人対応へ切替
  | 'link_click' // 計測リンクのクリック（予約・地図・Instagram等）

export interface AnalyticsEvent {
  at: string
  kind: AnalyticsEventKind
  /** 集計軸: intent / source / campaign / dest / channel など */
  meta: Record<string, string>
  /** 匿名化した行為者キー（同一ユーザーの重複集計を防ぐ用途のみ） */
  actor?: string
}

interface AnalyticsDb {
  events: AnalyticsEvent[]
}

function dbPath(): string {
  const local = path.join(process.cwd(), '.data')
  try {
    fs.mkdirSync(local, { recursive: true })
    return path.join(local, 'marketing-analytics.json')
  } catch {
    return path.join('/tmp', 'marketing-analytics.json')
  }
}

function load(): AnalyticsDb {
  try {
    return JSON.parse(fs.readFileSync(dbPath(), 'utf-8')) as AnalyticsDb
  } catch {
    return { events: [] }
  }
}

export function recordEvent(kind: AnalyticsEventKind, meta: Record<string, string> = {}, actor?: string) {
  const db = load()
  db.events.push({
    at: new Date().toISOString(),
    kind,
    meta,
    actor: actor ? anonymize(actor) : undefined,
  })
  // 直近2万件のみ保持
  db.events = db.events.slice(-20000)
  fs.writeFileSync(dbPath(), JSON.stringify(db))
}

export function listEvents(sinceIso: string): AnalyticsEvent[] {
  return load().events.filter((e) => e.at >= sinceIso)
}

/** LINE userIdなどをそのまま保存しないための単純ハッシュ */
function anonymize(value: string): string {
  let hash = 0
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) | 0
  }
  return `a${Math.abs(hash).toString(36)}`
}
