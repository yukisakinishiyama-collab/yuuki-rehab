/**
 * 予約通知エンドポイント（GAS予約システム → LINEプッシュ通知）
 *
 * 用途は2系統:
 * 1) 院長宛（従来）: 新規予約/キャンセル/前日リマインド一覧を院長のLINEへ
 *    - kind: 'new' | 'cancel' | 'reminder'（to指定なし → RESERVATION_NOTIFY_LINE_USER_ID宛）
 * 2) 患者宛（LIFF連携）: 予約完了・キャンセル確認を患者本人のLINEへ
 *    - kind: 'patient-confirm' | 'patient-cancel' ＋ to=患者のLINE userId
 *
 * セキュリティ:
 * - RESERVATION_NOTIFY_SECRET（共有シークレット）で保護。未設定時は503（誤って開放しない）
 * - 患者宛の to は U+32桁hex の形式検証を通った場合のみ送信
 * - LINEプッシュには既存の LINE_CHANNEL_ACCESS_TOKEN を使う（トークンはVercelに集約）
 */
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

type NotifyBody = {
  kind?: 'new' | 'cancel' | 'reminder' | 'patient-confirm' | 'patient-cancel'
  /** 患者宛push用のLINE userId（U+32桁hex）。未指定なら院長宛 */
  to?: string
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
  const when = `${formatDateJa(b.date)} ${b.time ?? ''}`.trim()
  if (b.kind === 'patient-cancel') {
    return [
      `${b.name ?? ''} 様`,
      '',
      'ゆうき整骨院です。以下のご予約のキャンセルを承りました。',
      '',
      `📅 日時：${when}`,
      b.reservationNo ? `予約番号：${b.reservationNo}` : undefined,
      '',
      'またのご利用をお待ちしております。',
      'ご予約はメニューの「ネット予約」からいつでもどうぞ😊',
    ]
      .filter((x): x is string => x !== undefined)
      .join('\n')
  }
  return [
    `${b.name ?? ''} 様`,
    '',
    'ゆうき整骨院です。ご予約ありがとうございます。',
    '以下の内容で確定しました。',
    '',
    `📅 日時：${when}〜`,
    b.reservationNo ? `🎫 予約番号：${b.reservationNo}` : undefined,
    '',
    '変更・キャンセルは、このトークまたは',
    'お電話（083-265-4545）へお気軽にどうぞ。',
    '当日はお気をつけてお越しください😊',
  ]
    .filter((x): x is string => x !== undefined)
    .join('\n')
}

export async function POST(request: NextRequest) {
  if (!process.env.RESERVATION_NOTIFY_SECRET) {
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
  if (isPatientPush) {
    // 患者宛：toの形式検証を通った場合のみ送る
    const patientTo = String(body.to ?? '')
    if (!/^U[0-9a-f]{32}$/.test(patientTo)) {
      return NextResponse.json({ ok: false, delivered: false, error: 'invalid to' }, { status: 400 })
    }
    to = patientTo
    text = buildPatientMessage(body)
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
    return NextResponse.json({ ok: true, delivered: true })
  } catch (error) {
    return NextResponse.json(
      { ok: false, delivered: false, error: error instanceof Error ? error.message : '不明' },
      { status: 502 },
    )
  }
}
