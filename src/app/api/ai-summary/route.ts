import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import type { ExpertOpinion } from '@/types/rehab'

const MOVEMENT_TYPE_LABELS: Record<string, string> = {
  walking:      '歩行',
  squat:        'スクワット',
  jump_landing: 'ジャンプ着地',
  shoulder:     '肩関節運動',
  stair:        '階段昇降',
  balance:      'バランス',
  other:        'その他',
  ballet:       'バレエ',
  jazz:         'ジャズダンス',
  hiphop:       'Hip hop',
  breakdance:   'ブレイクダンス',
}

// ── 専門家パネル定義 ─────────────────────────────────────────────────────────
const EXPERTS: Array<{
  id: string; name: string; role: string; color: string
  systemPrompt: string
}> = [
  {
    id: 'ortho', name: 'スポーツ整形外科医', role: '整形外科専門医 / スポーツ医学',
    color: '#dc2626',
    systemPrompt: `あなたはスポーツ整形外科専門医です。
動作映像・動作データから、医学的観点で以下を評価してください。

主な視点:
- 受傷機転・再受傷リスクの評価
- 関節アライメント異常・不安定性の兆候
- 疼痛回避戦略・荷重回避の有無
- 術後症例の場合: 回復段階の妥当性、復帰時期の見解
- 隣接関節への二次的影響リスク

禁止: 確定診断・MRI所見推定・治療方針の断定
推定値には「推定」「可能性」と明記すること。
出力は箇条書きで簡潔に（200〜300字程度）。`,
  },
  {
    id: 'pt', name: '理学療法士', role: '運動器リハビリテーション専門PT',
    color: '#2563eb',
    systemPrompt: `あなたは運動器リハビリテーション専門の理学療法士です。
動作映像・動作データから、以下を評価してください。

主な視点:
- 動作パターン・代償動作の検出
- 筋力バランス・筋活動の左右差推定
- 関節可動域の動的制限
- 体幹安定性・骨盤コントロール
- 具体的なリハビリ介入の方向性（自動化・ROMex・筋力強化など）
- 段階的復帰プログラムへの示唆

2D解析の限界を踏まえ、推定値は「参考値」と明記すること。
出力は箇条書きで簡潔に（200〜300字程度）。`,
  },
  {
    id: 'at', name: 'アスレティックトレーナー', role: '認定アスレティックトレーナー (AT)',
    color: '#16a34a',
    systemPrompt: `あなたは認定アスレティックトレーナー(AT)です。
競技復帰・コンディショニングの観点から以下を評価してください。

主な視点:
- スポーツ動作特異的なリスク評価
- コンディショニング・ウォームアップの課題
- 動的アライメント（Dynamic knee valgus・体幹コントロール）
- 競技復帰基準への適合度
- テーピング・装具・サポーターの必要性示唆
- 予防的トレーニングの方向性

確定診断は行わず、競技サポートの視点で記述すること。
出力は箇条書きで簡潔に（200〜300字程度）。`,
  },
  {
    id: 'bio', name: 'バイオメカニクス専門家', role: 'スポーツ科学研究者 / 動作解析PhD',
    color: '#7c3aed',
    systemPrompt: `あなたはスポーツ科学・バイオメカニクス専門の研究者です。
力学的・運動学的観点から以下を評価してください。

主な視点:
- 重心移動・荷重分散パターン
- 関節モーメント・力のベクトル方向（推定）
- 運動連鎖の効率性（下肢→体幹→上肢）
- 左右非対称性の定性的評価
- エネルギー効率・動作の流暢性
- 2D解析の信頼性・誤差要因の指摘

数値は参考値として扱い、「推定」を明記すること。
出力は箇条書きで簡潔に（200〜300字程度）。`,
  },
  {
    id: 'judo', name: '柔道整復師', role: '認定柔道整復師 / スポーツ専門',
    color: '#d97706',
    systemPrompt: `あなたは認定柔道整復師（スポーツ専門）です。
筋骨格系・軟部組織の観点から以下を評価してください。

主な視点:
- 筋緊張・軟部組織の緊張パターン推定
- 関節可動域制限と筋短縮の関係
- 筋・腱・靭帯への反復ストレス部位の推定
- 骨盤・脊柱アライメントの動的変化
- 整復・手技療法の適応可能性
- スポーツ障害としての慢性化リスク

触診所見は不明であることを前提に、映像から推定できる範囲で記述すること。
出力は箇条書きで簡潔に（200〜300字程度）。`,
  },
]

