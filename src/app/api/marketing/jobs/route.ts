/** 予約投稿ジョブAPI: 作成・一覧 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createJob, listJobs } from '@/lib/marketing/jobs-store-server'
import { CHANNEL_LABELS, type Channel } from '@/lib/marketing/types'

const CreateSchema = z.object({
  projectId: z.string().min(1),
  variantId: z.string().min(1),
  channel: z.string(),
  theme: z.string(),
  content: z.record(z.string(), z.unknown()),
  scheduledAt: z.string().min(10),
})

export async function GET() {
  return NextResponse.json({ ok: true, jobs: listJobs() })
}

export async function POST(request: NextRequest) {
  try {
    const input = CreateSchema.parse(await request.json())
    if (!(input.channel in CHANNEL_LABELS)) throw new Error('bad channel')
    const { job, duplicated } = createJob({
      idempotencyKey: `${input.variantId}`,
      projectId: input.projectId,
      variantId: input.variantId,
      channel: input.channel as Channel,
      theme: input.theme,
      content: input.content as never,
      scheduledAt: input.scheduledAt,
    })
    return NextResponse.json({ ok: true, job, duplicated })
  } catch {
    return NextResponse.json({ error: 'ジョブ作成の入力が不正です' }, { status: 400 })
  }
}
