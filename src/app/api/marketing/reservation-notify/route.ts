/**
 * 予約通知エンドポイント（GAS予約システム → 院長LINEへ通知）
 *
 * 外部（患者）から予約・キャンセルが入ったとき、GAS予約システムがこの
 * エンドポイントを呼び、院長のLINEにプッシュ通知を送る。
 *
 * セキュリティ:
 * - RESERVATION_NOTIFY_SECRET（共有シークレット）で保護。未設定時は503（誤って開放しない）
 * - 送信先は RESERVATION_NOTIFY_LINE_USER_ID（院長のLINE userId）に固定。未設定なら通知しない
 * - LINEプッシュには既存の LINE_CHANNEL_ACCESS_TOKEN を使う（トークンはVercelに集約）
 */
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

type NotifyBody = {
  kind?: 'new' | 'cancel'
  reservationNo?: string
  name?: string
  kana?: string
  phone?: string
  menu?: string
  date?: string
  time?: string
  symptom?: string
}

function authorized(request: NextRequest): boolean {
  const secret = process.env.RESERVATION_NOTIFY_SECRET
  if (!secret) return false
  const header = request.headers.get('x-reservation-secret') ?? ''
  return header === secret
}

/** 通知本文を組み立てる（院長が一目で分かる形式） */
function buildMessage(b: NotifyBody): string {
  const head = b.kind === 'cancel' ? '❌ 予約キャンセル' : '🗓 新規予約が入りました'
  const lines = [
    head,
    '',
    b.name ? `氏名：${b.name}${b.kana ? `（${b.kana}）` : ''}` : undefined,
    b.date || b.time ? `日時：${b.date ?? ''} ${b.time ?? ''}`.trim() : undefined,
    b.menu ? `メニュー：${b.menu}` : undefined,
    b.phone ? `電話：${b.phone}` : undefined,
    b.reservationNo ? `予約番号：${b.reservationNo}` : undefined,
    b.symptom ? `症状・ご要望：${b.symptom}` : undefined,
  ].filter((x): x is string => Boolean(x))
  return lines.join('\n')
}

/** 診断用GET（秘密値は返さない・有無と指紋のみ）。設定確認後に削除する。 */
export async function GET() {
  const fp = (v: string | undefined) => (v ? `set(len:${v.length},head:${v.slice(0, 2)})` : 'UNSET')
  return NextResponse.json({
    ok: true,
    marker: 'diag-v2',
    secret: fp(process.env.RESERVATION_NOTIFY_SECRET),
    lineToken: fp(process.env.LINE_CHANNEL_ACCESS_TOKEN),
    targetUserId: fp(process.env.RESERVATION_NOTIFY_LINE_USER_ID),
    whoami: fp(process.env.LINE_WHOAMI_KEYWORD),
  })
}

export async function POST(request: NextRequest) {
  if (!process.env.RESERVATION_NOTIFY_SECRET) {
    return NextResponse.json({ error: 'not configured' }, { status: 503 })
  }
  if (!authorized(request)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN
  const to = process.env.RESERVATION_NOTIFY_LINE_USER_ID
  // 送信先未設定・トークン未設定でも、予約自体は成功させたいので 200 で握る（設定を段階的に進められる）
  if (!token || !to) {
    return NextResponse.json({ ok: true, delivered: false, reason: '送信先またはトークン未設定' })
  }

  let body: NotifyBody
  try {
    body = (await request.json()) as NotifyBody
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 })
  }

  try {
    const res = await fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ to, messages: [{ type: 'text', text: buildMessage(body) }] }),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      return NextResponse.json(
        { ok: false, delivered: false, error: (data as { message?: string }).message ?? `HTTP ${res.status}` },
        { status: 502 },
      )
    }
    return NextResponse.json({ ok: true, delivered: true })
  } catch (error) {
    return NextResponse.json(
      { ok: false, delivered: false, error: error instanceof Error ? error.message : '不明' },
      { status: 502 },
    )
  }
}
