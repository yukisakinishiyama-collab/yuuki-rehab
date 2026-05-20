import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'


const MOVEMENT_TYPE_LABELS: Record<string, string> = {
  walking: '歩行',
  squat: 'スクワット',
  jump_landing: 'ジャンプ着地',
  shoulder: '肩関節運動',
  stair: '階段昇降',
  balance: 'バランス',
  other: 'その他',
  ballet: 'バレエ',
  jazz: 'ジャズダンス',
  hiphop: 'Hip hop',
  breakdance: 'ブレイクダンス',
}

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY
    const client = new Anthropic({ apiKey })

    const body = await req.json()
    const { movementType, comments, evaluation, caseInfo, frames, customPrompt } = body

    const hasFrames = frames && frames.length > 0
    const movementLabel = MOVEMENT_TYPE_LABELS[movementType] ?? movementType

    // カスタムプロンプトがあればそれを使用
    let textPrompt: string

    if (customPrompt && customPrompt.trim()) {
      // カスタムプロンプトモード：ユーザーの指示をそのまま使用
      textPrompt = `${customPrompt.trim()}

${hasFrames ? `【添付画像】動画から${frames.length}枚のフレームを等間隔で抽出しています。実際の映像を観察して分析してください。` : '【注意】動画ファイルがないため、テキスト情報のみで分析します。'}
【動作タイプ】${movementLabel}
${caseInfo?.diagnosis ? `【背景情報】${caseInfo.diagnosis}${caseInfo?.age ? ` / ${caseInfo.age}歳` : ''}` : ''}`
    } else {
      // デフォルトプロンプトモード
      const commentsText = comments.length > 0
        ? comments.map((c: { authorName: string; authorRole: string; type: string; text: string }) =>
            `【${c.authorName} / ${c.type}】${c.text}`
          ).join('\n')
        : 'なし'

      const evaluationText = evaluation
        ? evaluation.items
            .filter((it: { severity: string; checked: boolean }) => it.severity !== '' || it.checked)
            .map((it: { label: string; severity: string; note: string }) =>
              `・${it.label}: ${it.severity}${it.note ? `（${it.note}）` : ''}`
            ).join('\n') + (evaluation.overallNote ? `\n総合: ${evaluation.overallNote}` : '')
        : 'なし'

      textPrompt = `あなたは運動器リハビリテーション・スポーツ医学の専門AIです。
${hasFrames ? '添付された動画フレーム画像を実際に観察し、' : ''}以下のデータを基に臨床的な動作分析レポートを作成してください。

【動作タイプ】${movementLabel}
【患者情報】${caseInfo?.diagnosis ?? '不明'}${caseInfo?.age ? ` / ${caseInfo.age}歳` : ''}
【専門家コメント】
${commentsText}
【評価チェックリスト】
${evaluationText}
${hasFrames ? `\n【画像】動画から${frames.length}枚のフレームを等間隔で抽出しました。` : ''}

## 動作観察所見
## 主な問題点
## リスク評価
## 推奨介入
## 復帰に向けた見解

---
※AIによる補助的分析です。最終判断は専門家が行ってください。`
    }

    // 画像あり：Vision APIを使用
    if (hasFrames) {
      const imageContents = frames.map((frame: string) => ({
        type: 'image' as const,
        source: {
          type: 'base64' as const,
          media_type: 'image/jpeg' as const,
          data: frame,
        },
      }))

      const message = await client.messages.create({
        model: 'claude-opus-4-5',
        max_tokens: 1500,
        messages: [{
          role: 'user',
          content: [
            ...imageContents,
            { type: 'text', text: textPrompt },
          ],
        }],
      })

      const text = message.content[0].type === 'text' ? message.content[0].text : ''
      return NextResponse.json({ summary: text, frameCount: frames.length })
    }

    // 画像なし：テキストのみ
    const message = await client.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 1200,
      messages: [{ role: 'user', content: textPrompt }],
    })

    const text = message.content[0].type === 'text' ? message.content[0].text : ''
    return NextResponse.json({ summary: text, frameCount: 0 })

  } catch (error) {
    console.error('AI summary error:', error)
    const msg = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
