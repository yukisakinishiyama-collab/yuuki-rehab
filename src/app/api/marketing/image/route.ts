/**
 * 投稿画像の生成（院内アプリから。プレビュー・手動投稿用のダウンロード）
 *
 * テンプレート：/api/marketing/image?title=足首の捻挫&subtitle=応急処置のポイント&size=instagram
 * ストーリー（空き状況）：/api/marketing/image?kind=story&scope=day&dates=2026-10-26
 *   または kind=story&range=today|next|week（本日・次の診療日・今週。fresh=1 で予約システムから取り直す）
 *   いまの予約システムの空きで作る（投稿するときも、その時刻の空きで作り直す）。
 *   sample=1 のときは架空の空きで見本を作る（予約システムにつながらない環境の確認用）
 * 生成ロジックは lib/marketing/image-template.tsx（Instagram自動投稿と共通）。
 */
import { NextRequest, NextResponse } from 'next/server'
import { IMAGE_SIZES, renderStoryImage, renderTemplateImage } from '@/lib/marketing/image-template'
import { addDays, jstParts, storyHasOpening, storyRange, storyRows, storyText, type OpeningDay } from '@/lib/marketing/autopilot-planner'
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
      const now = jstParts(new Date())
      const asOfLabel = `${Number(now.local.slice(5, 7))}/${Number(now.local.slice(8, 10))} ${now.local.slice(11, 16)} 時点`
      // 院内アプリの「今の空きでストーリー画像を作る」：range=today|next|week（fresh=1 で予約システムから取り直す）
      const range = params.get('range')
      if (range === 'today' || range === 'next' || range === 'week') {
        const openings: OpeningDay[] =
          params.get('sample') === '1'
            ? Array.from({ length: 8 }, (_, i) => {
                const date = addDays(now.date, i)
                return { date, closed: new Date(`${date}T00:00:00Z`).getUTCDay() === 0, am: [5, 1, 0, 3, 2, 4, 0, 3][i], pm: [2, 3, 1, 0, 4, 1, 2, 5][i] }
              })
            : ((await fetchHubStatsFast(1, { force: params.get('fresh') === '1' }))?.openings ?? [])
        if (openings.length === 0) return NextResponse.json({ error: '予約システムから空きを受け取れませんでした' }, { status: 502 })
        const r = storyRange(range, openings, now.date)
        const rows = storyRows(openings, r.dates)
        if (rows.length === 0) return NextResponse.json({ error: '載せられる日がありません（休診の日など）' }, { status: 404 })
        const text = storyText(rows, r.scope, now.local, r.title)
        const res = png(await renderStoryImage({ title: text.title, asOfLabel, scope: r.scope, rows }), `story-${now.date}.png`)
        res.headers.set('X-Story-Has-Opening', storyHasOpening(rows) ? '1' : '0')
        return res
      }
      const scope = params.get('scope') === 'week' ? 'week' : 'day'
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
      return png(await renderStoryImage({ title: text.title, asOfLabel, scope, rows }), 'story.png')
    }

    const title = params.get('title') ?? 'タイトル未設定'
    const subtitle = params.get('subtitle') ?? ''
    const sizeKey = (params.get('size') ?? 'instagram') as keyof typeof IMAGE_SIZES
    return png(await renderTemplateImage(title, subtitle, sizeKey), 'post-image.png')
  } catch (error) {
    // 原因を80字で切ると「Failed to load external module sharp」までしか出ず、
    // その先の本当の理由（ネイティブモジュールが見つからない等）が分からなくなる。
    // この画面は院内専用（proxy.ts のBasic認証の内側）なので、理由をそのまま出してよい。
    // 画面に返すのは message まで（読んで貼ってもらうため）。スタックはログだけに残す。
    console.error('[marketing/image] 画像生成に失敗しました', error)
    const detail = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: '画像生成に失敗しました', detail }, { status: 500 })
  }
}
