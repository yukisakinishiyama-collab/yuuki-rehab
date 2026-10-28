/**
 * 予約管理画面（GAS）を、パスワードなしで開くための署名つきURLを返す（院内のみ）
 *
 * 院内アプリは Basic 認証で守られているので、ここを通れたスタッフは院内の人。
 * 予約システムには「院内アプリから開いた」ことを署名で伝え、向こうで短い有効期間の
 * 管理チケットを発行してもらう（予約システムのパスワードを画面で聞かなくて済む）。
 * 署名の鍵は RESERVATION_NOTIFY_SECRET（予約システム側の PATIENT_NOTIFY_SECRET と同じ値）。
 */
import { createHmac } from 'crypto'
import { NextResponse } from 'next/server'
import { RESERVE_URL } from '@/lib/marketing/clinic'

export const dynamic = 'force-dynamic'

export async function GET() {
  // この通り道は院内アプリの Basic 認証の内側（src/proxy.ts）。院長・スタッフのどちらでも使える
  const secret = process.env.RESERVATION_NOTIFY_SECRET
  if (!secret) {
    // 鍵が無いときは、今までどおりパスワードで入ってもらう
    return NextResponse.json({ ok: true, url: `${RESERVE_URL}?page=admin`, signed: false })
  }
  const ts = String(Date.now())
  const sig = createHmac('sha256', secret).update(`admin:${ts}`).digest('hex')
  return NextResponse.json({
    ok: true,
    url: `${RESERVE_URL}?page=admin&ts=${ts}&sig=${sig}`,
    signed: true,
  })
}
