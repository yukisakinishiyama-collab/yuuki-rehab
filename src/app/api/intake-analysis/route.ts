import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

export async function POST(req: NextRequest) {
  try {
    const rawKey = process.env.ANTHROPIC_API_KEY ?? ''
    const keyMatch = rawKey.match(/sk-ant-[A-Za-z0-9_\-]+/)
    const apiKey = keyMatch ? keyMatch[0] : rawKey.replace(/[^\x20-\x7E]/g, '').trim()
    const client = new Anthropic({ apiKey: apiKey || 'INVALID_KEY' })

    const { intake } = await req.json()

    const prompt = `あなたは整形外科・リハビリテーション専門の臨床AIアシスタントです。
以下の問診情報を読み、JSON形式で回答してください。

【問診情報】
主訴: ${intake.chiefComplaint}
受傷機転: ${intake.injuryMechanism}
痛み部位（全体）: ${intake.painLocations?.join('、') || 'なし'}
関節別詳細部位: ${JSON.stringify(intake.jointDetailLocations || {})}
痛みの強さ（NRS）: ${intake.painNrs}/10
痛みの性状: ${intake.painCharacter?.join('、') || 'なし'}
痛みのタイミング: ${intake.painTiming?.join('、') || 'なし'}
悪化因子: ${intake.worseFactor}
軽快因子: ${intake.betterFactor}
日常生活の困難: ${intake.adlDifficulty?.join('、') || 'なし'}
スポーツ・活動: ${intake.sportsActivity}
最も取り戻したい動作: ${intake.importantGoal}
既往歴: ${intake.pastMedicalHistory}
画像所見: ${intake.imagingResults}
受傷機転（詳細）: ${intake.injuryMechanism}
初発か再発か: ${intake.firstTimeSymptoм ? '初発' : '再発'}

以下のJSON形式で回答してください。マークダウンや余分なテキストは不要です：
{
  "suggestedTests": ["テスト1", "テスト2", ...],
  "differentials": [
    { "diagnosis": "疑い診断名", "likelihood": "高/中/低", "reason": "理由" }
  ],
  "protocol": "推奨プロトコルの説明（フェーズと目標を含む300字程度）",
  "reasoning": "推論の根拠（なぜこのテストと診断を選んだか200字程度）",
  "redFlags": ["注意すべき所見があれば（なければ空配列）"],
  "priorityAssessment": "最初に評価すべき最重要ポイント（1〜2文）"
}`

    const msg = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1500,
      messages: [{ role: 'user', content: prompt }],
    })

    const text = msg.content[0].type === 'text' ? msg.content[0].text : '{}'

    // JSON部分を抽出
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    const result = jsonMatch ? JSON.parse(jsonMatch[0]) : {}

    return NextResponse.json({ result })
  } catch (error) {
    console.error('Intake analysis error:', error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
