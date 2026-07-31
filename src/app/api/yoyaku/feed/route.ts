/**
 * 予約フィードのプロキシ（患者管理アプリ「今日の予約」ウィジェット用）
 *
 * ブラウザ → このルート → GAS予約システム（?api=feed）の読み取り専用中継。
 * - 認証はGAS側で実施（key=予約管理の管理者パスワード。端末のlocalStorageに保存され
 *   リクエスト毎に転送される。このサーバーには何も保存しない）
 * - GASへの直接fetchはCORS・リダイレクトの都合で不安定なため、サーバー側で中継する
 */
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const GAS_FEED_URL =
  'https://script.google.com/macros/s/AKfycby6httkx008ojq7MIBpC7pDmfsJQAtQx6xpYNkD67JM7K7jgGaWGkTky9RHW04M1qm9/exec'

export async function GET(request: NextRequest) {
  const key = request.nextUrl.searchParams.get('key') ?? ''
  const days = request.nextUrl.searchParams.get('days') ?? '2'
  if (!key) {
    return NextResponse.json({ ok: false, error: 'key required' }, { status: 400 })
  }

  try {
    const url = `${GAS_FEED_URL}?api=feed&key=${encodeURIComponent(key)}&days=${encodeURIComponent(days)}`
    const res = await fetch(url, { redirect: 'follow', cache: 'no-store' })
    const data = (await res.json().catch(() => null)) as { ok?: boolean } | null
    if (!data) {
      return NextResponse.json({ ok: false, error: '予約システムの応答を読み取れませんでした' }, { status: 502 })
    }
    return NextResponse.json(data)
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : '取得に失敗しました' },
      { status: 502 },
    )
  }
}
