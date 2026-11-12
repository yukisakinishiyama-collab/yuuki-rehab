/**
 * ホームページ（shimonoseki-yuuki.com）に出す Instagram の最新投稿（公開してよい情報だけ）
 *
 *   GET /api/public/instagram-feed?mode=learning&limit=3
 *
 * - 院の公開アカウントの公開投稿だけを返す（トークンや患者情報は返さない）。ログイン不要（proxy.ts の対象外）
 * - CDN に 30 分キャッシュさせ、Instagram の API を呼ぶ回数を抑える
 * - つながっていない・失敗したときは items を空で返す（ホームページ側は元の表示のまま）
 */
import { NextRequest, NextResponse } from 'next/server'
import { getInstagramToken, INSTAGRAM_GRAPH_HOST } from '@/lib/marketing/instagram-token'
import { toFeedItems, type FeedMode, type RawMedia } from '@/lib/marketing/instagram-feed'

const FIELDS = 'id,caption,media_type,media_product_type,media_url,thumbnail_url,permalink,timestamp'

function json(body: unknown, maxAge: number) {
  return NextResponse.json(body, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': `public, max-age=300, s-maxage=${maxAge}, stale-while-revalidate=86400`,
    },
  })
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams
  const mode: FeedMode = params.get('mode') === 'latest' ? 'latest' : 'learning'
  const limit = Number(params.get('limit') ?? 3)

  const token = await getInstagramToken()
  if (!token) return json({ items: [], matched: false, reason: 'not_connected' }, 300)

  try {
    const res = await fetch(
      `${INSTAGRAM_GRAPH_HOST}/v21.0/me/media?fields=${FIELDS}&limit=25&access_token=${encodeURIComponent(token)}`,
      { signal: AbortSignal.timeout(8_000), cache: 'no-store' },
    )
    if (!res.ok) return json({ items: [], matched: false, reason: `instagram_${res.status}` }, 300)
    const data = (await res.json()) as { data?: RawMedia[] }
    const imageBase = `${request.nextUrl.origin}/api/public/instagram-feed/image`
    const { items, matched } = toFeedItems(data.data ?? [], { mode, limit, imageBase })
    return json({ items, matched, updatedAt: new Date().toISOString() }, 1800)
  } catch {
    return json({ items: [], matched: false, reason: 'fetch_failed' }, 300)
  }
}
