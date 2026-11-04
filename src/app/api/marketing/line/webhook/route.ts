/**
 * マーケティングハブ用 LINE Webhook（指示書16章）
 *
 * - 本番: LINE Messaging APIからのイベントを署名検証のうえ処理し、Reply APIで返信
 * - シミュレーター: 管理画面から x-marketing-simulator ヘッダー付きで呼び出し、
 *   返信を実際に送らずレスポンスで返す（チャネル未接続でもE2E検証できる）
 *
 * （以前あった /api/karada-line/webhook は削除済み。LINE の Webhook URL はこのルート）
 */
import { NextRequest, NextResponse } from 'next/server'
import crypto from 'node:crypto'
import { advanceScenario, type EngineInput } from '@/lib/marketing/line-scenario'
import { getContact, saveContact } from '@/lib/marketing/line-store-server'
import { recordEvent } from '@/lib/marketing/analytics-store-server'
import type { BotReply, LineChatMessage } from '@/lib/marketing/line-types'
import { isOwnerLineUser, replyOwner } from '@/lib/marketing/owner-notify'
import { handleOwnerPostback } from '@/lib/marketing/autopilot-server'
import { getRule, recordAudit, recordRun } from '@/lib/marketing/automation-store-server'
import { CONSENT_PURPOSE_LABELS, consentReply, parseConsentCommand, type ConsentCommand } from '@/lib/marketing/consent'
import { applyConsent } from '@/lib/marketing/consent-store-server'
import { DEFAULT_CLINIC_PROFILE } from '@/lib/marketing/clinic'
import type { AutomationRule, RunResult } from '@/lib/marketing/automation-types'

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

/**
 * 自動案内を返すか（集客 → 自動化設定の「LINE の自動案内」）
 * - on   … 返す（今までどおり）
 * - test … 院長の LINE にだけ返す（ほかの方には返さず、スタッフの返信待ちにする）
 * - off  … 返さない（スタッフの返信待ちにする）
 * どの形でも、緊急の可能性がある言葉への受診案内だけは返す（安全のため）。シミュレーターは送らないので、いつも返す
 */
function replyDecision(rule: AutomationRule, userId: string, safety: boolean, simulator: boolean): RunResult {
  if (simulator) return 'test'
  if (rule.mode === 'on' || safety) return 'sent'
  if (rule.mode === 'test' && isOwnerLineUser(userId)) return 'test'
  return 'skipped'
}

const INPUT_NOTE: Record<EngineInput['kind'], string> = {
  follow: '友だち追加',
  postback: 'ボタンを選んだ',
  text: 'メッセージ',
}

/**
 * 本人の「配信停止」「予約のお知らせ停止」など：受け取りを変えて、その旨を返す
 * - 本人の求めへの返事なので、LINE の自動案内を止めていても返す
 * - お知らせ・ご挨拶を止めたら、LINE導線の「配信停止」の印（optedOut）も合わせる（追客の一覧から外れる）
 * - 会話ログには残すが、問い合わせには数えない（note: 'consent'）
 * - 保存できなかったときは、そう伝えてスタッフの確認待ちにする（止めたつもりで送ってしまうのを防ぐ）
 */
async function handleConsentCommand(
  userId: string,
  displayName: string | undefined,
  text: string,
  command: ConsentCommand,
  opts: { simulator?: boolean } = {},
): Promise<BotReply[]> {
  const contact = await getContact(userId, displayName)
  const now = new Date().toISOString()
  let reply: string
  try {
    await applyConsent(userId, command, 'line')
    if (command.purpose === 'marketing') contact.optedOut = !command.allow
    reply = consentReply(command)
    await recordAudit({
      role: 'line',
      action: command.allow ? 'お知らせの受け取りを再開' : 'お知らせの受け取りを停止',
      target: CONSENT_PURPOSE_LABELS[command.purpose],
      detail: `ご本人が LINE で送った${opts.simulator ? '（シミュレーター）' : ''}`,
    })
  } catch (error) {
    console.error('お知らせの受け取りの保存に失敗:', error instanceof Error ? error.message : error)
    reply = `申し訳ありません。いま設定を変えられませんでした。しばらくしてからもう一度送るか、お電話（${DEFAULT_CLINIC_PROFILE.phone}）でお知らせください。`
    contact.needsAttention = contact.needsAttention || 'お知らせの停止・再開の依頼を保存できませんでした（ご本人の希望の確認が必要です）'
    contact.inquiryStatus = 'new'
    contact.inquiryUpdatedAt = now
  }
  await saveContact(contact, [
    { at: now, from: 'user', text, note: 'consent' },
    { at: now, from: 'bot', text: reply, note: 'consent' },
  ])
  return [{ type: 'text', text: reply }]
}

