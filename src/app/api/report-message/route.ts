import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

// がんばりレポート「担当スタッフより」メッセージ＋がんばりポイントのAI下書き生成
// カルテ（SOAP・メモ）・評価データ・プロトコル現在地を読み取り、
// 患者様が前向きになれる思いやりのある文章を生成する。最終確認はスタッフが行う。

const rawKey = process.env.ANTHROPIC_API_KEY ?? ''
const keyMatch = rawKey.match(/sk-ant-[A-Za-z0-9_\-]+/)
const cleanKey = keyMatch ? keyMatch[0] : rawKey.replace(/[^\x20-\x7E]/g, '').trim()
const client = new Anthropic({ apiKey: cleanKey || 'INVALID_KEY' })

const SYSTEM_PROMPT = `あなたは「ゆうき整骨院」の経験豊富なリハビリスタッフです。
患者様に手渡しする「リハビリがんばりレポート」の文章を作成します。

## 作成するもの
1. message: 「担当スタッフより」欄のメッセージ（220〜320字）
2. praisePoints: 「今回のがんばりポイント」の箇条書き（3〜4個、各45字以内）

## メッセージの書き方（最重要）
- 患者様の名前があれば「◯◯様」と呼びかけから始める（名前がなければ呼びかけは省略）
- 通院・リハビリを続けてこられたこと自体をまず労う
- カルテのメモや患者様の悩み・不安が分かる場合は、それに具体的に共感し寄り添う（不安を否定しない）
- 評価データの良い変化を1〜2個、具体的な数字を交えて伝える
- 回復プログラムの現在地（全◯段階中◯段階目）に触れ、「ここまで来た」ことを実感してもらう
- 次の目標を、プレッシャーにならない自然な形で示す
- 「一緒に」「私たちがサポートします」という伴走の姿勢で締める
- です・ます調。温かく、思いやりがあり、押し付けがましくない文章
- 絵文字・顔文字・記号装飾は使わない（印刷レポートのため）
- 医学専門用語は平易な言葉に置き換える

## がんばりポイントの書き方
- 事実（データ・記録）に基づく具体的なほめ言葉のみ
- 数字がある場合は「◯→◯」の形で変化を示す
- 継続・努力のプロセスもほめる（結果だけでなく）

## 禁止事項（医療広告ガイドライン準拠・厳守）
- 「完治」「完全に治る」「必ず治る」「絶対」「1回で治る」などの断定的表現
- 治癒の保証・期限の約束（「◯月には治ります」等）
- 悪化している指標を無理にほめる・事実の歪曲
- 記録にない出来事の捏造

## 出力形式
以下のJSONのみを出力（前後の説明文・コードブロック記号は不要）:
{"message": "メッセージ本文", "praisePoints": ["ポイント1", "ポイント2", "ポイント3"]}`

interface ReportContext {
  patient: {
    name?: string
    age?: number
    diagnosis?: string
    sport?: string
    concerns?: string
    notes?: string
    daysSince?: number
  }
  protocol: {
    title: string
    phaseCount: number
    currentPhaseNumber: number      // 1始まり
    currentPhaseTitle: string
    currentPhaseGoals: string[]
    unmetCriteria: string[]
    criteriaMetRatio: number        // 0-1
  }
  changes: Array<{ label: string; first: number; latest: number; unit: string; judgment: string }>
  milestonesAchieved: string[]
  nextMilestone?: string
  assessmentNotes: Array<{ date: string; note: string }>
  karteSoap: Array<{ date: string; concern?: string; improvements?: string; remaining?: string; nextGoal?: string }>
  karteMemos: Array<{ date: string; content: string }>
  assessmentCount: number
}

