/**
 * アウトカムの「測り方の図」を ChatGPT（OpenAI の画像生成）で作って置く（サーバー専用）
 *
 * - 画像は Vercel Blob（公開の URL。人物の特定できない一般の図で、患者さんの情報は入らない）
 * - 記録は KV の omimg:all（指標ごとに、使っている図と下書き）
 * - 作るのは院長が押したときだけ（/api/karte/method-images・院長だけ）。1枚ごとに OpenAI の料金がかかる
 */
import { kvGet, kvSet } from '@/lib/marketing/kv-store-server'
import { generateOpenAiImage } from '@/lib/marketing/openai-image-server'
import { methodImagePrompt } from '@/data/outcome-method-images'
import type { OutcomeMetricKey } from '@/types/contracts'
import { applyMethodImageAction, type MethodImage, type MethodImageAction, type MethodImageStore } from './method-images'

const KEY = 'omimg:all'
/** 1枚を作るのを待つ長さ（API の上限 180秒の内側） */
const GENERATE_TIMEOUT_MS = 150_000

export async function getMethodImages(): Promise<MethodImageStore> {
  const v = await kvGet<MethodImageStore>(KEY).catch(() => null)
  return v && typeof v === 'object' ? v : {}
}

/** PNG を小さめの WebP にする（読み込みを軽く。うまくいかなければ PNG のまま） */
async function toWebp(png: Buffer): Promise<{ bytes: Buffer; type: string; ext: string }> {
  try {
    const sharp = (await import('sharp')).default
    const bytes = await sharp(png).resize({ width: 1200, withoutEnlargement: true }).webp({ quality: 82 }).toBuffer()
    return { bytes, type: 'image/webp', ext: 'webp' }
  } catch {
    return { bytes: png, type: 'image/png', ext: 'png' }
  }
}

async function createImage(key: OutcomeMetricKey, now: Date): Promise<Omit<MethodImage, 'approvedAt'>> {
  const prompt = methodImagePrompt(key)
  if (!prompt) throw new Error('この指標の図の説明がありません')
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), GENERATE_TIMEOUT_MS)
  try {
    const { bytes, model } = await generateOpenAiImage(prompt, { size: '1536x1024', quality: 'medium', signal: controller.signal })
    const img = await toWebp(bytes)
    const { put } = await import('@vercel/blob')
    const name = `karte/method-images/${key}-${now.toISOString().slice(0, 10)}-${crypto.randomUUID().slice(0, 8)}.${img.ext}`
    const blob = await put(name, img.bytes, { access: 'public', contentType: img.type })
    return { url: blob.url, model, createdAt: now.toISOString() }
  } catch (e) {
    if (controller.signal.aborted) throw new Error(`図づくりが ${GENERATE_TIMEOUT_MS / 1000}秒で終わりませんでした。もう一度お試しください`)
    throw e
  } finally {
    clearTimeout(timer)
  }
}

async function deleteBlobs(urls: string[]): Promise<void> {
  if (!urls.length) return
  try {
    const { del } = await import('@vercel/blob')
    await del(urls)
  } catch {
    // 消せなくても記録からは外す（公開の一般の図で、患者さんの情報は入っていない）
  }
}

export async function runMethodImageAction(key: OutcomeMetricKey, action: MethodImageAction, now = new Date()): Promise<MethodImageStore> {
  const generated = action === 'generate' ? await createImage(key, now) : undefined
  // 作っているあいだに記録が変わることがあるので、作り終えてから読み直して重ねる
  const store = await getMethodImages()
  const { next, toDelete, error } = applyMethodImageAction(store, key, action, now.toISOString(), generated)
  if (error) {
    if (generated) await deleteBlobs([generated.url])
    throw new Error(error)
  }
  await kvSet(KEY, next)
  await deleteBlobs(toDelete)
  return next
}
