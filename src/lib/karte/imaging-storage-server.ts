/**
 * 画像レポート（PDF）の保存先（サーバー専用。Supabase Storage の非公開バケット）
 *
 * - バケット karte-imaging は非公開。院内アプリの API（Basic 認証の内側）だけが読む
 * - 場所は patientId/reportId.pdf。PDF は院のパソコンの読影プログラムが作り、カルテの画面が送る
 * - 一度保存したら書きかえない（直すときは読影し直して、新しいレポートとして提出する）
 */
import { createSupabaseServer } from '@/lib/supabase-server'

export const IMAGING_BUCKET = 'karte-imaging'
/** Vercel の関数が受け取れる大きさ（約4.5MB）に収める。読影プログラムは 3.8MB 以下で作る */
export const MAX_REPORT_BYTES = 4 * 1024 * 1024
const PATH_RE = /^[A-Za-z0-9_-]{1,64}\/[A-Za-z0-9_-]{1,64}\.pdf$/

export function isValidReportPath(path: string): boolean {
  return PATH_RE.test(path)
}

let bucketReady = false

async function storage() {
  const supabase = createSupabaseServer()
  if (!supabase) throw new Error('クラウド（Supabase）の設定がありません')
  if (!bucketReady) {
    const { data: buckets, error } = await supabase.storage.listBuckets()
    if (error) throw new Error(`保存先を確認できませんでした（${error.message}）`)
    if (!buckets?.some(b => b.name === IMAGING_BUCKET)) {
      const { error: createError } = await supabase.storage.createBucket(IMAGING_BUCKET, {
        public: false,
        fileSizeLimit: MAX_REPORT_BYTES,
        allowedMimeTypes: ['application/pdf'],
      })
      // 同時に作られた場合の「すでにある」は成功扱い
      if (createError && !/already exists/i.test(createError.message)) {
        throw new Error(`保存先を作れませんでした（${createError.message}）`)
      }
    }
    bucketReady = true
  }
  return supabase.storage.from(IMAGING_BUCKET)
}

export async function putReport(path: string, bytes: Uint8Array): Promise<void> {
  if (!isValidReportPath(path)) throw new Error('保存先の形が正しくありません')
  const { error } = await (await storage()).upload(path, bytes, { contentType: 'application/pdf', upsert: false })
  if (error) throw new Error(`レポートを保存できませんでした（${error.message}）`)
}

export async function getReport(path: string): Promise<Uint8Array | null> {
  if (!isValidReportPath(path)) return null
  const { data, error } = await (await storage()).download(path)
  if (error || !data) return null
  return new Uint8Array(await data.arrayBuffer())
}

export async function removeReport(path: string): Promise<void> {
  if (!isValidReportPath(path)) throw new Error('保存先の形が正しくありません')
  const { error } = await (await storage()).remove([path])
  if (error) throw new Error(`レポートを削除できませんでした（${error.message}）`)
}
