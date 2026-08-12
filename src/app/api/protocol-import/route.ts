import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

/**
 * 病院からもらったプロトコル（PDF）を、書いてあるとおりに読み取る
 *
 * 【この処理の役割】
 * 新しいプロトコルを"作る"のではなく、資料の内容を"写し取る"。
 * 提携先の術後プロトコルは、その病院の執刀医の方針であり、当院が
 * 勝手に補ったり良くしたりしてよいものではない。
 * そのため、書かれていないことは足さず、原文の表現を保つよう指示する。
 *
 * 読み取った結果はそのまま保存せず、画面で院長が確認してから反映する。
 */

const MAX_PDF_BYTES = 8 * 1024 * 1024

const EXTRACTION_PROMPT = `あなたは、医療機関が発行したリハビリテーションプロトコル文書を、
アプリの形式へ正確に書き写す作業者です。臨床判断や助言は行いません。

【最重要のルール】
1. 資料に書かれていることだけを書き写す。書かれていないことは絶対に補わない
2. 表現は原文のまま使う。言い換え・要約・改善をしない
3. 記載が無い項目は空の配列 [] または空文字 "" にする。推測で埋めない
4. 数値（週数・角度・荷重量・回数）は資料のとおりに写す。丸めない・換算しない
5. 判読できない箇所は、その項目に "（判読不能）" と明記する
6. あなた自身の推奨・注意喚起を追加しない

【出力形式】
以下のJSONだけを返してください。マークダウンや説明文は不要です。

{
  "sourceTitle": "資料の表題（記載どおり。無ければ空文字）",
  "sourceOrg": "発行元の病院・診療科名（記載どおり。無ければ空文字）",
  "surgeryOrCondition": "対象となる術式・疾患（記載どおり）",
  "overallNotes": "全体に関わる注意書き（記載どおり。無ければ空文字）",
  "phases": [
    {
      "order": 1,
      "title": "資料に書かれた期・フェーズの名称",
      "durationWeeks": "資料に書かれた期間（例: 術後0〜2週）",
      "goals": ["資料に書かれた目標をそのまま"],
      "exercises": [
        { "name": "運動名（原文）", "dose": "回数・頻度（原文。記載が無ければ空文字）", "notes": "注意（原文。無ければ空文字）" }
      ],
      "advanceCriteria": [
        { "label": "次の期へ進む基準（原文）", "target": "数値や条件（原文）" }
      ],
      "precautions": ["禁忌・注意事項を原文のまま"],
      "redFlags": ["中止・受診の基準が書かれていれば原文のまま"],
      "outcomes": ["評価指標が書かれていれば原文のまま"]
    }
  ],
  "unreadable": ["読み取れなかった箇所があれば、その旨を具体的に"],
  "notInDocument": ["アプリの項目のうち、資料に該当記載が無かったもの"]
}

【表形式（週数のマス目）の資料の場合】
術後プロトコルは「行＝運動項目、列＝術後の週数、印や色つきのマス＝その週に行う」
という表であることが多い。その場合は次のように写してください。
- 表の見出し行にある週数（例: 1 2 3 4 … 12 16 20）を確認する
- 各運動について、印が付いている列の範囲を dose に「◯〜◯週」の形で書く
  （飛んでいる場合は「1〜4週、8〜12週」のように、印のとおりに書く）
- 色や区切りで示されたPhase・セクションの見出しは title に使い、
  そのPhaseに含まれる行だけを exercises に入れる
- Phaseの durationWeeks は、そのPhaseに含まれる行の印が及ぶ週の範囲を書く
- 印の有無が判然としないマスは、推測で埋めず unreadable に具体的に挙げる

【読み取れない部分の扱い】
- 紙の端が切れている、影・傾き・かすれで読めない、手書きで判読できない場合は、
  その箇所を unreadable に「左端の制限欄が切れている」のように具体的に書く
- 特に、荷重制限・可動域制限・装具の欄が欠けているときは必ず挙げる。
  これらは記載が無いまま進めると危険なため

【注意】
- 荷重（PWB/FWB/免荷）、装具、可動域制限、禁止動作は、患者さんの安全に直結します。
  必ず原文の数値・条件のまま写してください
- フェーズの区切り方は資料の見出しに従ってください。勝手にまとめたり分けたりしない`

export async function POST(req: NextRequest) {
  try {
    const rawKey = process.env.ANTHROPIC_API_KEY ?? ''
    const keyMatch = rawKey.match(/sk-ant-[A-Za-z0-9_\-]+/)
    const apiKey = keyMatch ? keyMatch[0] : rawKey.replace(/[^\x20-\x7E]/g, '').trim()
    if (!apiKey) {
      return NextResponse.json({ error: 'AIの設定がありません（ANTHROPIC_API_KEY）' }, { status: 500 })
    }

    const body = await req.json() as {
      fileType?: string
      /** base64（data URL の接頭辞は含めない） */
      data?: string
      fileName?: string
      /** 補足指示（例: 「3ページ目の表だけ」） */
      hint?: string
    }

    if (!body.data) {
      return NextResponse.json({ error: '資料が指定されていません' }, { status: 400 })
    }
    // base64 の長さから元のバイト数を概算する
    const approxBytes = Math.floor((body.data.length * 3) / 4)
    if (approxBytes > MAX_PDF_BYTES) {
      return NextResponse.json(
        { error: '資料が大きすぎます（8MBまで）。必要なページだけを抜き出してお試しください。' },
        { status: 400 },
      )
    }

    const isPdf = (body.fileType ?? '').includes('pdf')
    const isImage = (body.fileType ?? '').startsWith('image/')
    if (!isPdf && !isImage) {
      return NextResponse.json(
        { error: 'PDFまたは画像のみ読み取れます' },
        { status: 400 },
      )
    }

    const client = new Anthropic({ apiKey })

    const documentBlock = isPdf
      ? {
          type: 'document' as const,
          source: { type: 'base64' as const, media_type: 'application/pdf' as const, data: body.data },
        }
      : {
          type: 'image' as const,
          source: {
            type: 'base64' as const,
            media_type: (body.fileType ?? 'image/png') as 'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif',
            data: body.data,
          },
        }

    const message = await client.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 8000,
      messages: [{
        role: 'user',
        content: [
          documentBlock,
          {
            type: 'text',
            text: body.hint
              ? `${EXTRACTION_PROMPT}\n\n【補足指示】${body.hint}`
              : EXTRACTION_PROMPT,
          },
        ],
      }],
    })

    const text = message.content[0]?.type === 'text' ? message.content[0].text : ''
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return NextResponse.json(
        { error: '資料を読み取れませんでした。ページ数を減らすか、鮮明な資料でお試しください。' },
        { status: 500 },
      )
    }

    let result: unknown
    try {
      result = JSON.parse(jsonMatch[0])
    } catch {
      return NextResponse.json(
        {
          error: '読み取り結果を整理できませんでした。もう一度お試しください。',
          hint: message.stop_reason === 'max_tokens' ? '資料が長すぎる可能性があります' : undefined,
        },
        { status: 500 },
      )
    }

    return NextResponse.json({
      result,
      truncated: message.stop_reason === 'max_tokens',
      fileName: body.fileName ?? '',
    })
  } catch (error) {
    console.error('[protocol-import] error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '読み取りに失敗しました' },
      { status: 500 },
    )
  }
}
