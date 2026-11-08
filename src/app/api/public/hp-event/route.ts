/**
 * ホームページからの計測の受け口（閲覧数・電話タップ）
 *
 * ホームページ（shimonoseki-yuuki.com）の js/site.js が、ページを開いたときと電話番号を押したときに
 * navigator.sendBeacon で送ってくる。受け取るのは「どのページか」「電話の置き場所」だけで、
 * Cookie・IP アドレス・端末の情報は保存しない。日別の件数を足すだけ。
 *
 * POST /api/public/hp-event?e=view&p=/first-visit
 * POST /api/public/hp-event?e=tel&p=/first-visit&w=bar
 *
 * 公開の API（院内アプリの Basic 認証の対象外。proxy.ts の matcher に /api/public は入っていない）。
 * いたずら対策: ホームページ以外の Origin・自動アクセス・おかしな値は数えない。数は1日・1ページの上限まで。
 */
import { NextRequest, NextResponse } from 'next/server'
import { HP_ORIGINS, isBotUserAgent, isPrefetch, normalizePage, normalizePlace } from '@/lib/marketing/hp-measure'
import { recordHpEvent } from '@/lib/marketing/hp-stats-server'

function cors(origin: string | null): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': origin && HP_ORIGINS.includes(origin) ? origin : HP_ORIGINS[0],
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Cache-Control': 'no-store',
    Vary: 'Origin',
  }
}

export async function POST(request: NextRequest) {
  const origin = request.headers.get('origin')
  const headers = cors(origin)
  const params = request.nextUrl.searchParams
  const kind = params.get('e')
  const page = normalizePage(params.get('p'))

  const fromSite = origin !== null && HP_ORIGINS.includes(origin)
  const human = !isBotUserAgent(request.headers.get('user-agent')) && !isPrefetch((n) => request.headers.get(n))
  if (fromSite && human && page && (kind === 'view' || kind === 'tel')) {
    await recordHpEvent(kind, page, kind === 'tel' ? normalizePlace(params.get('w')) : undefined)
  }
  // 数えなかったときも同じ返事にする（何で弾いたかを外に教えない）
  return new NextResponse(null, { status: 204, headers })
}

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, { status: 204, headers: cors(request.headers.get('origin')) })
}
