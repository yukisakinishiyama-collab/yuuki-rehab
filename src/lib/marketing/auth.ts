/**
 * マーケティングハブの権限管理（院長=管理者 / スタッフ=編集）
 *
 * 認証は proxy.ts の Basic 認証で行い、一致したパスワードから役割を判定する。
 * proxy.ts が権威的にリクエストヘッダー `x-marketing-role` を注入し（クライアント
 * 偽装を防ぐため受信値は破棄）、各ルートはそのヘッダーで認可を再検証する。
 *
 * 役割の境界（医療広告コンプライアンス「公開・承認は院長」に準拠）:
 * - admin(院長): 全操作。予約投稿の作成・ジョブ操作・動画削除など公開/承認/削除。
 * - staff(編集): 閲覧・下書き生成・動画登録/編集・LINE患者対応など日常業務。
 *   公開・承認・削除はできない。
 */
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { ROLE_HEADER, type MarketingRole } from './auth-shared'

// 共有定数・型はクライアント安全な auth-shared に置き、ここから再エクスポートする
export { ROLE_HEADER, ROLE_COOKIE, type MarketingRole } from './auth-shared'

/**
 * Basic認証で一致したパスワードから役割を判定する。
 * どのパスワードにも一致しなければ null（＝未認証）。
 */
export function roleFromPassword(pass: string): MarketingRole | null {
  const admin = process.env.MARKETING_ADMIN_PASSWORD
  const staff = process.env.MARKETING_STAFF_PASSWORD
  if (admin && pass === admin) return 'admin'
  if (staff && pass === staff) return 'staff'
  return null
}

/** 認証（権限分け）が有効かどうか。管理者パスワード未設定のローカル開発では無効。 */
export function authEnabled(): boolean {
  return !!process.env.MARKETING_ADMIN_PASSWORD
}

/**
 * ルートハンドラ用の管理者ガード。
 * - 認証無効（ローカル開発）なら常に許可（null を返す）
 * - 有効なら proxy が注入した役割ヘッダーが 'admin' の時だけ許可
 * - それ以外は 403 レスポンスを返す（呼び出し側でそのまま return する）
 */
export function requireAdmin(request: NextRequest): NextResponse | null {
  if (!authEnabled()) return null
  const role = request.headers.get(ROLE_HEADER)
  if (role === 'admin') return null
  return NextResponse.json(
    { error: 'この操作は管理者（院長）のみ実行できます' },
    { status: 403 },
  )
}
