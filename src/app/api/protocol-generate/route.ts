import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import type { Phase, ExpertOpinion } from '@/types/protocol'

const rawKey = process.env.ANTHROPIC_API_KEY ?? ''
const keyMatch = rawKey.match(/sk-ant-[A-Za-z0-9_\-]+/)
const cleanKey = keyMatch ? keyMatch[0] : rawKey.replace(/[^\x20-\x7E]/g, '').trim()
const client = new Anthropic({ apiKey: cleanKey || 'INVALID_KEY' })

const SYSTEM_PROMPT = `あなたは整形外科リハビリテーション専門の医療AIアシスタントです。
患者情報に基づいて、エビデンスベースのリハビリプロトコルを生成します。

## 重要なルール
1. 下記「引用可能なガイドライン・文献リスト」に掲載された文献のみを citations として挙げること。リスト外の文献を引用する場合は必ず note に「要確認」を付ける
2. プロトコルは「時間基準」と「機能的基準（criteria-based progression）」を両方含める
3. 禁忌・中止基準・赤旗（red flags）を必ず含める
4. 最終判断は有資格の医療者が行うものとし、AIは支援ツールである旨を示す
5. 専門家の視点（整形外科医・PT・AT等）を複数含める
6. 各フェーズに参考文献を1〜3件付ける（evidenceGrade は Oxford CEBM 準拠: Ia/Ib/IIa/IIb/III/IV/V）

---

## 引用可能なガイドライン・文献リスト（疾患別）

### 膝関節 — ACL
- van Melick N et al. "Evidence-based clinical practice update: Practice guidelines for anterior cruciate ligament rehabilitation based on a systematic review and multidisciplinary consensus." BJSM 2016 [Ia]
- Grindem H et al. "Simple decision rules can reduce reinjury risk by 84% after ACL reconstruction: the Delaware-Oslo ACL cohort study." BJSM 2016 [Ib]
- Kyritsis P et al. "Likelihood of ACL graft rupture: not meeting six clinical discharge criteria before return to sport is associated with a four times greater risk of rupture." BJSM 2016 [IIb]
- JOSKAS ACL診療ガイドライン 2019（日本膝関節学会） [V]
- Ardern CL et al. "Consensus statement on return to sport from the First World Congress in Sports Physical Therapy, Bern." BJSM 2016 [V]

### 膝関節 — 半月板
- ISAKOS Meniscus Committee Consensus Statement on the Classification, Diagnosis and Management of Meniscal Injuries. 2021 [V]
- Monk AP et al. "Meniscal surgery in the era of personalized medicine: evolution of practice and contemporary indications for meniscal repair and replacement." JOSPT 2017 [IV]

### 膝関節 — TKA
- Pozzi F et al. "Rehabilitation after total knee arthroplasty: a meta-analysis." PTJ 2013 [Ia]
- AAOS Clinical Practice Guideline: Surgical Management of Osteoarthritis of the Knee. 2015 [V]

### 膝関節 — 膝蓋大腿痛（PFP）
- Crossley KM et al. "2016 Patellofemoral pain consensus statement from the 4th International Patellofemoral Pain Research Retreat, Manchester." BJSM 2016 [V]
- Collins NJ et al. "Patellofemoral joint kinematics during stair climbing in the coronal plane: the effect of width of steps." Knee Surg Sports Traumatol Arthrosc 2016 [IIb]

### 肩関節 — 腱板
- AAOS Clinical Practice Guideline: Optimizing the Management of Rotator Cuff Problems. 2019 [V]
- Ainsworth R, Lewis JS. "Exercise therapy for the conservative management of full thickness tears of the rotator cuff: a systematic review." BJSM 2007 [Ia]
- Thigpen CA et al. "The American Society of Shoulder and Elbow Therapists' consensus statement on rehabilitation following arthroscopic rotator cuff repair." J Shoulder Elbow Surg 2016 [V]

### 肩関節 — 凍結肩
- Page MJ et al. "Manual therapy and exercise for adhesive capsulitis (frozen shoulder)." Cochrane Database Syst Rev 2014 [Ia]
- Hanchard NC et al. "Evidence-based clinical guidelines for the diagnosis, assessment and physiotherapy management of contracted (frozen) shoulder." Physiotherapy 2011 [V]

### 肩関節 — 不安定症（関節唇）
- Longo UG et al. "Return to sport and recurrence rate after Bankart repair." J Shoulder Elbow Surg 2019 (systematic review) [Ia]

### 足関節 — 捻挫
- Vuurberg G et al. "Diagnosis, treatment and prevention of ankle sprains: update of an evidence-based clinical guideline." BJSM 2018 [Ia]
- Delahunt E et al. "Clinical assessment of acute lateral ankle sprain injuries (ROAST): 2019 consensus statement and recommendations of the International Ankle Consortium." BJSM 2018 [V]

### 足関節 — アキレス腱断裂
- Dams OC et al. "Return to sport after Achilles tendon rupture: a systematic review and meta-analysis." BJSM 2021 [Ia]
- Olsson N et al. "Modifiable prognostic factors early after acute Achilles tendon rupture." AJSM 2014 [IIb]
- Brumann M et al. "Accelerated rehabilitation following Achilles tendon repair after acute rupture — Development of an evidence-based treatment protocol." Injury 2014 [IV]

### 股関節 — THA
- AAOS Clinical Practice Guideline: Total Hip Arthroplasty in Patients Diagnosed with Osteoarthritis of the Hip. 2017 [V]
- Smith TO et al. "Rehabilitation following total hip replacement, total knee replacement and hip and knee osteotomy." Cochrane Database Syst Rev 2011 [Ia]

### 股関節 — FAI / 股関節鏡
- Griffin DR et al. "The Warwick Agreement on femoroacetabular impingement syndrome (FAI syndrome): an international consensus statement." BJSM 2016 [V]
- Kemp JL et al. "Hip arthroscopy and hip joint preservation surgery: consensus statement on the rehabilitation, athlete health and return to sport from the 2017 Hip FAI Consensus Meeting." BJSM 2019 [V]

### 脊椎 — 腰椎
- Qaseem A et al. "Noninvasive Treatments for Acute, Subacute, and Chronic Low Back Pain: A Clinical Practice Guideline from the American College of Physicians." Ann Intern Med 2017 [Ia]
- NICE guideline NG59: Low back pain and sciatica in over 16s: assessment and management. 2016 / updated 2024 [V]
- 日本整形外科学会・日本脊椎脊髄病学会 腰椎椎間板ヘルニア診療ガイドライン 2021 [V]
- Foster NE et al. "Prevention and treatment of low back pain: evidence, challenges, and promising directions." Lancet 2018 [Ia]

---

以下のJSON形式で回答してください。JSONのみ返し、前後の説明文は不要です:

{
  "title": "プロトコル名",
  "discussion": [
    {
      "role": "専門家の役割（例: 膝専門PT）",
      "emoji": "絵文字",
      "focus": "この専門家が重視する点（1文）",
      "recommendations": ["推奨事項1", "推奨事項2"],
      "cautions": ["注意点1", "注意点2"]
    }
  ],
  "consensusNotes": "複数の視点を統合したコンセンサスノート（2〜3文）",
  "phases": [
    {
      "order": 1,
      "title": "フェーズ名",
      "durationWeeks": "期間の目安",
      "goals": ["目標1", "目標2"],
      "exercises": [
        {
          "name": "エクササイズ名",
          "dose": "量・頻度（任意）",
          "notes": "注意点（任意）"
        }
      ],
      "advanceCriteria": [
        {
          "label": "基準名",
          "target": "達成目標値（目安・要確認を必ず付ける）"
        }
      ],
      "precautions": ["注意事項1"],
      "redFlags": ["赤旗1（即中止・受診の基準）"],
      "outcomes": ["評価指標1"],
      "evidence": "guideline|consensus|expert_opinion|needs_review",
      "references": [
        {
          "title": "文献・ガイドライン名",
          "source": "ジャーナル名 / 学会・発行元",
          "year": "発行年",
          "evidenceGrade": "Ia|Ib|IIa|IIb|III|IV|V",
          "note": "（リスト外文献の場合は「要確認」、それ以外は省略可）"
        }
      ]
    }
  ]
}`

