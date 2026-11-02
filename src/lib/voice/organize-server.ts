/**
 * 文字起こしから「患者さんの情報だけ」を取り出して、カルテの欄に振り分ける（サーバー専用。Claude）
 *
 * - soap: 施術中の会話（院長・スタッフ・患者さん・付き添いの方が混ざる）→ S/O/A/P の欄
 * - memo: 院長の口述 → 読みやすいメモ（言いよどみ・雑談を除く）
 * 雑談・手続きの話・お名前などの個人を特定できる情報は書かない。話に出ていないことは足さない。
 * 2026-11-02 院長の判断で、文字にした内容を Anthropic へ送る（問診分析・紹介状と同じ）。ログには内容を残さない。
 *
 * 必要な設定: ANTHROPIC_API_KEY（問診分析・紹介状と同じもの）
 */
import Anthropic from '@anthropic-ai/sdk'
import { z } from 'zod'
import {
  VOICE_SOAP_FIELDS,
  type SoapTextKey,
  type VoiceMemoResult,
  type VoiceSoapResult,
} from './soap-fields'

/** 先に試すモデル → 使えなければ次 */
const MODELS = ['claude-sonnet-5', 'claude-haiku-4-5-20251001']
/** 送る文字起こしの上限（約1時間分の会話） */
export const MAX_TRANSCRIPT_CHARS = 40_000

export function organizeConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY)
}

function client(): Anthropic {
  // 問診分析と同じく、貼り付けのときに混ざった余計な文字を除いて使う
  const raw = process.env.ANTHROPIC_API_KEY ?? ''
  const match = raw.match(/sk-ant-[A-Za-z0-9_-]+/)
  const apiKey = match ? match[0] : raw.replace(/[^\x20-\x7E]/g, '').trim()
  return new Anthropic({ apiKey })
}

const COMMON_RULES = `守ること:
- 文字起こしに出てきたことだけを書く。推測・一般論・補足を足さない。診断名・検査結果・数値を作らない。
- 雑談（天気・趣味・世間話・あいさつ）、予約や支払いの手続き、スタッフ同士の話は書かない。
- 個人を特定できる情報（お名前・住所・電話番号・勤務先や学校の名前・ご家族のお名前など）は書かない。必要なら「患者さん」「ご家族」と書く。
- 文字起こしの聞きまちがいは、文脈から明らかなときだけ正しい用語に直す（例:「ぜんじゅうじじんたい」→「前十字靭帯」）。何の話か分からない部分は書かない。
- 「治る」「必ず良くなる」など、結果を保証する言い方はしない。
- excluded には、書かなかった話の種類だけを短く入れる（例:「世間話」「予約の相談」）。お名前や中身は入れない。`

const SOAP_SYSTEM = `あなたは整骨院のカルテ記載を手伝う係です。
入力は、施術中の会話を文字起こししたものです。話し手の区別はありません（院長・スタッフ・患者さん・付き添いの方が混ざります）。
ここから、カルテに書くべき「患者さんの状態と施術の情報」だけを取り出し、record_soap の欄に振り分けてください。
- S（主観）は患者さんが話したこと、O（客観）は施術者が確かめたこと・測ったこと、A（評価）は施術者が評価として話したこと、P（計画）は今日の施術と今後の予定です。
- A（評価）は、施術者がはっきり評価を口にしたときだけ書く。AIの判断で評価を作らない。
- カルテの文体で短く書く（例:「階段の降りで右膝内側に痛みあり」「膝屈曲 右125°／左140°」「SLR 右(+)」「大腿四頭筋のセッティングを指導」）。1つの欄はおおむね120字以内、1行の欄は40字以内。
- 当てはまる話がない欄は空文字にする。
- painToday は、患者さんが痛みを0〜10の数字で答えたときだけ入れる（無ければ -1）。
- swelling・heat は、腫れ・熱感が「ある」と話に出たときだけ true（それ以外は false）。
- homeExerciseAdherence は、自宅運動をやったかどうかの話が出たときだけ（出なければ unknown）。
${COMMON_RULES}`

const MEMO_SYSTEM = `あなたは整骨院のカルテ記載を手伝う係です。
入力は、院長が患者さんについて話した口述メモの文字起こしです（ほかの人の声や雑談が混ざることがあります）。
これを、カルテのメモとして読みやすく整えて record_memo に入れてください。
- 言いよどみ（「えー」「あのー」）、言い直し、くり返し、雑談、その患者さんの状態と関係のない話は除く。
- 内容（症状・所見・施術・予定・数値）は変えない。順番は話した順を基本に、読みやすく短い文にする。
- カルテの文体（「〜あり」「〜を実施」「次回〜を確認」など）。全体で400字以内。
- カルテに書く内容が何も無いときは memo を空文字にする。
${COMMON_RULES}`

