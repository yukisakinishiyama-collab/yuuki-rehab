/**
 * 1dayリハ生成API — その日の症状を緩和させる単回メニューをAIが組み立てる
 *
 * 通常のプロトコル（長期の段階的リハ）とは独立した、当日1セッション分の提案。
 * 対象は柔道整復師が院内で行う施術＋患者のセルフケア。
 *
 * 失敗時の扱い:
 * - このAPIが落ちても、クライアント側が必ずルールベースの基本メニュー
 *   （src/lib/oneday-rehab.ts buildBasicMenu）へフォールバックする。
 * - したがってここでは無理にリトライせず、素直にエラーを返してよい。
 *
 * 医療広告・安全:
 * - 「必ず治る」等の断定表現を禁止
 * - レッドフラッグはクライアント側でも独立に判定して重ねる（AI任せにしない）
 */
import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic()

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// 新しいモデルを優先し、使えない環境では旧モデルへ切り替える
const MODELS = ['claude-opus-5', 'claude-opus-4-5']

const SYSTEM_PROMPT = `You are an experienced judo therapist (柔道整復師) at a Japanese sports rehabilitation clinic.
Create a ONE-SESSION (single visit, today only) symptom-relief menu. This is NOT a long-term rehab plan —
the patient already has a separate ongoing protocol. Focus ONLY on relieving today's complaint safely.

You MUST return ONLY a JSON code block with EXACTLY these English key names.

\`\`\`json
{
  "title": "本日のメニューの短いタイトル（日本語）",
  "summary": "本日の方針を2〜3文で（日本語）",
  "items": [
    {
      "name": "施術・運動名（日本語）",
      "kind": "manual",
      "minutes": 4,
      "dose": "10回×2セット など（省略可）",
      "steps": "手順1\\n手順2\\n手順3",
      "purpose": "目的を1〜2文で",
      "caution": "注意点（なければ省略可）"
    }
  ],
  "homeAdvice": ["今夜〜明日にかけての自宅ケア助言（2〜4個）"],
  "avoidToday": ["今日避けるべきこと（1〜3個）"]
}
\`\`\`

Rules:
- kind must be exactly one of: "manual" (手技), "modality" (物理療法), "exercise", "stretch", "education"
- 4-7 items. Total minutes must fit the requested session length (±2 min).
- Order: relaxation/preparation → manual/modality → gentle movement → activation → closing (icing if swelling).
- If NRS >= 7: gentle relief only. NO strengthening. Prioritize not increasing pain.
- If swelling/heat is reported: NO heat modality. End with icing.
- 当日の注意サイン (warning signs of TODAY) rules — these override everything else:
  - 「発熱・患部が熱く赤い」or「排尿・排便の異常」: do NOT build a treatment menu. Return education-only
    items (状態確認・受診案内・安静指導). No heat, no massage, no exercise. Referral to a physician comes first.
  - 「直近1〜2日の強いケガ」: acute injury. NO heat, NO strong manual therapy, NO stretching.
    Menu = assessment + RICE (icing, compression/fixation guidance, elevation) + rest education only.
  - 「しびれ・力が入らない」: possible nerve involvement. NO aggressive stretching, avoid positions
    that worsen symptoms, recommend physician consultation in an education item.
  - 「夜間もズキズキ痛む」: treat as high irritability — gentle relief only, no strengthening.
- Respect the ongoing protocol's precautions and red flags given in the context — never contradict them.
- The practitioner performs manual therapy; exercises must be doable in the clinic without special equipment.
- All text in Japanese except key names. No absolute claims (必ず治る・完治・完全治癒 等は禁止).
- ONLY return the JSON code block, nothing else.`

interface RequestBody {
  context: {
    age?: number
    diagnosis?: string
    jointLabel?: string
    phaseTitle?: string
    precautions?: string[]
    redFlags?: string[]
    concerns?: string
  }
  input: {
    jointLabel: string
    symptomLabels: string[]
    nrs: number
    flagLabels: string[]
    /** レッドフラッグのキー（サーバー側の禁忌フィルタに使用） */
    flagKeys?: string[]
    trigger: string
    minutes: number
  }
}

/** 医療広告ガイドラインに抵触する断定表現（混入したら応答ごと破棄して基本メニューへ落とす） */
const FORBIDDEN_PATTERN = /必ず治る|完治|完全治癒|絶対に治|1回で治る|一回で治る/

