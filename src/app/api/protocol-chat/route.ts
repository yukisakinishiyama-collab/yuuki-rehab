import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic()

// 会話履歴は直近20往復までに制限（トークン節約）
const MAX_HISTORY = 40

interface ChatTurn {
  role: 'user' | 'assistant'
  content: string
}

export async function POST(req: NextRequest) {
  const { messages, protocolContext } = await req.json() as {
    messages: ChatTurn[]
    protocolContext: string
  }

  if (!Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json({ error: 'メッセージが空です' }, { status: 400 })
  }
  const last = messages[messages.length - 1]
  if (last.role !== 'user' || !last.content?.trim()) {
    return NextResponse.json({ error: '質問内容が空です' }, { status: 400 })
  }

  const systemPrompt = `あなたはリハビリテーション専門のAIアドバイザーです。
整骨院スタッフ（柔道整復師・理学療法士）と、以下のリハビリプロトコルについてディスカッションしています。

【対象プロトコル】
${protocolContext}

役割:
- プロトコルの内容（フェーズ構成・エクササイズ・移行基準・注意事項）に関する質問に答える
- エクササイズの代替案・負荷調整・進行判断について専門的な視点で議論する
- スタッフの臨床判断を支援する（判断を代替しない）
- 用語や概念の解説

回答の方針:
- 日本語で、専門的かつ実践的に答える
- プロトコルの具体的な内容（フェーズ名・エクササイズ名）を引用しながら答える
- 根拠（ガイドライン・一般的合意・専門家意見のいずれに基づくか）を可能な範囲で示す
- 箇条書き（・）を活用し、300〜500字程度で簡潔に
- Markdown記法（#見出し、**太字**、表、---など）は使用禁止。プレーンテキストと「・」の箇条書きのみで書く
- 見出しが必要な場合は【】で囲む（例:【注意点】）
- 提案する場合は理由とセットで

禁止事項:
- 確定診断・断定的な治療方針の指示
- 「必ず治る」「完全治癒」などの誇大表現
- プロトコルと無関係な話題への深入り（軽く受け流してプロトコルの話題に戻す）

重要: 最終的な臨床判断は有資格の医療者が行うこと。リスクの高い提案（荷重・スポーツ復帰時期など）には必ずその旨を添えること。`

  // 履歴が長い場合は末尾のみ送る
  const trimmed = messages.slice(-MAX_HISTORY)

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1500,
    system: systemPrompt,
    messages: trimmed.map(m => ({ role: m.role, content: m.content })),
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : ''
  return NextResponse.json({ answer: text })
}
