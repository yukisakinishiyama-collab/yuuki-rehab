/**
 * Instagramフォロワー数の記録（効果測定画面から）
 *
 * GET  … 記録の一覧と増減
 * POST … { followers, date? } その日の数を手で記録（院長のみ。連携後は自動記録が上書きされない日だけ使う）
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdmin } from '@/lib/marketing/auth'
import { addFollowerPoint, listFollowerPoints, summarize } from '@/lib/marketing/instagram-stats-server'
import { jstParts } from '@/lib/marketing/autopilot-planner'
import { isInstagramConnected } from '@/lib/marketing/instagram-token'

export const dynamic = 'force-dynamic'

const Schema = z.object({
  followers: z.number().int().min(0).max(10_000_000),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
})

export async function GET() {
  const points = await listFollowerPoints()
  return NextResponse.json({ ok: true, points: points.slice(-120), summary: summarize(points), connected: await isInstagramConnected() })
}

export async function POST(request: NextRequest) {
  const denied = requireAdmin(request)
  if (denied) return denied
  let input
  try {
    input = Schema.parse(await request.json())
  } catch {
    return NextResponse.json({ error: 'フォロワー数を数字で入力してください' }, { status: 400 })
  }
  const date = input.date ?? jstParts(new Date()).date
  const points = await addFollowerPoint({ date, followers: input.followers, source: 'manual' })
  return NextResponse.json({ ok: true, points: points.slice(-120), summary: summarize(points) })
}
