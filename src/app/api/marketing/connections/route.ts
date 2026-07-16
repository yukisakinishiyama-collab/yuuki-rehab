/** API接続確認（指示書30章の納品物「API接続確認画面」用）。秘密情報は返さず有無のみ */
import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({
    ok: true,
    mode: process.env.MARKETING_MODE === 'mock' ? 'mock' : 'live',
    connections: {
      anthropic: Boolean(process.env.ANTHROPIC_API_KEY),
      openaiImage: Boolean(process.env.OPENAI_API_KEY),
      lineChannel: Boolean(process.env.LINE_CHANNEL_SECRET && process.env.LINE_CHANNEL_ACCESS_TOKEN),
      instagram: Boolean(process.env.INSTAGRAM_ACCESS_TOKEN && process.env.INSTAGRAM_USER_ID),
      googleBusiness: false, // API利用申請の承認待ち（承認後に実装を有効化）
      cronSecret: Boolean(process.env.CRON_SECRET),
    },
  })
}
