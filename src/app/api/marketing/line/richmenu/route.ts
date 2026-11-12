/**
 * 公式LINEのリッチメニュー（API で登録する7マス以上のメニュー）
 * - GET    : いまの状態（API のデフォルトがあるか、API メニューの一覧）
 * - POST   : multipart { image: JPEG/PNG(2500x1686, ≤1MB), spec: JSON } → 登録して全員に表示
 * - DELETE : API のデフォルトを外し、LINE の管理画面のメニューに戻す
 * 院長のみ。
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/marketing/auth'
import { getDefaultRichMenuId, listRichMenus, publishRichMenu, resetRichMenu, type RichMenuSpec } from '@/lib/marketing/line-richmenu-server'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

function fail(error: unknown, status = 500) {
  return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : String(error) }, { status })
}

export async function GET(request: NextRequest) {
  const denied = requireAdmin(request)
  if (denied) return denied
  if (!process.env.LINE_CHANNEL_ACCESS_TOKEN) return NextResponse.json({ ok: true, configured: false, defaultId: null, menus: [] })
  try {
    // どちらかが失敗しても、もう片方は返す（原因が分かるように warning に入れる）
    const [d, m] = await Promise.allSettled([getDefaultRichMenuId(), listRichMenus()])
    const warning = [d, m]
      .filter((r): r is PromiseRejectedResult => r.status === 'rejected')
      .map((r) => (r.reason instanceof Error ? r.reason.message : String(r.reason)))
      .join(' / ')
    return NextResponse.json({
      ok: true,
      configured: true,
      defaultId: d.status === 'fulfilled' ? d.value : null,
      menus: m.status === 'fulfilled' ? m.value : [],
      warning: warning || undefined,
    })
  } catch (error) {
    return fail(error)
  }
}

const URI_OK = /^(https:\/\/|tel:)/

export async function POST(request: NextRequest) {
  const denied = requireAdmin(request)
  if (denied) return denied
  try {
    const form = await request.formData()
    const image = form.get('image')
    const specRaw = form.get('spec')
    if (!(image instanceof File) || typeof specRaw !== 'string') return fail('image と spec が要ります', 400)
    if (image.type !== 'image/jpeg' && image.type !== 'image/png') return fail('画像は JPEG か PNG にしてください', 400)
    const spec = JSON.parse(specRaw) as RichMenuSpec
    if (!spec.name || !spec.chatBarText || !Array.isArray(spec.areas) || spec.areas.length === 0 || spec.areas.length > 20) {
      return fail('メニューの設定が足りません', 400)
    }
    for (const a of spec.areas) {
      if (a.action.type === 'uri' && !URI_OK.test(a.action.uri)) return fail(`リンクは https か tel で始めてください: ${a.action.uri}`, 400)
      if (a.action.type === 'message' && !a.action.text) return fail('テキストのボタンに文字がありません', 400)
    }
    const buf = Buffer.from(await image.arrayBuffer())
    const richMenuId = await publishRichMenu(spec, buf, image.type)
    return NextResponse.json({ ok: true, richMenuId })
  } catch (error) {
    return fail(error)
  }
}

export async function DELETE(request: NextRequest) {
  const denied = requireAdmin(request)
  if (denied) return denied
  try {
    await resetRichMenu()
    return NextResponse.json({ ok: true })
  } catch (error) {
    return fail(error)
  }
}
