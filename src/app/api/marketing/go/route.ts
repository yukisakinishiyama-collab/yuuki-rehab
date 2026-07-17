/**
 * 計測付きリダイレクト（指示書17章の流入計測）
 *
 * /api/marketing/go?d=reserve&source=line&campaign=first_visit&intent=injury
 * → クリックを記録して予約ページへ302リダイレクト
 *
 * セキュリティ: オープンリダイレクト防止のため、遷移先は
 * ホワイトリスト（d=キー名）のみ。任意URLは受け付けない。
 */
import { NextRequest, NextResponse } from 'next/server'
import { DEFAULT_CLINIC_PROFILE } from '@/lib/marketing/clinic'
import { recordEvent } from '@/lib/marketing/analytics-store-server'

const DESTINATIONS: Record<string, string> = {
  reserve: DEFAULT_CLINIC_PROFILE.reserveUrl,
  map: DEFAULT_CLINIC_PROFILE.googleMapUrl,
  instagram: DEFAULT_CLINIC_PROFILE.instagramUrl,
  line: DEFAULT_CLINIC_PROFILE.lineUrl,
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams
  const dest = params.get('d') ?? ''
  const target = DESTINATIONS[dest]
  if (!target) {
    return NextResponse.json({ error: '不明な遷移先です' }, { status: 400 })
  }

  const meta: Record<string, string> = { dest }
  for (const key of ['source', 'campaign', 'intent', 'channel', 'project']) {
    const value = params.get(key)
    if (value) meta[key] = value.slice(0, 60)
  }
  try {
    await recordEvent('link_click', meta)
  } catch {
    // 計測の失敗で患者の遷移を止めない
  }

  // 予約ページにはUTMを引き継ぐ（将来GAS側で記録する場合に備える）
  let url = target
  if (dest === 'reserve') {
    const sep = target.includes('?') ? '&' : '?'
    const qs = new URLSearchParams()
    if (meta.source) qs.set('source', meta.source)
    if (meta.campaign) qs.set('campaign', meta.campaign)
    if (meta.intent) qs.set('intent', meta.intent)
    const s = qs.toString()
    if (s) url = `${target}${sep}${s}`
  }

  return NextResponse.redirect(url, 302)
}
