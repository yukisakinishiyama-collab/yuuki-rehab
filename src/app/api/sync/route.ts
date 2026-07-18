import { NextRequest, NextResponse } from 'next/server'
import { kvGet, kvSet } from '@/lib/marketing/kv-store-server'

/**
 * リハビリアプリのクラウド同期（localStorage全体のバックアップ）
 *
 * 旧実装は専用テーブル clinic_sync を使っていたが、SUPABASE_URLの移行
 * （yuuki-marketingプロジェクト）でテーブルが無くなったため、
 * DDL不要のKVストア（sync:プレフィックス）に移行した。
 */
const SYNC_KEY = 'sync:clinic'

type SyncRecord = {
  payload: Record<string, string>
  updatedAt: string
}

// リクエスト認証チェック
function isAuthorized(req: NextRequest): boolean {
  const secret = req.headers.get('x-sync-secret')
  const expected = process.env.SYNC_SECRET
  if (!expected) return false
  return secret === expected
}

// GET: クラウドからデータを取得
export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const record = await kvGet<SyncRecord>(SYNC_KEY)
    return NextResponse.json({ data: record?.payload ?? {}, updated_at: record?.updatedAt ?? null })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : '取得に失敗' }, { status: 500 })
  }
}

// POST: クラウドへデータを保存
export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await req.json()
    const { data: payload } = body
    if (!payload || typeof payload !== 'object') {
      return NextResponse.json({ error: 'dataがありません' }, { status: 400 })
    }
    await kvSet(SYNC_KEY, { payload, updatedAt: new Date().toISOString() } satisfies SyncRecord)
    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : '保存に失敗' }, { status: 500 })
  }
}
