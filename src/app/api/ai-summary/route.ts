import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

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

// ── システムプロンプト（改善版） ─────────────────────────────────────────────
const SYSTEM_PROMPT = `あなたはスポーツ整形外科・リハビリテーション領域に特化した動作解析AIです。

本解析は、医師・理学療法士・柔道整復師などの臨床家の意思決定を補助する目的で行います。
解析は「診断」ではなく、動作特徴抽出・代償動作検出・左右差評価を目的としてください。

# 解析目的（優先順）
- 動作特徴抽出
- 左右差評価
- 荷重偏位検出
- 代償動作検出
- スポーツ復帰支援
- 術後リハビリ評価
- 経時変化比較

対象外: 正確なROM測定 / 医学的確定診断 / MRI所見推定 / 靭帯損傷断定

# 解析前処理

## 1. カメラ水平補正
床ライン・壁ライン・窓枠・天井照明を用いて画像全体の傾きを補正すること。
カメラ傾斜による前額面角度誤差を最小化すること。

## 2. キャリブレーション
自然立位を0°基準として扱うこと。
以下を初期誤差として除外すること:
骨盤傾斜 / 軽度側屈 / 軽度前傾 / カメラ位置ズレ

# 骨格推定ルール

## 骨盤
ASISは直接取得できないため、hip midpointを骨盤中心として扱うこと。

## 体幹角度
肩ラインのみを用いず、「骨盤中心→胸骨中心」ベクトルで体幹傾斜を推定すること。

## 足関節解析
足関節角度は誤差が大きいため、絶対ROMとして扱わないこと。
優先評価: 荷重位置 / 回内傾向 / toe-out / 左右荷重差 / ヒールオフ / 接地パターン / 動的アライメント

## 足関節の禁止事項
以下を断定しないこと（2D解析では誤差が大きいため「推定値」として扱うこと）:
正確な底屈角度 / 正確な背屈角度 / 距骨下関節可動域 / FFDの断定

## 足部評価優先項目
静的: 踵外反 / 足部回内傾向 / toe-out / アーチ低下傾向 / 左右荷重差
動的: Dynamic knee valgus / 過回内 / 接地位置 / クロスオーバー接地 / ヒールオフタイミング / 骨盤ドロップ / Trendelenburg徴候

# 信頼性低下条件
以下の場合は解析信頼性低下を警告し「参考値」「誤差を含む可能性」と表示すること:
身体回旋 / 斜め撮影 / ランドマーク欠損 / 片脚遮蔽 / loose clothing / 被写体遠距離 / 足部不鮮明

# 臨床的解釈で推定すること
疼痛回避戦略 / 荷重回避 / 股関節代償 / 体幹代償 / 疲労代償 / 左右機能差
※確定診断は行わないこと

# 出力形式（必ずこの順序・見出しで出力すること）

## 1. AI所見サマリー
3〜5行で簡潔に記載

## 2. 動作特徴
箇条書きで記載
例: 右立脚期で骨盤ドロップ傾向 / 左股関節内転優位 / クロスオーバー接地傾向

## 3. 左右差
左右比較を記載

## 4. 足部・荷重評価
回内傾向 / toe-out / 荷重偏位 / 接地位置 / ヒールオフを記載

## 5. 臨床的解釈
代償動作を推定（確定診断は行わない）

## 6. 注意点
2D解析限界を必ず記載。
例: 「本解析は2D画像解析による推定値であり、実際の関節可動域とは誤差を含む可能性があります。」

# AIの立場
AIは「診断者」ではありません。
本解析はスポーツ動作分析およびリハビリテーション支援を目的とした補助ツールです。`

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY
    const client = new Anthropic({ apiKey })

    const body = await req.json()
    const { movementType, comments, evaluation, caseInfo, frames, customPrompt, personMarker } = body

    // 対象者マーカー情報
    function describeMarker(m: { x: number; y: number; width: number; height: number; label: string } | undefined): string {
      if (!m) return ''
      const cx  = Math.round((m.x + m.width / 2) * 100)
      const cy  = Math.round((m.y + m.height / 2) * 100)
      const w   = Math.round(m.width  * 100)
      const h   = Math.round(m.height * 100)
      const hPos = cx < 33 ? '左' : cx > 66 ? '右' : '中央'
      const vPos = cy < 33 ? '上部' : cy > 66 ? '下部' : '中央部'
      return `【対象者マーカー】各フレーム画像に黄色のバウンディングボックスで「${m.label}」が明示されています。位置: 画面${hPos}${vPos}（中心 x=${cx}%, y=${cy}%）、サイズ ${w}×${h}%。このボックス内の人物が分析対象です。複数人が映っている場合はこのボックス内の人物のみを分析してください。`
    }

    const hasFrames    = frames && frames.length > 0
    const movementLabel = MOVEMENT_TYPE_LABELS[movementType] ?? movementType

    // ── ユーザーメッセージ構築 ─────────────────────────────────────────────

    let userText: string

    if (customPrompt && customPrompt.trim()) {
      // カスタムプロンプトモード
      userText = `${customPrompt.trim()}

${hasFrames ? `【添付画像】動画から${frames.length}枚のフレームを等間隔で抽出しています。実際の映像を観察して分析してください。` : '【注意】動画ファイルがないため、テキスト情報のみで分析します。'}
【動作タイプ】${movementLabel}
${caseInfo?.diagnosis ? `【背景情報】${caseInfo.diagnosis}${caseInfo?.age ? ` / ${caseInfo.age}歳` : ''}` : ''}
${describeMarker(personMarker)}`
    } else {
      // デフォルトモード（改善版プロンプト形式）
      const commentsText = comments && comments.length > 0
        ? comments.map((c: { authorName: string; authorRole: string; type: string; text: string }) =>
            `・【${c.authorName} / ${c.type}】${c.text}`
          ).join('\n')
        : 'なし'

      const evaluationText = evaluation
        ? evaluation.items
            .filter((it: { severity: string; checked: boolean }) => it.severity !== '' || it.checked)
            .map((it: { label: string; severity: string; note: string }) =>
              `・${it.label}: ${it.severity}${it.note ? `（${it.note}）` : ''}`
            ).join('\n') + (evaluation.overallNote ? `\n総合所見: ${evaluation.overallNote}` : '')
        : 'なし'

      userText = `以下の症例・動作データを解析し、指定の出力形式に従ってレポートを作成してください。

【動作タイプ】${movementLabel}
【患者情報】${caseInfo?.diagnosis ?? '不明'}${caseInfo?.age ? ` / ${caseInfo.age}歳` : ''}
${describeMarker(personMarker)}

【専門家コメント】
${commentsText}

【評価チェックリスト】
${evaluationText}

${hasFrames
  ? `【添付画像】動画から${frames.length}枚のフレームを等間隔で抽出しました。\n実際の映像を観察し、以下を重点的に評価してください:\n・カメラ水平補正（床・壁・窓枠を基準に傾き補正）\n・自然立位を0°基準としたキャリブレーション\n・骨盤中心→胸骨中心ベクトルによる体幹傾斜\n・足部の荷重位置・回内・toe-out・接地パターン\n・左右差・代償動作・Dynamic knee valgus`
  : '【注意】画像なし。テキスト情報のみで分析します。'
}

上記のシステム指示に従い、6項目の出力形式で解析レポートを作成してください。`
    }

    // ── Claude API 呼び出し ────────────────────────────────────────────────

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
        model:      'claude-opus-4-5',
        max_tokens: 2000,
        system:     SYSTEM_PROMPT,
        messages: [{
          role: 'user',
          content: [
            ...imageContents,
            { type: 'text', text: userText },
          ],
        }],
      })

      const text = message.content[0].type === 'text' ? message.content[0].text : ''
      return NextResponse.json({ summary: text, frameCount: frames.length })
    }

    // 画像なし
    const message = await client.messages.create({
      model:      'claude-opus-4-5',
      max_tokens: 1500,
      system:     SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userText }],
    })

    const text = message.content[0].type === 'text' ? message.content[0].text : ''
    return NextResponse.json({ summary: text, frameCount: 0 })

  } catch (error) {
    console.error('AI summary error:', error)
    const msg = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
