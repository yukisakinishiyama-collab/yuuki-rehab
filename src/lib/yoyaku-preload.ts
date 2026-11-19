/**
 * 院内アプリの中の「予約」（予約システムの管理画面）を、早く開くための決まり
 * （2026-11-19 院長「予約の時間を確認するところに移ろうとすると、時間がかかりすぎる」）
 *
 * 予約システム（Google の Apps Script）は、開くたびに起動とログインと予約の読みこみで数秒かかる。
 * アプリ側でできるのは、①先に裏で開いておく（いままでは2.5秒待ってから。いまは画面が落ち着いたらすぐ）、
 * ②一度開いた画面を捨てない（起動時の読み直しで、アプリ全体を読み直していたのをやめた。AppShell）、
 * ③待つときは、待っていることと目安の秒数を出す、の3つ。
 * ここは時間の計算と文だけ（画面の部品は components/rehab/YoyakuFrame.tsx。node で試せる：tools/test-yoyaku-preload.mjs）
 */

/** この端末で、予約の画面が開くまでにかかった時間（ミリ秒）を残しておく場所 */
export const LOAD_HISTORY_KEY = 'yoyaku_frame_load_ms'
/** 残しておく回数 */
export const LOAD_HISTORY_SIZE = 5
/** 画面が落ち着くのを待つ上限（この時間たったら、手が空いていなくても開きはじめる） */
export const PRELOAD_IDLE_TIMEOUT_MS = 1500
/** 「手が空いたとき」を知らせるしくみ（requestIdleCallback）が無い端末で待つ時間 */
export const PRELOAD_FALLBACK_DELAY_MS = 600

/** 残してある時間を読む（読めないものは捨てる） */
export function parseLoadHistory(raw: string | null | undefined): number[] {
  if (!raw) return []
  try {
    const v = JSON.parse(raw)
    return Array.isArray(v) ? v.filter((n): n is number => typeof n === 'number' && Number.isFinite(n) && n > 0).slice(-LOAD_HISTORY_SIZE) : []
  } catch {
    return []
  }
}

/**
 * 今回かかった時間を足す（新しい順に LOAD_HISTORY_SIZE 回まで）。
 * 0.2秒より短い（もう開いていた）・2分より長い（途中で端末が眠っていた など）ものは、目安をくるわせるので残さない
 */
export function rememberLoadMs(history: number[], ms: number): number[] {
  if (!Number.isFinite(ms) || ms < 200 || ms > 120_000) return history.slice(-LOAD_HISTORY_SIZE)
  return [...history, Math.round(ms)].slice(-LOAD_HISTORY_SIZE)
}

/** ふだんかかる秒数（残してある時間のまん中の値。1秒単位で、少なくとも1秒）。まだ無ければ null */
export function typicalLoadSeconds(history: number[]): number | null {
  if (history.length === 0) return null
  const sorted = [...history].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  const median = sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
  return Math.max(1, Math.round(median / 1000))
}

/** 待っているあいだに出す文（何秒たったか・ふだんは何秒か） */
export function loadingText(elapsedMs: number, typicalSeconds: number | null): { title: string; detail: string } {
  const sec = Math.max(0, Math.floor(elapsedMs / 1000))
  const title = '予約システムを開いています…'
  const typical = typicalSeconds ? `この端末では、ふだん約${typicalSeconds}秒で開きます。` : 'はじめは数秒かかります。'
  if (typicalSeconds && sec > typicalSeconds * 2 + 5) {
    return { title, detail: `${sec}秒たちました。いつもより時間がかかっています。開かないときは「新しいタブで開く」を押してください。` }
  }
  return { title, detail: `${typical}${sec > 0 ? `（${sec}秒）` : ''}` }
}
