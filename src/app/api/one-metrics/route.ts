import { NextRequest, NextResponse } from 'next/server'

/**
 * Project ONE — 匿名メトリクス受信
 *
 * バックエンドDBを持たない方針のため、初期版は構造化ログとして出力する
 * （Vercel のログ／Log Drain から集計。クラッシュ率 = crash / app_open）。
 * 本格運用時はここを BigQuery・Tinybird 等への転送に差し替える。
 */

interface MetricEvent {
  t: string
  at: string
  d?: Record<string, string | number>
}

const ALLOWED_TYPES = new Set([
  'app_open',
  'consult_success',
  'consult_offline',
  'action_done',
  'crash',
])

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const deviceId = typeof body?.deviceId === 'string' ? body.deviceId.slice(0, 64) : 'unknown'
    const appVersion = typeof body?.appVersion === 'string' ? body.appVersion.slice(0, 20) : 'unknown'
    const events: MetricEvent[] = Array.isArray(body?.events) ? body.events.slice(0, 200) : []

    const valid = events.filter(
      (e) => e && typeof e.t === 'string' && ALLOWED_TYPES.has(e.t) && typeof e.at === 'string'
    )

    // 1リクエスト1行の構造化ログ（集計しやすい JSON Lines 形式）
    console.log(
      JSON.stringify({
        kind: 'one-metrics',
        deviceId,
        appVersion,
        receivedAt: new Date().toISOString(),
        counts: valid.reduce<Record<string, number>>((acc, e) => {
          acc[e.t] = (acc[e.t] ?? 0) + 1
          return acc
        }, {}),
        events: valid,
      })
    )

    return new NextResponse(null, { status: 204 })
  } catch {
    // 計測はベストエフォート。エラーでもクライアントに影響を返さない
    return new NextResponse(null, { status: 204 })
  }
}
