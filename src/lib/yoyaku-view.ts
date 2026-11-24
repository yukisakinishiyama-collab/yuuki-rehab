/**
 * 予約の画面で、どちらを見ているか（予約表＝時間の予約／来院予定＝日にちだけ。2026-11-24）
 *
 * 予約の画面（YoyakuFrame）はアプリの枠に常駐しているので、ほかの画面（今日の「今日の来院予定」など）から
 * 「来院予定を開いて」と頼めるように、小さな入れ物にしておく（useSyncExternalStore で読む）。
 */
export type YoyakuView = 'slots' | 'plans'

let current: YoyakuView = 'slots'
const listeners = new Set<() => void>()

export function getYoyakuView(): YoyakuView {
  return current
}

export function setYoyakuView(view: YoyakuView): void {
  if (view === current) return
  current = view
  for (const fn of listeners) fn()
}

export function subscribeYoyakuView(fn: () => void): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}