// ── 共通ベースシステムプロンプト ─────────────────────────────────────────────
const BASE_SYSTEM = `本解析は医師・理学療法士・柔道整復師などの臨床家の意思決定を補助する目的です。
解析は「診断」ではなく、動作特徴抽出・代償動作検出・左右差評価を目的としてください。

解析前処理:
- 床ライン・壁ライン・窓枠を基準にカメラ水平を補正すること
- 自然立位を0°基準としてキャリブレーションすること（骨盤傾斜・軽度前傾は初期誤差として除外）

骨格推定ルール:
- 骨盤: hip midpointを骨盤中心として使用
- 体幹: 骨盤中心→胸骨中心ベクトルで傾斜推定（肩ラインのみ禁止）
- 足関節: 絶対ROM断定禁止。荷重・回内・toe-out・接地パターン優先

信頼性低下条件（該当する場合は「参考値」と明記）:
身体回旋・斜め撮影・ランドマーク欠損・片脚遮蔽・loose clothing`

// ── 合議総括プロンプト ─────────────────────────────────────────────────────
const SYNTHESIS_SYSTEM = `あなたはスポーツ医学・リハビリテーション領域のカンファレンスのモデレーターです。
5名の専門家の意見を統合し、以下の形式で合議結論を作成してください。

## 1. カンファレンス総括（AI所見サマリー）
3〜5行で要点を記載

## 2. 動作特徴（合意点）
全専門家が共通して指摘した動作特徴を箇条書きで

## 3. 左右差・荷重評価
左右差・荷重偏位に関する統合評価

## 4. 専門家間の注目ポイント
専門家によって異なる着眼点・追加情報が必要な点

## 5. 優先的臨床介入（合意に基づく推奨）
各専門家の意見を踏まえた優先介入を3項目以内で

## 6. 注意事項
「本解析は5名の専門家AIによる合議に基づく補助的所見であり、最終判断は担当専門家が行ってください。2D画像解析による推定値であり、実際の所見とは誤差を含む可能性があります。」と必ず記載

AIは診断者ではなく補助ツールです。確定診断・治療方針の断定は行わないこと。`

