/**
 * AI投稿生成の本体（サーバー専用）
 *
 * 「投稿を作る」画面の /api/marketing/generate と、毎週の自動下書き（自動投稿パイプライン）の
 * 両方から使う。院情報・医療広告ルール・媒体別ガイドをここに一元化する。
 * 生成後は必ずサーバー側で表現チェック（compliance.ts）を通してから返す。
 */
import Anthropic from '@anthropic-ai/sdk'
import { z } from 'zod'
import { checkContent } from './compliance'
import { clinicProfileToPrompt } from './clinic'
import {
  CHANNEL_LABELS,
  type Channel,
  type ClinicProfile,
  type ComplianceResult,
  type ContentVariant,
  type GeneratedContent,
} from './types'

/** 生成に使うモデル（院の運用で検証済みのもの） */
export const GENERATION_MODEL = 'claude-sonnet-5'

// ── AI出力検証（指示書23章） ─────────────────────────────────────
export const GeneratedContentSchema = z.object({
  title: z.string(),
  hook: z.string(),
  body: z.string().min(1),
  cta: z.object({ label: z.string(), url: z.string() }),
  hashtags: z.array(z.string()).default([]),
  slides: z
    .array(
      z.object({
        order: z.number(),
        heading: z.string(),
        body: z.string(),
        imagePrompt: z.string().optional(),
      }),
    )
    .optional(),
  imageText: z.string().optional(),
  altText: z.string().optional(),
  warnings: z.array(z.string()).default([]),
})

export const CHANNEL_GUIDES: Record<Channel, string> = {
  instagram_feed:
    '1行目のフックで手を止めさせる。本文は改行多めで読みやすく、箇条書きとまとめを含める。ハッシュタグは10個前後（#下関市 #彦島 など地域タグ含む）。imageTextに画像に載せる短い文言、altTextに代替テキスト。',
  instagram_carousel:
    'slides配列で表紙(order:1)＋内容2〜7枚＋最終CTAページを構成。各スライドはheading（短い見出し）とbody（2〜3文）。imagePromptに画像生成指示。captionとしてbodyに投稿本文、ハッシュタグも。',
  instagram_reel:
    'bodyに台本を書く。構成: 【冒頭3秒】フック→【シーン1..n】ナレーションと画面テキスト→【CTA】。撮影指示とBロール案も本文内に含める。hookにサムネイル文言。',
  instagram_story:
    'ストーリーは予約の空き状況だけを定型の画像で出す（AIでは作らない）。本文は院内の確認用の短い説明。',
  google_business:
    '地域性（下関市・彦島）を自然に含めた1500字以内の本文。冒頭に短い見出し。CTAは予約URL。ハッシュタグは使わない（hashtagsは空配列）。',
  line_broadcast:
    '通知に表示される冒頭文（hook・30字以内）が勝負。本文は500字以内、絵文字は控えめに1〜3個。友だち（既存患者・見込み患者）向けの親しみやすい文体。ハッシュタグは空配列。',
  note:
    '1500〜2500字の記事。タイトル・導入・見出し構成（##）・本文・要点・根拠と限界・患者向けまとめ。エビデンスに言及する場合は出典の限界も明記。',
}

export function buildSystemPrompt(clinicText: string): string {
  return `あなたはゆうき整骨院の広報ライターです。以下の院情報だけを事実として使用してください。

【院情報】
${clinicText}

【厳守 — 医療広告ガイドライン】
- 「必ず治る」「完全治癒」「1回で治る」「絶対」「No.1」「どこよりも」「最先端」「副作用なし」「奇跡」は禁止
- 診断の断定・治療効果の保証・他院や医師の否定・根拠のない数字・存在しない論文の引用は禁止
- 入力されていない患者情報・症例を作らない
- 「改善を目指す」「状態に合わせた」「エビデンスに基づいて提案する」等の表現を使う
- 必要に応じて医療機関の受診を案内する。来院だけを強引に勧めない

【出力形式】
必ずJSONのみを出力する。説明文・コードブロック記号は不要。`
}

// ── モック生成（外部APIなしで全フロー確認用） ─────────────────────
export function mockContent(channel: Channel, theme: string, reserveUrl: string): GeneratedContent {
  const base: GeneratedContent = {
    title: `【モック】${theme}`,
    hook: `${theme}、気になっていませんか？`,
    body: `（モック生成）${theme}についての${CHANNEL_LABELS[channel]}向け本文です。\n\n・ポイント1：状態の評価から始めます\n・ポイント2：状態に合わせた施術をご提案します\n・ポイント3：再発予防まで一緒に考えます\n\n気になる方はお気軽にご相談ください。`,
    cta: { label: 'ネット予約（24時間）', url: reserveUrl },
    hashtags: channel.startsWith('instagram') ? ['#下関市', '#彦島', '#ゆうき整骨院', `#${theme.slice(0, 8)}`] : [],
    warnings: ['モックモードで生成されたサンプルです'],
  }
  if (channel === 'instagram_carousel') {
    base.slides = [
      { order: 1, heading: theme, body: '表紙（モック）', imagePrompt: 'ネイビー基調の表紙' },
      { order: 2, heading: 'よくある悩み', body: 'モック本文です。', imagePrompt: '悩みのイラスト' },
      { order: 3, heading: 'ご相談ください', body: 'ネット予約は24時間受付です。', imagePrompt: 'CTAページ' },
    ]
  }
  return base
}

