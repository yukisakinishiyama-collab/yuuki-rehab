import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic()

export async function POST(req: NextRequest) {
  const { query, context } = await req.json()
  if (!query?.trim()) {
    return NextResponse.json({ error: 'クエリが空です' }, { status: 400 })
  }

  const systemPrompt = `あなたはリハビリテーション専門の医療アドバイザーです。
整骨院スタッフ（柔道整復師・理学療法士）が、リハビリプロトコルで分からない用語や概念について質問しています。

回答の方針:
- 日本語で、専門的かつ分かりやすく説明してください
- 医学的・リハビリテーション的な観点から根拠のある情報を提供してください
- 実際の臨床での活用イメージを含めてください
- 箇条書き（・）を使い、読みやすく構造化してください
- Markdown記法（#見出し、**太字**、表など）は使用禁止。見出しが必要な場合は【】で囲む
- 200〜400字程度でコンパクトにまとめてください
- 免責事項: 最終的な臨床判断は有資格者が行うことを明記してください

禁止事項:
- 確定診断・特定の患者への断定的な治療方針
- 「必ず治る」「完全治癒」などの誇大表現`

  const userMessage = context
    ? `【プロトコルのコンテキスト】\n${context}\n\n【質問】\n${query}`
    : query

  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 800,
    system: systemPrompt,
    messages: [{ role: 'user', content: userMessage }],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : ''
  return NextResponse.json({ answer: text })
}
