/**
 * 集客概要（集客 → 集客概要）の数字の型。画面とサーバーの両方から読む
 *
 * 指示書5章「未取得の値は0として扱わず『未取得』と表示する」「期間・分母・重複排除の方法を明示する」に合わせ、
 * 数字は1つずつ「取れたか（state）」「期間（period）」「数え方（basis）」を持つ。売上などの経営の数字は入れない。
 */

/** ok=取れた / unavailable=つながっているが取れない・数え方がない / not_connected=未連携・未設定 */
export type MetricState = 'ok' | 'unavailable' | 'not_connected'

export interface Metric {
  key: string
  label: string
  /** 取れなかったときは null（0 にしない） */
  value: number | null
  unit: string
  state: MetricState
  /** 期間（例「11月1日〜今日」） */
  period: string
  /** 数え方（分母・同じ方をどう数えるか） */
  basis: string
  /** 取れなかった理由・気をつけること */
  note?: string
  /** 詳しく見る画面 */
  href?: string
}

export interface SourceRow {
  source: string
  label: string
  bookings: number
  firstVisit: number
  cancelled: number
  /** 予約ボタンを押した回数（計測リンク経由のもの） */
  clicks: number
}

export interface HpEntryRow {
  key: string
  label: string
  count: number
}

/** ホームページの入口（外から入ってきた回数を、来たところ・入口のページごとに） */
export interface HpEntries {
  period: string
  total: number
  /** 来たところ（Google 検索・マップ・Instagram など）。多い順 */
  sources: HpEntryRow[]
  /** 入口になったページ。多い順に最大8 */
  pages: HpEntryRow[]
}

export type ConnectionState = 'connected' | 'not_set' | 'error'

export interface ConnectionRow {
  key: string
  label: string
  state: ConnectionState
  note: string
  href?: string
}

export interface OverviewData {
  generatedAt: string
  /** 「11月」など */
  monthLabel: string
  today: Metric[]
  month: Metric[]
  /** 流入元別（予約システムから取れないときは null） */
  sources: SourceRow[] | null
  sourcesNote: string
  /** ホームページの入口（まだ記録が無い・読めないときは null） */
  hpEntries: HpEntries | null
  hpEntriesNote: string
  pending: {
    /** 院長の承認待ちの投稿案（この先の予定のもの） */
    approvals: number
    /** 未対応の問い合わせ */
    inquiriesNew: number
  }
  connections: ConnectionRow[]
}

export const METRIC_STATE_LABELS: Record<MetricState, string> = {
  ok: '',
  unavailable: '未取得',
  not_connected: '未連携',
}
