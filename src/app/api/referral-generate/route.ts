import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

export async function POST(req: NextRequest) {
  try {
    const rawKey = process.env.ANTHROPIC_API_KEY ?? ''
    const keyMatch = rawKey.match(/sk-ant-[A-Za-z0-9_\-]+/)
    const apiKey = keyMatch ? keyMatch[0] : rawKey.replace(/[^\x20-\x7E]/g, '').trim()
    const client = new Anthropic({ apiKey: apiKey || 'INVALID_KEY' })

    const { type, patient, destination, latestIntake, soapNotes, selectedSoapDate } = await req.json()

    // 問診データのサマリー
    const intakeSummary = latestIntake ? `
【最新問診票 (${latestIntake.intakeDate})】
主訴: ${latestIntake.chiefComplaint}
受傷機転: ${latestIntake.injuryMechanism || 'なし'}
受傷日: ${latestIntake.injuryDate || '不明'}
痛みNRS: ${latestIntake.painNrs}/10
痛みの性状: ${latestIntake.painCharacter?.join('、') || 'なし'}
悪化因子: ${latestIntake.worseFactor || 'なし'}
ADL困難: ${latestIntake.adlDifficulty?.join('、') || 'なし'}
スポーツ: ${latestIntake.sportsActivity || 'なし'}
目標: ${latestIntake.importantGoal || 'なし'}
既往歴: ${latestIntake.pastMedicalHistory || 'なし'}
画像所見: ${latestIntake.imagingResults || 'なし'}
疑い診断: ${latestIntake.suspectedDiagnosis || 'なし'}
施術者メモ: ${latestIntake.therapistNotes || 'なし'}
` : '問診票なし'

    // SOAPサマリー（先頭5件 ※selectedSoapDate がある場合は先頭に移動済み）
    const soapSummary = soapNotes.length > 0
      ? soapNotes.slice(0, 5).map((s: Record<string, unknown>, i: number) => `
[${i + 1}回目 ${s.visitDate}]${selectedSoapDate === s.visitDate ? '【参照指定日】' : ''} NRS:${s.painToday} Phase:${s.currentPhase}
  前回からの変化: ${s.changeFromLast || '—'}
  施術内容: ${s.treatmentContent || '—'}
  改善点: ${s.improvements || '—'}
  次回目標: ${s.nextGoal || '—'}
`).join('')
      : 'SOAPカルテなし'

    let prompt = ''

    if (type === 'patient') {
      prompt = `あなたは柔道整復師の補助AIです。以下の患者情報をもとに、患者さんへ手渡す「治療説明書」の内容を日本語で作成してください。

患者名: ${patient.name}
疾患・部位: ${patient.diagnosis || patient.bodyRegion}

${intakeSummary}

SOAPカルテ:
${soapSummary}

以下のJSON形式で出力してください。マークダウン・余分なテキスト不要：
{
  "diagnosis": "傷病名（わかりやすい表現で）",
  "onset": "",
  "symptoms": "現在の症状と状態（患者さんが理解しやすい言葉で2〜3文）",
  "course": "これまでの経過と今後の見通し（専門用語を避けて3〜4文）",
  "recommendedFrequency": "治療頻度の目安（急性期・回復期・維持期ごとの来院頻度を患者向けにわかりやすく2〜3文で。例：最初の2週間は週2〜3回のご来院をお勧めします。痛みが落ち着いてきたら週1回程度に移行していきます。）"
}`
    } else if (type === 'referral') {
      prompt = `あなたは柔道整復師の補助AIです。以下の患者情報をもとに、整形外科宛の紹介状（御紹介書）の本文を日本語で作成してください。

患者名: ${patient.name}
疾患・部位: ${patient.diagnosis || patient.bodyRegion}
紹介先: ${destination.institution} ${destination.department} ${destination.doctor}先生

${intakeSummary}

SOAPカルテ:
${soapSummary}

以下のJSON形式で出力してください。マークダウン・余分なテキスト不要：
{
  "diagnosis": "傷病名（簡潔に）",
  "onset": "発症経緯の文章（令和○年○月頃から〜のため○月○日に当院へご来院されました、の形式で2〜3文）",
  "symptoms": "症状・身体所見の文章（主訴、神経学的所見、スペシャルテスト結果、ROM等を含む3〜5文）",
  "course": "経過・紹介理由の文章（当院での対応と専門的診察が必要と判断した理由、締めの一文を含む3〜5文）"
}`
    } else {
      prompt = `あなたは柔道整復師の補助AIです。以下の患者情報をもとに、整形外科への報告書（御報告書）の本文を日本語で作成してください。

患者名: ${patient.name}
疾患・部位: ${patient.diagnosis || patient.bodyRegion}
報告先: ${destination.institution} ${destination.department} ${destination.doctor}先生

${intakeSummary}

SOAPカルテ（施術経過）:
${soapSummary}

以下のJSON形式で出力してください。マークダウン・余分なテキスト不要：
{
  "diagnosis": "傷病名（簡潔に）",
  "onset": "",
  "symptoms": "",
  "course": "経過報告の文章（「平素より大変お世話になっております。」で始まり、当院での施術内容・患者の経過・患者からの要望等・締めの文を含む4〜6文）"
}`
    }

    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    })

    const raw = (message.content[0] as { text: string }).text.trim()
    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('AI応答の解析に失敗しました')
    const content = JSON.parse(jsonMatch[0])

    return NextResponse.json({ content })
  } catch (e) {
    console.error('[referral-generate]', e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'AI生成に失敗しました' },
      { status: 500 },
    )
  }
}
