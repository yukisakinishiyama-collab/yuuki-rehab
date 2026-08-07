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

/** 数値パラメータを範囲内に丸める（不正値はGASへ渡さず既定値にする） */
function clampParam(raw: string | null, fallback: number, min: number, max: number): number {
  const value = Number(raw)
  if (!Number.isFinite(value)) return fallback
  return Math.min(Math.max(Math.floor(value), min), max)
}

export async function GET(request: NextRequest) {
  const key = request.nextUrl.searchParams.get('key') ?? ''
  const days = clampParam(request.nextUrl.searchParams.get('days'), 2, 1, 14)
  // back … 過去にさかのぼる日数（カルテへのキャンセル取り込み用）
  const back = clampParam(request.nextUrl.searchParams.get('back'), 0, 0, 60)
  if (!key) {
    return NextResponse.json({ ok: false, error: 'key required' }, { status: 400 })
  }

  try {
    const url = `${GAS_FEED_URL}?api=feed&key=${encodeURIComponent(key)}&days=${days}&back=${back}`
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
