/**
 * Buffer（YouTube・TikTok へ動画を出す投稿サービス）とのつながり
 *
 * GET                                  … 状態（つながっているか・YouTube/TikTok のチャンネル名）。キーそのものは返さない
 * POST { action: 'connect', apiKey }   … 院長が Buffer で作ったキーを貼って「つなぐ」（読めたときだけ保存。院長のみ）
 * POST { action: 'refresh' }           … チャンネルの一覧を今すぐ読み直す（院長のみ）
 * DELETE                               … 画面に貼ったキーを消す（院長のみ。Vercel の BUFFER_API_KEY は消せない）
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/marketing/auth'
import { looksLikeBufferKey } from '@/lib/marketing/buffer'
import { bufferStatus, connectBuffer, disconnectBuffer } from '@/lib/marketing/buffer-server'

export const dynamic = 'force-dynamic'

export async function GET() {
  return NextResponse.json({ ok: true, buffer: await bufferStatus() })
}

export async function POST(request: NextRequest) {
  const denied = requireAdmin(request)
  if (denied) return denied
  const body = (await request.json().catch(() => ({}))) as { action?: string; apiKey?: unknown }
  if (body.action === 'refresh') return NextResponse.json({ ok: true, buffer: await bufferStatus({ refresh: true }) })
  if (body.action !== 'connect') return NextResponse.json({ error: '不明な操作です' }, { status: 400 })
  const key = typeof body.apiKey === 'string' ? body.apiKey.trim() : ''
  if (!looksLikeBufferKey(key)) return NextResponse.json({ error: 'キーの形が正しくありません。Buffer の「設定 → API」で作ったキーを、そのまま貼ってください' }, { status: 400 })
  try {
    return NextResponse.json({ ok: true, buffer: await connectBuffer(key) })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Bufferとつなげませんでした' }, { status: 400 })
  }
}

export async function DELETE(request: NextRequest) {
  const denied = requireAdmin(request)
  if (denied) return denied
  await disconnectBuffer()
  return NextResponse.json({ ok: true, buffer: await bufferStatus() })
}
