/**
 * 経営方針（90日計画）の進み具合（院長のみ）
 *
 * GET … { progress }（始めた日・済んだこと・見直しの点の状態）
 * PUT … { progress } で置きかえる（形を確かめてから保存）
 * 方針の中身はコード（src/data/keiei-strategy.ts）。2026-11-27 院長「この内容を今後の経営課題としてガイド、登録してください」
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/marketing/auth'
import { progressProblem, type StrategyProgress } from '@/lib/marketing/keiei-strategy'
import { getStrategyProgress, saveStrategyProgress } from '@/lib/marketing/keiei-strategy-server'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const denied = requireAdmin(request)
  if (denied) return denied
  return NextResponse.json({ ok: true, progress: await getStrategyProgress() })
}

export async function PUT(request: NextRequest) {
  const denied = requireAdmin(request)
  if (denied) return denied
  const body = (await request.json().catch(() => null)) as { progress?: unknown } | null
  const problem = progressProblem(body?.progress)
  if (problem) return NextResponse.json({ ok: false, error: problem }, { status: 400 })
  const saved = await saveStrategyProgress(body!.progress as StrategyProgress)
  return NextResponse.json({ ok: true, progress: saved })
}
