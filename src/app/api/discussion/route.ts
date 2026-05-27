import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

// 環境変数のAPIキーから sk-ant- パターンを抽出（非ASCII文字が混入していても対応）
const rawKey = process.env.ANTHROPIC_API_KEY ?? ''
const keyMatch = rawKey.match(/sk-ant-[A-Za-z0-9_\-]+/)
const cleanKey = keyMatch ? keyMatch[0] : rawKey.replace(/[^\x20-\x7E]/g, '').trim()
console.log('[discussion] cleanKey prefix:', cleanKey.slice(0, 20) || '(empty – key invalid)')
const client = new Anthropic({ apiKey: cleanKey || 'INVALID_KEY' })

// ── 専門家ペルソナ（臨床的に詳細化） ─────────────────────────────────────────
const EXPERT_PERSONAS: Record<string, {
  name: string; color: string; emoji: string; systemPrompt: string
}> = {

  ortho: {
    name: '整形外科医', color: '#dc2626', emoji: '🏥',
    systemPrompt: `あなたは日本スポーツ整形外科学会専門医（経験20年）として、
理学療法士・トレーナーチームとカンファレンスを行います。

【あなたの専門領域】
- 膝関節（ACL/半月板/膝蓋腱）、足関節（靱帯損傷・骨折）、肩関節（腱板・SLAP）
- スポーツ外傷・障害の術前後管理
- 画像診断（MRI・X線・エコー）との統合的評価
- 復帰判断（RTP: Return to Play）の医学的基準

【回答指針】
1. 評価データから医学的に最重要なリスクを特定し「優先度順」で提示する
2. 鑑別診断の候補を挙げる（確定ではなく「鑑別に挙がる」表現）
3. 画像検査が必要と判断する場合は具体的な検査名・目的を明示
4. 術後症例では回復段階（Weeks/Phase）の妥当性を評価する
5. RTP基準（機能的・時期的）への見解を具体的数値で示す
6. PTへの医学的指示・協働ポイントを明示する

【禁止事項】
- 確定診断の断定（「〜です」→「〜の可能性があります」）
- 根拠なき治療法の推奨
- 「問題ありません」等の過度な安心の付与

【出力形式】
## 医学的評価
（最重要リスクと根拠）

## 鑑別すべき病態
（優先度順に3つまで）

## 精査・検査の提案
（必要な場合のみ）

## 復帰基準への見解
（時期・機能的基準）

## PT・ATへの連携事項
（具体的な指示・相談事項）`,
  },

  pt: {
    name: '理学療法士', color: '#2563eb', emoji: '🦴',
    systemPrompt: `あなたは運動器リハビリテーション専門理学療法士（認定PT、経験15年）として、
スポーツ医・ATとカンファレンスを行います。

【あなたの専門領域】
- 動作分析（歩行・ランニング・ジャンプ着地・スクワット・投球）
- 筋機能評価（MMT・等速性筋力）
- 関節可動域・筋柔軟性評価
- 神経筋コントロール・固有受容感覚
- 運動療法プログラム立案（急性期〜スポーツ復帰）

【回答指針】
1. 動作パターンの異常を「どの筋群の問題か」まで落とし込む
   例：「股関節外転筋（中殿筋・大殿筋）の筋力低下→ニーインの出現」
2. ROM制限は「筋性・関節性・神経性」の鑑別を行う
3. 代償動作の連鎖（近位から遠位へ）を説明する
4. リハビリ介入を「段階（Phase 1/2/3）」と「具体的手技」で提示する
   - Phase 1（疼痛管理・ROM回復）
   - Phase 2（筋力強化・神経筋コントロール）
   - Phase 3（スポーツ特異的動作訓練）
5. 評価指標（何を測って何を基準に進段するか）を明示する
6. 左右差・対称性の臨床的意味を説明する

【禁止事項】
- 医師の診断範囲への踏み込み
- 2D映像の限界を超えた断定（「おそらく」「参考値として」を使用）

【出力形式】
## 動作分析所見
（問題動作パターンと推定される機能障害）

## 機能障害の要因分析
（筋群・関節・神経筋制御の観点から）

## リハビリ介入計画
### Phase 1（目安: 〇〇週）
### Phase 2（目安: 〇〇週）
### Phase 3（目安: 〇〇週）

## 進段基準・評価指標
（何ができたら次のPhaseへ）

## 医師・ATへの連携事項`,
  },

  at: {
    name: 'アスレティックトレーナー', color: '#16a34a', emoji: '💪',
    systemPrompt: `あなたは日本アスレティックトレーニング学会認定AT（公認、経験12年）として、
スポーツ医・PTとカンファレンスを行います。

【あなたの専門領域】
- スポーツ現場での救急・テーピング・ブレーシング
- コンディショニング（S&C：筋力・スピード・アジリティ）
- 競技特性に応じた動作分析（野球/サッカー/陸上/バスケ等）
- 心理的リハビリサポート（怪我への恐怖感・復帰不安）
- ウォームアップ・クールダウン・自己管理プログラム

【回答指針】
1. 競技・ポジション固有のリスクを評価する
   例：「サッカーDF → 急速方向転換でACLへのストレス増大」
2. 練習・試合への参加可否と条件を実際的に提示する
   例：「接触プレー禁止でボール練習可」「テーピングで全参加可」
3. 現場で即使えるテーピング・コンプレッション法を提示する
4. S&Cプログラムの具体的種目・負荷設定を提示する
   例：「BSQ 3×8 60%1RM → 週次で5%増量」
5. 復帰後の再受傷予防策（動作指導・ウォームアップ）を提示する
6. 選手の心理面・モチベーション維持への配慮を示す

【禁止事項】
- 医師・PTの専門領域への踏み込み（診断・薬物）
- 根拠のない強行復帰の推奨

【出力形式】
## 競技復帰の実際的評価
（現状でどこまで参加可能か）

## 現場対応・テーピング
（すぐ使える処置）

## S&Cプログラム提案
（具体的種目・負荷・頻度）

## 再受傷予防策
（動作指導・ウォームアップ等）

## 選手への心理的サポート
## 医師・PTへの確認事項`,
  },
}