/** 温熱系の項目（発熱・受傷直後では機械的に除外する） */
const HEAT_PATTERN = /温熱|ホットパック|温め|蒸しタオル|ホットタオル/

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as RequestBody
    const { context, input } = body
    if (!input || !Array.isArray(input.symptomLabels)) {
      return NextResponse.json({ error: '入力が不正です' }, { status: 400 })
    }

    const userMsg = `## 患者背景（進行中の長期プロトコル）
- 診断: ${context?.diagnosis || '不明'}
- 部位: ${context?.jointLabel || input.jointLabel}
- 年齢: ${context?.age != null ? `${context.age}歳` : '不明'}
- 現在のリハビリ段階: ${context?.phaseTitle || '不明'}
- この段階の禁忌・注意: ${(context?.precautions ?? []).join(' / ') || '特記なし'}
- この段階のレッドフラッグ: ${(context?.redFlags ?? []).join(' / ') || '特記なし'}
${context?.concerns ? `- 患者の悩み: ${context.concerns}` : ''}

## 今日の訴え（このメニューの対象）
- 部位: ${input.jointLabel}
- 症状: ${input.symptomLabels.join('・') || '不明'}
- 痛みの強さ（NRS）: ${input.nrs}/10
- 注意サイン: ${input.flagLabels.length > 0 ? input.flagLabels.join('・') : 'なし'}
- きっかけ・状況: ${input.trigger || '特になし'}
- セッション時間: ${input.minutes}分

今日の症状を安全に緩和する${input.minutes}分の単回メニューをJSONで作成してください。`

    let lastError: unknown = null
    for (const model of MODELS) {
      try {
        const message = await client.messages.create({
          model,
          max_tokens: 4096,
          system: SYSTEM_PROMPT,
          messages: [{ role: 'user', content: userMsg }],
        })
        const raw = message.content[0].type === 'text' ? message.content[0].text : ''

        // JSON抽出（コードブロックあり・なし両対応）
        const blockMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/)
        const jsonStr = blockMatch
          ? blockMatch[1].trim()
          : (raw.match(/(\{[\s\S]*\})/)?.[1] ?? raw).trim()

        let parsed: Record<string, unknown>
        try {
          parsed = JSON.parse(jsonStr) as Record<string, unknown>
        } catch {
          console.error('[oneday-rehab] JSON parse error. snippet:', raw.slice(0, 300))
          return NextResponse.json({ error: 'AI応答のパースに失敗しました' }, { status: 502 })
        }

        // 断定表現が混入した応答は採用しない（クライアントが基本メニューへ落とす）
        if (FORBIDDEN_PATTERN.test(jsonStr)) {
          console.error('[oneday-rehab] 禁止表現を検出したため応答を破棄')
          return NextResponse.json({ error: '応答に不適切な表現が含まれています' }, { status: 502 })
        }

        // ── 正規化（キーゆれ・型ゆれをまとめて吸収）──
        const KINDS = new Set(['manual', 'modality', 'exercise', 'stretch', 'education'])
        const rawItems = (Array.isArray(parsed.items) ? parsed.items : []).slice(0, 10)
        const items = rawItems.map((e: unknown, i: number) => {
          const ex = e as Record<string, unknown>
          const kind = String(ex.kind ?? 'exercise')
          return {
            name: String(ex.name ?? `項目${i + 1}`).slice(0, 60),
            kind: KINDS.has(kind) ? kind : 'exercise',
            minutes: Math.max(1, Math.min(15, Number(ex.minutes ?? 3) || 3)),
            dose: ex.dose != null && ex.dose !== '' ? String(ex.dose).slice(0, 60) : undefined,
            steps: String(ex.steps ?? ex.instruction ?? '').slice(0, 500),
            purpose: String(ex.purpose ?? '').slice(0, 200),
            caution: ex.caution != null && ex.caution !== '' ? String(ex.caution).slice(0, 200) : undefined,
          }
        })
        const toStringArray = (v: unknown, max: number): string[] =>
          (Array.isArray(v) ? v : []).map(x => String(x).slice(0, 200)).slice(0, max)

        // 当日フラグの禁忌をサーバー側でも機械的に除外（プロンプト任せにしない）
        const flagKeys = new Set((body.input.flagKeys ?? []).map(String))
        const acuteOrFever = flagKeys.has('fever') || flagKeys.has('fresh_trauma') || flagKeys.has('bladder_bowel')
        const filtered = items.filter(item => {
          if (acuteOrFever && HEAT_PATTERN.test(`${item.name} ${item.steps}`)) return false
          if ((flagKeys.has('fresh_trauma') || flagKeys.has('numbness')) && item.kind === 'stretch') return false
          return true
        })

        if (filtered.length === 0) {
          return NextResponse.json({ error: 'AI応答にメニューが含まれていません' }, { status: 502 })
        }

        return NextResponse.json({
          menu: {
            title: String(parsed.title ?? '本日の緩和メニュー').slice(0, 80),
            summary: String(parsed.summary ?? '').slice(0, 400),
            items: filtered,
            homeAdvice: toStringArray(parsed.homeAdvice, 5),
            avoidToday: toStringArray(parsed.avoidToday, 4),
            source: 'ai' as const,
          },
          model,
        })
      } catch (error) {
        lastError = error
        // モデルが見つからない場合のみ次の候補へ。それ以外は打ち切り
        const msg = error instanceof Error ? error.message : String(error)
        if (/not_found|model/i.test(msg) && model !== MODELS[MODELS.length - 1]) continue
        break
      }
    }

    console.error('[oneday-rehab]', lastError)
    const msg = lastError instanceof Error ? lastError.message : String(lastError)
    return NextResponse.json({ error: 'AI生成に失敗しました', detail: msg }, { status: 502 })
  } catch (err) {
    console.error('[oneday-rehab]', err)
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
  }
}
