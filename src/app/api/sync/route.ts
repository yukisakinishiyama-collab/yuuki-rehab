import { NextRequest, NextResponse } from 'next/server'
import { kvGet, kvSet } from '@/lib/marketing/kv-store-server'
import { applyOps, sanitizeOps } from '@/lib/sync-merge'
import { nextVersion, SYNC_KEY, type SyncRecord } from '@/lib/sync-store-server'

/**
 * リハビリアプリのクラウド同期（端末の localStorage の控え）
 *
 * 旧実装は専用テーブル clinic_sync を使っていたが、SUPABASE_URLの移行
 * （yuuki-marketingプロジェクト）でテーブルが無くなったため、
 * DDL不要のKVストア（sync:プレフィックス）に移行した。
 *
 * GET              … 全体を返す { data, updated_at }
 * GET ?since=版     … クラウドがその版のままなら { unchanged: true, updated_at }（15秒ごとの確認を軽くする）
 * POST {v:2, ops}   … 端末で変わったところ（sync-merge の KeyOp）だけを、クラウドの今の中身に重ねる。
 *                     返事 { updatedAt, prevAt }（prevAt＝重ねる前の版。端末が知っている版と違えば、ほかの端末も書いていた）
 * POST {data}       … 古い端末から（全体を送ってくる）。届いたキーだけを置きかえる（届かなかったキーは消さない）
 *
 * 入れ物の名前・版の進め方は lib/sync-store-server.ts（サーバーが自分でカルテを足すときと共通）
 */
export const dynamic = 'force-dynamic'

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
    const since = req.nextUrl.searchParams.get('since')
    if (since && record?.updatedAt === since) {
      return NextResponse.json({ unchanged: true, updated_at: record.updatedAt }, { headers: { 'Cache-Control': 'no-store' } })
    }
    return NextResponse.json(
      { data: record?.payload ?? {}, updated_at: record?.updatedAt ?? null },
      { headers: { 'Cache-Control': 'no-store' } },
    )
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
    const body = (await req.json()) as { v?: number; ops?: unknown; data?: unknown }
    const record = await kvGet<SyncRecord>(SYNC_KEY)
    const prevAt = record?.updatedAt ?? null
    const current = record?.payload ?? {}

    let payload: Record<string, string>
    if (body.v === 2) {
      const ops = sanitizeOps(body.ops)
      if (!ops) return NextResponse.json({ error: '変更の形が正しくありません' }, { status: 400 })
      payload = applyOps(current, ops)
    } else {
      const data = body.data
      if (!data || typeof data !== 'object') {
        return NextResponse.json({ error: 'dataがありません' }, { status: 400 })
      }
      payload = { ...current }
      for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
        if (typeof value === 'string') payload[key] = value
      }
    }

    const updatedAt = nextVersion(prevAt)
    await kvSet(SYNC_KEY, { payload, updatedAt } satisfies SyncRecord)
    return NextResponse.json({ ok: true, updatedAt, prevAt })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : '保存に失敗' }, { status: 500 })
  }
}
