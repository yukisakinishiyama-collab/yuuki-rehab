/**
 * 疑問メモの AI相談（サーバー専用。Claude）
 *
 * 入力は、画面で作った「個人が分からない要約」（consult-context.ts）と院長の疑問。
 * お名前などは画面側で除いてあり、サーバーでも本文をログに残さない。
 * 返事は参考意見。診断・判断は院長が行う。
 *
 * 必要な設定: ANTHROPIC_API_KEY（問診分析・紹介状・音声入力と同じもの）
 */
import Anthropic from '@anthropic-ai/sdk'
import type { ConsultItem } from './consult-context'

const MODELS = ['claude-sonnet-5', 'claude-haiku-4-5-20251001']

export function consultConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY)
}

function client(): Anthropic {
  const raw = process.env.ANTHROPIC_API_KEY ?? ''
  const match = raw.match(/sk-ant-[A-Za-z0-9_-]+/)
  const apiKey = match ? match[0] : raw.replace(/[^\x20-\x7E]/g, '').trim()
  return new Anthropic({ apiKey })
}

const SYSTEM = `あなたは、整骨院の院長（柔道整復師）が臨床で抱いた疑問を一緒に考える相談相手です。整形外科的リハビリ・スポーツ外傷の知識をもとに、日本語で答えてください。

渡される情報は、患者さん1人分のカルテの要約（個人が分からない形）と、院長の疑問です。

答え方:
- 見出しは次の4つ。該当しない見出しは省いてよい。
  「考えられること」… 疑問に対する見立てを、根拠（カルテのどの所見か）とともに。可能性の高い順に。
  「確かめたいこと」… 追加で聞くこと・見ること・測ること・テスト。何が分かれば見立てが絞れるか。
  「対応の選択肢」… 施術・運動・負荷の調整・生活指導など、院長が選べる案。それぞれの狙いと注意点。
  「医療機関への紹介を考える目安」… 骨折・靱帯断裂・感染・神経症状・全身症状など、整形外科や他科での診察が必要になりうるサイン。該当するものがカルテにあれば明示する。
- カルテに書かれていないことは「カルテには記載がない」と言い、勝手に補わない。
- 断定や「治る」「必ず良くなる」といった保証はしない。参考意見であり、判断は院長が行う。
- 簡潔に。全体でおおむね600〜900字。箇条書き中心。専門用語はそのまま使ってよい。
- お名前などの個人を特定する情報は、万一含まれていても出力に書かない。`

export interface ConsultInput {
  question: string
  items: ConsultItem[]
  /** 同じ疑問についての前回までのやりとり（任意） */
  previous?: Array<{ question: string; answer: string }>
}

export async function consultKarte(input: ConsultInput): Promise<{ answer: string; model: string }> {
  const context = input.items.length
    ? input.items.map(i => `【${i.label}】\n${i.text}`).join('\n\n')
    : '（カルテの情報は送られていません。疑問の文章だけで考えてください）'
  const previous = (input.previous ?? [])
    .slice(-3)
    .map((p, i) => `--- 以前の相談 ${i + 1} ---\n疑問: ${p.question}\n回答: ${p.answer}`)
    .join('\n\n')
  const user = [
    `【カルテの要約】\n${context}`,
    previous ? `【これまでの相談】\n${previous}` : '',
    `【院長の疑問】\n${input.question}`,
  ].filter(Boolean).join('\n\n')

  const anthropic = client()
  let lastError: unknown
  for (const model of MODELS) {
    try {
      const res = await anthropic.messages.create({
        model,
        max_tokens: 1800,
        system: SYSTEM,
        messages: [{ role: 'user', content: user }],
      })
      const answer = res.content
        .map(c => (c.type === 'text' ? c.text : ''))
        .join('')
        .trim()
      if (!answer) throw new Error('空の回答')
      return { answer, model }
    } catch (error) {
      lastError = error
      const status = (error as { status?: number }).status
      // モデルが使えない（404/400）ときだけ次のモデルへ。それ以外はそのまま失敗
      if (status !== 404 && status !== 400) break
    }
  }
  throw lastError instanceof Error ? lastError : new Error('AIに相談できませんでした')
}
