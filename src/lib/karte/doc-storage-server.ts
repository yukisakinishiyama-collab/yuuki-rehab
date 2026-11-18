/**
 * カルテの資料の保存先（サーバー専用。Supabase Storage の非公開バケット）
 *
 * - バケット karte-docs は非公開。URL を知っていても外からは見られない
 * - 場所は <カルテのID>/<資料のID>.<拡張子>
 * - 保存：大きいファイル（論文・プロトコルの PDF は数MB〜）は院内アプリの API を通せない（1回 4.5MB まで）ので、
 *   API（Basic 認証の内側）が「このファイルだけを送れる署名つきの宛先」を作り、端末からクラウドへ直接送る。
 *   小さいファイルは、写真と同じように API を通しても送れる（直接送れなかったときの予備）
 * - 開く：API が「1時間だけ開ける署名つきの URL」を作って返す（大きいファイルを API で中継しないため）
 * - Supabase の設定（SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY）が無い環境では使えない
 */
import { createSupabaseServer } from '@/lib/supabase-server'
import { DOC_MIME_TYPES, MAX_DOC_BYTES, isValidDocPath } from './doc-rules'

export const DOC_BUCKET = 'karte-docs'
/** 開く用の URL が使える時間（秒） */
export const DOC_URL_TTL_SECONDS = 3600

let bucketReady = false

async function storage() {
  const supabase = createSupabaseServer()
  if (!supabase) throw new Error('クラウド（Supabase）の設定がありません')
  if (!bucketReady) {
    const { data: buckets, error } = await supabase.storage.listBuckets()
    if (error) throw new Error(`保存先を確認できませんでした（${error.message}）`)
    if (!buckets?.some((b) => b.name === DOC_BUCKET)) {
      const { error: createError } = await supabase.storage.createBucket(DOC_BUCKET, {
        public: false,
        fileSizeLimit: MAX_DOC_BYTES,
        allowedMimeTypes: DOC_MIME_TYPES,
      })
      // 同時に作られた場合の「すでにある」は成功扱い
      if (createError && !/already exists/i.test(createError.message)) {
        throw new Error(`保存先を作れませんでした（${createError.message}）`)
      }
    }
    bucketReady = true
  }
  return supabase.storage.from(DOC_BUCKET)
}

/** 端末からクラウドへ直接送るための、署名つきの宛先（この場所に1回だけ。2時間で切れる） */
export async function createDocUpload(path: string): Promise<{ uploadUrl: string }> {
  if (!isValidDocPath(path)) throw new Error('保存先の形が正しくありません')
  const { data, error } = await (await storage()).createSignedUploadUrl(path)
  if (error || !data?.signedUrl) throw new Error(`保存の準備ができませんでした（${error?.message ?? '宛先が作れません'}）`)
  return { uploadUrl: data.signedUrl }
}

/** API を通して保存する（小さいファイル用） */
export async function putDoc(path: string, bytes: Uint8Array, contentType: string): Promise<void> {
  if (!isValidDocPath(path)) throw new Error('保存先の形が正しくありません')
  const { error } = await (await storage()).upload(path, bytes, { contentType, upsert: false })
  if (error) throw new Error(`資料を保存できませんでした（${error.message}）`)
}

/**
 * 開く用の URL（1時間）。downloadName を渡すと、その名前で端末に保存する形になる（Word など）。
 * 保存名は、ライブラリに渡さず自分で URL に足す（supabase-js 2.108 は日本語の名前を二重に変換してしまい、
 * 保存したファイル名が「%E3%83…」になるため。download は署名に含まれない、あとから足せる指定）
 */
export async function signedDocUrl(path: string, downloadName?: string): Promise<string | null> {
  if (!isValidDocPath(path)) return null
  const { data, error } = await (await storage()).createSignedUrl(path, DOC_URL_TTL_SECONDS)
  if (error || !data?.signedUrl) return null
  if (!downloadName) return data.signedUrl
  return `${data.signedUrl}${data.signedUrl.includes('?') ? '&' : '?'}download=${encodeURIComponent(downloadName)}`
}

export async function removeDoc(path: string): Promise<void> {
  if (!isValidDocPath(path)) throw new Error('保存先の形が正しくありません')
  const { error } = await (await storage()).remove([path])
  if (error) throw new Error(`資料を削除できませんでした（${error.message}）`)
}
