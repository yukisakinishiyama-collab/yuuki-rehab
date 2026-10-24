/**
 * 院内アプリの「今の空きでストーリー画像を作る」（見本の画像と、直せる中身）
 *
 * POST { range: 'today' | 'next' | 'week', edits?: StoryEdits, sample?: true }
 * → { image: 'data:image/png;base64,…', title, hasOpening, days: [{ date, label, slots: [{ time, remaining, hidden }] }] }
 * - 予約システムから空きを取り直して作る（v3.10 以降は時間と残り枠も）
 * - 見出し・ひとこと・出さない時間・残り枠の数を出すか、を当てはめる（公開のときも同じ編集で作り直す）
 * - 下にネット予約のQR（ストーリーの計測つきリンク）
 * 患者さんの情報は使わない。院内専用（proxy の認証の内側）
 */
import { NextRequest, NextResponse } from 'next/server'
import { addDays, jstParts, storyRange, storyRows, type OpeningDay } from '@/lib/marketing/autopilot-planner'
import { fetchHubStatsFast } from '@/lib/marketing/booking-stats-fast'
import { renderStoryImage } from '@/lib/marketing/image-template'
import { buildStory, sanitizeStoryEdits, storyEditsProblem, storyQrDataUrl, storyReserveLink } from '@/lib/marketing/story-server'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const RANGES = ['today', 'next', 'week'] as const
type Range = (typeof RANGES)[number]

/** 予約システムにつながらない環境の確認用（架空の空き） */
function sampleOpenings(today: string): OpeningDay[] {
  return Array.from({ length: 8 }, (_, i) => {
    const date = addDays(today, i)
    const closed = new Date(`${date}T00:00:00Z`).getUTCDay() === 0
    const times = ['10:00', '10:30', '11:00', '12:00', '15:00', '15:30', '16:00', '17:30', '18:00', '19:00']
    const slots = closed ? [] : times.filter((_, k) => (k + i) % 3 !== 0).map((time, k) => ({ time, remaining: (k % 3) + 1 }))
    return {
      date,
      closed,
      am: slots.filter((s) => s.time < '13:00').length,
      pm: slots.filter((s) => s.time >= '13:00').length,
      slots,
    }
  })
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as { range?: string; edits?: unknown; sample?: boolean }
    const range = RANGES.includes(body.range as Range) ? (body.range as Range) : null
    if (!range) return NextResponse.json({ error: 'range は today・next・week のどれかです' }, { status: 400 })
    const edits = sanitizeStoryEdits(body.edits)
    const problem = storyEditsProblem(edits)
    if (problem) return NextResponse.json({ error: problem }, { status: 422 })

    const now = jstParts(new Date())
    const openings: OpeningDay[] =
      body.sample === true ? sampleOpenings(now.date) : ((await fetchHubStatsFast(1, { force: true }))?.openings ?? [])
    if (openings.length === 0) return NextResponse.json({ error: '予約システムから空きを受け取れませんでした' }, { status: 502 })

    const r = storyRange(range, openings, now.date)
    const story = buildStory(openings, r.dates, r.scope, now.local, r.title, edits)
    if (story.rows.length === 0) return NextResponse.json({ error: '載せられる日がありません（休診の日など）' }, { status: 404 })

    const asOfLabel = `${Number(now.local.slice(5, 7))}/${Number(now.local.slice(8, 10))} ${now.local.slice(11, 16)} 時点`
    const qrDataUrl = await storyQrDataUrl(storyReserveLink(now.date))
    const png = await renderStoryImage({
      title: story.title,
      asOfLabel,
      scope: r.scope,
      rows: story.rows,
      note: story.note,
      showRemaining: story.showRemaining,
      qrDataUrl,
    })

    // 編集の画面に出す「時間の一覧」（隠した時間も含めて全部。隠したものは hidden）
    const hidden = new Set(edits.hiddenSlots ?? [])
    const days = storyRows(openings, r.dates).map((row) => ({
      date: row.date,
      label: row.label,
      closed: row.closed,
      slots: (row.slots ?? []).map((s) => ({ ...s, hidden: hidden.has(`${row.date} ${s.time}`) })),
      hasSlots: row.slots !== undefined,
    }))

    return NextResponse.json(
      {
        image: `data:image/png;base64,${png.toString('base64')}`,
        title: story.title,
        defaultTitle: r.title,
        hasOpening: story.hasOpening,
        days,
      },
      { headers: { 'Cache-Control': 'no-store' } },
    )
  } catch (error) {
    console.error('[story/image] ストーリー画像を作れませんでした', error)
    return NextResponse.json({ error: `画像を作れませんでした（${error instanceof Error ? error.message.slice(0, 200) : '不明'}）` }, { status: 500 })
  }
}
