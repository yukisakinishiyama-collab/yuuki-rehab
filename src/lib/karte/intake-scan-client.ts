/**
 * 問診票の写真の読み取り（ブラウザ側）：写真を縮める・AI に読み取ってもらう・カルテの資料に残す
 *
 * - AI に送る写真は長辺 1568px（それより大きくても AI の側で縮められるので、送る量だけが増える）
 * - カルテに残す写真は長辺 2200px（あとで拡大して読めるように）。資料タブの「問診票」に入る（非公開の保存場所 karte-docs）
 * - 写真は端末には残さない（この画面を閉じると消える。残るのはカルテの資料だけ）
 */
import { nanoid } from 'nanoid'
import { saveKarteDoc } from '@/lib/patient-store'
import { uploadDoc } from './doc-client'
import { resizePhoto } from './photo-client'
import { MAX_SCAN_TOTAL_BYTES, SCAN_KEEP_EDGE, SCAN_MAX_EDGE, type IntakeScanResult } from './intake-scan'

export interface SheetPhoto {
  id: string
  /** 画面に出す用（AI に送るものと同じ写真） */
  preview: string
  /** AI に送る写真（JPEG） */
  ai: Blob
  /** カルテに残す写真（JPEG） */
  keep: Blob
}

/** 撮った・選んだ写真を、送る大きさ・残す大きさに縮める */
export async function prepareSheetPhoto(file: File | Blob): Promise<SheetPhoto> {
  try {
    const ai = await resizePhoto(file, SCAN_MAX_EDGE)
    const keep = await resizePhoto(file, SCAN_KEEP_EDGE)
    return { id: nanoid(8), preview: URL.createObjectURL(ai.blob), ai: ai.blob, keep: keep.blob }
  } catch {
    throw new Error('この写真の形式は読み込めませんでした。カメラの設定で「互換性優先（JPEG）」にするか、「カメラで撮る」で撮り直してください')
  }
}

export function releaseSheetPhoto(photo: SheetPhoto): void {
  URL.revokeObjectURL(photo.preview)
}

/** 問診票の写真を AI に読み取ってもらう（結果は下書き） */
export async function requestSheetScan(photos: SheetPhoto[]): Promise<IntakeScanResult> {
  const total = photos.reduce((n, p) => n + p.ai.size, 0)
  if (total > MAX_SCAN_TOTAL_BYTES) throw new Error('写真が大きすぎます。枚数を減らして、もう一度お試しください')
  const form = new FormData()
  photos.forEach((p, i) => form.append('images', p.ai, `sheet-${i + 1}.jpg`))
  let res: Response
  try {
    res = await fetch('/api/karte/intake-scan', { method: 'POST', body: form })
  } catch {
    throw new Error('インターネットにつながらず、読み取れませんでした。Wi-Fi を確かめて、もう一度お試しください')
  }
  const data = (await res.json().catch(() => ({}))) as { result?: IntakeScanResult; error?: string }
  if (res.status === 401) throw new Error('ログインが切れています。アプリを閉じて開き直し、パスワードで入り直してください')
  if (!res.ok || !data.result) throw new Error(data.error ?? `読み取れませんでした（${res.status}）`)
  return data.result
}

/** 問診票の写真を、カルテの資料（種類「問診票」）に残す。残せた枚数と、残せなかった理由を返す */
export async function saveSheetPhotos(patientId: string, photos: SheetPhoto[], today: string): Promise<{ saved: number; error: string }> {
  let saved = 0
  let error = ''
  for (let i = 0; i < photos.length; i += 1) {
    const id = nanoid()
    const fileName = `monshin-${today}-${i + 1}.jpg`
    try {
      const up = await uploadDoc({ patientId, docId: id, file: new File([photos[i].keep], fileName, { type: 'image/jpeg' }) })
      const now = new Date().toISOString()
      saveKarteDoc({
        id,
        patientId,
        kind: 'file',
        category: 'intake',
        title: `問診票（${today}）${photos.length > 1 ? ` ${i + 1}／${photos.length}枚目` : ''}`,
        memo: '',
        fileName,
        ext: up.ext,
        bytes: up.bytes,
        storagePath: up.storagePath,
        addedDate: today,
        createdAt: now,
        updatedAt: now,
      })
      saved += 1
    } catch (e) {
      error = e instanceof Error ? e.message : '保存できませんでした'
    }
  }
  return { saved, error }
}
