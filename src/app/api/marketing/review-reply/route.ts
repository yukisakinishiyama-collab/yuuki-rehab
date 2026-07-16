/**
 * Google口コミ返信案の生成（指示書15章）
 * tools/sns-automation/generate-review-reply.mjs のプロンプト資産を移植。
 * 返信は管理者がコピーして手動投稿する（自動返信はしない）。
 */
import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { z } from 'zod'
import { findViolations } from '@/lib/marketing/compliance'

const RequestSchema = z.object({
  reviewText: z.string().min(1).max(3000),
  stars: z.number().min(1).max(5).optional(),
  mock: z.boolean().optional().default(false),
})

const SYSTEM_PROMPT = `あなたはゆうき整骨院（山口県下関市彦島）の院長として、Googleビジネスプロフィールの口コミに返信します。

【返信の基本方針】
- まず来院と口コミ投稿への感謝を伝える
- 誠実で温かく、かしこまりすぎないトーン（150〜250字程度）
- 定型文っぽさを避け、口コミの内容に具体的に触れる

【厳守事項】
- 口コミに書かれていない症状・治療内容・来院日などの個人情報を返信で明かさない（本人確認になる記載はNG。口コミ本文に書かれている範囲の話題のみ言及可）
- 医療広告ガイドライン順守: 「必ず治る」「完全に」等の効果保証をしない
- 低評価・批判的な口コミには: 言い訳をせず、まず不快な思いをさせたことへの謝罪 → 指摘への感謝 → 改善の姿勢 → 直接連絡の窓口案内（083-265-4545）の順で。反論・患者側の落ち度の指摘は絶対にしない
- 医学的な相談への回答はせず、来院・電話での相談を案内する

【出力形式】
必ず次のJSONのみを出力する:
{"drafts":[{"label":"標準","text":"..."},{"label":"少しカジュアル","text":"..."},{"label":"簡潔","text":"..."}]}`

const ResponseSchema = z.object({
  drafts: z.array(z.object({ label: z.string(), text: z.string().min(1) })).min(1),
})

export async function POST(request: NextRequest) {
  let input
  try {
    input = RequestSchema.parse(await request.json())
  } catch {
    return NextResponse.json({ error: '入力が不正です' }, { status: 400 })
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  const useMock = input.mock || process.env.MARKETING_MODE === 'mock' || !apiKey

  let drafts: Array<{ label: string; text: string }>
  if (useMock) {
    drafts = [
      {
        label: '標準（モック）',
        text: 'この度はご来院と口コミのご投稿、ありがとうございます。いただいたお言葉を励みに、これからも一人ひとりの状態に合わせたサポートを心がけてまいります。またお身体のことで気になることがあれば、いつでもご相談ください。',
      },
      {
        label: '簡潔（モック）',
        text: 'ご来院と温かい口コミをありがとうございます。今後ともどうぞよろしくお願いいたします。',
      },
    ]
  } else {
    try {
      const anthropic = new Anthropic({ apiKey })
      const message = await anthropic.messages.create({
        model: 'claude-sonnet-5',
        max_tokens: 2000,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: 'user',
            content: `以下の口コミへの返信案を作成してください。\n\n評価: ${input.stars ? `星${input.stars}` : '不明'}\n口コミ本文:\n${input.reviewText}`,
          },
        ],
      })
      const text = message.content
        .filter((block): block is Anthropic.TextBlock => block.type === 'text')
        .map((block) => block.text)
        .join('')
      const parsed = ResponseSchema.parse(JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1)))
      drafts = parsed.drafts
    } catch (error) {
      return NextResponse.json(
        { error: `生成に失敗しました（${error instanceof Error ? error.message.slice(0, 100) : '不明'}）` },
        { status: 502 },
      )
    }
  }

  // 返信案にも表現チェックをかける
  const checked = drafts.map((d) => ({ ...d, findings: findViolations(d.text) }))
  return NextResponse.json({ ok: true, mode: useMock ? 'mock' : 'live', drafts: checked })
}
