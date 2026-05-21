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
    const { movementType, comments, evaluation, caseInfo, frames, customPrompt, personMarker } = body

    // 対象者マーカー情報をテキストに変換
    function describeMarker(m: { x: number; y: number; width: number; height: number; label: string } | undefined): string {
      if (!m) return ''
      const cx = Math.round((m.x + m.width / 2) * 100)
      const cy = Math.round((m.y + m.height / 2) * 100)
      const w  = Math.round(m.width  * 100)
      const h  = Math.round(m.height * 100)
      const hPos = cx < 33 ? '左' : cx > 66 ? '右' : '中央'
      const vPos = cy < 33 ? '上部' : cy > 66 ? '下部' : '中央部'
      return `【対象者マーカー】各フレーム画像に黄色のバウンディングボックスで「${m.label}」が明示されています。位置: 画面${hPos}${vPos}（中心 x=${cx}%, y=${cy}%）、サイズ ${w}×${h}%。このボックス内の人物が分析対象です。複数人が映っている場合はこのボックス内の人物のみを分析してください。`
    }

    const hasFrames = frames && frames.length > 0
    const movementLabel = MOVEMENT_TYPE_LABELS[movementType] ?? movementType

    // カスタムプロンプトがあればそれを使用
    let textPrompt: string

    if (customPrompt && customPrompt.trim()) {
      // カスタムプロンプトモード：ユーザーの指示をそのまま使用
      textPrompt = `${customPrompt.trim()}

${hasFrames ? `【添付画像】動画から${frames.length}枚のフレームを等間隔で抽出しています。実際の映像を観察して分析してください。` : '【注意】動画ファイルがないため、テキスト情報のみで分析します。'}
【動作タイプ】${movementLabel}
${caseInfo?.diagnosis ? `【背景情報】${caseInfo.diagnosis}${caseInfo?.age ? ` / ${caseInfo.age}歳` : ''}` : ''}
${describeMarker(personMarker)}`
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
${describeMarker(personMarker)}
【専門家コメント】
${commentsText}
【評価チェックリスト】
${evaluationText}
${hasFrames ? `\n【画像】動画から${frames.length}枚のフレームを等間隔で抽出しました。` : ''}

## 動作観察所見
## 主な問題点
## リスク評価
## 将来起こりうる怪我・合併症の予測
現疾患以外に、今の動作パターン・代償動作・筋力バランスから将来的に発生しやすい二次的な怪我や合併症を具体的に予測してください（例：反対側の過負荷、隣接関節の損傷リスク、慢性化リスクなど）。
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
