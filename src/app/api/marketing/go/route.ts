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
import { DEFAULT_CLINIC_PROFILE, HOMEPAGE_URL } from '@/lib/marketing/clinic'
import { recordEvent } from '@/lib/marketing/analytics-store-server'
import { isBotUserAgent, isPrefetch } from '@/lib/marketing/hp-measure'

const DESTINATIONS: Record<string, string> = {
  reserve: DEFAULT_CLINIC_PROFILE.reserveUrl,
  map: DEFAULT_CLINIC_PROFILE.googleMapUrl,
  instagram: DEFAULT_CLINIC_PROFILE.instagramUrl,
  line: DEFAULT_CLINIC_PROFILE.lineUrl,
  home: HOMEPAGE_URL,
  // ホームページの料金・アクセスのページ（LINE の「料金・通院方法」の案内から）
  price: `${HOMEPAGE_URL}price`,
  access: `${HOMEPAGE_URL}access`,
}

export async function GET(request: NextRequest) {
  return handle(request, true)
}

/** リンクの確認ツールなどの HEAD は、行き先だけ返して数えない */
export async function HEAD(request: NextRequest) {
  return handle(request, false)
}

async function handle(request: NextRequest, count: boolean) {
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
  // 検索エンジン・AI のクローラーやリンクの下見は、人のクリックと分けて記録する
  // （サイトの全ページにこのリンクがあるため、クローラーが回るたびに「クリック」が増えていた）
  const automated = isBotUserAgent(request.headers.get('user-agent')) || isPrefetch((n) => request.headers.get(n))
  if (count) {
    try {
      await recordEvent(automated ? 'link_bot' : 'link_click', meta)
    } catch {
      // 計測の失敗で患者の遷移を止めない
    }
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

  const res = NextResponse.redirect(url, 302)
  // 検索結果に計測リンクそのものを載せない
  res.headers.set('X-Robots-Tag', 'noindex, nofollow')
  return res
}
