/**
 * NOAH（柔整レセプトシステム）の日別集計の型（クライアント・サーバー共通）
 *
 * 流れ:
 *   毎晩 院のパソコン … Claude が NOAH の「分析 → 金額分析」「来院分析 → リピート率」を CSV に書き出し、
 *                       数字だけの集計JSON（noah_YYYY-MM-DD.json）を Google ドライブへ保存
 *   予約システム(GAS) … ?api=noahstats（署名つき）でそのファイルを確かめて返す
 *   ハブ               … 受け取った月ごとの集計を保存し、グラフ画面と院長LINEの「今日のまとめ」に使う
 *
 * 個人情報（氏名・受診者番号・電話番号など）は、どの段階にも含まれない。
 * 金額は NOAH の「金額分析」の値（保険の請求分も含めた総額。院長に確認済み 2026-10-23）。
 */

/** 日別の列（予約システム・PC側スクリプトと同じ並び） */
export const NOAH_COLS = [
  'day',
  'visits',
  'sales',
  'insV',
  'insS',
  'selfV',
  'selfS',
  'nonInsV',
  'nonInsS',
  'accV',
  'accS',
  'workV',
  'workS',
] as const

/** 区分（人数・金額の列の位置） */
export const NOAH_KINDS = [
  { key: 'ins', label: '保険', v: 3, s: 4 },
  { key: 'self', label: '自費・商品', v: 5, s: 6 },
  { key: 'acc', label: '交通事故', v: 9, s: 10 },
  { key: 'work', label: '労災', v: 11, s: 12 },
  { key: 'nonIns', label: '保険外', v: 7, s: 8 },
] as const

export type NoahKind = (typeof NOAH_KINDS)[number]['key']

/** リピート率（NOAH の来院分析）から取った人数 */
export interface NoahRepeat {
  /** リピート率「1回目」の人数 */
  patients?: number
  /** 画面で読んだ「初診（新患）」「再初診（初検）」の1回目（取れた日だけ） */
  newPt?: number
  reinit?: number
  cont?: number
  /** 月間離反: 先月来院した人数 / そのうち今月まだ来ていない人数 */
  last?: number
  gone?: number
  /** 今月まだ来ていない人の内訳（継続中・治癒・中止・転医） */
  goneCont?: number
  cured?: number
  stopped?: number
  moved?: number
  /** 自費の方の月間離反の人数 */
  selfGone?: number
}

export interface NoahMonth {
  /** 'YYYY-MM' */
  month: string
  /** この日（'YYYY-MM-DD'）までの集計 */
  asOf: string
  /** PCで書き出した日時（日本時間 'YYYY-MM-DDTHH:MM'） */
  exportedAt: string
  /** ドライブに保存された日時（予約システム側の表記） */
  savedAt?: string
  file?: string
  /** 1日1行。NOAH_COLS の並び */
  days: number[][]
  total: number[]
  /** 自費メニュー [名前, 単価, 金額, 点数] */
  self: Array<[string, number, number, number]>
  /** 商品 [名前, 単価, 金額, 点数] */
  goods: Array<[string, number, number, number]>
  /** NOAH のエリアランキング [年月, 院数, 順位] */
  rank: Array<[string, number, number]>
  repeat?: NoahRepeat
}

export interface NoahFileError {
  file: string
  savedAt: string
  message: string
}

/** ハブに保存しておく集計（KV: noah:store） */
export interface NoahStore {
  /** 新しい月が先頭 */
  months: NoahMonth[]
  latest: { file: string; asOf: string; exportedAt: string; savedAt: string } | null
  errors: NoahFileError[]
  folderFound: boolean
  fetchedAt: string
}

/** 毎晩のLINEを送ったかの記録（KV: noah:nightly:YYYY-MM-DD） */
export interface NoahNightlyMark {
  date: string
  kind: 'summary' | 'missing'
  sentAt: string
  delivered: boolean
  reason?: string
  draftItemId?: string
}
