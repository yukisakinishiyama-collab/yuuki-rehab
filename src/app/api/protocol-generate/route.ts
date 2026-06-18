import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import type { Phase, ExpertOpinion } from '@/types/protocol'

const rawKey = process.env.ANTHROPIC_API_KEY ?? ''
const keyMatch = rawKey.match(/sk-ant-[A-Za-z0-9_\-]+/)
const cleanKey = keyMatch ? keyMatch[0] : rawKey.replace(/[^\x20-\x7E]/g, '').trim()
const client = new Anthropic({ apiKey: cleanKey || 'INVALID_KEY' })

const SYSTEM_PROMPT = `あなたは整形外科リハビリテーション専門の医療AIアシスタントです。
患者情報に基づいて、エビデンスベースのリハビリプロトコルを生成します。

重要なルール:
1. 存在しない論文・数値を捏造しない。不確かな数値には必ず「目安」「要確認」を付ける
2. プロトコルは「時間基準」と「機能的基準（criteria-based）」を両方含める
3. 禁忌・中止基準・赤旗（red flags）を必ず含める
4. 最終判断は必ず有資格の医療者が行うものとし、AIは支援ツールである旨を示す
5. 専門家の視点（整形外科医・PT・AT等）を複数含める

以下のJSON形式で回答してください。JSONのみ返し、前後の説明文は不要です:

{
  "title": "プロトコル名",
  "discussion": [
    {
      "role": "専門家の役割（例: 膝専門PT）",
      "emoji": "絵文字",
      "focus": "この専門家が重視する点（1文）",
      "recommendations": ["推奨事項1", "推奨事項2"],
      "cautions": ["注意点1", "注意点2"]
    }
  ],
  "consensusNotes": "複数の視点を統合したコンセンサスノート（2〜3文）",
  "phases": [
    {
      "order": 1,
      "title": "フェーズ名",
      "durationWeeks": "期間の目安",
      "goals": ["目標1", "目標2"],
      "exercises": [
        {
          "name": "エクササイズ名",
          "dose": "量・頻度（任意）",
          "notes": "注意点（任意）"
        }
      ],
      "advanceCriteria": [
        {
          "label": "基準名",
          "target": "達成目標値（目安・要確認を必ず付ける）"
        }
      ],
      "precautions": ["注意事項1"],
      "redFlags": ["赤旗1（即中止・受診の基準）"],
      "outcomes": ["評価指標1"],
      "evidence": "guideline|consensus|expert_opinion|needs_review"
    }
  ]
}`

interface RequestBody {
  patient: {
    name?: string
    age?: number
    diagnosis?: string
    joint?: string
    sport?: string
    eventDate?: string
    notes?: string
  }
  consentGiven: boolean
}

export async function POST(req: NextRequest) {
  if (!cleanKey || !cleanKey.startsWith('sk-ant-')) {
    return NextResponse.json({ error: 'APIキーが設定されていません' }, { status: 500 })
  }

  try {
    const body = await req.json() as RequestBody

    if (!body.consentGiven) {
      return NextResponse.json({ error: '同意が必要です' }, { status: 400 })
    }

    const { patient } = body
    const daysSince = patient.eventDate
      ? Math.floor((Date.now() - new Date(patient.eventDate).getTime()) / 86400000)
      : null

    const userMessage = `以下の患者情報に基づいてリハビリプロトコルを生成してください:

診断名: ${patient.diagnosis ?? '未記入'}
関節部位: ${patient.joint ?? '未記入'}
年齢: ${patient.age != null ? `${patient.age}歳` : '未記入'}
スポーツ: ${patient.sport ?? 'なし'}
受傷/手術日: ${patient.eventDate ?? '未記入'}${daysSince != null ? `（${daysSince}日経過）` : ''}
補足: ${patient.notes ?? 'なし'}

4〜5フェーズのリハビリプロトコルを生成してください。各フェーズには機能的移行基準（criteria-based progression）を含めてください。`

    const message = await client.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 8192,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
    })

    const raw = message.content[0].type === 'text' ? message.content[0].text : ''

    // JSONブロック抽出
    const blockMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/)
    const jsonStr = blockMatch ? blockMatch[1].trim() : raw.trim()

    let data: {
      title: string
      discussion: ExpertOpinion[]
      consensusNotes: string
      phases: Omit<Phase, 'id'>[]
    }

    try {
      data = JSON.parse(jsonStr)
    } catch (parseErr) {
      const truncated = jsonStr.length > 200 ? jsonStr.slice(-200) : jsonStr
      console.error('[protocol-generate] JSON parse failed:', parseErr)
      console.error('[protocol-generate] raw tail:', truncated)
      return NextResponse.json({
        error: 'AI応答のパースに失敗しました。再試行してください。',
        hint: message.stop_reason === 'max_tokens' ? 'レスポンスがトークン上限に達しました' : undefined,
      }, { status: 500 })
    }

    return NextResponse.json({ protocol: data, generatedBy: 'ai' })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: 'サーバーエラー', detail: msg }, { status: 500 })
  }
}