const soapProperties: Record<string, unknown> = Object.fromEntries(
  VOICE_SOAP_FIELDS.map((f) => [
    f.key,
    { type: 'string', description: `${f.section}「${f.label}」: ${f.hint}${f.singleLine ? '（1行・40字以内）' : ''}。無ければ空文字` },
  ]),
)

const SOAP_TOOL: Anthropic.Tool = {
  name: 'record_soap',
  description: '会話から取り出した患者さんの情報を、カルテ（SOAP）の欄に書き込む',
  input_schema: {
    type: 'object',
    properties: {
      ...soapProperties,
      painToday: { type: 'integer', minimum: -1, maximum: 10, description: '患者さんが数字で答えた痛み（NRS 0〜10）。無ければ -1' },
      swelling: { type: 'boolean', description: '腫れ（腫脹）があると話に出たときだけ true' },
      heat: { type: 'boolean', description: '熱感があると話に出たときだけ true' },
      homeExerciseAdherence: { type: 'string', enum: ['done', 'partial', 'not_done', 'unknown'], description: '自宅運動: できた=done／一部=partial／できなかった=not_done。話が無ければ unknown' },
      excluded: { type: 'array', items: { type: 'string' }, maxItems: 5, description: '書かなかった話の種類（例: 世間話）' },
    },
    required: [...VOICE_SOAP_FIELDS.map((f) => f.key), 'painToday', 'swelling', 'heat', 'homeExerciseAdherence', 'excluded'],
  },
}

const MEMO_TOOL: Anthropic.Tool = {
  name: 'record_memo',
  description: '口述を整えたカルテのメモを書き込む',
  input_schema: {
    type: 'object',
    properties: {
      memo: { type: 'string', description: '整えたメモ（400字以内）。書く内容が無ければ空文字' },
      excluded: { type: 'array', items: { type: 'string' }, maxItems: 5, description: '書かなかった話の種類（例: 世間話）' },
    },
    required: ['memo', 'excluded'],
  },
}

/** このモデルが使えない＝次のモデルを試す */
function shouldTryNext(error: unknown): boolean {
  if (!(error instanceof Anthropic.APIError)) return false
  return error.status === 404 || (error.status === 400 && /model/i.test(error.message))
}

async function callTool(system: string, tool: Anthropic.Tool, transcript: string): Promise<unknown> {
  const anthropic = client()
  let lastError: unknown = null
  for (const model of MODELS) {
    try {
      const message = await anthropic.messages.create({
        model,
        max_tokens: 2000,
        system,
        tools: [tool],
        tool_choice: { type: 'tool', name: tool.name },
        messages: [{ role: 'user', content: `<transcript>\n${transcript}\n</transcript>` }],
      })
      const block = message.content.find((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use')
      if (!block) throw new Error('AIの返事に結果がありませんでした')
      return block.input
    } catch (error) {
      lastError = error
      if (!shouldTryNext(error)) break
    }
  }
  throw lastError instanceof Error ? lastError : new Error('AIで整理できませんでした')
}

const clip = (s: unknown, max: number) => (typeof s === 'string' ? s.replace(/\r/g, '').trim().slice(0, max) : '')

const excludedSchema = z.array(z.unknown()).catch([])
function cleanExcluded(value: unknown): string[] {
  return excludedSchema
    .parse(value)
    .map((v) => clip(v, 30))
    .filter(Boolean)
    .slice(0, 5)
}

/** 施術中の会話 → SOAP の欄 */
export async function organizeSoap(transcript: string): Promise<VoiceSoapResult> {
  const raw = (await callTool(SOAP_SYSTEM, SOAP_TOOL, transcript.slice(0, MAX_TRANSCRIPT_CHARS))) as Record<string, unknown>
  const fields: Partial<Record<SoapTextKey, string>> = {}
  for (const f of VOICE_SOAP_FIELDS) {
    const text = clip(raw[f.key], f.singleLine ? 80 : 400)
    if (text) fields[f.key] = text
  }
  const result: VoiceSoapResult = { fields, excluded: cleanExcluded(raw.excluded) }
  const pain = Number(raw.painToday)
  if (typeof raw.painToday === 'number' && Number.isInteger(pain) && pain >= 0 && pain <= 10) result.painToday = pain
  if (raw.swelling === true) result.swelling = true
  if (raw.heat === true) result.heat = true
  if (raw.homeExerciseAdherence === 'done' || raw.homeExerciseAdherence === 'partial' || raw.homeExerciseAdherence === 'not_done') {
    result.homeExerciseAdherence = raw.homeExerciseAdherence
  }
  return result
}

/** 院長の口述 → 整えたメモ */
export async function organizeMemo(transcript: string): Promise<VoiceMemoResult> {
  const raw = (await callTool(MEMO_SYSTEM, MEMO_TOOL, transcript.slice(0, MAX_TRANSCRIPT_CHARS))) as Record<string, unknown>
  return { memo: clip(raw.memo, 800), excluded: cleanExcluded(raw.excluded) }
}