// ── リクエスト型 ─────────────────────────────────────────────────────────────
interface RequestBody {
  expertId: string
  messages: { role: 'user' | 'assistant'; content: string }[]
  structuredData: {
    caseInfo: {
      diagnosis: string
      injuredPart: string
      age: number
      gender: string
      sport?: string
      status: string
      postOpDays?: number
      evaluationPurpose: string
    }
    checklistIssues: Array<{
      movementType: string
      label: string
      severity: string
      note?: string
    }>
    romData: Array<{
      label: string
      max: number
      min: number
      range: number
      side: string
    }>
    problemComments: string[]
    aiSummary: string
    overallNotes: string[]
  }
}

// ── 構造化データ → 精密なプロンプトテキスト変換 ──────────────────────────────
function buildClinicalContext(data: RequestBody['structuredData']): string {
  const { caseInfo, checklistIssues, romData, problemComments, aiSummary, overallNotes } = data

  const statusMap: Record<string, string> = {
    initial: '初回評価', intervention: '介入中', preReturn: '復帰前評価', finished: '終了'
  }
  const genderMap: Record<string, string> = { male: '男性', female: '女性', other: 'その他' }

  const lines: string[] = []

  // ── 患者プロフィール ──
  lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  lines.push('【患者プロフィール】')
  lines.push(`診断名    : ${caseInfo.diagnosis}`)
  lines.push(`受傷部位  : ${caseInfo.injuredPart}`)
  lines.push(`年齢・性別: ${caseInfo.age}歳 ${genderMap[caseInfo.gender] ?? caseInfo.gender}`)
  lines.push(`競技種目  : ${caseInfo.sport ?? 'なし'}`)
  lines.push(`評価ステージ: ${statusMap[caseInfo.status] ?? caseInfo.status}`)
  lines.push(`評価目的  : ${caseInfo.evaluationPurpose}`)
  if (caseInfo.postOpDays != null) {
    lines.push(`術後日数  : ${caseInfo.postOpDays}日目`)
  } else {
    lines.push('手術歴    : なし（保存療法）')
  }

  // ── チェックリスト評価 ──
  if (checklistIssues.length > 0) {
    lines.push('')
    lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    lines.push('【動作評価チェックリスト（問題あり項目のみ）】')

    const sevMap: Record<string, string> = {
      severe: '🔴 重度', moderate: '🟡 中等度', mild: '🟢 軽度'
    }
    // 重症度順にソート
    const sorted = [...checklistIssues].sort((a, b) => {
      const order = { severe: 0, moderate: 1, mild: 2 }
      return (order[a.severity as keyof typeof order] ?? 3) - (order[b.severity as keyof typeof order] ?? 3)
    })
    for (const it of sorted) {
      const sev = sevMap[it.severity] ?? it.severity
      lines.push(`${sev} | ${it.movementType} | ${it.label}${it.note ? ` → ${it.note}` : ''}`)
    }
  } else {
    lines.push('')
    lines.push('【動作評価チェックリスト】: 問題あり項目なし（または未実施）')
  }

  // ── 動的ROM計測データ ──
  if (romData.length > 0) {
    lines.push('')
    lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    lines.push('【動的ROM計測（MediaPipe解析）】')
    lines.push('関節部位         | 最大  | 最小  | 可動域 | 側')

    for (const r of romData) {
      const label = r.label.padEnd(16)
      lines.push(`${label} | ${String(r.max).padStart(4)}° | ${String(r.min).padStart(4)}° | ${String(r.range).padStart(5)}° | ${r.side}`)
    }
    lines.push('※ 2D映像解析のため参考値。3Dバイオメカニクスとの差異に注意。')
  }

  // ── 動画コメント ──
  if (problemComments.length > 0) {
    lines.push('')
    lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    lines.push('【臨床観察コメント（問題点・リスク）】')
    for (const c of problemComments) {
      lines.push(`・${c}`)
    }
  }

  // ── AI専門家カンファレンス（直近） ──
  if (aiSummary) {
    lines.push('')
    lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    lines.push('【前回AIカンファレンス要旨】')
    lines.push(aiSummary)
  }

  // ── 評価者メモ ──
  if (overallNotes.length > 0) {
    lines.push('')
    lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    lines.push('【評価者メモ】')
    for (const n of overallNotes) {
      lines.push(`・${n}`)
    }
  }

  lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

  return lines.join('\n')
}

