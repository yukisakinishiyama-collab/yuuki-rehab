/**
 * アウトカムの「測り方の図」（2026-11-27 院長「検査方法をChat Gptを使用して画像としても載せてください」）
 *
 * GET  … { items, configured }（院内のだれでも。カルテに出すのは院長が「使う」にした図だけ）
 * POST … { key, action: generate | approve | discard | remove }（院長だけ。generate は ChatGPT で1枚作る＝OpenAI の料金がかかる）
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/marketing/auth'
import { openAiImageConfigured } from '@/lib/marketing/openai-image-server'
import { METHOD_IMAGE_ACTIONS, isMethodImageKey, type MethodImageAction } from '@/lib/karte/method-images'
import { getMethodImages, runMethodImageAction } from '@/lib/karte/method-image-server'

export const dynamic = 'force-dynamic'
export const maxDuration = 180

export async function GET() {
  return NextResponse.json({ ok: true, items: await getMethodImages(), configured: openAiImageConfigured() })
}

export async function POST(request: NextRequest) {
  const denied = requireAdmin(request)
  if (denied) return denied
  const body = (await request.json().catch(() => null)) as { key?: unknown; action?: unknown } | null
  if (!isMethodImageKey(body?.key)) return NextResponse.json({ ok: false, error: '図を作れる指標ではありません' }, { status: 400 })
  if (!METHOD_IMAGE_ACTIONS.includes(body?.action as MethodImageAction)) return NextResponse.json({ ok: false, error: '操作が正しくありません' }, { status: 400 })
  const action = body!.action as MethodImageAction
  if (action === 'generate' && !openAiImageConfigured()) return NextResponse.json({ ok: false, error: 'OpenAI の設定（OPENAI_API_KEY）が無いため、図を作れません' }, { status: 503 })
  try {
    const items = await runMethodImageAction(body!.key as never, action)
    return NextResponse.json({ ok: true, items })
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : '図を扱えませんでした' }, { status: 502 })
  }
}
