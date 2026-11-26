/**
 * 来院予定（時間を決めない予定）を入れた・日にちを変えたときに、LINE 連携の方へ「ご来院の予定を承りました」を送る（院内）
 *
 * - POST : { id, date, patientId?, name } → { ok, linked, delivered, result, why }
 *   送るかどうかは 集客 → 自動化設定の「予約確認の LINE」に従う（テストなら院長の LINE に見本・止めていれば送らない）。
 *   同じ予定・同じ日にちには1通。LINE 連携の無い方には何も送らない（why に理由）。お名前・宛先は返さない
 * 2026-11-26 院長「更に時間指定のない予約もlineが入るようにしてください」。lib/marketing/visit-plan-line-server.ts
 */
import { NextRequest, NextResponse } from 'next/server'
import { confirmVisitPlan } from '@/lib/marketing/visit-plan-line-server'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

export async function POST(request: NextRequest) {
  let body: { id?: unknown; date?: unknown; patientId?: unknown; name?: unknown }
  try {
    body = (await request.json()) as typeof body
  } catch {
    return NextResponse.json({ ok: false, error: '内容を読み取れませんでした' }, { status: 400 })
  }
  try {
    const r = await confirmVisitPlan({
      id: typeof body.id === 'string' ? body.id : '',
      date: typeof body.date === 'string' ? body.date : '',
      patientId: typeof body.patientId === 'string' ? body.patientId : undefined,
      name: typeof body.name === 'string' ? body.name.slice(0, 60) : '',
    })
    console.log('[visit-plan-line] 来院予定の確定:', r.note)
    return NextResponse.json({ ok: true, linked: r.linked, delivered: r.delivered, result: r.result, why: r.why })
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : '送れませんでした' }, { status: 500 })
  }
}
