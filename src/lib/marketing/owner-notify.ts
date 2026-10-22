/**
 * 院長のLINEへのお知らせ（自動投稿パイプライン用）
 *
 * 予約通知と同じ宛先（RESERVATION_NOTIFY_LINE_USER_ID）・同じトークン（LINE_CHANNEL_ACCESS_TOKEN）を使う。
 * 宛先は環境変数で固定。患者さんへは送らない。
 * LINEの無料プランは月200通まで（1回のプッシュ＝吹き出し5つまでで1通）。週数通の想定。
 * ボタンの押下（postback）は webhook 側で「送り主が院長本人か」を確かめてから処理する。
 * 送れなくてもパイプライン自体は止めない（画面で確認できるため）。
 */
const LINE_TEXT_LIMIT = 4900

export interface NotifyResult {
  delivered: boolean
  reason?: string
}

export type OwnerMessage = string | Record<string, unknown>

export interface OwnerButton {
  label: string
  /** postback（webhookで処理）か uri（ページを開く） */
  postback?: string
  uri?: string
  primary?: boolean
}

const clip = (text: string, max: number) => (text.length > max ? `${text.slice(0, max - 1)}…` : text)

/** 本文＋ボタンのカード（Flex Message） */
export function ownerCard(altText: string, text: string, buttons: OwnerButton[]): Record<string, unknown> {
  return {
    type: 'flex',
    altText: clip(altText, 400),
    contents: {
      type: 'bubble',
      body: {
        type: 'box',
        layout: 'vertical',
        contents: [{ type: 'text', text: clip(text, 1800), wrap: true, size: 'sm' }],
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        spacing: 'sm',
        contents: buttons.slice(0, 4).map((b) => ({
          type: 'button',
          style: b.primary ? 'primary' : 'secondary',
          color: b.primary ? '#0f766e' : undefined,
          height: 'sm',
          action: b.postback
            ? { type: 'postback', label: clip(b.label, 20), data: b.postback.slice(0, 300), displayText: clip(b.label, 60) }
            : { type: 'uri', label: clip(b.label, 20), uri: b.uri ?? 'https://line.me/' },
        })),
      },
    },
  }
}

/** LINEの宛先が院長本人か（webhookのpostback処理で使う） */
export function isOwnerLineUser(userId: string | undefined): boolean {
  const owner = process.env.RESERVATION_NOTIFY_LINE_USER_ID
  return Boolean(owner && userId && userId === owner)
}

export async function notifyOwner(messages: OwnerMessage[]): Promise<NotifyResult> {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN
  const to = process.env.RESERVATION_NOTIFY_LINE_USER_ID
  if (process.env.MARKETING_MODE === 'mock') return { delivered: false, reason: 'モックモードのため送信していません' }
  if (!token || !to) return { delivered: false, reason: '院長のLINE宛先またはトークンが未設定です' }

  const payload = messages
    .filter((m) => (typeof m === 'string' ? m.trim().length > 0 : true))
    .slice(0, 5)
    .map((m) => (typeof m === 'string' ? { type: 'text', text: clip(m.trim(), LINE_TEXT_LIMIT) } : m))
  if (payload.length === 0) return { delivered: false, reason: '本文がありません' }

  try {
    const res = await fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ to, messages: payload }),
      signal: AbortSignal.timeout(10_000),
    })
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { message?: string }
      return { delivered: false, reason: data.message ?? `HTTP ${res.status}` }
    }
    return { delivered: true }
  } catch (error) {
    return { delivered: false, reason: error instanceof Error ? error.message : '不明なエラー' }
  }
}

/** webhookのreplyで院長へ返事をする（返信は無料・通数に数えない） */
export async function replyOwner(replyToken: string, messages: OwnerMessage[]): Promise<void> {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN
  if (!token || !replyToken) return
  const payload = messages
    .slice(0, 5)
    .map((m) => (typeof m === 'string' ? { type: 'text', text: clip(m, LINE_TEXT_LIMIT) } : m))
  await fetch('https://api.line.me/v2/bot/message/reply', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ replyToken, messages: payload }),
    signal: AbortSignal.timeout(10_000),
  }).catch(() => undefined)
}
