import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

// 環境変数のAPIキーからASCII以外の文字（日本語等）を除去してクライアント初期化
const rawKey = process.env.ANTHROPIC_API_KEY ?? ''
const cleanKey = rawKey.replace(/[^\x20-\x7E]/g, '').trim()
const client = new Anthropic({ apiKey: cleanKey })

// ── リクエスト型 ─────────────────────────────────────────────────────────────
interface RequestBody {
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
  evaluationSummary: {
    totalVideos: number
    totalEvals: number
    totalROMSessions: number
    severityCounts: { severe: number; moderate: number; mild: number }
    topIssues: Array<{ label: string; movementType: string; count: number; severity: string }>
    movementCoverage: string[]
  }
  romSummary: Array<{
    joint: string
    side: string
    avgMax: number
    avgMin: number
    avgRange: number
  }>
  checklistIssues: Array<{
    movementType: string
    label: string
    severity: string
    note?: string
    frequency: number
  }>
  aiSummaries: string[]
  overallNotes: string[]
  discussionHighlights: string[]
}

// ── 総合評価用システムプロンプト ──────────────────────────────────────────────
const SYSTEM_PROMPT = `あなたはリハビリテーション専門チームのリードクリニシャンです。
整形外科医・理学療法士・アスレティックトレーナーの知見を統合して
症例の「総合評価レポート」を作成します。

【出力形式】

## 🏥 総合所見
（症例全体の医学的・機能的評価を3〜5文で。最重要リスクを先頭に）

## 📊 評価データ解釈
（チェックリスト結果・ROM値・動作パターンの統合解釈。重症度別に分類）

## 🎯 優先すべき問題点
（1〜5位を優先度順でリスト。各項目に「なぜ重要か」を1文添付）

## 🔬 ROM分析
（左右差・可動域制限の臨床的意義。基準値との比較）

## 📋 推奨介入プログラム
### 即時対応（今すぐ開始）
### 短期目標（2〜4週）
### 中期目標（1〜3ヶ月）

## ⚠️ リスク管理
（再受傷・悪化リスクと予防策）

## 🏃 競技・活動復帰見通し
（復帰基準・時期の目安・条件付き復帰の可否）

【注意事項】
- 確定診断ではなく評価所見として記述する
- 数値・具体的手技名を可能な限り明示する
- 日本語で、臨床的根拠に基づいて記述する
- 曖昧な表現を避ける`

// ── 総合評価コンテキスト構築 ──────────────────────────────────────────────────
function buildOverallContext(body: RequestBody): string {
  const { caseInfo, evaluationSummary, romSummary, checklistIssues, aiSummaries, overallNotes, discussionHighlights } = body

  const statusMap: Record<string, string> = {
    initial: '初回評価', intervention: '介入中', preReturn: '復帰前評価', finished: '終了'
  }
  const genderMap: Record<string, string> = { male: '男性', female: '女性', other: 'その他' }
  const sevMap: Record<string, string> = { severe: '🔴重度', moderate: '🟡中等度', mild: '🟢軽度' }

  const lines: string[] = []

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

  lines.push('')
  lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  lines.push('【評価データ概要】')
  lines.push(`動画数       : ${evaluationSummary.totalVideos}件`)
  lines.push(`評価実施回数 : ${evaluationSummary.totalEvals}回`)
  lines.push(`ROM計測回数  : ${evaluationSummary.totalROMSessions}回`)
  lines.push(`重症度分布   : 🔴重度 ${evaluationSummary.severityCounts.severe}件 / 🟡中等度 ${evaluationSummary.severityCounts.moderate}件 / 🟢軽度 ${evaluationSummary.severityCounts.mild}件`)
  lines.push(`評価動作種別 : ${evaluationSummary.movementCoverage.join('、')}`)

  if (evaluationSummary.topIssues.length > 0) {
    lines.push('')
    lines.push('【頻出問題 TOP5】')
    evaluationSummary.topIssues.slice(0, 5).forEach((issue, i) => {
      const sev = sevMap[issue.severity] ?? issue.severity
      lines.push(`${i + 1}. ${sev} | ${issue.movementType} | ${issue.label}（${issue.count}回検出）`)
    })
  }

  if (checklistIssues.length > 0) {
    lines.push('')
    lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    lines.push('【チェックリスト全問題項目（重症度順）】')
    const sorted = [...checklistIssues].sort((a, b) => {
      const order = { severe: 0, moderate: 1, mild: 2 }
      return (order[a.severity as keyof typeof order] ?? 3) - (order[b.severity as keyof typeof order] ?? 3)
    })
    for (const it of sorted) {
      const sev = sevMap[it.severity] ?? it.severity
      const freq = it.frequency > 1 ? ` ×${it.frequency}` : ''
      lines.push(`${sev} | ${it.movementType} | ${it.label}${freq}${it.note ? ` → ${it.note}` : ''}`)
    }
  }

  if (romSummary.length > 0) {
    lines.push('')
    lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    lines.push('【ROM計測サマリー（全セッション平均）】')
    lines.push('関節              | 最大平均 | 最小平均 | 可動域平均 | 側')
    for (const r of romSummary) {
      const label = r.joint.padEnd(16)
      lines.push(`${label} | ${String(r.avgMax).padStart(5)}° | ${String(r.avgMin).padStart(5)}° | ${String(r.avgRange).padStart(7)}° | ${r.side}`)
    }
    lines.push('※ 2D映像解析のため参考値。')
  }

  if (aiSummaries.length > 0) {
    lines.push('')
    lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    lines.push('【これまでのAI専門家カンファレンス要旨】')
    aiSummaries.forEach((s, i) => {
      lines.push(`--- カンファレンス ${i + 1} ---`)
      lines.push(s.slice(0, 500) + (s.length > 500 ? '...' : ''))
    })
  }

  if (discussionHighlights.length > 0) {
    lines.push('')
    lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    lines.push('【AIディスカッション要点】')
    discussionHighlights.forEach((h) => lines.push(`・${h}`))
  }

  if (overallNotes.length > 0) {
    lines.push('')
    lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    lines.push('【評価者メモ】')
    overallNotes.forEach((n) => lines.push(`・${n}`))
  }

  lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

  return lines.join('\n')
}

// ── ストリーミング POST ───────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as RequestBody
    const context = buildOverallContext(body)

    const systemPrompt = `${SYSTEM_PROMPT}

${context}

上記のすべての評価データを統合し、臨床的に最も重要な情報を優先して
「総合評価レポート」を日本語で作成してください。`

    const stream = await client.messages.create({
      model:      'claude-opus-4-5',
      max_tokens: 3000,
      system:     systemPrompt,
      messages:   [{ role: 'user', content: '総合評価レポートを作成してください。' }],
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
        'Transfer-Encoding': 'chunked',
      },
    })
  } catch (err) {
    console.error('[overall-eval]', err)
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: 'サーバーエラー', detail: msg }, { status: 500 })
  }
}
