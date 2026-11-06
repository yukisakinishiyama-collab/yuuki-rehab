/**
 * 患部の写真（ブラウザ側）: スマホで撮った写真を縮小して、院内アプリの API に送る
 *
 * - 長辺 1600px・JPEG 品質 0.82 に縮めてから送る（1枚 200〜500KB 程度。通信量とクラウドの容量を抑える）
 * - 向きの情報（EXIF）は createImageBitmap の imageOrientation で正しい向きに直す
 * - 画像本体は端末には残さない（表示のたびに API から取る。ブラウザのキャッシュだけ）
 */
export const PHOTO_MAX_EDGE = 1600
export const PHOTO_JPEG_QUALITY = 0.82

export interface ResizedPhoto {
  blob: Blob
  width: number
  height: number
}

export async function resizePhoto(file: File | Blob, maxEdge = PHOTO_MAX_EDGE): Promise<ResizedPhoto> {
  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch {
    // 古いブラウザ向け（向きの補正なし）
    bitmap = await createImageBitmap(file)
  }
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height))
  const width = Math.max(1, Math.round(bitmap.width * scale))
  const height = Math.max(1, Math.round(bitmap.height * scale))
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('画像を処理できませんでした')
  ctx.drawImage(bitmap, 0, 0, width, height)
  bitmap.close?.()
  const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', PHOTO_JPEG_QUALITY))
  if (!blob) throw new Error('JPEGに変換できませんでした')
  return { blob, width, height }
}

export async function uploadPhoto(input: { patientId: string; photoId: string; blob: Blob }): Promise<{ storagePath: string; bytes: number }> {
  const form = new FormData()
  form.append('file', input.blob, `${input.photoId}.jpg`)
  form.append('patientId', input.patientId)
  form.append('photoId', input.photoId)
  const res = await fetch('/api/karte/photos', { method: 'POST', body: form })
  const data = (await res.json().catch(() => ({}))) as { storagePath?: string; bytes?: number; error?: string }
  if (!res.ok || !data.storagePath) throw new Error(data.error ?? `HTTP ${res.status}`)
  return { storagePath: data.storagePath, bytes: data.bytes ?? input.blob.size }
}

export function photoUrl(storagePath: string): string {
  return `/api/karte/photos?path=${encodeURIComponent(storagePath)}`
}

export async function deletePhotoFile(storagePath: string): Promise<void> {
  const res = await fetch(photoUrl(storagePath), { method: 'DELETE' })
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(data.error ?? `HTTP ${res.status}`)
  }
}
