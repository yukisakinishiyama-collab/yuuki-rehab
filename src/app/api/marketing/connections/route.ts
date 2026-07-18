/** API接続確認（指示書30章の納品物「API接続確認画面」用）。秘密情報は返さず有無のみ */
import { NextResponse } from 'next/server'
import { getInstagramToken, INSTAGRAM_GRAPH_HOST } from '@/lib/marketing/instagram-token'

// 実疎通チェックを行うため常に動的実行
export const dynamic = 'force-dynamic'

type Detail = { ok: boolean; note: string }

/** Instagramトークンの実疎通確認（/meでユーザー名が取れれば有効） */
async function checkInstagram(): Promise<Detail | undefined> {
  if (!process.env.INSTAGRAM_ACCESS_TOKEN || !process.env.INSTAGRAM_USER_ID) return undefined
  try {
    const token = await getInstagramToken()
    const res = await fetch(
      `${INSTAGRAM_GRAPH_HOST}/v21.0/me?fields=username&access_token=${encodeURIComponent(token ?? '')}`,
      { signal: AbortSignal.timeout(8000), cache: 'no-store' },
    )
    const data = (await res.json()) as { username?: string; error?: { message?: string } }
    if (res.ok && data.username) return { ok: true, note: `@${data.username} と接続中` }
    return { ok: false, note: `トークンが無効の可能性: ${data.error?.message ?? `HTTP ${res.status}`}` }
  } catch (error) {
    return { ok: false, note: `疎通確認に失敗: ${error instanceof Error ? error.message : '不明'}` }
  }
}

/** LINEチャネルトークンの実疎通確認（bot/infoでアカウント名が取れれば有効） */
async function checkLine(): Promise<Detail | undefined> {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN
  if (!token) return undefined
  try {
    const res = await fetch('https://api.line.me/v2/bot/info', {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(8000),
      cache: 'no-store',
    })
    const data = (await res.json()) as { displayName?: string; basicId?: string; message?: string }
    if (res.ok && data.displayName) return { ok: true, note: `${data.displayName}（${data.basicId ?? ''}）と接続中` }
    return { ok: false, note: `トークンが無効の可能性: ${data.message ?? `HTTP ${res.status}`}` }
  } catch (error) {
    return { ok: false, note: `疎通確認に失敗: ${error instanceof Error ? error.message : '不明'}` }
  }
}

export async function GET() {
  const mock = process.env.MARKETING_MODE === 'mock'
  // モックモードでは外部APIを呼ばない（ローカル開発・デモ用）
  const [instagram, line] = mock ? [undefined, undefined] : await Promise.all([checkInstagram(), checkLine()])

  const details: Record<string, Detail> = {}
  if (instagram) details.instagram = instagram
  if (line) details.lineChannel = line

  return NextResponse.json({
    ok: true,
    mode: mock ? 'mock' : 'live',
    connections: {
      anthropic: Boolean(process.env.ANTHROPIC_API_KEY),
      openaiImage: Boolean(process.env.OPENAI_API_KEY),
      lineChannel: Boolean(process.env.LINE_CHANNEL_SECRET && process.env.LINE_CHANNEL_ACCESS_TOKEN),
      instagram: Boolean(process.env.INSTAGRAM_ACCESS_TOKEN && process.env.INSTAGRAM_USER_ID),
      googleBusiness: false, // API利用申請の承認待ち（承認後に実装を有効化）
      cronSecret: Boolean(process.env.CRON_SECRET),
    },
    details,
  })
}
