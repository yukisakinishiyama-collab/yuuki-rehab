/**
 * マーケティングハブ権限管理の共有定数・型（クライアント/サーバー両用）。
 *
 * next/server に依存しないため、クライアントコンポーネントからも安全に import できる。
 * サーバー専用のガード（requireAdmin など）は auth.ts に置く。
 */
export type MarketingRole = 'admin' | 'staff'

/** proxy が権威的に注入する役割ヘッダー名（受信値は proxy 側で必ず破棄する） */
export const ROLE_HEADER = 'x-marketing-role'

/** クライアントUIが表示制御に使う読み取り可能なCookie名 */
export const ROLE_COOKIE = 'mk_role'
