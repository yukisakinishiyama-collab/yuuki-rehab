/**
 * 疑問メモの AI相談（院内専用。proxy.ts の Basic 認証の内側）
 *
 * POST { question, items: [{key,label,text}], previous?: [{question, answer}] } → { answer, model }
 * items は画面で作った「個人が分からない要約」（consult-context.ts）。お名前等は画面側で除いてある。
 * ログに内容は出さない。回答は参考意見で、判断は院長が行う。
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { consultConfigured, consultKarte } from '@/lib/karte/consult-server'
import { MAX_ITEM_CHARS, MAX_QUESTION_CHARS } from '@/lib/karte/consult-context'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const bodySchema = z.object({
  question: z.string().trim().min(1).max(MAX_QUESTION_CHARS),
  items: z
    .array(
      z.object({
        key: z.enum(['profile', 'intake', 'soap', 'tests', 'memos']),
        label: z.string().max(80),
        text: z.string().max(MAX_ITEM_CHARS + 10),
      }),
    )
    .max(5),
  previous: z.array(z.object({ question: z.string().max(MAX_QUESTION_CHARS), answer: z.string().max(6000) })).max(3).optional(),
})

export async function POST(request: NextRequest) {
  if (!consultConfigured()) {
    return NextResponse.json({ error: 'AIの設定（ANTHROPIC_API_KEY）がありません' }, { status: 503 })
  }
  const parsed = bodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: '疑問が空か、送る内容が長すぎます' }, { status: 400 })
  }
  try {
    const result = await consultKarte(parsed.data)
    console.info('[karte/consult]', { items: parsed.data.items.map(i => i.key), chars: parsed.data.question.length, model: result.model })
    return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('[karte/consult] 失敗', message)
    return NextResponse.json({ error: `AIに相談できませんでした（${message}）` }, { status: 502 })
  }
}