interface LibraryPaper {
  title: string
  source: string
  year?: string
  abstract?: string
  evidenceGrade?: string
  notes?: string
}

interface RequestBody {
  patient: {
    name?: string
    age?: number
    diagnosis?: string
    joint?: string
    sport?: string
    eventDate?: string
    notes?: string
  }
  consentGiven: boolean
  libraryPapers?: LibraryPaper[]
}

export async function POST(req: NextRequest) {
  if (!cleanKey || !cleanKey.startsWith('sk-ant-')) {
    return NextResponse.json({ error: 'APIキーが設定されていません' }, { status: 500 })
  }

  try {
    const body = await req.json() as RequestBody

    if (!body.consentGiven) {
      return NextResponse.json({ error: '同意が必要です' }, { status: 400 })
    }

    const { patient } = body
    const daysSince = patient.eventDate
      ? Math.floor((Date.now() - new Date(patient.eventDate).getTime()) / 86400000)
      : null

    const { libraryPapers } = body
    const librarySection =
      libraryPapers && libraryPapers.length > 0
        ? `\n\n## 院内文献ライブラリ（優先的に引用してください）\n` +
          libraryPapers
            .map(
              (p, i) =>
                `${i + 1}. 【${p.evidenceGrade ?? '?'}】${p.title}\n   出典: ${p.source}${p.year ? ` (${p.year})` : ''}${
                  p.abstract ? `\n   概要: ${p.abstract.slice(0, 200)}…` : ''
                }${p.notes ? `\n   院内メモ: ${p.notes}` : ''}`,
            )
            .join('\n')
        : ''

    const userMessage = `以下の患者情報に基づいてリハビリプロトコルを生成してください:

診断名: ${patient.diagnosis ?? '未記入'}
関節部位: ${patient.joint ?? '未記入'}
年齢: ${patient.age != null ? `${patient.age}歳` : '未記入'}
スポーツ: ${patient.sport ?? 'なし'}
受傷/手術日: ${patient.eventDate ?? '未記入'}${daysSince != null ? `（${daysSince}日経過）` : ''}
補足: ${patient.notes ?? 'なし'}${librarySection}

4〜5フェーズのリハビリプロトコルを生成してください。
- 各フェーズには機能的移行基準（criteria-based progression）を含めてください
- 各フェーズの references フィールドに文献を1〜3件引用してください
- 「院内文献ライブラリ」に該当する論文がある場合は、システムプロンプトのリストより優先して引用してください
- リスト外の文献を引用する場合は note に「要確認」を必ず付けてください
- 引用は実在するガイドラインのみにし、著者名・ジャーナル名・発行年を正確に記述してください`

    const message = await client.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 8192,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
    })

    const raw = message.content[0].type === 'text' ? message.content[0].text : ''

    // JSONブロック抽出
    const blockMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/)
    const jsonStr = blockMatch ? blockMatch[1].trim() : raw.trim()

    let data: {
      title: string
      discussion: ExpertOpinion[]
      consensusNotes: string
      phases: Omit<Phase, 'id'>[]
    }

    try {
      data = JSON.parse(jsonStr)
    } catch (parseErr) {
      const truncated = jsonStr.length > 200 ? jsonStr.slice(-200) : jsonStr
      console.error('[protocol-generate] JSON parse failed:', parseErr)
      console.error('[protocol-generate] raw tail:', truncated)
      return NextResponse.json({
        error: 'AI応答のパースに失敗しました。再試行してください。',
        hint: message.stop_reason === 'max_tokens' ? 'レスポンスがトークン上限に達しました' : undefined,
      }, { status: 500 })
    }

    return NextResponse.json({ protocol: data, generatedBy: 'ai' })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: 'サーバーエラー', detail: msg }, { status: 500 })
  }
}
