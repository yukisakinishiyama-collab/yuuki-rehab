/**
 * 患部の写真の保存先（サーバー専用。Supabase Storage の非公開バケット）
 *
 * - バケット karte-photos は非公開。URLを知っていても外からは見られず、院内アプリの API（Basic 認証の内側）だけが読む
 * - 場所は patientId/photoId.jpg。画像はブラウザ側で縮小（長辺1600px・JPEG）してから送る
 * - Supabase の設定（SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY）が無い環境では使えない
 */
import { createSupabaseServer } from '@/lib/supabase-server'
import { kvGet, kvSet } from '@/lib/marketing/kv-store-server'
import type { KartePhoto } from '@/types/patient'

export const PHOTO_BUCKET = 'karte-photos'
export const MAX_PHOTO_BYTES = 3 * 1024 * 1024
const PATH_RE = /^[A-Za-z0-9_-]{1,64}\/[A-Za-z0-9_-]{1,64}\.jpg$/

export function isValidPhotoPath(path: string): boolean {
  return PATH_RE.test(path)
}

let bucketReady = false

async function storage() {
  const supabase = createSupabaseServer()
  if (!supabase) throw new Error('クラウド（Supabase）の設定がありません')
  if (!bucketReady) {
    const { data: buckets, error } = await supabase.storage.listBuckets()
    if (error) throw new Error(`保存先を確認できませんでした（${error.message}）`)
    if (!buckets?.some(b => b.name === PHOTO_BUCKET)) {
      const { error: createError } = await supabase.storage.createBucket(PHOTO_BUCKET, {
        public: false,
        fileSizeLimit: MAX_PHOTO_BYTES,
        allowedMimeTypes: ['image/jpeg'],
      })
      // 同時に作られた場合の「すでにある」は成功扱い
      if (createError && !/already exists/i.test(createError.message)) {
        throw new Error(`保存先を作れませんでした（${createError.message}）`)
      }
    }
    bucketReady = true
  }
  return supabase.storage.from(PHOTO_BUCKET)
}

export async function putPhoto(path: string, bytes: Uint8Array): Promise<void> {
  if (!isValidPhotoPath(path)) throw new Error('保存先の形が正しくありません')
  const { error } = await (await storage()).upload(path, bytes, { contentType: 'image/jpeg', upsert: false })
  if (error) throw new Error(`写真を保存できませんでした（${error.message}）`)
}

export async function getPhoto(path: string): Promise<Uint8Array | null> {
  if (!isValidPhotoPath(path)) return null
  const { data, error } = await (await storage()).download(path)
  if (error || !data) return null
  return new Uint8Array(await data.arrayBuffer())
}

export async function removePhoto(path: string): Promise<void> {
  if (!isValidPhotoPath(path)) throw new Error('保存先の形が正しくありません')
  const { error } = await (await storage()).remove([path])
  if (error) throw new Error(`写真を削除できませんでした（${error.message}）`)
}

// ── 写真の一覧（日付・説明などのメタデータ）もクラウドに持つ ──
// 端末の localStorage だけだと、スマホで撮った写真がパソコンに出ない。KV の kphoto:<patientId> に配列で保存する。

const ID_RE = /^[A-Za-z0-9_-]{1,64}$/

export async function listPhotoMeta(patientId: string): Promise<KartePhoto[]> {
  if (!ID_RE.test(patientId)) return []
  return (await kvGet<KartePhoto[]>(`kphoto:${patientId}`)) ?? []
}

export async function upsertPhotoMeta(photo: KartePhoto): Promise<void> {
  if (!ID_RE.test(photo.patientId)) throw new Error('患者さんの情報が正しくありません')
  const list = await listPhotoMeta(photo.patientId)
  const idx = list.findIndex(p => p.id === photo.id)
  if (idx >= 0) list[idx] = photo
  else list.push(photo)
  await kvSet(`kphoto:${photo.patientId}`, list)
}

export async function removePhotoMeta(patientId: string, photoId: string): Promise<void> {
  if (!ID_RE.test(patientId)) return
  const list = await listPhotoMeta(patientId)
  await kvSet(`kphoto:${patientId}`, list.filter(p => p.id !== photoId))
}
