/**
 * マーケティングハブ用 LINE Webhook（指示書16章）
 *
 * - 本番: LINE Messaging APIからのイベントを署名検証のうえ処理し、Reply APIで返信
 * - シミュレーター: 管理画面から x-marketing-simulator ヘッダー付きで呼び出し、
 *   返信を実際に送らずレスポンスで返す（チャネル未接続でもE2E検証できる）
 *
 * 既存の /api/karada-line/webhook には手を加えない（共存）。
 */
import { NextRequest, NextResponse } from 'next/server'
import crypto from 'node:crypto'
import { advanceScenario, type EngineInput } from '@/lib/marketing/line-scenario'
import { getContact, saveContact } from '@/lib/marketing/line-store-server'
import type { BotReply, LineChatMessage } from '@/lib/marketing/line-types'

const CHANNEL_SECRET = process.env.LINE_CHANNEL_SECRET ?? ''
const ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN ?? ''

function verifySignature(body: string, signature: string | null): boolean {
  if (!CHANNEL_SECRET) return false // 本番経路では秘密鍵必須（シミュレーターは別判定）
  if (!signature) return false
  const hash = crypto.createHmac('SHA256', CHANNEL_SECRET).update(body).digest('base64')
  return hash === signature
}

/** BotReply → LINE Messaging APIメッセージ形式 */
function toLineMessages(replies: BotReply[]): unknown[] {
  return replies.map((reply) => {
    if (reply.type === 'text') return { type: 'text', text: reply.text }
    // ボタンはクイックリプライ（URL系はボタンテンプレート）で表現する
    const urlButtons = reply.buttons.filter((b) => b.url)
    if (urlButtons.length > 0) {
      return {
        type: 'template',
        altText: reply.text,
        template: {
          type: 'buttons',
          text: reply.text.slice(0, 160),
          actions: reply.buttons.slice(0, 4).map((b) =>
            b.url ? { type: 'uri', label: b.label.slice(0, 20), uri: b.url } : { type: 'postback', label: b.label.slice(0, 20), data: b.data ?? '' },
          ),
        },
      }
    }
    return {
      type: 'text',
      text: reply.text,
      quickReply: {
        items: reply.buttons.slice(0, 13).map((b) => ({
          type: 'action',
          action: { type: 'postback', label: b.label.slice(0, 20), data: b.data ?? '', displayText: b.label },
        })),
      },
    }
  })
}

async function replyToLine(replyToken: string, replies: BotReply[]) {
  if (!ACCESS_TOKEN || replies.length === 0) return
  await fetch('https://api.line.me/v2/bot/message/reply', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ACCESS_TOKEN}` },
    body: JSON.stringify({ replyToken, messages: toLineMessages(replies).slice(0, 5) }),
  })
}

function describeInput(input: EngineInput): string {
  if (input.kind === 'follow') return '（友だち追加）'
  if (input.kind === 'postback') return `（選択: ${input.data}）`
  return input.text ?? ''
}

function processEvent(userId: string, displayName: string | undefined, input: EngineInput) {
  const contact = getContact(userId, displayName)
  const result = advanceScenario(contact, input)
  Object.assign(contact, result.patch)
  if (result.notify) contact.needsAttention = contact.needsAttention || result.notify

  const now = new Date().toISOString()
  const log: LineChatMessage[] = [{ at: now, from: 'user', text: describeInput(input) }]
  result.replies.forEach((reply) => {
    log.push({ at: now, from: 'bot', text: reply.type === 'text' ? reply.text : `${reply.text}\n[${reply.buttons.map((b) => b.label).join(' / ')}]` })
  })
  saveContact(contact, log)
  return result
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text()

  // ── シミュレーター経路（開発・検証用。本番のLINEユーザーには一切送信しない） ──
  if (request.headers.get('x-marketing-simulator') === '1') {
    try {
      const { userId, displayName, input } = JSON.parse(rawBody) as {
        userId: string
        displayName?: string
        input: EngineInput
      }
      if (!userId || !input) throw new Error('bad request')
      const result = processEvent(`sim_${userId}`, displayName, input)
      return NextResponse.json({ ok: true, replies: result.replies, notify: result.notify ?? null })
    } catch {
      return NextResponse.json({ error: 'invalid simulator request' }, { status: 400 })
    }
  }

  // ── 本番LINE経路 ──
  if (!verifySignature(rawBody, request.headers.get('x-line-signature'))) {
    return NextResponse.json({ error: 'invalid signature' }, { status: 401 })
  }

  const body = JSON.parse(rawBody) as { events?: Array<Record<string, unknown>> }
  for (const event of body.events ?? []) {
    const source = event.source as { userId?: string } | undefined
    const userId = source?.userId
    if (!userId) continue

    let input: EngineInput | null = null
    if (event.type === 'follow') input = { kind: 'follow' }
    if (event.type === 'message') {
      const message = event.message as { type?: string; text?: string }
      if (message.type === 'text') input = { kind: 'text', text: message.text ?? '' }
    }
    if (event.type === 'postback') {
      const postback = event.postback as { data?: string }
      input = { kind: 'postback', data: postback.data ?? '' }
    }
    if (!input) continue

    const result = processEvent(userId, undefined, input)
    const replyToken = event.replyToken as string | undefined
    if (replyToken) {
      try {
        await replyToLine(replyToken, result.replies)
      } catch (error) {
        console.error('LINE返信エラー:', error instanceof Error ? error.message : error)
      }
    }
  }

  return NextResponse.json({ ok: true })
}

/** 接続状態の確認用（管理画面のAPI接続確認に使用） */
export async function GET() {
  return NextResponse.json({
    ok: true,
    channelConfigured: Boolean(CHANNEL_SECRET && ACCESS_TOKEN),
    mode: CHANNEL_SECRET && ACCESS_TOKEN ? 'live' : 'simulator-only',
  })
}
