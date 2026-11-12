/**
 * 経営相談チャット（院長のみ）
 * - GET    : 会話と、AI が使えるか、AI に渡している数字（文）
 * - POST   : { message, goal? } → 返事を返し、会話に残す（AI の料金がかかる）
 * - DELETE : 会話を消して、新しく始める
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/marketing/auth'
import { aiAvailable, ask, buildContext, listMessages, saveMessages, type ChatMessage } from '@/lib/marketing/keiei-chat-server'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(request: NextRequest) {
  const denied = requireAdmin(request)
  if (denied) return denied
  const goal = Number(request.nextUrl.searchParams.get('goal'))
  const [messages, context] = await Promise.all([listMessages(), buildContext(Number.isFinite(goal) && goal > 0 ? goal : null).catch((e: unknown) => `数字を集められませんでした: ${e instanceof Error ? e.message : String(e)}`)])
  return NextResponse.json({ ok: true, messages, context, ai: aiAvailable() })
}

export async function POST(request: NextRequest) {
  const denied = requireAdmin(request)
  if (denied) return denied
  let body: { message?: unknown; goal?: unknown }
  try {
    body = (await request.json()) as typeof body
  } catch {
    return NextResponse.json({ ok: false, error: '内容の形が正しくありません' }, { status: 400 })
  }
  const text = typeof body.message === 'string' ? body.message.trim().slice(0, 2000) : ''
  if (!text) return NextResponse.json({ ok: false, error: '相談の内容を書いてください' }, { status: 400 })
  const goal = typeof body.goal === 'number' && Number.isFinite(body.goal) && body.goal > 0 ? body.goal : null

  const now = new Date().toISOString()
  const messages: ChatMessage[] = [...(await listMessages()), { role: 'user', text, at: now }]
  try {
    const context = await buildContext(goal)
    const r = await ask(messages, context)
    const assistant: ChatMessage = { role: 'assistant', text: r.reply, at: new Date().toISOString() }
    await saveMessages([...messages, assistant])
    return NextResponse.json({ ok: true, reply: assistant, ai: r.ai, fallback: r.fallback })
  } catch (error) {
    // 返事を作れなかったときは、院長の文だけ残して理由を返す
    await saveMessages(messages).catch(() => null)
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : '返事を作れませんでした' }, { status: 502 })
  }
}

export async function DELETE(request: NextRequest) {
  const denied = requireAdmin(request)
  if (denied) return denied
  await saveMessages([])
  return NextResponse.json({ ok: true })
}
