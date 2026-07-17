/** 個別ジョブ操作: 取消・手動再実行・手動投稿完了・日時変更 */
import { NextRequest, NextResponse } from 'next/server'
import { getJob, updateJob } from '@/lib/marketing/jobs-store-server'

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!(await getJob(id))) return NextResponse.json({ error: 'ジョブが見つかりません' }, { status: 404 })

  try {
    const body = (await request.json()) as {
      action: 'cancel' | 'retry' | 'manual_complete' | 'reschedule'
      publishedUrl?: string
      scheduledAt?: string
    }

    const job = await updateJob(id, (j) => {
      if (body.action === 'cancel') {
        j.status = 'cancelled'
      }
      if (body.action === 'retry') {
        j.status = 'pending'
        j.nextAttemptAt = undefined
      }
      if (body.action === 'manual_complete') {
        j.status = 'published'
        j.publishedUrl = body.publishedUrl
        j.attempts.push({ at: new Date().toISOString(), ok: true, message: '手動投稿の完了を記録' })
      }
      if (body.action === 'reschedule' && body.scheduledAt) {
        j.scheduledAt = body.scheduledAt
        j.status = 'pending'
        j.nextAttemptAt = undefined
      }
    })
    return NextResponse.json({ ok: true, job })
  } catch {
    return NextResponse.json({ error: '操作に失敗しました' }, { status: 400 })
  }
}