function buildUserPrompt(ctx: ReportContext): string {
  const p = ctx.patient
  const pr = ctx.protocol
  const lines: string[] = []

  lines.push('## 患者様の情報')
  if (p.name) lines.push(`- お名前: ${p.name} 様`)
  if (p.age) lines.push(`- 年齢: ${p.age}歳`)
  if (p.diagnosis) lines.push(`- 診断・状態: ${p.diagnosis}`)
  if (p.sport) lines.push(`- スポーツ・目標活動: ${p.sport}`)
  if (p.daysSince) lines.push(`- リハビリ開始から: ${p.daysSince}日`)
  if (p.concerns) lines.push(`- 患者様の悩み・不安: ${p.concerns}`)
  if (p.notes) lines.push(`- スタッフメモ: ${p.notes}`)

  lines.push('', '## 回復プログラムの現在地')
  lines.push(`- プログラム: ${pr.title}`)
  lines.push(`- 全${pr.phaseCount}段階中、第${pr.currentPhaseNumber}段階「${pr.currentPhaseTitle}」に取り組み中`)
  if (pr.currentPhaseGoals.length > 0) lines.push(`- この段階の目標: ${pr.currentPhaseGoals.join('、')}`)
  lines.push(`- 段階内の達成基準クリア率: ${Math.round(pr.criteriaMetRatio * 100)}%`)
  if (pr.unmetCriteria.length > 0) lines.push(`- 次にクリアしたい基準: ${pr.unmetCriteria.slice(0, 3).join('、')}`)

  if (ctx.changes.length > 0) {
    lines.push('', '## からだの変化（初回→最新）')
    for (const c of ctx.changes) {
      lines.push(`- ${c.label}: ${c.first}${c.unit} → ${c.latest}${c.unit}（${c.judgment === 'improved' ? '改善' : c.judgment === 'worsened' ? '要観察' : '維持'}）`)
    }
  }

  if (ctx.milestonesAchieved.length > 0) {
    lines.push('', '## 達成したマイルストーン')
    lines.push(ctx.milestonesAchieved.map(m => `- ${m}`).join('\n'))
  }
  if (ctx.nextMilestone) lines.push(`- 次の目標マイルストーン: ${ctx.nextMilestone}`)

  if (ctx.assessmentNotes.length > 0) {
    lines.push('', '## 評価時のメモ（直近）')
    for (const n of ctx.assessmentNotes) lines.push(`- ${n.date}: ${n.note}`)
  }

  if (ctx.karteSoap.length > 0) {
    lines.push('', '## カルテ（SOAP・直近の来院記録）')
    for (const s of ctx.karteSoap) {
      const parts: string[] = []
      if (s.concern) parts.push(`患者様の訴え・不安「${s.concern}」`)
      if (s.improvements) parts.push(`良くなった点「${s.improvements}」`)
      if (s.remaining) parts.push(`残っている課題「${s.remaining}」`)
      if (s.nextGoal) parts.push(`次の目標「${s.nextGoal}」`)
      if (parts.length > 0) lines.push(`- ${s.date}: ${parts.join(' / ')}`)
    }
  }

  if (ctx.karteMemos.length > 0) {
    lines.push('', '## カルテの簡易メモ（直近）')
    for (const m of ctx.karteMemos) lines.push(`- ${m.date}: ${m.content}`)
  }

  lines.push('', `## 記録回数`)
  lines.push(`- 評価・記録の回数: ${ctx.assessmentCount}回`)

  lines.push('', '上記のデータを読み取り、この患者様に向けたメッセージとがんばりポイントをJSONで作成してください。')
  return lines.join('\n')
}

export async function POST(req: NextRequest) {
  let ctx: ReportContext
  try {
    ctx = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid request body' }, { status: 400 })
  }

  try {
    const response = await client.messages.create({
      model: 'claude-opus-5',
      max_tokens: 1500,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: buildUserPrompt(ctx) }],
    })

    if (response.stop_reason === 'refusal') {
      return NextResponse.json({ error: 'generation refused' }, { status: 502 })
    }

    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map(b => b.text)
      .join('')

    // JSON部分を抽出（コードブロックで囲まれた場合にも対応）
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return NextResponse.json({ error: 'unexpected response format' }, { status: 502 })
    }
    const parsed = JSON.parse(jsonMatch[0]) as { message?: string; praisePoints?: string[] }
    if (!parsed.message || typeof parsed.message !== 'string') {
      return NextResponse.json({ error: 'missing message' }, { status: 502 })
    }

    return NextResponse.json({
      message: parsed.message.trim(),
      praisePoints: Array.isArray(parsed.praisePoints)
        ? parsed.praisePoints.filter((s): s is string => typeof s === 'string').slice(0, 4)
        : [],
    })
  } catch (err) {
    console.error('report-message generation failed:', err)
    return NextResponse.json({ error: 'AI generation failed' }, { status: 502 })
  }
}
