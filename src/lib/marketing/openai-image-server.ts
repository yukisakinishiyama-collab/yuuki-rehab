/**
 * OpenAI（ChatGPT の画像生成・gpt-image）で画像を1枚作る共通部品（サーバー専用）
 *
 * - 投稿の下書きの画像（post-image-server.ts）と、AI動画のスライド（ai-video-server.ts）から使う
 * - モデルは OPENAI_IMAGE_MODEL があればそれだけ、無ければ gpt-image-2 → 1.5 → 1 の順に試す
 *   （まだ使えないモデル・未許可のモデルなら次を試す）
 * - 混み合い（429）のときは、言われた秒数（最大20秒）だけ待って1回だけやり直す
 *
 * 必要な設定: OPENAI_API_KEY（Vercel の環境変数）
 */

const IMAGES_API = 'https://api.openai.com/v1/images/generations'

export type OpenAiImageSize = '1024x1024' | '1536x1024' | '1024x1536'

export function openAiImageConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY)
}

export function imageModels(): string[] {
  const fromEnv = process.env.OPENAI_IMAGE_MODEL
  return fromEnv ? [fromEnv] : ['gpt-image-2', 'gpt-image-1.5', 'gpt-image-1']
}

function authHeaders(): Record<string, string> {
  return { Authorization: `Bearer ${process.env.OPENAI_API_KEY ?? ''}` }
}

/** モデルが使えない（未提供・未許可）ときは次のモデルを試す */
function isModelProblem(status: number, message: string): boolean {
  return status === 404 || /model|verif|not have access|does not exist/i.test(message)
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** 画像を1枚作る（PNG のバイト列）。使えたモデル名も返す */
export async function generateOpenAiImage(
  prompt: string,
  options: { size: OpenAiImageSize; quality?: 'low' | 'medium' | 'high'; models?: string[] },
): Promise<{ bytes: Buffer; model: string }> {
  if (!openAiImageConfigured()) throw new Error('OPENAI_API_KEY が未設定です（Vercel の環境変数に入れてください）')
  const models = options.models ?? imageModels()
  let lastError = ''
  let lastStatus = 0
  for (const model of models) {
    for (let attempt = 0; attempt < 2; attempt++) {
      const res = await fetch(IMAGES_API, {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, prompt, size: options.size, quality: options.quality ?? 'medium', n: 1 }),
      })
      const data = (await res.json().catch(() => ({}))) as {
        data?: Array<{ b64_json?: string; url?: string }>
        error?: { message?: string }
      }
      const item = data.data?.[0]
      if (res.ok && item?.b64_json) return { bytes: Buffer.from(item.b64_json, 'base64'), model }
      if (res.ok && item?.url) {
        const img = await fetch(item.url)
        if (img.ok) return { bytes: Buffer.from(await img.arrayBuffer()), model }
      }
      lastError = data.error?.message ?? `HTTP ${res.status}`
      lastStatus = res.status
      if (res.status === 429 && attempt === 0) {
        const wait = Math.min(Number(res.headers.get('retry-after')) || 8, 20)
        await sleep(wait * 1000)
        continue
      }
      break
    }
    if (!isModelProblem(lastStatus, lastError)) break
  }
  throw new Error(`OpenAIで画像を作れませんでした（${lastError}）`)
}
