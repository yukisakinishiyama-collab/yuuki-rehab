/**
 * Instagram 投稿のサムネイル画像の中継（ホームページの最新投稿の欄で使う）
 *
 *   GET /api/public/instagram-feed/image/<投稿ID>
 *
 * - 院のアカウントのトークンで投稿を引くので、ほかのアカウントの投稿は取れない
 * - 取りに行く先は Instagram の画像配信元だけ（isAllowedImageHost）。任意の URL は取りに行かない
 * - CDN に 1 日キャッシュさせる（Instagram 側の画像 URL は期限つきのため、ここで取り直す）
 */
import { NextRequest } from 'next/server'
import { getInstagramToken, INSTAGRAM_GRAPH_HOST } from '@/lib/marketing/instagram-token'
import { pickImageUrl, type RawMedia } from '@/lib/marketing/instagram-feed'

function notFound() {
  return new Response('not found', { status: 404, headers: { 'Cache-Control': 'public, s-maxage=300' } })
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!/^\d{5,25}$/.test(id)) return notFound()
  const token = await getInstagramToken()
  if (!token) return notFound()

  try {
    const meta = await fetch(
      `${INSTAGRAM_GRAPH_HOST}/v21.0/${id}?fields=media_type,media_url,thumbnail_url&access_token=${encodeURIComponent(token)}`,
      { signal: AbortSignal.timeout(8_000), cache: 'no-store' },
    )
    if (!meta.ok) return notFound()
    const url = pickImageUrl((await meta.json()) as RawMedia)
    if (!url) return notFound()

    const img = await fetch(url, { signal: AbortSignal.timeout(10_000), cache: 'no-store' })
    const type = img.headers.get('content-type') ?? ''
    if (!img.ok || !type.startsWith('image/')) return notFound()
    return new Response(img.body, {
      headers: {
        'Content-Type': type,
        'Cache-Control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800',
        'Access-Control-Allow-Origin': '*',
      },
    })
  } catch {
    return notFound()
  }
}