// ── ストリーミング POST ───────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  // APIキーの検証
  if (!cleanKey || !cleanKey.startsWith('sk-ant-')) {
    const rawKey = process.env.ANTHROPIC_API_KEY ?? ''
    console.error('[discussion] Invalid API key. rawKey length:', rawKey.length, 'first char code:', rawKey.charCodeAt(0))
    return NextResponse.json({
      error: 'APIキー設定エラー',
      detail: `Vercelの環境変数 ANTHROPIC_API_KEY が正しく設定されていません。現在の値の先頭文字コード: ${rawKey.charCodeAt(0)}。sk-ant-api03- で始まるキーを設定してください。`
    }, { status: 500 })
  }

  try {
    const body = await req.json() as RequestBody
    const { expertId, messages, structuredData } = body

    const persona = EXPERT_PERSONAS[expertId]
    if (!persona) {
      return NextResponse.json({ error: '不明な専門家IDです' }, { status: 400 })
    }

    const clinicalContext = buildClinicalContext(structuredData)

    const systemPrompt = `${persona.systemPrompt}

${clinicalContext}

上記の臨床データを十分に参照した上で、施術者チームからの質問・相談に
${persona.name}（${persona.emoji}）として回答してください。

回答は日本語で、臨床的根拠を示しながら具体的・実践的に記述してください。
曖昧な表現を避け、数値・基準・手技名を可能な限り明示してください。`

    const stream = await client.messages.create({
      model:      'claude-opus-4-5',
      max_tokens: 2048,
      system:     systemPrompt,
      messages:   messages,
      stream:     true,
    })

    const readable = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder()
        for await (const chunk of stream) {
          if (
            chunk.type === 'content_block_delta' &&
            chunk.delta.type === 'text_delta'
          ) {
            controller.enqueue(encoder.encode(chunk.delta.text))
          }
        }
        controller.close()
      },
    })

    return new Response(readable, {
      headers: {
        'Content-Type':      'text/plain; charset=utf-8',
        'X-Expert-Name':     persona.name,
        'X-Expert-Color':    persona.color,
        'Transfer-Encoding': 'chunked',
      },
    })
  } catch (err) {
    console.error('[discussion]', err)
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: 'サーバーエラー', detail: msg }, { status: 500 })
  }
}
