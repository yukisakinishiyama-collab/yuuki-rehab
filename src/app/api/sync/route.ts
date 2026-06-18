import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServer } from '@/lib/supabase-server'

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

  const supabase = createSupabaseServer()
  if (!supabase) {
    return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 })
  }

  const { data, error } = await supabase
    .from('clinic_sync')
    .select('data, updated_at')
    .eq('id', 'main')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data: data?.data ?? {}, updated_at: data?.updated_at })
}

// POST: クラウドへデータを保存
export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createSupabaseServer()
  if (!supabase) {
    return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 })
  }

  const body = await req.json()
  const { data: payload } = body

  const { error } = await supabase
    .from('clinic_sync')
    .upsert({ id: 'main', data: payload, updated_at: new Date().toISOString() })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
