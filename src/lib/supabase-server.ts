import { createClient } from '@supabase/supabase-js'

// サーバー専用クライアント（API Routes 内でのみ使用）
export function createSupabaseServer() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) return null

  return createClient(url, key, {
    auth: { persistSession: false },
  })
}
