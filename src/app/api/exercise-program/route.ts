import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic()

// ── システムプロンプト ─────────────────────────────────────────────────────────
// ※ JSONキー名は必ず英語で固定。モデルが日本語キーを使うのを防ぐため
//    具体的な出力例を先に示す。
const SYSTEM_PROMPT = `You are a sports rehabilitation physical therapist.
Based on patient data, create a 15-minute home exercise program.

You MUST return ONLY a JSON code block in EXACTLY this format with EXACTLY these English key names.
Do NOT use Japanese key names. Do NOT add any text outside the code block.

\`\`\`json
{
  "targetArea": "例: 左膝・股関節",
  "goal": "例: 膝関節可動域改善・大腿四頭筋筋力増強",
  "totalMinutes": 15,
  "generalNotes": "全体的な注意事項を2〜3文で（日本語）",
  "exercises": [
    {
      "id": "ex1",
      "name": "運動名（日本語）",
      "phase": "warmup",
      "durationSec": 120,
      "sets": 2,
      "reps": "10回",
      "restSec": 30,
      "instruction": "ステップ1: 動作の説明\\nステップ2: 次の動作\\nステップ3: 注意点",
      "purpose": "この運動が必要な理由を1〜2文で",
      "caution": "注意事項（なければ省略可）",
      "youtubeQuery": "膝屈曲ストレッチ リハビリ 方法"
    }
  ]
}
\`\`\`

Rules:
- phase must be exactly: "warmup", "main", or "cooldown"
- warmup: 2-3 exercises (3-4 min total)
- main: 4-6 exercises (8-9 min total)
- cooldown: 1-2 exercises (2-3 min total)
- All text values in Japanese except key names
- youtubeQuery: Japanese keywords for YouTube search
- Do NOT include "必ず治る" or absolute medical claims
- ONLY return the JSON code block, nothing else`

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

    const statusLabel =
      caseData.status === 'initial'      ? '初回評価' :
      caseData.status === 'intervention' ? '介入中' :
      caseData.status === 'preReturn'    ? '復帰前評価' : '終了'

    const userMsg = `患者情報:
- 診断: ${caseData.diagnosis}
- 受傷部位: ${caseData.injuredPart}
- ${caseData.age}歳 ${caseData.gender === 'male' ? '男性' : caseData.gender === 'female' ? '女性' : 'その他'}
- 術後日数: ${caseData.postOpDays != null ? `${caseData.postOpDays}日目` : '非手術例'}
- 目的: ${caseData.evaluationPurpose}
- スポーツ: ${caseData.sport ?? 'なし'}
- 状態: ${statusLabel}
${evaluationSummary ? `\n動作解析メモ:\n${evaluationSummary}` : ''}

器具不要・自宅でできる15分運動プログラムをJSONで作成してください。`

    const message = await client.messages.create({
      model:      'claude-opus-4-5',
      max_tokens: 4096,   // 2000→4096に増加（途中切れ防止）
      system:     SYSTEM_PROMPT,
      messages:   [{ role: 'user', content: userMsg }],
    })

    const raw = message.content[0].type === 'text' ? message.content[0].text : ''

    // ── JSON抽出（コードブロックあり・なし両対応） ─────────────────────────
    let jsonStr = ''
    const blockMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/)
    if (blockMatch) {
      jsonStr = blockMatch[1].trim()
    } else {
      // コードブロックがない場合は全体をJSONとして試みる
      const objMatch = raw.match(/(\{[\s\S]*\})/)
      jsonStr = objMatch ? objMatch[1].trim() : raw.trim()
    }

    let program
    try {
      program = JSON.parse(jsonStr)
    } catch {
      console.error('[exercise-program] JSON parse error. stop_reason:', message.stop_reason)
      console.error('[exercise-program] raw snippet:', raw.slice(0, 300))
      return NextResponse.json(
        {
          error:   'AI応答のパースに失敗しました',
          detail:  `stop_reason: ${message.stop_reason}, tokens: ${message.usage.output_tokens}`,
          rawSnip: raw.slice(0, 500),
        },
        { status: 500 },
      )
    }

    // ── トップレベルフィールドの正規化 ────────────────────────────────────────
    const rawExercises: unknown[] =
      program.exercises ??
      program['運動プログラム'] ??
      program.exercises_list ??
      program.program ??
      []

    if (!Array.isArray(rawExercises)) {
      console.warn('[exercise-program] exercises is not an array:', typeof rawExercises)
    }

    // ── 運動項目ごとのフィールド正規化 ────────────────────────────────────────
    // モデルが返すキー名はバラバラなのでまとめてマッピング
    const exercises = (Array.isArray(rawExercises) ? rawExercises : []).map((e: unknown, i: number) => {
      const ex = e as Record<string, unknown>
      return {
        id:          String(ex.id ?? `ex${i + 1}`),
        name:        String(
          ex.name ?? ex.exercise_name ?? ex.exercise ?? ex['運動名'] ?? `運動${i + 1}`
        ),
        phase:       String(ex.phase ?? 'main'),
        durationSec: Number(
          ex.durationSec ?? ex.duration_seconds ?? ex.duration ?? ex['時間（秒）'] ?? 60
        ),
        sets:        ex.sets != null ? Number(ex.sets) : undefined,
        reps:        ex.reps != null ? String(ex.reps) :
                     ex.repetitions != null ? String(ex.repetitions) :
                     ex['回数'] != null ? String(ex['回数']) : undefined,
        restSec:     ex.restSec != null ? Number(ex.restSec) :
                     ex.rest_seconds != null ? Number(ex.rest_seconds) :
                     ex.rest != null ? Number(ex.rest) : undefined,
        instruction: String(
          ex.instruction ?? ex.instructions ?? ex.description ?? ex.steps ??
          ex.how_to ?? ex['実施方法'] ?? ex['手順'] ?? ex['説明'] ?? ''
        ),
        purpose:     String(
          ex.purpose ?? ex.objective ?? ex.goal ?? ex['目的'] ?? ex['効果'] ?? ''
        ),
        caution:     ex.caution ?? ex.precautions ?? ex.notes ?? ex['注意事項'] ?? ex['注意']
          ? String(ex.caution ?? ex.precautions ?? ex.notes ?? ex['注意事項'] ?? ex['注意'])
          : undefined,
        youtubeQuery: String(
          ex.youtubeQuery ?? ex.youtube_query ?? ex.search_query ??
          ex['検索キーワード'] ?? `${String(ex.name ?? ex.exercise_name ?? '')} リハビリ 方法`
        ),
      }
    })

    const normalized = {
      targetArea:   String(
        program.targetArea ?? program.target_area ?? program['対象部位'] ?? program['ターゲット'] ?? '患部'
      ),
      goal:         String(
        program.goal ?? program.goals ?? program.objective ?? program['目標'] ?? program['目的'] ?? ''
      ),
      totalMinutes: Number(
        program.totalMinutes ?? program.total_duration_minutes ?? program.total_minutes ??
        program.totalDuration ?? program.duration ?? 15
      ),
      generalNotes: String(
        program.generalNotes ?? program.general_notes ?? program.safetyNotes ??
        program.safety_notes ?? program.notes ?? program.cautions ??
        program['注意事項'] ?? program['全体的な注意'] ?? ''
      ),
      exercises,
    }

    return NextResponse.json({ program: normalized })
  } catch (err) {
    console.error('[exercise-program]', err)
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: 'サーバーエラーが発生しました', detail: msg }, { status: 500 })
  }
}
