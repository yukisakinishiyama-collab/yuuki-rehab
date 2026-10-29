/**
 * 投稿の下書きに付けるAI画像（サーバー専用）
 *
 * 流れ: 下書きを書いたAI（Claude）が、本文に合わせた「画像の場面の説明（imagePrompt・英語）」を書く
 *   → ここで医療広告・個人情報の決まりを足して ChatGPT（OpenAIの画像生成）に渡す
 *   → 文字の入っていない写真を Vercel Blob に置き、下書きの content.image に入れる
 *   → 投稿するとき（publishers.ts）・院内アプリで見るとき（/api/marketing/image?photo=）に、
 *     表現チェック済みの見出しを院のデザインで重ねる（AIに文字を書かせない＝誤字や未チェックの文言が出ない）
 *
 * 1つの投稿（テーマ）につき写真は1枚。Instagram・Google・note で同じ写真を、媒体の形に切り抜いて使う。
 * AIの写真が作れない・使えないときはテンプレ画像（これまでどおり）で投稿する。
 *
 * 患者さんの情報はAIに送らない（送るのは、公開する予定の投稿の内容から作った場面の説明だけ）。
 */
import { AI_IMAGE_CHANNELS } from './post-image'
export { sceneFromVariants } from './post-image'
import { generateOpenAiImage, openAiImageConfigured } from './openai-image-server'
import type { ContentVariant, GeneratedContent, PostImage } from './types'

/** モックモードでは外部に送らない */
export function aiPostImageConfigured(): boolean {
  return openAiImageConfigured() && process.env.MARKETING_MODE !== 'mock'
}

/**
 * どの投稿の写真にも足す決まり（英語の方が指示が通りやすい）。
 * 柔道整復の広告ルール・医療広告ガイドラインに合わせ、効果や結果を思わせる絵・医療行為・顔・文字を入れない
 */
export const POST_IMAGE_RULES = [
  'Photorealistic photograph for the social media post of a small local judo-therapy and sports-injury clinic in Japan.',
  'Square composition with the main subject in the center and upper part; keep the bottom third simple and uncluttered because a caption will be placed there.',
  'Soft natural light, clean, warm and calm mood, gentle colors, Japanese everyday setting.',
  'Absolutely no text, letters, numbers, captions, signs, logos or watermarks anywhere in the image.',
  "If any person appears, their face must not be visible (shot from behind, cropped at the neck, or only hands, arms, legs or feet). No children's faces.",
  'Do not show: medical procedures, injections, needles, surgery, blood, open wounds, X-ray or MRI images, hospitals, doctors in white coats, medicine or pills,',
  'before-and-after comparisons, exaggerated pain, or anything that suggests a guaranteed result or a specific real person, brand, team or place name.',
].join(' ')

/** 指示が無いとき（古い下書き・AIが書かなかったとき）の場面の説明 */
function fallbackScene(content: GeneratedContent | undefined, theme: string): string {
  const words = [theme, content?.title, content?.hook].filter(Boolean).join(' / ').slice(0, 200)
  return `A calm, everyday scene in Japan that visually represents this health-information topic for local residents: "${words}". Show the situation or a gentle self-care moment related to the topic, not a treatment.`
}

/** OpenAIに渡す指示（場面の説明＋共通の決まり） */
export function buildPostImagePrompt(scene: string | undefined, content: GeneratedContent | undefined, theme: string): string {
  const base = (scene ?? '').trim().slice(0, 800) || fallbackScene(content, theme)
  return `${base}\n\n${POST_IMAGE_RULES}`
}

/** 写真を1枚作って Blob に置く（30秒〜1分ほど） */
export async function createPostPhoto(
  input: { scene?: string; content?: GeneratedContent; theme: string },
  signal?: AbortSignal,
): Promise<PostImage> {
  if (!aiPostImageConfigured()) throw new Error('OpenAIのAPIキー（OPENAI_API_KEY）が未設定のため、AI画像は作れません')
  const prompt = buildPostImagePrompt(input.scene, input.content, input.theme)
  const { bytes, model } = await generateOpenAiImage(prompt, { size: '1024x1024', quality: 'medium', signal })
  // 時間切れで打ち切ったあとは置かない（使われない写真を残さない）
  signal?.throwIfAborted()
  const { put } = await import('@vercel/blob')
  const name = `marketing/ai-photos/${new Date().toISOString().slice(0, 10)}-${crypto.randomUUID().slice(0, 8)}.png`
  const blob = await put(name, bytes, { access: 'public', contentType: 'image/png' })
  return { kind: 'ai', photoUrl: blob.url, prompt, model, createdAt: new Date().toISOString() }
}

/** 画像を使う媒体の下書きに、写真を付ける（null なら外してテンプレ画像に戻す） */
export function withPostImage(variant: ContentVariant, image: PostImage | null): ContentVariant {
  if (!AI_IMAGE_CHANNELS.includes(variant.channel)) return variant
  const content = { ...variant.content }
  if (image) content.image = image
  else delete content.image
  return { ...variant, content }
}

/**
 * 上限時間つきで写真を作る（自動下書きで、ほかの処理を待たせすぎないように）。
 * 時間切れのときは OpenAI への要求そのものを止める（裏で作り続けると、同時に走る枚数が増えて混雑・費用のもとになる）
 */
export async function createPostPhotoWithin(
  input: { scene?: string; content?: GeneratedContent; theme: string },
  ms: number,
): Promise<PostImage> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), ms)
  try {
    return await createPostPhoto(input, controller.signal)
  } catch (error) {
    if (controller.signal.aborted) throw new Error(`AI画像の作成が${Math.round(ms / 1000)}秒以内に終わりませんでした`)
    throw error
  } finally {
    clearTimeout(timer)
  }
}
