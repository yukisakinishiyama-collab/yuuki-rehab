/**
 * IndexedDB を使った動画Blob永続保存
 * - ページリロード後も動画が消えない
 * - ブラウザを閉じても保持される（ユーザーがブラウザデータを削除するまで）
 */

const DB_NAME = 'yuuki-rehab-videos'
const STORE_NAME = 'video-blobs'
const DB_VERSION = 1

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') { reject(new Error('SSR')); return }
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE_NAME)
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

/** 動画Blobを保存 */
export async function saveVideoBlob(videoId: string, blob: Blob): Promise<void> {
  try {
    const db = await openDB()
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      tx.objectStore(STORE_NAME).put(blob, videoId)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  } catch (e) {
    console.warn('IndexedDB save failed:', e)
  }
}

/** 動画BlobをIndexedDBから取得してblobURLを返す */
export async function getBlobUrlFromDB(videoId: string): Promise<string | null> {
  try {
    const db = await openDB()
    const blob = await new Promise<Blob | null>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly')
      const req = tx.objectStore(STORE_NAME).get(videoId)
      req.onsuccess = () => resolve(req.result ?? null)
      req.onerror = () => reject(req.error)
    })
    if (!blob) return null
    return URL.createObjectURL(blob)
  } catch (e) {
    console.warn('IndexedDB get failed:', e)
    return null
  }
}

/** 動画BlobをIndexedDBから削除 */
export async function deleteVideoBlob(videoId: string): Promise<void> {
  try {
    const db = await openDB()
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      tx.objectStore(STORE_NAME).delete(videoId)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  } catch (e) {
    console.warn('IndexedDB delete failed:', e)
  }
}
