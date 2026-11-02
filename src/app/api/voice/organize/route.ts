/**
 * カルテの音声入力：文字起こしから患者さんの情報だけを取り出して整理する（院内専用。proxy.ts の Basic 認証の内側）
 *
 * POST { mode: 'soap' | 'memo', transcript } →
 *   soap: { result: VoiceSoapResult }（S/O/A/P の欄ごと）
 *   memo: { result: VoiceMemoResult }（整えたメモ）
 * 画面は結果を欄に入れるだけ。保存は院長が読んで直してから行う。ログに内容は出さない。
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { MAX_TRANSCRIPT_CHARS, organizeConfigured, organizeMemo, organizeSoap } from '@/lib/voice/organize-server'

export const dynamic = 'force-dynamic'
export const maxDuration = 90

const bodySchema = z.object({
  mode: z.enum(['soap', 'memo']),
  transcript: z.string().trim().min(1).max(MAX_TRANSCRIPT_CHARS),
})

export async function POST(request: NextRequest) {
  if (!organizeConfigured()) {
    return NextResponse.json({ error: 'AIの設定（ANTHROPIC_API_KEY）がありません' }, { status: 503 })
  }
  const parsed = bodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: '文字起こしが空か、長すぎます' }, { status: 400 })
  }
  const { mode, transcript } = parsed.data
  try {
    const result = mode === 'soap' ? await organizeSoap(transcript) : await organizeMemo(transcript)
    console.info('[voice/organize]', { mode, chars: transcript.length })
    return NextResponse.json({ result }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('[voice/organize] 失敗', message)
    return NextResponse.json({ error: `AIで整理できませんでした（${message}）` }, { status: 502 })
  }
}
