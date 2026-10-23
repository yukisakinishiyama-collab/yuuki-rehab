/**
 * NOAH集計の毎晩のまとめ（院長LINEへ1通）
 *
 * - GitHub Actions（15分ごと）と Vercel Cron（夜の保険）から呼ばれる。21時（日本時間）より前・日曜・
 *   送信済みの夜は何もしない。その日の集計が届いた最初の回だけ送る。23時を過ぎても届かなければ
 *   「届いていません」を1回だけ送る
 * - ?dry=1   … 文面を作って返すだけ（LINE・下書き・記録はしない。確認用）
 * - ?force=1 … 時刻・送信済みに関係なく送り直す（管理者の手動実行用）
 * - 認証: CRON_SECRET（Bearer）または管理者のBasic認証（proxyの認証対象外のためここで確認）
 */
import { NextRequest, NextResponse } from 'next/server'
import { cronOrAdmin } from '@/lib/marketing/auth'
import { runNoahNightly } from '@/lib/marketing/noah-server'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

async function handle(request: NextRequest) {
  if (!cronOrAdmin(request)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const params = request.nextUrl.searchParams
  try {
    const result = await runNoahNightly(new Date(), {
      force: params.get('force') === '1',
      dry: params.get('dry') === '1',
    })
    return NextResponse.json({ ok: true, ...result })
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : '不明なエラー' },
      { status: 500 },
    )
  }
}

export const GET = handle
export const POST = handle