async function processEvent(
  userId: string,
  displayName: string | undefined,
  input: EngineInput,
  opts: { rule: AutomationRule; simulator?: boolean },
) {
  const contact = await getContact(userId, displayName)
  // 友だち追加し直したら、ブロックの印を外す
  if (input.kind === 'follow' && contact.blockedAt) delete contact.blockedAt
  const result = advanceScenario(contact, input, { menu: opts.rule.lineMenu })
  Object.assign(contact, result.patch)
  const now = new Date().toISOString()
  if (result.notify) {
    contact.needsAttention = contact.needsAttention || result.notify
    // 新しくスタッフの対応が要ることが起きたら、問い合わせを「未対応」に戻す（完了のままにしない）
    contact.inquiryStatus = 'new'
    contact.inquiryUpdatedAt = now
  }

  // 自動案内を止めている・テスト中なら、返事をしない（緊急の受診案内は除く）
  const decision = result.replies.length > 0
    ? replyDecision(opts.rule, userId, result.patch.step === 'urgent', Boolean(opts.simulator))
    : null
  if (decision === 'skipped') {
    result.replies = []
    if (input.kind !== 'follow') {
      contact.needsAttention = contact.needsAttention || 'LINEの自動案内を止めているため、スタッフの返信が必要です'
      contact.inquiryStatus = 'new'
      contact.inquiryUpdatedAt = now
    }
  }
  if (decision) {
    await recordRun({
      automation: 'line_auto_reply',
      result: decision,
      note: `${INPUT_NOTE[input.kind]}${opts.simulator ? '（シミュレーター）' : ''}`,
    })
  }

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
  // セキュリティ: 本番（チャネル設定済み）ではシミュレーターを無効化し、
  // 第三者による偽データ注入を防ぐ。ローカル開発（チャネル未設定 or mock）でのみ有効。
  const simulatorAllowed = !CHANNEL_SECRET || process.env.MARKETING_MODE === 'mock'
  if (request.headers.get('x-marketing-simulator') === '1') {
    if (!simulatorAllowed) {
      return NextResponse.json({ error: '本番環境ではシミュレーターは使用できません' }, { status: 403 })
    }
    try {
      const { userId, displayName, input } = JSON.parse(rawBody) as {
        userId: string
        displayName?: string
        input: EngineInput
      }
      if (!userId || !input) throw new Error('bad request')
      const consentCommand = input.kind === 'text' ? parseConsentCommand(input.text ?? '') : null
      if (consentCommand) {
        const replies = await handleConsentCommand(`sim_${userId}`, displayName, input.text ?? '', consentCommand, { simulator: true })
        return NextResponse.json({ ok: true, replies, notify: null })
      }
      // シミュレーターは送らないので、止める／テストに関係なく返事を見せる（選択肢の形は自動化設定のとおり）
      const rule = await getRule('line_auto_reply')
      const result = await processEvent(`sim_${userId}`, displayName, input, { rule, simulator: true })
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
  // 自動案内の設定（読めないときは今までどおり動かす。automation-store-server の getRules）
  const rule = await getRule('line_auto_reply')
  for (const event of body.events ?? []) {
    const source = event.source as { userId?: string } | undefined
    const userId = source?.userId
    if (!userId) continue

    // ブロック：返事はできないので、印と数（個人を特定しない計測）だけ残す
    if (event.type === 'unfollow') {
      try {
        const contact = await getContact(userId)
        contact.blockedAt = new Date().toISOString()
        await saveContact(contact)
      } catch (error) {
        console.error('ブロックの記録に失敗:', error instanceof Error ? error.message : error)
      }
      await recordEvent('line_unfollow', {}, userId)
      continue
    }

    let input: EngineInput | null = null
    if (event.type === 'follow') input = { kind: 'follow' }
    if (event.type === 'message') {
      const message = event.message as { type?: string; text?: string }
      if (message.type === 'text') {
        // 院長のuserID取得用キーワード（予約通知の送信先設定に使う）。
        // 送信者自身のuserIdを返すだけで他人の情報は出さない。LINE_WHOAMI_KEYWORD設定時のみ有効。
        const whoami = process.env.LINE_WHOAMI_KEYWORD
        if (whoami && (message.text ?? '').trim() === whoami) {
          const replyToken = event.replyToken as string | undefined
          if (replyToken) {
            await replyToLine(replyToken, [
              { type: 'text', text: `あなたのLINE userIdはこちらです（予約通知の送信先に設定します）：\n${userId}` },
            ])
          }
          continue
        }
        // 「配信停止」「予約のお知らせ停止」など（自動案内の会話には流さない）
        const consentCommand = parseConsentCommand(message.text ?? '')
        if (consentCommand) {
          const replyToken = event.replyToken as string | undefined
          try {
            const replies = await handleConsentCommand(userId, undefined, message.text ?? '', consentCommand)
            if (replyToken) await replyToLine(replyToken, replies)
          } catch (error) {
            console.error('お知らせの受け取りの処理に失敗:', error instanceof Error ? error.message : error)
          }
          continue
        }
        input = { kind: 'text', text: message.text ?? '' }
      }
    }
    if (event.type === 'postback') {
      const postback = event.postback as { data?: string }
      const data = postback.data ?? ''
      // 自動投稿パイプラインのボタン（全部承認・投稿した）。院長本人からのときだけ処理し、
      // それ以外の人から届いても何もしない（会話シナリオにも流さない）
      if (data.startsWith('ap:')) {
        if (isOwnerLineUser(userId)) {
          const replyToken = event.replyToken as string | undefined
          try {
            const replies = await handleOwnerPostback(data)
            if (replyToken) await replyOwner(replyToken, replies)
          } catch (error) {
            console.error('自動投稿ボタンの処理に失敗:', error instanceof Error ? error.message : error)
            if (replyToken) await replyOwner(replyToken, ['処理に失敗しました。承認画面から操作してください。'])
          }
        }
        continue
      }
      input = { kind: 'postback', data }
    }
    if (!input) continue

    const result = await processEvent(userId, undefined, input, { rule })
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
  // データ保存先の疎通も確認する（秘密情報は返さない）
  let storageOk = false
  let storage = 'file'
  let storageError: string | undefined
  try {
    const { createSupabaseServer } = await import('@/lib/supabase-server')
    const supabase = createSupabaseServer()
    if (supabase) {
      storage = 'supabase'
      const { error } = await supabase.from('marketing_line_contacts').select('user_id').limit(1)
      storageOk = !error
      if (error) storageError = String(error.message ?? error.code ?? 'unknown').slice(0, 120)
    } else {
      storageOk = true
    }
  } catch (error) {
    storageOk = false
    storageError = (error instanceof Error ? error.message : 'unknown').slice(0, 120)
  }

  // キー自体は返さず、取り違え調査用の指紋（先頭・長さ）のみ返す
  const rawKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
  const keyFingerprint = rawKey ? `${rawKey.slice(0, 10)}…(len:${rawKey.length})` : 'unset'
  const urlHost = (process.env.SUPABASE_URL ?? '').replace(/^https?:\/\//, '').slice(0, 30)

  return NextResponse.json({
    ok: true,
    channelConfigured: Boolean(CHANNEL_SECRET && ACCESS_TOKEN),
    mode: CHANNEL_SECRET && ACCESS_TOKEN ? 'live' : 'simulator-only',
    storage,
    storageOk,
    ...(storageError ? { storageError, keyFingerprint, urlHost } : {}),
  })
}
