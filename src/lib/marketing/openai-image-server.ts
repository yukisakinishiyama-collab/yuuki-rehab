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

/** モデルが使えない（未提供・未許可・提供終了）ときは次のモデルを試す */
function isModelProblem(status: number, message: string, code?: string): boolean {
  if (status === 429) return false
  return status === 404 || code === 'model_not_found' || /does not exist|not have access|must be verified|verification|deprecated|not supported/i.test(message)
}

/** Retry-After（秒数か日付）を秒にする */
function retryAfterSeconds(value: string | null): number {
  if (!value) return 8
  const seconds = Number(value)
  if (Number.isFinite(seconds)) return Math.max(seconds, 1)
  const at = Date.parse(value)
  return Number.isFinite(at) ? Math.max((at - Date.now()) / 1000, 1) : 8
}

/** 混み合いのとき、これより長く待てと言われたらやり直さずに失敗にする（時間切れで落ちるより、理由を返す） */
const MAX_RETRY_WAIT_SECONDS = 20

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** 画像を1枚作る（PNG のバイト列）。使えたモデル名も返す */
export async function generateOpenAiImage(
  prompt: string,
  options: { size: OpenAiImageSize; quality?: 'low' | 'medium' | 'high'; models?: string[]; signal?: AbortSignal },
): Promise<{ bytes: Buffer; model: string }> {
  if (!openAiImageConfigured()) throw new Error('OPENAI_API_KEY が未設定です（Vercel の環境変数に入れてください）')
  const models = options.models ?? imageModels()
  let lastError = ''
  let lastStatus = 0
  let lastCode: string | undefined
  for (const model of models) {
    for (let attempt = 0; attempt < 2; attempt++) {
      // signal … 時間切れで打ち切ったら、OpenAIへの要求も止める（裏で作り続けて同時に何枚も走らないように）
      const res = await fetch(IMAGES_API, {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, prompt, size: options.size, quality: options.quality ?? 'medium', n: 1 }),
        signal: options.signal,
      })
      const data = (await res.json().catch(() => ({}))) as {
        data?: Array<{ b64_json?: string; url?: string }>
        error?: { message?: string; code?: string }
      }
      const item = data.data?.[0]
      if (res.ok && item?.b64_json) return { bytes: Buffer.from(item.b64_json, 'base64'), model }
      if (res.ok && item?.url) {
        const img = await fetch(item.url, { signal: options.signal })
        if (img.ok) return { bytes: Buffer.from(await img.arrayBuffer()), model }
      }
      lastError = data.error?.message ?? `HTTP ${res.status}`
      lastStatus = res.status
      lastCode = data.error?.code
      if (res.status === 429 && attempt === 0) {
        // 言われた時間は守る（早すぎるやり直しはまた断られる）。長すぎるなら待たずに失敗にする
        const wait = retryAfterSeconds(res.headers.get('retry-after'))
        if (wait > MAX_RETRY_WAIT_SECONDS) {
          lastError = `混み合っています。${Math.ceil(wait)}秒ほどおいてからもう一度お試しください（${lastError}）`
          break
        }
        await sleep(wait * 1000 + Math.random() * 1000)
        options.signal?.throwIfAborted()
        continue
      }
      break
    }
    if (!isModelProblem(lastStatus, lastError, lastCode)) break
  }
  throw new Error(`OpenAIで画像を作れませんでした（${lastError}）`)
}
