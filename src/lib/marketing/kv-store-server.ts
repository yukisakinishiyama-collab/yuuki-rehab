/**
 * サーバー側の汎用KVストア
 *
 * Supabase設定時は marketing_line_contacts テーブルを key-value 領域として共用する
 * （user_id=キー, data=値。専用テーブルのDDLはダッシュボード操作が必要なため、
 *  既存テーブルへのプレフィックス付きキー保存で運用。将来テーブル分離可能）。
 * 未設定時は .data/marketing-kv.json に保存（ローカル開発）。
 */
import fs from 'node:fs'
import path from 'node:path'
import { createSupabaseServer } from '@/lib/supabase-server'

const TABLE = 'marketing_line_contacts'

/** LINE顧客一覧などがKV行を誤って拾わないための予約プレフィックス */
export const KV_PREFIXES = ['job:', 'analytics:'] as const

function filePath(): string {
  const local = path.join(process.cwd(), '.data')
  try {
    fs.mkdirSync(local, { recursive: true })
    return path.join(local, 'marketing-kv.json')
  } catch {
    return path.join('/tmp', 'marketing-kv.json')
  }
}

function fileLoad(): Record<string, unknown> {
  try {
    return JSON.parse(fs.readFileSync(filePath(), 'utf-8')) as Record<string, unknown>
  } catch {
    return {}
  }
}

function fileSave(db: Record<string, unknown>) {
  fs.writeFileSync(filePath(), JSON.stringify(db))
}

export async function kvGet<T>(key: string): Promise<T | null> {
  const supabase = createSupabaseServer()
  if (supabase) {
    const { data } = await supabase.from(TABLE).select('data').eq('user_id', key).maybeSingle()
    return (data?.data as T) ?? null
  }
  return (fileLoad()[key] as T) ?? null
}

export async function kvSet(key: string, value: unknown): Promise<void> {
  const supabase = createSupabaseServer()
  if (supabase) {
    await supabase.from(TABLE).upsert({ user_id: key, data: value })
    return
  }
  const db = fileLoad()
  db[key] = value
  fileSave(db)
}

export async function kvDelete(key: string): Promise<void> {
  const supabase = createSupabaseServer()
  if (supabase) {
    await supabase.from(TABLE).delete().eq('user_id', key)
    return
  }
  const db = fileLoad()
  delete db[key]
  fileSave(db)
}

/** プレフィックスに一致する値の一覧 */
export async function kvList<T>(prefix: string): Promise<Array<{ key: string; value: T }>> {
  const supabase = createSupabaseServer()
  if (supabase) {
    const { data } = await supabase.from(TABLE).select('user_id, data').like('user_id', `${prefix}%`).limit(2000)
    return (data ?? []).map((row) => ({ key: row.user_id as string, value: row.data as T }))
  }
  return Object.entries(fileLoad())
    .filter(([key]) => key.startsWith(prefix))
    .map(([key, value]) => ({ key, value: value as T }))
}
