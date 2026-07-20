/**
 * 動画ストックのサーバー側永続化
 *
 * - Supabase設定時: marketing_videos テーブル（本番用）
 * - 未設定時: .data/marketing-videos.json（ローカル開発用フォールバック）
 * line-store-server と同じ非同期インターフェースの方針にそろえる。
 */
import fs from 'node:fs'
import path from 'node:path'
import { createSupabaseServer } from '@/lib/supabase-server'
import type { StockVideo } from './video-types'

const TABLE = 'marketing_videos'

// ── ファイルフォールバック ──────────────────────────────
function dbPath(): string {
  const local = path.join(process.cwd(), '.data')
  try {
    fs.mkdirSync(local, { recursive: true })
    return path.join(local, 'marketing-videos.json')
  } catch {
    return path.join('/tmp', 'marketing-videos.json')
  }
}

function fileLoad(): Record<string, StockVideo> {
  try {
    return JSON.parse(fs.readFileSync(dbPath(), 'utf-8')) as Record<string, StockVideo>
  } catch {
    return {}
  }
}

function fileSave(db: Record<string, StockVideo>) {
  fs.writeFileSync(dbPath(), JSON.stringify(db, null, 2))
}

// ── 公開インターフェース ────────────────────────────────
export async function listVideos(): Promise<StockVideo[]> {
  const supabase = createSupabaseServer()
  if (supabase) {
    const { data, error } = await supabase.from(TABLE).select('data').limit(2000)
    if (error) throw new Error(`動画一覧の取得に失敗: ${error.message}`)
    return (data ?? [])
      .map((row) => row.data as StockVideo)
      .sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''))
  }
  return Object.values(fileLoad()).sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''))
}

export async function getVideo(id: string): Promise<StockVideo | null> {
  const supabase = createSupabaseServer()
  if (supabase) {
    const { data, error } = await supabase.from(TABLE).select('data').eq('id', id).maybeSingle()
    if (error) throw new Error(`動画の取得に失敗: ${error.message}`)
    return (data?.data as StockVideo) ?? null
  }
  return fileLoad()[id] ?? null
}

export async function saveVideo(video: StockVideo): Promise<void> {
  video.updatedAt = new Date().toISOString()
  const supabase = createSupabaseServer()
  if (supabase) {
    const { error } = await supabase.from(TABLE).upsert({ id: video.id, data: video })
    if (error) throw new Error(`動画の保存に失敗: ${error.message}`)
    return
  }
  const db = fileLoad()
  db[video.id] = video
  fileSave(db)
}

export async function deleteVideo(id: string): Promise<void> {
  const supabase = createSupabaseServer()
  if (supabase) {
    const { error } = await supabase.from(TABLE).delete().eq('id', id)
    if (error) throw new Error(`動画の削除に失敗: ${error.message}`)
    return
  }
  const db = fileLoad()
  delete db[id]
  fileSave(db)
}
