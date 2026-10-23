/**
 * 投稿画像の生成（院内アプリから。プレビュー・手動投稿用のダウンロード）
 *
 * テンプレート：/api/marketing/image?title=足首の捻挫&subtitle=応急処置のポイント&size=instagram
 * ストーリー（空き状況）：/api/marketing/image?kind=story&scope=day&dates=2026-10-26
 *   いまの予約システムの空きで作る（投稿するときも、その時刻の空きで作り直す）。
 *   sample=1 のときは架空の空きで見本を作る（予約システムにつながらない環境の確認用）
 * 生成ロジックは lib/marketing/image-template.tsx（Instagram自動投稿と共通）。
 */
import { NextRequest, NextResponse } from 'next/server'
import { IMAGE_SIZES, renderStoryImage, renderTemplateImage } from '@/lib/marketing/image-template'
import { addDays, jstParts, storyRows, storyText, type OpeningDay } from '@/lib/marketing/autopilot-planner'
import { fetchHubStatsFast } from '@/lib/marketing/booking-stats-fast'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const DATE = /^\d{4}-\d{2}-\d{2}$/

function png(buf: Buffer, name: string) {
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      'Content-Type': 'image/png',
      'Content-Disposition': `inline; filename="${name}"`,
      'Cache-Control': 'no-store',
    },
  })
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams
  try {
    if (params.get('kind') === 'story') {
      const scope = params.get('scope') === 'week' ? 'week' : 'day'
      const now = jstParts(new Date())
      const dates = (params.get('dates') ?? now.date)
        .split(',')
        .filter((d) => DATE.test(d))
        .slice(0, 7)
      let openings: OpeningDay[]
      if (params.get('sample') === '1') {
        const levels = [5, 1, 0, 3, 2, 4, 0]
        openings = dates.map((date, i) => ({ date, closed: false, am: levels[i % 7], pm: levels[(i + 3) % 7] }))
      } else {
        openings = (await fetchHubStatsFast(1))?.openings ?? []
      }
      const rows = storyRows(openings, dates.length ? dates : [addDays(now.date, 0)])
      if (rows.length === 0) return NextResponse.json({ error: 'この日の空きを予約システムから受け取れませんでした' }, { status: 404 })
      const text = storyText(rows, scope, now.local)
      const asOfLabel = `${Number(now.local.slice(5, 7))}/${Number(now.local.slice(8, 10))} ${now.local.slice(11, 16)} 時点`
      return png(await renderStoryImage({ title: text.title, asOfLabel, scope, rows }), 'story.png')
    }

    const title = params.get('title') ?? 'タイトル未設定'
    const subtitle = params.get('subtitle') ?? ''
    const sizeKey = (params.get('size') ?? 'instagram') as keyof typeof IMAGE_SIZES
    return png(await renderTemplateImage(title, subtitle, sizeKey), 'post-image.png')
  } catch (error) {
    return NextResponse.json(
      { error: `画像生成に失敗しました（${error instanceof Error ? error.message.slice(0, 80) : '不明'}）` },
      { status: 500 },
    )
  }
}
