/**
 * 効果測定イベントストア（指示書17章）
 *
 * 個人を特定しない集計用イベントのみを記録する（userIdはLINE内部IDの
 * ハッシュのみ保持し、氏名等は保存しない）。
 * 保存先はKVストア（Supabase設定時はPostgres・未設定時はローカルファイル）。
 * 日別バケット（analytics:YYYY-MM-DD）に分けて追記する。
 */
import { kvGet, kvList, kvSet } from './kv-store-server'

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

const DAY_KEY = (day: string) => `analytics:${day}`

export async function recordEvent(kind: AnalyticsEventKind, meta: Record<string, string> = {}, actor?: string) {
  // 計測はベストエフォート: await されずに呼ばれる箇所があるため、
  // ここで例外を握らないと未処理Promise拒否でリクエスト自体を壊しかねない
  try {
    const at = new Date().toISOString()
    const day = at.slice(0, 10)
    const bucket = (await kvGet<AnalyticsEvent[]>(DAY_KEY(day))) ?? []
    bucket.push({ at, kind, meta, actor: actor ? anonymize(actor) : undefined })
    // 1日あたり上限（暴走・攻撃対策）
    await kvSet(DAY_KEY(day), bucket.slice(-5000))
  } catch (error) {
    console.error('計測イベントの記録に失敗:', error instanceof Error ? error.message : error)
  }
}

export async function listEvents(sinceIso: string): Promise<AnalyticsEvent[]> {
  const sinceDay = sinceIso.slice(0, 10)
  const buckets = await kvList<AnalyticsEvent[]>('analytics:')
  return buckets
    .filter((b) => b.key.slice('analytics:'.length) >= sinceDay)
    .flatMap((b) => b.value)
    .filter((e) => e.at >= sinceIso)
}

/** LINE userIdなどをそのまま保存しないための単純ハッシュ */
function anonymize(value: string): string {
  let hash = 0
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) | 0
  }
  return `a${Math.abs(hash).toString(36)}`
}
