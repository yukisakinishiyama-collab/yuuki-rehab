/**
 * カルテの音声入力：録音1つ分（数秒〜1分ほど）を文字にする（院内専用。proxy.ts の Basic 認証の内側）
 *
 * GET  → { configured }（文字起こしの設定があるか。画面がボタンを出すかを決める）
 * POST multipart: audio（録音）, context（直前に文字にした内容。任意）→ { text }
 * 音声も文字もここには保存しない。ログにも内容は出さない（lib/voice/transcribe-server.ts）。
 */
import { NextRequest, NextResponse } from 'next/server'
import { audioExtension, transcribeAudio, transcribeConfigured } from '@/lib/voice/transcribe-server'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/** 1回に受け取る録音の上限（Vercel の受け取り上限 4.5MB より小さく。画面は1分以内で区切って送る） */
const MAX_BYTES = 4 * 1024 * 1024

export async function GET() {
  return NextResponse.json({ configured: transcribeConfigured() }, { headers: { 'Cache-Control': 'no-store' } })
}

export async function POST(request: NextRequest) {
  if (!transcribeConfigured()) {
    return NextResponse.json({ error: '文字起こしの設定（OPENAI_API_KEY）がありません' }, { status: 503 })
  }
  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return NextResponse.json({ error: '録音を受け取れませんでした' }, { status: 400 })
  }
  const audio = form.get('audio')
  if (!(audio instanceof Blob)) return NextResponse.json({ error: '録音がありません' }, { status: 400 })
  if (audio.size === 0) return NextResponse.json({ text: '' })
  if (audio.size > MAX_BYTES) return NextResponse.json({ error: '録音が長すぎます（1回4MBまで）' }, { status: 413 })
  const ext = audioExtension(audio.type)
  if (!ext) return NextResponse.json({ error: `この録音の形式には対応していません（${audio.type || '不明'}）` }, { status: 415 })

  const context = String(form.get('context') ?? '')
  try {
    const { text, model } = await transcribeAudio(audio, `voice.${ext}`, context)
    console.info('[voice/transcribe]', { bytes: audio.size, chars: text.length, model })
    return NextResponse.json({ text }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('[voice/transcribe] 失敗', message)
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