/** 生成済みコンテンツ全体の表現チェック（本文・スライド・画像文言・ハッシュタグ） */
export function checkGenerated(content: GeneratedContent, bannedPhrases?: string): ComplianceResult {
  return checkContent(
    [
      content.title,
      content.hook,
      content.body,
      content.imageText,
      ...(content.slides?.flatMap((s) => [s.heading, s.body]) ?? []),
      ...content.hashtags,
    ],
    bannedPhrases,
  )
}

export interface GenerateInput {
  objective: string
  theme: string
  audience?: string
  keyMessage?: string
  evidence?: string
  cta?: string
  tone?: string
  notes?: string
  channels: Channel[]
  profile: ClinicProfile
  /** 媒体ごとの追加指示（自動下書きで、媒体別の導線指示を足すのに使う） */
  channelNotes?: Partial<Record<Channel, string>>
  mock?: boolean
}

export interface GenerateOutput {
  mode: 'mock' | 'live'
  variants: ContentVariant[]
  errors: Array<{ channel: Channel; error: string }>
}

function buildUserPrompt(input: GenerateInput, channel: Channel): string {
  const { profile } = input
  return [
    `以下の条件で${CHANNEL_LABELS[channel]}のコンテンツを1本生成してください。`,
    '',
    `投稿の目的: ${input.objective}`,
    `テーマ: ${input.theme}`,
    input.audience && `対象者: ${input.audience}`,
    input.keyMessage && `最も伝えたいこと: ${input.keyMessage}`,
    input.evidence && `根拠資料（この範囲のみ使用可）: ${input.evidence}`,
    input.cta && `CTA: ${input.cta}`,
    input.tone && `トーン: ${input.tone}`,
    input.notes && `補足指示: ${input.notes}`,
    input.channelNotes?.[channel] && `この媒体での補足: ${input.channelNotes[channel]}`,
    '',
    `媒体別ガイド: ${CHANNEL_GUIDES[channel]}`,
    '',
    'JSONスキーマ:',
    '{"title":string,"hook":string,"body":string,"cta":{"label":string,"url":string},"hashtags":string[],"slides"?:[{"order":number,"heading":string,"body":string,"imagePrompt"?:string}],"imageText"?:string,"altText"?:string,"warnings":string[]}',
    `ctaのurlには原則 ${profile.reserveUrl} を使用（電話案内の場合は tel:${profile.phone.replace(/-/g, '')}）。`,
    '根拠が不十分・自信が持てない点があれば warnings に日本語で列挙する。',
  ]
    .filter(Boolean)
    .join('\n')
}

async function generateOne(
  anthropic: Anthropic,
  system: string,
  input: GenerateInput,
  channel: Channel,
): Promise<{ channel: Channel; content: GeneratedContent } | { channel: Channel; error: string }> {
  try {
    const message = await anthropic.messages.create({
      model: GENERATION_MODEL,
      max_tokens: 4000,
      system,
      messages: [{ role: 'user', content: buildUserPrompt(input, channel) }],
    })
    const text = message.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('')
    const jsonText = text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1)
    const content = GeneratedContentSchema.parse(JSON.parse(jsonText))
    return { channel, content }
  } catch (error) {
    return {
      channel,
      error: `生成に失敗しました（${error instanceof Error ? error.message.slice(0, 120) : '不明なエラー'}）`,
    }
  }
}

/**
 * 媒体ごとにコンテンツを生成し、表現チェック済みの下書きとして返す。
 * 1媒体の失敗が全体を止めないよう、媒体ごとに独立して生成する。
 * parallel=true で媒体を同時に生成する（自動下書きの所要時間短縮用）。
 */
export async function generateVariants(input: GenerateInput, options: { parallel?: boolean } = {}): Promise<GenerateOutput> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  const useMock = Boolean(input.mock) || process.env.MARKETING_MODE === 'mock' || !apiKey

  let results: Array<{ channel: Channel; content: GeneratedContent } | { channel: Channel; error: string }> = []

  if (useMock) {
    results = input.channels.map((channel) => ({ channel, content: mockContent(channel, input.theme, input.profile.reserveUrl) }))
  } else {
    const anthropic = new Anthropic({ apiKey })
    const system = buildSystemPrompt(clinicProfileToPrompt(input.profile))
    if (options.parallel) {
      results = await Promise.all(input.channels.map((channel) => generateOne(anthropic, system, input, channel)))
    } else {
      for (const channel of input.channels) {
        results.push(await generateOne(anthropic, system, input, channel))
      }
    }
  }

  const variants: ContentVariant[] = []
  const errors: Array<{ channel: Channel; error: string }> = []
  for (const result of results) {
    if ('error' in result) {
      errors.push(result)
      continue
    }
    variants.push({
      id: crypto.randomUUID(),
      channel: result.channel,
      content: result.content,
      compliance: checkGenerated(result.content, input.profile.bannedPhrases),
      status: 'draft',
    })
  }

  return { mode: useMock ? 'mock' : 'live', variants, errors }
}
