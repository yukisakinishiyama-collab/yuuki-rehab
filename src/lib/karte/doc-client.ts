/**
 * カルテの資料（ブラウザ側）：ファイルをクラウドへ送る・開く・消す
 *
 * 送り方（大きい PDF でも入るように）
 *  1. 院内アプリの API に「このファイルを入れたい」と伝え、クラウドへ直接送るための署名つきの宛先をもらう
 *  2. その宛先へ、端末から直接送る（院内アプリの API は 1回 4.5MB までしか通せないため）
 *  3. 直接送れなかったとき、4MB 以下のファイルなら API を通して送り直す（写真と同じ通り道）
 * ファイル本体は端末には残さない（開くたびに、1時間だけ使える URL を API からもらう）。
 */
import { API_UPLOAD_MAX_BYTES, checkDocFile, downloadName } from './doc-rules'
import type { KarteDoc } from '@/types/karte-docs'

interface UploadInput {
  patientId: string
  docId: string
  file: File
}

export interface UploadedDoc {
  storagePath: string
  ext: string
  bytes: number
}

async function errorOf(res: Response): Promise<string> {
  const data = (await res.json().catch(() => ({}))) as { error?: string; message?: string }
  return data.error ?? data.message ?? `HTTP ${res.status}`
}

/** クラウドへ直接送る（Supabase の署名つきの宛先。supabase-js の uploadToSignedUrl と同じ形） */
async function putToSignedUrl(uploadUrl: string, file: File, contentType: string): Promise<void> {
  const body = new FormData()
  body.append('cacheControl', '3600')
  // 端末によってはファイルの種類が空で来る（iPhone の Word など）ので、拡張子から決めた種類を付け直す
  body.append('', new File([file], file.name, { type: contentType }))
  const res = await fetch(uploadUrl, { method: 'PUT', body, headers: { 'x-upsert': 'false' } })
  if (!res.ok) throw new Error(await errorOf(res))
}

async function uploadViaApi(input: UploadInput): Promise<string> {
  const form = new FormData()
  form.append('file', input.file, input.file.name)
  form.append('patientId', input.patientId)
  form.append('docId', input.docId)
  form.append('fileName', input.file.name)
  const res = await fetch('/api/karte/docs', { method: 'POST', body: form })
  const data = (await res.json().catch(() => ({}))) as { storagePath?: string; error?: string }
  if (!res.ok || !data.storagePath) throw new Error(data.error ?? `HTTP ${res.status}`)
  return data.storagePath
}

export async function uploadDoc(input: UploadInput): Promise<UploadedDoc> {
  const check = checkDocFile(input.file.name, input.file.size)
  if (!check.ok) throw new Error(check.error)
  const done = (storagePath: string): UploadedDoc => ({ storagePath, ext: check.type.ext, bytes: input.file.size })

  const res = await fetch('/api/karte/docs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ patientId: input.patientId, docId: input.docId, fileName: input.file.name, bytes: input.file.size }),
  })
  const ticket = (await res.json().catch(() => ({}))) as { storagePath?: string; uploadUrl?: string; contentType?: string; error?: string }
  if (!res.ok || !ticket.storagePath || !ticket.uploadUrl) throw new Error(ticket.error ?? `保存の準備ができませんでした（HTTP ${res.status}）`)

  try {
    await putToSignedUrl(ticket.uploadUrl, input.file, ticket.contentType ?? check.type.mime)
    return done(ticket.storagePath)
  } catch (direct) {
    // 返事だけ受け取れなかった（送れてはいた）ときは、そのまま成功にする
    if (await docExists(ticket.storagePath)) return done(ticket.storagePath)
    if (input.file.size > API_UPLOAD_MAX_BYTES) {
      const why = direct instanceof Error ? direct.message : String(direct)
      throw new Error(`クラウドへ送れませんでした（${why}）。通信を確かめて、もう一度お試しください。`)
    }
    try {
      return done(await uploadViaApi(input))
    } catch (viaApi) {
      if (viaApi instanceof Error && /already exists|Duplicate/i.test(viaApi.message)) return done(ticket.storagePath)
      throw viaApi
    }
  }
}

/** クラウドにそのファイルがあるか（開く用の URL を作れるかで確かめる） */
async function docExists(storagePath: string): Promise<boolean> {
  try {
    const res = await fetch(`/api/karte/docs?path=${encodeURIComponent(storagePath)}`, { cache: 'no-store' })
    return res.ok
  } catch {
    return false
  }
}

/** 開く用の URL（1時間だけ使える）。Word など画面で見られない形式は、題名のファイル名で端末に保存する形にする */
export async function fetchDocUrl(doc: KarteDoc, asDownload = false): Promise<string> {
  if (!doc.storagePath) throw new Error('この資料にはファイルがありません')
  const q = new URLSearchParams({ path: doc.storagePath })
  if (asDownload) q.set('name', downloadName(doc))
  const res = await fetch(`/api/karte/docs?${q.toString()}`, { cache: 'no-store' })
  const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string }
  if (!res.ok || !data.url) throw new Error(data.error ?? `HTTP ${res.status}`)
  return data.url
}

export async function deleteDocFile(storagePath: string): Promise<void> {
  const res = await fetch(`/api/karte/docs?path=${encodeURIComponent(storagePath)}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(await errorOf(res))
}
