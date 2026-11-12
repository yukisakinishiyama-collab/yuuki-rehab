/**
 * 公式LINE の今月の送信数と上限（サーバー専用。LINE Messaging API の公式の値をそのまま使う）
 *
 * - GET /v2/bot/message/quota             … 今月の上限（type: 'limited' なら value 通まで／'none' は上限なし）
 * - GET /v2/bot/message/quota/consumption … 今月に送った数（プッシュ・一斉配信など。応答メッセージ（reply）は数えない）
 * 料金は API で取れないので返さない（画面には「LINE の管理画面で確認」と出す）。
 * 8割をこえたら warn を立てる（指示書3-D「上限超過前に警告」）。
 */
export interface LineQuota {
  state: 'ok' | 'not_connected' | 'error'
  /** 上限（通）。上限なしのプランは null */
  limit: number | null
  /** 今月送った数（通） */
  used: number | null
  /** used / limit（上限なし・未取得は null） */
  ratio: number | null
  warn: boolean
  note: string
}

export const QUOTA_WARN_RATIO = 0.8

export async function fetchLineQuota(): Promise<LineQuota> {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN
  if (!token || process.env.MARKETING_MODE === 'mock') {
    return { state: 'not_connected', limit: null, used: null, ratio: null, warn: false, note: '公式LINE と未連携です（トークン未設定）' }
  }
  const headers = { Authorization: `Bearer ${token}` }
  try {
    const [quotaRes, usageRes] = await Promise.all([
      fetch('https://api.line.me/v2/bot/message/quota', { headers, cache: 'no-store', signal: AbortSignal.timeout(8000) }),
      fetch('https://api.line.me/v2/bot/message/quota/consumption', { headers, cache: 'no-store', signal: AbortSignal.timeout(8000) }),
    ])
    if (!quotaRes.ok || !usageRes.ok) {
      const status = !quotaRes.ok ? quotaRes.status : usageRes.status
      return { state: 'error', limit: null, used: null, ratio: null, warn: false, note: `LINE から数を取れませんでした（HTTP ${status}）` }
    }
    const quota = (await quotaRes.json()) as { type?: string; value?: number }
    const usage = (await usageRes.json()) as { totalUsage?: number }
    const used = typeof usage.totalUsage === 'number' ? usage.totalUsage : null
    const limit = quota.type === 'limited' && typeof quota.value === 'number' ? quota.value : null
    const ratio = limit && used !== null ? used / limit : null
    const warn = ratio !== null && ratio >= QUOTA_WARN_RATIO
    return {
      state: 'ok',
      limit,
      used,
      ratio,
      warn,
      note: limit === null ? '今のプランに送信数の上限はありません' : warn ? '今月の上限の8割をこえました。配信を控えるか、プランを確認してください' : '',
    }
  } catch (error) {
    return {
      state: 'error',
      limit: null,
      used: null,
      ratio: null,
      warn: false,
      note: `LINE から数を取れませんでした（${error instanceof Error ? error.message : '不明'}）`,
    }
  }
}