export async function POST(req: NextRequest) {
  try {
    // APIキーから sk-ant- パターンを抽出（非ASCII文字が混入していても対応）
    const rawKey = process.env.ANTHROPIC_API_KEY ?? ''
    const keyMatch = rawKey.match(/sk-ant-[A-Za-z0-9_\-]+/)
    const apiKey = keyMatch ? keyMatch[0] : rawKey.replace(/[^\x20-\x7E]/g, '').trim()
    const client = new Anthropic({ apiKey: apiKey || 'INVALID_KEY' })
    const body   = await req.json()

    const { movementType, comments, evaluation, caseInfo, frames, customPrompt, personMarker } = body

    // 対象者マーカー説明
    function describeMarker(m?: { x: number; y: number; width: number; height: number; label: string }): string {
      if (!m) return ''
      const cx   = Math.round((m.x + m.width / 2) * 100)
      const cy   = Math.round((m.y + m.height / 2) * 100)
      const hPos = cx < 33 ? '左' : cx > 66 ? '右' : '中央'
      const vPos = cy < 33 ? '上部' : cy > 66 ? '下部' : '中央部'
      return `【対象者マーカー】黄色ボックス「${m.label}」が画面${hPos}${vPos}に設定済み。複数人が映っている場合はこのボックス内の人物のみを分析してください。`
    }

    const hasFrames     = frames && frames.length > 0
    const movementLabel = MOVEMENT_TYPE_LABELS[movementType] ?? movementType

    const commentsText = comments && comments.length > 0
      ? comments.map((c: { authorName: string; type: string; text: string }) =>
          `・[${c.authorName} / ${c.type}] ${c.text}`).join('\n')
      : 'なし'

    const evaluationText = evaluation
      ? evaluation.items
          .filter((it: { severity: string; checked: boolean }) => it.severity !== '' || it.checked)
          .map((it: { label: string; severity: string; note: string }) =>
            `・${it.label}: ${it.severity}${it.note ? `（${it.note}）` : ''}`).join('\n')
          + (evaluation.overallNote ? `\n総合: ${evaluation.overallNote}` : '')
      : 'なし'

    // ── カスタムプロンプトモード（従来通り単体呼び出し）─────────────────────
    if (customPrompt && customPrompt.trim()) {
      const userText = `${customPrompt.trim()}

${hasFrames ? `【添付画像】${frames.length}枚のフレームを解析してください。` : '【画像なし】テキスト情報のみで分析します。'}
【動作タイプ】${movementLabel}
${caseInfo?.diagnosis ? `【症例情報】${caseInfo.diagnosis}${caseInfo?.age ? ` / ${caseInfo.age}歳` : ''}` : ''}
${describeMarker(personMarker)}`

      const content = hasFrames
        ? [...frames.map((f: string) => ({ type: 'image' as const, source: { type: 'base64' as const, media_type: 'image/jpeg' as const, data: f } })),
           { type: 'text' as const, text: userText }]
        : userText

      const msg = await client.messages.create({
        model: 'claude-opus-4-5', max_tokens: 2000, system: BASE_SYSTEM,
        messages: [{ role: 'user', content: typeof content === 'string' ? content : content }],
      })
      const text = msg.content[0].type === 'text' ? msg.content[0].text : ''
      return NextResponse.json({ summary: text, experts: [], frameCount: frames?.length ?? 0 })
    }

    // ── マルチエキスパートモード ──────────────────────────────────────────────

    // 各専門家への共通ケースデータ
    const caseContext = `【動作タイプ】${movementLabel}
【症例情報】${caseInfo?.diagnosis ?? '不明'}${caseInfo?.age ? ` / ${caseInfo.age}歳` : ''}
${describeMarker(personMarker)}
【専門家コメント（既存）】
${commentsText}
【評価チェックリスト】
${evaluationText}
${hasFrames ? `【添付画像】動画から${frames.length}枚のフレームを等間隔抽出。実際の映像を観察して評価してください。` : '【画像なし】テキスト情報のみで評価してください。'}`

    const imageContents = hasFrames
      ? frames.map((f: string) => ({ type: 'image' as const, source: { type: 'base64' as const, media_type: 'image/jpeg' as const, data: f } }))
      : []

    // 5専門家を並列実行
    const expertResults = await Promise.allSettled(
      EXPERTS.map(async (expert): Promise<ExpertOpinion> => {
        const userText = `${caseContext}

あなたは ${expert.name}（${expert.role}）として、上記の症例・動作データを評価してください。`

        const msg = await client.messages.create({
          model: 'claude-opus-4-5',
          max_tokens: 800,
          system: `${BASE_SYSTEM}\n\n${expert.systemPrompt}`,
          messages: [{
            role: 'user',
            content: hasFrames
              ? [...imageContents, { type: 'text' as const, text: userText }]
              : userText,
          }],
        })

        const opinion = msg.content[0].type === 'text' ? msg.content[0].text : '（取得失敗）'
        return { id: expert.id, name: expert.name, role: expert.role, color: expert.color, opinion }
      })
    )

    const experts: ExpertOpinion[] = expertResults.map((r, i) =>
      r.status === 'fulfilled'
        ? r.value
        : { id: EXPERTS[i].id, name: EXPERTS[i].name, role: EXPERTS[i].role, color: EXPERTS[i].color, opinion: '（解析エラー）' }
    )

    // 5専門家の意見を合議
    const expertSummaries = experts.map((e) =>
      `=== ${e.name}（${e.role}）===\n${e.opinion}`
    ).join('\n\n')

    const synthesisMsg = await client.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 2000,
      system: SYNTHESIS_SYSTEM,
      messages: [{
        role: 'user',
        content: `以下の5名の専門家の意見を統合し、カンファレンス合議結論を作成してください。

【症例背景】
動作タイプ: ${movementLabel}
患者情報: ${caseInfo?.diagnosis ?? '不明'}${caseInfo?.age ? ` / ${caseInfo.age}歳` : ''}

【各専門家の意見】
${expertSummaries}

上記を踏まえ、臨床的に有用な合議結論を作成してください。`,
      }],
    })

    const consensus = synthesisMsg.content[0].type === 'text' ? synthesisMsg.content[0].text : ''

    return NextResponse.json({
      summary:    consensus,
      experts,
      frameCount: frames?.length ?? 0,
    })

  } catch (error) {
    console.error('AI summary error:', error)
    const msg = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
