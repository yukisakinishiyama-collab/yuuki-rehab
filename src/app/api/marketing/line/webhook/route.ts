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
import { recordEvent } from '@/lib/marketing/analytics-store-server'
import type { BotReply, LineChatMessage } from '@/lib/marketing/line-types'

const CHANNEL_SECRET = process.env.LINE_CHANNEL_SECRET ?? ''
const ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN ?? ''

function verifySignature(body: string, signature: string | null): boolean {
  if (!CHANNEL_SECRET) return false // 本番経路では秘密鍵必須（シミュレーターは別判定）
  if (!signature) return false
  const hash = crypto.createHmac('SHA256', CHANNEL_SECRET).update(body).digest('base64')
  return hash === signature
}

/** BotReply → LINE Messaging APIメッセージ形式（ボタンは見やすいカード型のFlex Messageで送る） */
function toLineMessages(replies: BotReply[]): unknown[] {
  return replies.map((reply) => {
    if (reply.type === 'text') return { type: 'text', text: reply.text }
    return {
      type: 'flex',
      altText: reply.text.slice(0, 300),
      contents: {
        type: 'bubble',
        body: {
          type: 'box',
          layout: 'vertical',
          spacing: 'md',
          paddingAll: 'lg',
          contents: [
            { type: 'text', text: reply.text.slice(0, 500), wrap: true, size: 'sm', color: '#334155' },
            { type: 'separator', margin: 'md' },
            ...reply.buttons.slice(0, 10).map((b, index) => ({
              type: 'button',
              style: index === 0 ? 'primary' : 'secondary',
              color: index === 0 ? '#0f766e' : '#e6fffb',
              height: 'sm',
              margin: 'sm',
              action: b.url
                ? { type: 'uri', label: b.label.slice(0, 40), uri: b.url }
                : { type: 'postback', label: b.label.slice(0, 40), data: b.data ?? '', displayText: b.label },
            })),
          ],
        },
        styles: { body: { backgroundColor: '#ffffff' } },
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

async function processEvent(userId: string, displayName: string | undefined, input: EngineInput) {
  const contact = await getContact(userId, displayName)
  const result = advanceScenario(contact, input)
  Object.assign(contact, result.patch)
  if (result.notify) contact.needsAttention = contact.needsAttention || result.notify

  // 効果測定イベント（個人情報は保存しない・指示書17章）
  try {
    if (input.kind === 'follow') recordEvent('line_follow', {}, userId)
    if (result.patch.intent && result.patch.step === 'ask_part') {
      recordEvent('line_intent', { intent: result.patch.intent }, userId)
    }
    if (result.patch.step === 'guide') {
      recordEvent('line_guide', { intent: contact.intent ?? result.patch.intent ?? '' }, userId)
      if (result.patch.intent && (result.patch.intent === 'price' || result.patch.intent === 'reserve' || result.patch.intent === 'lost')) {
        recordEvent('line_intent', { intent: result.patch.intent }, userId)
      }
    }
    if (result.patch.step === 'urgent') recordEvent('line_urgent', {}, userId)
    if (result.patch.step === 'human') recordEvent('line_handoff', { reason: result.patch.needsAttention ?? '' }, userId)
  } catch {
    // 計測失敗は応答を止めない
  }

  const now = new Date().toISOString()
  const log: LineChatMessage[] = [{ at: now, from: 'user', text: describeInput(input) }]
  result.replies.forEach((reply) => {
    log.push({ at: now, from: 'bot', text: reply.type === 'text' ? reply.text : `${reply.text}\n[${reply.buttons.map((b) => b.label).join(' / ')}]` })
  })
  await saveContact(contact, log)
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
      const result = await processEvent(`sim_${userId}`, displayName, input)
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

    const result = await processEvent(userId, undefined, input)
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
