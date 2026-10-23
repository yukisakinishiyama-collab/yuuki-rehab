/**
 * 週の投稿案への操作（承認画面から）
 *
 * 承認・承認取消・見送り・戻す … 公開を左右するため院長（管理者）のみ
 * 本文の修正・媒体の出し分け・作り直し … スタッフも可（下書きの編集にあたる。公開には院長の承認が必要）
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdmin, ROLE_HEADER } from '@/lib/marketing/auth'
import { ADMIN_ACTIONS, applyProposalAction, type ProposalAction } from '@/lib/marketing/autopilot-server'
import { getProposal } from '@/lib/marketing/autopilot-store-server'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

const CHANNELS = ['instagram_feed', 'instagram_carousel', 'instagram_reel', 'instagram_story', 'google_business', 'line_broadcast', 'note'] as const

const ActionSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('approve_item'), itemId: z.string().min(1) }),
  z.object({ action: z.literal('approve_all') }),
  z.object({ action: z.literal('unapprove_item'), itemId: z.string().min(1) }),
  z.object({ action: z.literal('skip_item'), itemId: z.string().min(1) }),
  z.object({ action: z.literal('restore_item'), itemId: z.string().min(1) }),
  z.object({ action: z.literal('toggle_channel'), itemId: z.string().min(1), channel: z.enum(CHANNELS), exclude: z.boolean() }),
  z.object({
    action: z.literal('edit_variant'),
    itemId: z.string().min(1),
    variantId: z.string().min(1),
    title: z.string().max(200).optional(),
    hook: z.string().max(300).optional(),
    body: z.string().max(5000).optional(),
    hashtags: z.array(z.string().max(50)).max(30).optional(),
  }),
  z.object({ action: z.literal('regenerate_item'), itemId: z.string().min(1), theme: z.string().max(200).optional() }),
])

const WEEK = /^\d{4}-\d{2}-\d{2}$/

export async function GET(_request: NextRequest, { params }: { params: Promise<{ week: string }> }) {
  const { week } = await params
  if (!WEEK.test(week)) return NextResponse.json({ error: '週の指定が正しくありません' }, { status: 400 })
  const proposal = await getProposal(week)
  if (!proposal) return NextResponse.json({ error: 'この週の投稿案はありません' }, { status: 404 })
  return NextResponse.json({ ok: true, proposal })
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ week: string }> }) {
  const { week } = await params
  if (!WEEK.test(week)) return NextResponse.json({ error: '週の指定が正しくありません' }, { status: 400 })

  let input: ProposalAction
  try {
    input = ActionSchema.parse(await request.json()) as ProposalAction
  } catch {
    return NextResponse.json({ error: '操作の内容が正しくありません' }, { status: 400 })
  }
  if (ADMIN_ACTIONS.has(input.action)) {
    const denied = requireAdmin(request)
    if (denied) return denied
  }

  const actor = request.headers.get(ROLE_HEADER) === 'staff' ? 'スタッフ' : '院長'
  try {
    const result = await applyProposalAction(week, input, actor)
    return NextResponse.json(result, { status: result.ok ? 200 : 409 })
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: `操作に失敗しました（${error instanceof Error ? error.message : '不明'}）` },
      { status: 500 },
    )
  }
}
