/**
 * テンプレート画像生成（指示書11章の「テンプレートから生成」）
 *
 * 例: /api/marketing/image?title=足首の捻挫&subtitle=応急処置のポイント&size=instagram
 * 生成ロジックは lib/marketing/image-template.ts（Instagram自動投稿と共通）。
 */
import { NextRequest, NextResponse } from 'next/server'
import { IMAGE_SIZES, renderTemplateImage } from '@/lib/marketing/image-template'

export const maxDuration = 60

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams
  const title = params.get('title') ?? 'タイトル未設定'
  const subtitle = params.get('subtitle') ?? ''
  const sizeKey = (params.get('size') ?? 'instagram') as keyof typeof IMAGE_SIZES

  try {
    const png = await renderTemplateImage(title, subtitle, sizeKey)
    return new NextResponse(new Uint8Array(png), {
      headers: {
        'Content-Type': 'image/png',
        'Content-Disposition': `inline; filename="post-image.png"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    return NextResponse.json(
      { error: `画像生成に失敗しました（${error instanceof Error ? error.message.slice(0, 80) : '不明'}）` },
      { status: 500 },
    )
  }
}
