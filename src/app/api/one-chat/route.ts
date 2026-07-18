import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

/**
 * Project ONE — 悩み相談 AI 回答
 *
 * 方針（プロジェクト指示書より）:
 * - AIは必要最低限: 1リクエスト1回の軽量呼び出し（Haiku・短文出力）で通信量とコストを最小化
 * - 長文禁止: 回答は約200字以内 + 「今日の行動」1つ
 * - 失敗時はクライアント側のオフライン回答にフォールバックするため、ここでは素直にエラーを返す
 */

const SYSTEM_PROMPT = `あなたは「ONE」という、誰でも使えるライフアシスタントアプリのAIです。
ユーザーの悩みに、やさしく・短く・具体的に答えてください。

ルール:
- 回答は日本語200字以内。むずかしい言葉・専門用語は使わない
- 高齢者や子どもにも伝わる、あたたかく自然な話し言葉で書く
- 説教しない。まず気持ちに寄り添い、そのあと具体的なヒントを1〜2個
- 医療・法律・お金の深刻な相談には、簡単なヒントに加えて専門家や身近な人への相談をすすめる
- 最後に、今日すぐできる小さな行動を1つ提案する

出力は必ず次のJSON形式のみ（前後に説明文を付けない）:
{"answer":"回答本文","action":"今日できる小さな行動（30字以内）"}`

export async function POST(req: NextRequest) {
  try {
    // APIキーから sk-ant- パターンを抽出（非ASCII文字が混入していても対応）
    const rawKey = process.env.ANTHROPIC_API_KEY ?? ''
    const keyMatch = rawKey.match(/sk-ant-[A-Za-z0-9_\-]+/)
    const apiKey = keyMatch ? keyMatch[0] : rawKey.replace(/[^\x20-\x7E]/g, '').trim()
    const client = new Anthropic({ apiKey: apiKey || 'INVALID_KEY' })

    const body = await req.json()
    const question = typeof body?.question === 'string' ? body.question.trim() : ''

    if (!question) {
      return NextResponse.json({ error: '相談内容が空です' }, { status: 400 })
    }
    if (question.length > 1000) {
      return NextResponse.json({ error: '相談は1000文字以内で入力してください' }, { status: 400 })
    }

    const msg = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 500,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: question }],
    })

    const text = msg.content[0].type === 'text' ? msg.content[0].text : ''

    // JSON部分を抽出してパース。壊れていた場合はテキスト全体を回答として扱う
    let answer = text.trim()
    let action = ''
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]) as { answer?: string; action?: string }
        if (parsed.answer) answer = parsed.answer
        if (parsed.action) action = parsed.action
      } catch {
        // パース失敗時はプレーンテキストとして返す
      }
    }

    return NextResponse.json({ answer, action })
  } catch (error) {
    console.error('one-chat error:', error)
    const msg = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
