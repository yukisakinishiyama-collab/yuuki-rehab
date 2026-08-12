import { NextRequest, NextResponse } from 'next/server'
import { kvGet, kvSet, kvDelete, kvList } from '@/lib/marketing/kv-store-server'
import {
  detectRedFlags, validateSubmission, WARNING_SIGN_MAP,
  type MonshinSubmission, type StoredMonshin,
} from '@/lib/monshin'

/**
 * Web問診の受け口
 *
 * POST   … 患者さんからの送信（認証なし。公開ページから呼ばれる）
 * GET    … 院内画面が未取り込みの問診を取得（x-sync-secret が必要）
 * DELETE … 取り込み済み／不要な問診を削除（x-sync-secret が必要）
 *
 * 【この経路でAIを呼ばない】
 * 公開エンドポイントからAIを呼ぶと、URLが広まった時点で利用料が
 * 際限なく膨らむ。危険兆候はルール判定で返し、AI分析は院内画面から実行する。
 */

const PREFIX = 'monshin:'
const RATE_PREFIX = 'monshin:rate:'
const MAX_PER_HOUR = 5      // 同一IPからの1時間あたり送信数
const MAX_PENDING = 200     // 保管する未取り込みの上限（あふれ防止）

function itemKey(id: string) {
  return `${PREFIX}item:${id}`
}

/** 院内画面からの参照か（クラウド同期と同じ合言葉を使う。新たな設定を増やさないため） */
function isStaff(req: NextRequest): boolean {
  const expected = process.env.SYNC_SECRET
  if (!expected) return false
  return req.headers.get('x-sync-secret') === expected
}

function clientIp(req: NextRequest): string {
  const fwd = req.headers.get('x-forwarded-for') ?? ''
  return fwd.split(',')[0].trim() || 'unknown'
}

/** 同一IPからの連続送信を抑える。KVが使えないときは通す（患者さんを止めない） */
async function overRateLimit(ip: string): Promise<boolean> {
  const hour = new Date().toISOString().slice(0, 13) // yyyy-MM-ddTHH
  const key = `${RATE_PREFIX}${hour}:${ip}`
  try {
    const current = (await kvGet<number>(key)) ?? 0
    if (current >= MAX_PER_HOUR) return true
    await kvSet(key, current + 1)
    return false
  } catch {
    return false
  }
}

function randomId(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`
}

/** 院へのLINE通知。設定が無ければ黙って飛ばす */
async function notifyClinic(item: StoredMonshin) {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN
  const userId = process.env.LINE_USER_ID
  if (!token || !userId) return

  const s = item.submission
  const flagLine =
    item.redFlag.level === 'urgent' ? '🚨 受診をすすめる項目あり'
    : item.redFlag.level === 'call' ? '⚠️ 電話相談をすすめる項目あり'
    : ''
  const text = [
    '📝 Web問診が届きました',
    '━━━━━━━━━━━━━━',
    `👤 ${s.name}（${s.kana || 'ふりがな未記入'}）`,
    `📞 ${s.phone}`,
    `🩹 ${s.chiefComplaint}`,
    `痛み ${s.painNrs}/10`,
    s.appointmentDate ? `📅 予約 ${s.appointmentDate}` : null,
    flagLine || null,
    ...item.redFlag.matchedIds.map(id => `・${WARNING_SIGN_MAP[id]?.label ?? id}`),
    '━━━━━━━━━━━━━━',
    'カルテの「Web問診」から取り込めます',
  ].filter(Boolean).join('\n')

  try {
    await fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ to: userId, messages: [{ type: 'text', text }] }),
    })
  } catch {
    // 通知に失敗しても問診の保存は成立させる
  }
}

export async function POST(req: NextRequest) {
  let body: Partial<MonshinSubmission>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: '送信内容を読み取れませんでした' }, { status: 400 })
  }

  const validation = validateSubmission(body)
  if (!validation.ok) {
    return NextResponse.json({ error: validation.errors.join('\n') }, { status: 400 })
  }

  if (await overRateLimit(clientIp(req))) {
    return NextResponse.json(
      { error: '送信が続いています。しばらく時間をおいてからお試しください。' },
      { status: 429 },
    )
  }

  const submission = body as MonshinSubmission
  const redFlag = detectRedFlags(submission)
  const item: StoredMonshin = {
    id: randomId(),
    submittedAt: new Date().toISOString(),
    submission,
    redFlag: { level: redFlag.level, matchedIds: redFlag.matched.map(w => w.id) },
  }

  try {
    const existing = await kvList<StoredMonshin>(`${PREFIX}item:`)
    if (existing.length >= MAX_PENDING) {
      return NextResponse.json(
        { error: '現在受け付けできません。お手数ですがお電話ください。' },
        { status: 503 },
      )
    }
    await kvSet(itemKey(item.id), item)
  } catch {
    return NextResponse.json(
      { error: '保存できませんでした。お手数ですがお電話ください。' },
      { status: 500 },
    )
  }

  await notifyClinic(item)

  // 患者さんへ返すのは受付完了と案内文のみ。診断や疑い病名は返さない
  return NextResponse.json({
    ok: true,
    redFlagLevel: redFlag.level,
    message: redFlag.message,
  })
}

export async function GET(req: NextRequest) {
  if (!isStaff(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const rows = await kvList<StoredMonshin>(`${PREFIX}item:`)
    const items = rows
      .map(r => r.value)
      .filter((v): v is StoredMonshin => Boolean(v?.submission))
      .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))
    return NextResponse.json({ items })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '取得に失敗しました' },
      { status: 500 },
    )
  }
}

export async function DELETE(req: NextRequest) {
  if (!isStaff(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const id = req.nextUrl.searchParams.get('id') ?? ''
  if (!id) return NextResponse.json({ error: 'id が必要です' }, { status: 400 })
  try {
    await kvDelete(itemKey(id))
    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '削除に失敗しました' },
      { status: 500 },
    )
  }
}
