/**
 * 予約通知エンドポイント（GAS予約システム → LINEプッシュ通知）
 *
 * 用途は2系統:
 * 1) 院長宛（従来）: 新規予約/キャンセル/前日リマインド一覧を院長のLINEへ
 *    - kind: 'new' | 'cancel' | 'reminder' → RESERVATION_NOTIFY_LINE_USER_ID宛
 * 2) 患者宛（LIFF連携）: 予約完了・キャンセル確認を患者本人のLINEへ
 *    - kind: 'patient-confirm' … ticket（LIFF IDトークン検証済みの短命チケット）
 *      成功時、シート保存用の sealed（長期の署名付き参照）を返す
 *    - kind: 'patient-cancel'  … sealed（予約行に保存済みの参照）
 *
 * セキュリティ:
 * - RESERVATION_NOTIFY_SECRET（共有シークレット）で保護。未設定時は503
 * - 患者宛の宛先は【必ず】署名付きticket/sealedから復元する。生のuserIdは受け付けない
 *   （生受付だと他人のIDを指定して公式アカウント名義で通知を送れてしまうため）
 * - 本文に載せる氏名は改行・制御文字を除去し長さを制限（メッセージ偽装の防止）
 * - LINEプッシュには既存の LINE_CHANNEL_ACCESS_TOKEN を使う（トークンはVercelに集約）
 */
import { NextRequest, NextResponse } from 'next/server'
import { readTicket, sealUserId, unsealUserId } from '@/lib/liff-ticket'

export const dynamic = 'force-dynamic'

type NotifyBody = {
  kind?: 'new' | 'cancel' | 'reminder' | 'patient-confirm' | 'patient-cancel'
  /** patient-confirm用：LIFF検証済みの短命チケット */
  ticket?: string
  /** patient-cancel用：予約行に保存された長期参照 */
  sealed?: string
  reservationNo?: string
  name?: string
  kana?: string
  phone?: string
  menu?: string
  date?: string
  time?: string
  symptom?: string
  /** kind:'reminder' 用。指定時はこの本文をそのまま送る（GAS側で整形済みの前提） */
  text?: string
}

function authorized(request: NextRequest): boolean {
  const secret = process.env.RESERVATION_NOTIFY_SECRET
  if (!secret) return false
  const header = request.headers.get('x-reservation-secret') ?? ''
  return header === secret
}

/** 患者名など、外部入力を本文へ埋める前の無害化（改行・制御文字除去＋長さ制限） */
function safeName(value?: string): string {
  return String(value ?? '')
    // 改行・制御文字・行区切りを除去（メッセージ本文の偽装を防ぐ）
    .replace(/[\p{Cc}\p{Zl}\p{Zp}]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 40)
}

/** 'yyyy-MM-dd' を「M月D日（曜）」へ。形式外はそのまま返す */
function formatDateJa(dateString?: string): string {
  if (!dateString || !/^\d{4}-\d{2}-\d{2}$/.test(dateString)) return dateString ?? ''
  const [year, month, day] = dateString.split('-').map(Number)
  const youbi = ['日', '月', '火', '水', '木', '金', '土'][new Date(year, month - 1, day).getDay()]
  return `${month}月${day}日（${youbi}）`
}

/** 院長宛の通知本文（一目で分かる形式） */
function buildMessage(b: NotifyBody): string {
  // リマインド等、GAS側で整形済みの本文はそのまま送る
  if (b.text) return b.text
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

/** 患者宛の通知本文（予約完了・キャンセル確認） */
function buildPatientMessage(b: NotifyBody): string {
  const name = safeName(b.name)
  const reservationNo = /^[A-Za-z0-9]{1,12}$/.test(String(b.reservationNo ?? ''))
    ? String(b.reservationNo)
    : ''
  const when = `${formatDateJa(b.date)} ${String(b.time ?? '').slice(0, 5)}`.trim()

  if (b.kind === 'patient-cancel') {
    return [
      `${name} 様`,
      '',
      'ゆうき整骨院です。以下のご予約のキャンセルを承りました。',
      '',
      `📅 日時：${when}`,
      reservationNo ? `予約番号：${reservationNo}` : undefined,
      '',
      'またのご利用をお待ちしております。',
      'ご予約はメニューの「ネット予約」からいつでもどうぞ😊',
    ]
      .filter((x): x is string => x !== undefined)
      .join('\n')
  }
  return [
    `${name} 様`,
    '',
    'ゆうき整骨院です。ご予約ありがとうございます。',
    '以下の内容で確定しました。',
    '',
    `📅 日時：${when}〜`,
    reservationNo ? `🎫 予約番号：${reservationNo}` : undefined,
    '',
    '変更・キャンセルは、このトークまたは',
    'お電話（083-265-4545）へお気軽にどうぞ。',
    '当日はお気をつけてお越しください😊',
  ]
    .filter((x): x is string => x !== undefined)
    .join('\n')
}

export async function POST(request: NextRequest) {
  const secret = process.env.RESERVATION_NOTIFY_SECRET
  if (!secret) {
    return NextResponse.json({ error: 'not configured' }, { status: 503 })
  }
  if (!authorized(request)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  let body: NotifyBody
  try {
    body = (await request.json()) as NotifyBody
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 })
  }

  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN
  const isPatientPush = body.kind === 'patient-confirm' || body.kind === 'patient-cancel'

  let to: string | undefined
  let text: string
  let sealed: string | undefined

  if (isPatientPush) {
    // 患者宛：宛先は必ず署名付きticket/sealedから復元する（生のuserIdは受け付けない）
    const userId =
      body.kind === 'patient-confirm'
        ? readTicket(String(body.ticket ?? ''), secret)
        : unsealUserId(String(body.sealed ?? ''), secret)
    if (!userId) {
      return NextResponse.json(
        { ok: false, delivered: false, error: 'invalid or expired ticket' },
        { status: 400 },
      )
    }
    to = userId
    text = buildPatientMessage(body)
    // 予約確定時は、以後のキャンセル通知に使う長期参照をGASへ返す
    if (body.kind === 'patient-confirm') {
      sealed = sealUserId(userId, secret)
    }
  } else {
    // 院長宛（従来動作）
    to = process.env.RESERVATION_NOTIFY_LINE_USER_ID
    text = buildMessage(body)
  }

  // 送信先未設定・トークン未設定でも、予約自体は成功させたいので 200 で握る（設定を段階的に進められる）
  if (!token || !to) {
    return NextResponse.json({ ok: true, delivered: false, reason: '送信先またはトークン未設定' })
  }

  try {
    const res = await fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ to, messages: [{ type: 'text', text }] }),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      return NextResponse.json(
        { ok: false, delivered: false, error: (data as { message?: string }).message ?? `HTTP ${res.status}` },
        { status: 502 },
      )
    }
    return NextResponse.json({ ok: true, delivered: true, sealed })
  } catch (error) {
    return NextResponse.json(
      { ok: false, delivered: false, error: error instanceof Error ? error.message : '不明' },
      { status: 502 },
    )
  }
}
