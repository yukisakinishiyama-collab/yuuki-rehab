/**
 * 院内アプリの中の「予約」（予約システムの管理画面）の、ログインの期限の見はり
 *
 * 院内アプリから開いた予約管理画面は、パスワードの代わりに「管理チケット」で動く。
 * チケットは開いたときに予約システムが出し、12時間で切れる（予約システムの ADMIN_TICKET_TTL_MS_）。
 * 院内アプリは予約の画面を開いたままにする（読み直さない）ので、朝から夜まで開いていると切れて、
 * 予約の登録や自動更新がすべて「院内アプリのログインが切れました」で失敗する
 * （2026-11-16 の夜、登録が4回失敗していた。実行の記録で確認）。
 *
 * そこで、切れる前に新しいチケットで読み直す。入力の途中で画面が消えないように：
 *   - 予約の画面を見ていないとき・しばらく離れていて戻ってきたときは、だまって読み直す
 *   - 見ている最中は勝手に読み直さず、「読み直す」ボタンを出す
 * 画面の部品（YoyakuFrame）から使う。ここは時間の計算だけ（node で単体テストできる。tools/test-yoyaku-ticket.mjs）
 */

/** 管理チケットの有効時間（予約システムと同じ） */
export const ADMIN_TICKET_TTL_MS = 12 * 60 * 60 * 1000
/** これより古くなったら、見ていないとき・戻ってきたときに読み直す */
export const ADMIN_REFRESH_AFTER_MS = 10 * 60 * 60 * 1000
/** これより古くなったら、見ている最中でも「読み直す」を出す */
export const ADMIN_WARN_AFTER_MS = 11 * 60 * 60 * 1000
/** アプリから離れていた時間がこれ以上なら、戻ってきたときに読み直してよい（短い切り替えでは読み直さない） */
export const AWAY_LONG_ENOUGH_MS = 5 * 60 * 1000

export type AdminFrameAge = 'fresh' | 'stale' | 'expiring' | 'expired'

/** 予約の画面を読みこんでからの時間で、チケットの状態を見る。loadedAt が 0（署名なし＝パスワードで入る）なら、いつも fresh */
export function adminFrameAge(loadedAt: number, now: number): AdminFrameAge {
  if (!loadedAt) return 'fresh'
  const age = now - loadedAt
  if (age >= ADMIN_TICKET_TTL_MS) return 'expired'
  if (age >= ADMIN_WARN_AFTER_MS) return 'expiring'
  if (age >= ADMIN_REFRESH_AFTER_MS) return 'stale'
  return 'fresh'
}

/**
 * だまって読み直してよいか。
 * - frameVisible … いま「予約」の画面を見ているか
 * - awayMs … アプリから離れていて、いま戻ってきたときの、離れていた時間（戻ってきたとき以外は 0）
 */
export function shouldAutoRefresh(input: { age: AdminFrameAge; frameVisible: boolean; awayMs: number }): boolean {
  if (input.age === 'fresh') return false
  if (!input.frameVisible) return true
  return input.awayMs >= AWAY_LONG_ENOUGH_MS
}

/** 見ている最中に出す案内（出さないときは ''） */
export function adminFrameNotice(age: AdminFrameAge): string {
  if (age === 'expired') return '予約の画面のログインが切れました。「読み直す」を押してください（入力の途中の内容は消えます）。'
  if (age === 'expiring') return '予約の画面のログインが、まもなく切れます。きりのよいところで「読み直す」を押してください。'
  return ''
}
