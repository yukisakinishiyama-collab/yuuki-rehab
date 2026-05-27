import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic()

// ── システムプロンプト ─────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `あなたはスポーツリハビリテーション専門の理学療法士（PT）です。
患者の診断・受傷部位・評価目的・動作分析データをもとに、
自宅または施設で「15分以内で完了できる」個別運動プログラムを作成してください。

## 出力形式（必ずこのJSONで返すこと）

\`\`\`json
{
  "targetArea": "例: 左膝・股関節",
  "goal": "例: 膝関節可動域改善・大腿四頭筋筋力増強",
  "totalMinutes": 15,
  "generalNotes": "全体的な注意事項（2〜3文）",
  "exercises": [
    {
      "id": "ex1",
      "name": "運動名（日本語・簡潔に）",
      "phase": "warmup",
      "durationSec": 120,
      "sets": 2,
      "reps": "10回",
      "restSec": 30,
      "instruction": "ステップ1: ...\\nステップ2: ...\\nステップ3: ...",
      "purpose": "この運動が必要な理由（1〜2文）",
      "caution": "注意事項があれば（なければ省略可）",
      "youtubeQuery": "YouTube検索用キーワード（日本語、例: 膝屈曲ストレッチ 理学療法 方法）"
    }
  ]
}
\`\`\`

## ルール
- phase は必ず warmup / main / cooldown のいずれか
- ウォームアップ: 2〜3種目（合計3〜4分）
- メイン: 4〜6種目（合計8〜9分）
- クールダウン: 1〜2種目（合計2〜3分）
- 合計 totalMinutes = 15（durationSec + restSec の合計を考慮）
- youtubeQuery は "運動名 + リハビリ + 方法" 形式で日本語にすること
- 医療広告ガイドラインに従い「必ず治る」等の断定表現を使わないこと
- 運動は患者の回復段階・術後日数を考慮した安全なものにすること
- JSON以外のテキストは不要（コードブロックのみ返すこと）`

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { caseData, evaluationSummary } = body as {
      caseData: {
        diagnosis: string
        injuredPart: string
        age: number
        gender: string
        postOpDays?: number
        evaluationPurpose: string
        sport?: string
        status: string
      }
      evaluationSummary?: string
    }

    // ── ユーザーメッセージを組み立て ────────────────────────────────────────
    const userMsg = `
## 患者情報
- 診断名: ${caseData.diagnosis}
- 受傷・手術部位: ${caseData.injuredPart}
- 年齢・性別: ${caseData.age}歳 ${caseData.gender === 'male' ? '男性' : caseData.gender === 'female' ? '女性' : 'その他'}
- 術後日数: ${caseData.postOpDays != null ? `${caseData.postOpDays}日目` : '非手術例または不明'}
- 評価目的: ${caseData.evaluationPurpose}
- スポーツ・種目: ${caseData.sport ?? '記載なし'}
- リハビリ状況: ${caseData.status === 'initial' ? '初回評価' : caseData.status === 'intervention' ? '介入中' : caseData.status === 'preReturn' ? '復帰前評価' : '終了'}

${evaluationSummary ? `## 動作解析・評価の要点\n${evaluationSummary}` : ''}

上記の患者情報をもとに、15分以内で実施できる個別運動プログラムを作成してください。
患者が自宅でひとりで実施できるよう、器具不要または身近なもので代用できる種目を優先してください。`

    const message = await client.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 2000,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMsg }],
    })

    const raw = message.content[0].type === 'text' ? message.content[0].text : ''

    // コードブロックからJSONを抽出
    const match = raw.match(/```(?:json)?\s*([\s\S]*?)```/)
    const jsonStr = match ? match[1].trim() : raw.trim()

    let program
    try {
      program = JSON.parse(jsonStr)
    } catch {
      return NextResponse.json({ error: 'AI応答のパースに失敗しました', raw }, { status: 500 })
    }

    return NextResponse.json({ program })
  } catch (err) {
    console.error('[exercise-program]', err)
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
  }
}
